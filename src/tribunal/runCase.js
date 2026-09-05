/*
 * runCase.js - the orchestrator. One deliberation, seven calls, two waves.
 *
 * The shape of the run is fixed by what actually depends on what. The four
 * speakers depend on nothing but the charge sheet, so they are called at the
 * same time. Every judge needs all four speeches, so the judges wait for the
 * first wave and then go together. Run in sequence the same work takes
 * roughly three times as long and costs exactly the same, which is why the
 * report records both numbers.
 */

import {
    CONFIG_SINGLE,
    SPEECH_MAX_TOKENS,
    VERDICT_MAX_TOKENS,
    CALLS_PER_RUN
} from "../constants.js";
import { SPEAKERS, JUDGES, judgeSystemPrompt } from "./personas.js";
import { buildSpeakerPrompt, buildJudgePrompt, parseVerdict, tallyVerdicts } from "./protocol.js";
import { callModel } from "./client.js";
import { computeCallCost, estimateTokens, estimateRunCost } from "../lib/money.js";

function newRunId() {
    return "case-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
}

// Which model each half of the panel uses, given the chosen arrangement.
export function resolveModels(config, speakerModel, judgeModel) {
    if (config === CONFIG_SINGLE) {
        return { speakerModel: speakerModel, judgeModel: speakerModel };
    }
    return { speakerModel: speakerModel, judgeModel: judgeModel };
}

/*
 * Works out what the run would cost at worst, before anything is spent.
 * Exported so the screen can show the figure next to the budget cap while the
 * user is still choosing models.
 */
export function planRun(chargeSheet, config, speakerModel, judgeModel) {
    const models = resolveModels(config, speakerModel, judgeModel);
    const speakerPrompt = buildSpeakerPrompt(chargeSheet);
    const speakerPromptTokens = estimateTokens(speakerPrompt) + 400;

    // A judge reads the sheet plus four speeches, each of which can run to the
    // speech allowance, so its prompt is much the larger of the two.
    const judgePromptTokens = speakerPromptTokens + SPEECH_MAX_TOKENS * 4 + 400;

    const plan = [];
    SPEAKERS.forEach(function () {
        plan.push({
            model: models.speakerModel,
            promptTokens: speakerPromptTokens,
            maxTokens: SPEECH_MAX_TOKENS
        });
    });
    JUDGES.forEach(function () {
        plan.push({
            model: models.judgeModel,
            promptTokens: judgePromptTokens,
            maxTokens: VERDICT_MAX_TOKENS
        });
    });

    return {
        calls: CALLS_PER_RUN,
        worstCaseUsd: estimateRunCost(plan),
        speakerPromptTokens: speakerPromptTokens,
        judgePromptTokens: judgePromptTokens,
        models: models
    };
}

/*
 * Runs one complete deliberation.
 *
 * onProgress is called as each stage begins and ends, so the screen can show
 * the panel working instead of a spinner over a blank page. The function
 * never throws for an ordinary failure: a speaker or judge that fails comes
 * back marked as failed, and the run reports itself incomplete.
 */
