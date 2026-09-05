/*
 * protocol.js - building the prompts, and reading the answers back.
 *
 * Two jobs live here. Assembling the text each agent is shown, and parsing a
 * judge's answer into a verdict. The parser is deliberately strict about the
 * two things the specification requires - a verdict and at least two reasons -
 * and deliberately forgiving about everything else, because a judge that
 * writes a heading slightly differently has still ruled.
 */

import {
    ALLOWED_VERDICTS,
    MINIMUM_REASONS,
    VERDICT_GUILTY,
    VERDICT_NOT_GUILTY
} from "../constants.js";

/*
 * Removes anything from submitted text that could close one of the markers
 * early and let the submission escape its block. This is the mechanical half
 * of the prompt-injection defence; the instruction in every system prompt is
 * the other half, and neither is sufficient alone.
 */
function neutralizeMarkers(text) {
    return String(text || "")
        .replace(/<\s*\/?\s*charge_sheet\s*>/gi, "[marker removed]")
        .replace(/<\s*\/?\s*speech\s*>/gi, "[marker removed]");
}

// Renders the three-part charge sheet as the block every agent reads.
export function renderChargeSheet(chargeSheet) {
    const lines = [
        "<charge_sheet>",
        "DEFENDANT: " + neutralizeMarkers(chargeSheet.defendant),
        "",
        "THE ACT AND THE CASE DETAILS:",
        neutralizeMarkers(chargeSheet.act),
        "",
        "THE EXACT QUESTION BEFORE THE COURT:",
        neutralizeMarkers(chargeSheet.question),
        "</charge_sheet>"
    ];
    return lines.join("\n");
}

// The user message a speaker receives.
export function buildSpeakerPrompt(chargeSheet) {
    return (
        renderChargeSheet(chargeSheet) +
        "\n\nThis is the case. Deliver your closing speech to the three judges now."
    );
}

// The user message a judge receives: the sheet, then all four speeches.
export function buildJudgePrompt(chargeSheet, speeches) {
    const parts = [renderChargeSheet(chargeSheet), "", "THE SPEECHES, IN THE ORDER THEY WERE GIVEN:"];

    speeches.forEach(function (speech) {
        parts.push("");
        parts.push("<speech>");
        parts.push("SPEAKER: " + speech.speakerName + " (" + speech.role + ")");
        if (speech.ok) {
            parts.push(neutralizeMarkers(speech.text));
            if (speech.truncated) {
                parts.push(
                    "[This speech reached its length limit and stops mid-sentence. " +
                        "Judge it on what was said; do not treat the abrupt ending as the " +
                        "advocate's conclusion, and do not hold the missing part against " +
                        "that side.]"
                );
            }
        } else {
            parts.push(
                "This speech was not delivered. The speaker's call failed: " +
                    speech.error +
                    " Rule on the case without it, and take account of the fact that " +
                    "this side was heard from " +
                    (speech.role === "Prosecution" ? "less" : "less") +
                    " fully than the other."
            );
        }
        parts.push("</speech>");
    });

    parts.push("");
    parts.push("You have now read the charge sheet and every speech. Give your ruling.");
    return parts.join("\n");
}

// Finds the verdict word on the VERDICT line. "NOT GUILTY" is tested first,
// because "NOT GUILTY" contains "GUILTY" and would otherwise read as guilty.
function readVerdict(line) {
    const upper = line.toUpperCase();
    if (upper.indexOf(VERDICT_NOT_GUILTY) !== -1) {
        return VERDICT_NOT_GUILTY;
    }
    if (/\bNOT[\s-]*GUILTY\b/.test(upper)) {
        return VERDICT_NOT_GUILTY;
    }
    if (/\bGUILTY\b/.test(upper)) {
        return VERDICT_GUILTY;
    }
    return null;
}

/*
 * Turns a judge's answer into a verdict record.
 *
 * Returns { ok: false, problem } when the answer does not carry a verdict and
 * at least two reasons. That is not a lenient reading of a difficult answer:
 * an answer that cannot be read is a failure of the call, and it is shown as
 * a failure. It never becomes a default verdict, because a default that
 * enters the record is read by everyone afterwards as a decision.
 */
/*
 * Lines that belong to the form as it was given to the judge, rather than to
 * an answer. A reasoning model very often restates its instructions before it
 * starts thinking, and a parser that reads the restatement finds a verdict
 * that nobody reached.
 */
const TEMPLATE_LINE = /GUILTY\s+or\s+NOT\s+GUILTY|NOT\s+GUILTY\s+or\s+GUILTY|a whole number from|the name of the speaker/i;

const PLACEHOLDER_REASON =
    /^(first|second|third)\s+reason$|^further reasons|^one paragraph saying/i;

