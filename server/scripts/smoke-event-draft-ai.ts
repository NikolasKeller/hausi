// Real-call smoke test for the AI event-draft turn. Prints ONLY structural
// results (status codes, field names, durations) — never the key, prompts or
// model text. Run: npx tsx scripts/smoke-event-draft-ai.ts
import 'dotenv/config';
import { generateEventDraftTurn } from '../src/lib/eventDraftAi.js';
import type { EventDraftChatDraft } from '../../app/shared/types.js';

const emptyDraft: EventDraftChatDraft = {
  title: null,
  description: null,
  date: null,
  endDate: null,
  openEnd: null,
  punctuality: null,
  dressCode: null,
  vibe: null,
  locationHint: null,
  selectedLocation: null,
  category: null,
  isPublic: null,
  hideLocation: null,
  capacity: { kind: 'unknown', maxGuests: null },
  plusOneLimit: null,
  entry: { kind: 'unknown', price: null },
  application: { kind: 'unknown', questions: null },
};

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not set');
    process.exit(1);
  }
  const started = Date.now();
  try {
    const result = await generateEventDraftTurn(
      {
        messages: [
          {
            role: 'user',
            content:
              'A rooftop sunset party for 20 friends next Saturday at 8pm in Munich, tickets 10 euro',
          },
        ],
        draft: emptyDraft,
        timeZone: 'Europe/Berlin',
        locale: 'de-DE',
      },
      { userId: 'smoke-test' }
    );
    console.log(
      JSON.stringify(
        {
          ok: true,
          ms: Date.now() - started,
          status: result.status,
          nextField: result.nextField,
          missingFields: result.missingFields,
          extracted: {
            hasTitle: !!result.draft.title,
            // The AI must author guest-facing copy itself, never echo the brief.
            hasDescription: !!result.draft.description,
            descriptionEchoesBrief:
              !!result.draft.description &&
              result.draft.description
                .toLowerCase()
                .includes('rooftop sunset party for 20 friends'),
            hasDate: !!result.draft.date,
            capacity: result.draft.capacity.kind,
            entry: result.draft.entry.kind,
            hasLocationHint: !!result.draft.locationHint,
          },
          assistantMessageLength: result.assistantMessage.length,
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        ok: false,
        ms: Date.now() - started,
        kind: error instanceof Error ? error.message : 'unknown',
      })
    );
    process.exit(1);
  }
}

main();