export async function runCase(options) {
    const chargeSheet = options.chargeSheet;
    const config = options.config;
    const budgetUsd = options.budgetUsd;
    const onProgress = options.onProgress || function () {};

    const models = resolveModels(config, options.speakerModel, options.judgeModel);
    const plan = planRun(chargeSheet, config, options.speakerModel, options.judgeModel);

    // The cap binds before the first call, not after the last one.
    if (plan.worstCaseUsd > budgetUsd) {
        return {
            ok: false,
            refused: true,
            error:
                "This run was refused before any call was made. At worst it would cost " +
                plan.worstCaseUsd.toFixed(4) +
                " dollars, and the cap for one run is " +
                budgetUsd.toFixed(2) +
                ". Choose cheaper models or raise the cap."
        };
    }

    const runId = newRunId();
    const startedAt = Date.now();
    const calls = [];

    function recordCall(entry) {
        calls.push(entry);
        onProgress({ type: "call", call: entry, calls: calls.slice() });
    }

    // ---- Wave one: the four speeches, all at the same time ----------------
    onProgress({ type: "stage", stage: "speeches", status: "started" });

    const speakerPrompt = buildSpeakerPrompt(chargeSheet);
    const waveOneStarted = Date.now();

    const speeches = await Promise.all(
        SPEAKERS.map(async function (speaker) {
            const callStarted = Date.now();
            const result = await callModel({
                model: models.speakerModel.id,
                system: speaker.systemPrompt,
                user: speakerPrompt,
                maxTokens: SPEECH_MAX_TOKENS,
                temperature: 0.8
            });

            const cost = result.ok ? computeCallCost(result.usage, models.speakerModel) : 0;

            recordCall({
                id: speaker.id,
                stage: "speech",
                agent: speaker.name,
                agentTitle: speaker.title,
                role: speaker.role,
                modelId: models.speakerModel.id,
                modelName: models.speakerModel.name,
                ok: result.ok,
                truncated: result.ok && result.finishReason === "length",
                error: result.ok ? null : result.error,
                promptTokens: result.ok ? result.usage.promptTokens : 0,
                completionTokens: result.ok ? result.usage.completionTokens : 0,
                totalTokens: result.ok ? result.usage.totalTokens : 0,
                costUsd: cost,
                elapsedMs: result.ok ? result.elapsedMs : 0,
                roundTripMs: Date.now() - callStarted,
                verdict: null
            });

            /*
             * A speech that filled its allowance stopped mid-sentence. It is
             * still most of an argument, so it is kept rather than discarded -
             * throwing it away would silence one side entirely - but it is
             * marked, and the judges are told, so an abrupt ending is not read
             * as the advocate's conclusion.
             */
            return {
                speakerId: speaker.id,
                speakerName: speaker.name,
                speakerTitle: speaker.title,
                role: speaker.role,
                side: speaker.side,
                ok: result.ok,
                truncated: result.ok && result.finishReason === "length",
                text: result.ok ? result.text.trim() : "",
                error: result.ok ? null : result.error,
                modelId: models.speakerModel.id,
                elapsedMs: result.ok ? result.elapsedMs : 0
            };
        })
    );

    const waveOneMs = Date.now() - waveOneStarted;
    onProgress({ type: "stage", stage: "speeches", status: "finished", speeches: speeches });

    const spentSoFar = calls.reduce(function (sum, call) {
        return sum + call.costUsd;
    }, 0);

    // If every speech failed there is nothing for a judge to weigh, and
    // calling three judges on an empty record would only spend more.
    const delivered = speeches.filter(function (speech) {
        return speech.ok;
    });
    if (delivered.length === 0) {
        return {
            ok: false,
            runId: runId,
            error:
                "No speech was delivered, so the judges were not called. " +
                "The first failure was: " +
                speeches[0].error,
            chargeSheet: chargeSheet,
            config: config,
            models: { speaker: models.speakerModel, judge: models.judgeModel },
            speeches: speeches,
            rulings: [],
            calls: calls,
            totals: summarise(calls, Date.now() - startedAt, waveOneMs, 0),
            createdAt: new Date().toISOString()
        };
    }

    // ---- Wave two: the three rulings, all at the same time ----------------
    onProgress({ type: "stage", stage: "verdicts", status: "started" });

    const judgePrompt = buildJudgePrompt(chargeSheet, speeches);
    const waveTwoStarted = Date.now();

    const rulings = await Promise.all(
        JUDGES.map(async function (judge) {
            const callStarted = Date.now();
            const result = await callModel({
                model: models.judgeModel.id,
                system: judgeSystemPrompt(judge, chargeSheet),
                user: judgePrompt,
                maxTokens: VERDICT_MAX_TOKENS,
                temperature: 0.4
            });

            const cost = result.ok ? computeCallCost(result.usage, models.judgeModel) : 0;

            if (!result.ok) {
                recordCall({
                    id: judge.id,
                    stage: "verdict",
                    agent: judge.name,
                    agentTitle: judge.title,
                    role: "Judge",
                    modelId: models.judgeModel.id,
                    modelName: models.judgeModel.name,
                    ok: false,
                    error: result.error,
                    promptTokens: 0,
                    completionTokens: 0,
                    totalTokens: 0,
                    costUsd: 0,
                    elapsedMs: 0,
                    roundTripMs: Date.now() - callStarted,
                    verdict: null
                });

                return {
                    judgeId: judge.id,
                    judgeName: judge.name,
                    judgeTitle: judge.title,
                    ok: false,
                    failure: "call",
                    problem: result.error,
                    modelId: models.judgeModel.id,
                    elapsedMs: 0
                };
            }

            /*
             * An answer cut off at the token limit is not a short ruling, it
             * is an unfinished one. Reasoning models spend the allowance
             * thinking aloud and stop before they reach the form, and what is
             * left behind reads like an answer without being one.
             */
            const truncated = result.finishReason === "length";
            const parsed = truncated
                ? {
                      ok: false,
                      problem:
                          "The answer was cut off at the token limit before the judge " +
                          "finished. This model reasons at length before it writes its " +
                          "ruling; give it a larger allowance or choose another.",
                      raw: result.text
                  }
                : parseVerdict(result.text, chargeSheet);

            recordCall({
                id: judge.id,
                stage: "verdict",
                agent: judge.name,
                agentTitle: judge.title,
                role: "Judge",
                modelId: models.judgeModel.id,
                modelName: models.judgeModel.name,
                ok: parsed.ok,
                error: parsed.ok ? null : parsed.problem,
                promptTokens: result.usage.promptTokens,
                completionTokens: result.usage.completionTokens,
                totalTokens: result.usage.totalTokens,
                costUsd: cost,
                elapsedMs: result.elapsedMs,
                roundTripMs: Date.now() - callStarted,
                verdict: parsed.ok ? parsed.verdict : null
            });

            if (!parsed.ok) {
                return {
                    judgeId: judge.id,
                    judgeName: judge.name,
                    judgeTitle: judge.title,
                    ok: false,
                    failure: "form",
                    problem: parsed.problem,
                    raw: parsed.raw,
                    modelId: models.judgeModel.id,
                    elapsedMs: result.elapsedMs
                };
            }

            return {
                judgeId: judge.id,
                judgeName: judge.name,
                judgeTitle: judge.title,
                ok: true,
                verdict: parsed.verdict,
                confidence: parsed.confidence,
                reasons: parsed.reasons,
                decisive: parsed.decisive,
                reasoning: parsed.reasoning,
                raw: parsed.raw,
                modelId: models.judgeModel.id,
                elapsedMs: result.elapsedMs
            };
        })
    );

    const waveTwoMs = Date.now() - waveTwoStarted;
    onProgress({ type: "stage", stage: "verdicts", status: "finished", rulings: rulings });

    const totals = summarise(calls, Date.now() - startedAt, waveOneMs, waveTwoMs);

    return {
        ok: true,
        runId: runId,
        createdAt: new Date().toISOString(),
        chargeSheet: chargeSheet,
        config: config,
        models: { speaker: models.speakerModel, judge: models.judgeModel },
        speeches: speeches,
        rulings: rulings,
        calls: calls,
        totals: totals,
        tally: tallyVerdicts(rulings, chargeSheet),
        budgetUsd: budgetUsd,
        spentBeforeJudges: spentSoFar
    };
}

