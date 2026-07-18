// Shared client-side handling for the honest rate-limit contract every Groq-calling API
// route returns: a 429 with { error: "rate_limited", retryAfterSeconds } instead of
// lumping a temporary quota exhaustion in with a genuine failure (see lib/groq.js for
// the server side of this contract).
//
// fetchWithRateLimitRetry() performs the request; if it comes back rate-limited with a
// short suggested wait (<60s), it retries exactly once after that wait. Either way the
// caller gets back enough information to show a calm, distinct message instead of a
// generic failure one.

const AUTO_RETRY_THRESHOLD_SECONDS = 60;

export async function fetchWithRateLimitRetry(url, options) {
  const attempt = async () => {
    const res = await fetch(url, options);
    if (res.ok) {
      return { ok: true, data: await res.json() };
    }
    let body = null;
    try {
      body = await res.json();
    } catch {
      // Non-JSON error body — treated as an unknown failure below.
    }
    if (body?.error === "rate_limited") {
      return { ok: false, rateLimited: true, retryAfterSeconds: body.retryAfterSeconds ?? null };
    }
    return { ok: false, rateLimited: false };
  };

  const first = await attempt();
  if (first.ok || !first.rateLimited) return first;

  if (first.retryAfterSeconds != null && first.retryAfterSeconds < AUTO_RETRY_THRESHOLD_SECONDS) {
    await new Promise((resolve) => setTimeout(resolve, first.retryAfterSeconds * 1000));
    return attempt();
  }

  return first;
}
