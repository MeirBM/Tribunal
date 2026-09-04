/*
 * openrouter.js - the only place in the project that holds the API key.
 *
 * The browser never sees OPENROUTER_API_KEY. It posts a model name and a pair
 * of messages here, this function adds the key, forwards the call to
 * OpenRouter and hands back the answer together with the token usage.
 *
 * Everything the browser sends is treated as untrusted: the model name, the
 * message contents and the length limit are all checked before the call is
 * made, so a crafted request cannot turn this endpoint into a general
 * purpose proxy paid for by the site owner.
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// A single call may never ask for more than this many completion tokens.
// It is the last line of defence for the run budget: even if the browser is
// tampered with, one call cannot become arbitrarily expensive.
const MAX_COMPLETION_TOKENS = 2000;

// The longest charge sheet plus speeches a single call may carry.
const MAX_MESSAGE_CHARACTERS = 60000;

function jsonResponse(body, status) {
    return new Response(JSON.stringify(body), {
        status: status || 200,
        headers: { "content-type": "application/json; charset=utf-8" }
    });
}

// Returns a trimmed string, or null when the value is not a usable string.
function readString(value, limit) {
    if (typeof value !== "string") {
        return null;
    }
    const text = value.trim();
    if (text === "" || text.length > limit) {
        return null;
    }
    return text;
}

export default async function handler(request) {
    if (request.method !== "POST") {
        return jsonResponse({ error: "Use POST." }, 405);
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        return jsonResponse(
            {
                error:
                    "The server has no OPENROUTER_API_KEY. Locally, copy .env.example " +
                    "to .env and put a key in it. On Netlify, set it under Site " +
                    "configuration -> Environment variables."
            },
            500
        );
    }

    let payload;
    try {
        payload = await request.json();
    } catch (error) {
        return jsonResponse({ error: "The request body was not valid JSON." }, 400);
    }

    const model = readString(payload.model, 200);
    if (!model) {
        return jsonResponse({ error: "A model name is required." }, 400);
    }

    const systemPrompt = readString(payload.system, MAX_MESSAGE_CHARACTERS);
    const userPrompt = readString(payload.user, MAX_MESSAGE_CHARACTERS);
    if (!systemPrompt || !userPrompt) {
        return jsonResponse(
            { error: "Both a system prompt and a user prompt are required." },
            400
        );
    }

    let maxTokens = Number(payload.maxTokens);
    if (!isFinite(maxTokens) || maxTokens <= 0) {
        maxTokens = 900;
    }
    maxTokens = Math.min(Math.round(maxTokens), MAX_COMPLETION_TOKENS);

    let temperature = Number(payload.temperature);
    if (!isFinite(temperature) || temperature < 0 || temperature > 2) {
        temperature = 0.7;
    }

    const startedAt = Date.now();
    let upstream;
    try {
        upstream = await fetch(OPENROUTER_URL, {
            method: "POST",
            headers: {
                Authorization: "Bearer " + apiKey,
                "Content-Type": "application/json",
                "HTTP-Referer": process.env.OPENROUTER_APP_URL || "http://localhost:8888",
                "X-Title": process.env.OPENROUTER_APP_TITLE || "Tribunal"
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                max_tokens: maxTokens,
                temperature: temperature,
                usage: { include: true }
            })
        });
    } catch (error) {
        return jsonResponse(
            { error: "The call to OpenRouter did not go through: " + error.message },
            502
        );
    }

    const elapsedMs = Date.now() - startedAt;
    const raw = await upstream.text();

    let body;
    try {
        body = JSON.parse(raw);
    } catch (error) {
        return jsonResponse(
            { error: "OpenRouter answered with something that was not JSON.", detail: raw.slice(0, 400) },
            502
        );
    }

    if (!upstream.ok || body.error) {
        const detail = body.error && body.error.message ? body.error.message : upstream.statusText;
        return jsonResponse(
            { error: "OpenRouter refused the call: " + detail, status: upstream.status },
            upstream.status === 429 ? 429 : 502
        );
    }

    const choice = body.choices && body.choices[0];
    const text = choice && choice.message ? choice.message.content : "";
    const usage = body.usage || {};

    if (typeof text !== "string" || text.trim() === "") {
        return jsonResponse(
            { error: "The model returned an empty answer.", model: body.model || model },
            502
        );
    }

    return jsonResponse({
        text: text,
        model: body.model || model,
        finishReason: choice.finish_reason || null,
        elapsedMs: elapsedMs,
        usage: {
            promptTokens: usage.prompt_tokens || 0,
            completionTokens: usage.completion_tokens || 0,
            totalTokens: usage.total_tokens || 0,
            // OpenRouter returns the real charge here when it can work it out.
            // The browser falls back to the price list when it is missing.
            reportedCost: typeof usage.cost === "number" ? usage.cost : null
        }
    });
}

export const config = { path: "/api/openrouter" };
