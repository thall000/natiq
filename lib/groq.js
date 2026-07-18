import "server-only";

// Groq returns HTTP 429 with a JSON body like:
//   { "error": { "message": "Rate limit reached for model \`llama-3.3-70b-versatile\` ...
//                Please try again in 1m32.448s. ...", "type": "tokens",
//                "code": "rate_limit_exceeded" } }
// Every route that calls Groq needs to tell this apart from a genuine failure (bad
// request, model error, network issue) so the frontend can show a calm "try again in a
// few minutes" message instead of "something is broken" — see fetchWithRateLimitRetry
// in lib/clientApiError.js for the client side of this contract.

// Groq's message embeds the suggested wait as "1m32.448s" or, for shorter waits, just
// "51.84s" — the minutes group is optional.
const RETRY_AFTER_PATTERN = /try again in (?:(\d+)m)?([\d.]+)s/i;

export async function parseGroqError(res) {
  const rawText = await res.text();
  let parsed = null;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    // Groq's error body is normally JSON; if not, fall back to raw text below.
  }

  const code = parsed?.error?.code;
  const message = parsed?.error?.message || rawText;
  const isRateLimited = res.status === 429 || code === "rate_limit_exceeded";

  if (!isRateLimited) {
    return { isRateLimited: false, rawText };
  }

  const match = message.match(RETRY_AFTER_PATTERN);
  const retryAfterSeconds = match
    ? Math.ceil((match[1] ? parseInt(match[1], 10) * 60 : 0) + parseFloat(match[2]))
    : null;

  return { isRateLimited: true, retryAfterSeconds, rawText };
}
