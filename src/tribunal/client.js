/*
 * client.js - the browser side of one model call.
 *
 * Nothing else in the application talks to the network. Everything goes
 * through callModel, so the retry rule, the timeout and the shape of a
 * failure are decided in exactly one place.
 */

import { CHAT_ENDPOINT, MODELS_ENDPOINT, FALLBACK_MODELS } from "../constants.js";

// A single call is abandoned after this long. A judge that never answers must
// become a visible failure rather than a run that hangs.
const CALL_TIMEOUT_MS = 90000;

// A call is tried this many times in total before it is declared failed.
// Only transport errors and rate limits are retried; a refusal is not.
const MAX_ATTEMPTS = 2;

function wait(milliseconds) {
    return new Promise(function (resolve) {
        setTimeout(resolve, milliseconds);
    });
}

/*
 * Runs one model call. Resolves with { ok: true, text, usage, ... } or with
 * { ok: false, error }. It does not throw, because a failed call is an
 * ordinary outcome the panel has to display rather than an exception that
 * takes the run down with it.
 */
export async function callModel(options) {
    let lastError = "The call was never attempted.";

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        const controller = new AbortController();
        const timeoutId = setTimeout(function () {
            controller.abort();
        }, CALL_TIMEOUT_MS);

        try {
            const response = await fetch(CHAT_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: options.model,
                    system: options.system,
                    user: options.user,
                    maxTokens: options.maxTokens,
                    temperature: options.temperature
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            const body = await response.json().catch(function () {
                return { error: "The server answered with something that was not JSON." };
            });

            if (response.ok && body.text) {
                return {
                    ok: true,
                    text: body.text,
                    model: body.model,
                    finishReason: body.finishReason,
                    elapsedMs: body.elapsedMs,
                    usage: body.usage
                };
            }

            lastError = body.error || "The call failed with status " + response.status + ".";

            // A rate limit is worth one more try after a pause. Anything else
            // will fail the same way a second time.
            if (response.status !== 429) {
                return { ok: false, error: lastError };
            }
            await wait(1500 * attempt);
        } catch (error) {
            clearTimeout(timeoutId);
            lastError =
                error.name === "AbortError"
                    ? "The model did not answer within 90 seconds."
                    : "The call could not be made: " + error.message;
        }
    }

    return { ok: false, error: lastError };
}

/*
 * Reads the live model catalogue. Falls back to a small list of free models
 * so the pickers are never empty, and says which of the two happened so the
 * screen can be honest about it.
 */
export async function loadModels() {
    try {
        const response = await fetch(MODELS_ENDPOINT);
        const body = await response.json();
        if (response.ok && Array.isArray(body.models) && body.models.length > 0) {
            return { ok: true, models: body.models, fetchedAt: body.fetchedAt };
        }
        return {
            ok: false,
            models: FALLBACK_MODELS,
            error: body.error || "The catalogue came back empty."
        };
    } catch (error) {
        return {
            ok: false,
            models: FALLBACK_MODELS,
            error: "The catalogue could not be reached: " + error.message
        };
    }
}
