import { politeFetch } from './util.js';

// Free, key-less English translation for scraped descriptions.
//
// Uses Google's public "gtx" translate endpoint (the same one the web widget
// calls). No API key, but it is an unofficial endpoint: it can rate-limit or
// change shape without notice. We therefore treat translation as best-effort —
// on ANY failure, or when the text is already English, the ORIGINAL text is
// kept unchanged (never a partial/garbled translation). Callers can inspect the
// `translated` flag to report how many descriptions were actually converted.

interface TranslateResult {
  text: string;
  translated: boolean;
  detectedLang: string | null;
}

const ENDPOINT = 'https://translate.googleapis.com/translate_a/single';

export async function translateToEnglish(input: string): Promise<TranslateResult> {
  const text = input.trim();
  if (!text) return { text: input, translated: false, detectedLang: null };

  const url =
    `${ENDPOINT}?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text.slice(0, 4800))}`;
  const res = await politeFetch(url, { headers: { Accept: 'application/json' } }, { retries: 2 });
  if (!res) return { text: input, translated: false, detectedLang: null };

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { text: input, translated: false, detectedLang: null };
  }

  // Shape: [ [ [translatedChunk, originalChunk, …], … ], …, detectedLang ].
  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    return { text: input, translated: false, detectedLang: null };
  }
  const detectedLang = typeof data[2] === 'string' ? (data[2] as string) : null;
  if (detectedLang === 'en') return { text: input, translated: false, detectedLang };

  let out = '';
  for (const chunk of data[0] as unknown[]) {
    if (Array.isArray(chunk) && typeof chunk[0] === 'string') out += chunk[0];
  }
  out = out.trim();
  if (!out || out === text) return { text: input, translated: false, detectedLang };
  return { text: out, translated: true, detectedLang };
}
