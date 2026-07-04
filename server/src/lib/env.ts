import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

// Minimal .env loader (the Prisma CLI reads .env itself, but the Node
// runtime doesn't). Values already present in the environment win.
const envPath = path.join(process.cwd(), '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, raw] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = raw.replace(/^"(.*)"$/, '$1');
  }
}
