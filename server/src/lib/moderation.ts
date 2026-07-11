// Content guardrail for user-authored event text (chat briefs, titles,
// descriptions, vibe, dress code). iykyk hosts social events; sexual/adult
// events, violence, hate and illegal-goods gatherings are not allowed.
// Uses OpenAI's free moderation endpoint.

const MODERATION_URL = 'https://api.openai.com/v1/moderations';
const MODERATION_TIMEOUT_MS = 6_000;

// Category flags that make an event un-hostable, however it's phrased.
// Deliberately NOT listed: plain "harassment" (too fuzzy for party banter)
// and alcohol/nightlife/dating themes, which are all fine.
const BLOCKED_CATEGORIES = [
  'sexual',
  'sexual/minors',
  'hate',
  'hate/threatening',
  'harassment/threatening',
  'violence',
  'violence/graphic',
  'self-harm',
  'self-harm/intent',
  'self-harm/instructions',
  'illicit',
  'illicit/violent',
];

interface ModerationOptions {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

// True = the text may proceed. Fails OPEN on missing key, timeouts or API
// errors: moderation is a guardrail, and an OpenAI hiccup must never take
// event creation down with it (the AI's own prompt policy is the second net
// in the chat, and hosts remain accountable for published content).
export async function isEventContentAllowed(
  text: string,
  options: ModerationOptions = {}
): Promise<boolean> {
  const apiKey = (options.apiKey ?? process.env.OPENAI_API_KEY)?.trim();
  const trimmed = text.trim();
  if (!apiKey || !trimmed) return true;

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? MODERATION_TIMEOUT_MS
  );
  try {
    const response = await (options.fetchImpl ?? fetch)(MODERATION_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'omni-moderation-latest',
        input: trimmed.slice(0, 6000),
      }),
      signal: controller.signal,
    });
    if (!response.ok) return true;
    const body = (await response.json().catch(() => null)) as {
      results?: { categories?: Record<string, boolean> }[];
    } | null;
    const categories = body?.results?.[0]?.categories;
    if (!categories) return true;
    return !BLOCKED_CATEGORIES.some((category) => categories[category]);
  } catch {
    return true;
  } finally {
    clearTimeout(timer);
  }
}

// The one voice used everywhere a request is declined for content reasons.
export const GUIDELINE_REFUSAL =
  "That's not something iykyk can host. Let's plan something everyone can feel safe joining instead. What else do you have in mind?";

export const GUIDELINE_PUBLISH_ERROR =
  'This event goes against the iykyk guidelines. Plan something everyone can safely join.';
