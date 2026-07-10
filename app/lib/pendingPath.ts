// Where a signed-out user was heading (e.g. an invite deep link) — restored
// after auth by the root layout's guard. Module scope, NOT a ref/state: the
// navigator remounts on web after the first redirect, and refs don't survive
// that. Shared here so screens (e.g. the public event page's "Sign in" CTA)
// can set it before pushing the auth flow.
let pendingPath: string | null = null;

export function setPendingPath(path: string | null) {
  pendingPath = path;
}

export function peekPendingPath(): string | null {
  return pendingPath;
}

export function takePendingPath(): string | null {
  const path = pendingPath;
  pendingPath = null;
  return path;
}