export function parseVerdict(text) {
    const raw = String(text || "");
    const allLines = raw.split(/\r?\n/);

    /*
     * Take the LAST verdict line that is not part of an echoed template.
     *
     * The last one, because a model that restates the form and then thinks
     * aloud reaches its actual answer at the end. Not part of a template,
     * because "VERDICT: GUILTY or NOT GUILTY" is the question being asked and
     * not an answer to it - reading it as one produced a confident NOT GUILTY
     * from a judge that had in fact concluded the opposite.
     */
    let startIndex = 0;
    let found = false;
    for (let index = 0; index < allLines.length; index += 1) {
        const candidate = allLines[index].trim().replace(/\*\*/g, "");
        if (/^\s*VERDICT\s*[:\-]/i.test(candidate) && !TEMPLATE_LINE.test(candidate)) {
            startIndex = index;
            found = true;
        }
    }

    const lines = found ? allLines.slice(startIndex) : allLines;

    let verdict = null;
    let confidence = null;
    let decisive = null;
    const reasons = [];
    const reasoningLines = [];

    let section = "none";

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        // Models bold their headings far more often than not. The emphasis
        // markers carry no meaning in a court record, so they are removed
        // before anything is matched, and "**VERDICT:**" reads the same as
        // "VERDICT:".
        const trimmed = line.trim().replace(/\*\*/g, "").replace(/__/g, "");
        if (trimmed === "") {
            if (section === "reasoning") {
                reasoningLines.push("");
            }
            continue;
        }

        const verdictMatch = /^\**\s*VERDICT\s*\**\s*[:\-]\s*(.+)$/i.exec(trimmed);
        if (verdictMatch) {
            verdict = readVerdict(verdictMatch[1]);
            section = "none";
            continue;
        }

        const confidenceMatch = /^\**\s*CONFIDENCE\s*\**\s*[:\-]\s*(\d{1,3})/i.exec(trimmed);
        if (confidenceMatch) {
            const value = Number(confidenceMatch[1]);
            confidence = value >= 0 && value <= 100 ? value : null;
            section = "none";
            continue;
        }

        if (/^\**\s*REASONS?\s*\**\s*[:\-]?\s*$/i.test(trimmed)) {
            section = "reasons";
            continue;
        }

        const decisiveMatch = /^\**\s*DECISIVE\s*(?:SPEECH|SPEAKER)?\s*\**\s*[:\-]\s*(.+)$/i.exec(trimmed);
        if (decisiveMatch) {
            const value = decisiveMatch[1].replace(/[*_`]/g, "").trim();
            decisive = /^none$/i.test(value) ? null : value;
            section = "none";
            continue;
        }

        const reasoningMatch = /^\**\s*REASONING\s*\**\s*[:\-]\s*(.*)$/i.exec(trimmed);
        if (reasoningMatch) {
            section = "reasoning";
            if (reasoningMatch[1].trim() !== "") {
                reasoningLines.push(reasoningMatch[1].trim());
            }
            continue;
        }

        if (section === "reasons") {
            const bullet = /^[-*•]\s*(.+)$/.exec(trimmed) || /^\d+[.)]\s*(.+)$/.exec(trimmed);
            if (bullet) {
                const reason = bullet[1].replace(/[*_`]/g, "").trim();
                // "- first reason" is the form, not a reason.
                if (!PLACEHOLDER_REASON.test(reason)) {
                    reasons.push(reason);
                }
                continue;
            }
            // A line under REASONS that is not a bullet ends the list.
            section = "none";
        }

        if (section === "reasoning") {
            reasoningLines.push(trimmed);
        }
    }

    // A judge that ignored the form entirely may still have named a verdict in
    // its first line. That is worth recovering; two missing reasons are not.
    if (!verdict && found && lines.length > 0) {
        const head = lines.slice(0, 3).filter(function (line) {
            return !TEMPLATE_LINE.test(line);
        });
        verdict = readVerdict(head.join(" "));
    }

    const reasoning = reasoningLines.join("\n").trim();

    if (!verdict) {
        return {
            ok: false,
            problem:
                "The answer carried no verdict. The form asks for one of " +
                ALLOWED_VERDICTS.join(" or ") +
                " on a VERDICT line, and none was found.",
            raw: raw
        };
    }

    if (reasons.length < MINIMUM_REASONS) {
        return {
            ok: false,
            problem:
                "The answer gave " +
                reasons.length +
                " reason" +
                (reasons.length === 1 ? "" : "s") +
                ", and the standard for this court is a verdict plus at least " +
                MINIMUM_REASONS +
                ". A ruling that is not reasoned is not a ruling.",
            raw: raw,
            partialVerdict: verdict
        };
    }

    return {
        ok: true,
        verdict: verdict,
        confidence: confidence,
        reasons: reasons,
        decisive: decisive,
        reasoning: reasoning || "The judge gave reasons but no separate account of the reasoning.",
        raw: raw
    };
}

/*
 * Counts the verdicts without ever combining them.
 *
 * The panel does not produce one answer. This returns the tally purely so the
 * screen can say how the three fell, and it reports whether they disagreed,
 * because the disagreement is the useful output of a panel and not a defect
 * in it.
 */
export function tallyVerdicts(rulings) {
    const delivered = rulings.filter(function (ruling) {
        return ruling.ok;
    });
    const guilty = delivered.filter(function (ruling) {
        return ruling.verdict === VERDICT_GUILTY;
    }).length;
    const notGuilty = delivered.length - guilty;

    return {
        delivered: delivered.length,
        failed: rulings.length - delivered.length,
        guilty: guilty,
        notGuilty: notGuilty,
        unanimous: delivered.length > 0 && (guilty === 0 || notGuilty === 0),
        split: guilty > 0 && notGuilty > 0
    };
}
