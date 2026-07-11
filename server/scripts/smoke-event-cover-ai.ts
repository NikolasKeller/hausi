// Real-call smoke test for AI cover generation. Prints ONLY structural results
// (status, duration, payload size) — never the key, prompt or image content.
// Run: npx tsx scripts/smoke-event-cover-ai.ts [--save]
import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import { generateEventCoverImage } from '../src/lib/coverImageAi.js';

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not set');
    process.exit(1);
  }
  const started = Date.now();
  try {
    const result = await generateEventCoverImage(
      {
        title: 'Birthday Dinner for Friends',
        description:
          'Join us for a cozy candlelit birthday dinner. Good food, better company and a toast to another year.',
        category: 'food',
      },
      { userId: 'smoke-test' }
    );
    const bytes = Buffer.from(result.base64, 'base64').length;
    if (process.argv.includes('--save')) {
      await writeFile('/tmp/smoke-cover.jpg', Buffer.from(result.base64, 'base64'));
    }
    console.log(
      JSON.stringify(
        {
          ok: true,
          ms: Date.now() - started,
          contentType: result.contentType,
          kilobytes: Math.round(bytes / 1024),
          saved: process.argv.includes('--save') ? '/tmp/smoke-cover.jpg' : false,
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
