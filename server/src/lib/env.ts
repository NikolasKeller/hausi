import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

// Resolve from this module instead of process.cwd(), so `server/.env` is also
// loaded when the server is started from the repository root. Environment
// variables supplied by Railway/the shell always win, and dotenv stays quiet
// so secret values can never end up in startup logs.
const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
config({ path: resolve(serverRoot, '.env'), override: false, quiet: true });
