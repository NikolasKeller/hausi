import type { Badge } from '../../../app/shared/types.js';
import { db } from './db.js';

// Party-résumé badges shown on both my own profile and public profiles.
export async function computeBadges(userId: string): Promise<Badge[]> {
  const comments = await db.comment.count({ where: { userId, type: 'comment' } });

  const badges: Badge[] = [];
  if (comments >= 3)
    badges.push({ key: 'hype', label: 'wall messages', emoji: '💬', value: comments });
  return badges;
}
