/*
 * constants.js - values shared across the application.
 */

// Where the browser reaches the two serverless functions. The key lives behind
// these, never in this bundle.
export const CHAT_ENDPOINT = "/api/openrouter";
export const MODELS_ENDPOINT = "/api/models";

// The IndexedDB store that keeps past cases, so a case can be found again.
export const DATABASE_NAME = "tribunaldb";
export const DATABASE_VERSION = 1;
export const CASE_STORE = "cases";

// One deliberation is always these seven calls: four speeches, then three
// rulings. Nothing in the application may quietly make it more.
export const SPEAKER_COUNT = 4;
export const JUDGE_COUNT = 3;
export const CALLS_PER_RUN = SPEAKER_COUNT + JUDGE_COUNT;

/*
 * The two arrangements the project is asked to compare.
 *   SINGLE - one model does all seven calls; only the system prompts differ.
 *   SPLIT  - one model for the four speakers, another for the three judges.
 */
export const CONFIG_SINGLE = "SINGLE";
export const CONFIG_SPLIT = "SPLIT";

export const CONFIG_LABELS = {
    SINGLE: "A · One model for everyone",
    SPLIT: "B · Separate models for speakers and judges"
};

/*
 * The budget for one complete run. The brief sets a ceiling of five dollars
 * and asks for free models wherever possible, so the default cap sits far
 * below the ceiling and the ceiling itself cannot be exceeded.
 */
export const DEFAULT_BUDGET_USD = 0.25;
export const MAX_BUDGET_USD = 5;

// How many completion tokens each kind of call may produce.
export const SPEECH_MAX_TOKENS = 900;
export const VERDICT_MAX_TOKENS = 900;

// The two answers a judge is allowed to return. Anything else is a malformed
// answer, and a malformed answer is a failure, never a verdict.
export const VERDICT_GUILTY = "GUILTY";
export const VERDICT_NOT_GUILTY = "NOT GUILTY";
export const ALLOWED_VERDICTS = [VERDICT_GUILTY, VERDICT_NOT_GUILTY];

// A judge must give a verdict and at least this many reasons for it. Fewer
// reasons is not a weaker verdict; it is a malformed answer.
export const MINIMUM_REASONS = 2;

// Models used when the live catalogue cannot be reached. Free tiers on
// OpenRouter, so a fallback run still costs nothing.
export const FALLBACK_MODELS = [
    {
        id: "meta-llama/llama-3.3-70b-instruct:free",
        name: "Llama 3.3 70B Instruct (free)",
        contextLength: 65536,
        promptPrice: 0,
        completionPrice: 0,
        isFree: true
    },
    {
        id: "deepseek/deepseek-chat-v3-0324:free",
        name: "DeepSeek V3 0324 (free)",
        contextLength: 65536,
        promptPrice: 0,
        completionPrice: 0,
        isFree: true
    },
    {
        id: "mistralai/mistral-small-3.1-24b-instruct:free",
        name: "Mistral Small 3.1 24B (free)",
        contextLength: 96000,
        promptPrice: 0,
        completionPrice: 0,
        isFree: true
    },
    {
        id: "qwen/qwen-2.5-72b-instruct:free",
        name: "Qwen 2.5 72B Instruct (free)",
        contextLength: 32768,
        promptPrice: 0,
        completionPrice: 0,
        isFree: true
    }
];