// Adds up the call log into the figures the cost report shows.
function summarise(calls, wallMs, waveOneMs, waveTwoMs) {
    const totals = calls.reduce(
        function (sum, call) {
            return {
                promptTokens: sum.promptTokens + call.promptTokens,
                completionTokens: sum.completionTokens + call.completionTokens,
                totalTokens: sum.totalTokens + call.totalTokens,
                costUsd: sum.costUsd + call.costUsd,
                /*
                 * Two different clocks, and confusing them makes parallelism
                 * look like a loss.
                 *
                 * sequentialMs sums the full round trip of each call as the
                 * browser saw it, so it is the honest answer to "what if these
                 * had been run one after another".
                 *
                 * modelMs sums only the time the model itself spent, measured
                 * inside the server. The gap between the two is the platform:
                 * cold starts and queueing, which a sequential run would also
                 * have paid, once per call.
                 */
                sequentialMs: sum.sequentialMs + (call.roundTripMs || 0),
                modelMs: sum.modelMs + call.elapsedMs
            };
        },
        { promptTokens: 0, completionTokens: 0, totalTokens: 0, costUsd: 0, sequentialMs: 0, modelMs: 0 }
    );

    totals.callCount = calls.length;
    totals.failedCalls = calls.filter(function (call) {
        return !call.ok;
    }).length;
    totals.wallMs = wallMs;
    totals.waveOneMs = waveOneMs;
    totals.waveTwoMs = waveTwoMs;
    return totals;
}
