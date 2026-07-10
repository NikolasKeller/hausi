import type { Badge } from '../../../app/shared/types.js';
import { db } from './db.js';

// Party-résumé badges shown on both my own profile and public profiles.
export async function computeBadges(userId: string): Promise<Badge[]> {
  const [hosted, attended, comments] = await Promise.all([
    db.event.count({ where: { hostId: userId, canceledAt: null } }),
    db.rsvp.count({ where: { userId, status: 'GOING', event: { hostId: { not: userId } } } }),
    db.comment.count({ where: { userId, type: 'comment' } }),
  ]);

  const badges: Badge[] = [];
  if (attended > 0)
    badges.push({ key: 'attended', label: 'parties attended', emoji: '🌐', value: attended });
  if (hosted > 0) badges.push({ key: 'hosted', label: 'hosted', emoji: '🎉', value: hosted });
  if (comments >= 3)
    badges.push({ key: 'hype', label: 'wall messages', emoji: '💬', value: comments });
  return badges;
}
