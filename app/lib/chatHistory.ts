import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EventDraftChatDraft } from '../shared/types';

// Local history of event-creation chats. Sessions live only on this device
// (AsyncStorage native, localStorage web) and hold everything needed to pick
// a draft back up: the transcript plus the structured draft. Covers and
// picked photos are deliberately NOT stored (too big); the AI redesigns a
// cover automatically when a restored draft reaches the cover step.

const KEY = 'iykyk.createChatHistory';
const MAX_SESSIONS = 12;

export interface StoredChatMessage {
  id: number;
  role: 'assistant' | 'user';
  text: string;
  tags?: string[];
}

export interface StoredChatSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  messages: StoredChatMessage[];
  draft: EventDraftChatDraft;
  // Kept loosely typed here; the create screen validates against its own
  // stage union on restore, so old snapshots survive renamed steps.
  queue: string[];
  stage: string;
  imageResolved: boolean;
  // Set once the draft was published; the history row then links to the
  // event instead of restoring the chat.
  createdSlug: string | null;
  createdTitle: string | null;
}

async function readAll(): Promise<StoredChatSession[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as StoredChatSession[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function listChatSessions(): Promise<StoredChatSession[]> {
  const sessions = await readAll();
  return sessions.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export async function saveChatSession(session: StoredChatSession): Promise<void> {
  try {
    const others = (await readAll()).filter((s) => s.id !== session.id);
    const next = [session, ...others]
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .slice(0, MAX_SESSIONS);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // History is best-effort; a failed write must never break the chat.
  }
}

export async function deleteChatSession(id: string): Promise<void> {
  try {
    const next = (await readAll()).filter((s) => s.id !== id);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Best-effort.
  }
}

// A short human label for a session row: the draft's title when it has one,
// otherwise the host's first message.
export function chatSessionLabel(session: StoredChatSession): string {
  if (session.createdTitle) return session.createdTitle;
  if (session.draft.title) return session.draft.title;
  const firstUser = session.messages.find((m) => m.role === 'user');
  if (firstUser) {
    return firstUser.text.length > 48 ? `${firstUser.text.slice(0, 48)}…` : firstUser.text;
  }
  return 'Event draft';
}
