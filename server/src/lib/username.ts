export const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;

export function normalizeUsername(value: string): string {
  return value.trim().replace(/^@+/, '').toLowerCase();
}

export function publicUsername(user: { id: string; username: string | null }): string {
  return user.username || `user_${user.id.slice(-8).toLowerCase()}`;
}
