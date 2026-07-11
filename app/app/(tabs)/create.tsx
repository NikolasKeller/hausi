import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import {
  APPLICATION_LIMITS,
  CATEGORIES,
  EVENT_COVER_LIMITS,
  EVENT_DRAFT_CHAT_LIMITS,
  LIMITS,
  MAX_PLUS_ONES,
  PUNCTUALITY_META,
  PUNCTUALITY_OPTIONS,
  type Category,
  type EventDetail,
  type EventDraftChatDraft,
  type EventDraftChatRequest,
  type EventDraftChatResponse,
  type EventDraftQuestion,
  type Punctuality,
} from '../../shared/types';
import { api } from '../../lib/api';
import {
  chatSessionLabel,
  deleteChatSession,
  listChatSessions,
  saveChatSession,
  type StoredChatSession,
} from '../../lib/chatHistory';
import { confirmDialog, notify } from '../../lib/dialogs';
import { extractEventBrief, normalizeTicketPrice } from '../../lib/eventDraft';
import { eventVisual } from '../../lib/eventVisual';
import { pickRawImage, uploadCroppedImage, type PickedImage } from '../../lib/imageUpload';
import { copyLink, shareText, textInvite } from '../../lib/share';
import { colors, radius, shadow, spacing } from '../../lib/theme';
import { display, uiText } from '../../lib/fonts';
import { LocationPicker } from '../../components/LocationPicker';
import { DateTimeSheet } from '../../components/DateTimeSheet';
import { formatEventDate, formatEventTime } from '../../components/EventCard';
import { withScreenBackground } from '../../components/ScreenBackground';

type Stage =
  | 'brief'
  | 'title'
  | 'description'
  | 'category'
  | 'when'
  | 'location'
  | 'visibility'
  | 'application'
  | 'capacity'
  | 'plusOnes'
  | 'price'
  // Optional vibe + dress code; only reached from the preview's edit list.
  | 'style'
  | 'image'
  | 'preview';

type QuestionStage = Exclude<Stage, 'brief' | 'preview'>;

// Runtime guards for restoring persisted chat sessions, whose stage/queue are
// stored as plain strings so old snapshots survive renamed steps.
const ALL_STAGES: Stage[] = [
  'brief',
  'title',
  'description',
  'category',
  'when',
  'location',
  'visibility',
  'application',
  'capacity',
  'plusOnes',
  'price',
  'style',
  'image',
  'preview',
];
const isStage = (value: string): value is Stage => (ALL_STAGES as string[]).includes(value);
const isQuestionStage = (value: string): value is QuestionStage =>
  isStage(value) && value !== 'brief' && value !== 'preview';

function makeSessionId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const QUESTION_STAGE_BY_DRAFT_FIELD: Record<EventDraftQuestion, QuestionStage> = {
  title: 'title',
  description: 'description',
  category: 'category',
  date: 'when',
  location: 'location',
  visibility: 'visibility',
  application: 'application',
  capacity: 'capacity',
  plusOnes: 'plusOnes',
  price: 'price',
};

const EMPTY_CHAT_DRAFT: EventDraftChatDraft = {
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

// Tap-to-add ideas for what applicants should answer; hosts can also type
// their own question.
const APPLICATION_QUESTION_IDEAS = [
  'Why would you love to join?',
  'Who do you know here?',
  'What would you bring to the vibe?',
];

// Tap-to-pick vibe ideas; free text always wins.
const VIBE_IDEAS = [
  'Cozy & intimate',
  'High energy',
  'Fancy but playful',
  'Chill hangout',
];

// Formality spectrum offered with the event-type question, so home-screen
// matching gets a category AND guests learn how to show up.
const FORMALITY_IDEAS = [
  'Fancy & formal',
  'Smart casual',
  'Chill & casual',
  'Wild & loud',
];

interface ChatMessage {
  id: number;
  role: 'assistant' | 'user';
  text: string;
  tags?: string[];
}

const QUESTION_COPY: Record<QuestionStage, string> = {
  title: 'Now the fun part: the name. What should we call it?',
  description: 'Give your guests a little taste of what to expect. What makes this one special?',
  category: 'What kind of event is this? And how casual or fancy should it feel?',
  when: 'So, when are we doing this?',
  location: 'And where is it all happening? Pick the real place below.',
  visibility: 'Who gets to see this one? Everyone, or just your people?',
  application: 'How do guests get on the list? They can join directly, or apply first so you approve everyone.',
  capacity: 'How many people can you fit?',
  plusOnes: 'Should everyone get to bring someone along?',
  price: 'Is it free, or are we doing tickets?',
  style: 'What is the vibe, and is there a dress code? Both are optional, both help people show up right.',
  image: 'Almost there! I am already designing a cover for you. You can swap in your own photo anytime.',
};

const CATEGORY_VISUALS: Record<
  Category,
  { emoji: string; tint: string; label: string }
> = {
  music: { emoji: '🪩', tint: '#6D5AE6', label: 'Music' },
  community: { emoji: '✨', tint: '#D95E9F', label: 'Community' },
  food: { emoji: '🍝', tint: '#D79B42', label: 'Food' },
  arts: { emoji: '🎨', tint: '#398A87', label: 'Arts' },
  sports: { emoji: '🏀', tint: '#4E8E55', label: 'Sports' },
  other: { emoji: '✨', tint: '#6D7280', label: 'Event' },
};

const STARTER_PROMPTS = [
  'A birthday dinner for 12 friends next Friday at 7pm',
  'A public Sunday run club, free, plus-ones welcome',
  'An invite-only rooftop party with tickets for €15',
];

// On mobile web KeyboardAvoidingView is a no-op AND the app shell pins the
// page (body fixed + visual-viewport snap-back in _layout), so the on-screen
// keyboard simply overlays the composer — people were typing blind. Measure
// how much of this screen the keyboard covers via visualViewport and hand it
// back as a bottom inset that lifts the composer above the keyboard.
function useWebKeyboardInset(hostRef: React.RefObject<View | null>): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      const host = hostRef.current as unknown as {
        getBoundingClientRect?: () => { bottom: number };
      } | null;
      const viewportBottom = viewport.offsetTop + viewport.height;
      const hostBottom =
        host?.getBoundingClientRect?.().bottom ?? window.innerHeight;
      const next = Math.max(0, Math.round(hostBottom - viewportBottom));
      // Anything smaller is browser-chrome jitter, not a keyboard.
      setInset(next >= 60 ? next : 0);
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    window.addEventListener('focusin', update);
    window.addEventListener('focusout', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      window.removeEventListener('focusin', update);
      window.removeEventListener('focusout', update);
    };
  }, [hostRef]);
  return inset;
}

function nextEvening(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(19, 0, 0, 0);
  return date;
}

function hasOwn<T extends object>(value: T, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function clientChatEnvironment(): Pick<EventDraftChatRequest, 'timeZone' | 'locale'> {
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions();
    return {
      ...(resolved.timeZone ? { timeZone: resolved.timeZone } : {}),
      ...(resolved.locale ? { locale: resolved.locale } : {}),
    };
  } catch {
    return {};
  }
}

function Counter({
  label,
  hint,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
}) {
  return (
    <View style={styles.counterRow}>
      <View style={styles.flex}>
        <Text style={styles.controlTitle}>{label}</Text>
        <Text style={styles.controlHint}>{hint}</Text>
      </View>
      <View style={styles.counter}>
        <Pressable
          onPress={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          style={[styles.counterButton, value <= min && styles.disabled]}
        >
          <Ionicons name="remove" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.counterValue}>{value}</Text>
        <Pressable
          onPress={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          style={[styles.counterButton, value >= max && styles.disabled]}
        >
          <Ionicons name="add" size={18} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

function ToggleRow({
  icon,
  label,
  hint,
  value,
  onChange,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Pressable onPress={() => onChange(!value)} style={styles.toggleRow}>
      <View style={styles.controlIcon}>
        <Ionicons name={icon} size={20} color={colors.text} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.controlTitle}>{label}</Text>
        <Text style={styles.controlHint}>{hint}</Text>
      </View>
      <View style={[styles.switchTrack, value && styles.switchTrackOn]}>
        <View style={[styles.switchKnob, value && styles.switchKnobOn]} />
      </View>
    </Pressable>
  );
}

function ChoicePill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.choicePill, selected && styles.choicePillSelected]}
    >
      {selected ? <Ionicons name="checkmark" size={15} color={colors.onInk} /> : null}
      <Text style={[styles.choicePillText, selected && styles.choicePillTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

function CreateEventScreen() {
  // "Create another event" simply remounts the flow with a fresh key — one
  // stroke resets the chat, draft, cover and question state instead of a
  // brittle pile of individual setState calls.
  const [sessionKey, setSessionKey] = useState(0);
  return (
    <CreateEventFlow
      key={sessionKey}
      onRestart={() => setSessionKey((current) => current + 1)}
    />
  );
}

function CreateEventFlow({ onRestart }: { onRestart: () => void }) {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const screenRef = useRef<View>(null);
  const nextMessageId = useRef(1);
  const mountedRef = useRef(true);
  const aiAbortRef = useRef<AbortController | null>(null);
  const lastAiRequestRef = useRef<EventDraftChatRequest | null>(null);

  // Mobile-web keyboard: lift the composer above the overlaying keyboard and
  // keep the newest chat messages in view while it is open.
  const webKeyboardInset = useWebKeyboardInset(screenRef);
  useEffect(() => {
    if (webKeyboardInset > 0) {
      scrollRef.current?.scrollToEnd({ animated: false });
    }
  }, [webKeyboardInset]);

  const [stage, setStage] = useState<Stage>('brief');
  const [queue, setQueue] = useState<QuestionStage[]>([]);
  const [editingFromPreview, setEditingFromPreview] = useState(false);
  const [chatDraft, setChatDraft] = useState<EventDraftChatDraft>(EMPTY_CHAT_DRAFT);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 0,
      role: 'assistant',
      text: 'Hey! 🎉 You are hosting something, and honestly, I am already excited. Tell me what you are dreaming up, in your own words. Big or small, I will help you make it real.',
    },
  ]);
  const [composer, setComposer] = useState('');
  const [questionError, setQuestionError] = useState('');
  const [publishError, setPublishError] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiPaused, setAiPaused] = useState(false);

  // Local chat history: this session's identity plus the picker sheet state.
  const [sessionId, setSessionId] = useState(makeSessionId);
  const sessionCreatedAtRef = useRef(new Date().toISOString());
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historySessions, setHistorySessions] = useState<StoredChatSession[] | null>(null);
  const latestSnapshotRef = useRef<StoredChatSession | null>(null);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [title, setTitle] = useState('');
  // AI-proposed titles for the title question; tapping one commits it.
  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([]);
  const [description, setDescription] = useState('');

  // Follow the conversation: scroll when messages arrive or the step changes.
  // Deliberately NOT on every content growth — the old onContentSizeChange
  // handler yanked the list around (and pulled focus away) while people were
  // typing into the location search and its results appeared.
  useEffect(() => {
    const timer = setTimeout(
      () => scrollRef.current?.scrollToEnd({ animated: true }),
      60
    );
    return () => clearTimeout(timer);
  }, [messages.length, aiBusy, stage]);
  const [date, setDate] = useState<Date | null>(null);
  const [dateSeed, setDateSeed] = useState(nextEvening);
  const [dateOpen, setDateOpen] = useState(false);
  // Timing nuance: optional end (or explicit open end) and how strict the
  // start time is. All optional; unset simply isn't shown to guests.
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [endOpen, setEndOpen] = useState(false);
  const [openEnd, setOpenEnd] = useState(false);
  const [punctuality, setPunctuality] = useState<Punctuality | ''>('');
  const [vibe, setVibe] = useState('');
  const [dressCode, setDressCode] = useState('');
  const [location, setLocation] = useState('');
  const [city, setCity] = useState('');
  const [category, setCategory] = useState<Category>('other');
  const [isPublic, setIsPublic] = useState(false);
  const [hideLocation, setHideLocation] = useState(false);
  const [capacityMode, setCapacityMode] = useState<'limited' | 'unlimited'>('limited');
  const [capacityInput, setCapacityInput] = useState('30');
  const [maxGuests, setMaxGuests] = useState<number | null>(30);
  const [applyRequired, setApplyRequired] = useState(false);
  const [applicationQuestions, setApplicationQuestions] = useState<string[]>([]);
  const [applicationQuestionDraft, setApplicationQuestionDraft] = useState('');
  const [plusOnes, setPlusOnes] = useState(1);
  const [paid, setPaid] = useState(false);
  const [price, setPrice] = useState('');
  const [image, setImage] = useState<PickedImage | null>(null);
  const [imageResolved, setImageResolved] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  // AI cover artwork (base64 JPEG). It lives only in memory until publish, so
  // abandoned drafts and rerolled designs never leave files on the server.
  const [aiCover, setAiCover] = useState<string | null>(null);
  const [aiCoverBusy, setAiCoverBusy] = useState(false);
  const [aiCoverError, setAiCoverError] = useState('');
  // Set when the host explicitly chooses "no cover", so the auto-designer
  // doesn't keep regenerating what they just removed.
  const [coverDeclined, setCoverDeclined] = useState(false);
  const aiCoverAbortRef = useRef<AbortController | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<EventDetail | null>(null);

  useEffect(
    () => () => {
      mountedRef.current = false;
      aiAbortRef.current?.abort();
      aiCoverAbortRef.current?.abort();
    },
    []
  );

  // Persist the session (debounced) once the host has actually said something.
  // Pristine greeting-only sessions never clutter the history.
  useEffect(() => {
    if (!messages.some((message) => message.role === 'user')) return;
    const snapshot: StoredChatSession = {
      id: sessionId,
      createdAt: sessionCreatedAtRef.current,
      updatedAt: new Date().toISOString(),
      messages,
      draft: chatDraft,
      queue,
      stage,
      imageResolved,
      createdSlug: created?.slug ?? null,
      createdTitle: created?.title ?? null,
    };
    latestSnapshotRef.current = snapshot;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => void saveChatSession(snapshot), 600);
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [messages, chatDraft, queue, stage, imageResolved, created, sessionId]);

  // Flush the newest snapshot when the screen unmounts, so a quick tab switch
  // right after a message can't lose the last exchange to the debounce.
  useEffect(
    () => () => {
      if (latestSnapshotRef.current) void saveChatSession(latestSnapshotRef.current);
    },
    []
  );

  const visual = CATEGORY_VISUALS[category];
  const validationIssues = useMemo(() => {
    const issues: string[] = [];
    if (title.trim().length < 2) issues.push('Add an event title.');
    if (!date || Number.isNaN(date.getTime())) issues.push('Choose a date and time.');
    else if (date.getTime() <= Date.now()) issues.push('Choose a date and time in the future.');
    if (!openEnd && endDate && date && endDate.getTime() <= date.getTime()) {
      issues.push('The end must be after the start.');
    }
    if (!location.trim()) issues.push('Choose a location from address search.');
    if (
      maxGuests != null &&
      (!Number.isInteger(maxGuests) || maxGuests < 1 || maxGuests > LIMITS.maxGuests)
    ) {
      issues.push(`Guest limit must be between 1 and ${LIMITS.maxGuests}.`);
    }
    if (plusOnes < 0 || plusOnes > MAX_PLUS_ONES) {
      issues.push(`Plus-ones must be between 0 and ${MAX_PLUS_ONES}.`);
    }
    if (paid && !normalizeTicketPrice(price)) issues.push('Enter a valid ticket price.');
    return issues;
  }, [date, endDate, location, maxGuests, openEnd, paid, plusOnes, price, title]);
  const canPublish = validationIssues.length === 0;

  function appendMessages(
    ...items: Omit<ChatMessage, 'id'>[]
  ) {
    setMessages((current) => [
      ...current,
      ...items.map((item) => ({ ...item, id: nextMessageId.current++ })),
    ]);
  }

  function buildAiRequest(userText: string, draft: EventDraftChatDraft): EventDraftChatRequest {
    const candidates = [
      ...messages.map((message) => ({ role: message.role, content: message.text })),
      { role: 'user' as const, content: userText },
    ];
    const selected: EventDraftChatRequest['messages'] = [];
    let charactersLeft = EVENT_DRAFT_CHAT_LIMITS.totalMessageCharacters;

    for (
      let index = candidates.length - 1;
      index >= 0 && selected.length < EVENT_DRAFT_CHAT_LIMITS.history && charactersLeft > 0;
      index -= 1
    ) {
      const candidate = candidates[index];
      const content = candidate.content
        .trim()
        .slice(0, Math.min(EVENT_DRAFT_CHAT_LIMITS.message, charactersLeft));
      if (!content) continue;
      selected.unshift({ role: candidate.role, content });
      charactersLeft -= content.length;
    }

    return {
      messages: selected,
      draft,
      ...clientChatEnvironment(),
    };
  }

  function applyChatDraft(draft: EventDraftChatDraft) {
    setChatDraft(draft);
    setTitle(draft.title ?? '');
    setDescription(draft.description ?? '');

    const parsedDate = draft.date ? new Date(draft.date) : null;
    if (parsedDate && !Number.isNaN(parsedDate.getTime()) && parsedDate.getTime() > Date.now()) {
      setDate(parsedDate);
      setDateSeed(parsedDate);
    } else {
      setDate(null);
    }

    const parsedEnd = draft.endDate ? new Date(draft.endDate) : null;
    if (
      parsedEnd &&
      !Number.isNaN(parsedEnd.getTime()) &&
      parsedDate &&
      parsedEnd.getTime() > parsedDate.getTime() &&
      !draft.openEnd
    ) {
      setEndDate(parsedEnd);
    } else if (draft.endDate === null) {
      setEndDate(null);
    }
    if (draft.openEnd !== null) setOpenEnd(draft.openEnd);
    if (draft.punctuality !== null) setPunctuality(draft.punctuality);
    if (draft.dressCode !== null) setDressCode(draft.dressCode);
    if (draft.vibe !== null) setVibe(draft.vibe);

    setLocation(draft.selectedLocation?.location ?? '');
    setCity(draft.selectedLocation?.city ?? '');
    setCategory(draft.category ?? 'other');
    setIsPublic(draft.isPublic ?? false);
    setHideLocation(draft.hideLocation ?? false);

    if (draft.capacity.kind === 'unlimited') {
      setCapacityMode('unlimited');
      setMaxGuests(null);
    } else if (draft.capacity.kind === 'limited') {
      setCapacityMode('limited');
      setCapacityInput(String(draft.capacity.maxGuests));
      setMaxGuests(draft.capacity.maxGuests);
    } else {
      setCapacityMode('limited');
      setCapacityInput('30');
      setMaxGuests(30);
    }

    setPlusOnes(draft.plusOneLimit ?? 1);
    if (draft.entry.kind === 'paid') {
      setPaid(true);
      setPrice(draft.entry.price ?? '');
    } else {
      setPaid(false);
      setPrice('');
    }

    setApplyRequired(draft.application.kind === 'apply');
    setApplicationQuestions(
      draft.application.kind === 'apply' ? draft.application.questions : []
    );
  }

  function tagsForDraft(draft: EventDraftChatDraft): string[] {
    const tags: string[] = [CATEGORY_VISUALS[draft.category ?? 'other'].label];
    if (draft.title) tags.push(draft.title);
    if (draft.date) {
      tags.push(`${formatEventDate(draft.date)}, ${formatEventTime(draft.date)}`);
    }
    if (draft.isPublic !== null) tags.push(draft.isPublic ? 'Public' : 'Invite only');
    if (draft.application.kind === 'apply') tags.push('Apply to join');
    if (draft.capacity.kind === 'unlimited') tags.push('No guest limit');
    if (draft.capacity.kind === 'limited') tags.push(`${draft.capacity.maxGuests} guests`);
    if (draft.entry.kind === 'free') tags.push('Free');
    if (draft.entry.kind === 'paid' && draft.entry.price) tags.push(`€${draft.entry.price}`);
    return tags.slice(0, 6);
  }

  function pendingQuestions(result: EventDraftChatResponse): QuestionStage[] {
    const pending = result.missingFields.map((field) => QUESTION_STAGE_BY_DRAFT_FIELD[field]);
    const preferred = result.nextField
      ? QUESTION_STAGE_BY_DRAFT_FIELD[result.nextField]
      : undefined;
    const ordered = preferred
      ? [preferred, ...pending.filter((question) => question !== preferred)]
      : pending;
    if (!imageResolved) ordered.push('image');
    return ordered;
  }

  async function runAiTurn(
    request: EventDraftChatRequest,
    options: { fallback?: () => void; showTags?: boolean } = {}
  ) {
    aiAbortRef.current?.abort();
    const controller = new AbortController();
    aiAbortRef.current = controller;
    lastAiRequestRef.current = request;
    setAiBusy(true);
    setAiError('');
    const timeout = setTimeout(() => controller.abort(), 26_000);

    try {
      const result = await api.chatEventDraft(request, controller.signal);
      if (!mountedRef.current || aiAbortRef.current !== controller) return;
      applyChatDraft(result.draft);
      setTitleSuggestions(result.titleSuggestions ?? []);
      const pending = pendingQuestions(result);
      setQueue(pending);
      setStage(pending[0] ?? 'preview');
      appendMessages({
        role: 'assistant',
        text: result.assistantMessage,
        ...(options.showTags ? { tags: tagsForDraft(result.draft) } : {}),
      });
      setAiPaused(false);
      lastAiRequestRef.current = null;
    } catch (error) {
      if (!mountedRef.current || aiAbortRef.current !== controller) return;
      const reason = controller.signal.aborted
        ? 'The AI request timed out.'
        : error instanceof Error
          ? error.message
          : 'The AI could not be reached.';
      setAiError(`${reason} Local guidance is active, so you can keep going.`);
      setAiPaused(true);
      options.fallback?.();
    } finally {
      clearTimeout(timeout);
      if (mountedRef.current && aiAbortRef.current === controller) {
        aiAbortRef.current = null;
        setAiBusy(false);
      }
    }
  }

  function retryAi() {
    const request = lastAiRequestRef.current;
    if (!request || aiBusy) return;
    void runAiTurn(request);
  }

  function showNextQuestion(questions: QuestionStage[]) {
    const next = questions[0];
    if (next) {
      setStage(next);
      appendMessages({ role: 'assistant', text: QUESTION_COPY[next] });
      return;
    }
    setStage('preview');
    appendMessages({
      role: 'assistant',
      text: 'Yes! It is all coming together. Here is your event page. Tweak anything you like, then publish when it feels right.',
    });
  }

  function submitBrief() {
    if (aiBusy) return;
    const brief = composer.trim();
    if (brief.length < 3) {
      setQuestionError('Tell me a little more about the event.');
      return;
    }

    const extracted = extractEventBrief(brief);
    // The raw brief is written FOR the assistant, not for guests, so it never
    // becomes the description. The AI writes real invitation copy from it; if
    // the AI is unreachable, the description question asks the host directly.
    const localDraft: EventDraftChatDraft = {
      title: extracted.title ?? null,
      description: null,
      date: extracted.date?.toISOString() ?? null,
      endDate: null,
      openEnd: null,
      punctuality: null,
      dressCode: null,
      vibe: null,
      locationHint: null,
      // A typed place is never silently trusted as an address. Only the
      // LocationPicker can commit this field after geocoding.
      selectedLocation: null,
      // The keyword parser answers 'other' when NOTHING matched — that's
      // "don't know", not a decision, so it stays open and gets asked.
      category: extracted.category === 'other' ? null : extracted.category,
      isPublic: hasOwn(extracted, 'isPublic') ? Boolean(extracted.isPublic) : null,
      hideLocation: hasOwn(extracted, 'hideLocation')
        ? Boolean(extracted.hideLocation)
        : null,
      capacity: hasOwn(extracted, 'maxGuests')
        ? extracted.maxGuests == null
          ? { kind: 'unlimited', maxGuests: null }
          : { kind: 'limited', maxGuests: extracted.maxGuests }
        : { kind: 'unknown', maxGuests: null },
      plusOneLimit: hasOwn(extracted, 'plusOneLimit')
        ? (extracted.plusOneLimit ?? 0)
        : null,
      entry: hasOwn(extracted, 'paid')
        ? extracted.paid
          ? { kind: 'paid', price: extracted.price ?? null }
          : { kind: 'free', price: null }
        : { kind: 'unknown', price: null },
      application: { kind: 'unknown', questions: null },
    };
    const questions: QuestionStage[] = [];
    if (!localDraft.title || localDraft.title.length < 2) questions.push('title');
    if (localDraft.description === null) questions.push('description');
    if (localDraft.category === null) questions.push('category');
    if (!localDraft.date) questions.push('when');
    questions.push('location');
    if (localDraft.isPublic === null || localDraft.hideLocation === null) {
      questions.push('visibility');
    }
    if (localDraft.application.kind === 'unknown') questions.push('application');
    if (localDraft.capacity.kind === 'unknown') questions.push('capacity');
    if (localDraft.plusOneLimit === null) questions.push('plusOnes');
    if (
      localDraft.entry.kind === 'unknown' ||
      (localDraft.entry.kind === 'paid' && !localDraft.entry.price)
    ) {
      questions.push('price');
    }
    questions.push('image');

    setComposer('');
    setQuestionError('');
    setQueue(questions);
    if (extracted.dateSeed && !extracted.date) setDateSeed(extracted.dateSeed);
    applyChatDraft(localDraft);
    const request = buildAiRequest(brief, localDraft);
    appendMessages({ role: 'user', text: brief });
    void runAiTurn(request, {
      showTags: true,
      fallback: () => {
        appendMessages({
          role: 'assistant',
          text: 'Love it! I started your draft and picked out what I could. A few quick questions and it is ready.',
          tags: tagsForDraft(localDraft),
        });
        showNextQuestion(questions);
      },
    });
  }

  function completeQuestion(answer: string, nextDraft: EventDraftChatDraft = chatDraft) {
    if (stage === 'brief' || stage === 'preview' || aiBusy) return;
    const current = stage;
    setChatDraft(nextDraft);
    appendMessages({ role: 'user', text: answer });
    setQuestionError('');

    if (editingFromPreview) {
      setEditingFromPreview(false);
      setStage('preview');
      appendMessages({
        role: 'assistant',
        text: 'Done! The preview below already shows your change.',
      });
      return;
    }

    const remaining =
      queue[0] === current ? queue.slice(1) : queue.filter((item) => item !== current);
    setQueue(remaining);
    if (current === 'image') {
      setImageResolved(true);
      showNextQuestion(remaining);
      return;
    }

    const request = buildAiRequest(answer, nextDraft);
    lastAiRequestRef.current = request;
    if (aiPaused) {
      showNextQuestion(remaining);
      return;
    }
    void runAiTurn(request, { fallback: () => showNextQuestion(remaining) });
  }

  function submitTextAnswer() {
    if (stage === 'title') {
      const value = title.trim();
      if (value.length < 2) {
        setQuestionError('Use at least two characters for the title.');
        return;
      }
      completeQuestion(value, { ...chatDraft, title: value });
    } else if (stage === 'description') {
      const value = description.trim();
      completeQuestion(value || 'No additional description', {
        ...chatDraft,
        description: value,
      });
    }
  }

  function completeCategory() {
    const trimmedVibe = vibe.trim();
    completeQuestion(
      `${CATEGORY_VISUALS[category].label}${trimmedVibe ? `. Vibe: ${trimmedVibe}` : ''}`,
      {
        ...chatDraft,
        category,
        vibe: trimmedVibe || chatDraft.vibe,
      }
    );
  }

  function completeDate() {
    if (!date || Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
      setQuestionError('Choose a date and time in the future.');
      return;
    }
    if (!openEnd && endDate && endDate.getTime() <= date.getTime()) {
      setQuestionError('The end must be after the start.');
      return;
    }
    const windowText = openEnd
      ? ', open end'
      : endDate
        ? ` until ${formatEventTime(endDate.toISOString())}`
        : '';
    const punctualityText = punctuality
      ? `. ${PUNCTUALITY_META[punctuality].label}`
      : '';
    completeQuestion(
      `${formatEventDate(date.toISOString())} at ${formatEventTime(
        date.toISOString()
      )}${windowText}${punctualityText}`,
      {
        ...chatDraft,
        date: date.toISOString(),
        endDate: openEnd ? null : (endDate?.toISOString() ?? null),
        // Only claim a decision the host actually made; untouched stays null.
        openEnd: openEnd ? true : endDate ? false : chatDraft.openEnd,
        punctuality: punctuality || chatDraft.punctuality,
      }
    );
  }

  function completeLocation() {
    if (!location.trim()) {
      setQuestionError('Choose a place from the address results.');
      return;
    }
    completeQuestion(location, {
      ...chatDraft,
      selectedLocation: { location: location.trim(), city: city.trim() },
    });
  }

  function completeCapacity() {
    if (capacityMode === 'unlimited') {
      setMaxGuests(null);
      completeQuestion('No guest limit', {
        ...chatDraft,
        capacity: { kind: 'unlimited', maxGuests: null },
      });
      return;
    }
    const value = Number(capacityInput);
    if (!Number.isInteger(value) || value < 1 || value > LIMITS.maxGuests) {
      setQuestionError(`Enter a whole number between 1 and ${LIMITS.maxGuests}.`);
      return;
    }
    setMaxGuests(value);
    completeQuestion(`${value} guests maximum`, {
      ...chatDraft,
      capacity: { kind: 'limited', maxGuests: value },
    });
  }

  function addApplicationQuestion(raw: string) {
    const value = raw.trim().slice(0, APPLICATION_LIMITS.question);
    if (!value) return;
    setApplicationQuestions((current) =>
      current.includes(value) || current.length >= APPLICATION_LIMITS.questions
        ? current
        : [...current, value]
    );
    setApplicationQuestionDraft('');
  }

  function completeApplication() {
    const questions = applyRequired
      ? [
          ...new Set(applicationQuestions.map((q) => q.trim()).filter(Boolean)),
        ].slice(0, APPLICATION_LIMITS.questions)
      : [];
    completeQuestion(
      applyRequired
        ? questions.length
          ? `Guests apply first. They answer: ${questions.join(' / ')}`
          : 'Guests apply first'
        : 'Guests can join directly',
      {
        ...chatDraft,
        application: applyRequired
          ? { kind: 'apply', questions }
          : { kind: 'open', questions: null },
      }
    );
  }

  function completePrice() {
    if (!paid) {
      setPrice('');
      completeQuestion('Free entry', {
        ...chatDraft,
        entry: { kind: 'free', price: null },
      });
      return;
    }
    const normalized = normalizeTicketPrice(price);
    if (!normalized) {
      setQuestionError('Enter a valid price greater than zero.');
      return;
    }
    setPrice(normalized);
    completeQuestion(`€${normalized} per ticket`, {
      ...chatDraft,
      entry: { kind: 'paid', price: normalized },
    });
  }

  function editFromPreview(next: QuestionStage) {
    setEditingFromPreview(true);
    setQuestionError('');
    setPublishError('');
    setStage(next);
    appendMessages({
      role: 'assistant',
      text: `Sure, let’s tweak that. ${QUESTION_COPY[next]}`,
    });
  }

  async function chooseImage() {
    if (imageBusy) return;
    setImageBusy(true);
    try {
      const picked = await pickRawImage();
      if (picked) setImage(picked);
    } finally {
      setImageBusy(false);
    }
  }

  async function generateCover() {
    if (aiCoverBusy) return;
    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 2) return;
    aiCoverAbortRef.current?.abort();
    const controller = new AbortController();
    aiCoverAbortRef.current = controller;
    setAiCoverBusy(true);
    setAiCoverError('');
    setCoverDeclined(false);
    // Image generation is slow by nature; give it real headroom before bailing.
    const timeout = setTimeout(() => controller.abort(), 75_000);
    try {
      const trimmedDescription = description.trim();
      const result = await api.generateEventCover(
        {
          title: trimmedTitle,
          ...(trimmedDescription
            ? { description: trimmedDescription.slice(0, EVENT_COVER_LIMITS.description) }
            : {}),
          category,
        },
        controller.signal
      );
      if (!mountedRef.current || aiCoverAbortRef.current !== controller) return;
      setAiCover(result.image);
    } catch (error) {
      if (!mountedRef.current || aiCoverAbortRef.current !== controller) return;
      setAiCoverError(
        controller.signal.aborted
          ? 'The design took too long. Tap "New design" to try again.'
          : error instanceof Error
            ? error.message
            : 'Could not design a cover right now.'
      );
    } finally {
      clearTimeout(timeout);
      if (mountedRef.current && aiCoverAbortRef.current === controller) {
        aiCoverAbortRef.current = null;
        setAiCoverBusy(false);
      }
    }
  }

  function removeCover() {
    aiCoverAbortRef.current?.abort();
    aiCoverAbortRef.current = null;
    setAiCoverBusy(false);
    setImage(null);
    setAiCover(null);
    setAiCoverError('');
    setCoverDeclined(true);
  }

  // Covers are never "just an emoji": the moment the flow reaches the cover
  // step (or the preview) without artwork, the AI starts designing one. One
  // failed attempt doesn't retrigger itself; the card offers a manual retry.
  useEffect(() => {
    if (stage !== 'image' && stage !== 'preview') return;
    if (image || aiCover || aiCoverBusy || coverDeclined || aiCoverError) return;
    if (title.trim().length < 2) return;
    void generateCover();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, image, aiCover, aiCoverBusy, coverDeclined, aiCoverError, title]);

  async function publish() {
    if (submitting) return;
    if (!canPublish || !date) {
      setPublishError(validationIssues[0] ?? 'Check the event details before publishing.');
      return;
    }

    setSubmitting(true);
    setPublishError('');
    try {
      let coverImage = '';
      if (image) {
        if (image.width <= 0 || image.height <= 0) {
          throw new Error('That cover image could not be read. Choose it again or remove it.');
        }
        const targetRatio = 4 / 3;
        const sourceRatio = image.width / image.height;
        const width =
          sourceRatio > targetRatio ? Math.floor(image.height * targetRatio) : image.width;
        const height =
          sourceRatio > targetRatio ? image.height : Math.floor(image.width / targetRatio);
        const uploaded = await uploadCroppedImage(image.uri, {
          originX: Math.max(0, Math.floor((image.width - width) / 2)),
          originY: Math.max(0, Math.floor((image.height - height) / 2)),
          width,
          height,
        });
        if (!uploaded) throw new Error('The cover image could not be uploaded. Please try again.');
        coverImage = uploaded;
      } else if (aiCover) {
        // The AI design is already a web-ready JPEG; store it as-is.
        const { url } = await api.uploadImage(aiCover, 'image/jpeg');
        coverImage = url;
      }

      const result = await api.createEvent({
        title: title.trim(),
        description: description.trim(),
        date: date.toISOString(),
        location: location.trim(),
        ...(city.trim() ? { city: city.trim() } : {}),
        category,
        isPublic,
        hideLocation,
        coverImage,
        // Themed page backdrop matched to what the event IS (birthday, dinner,
        // karaoke…) so pages feel designed even without a cover photo.
        coverTheme: eventVisual(title, description, category).theme,
        maxGuests,
        plusOneLimit: plusOnes,
        costPerPerson: paid ? (normalizeTicketPrice(price) ?? '') : '',
        rsvpsOpen: true,
        applicationRequired: applyRequired,
        applicationQuestions: applyRequired ? applicationQuestions : [],
        dressCode: dressCode.trim(),
        vibe: vibe.trim(),
        endDate: openEnd ? null : (endDate?.toISOString() ?? null),
        openEnd,
        punctuality,
      });
      setCreated(result.event);
    } catch (error) {
      notify('Could not publish', error instanceof Error ? error.message : 'Try again');
    } finally {
      setSubmitting(false);
    }
  }

  async function resetChat() {
    if (messages.some((message) => message.role === 'user') && !created) {
      const ok = await confirmDialog(
        'Start a new chat?',
        'This draft stays in your history, so you can pick it up again anytime.',
        'New chat',
        'Keep chatting'
      );
      if (!ok) return;
    }
    // Remounting the flow resets every state at once; the unmount flush
    // parks the current conversation in history first.
    onRestart();
  }

  async function openHistory() {
    setHistoryOpen(true);
    setHistorySessions(null);
    const sessions = await listChatSessions();
    if (!mountedRef.current) return;
    setHistorySessions(sessions.filter((session) => session.id !== sessionId));
  }

  async function removeSession(id: string) {
    await deleteChatSession(id);
    setHistorySessions((current) => current?.filter((session) => session.id !== id) ?? null);
  }

  // Swap the whole conversation for a stored one. Field states rebuild from
  // the stored draft; covers regenerate on their own when the flow reaches
  // the cover step again.
  function restoreSession(session: StoredChatSession) {
    if (latestSnapshotRef.current) void saveChatSession(latestSnapshotRef.current);
    aiAbortRef.current?.abort();
    aiCoverAbortRef.current?.abort();
    setSessionId(session.id);
    sessionCreatedAtRef.current = session.createdAt;
    latestSnapshotRef.current = null;
    nextMessageId.current =
      Math.max(0, ...session.messages.map((message) => message.id)) + 1;
    setMessages(session.messages);
    setChatDraft(session.draft);
    applyChatDraft(session.draft);
    setQueue(session.queue.filter(isQuestionStage));
    setStage(isStage(session.stage) ? session.stage : 'preview');
    setImageResolved(session.imageResolved);
    setTitleSuggestions([]);
    setImage(null);
    setAiCover(null);
    setAiCoverBusy(false);
    setAiCoverError('');
    setCoverDeclined(false);
    setAiBusy(false);
    setAiError('');
    setAiPaused(false);
    setQuestionError('');
    setPublishError('');
    setEditingFromPreview(false);
    setCreated(null);
    setHistoryOpen(false);
  }

  async function shareCreated() {
    if (!created) return;
    const link = Linking.createURL(`e/${created.slug}`);
    await shareText(
      `${created.title}, ${formatEventDate(created.date)} at ${formatEventTime(
        created.date
      )}\n${link}`,
      link
    );
  }

  function renderQuestionCard() {
    if (stage === 'brief') {
      // The example prompts only help before the conversation starts; once the
      // first brief is sent they would just clutter the thread.
      if (messages.some((message) => message.role === 'user')) return null;
      return (
        <View style={styles.starterArea}>
          <Text style={styles.starterLabel}>NEED A SPARK?</Text>
          {STARTER_PROMPTS.map((prompt) => (
            <Pressable key={prompt} onPress={() => setComposer(prompt)} style={styles.starterPrompt}>
              <Text style={styles.starterPromptText}>{prompt}</Text>
              <Ionicons name="arrow-up-outline" size={16} color={colors.muted} />
            </Pressable>
          ))}
        </View>
      );
    }

    if (stage === 'title' && titleSuggestions.length > 0 && !title.trim()) {
      // Tap-to-pick title ideas from the AI; typing in the composer instead
      // always stays possible.
      return (
        <View style={styles.titleIdeas}>
          {titleSuggestions.map((suggestion) => (
            <Pressable
              key={suggestion}
              onPress={() => {
                setTitle(suggestion);
                setTitleSuggestions([]);
                setQuestionError('');
                completeQuestion(suggestion, { ...chatDraft, title: suggestion });
              }}
              disabled={aiBusy}
              style={({ pressed }) => [styles.titleIdea, pressed && { opacity: 0.75 }]}
            >
              <Text style={styles.titleIdeaText}>{suggestion}</Text>
            </Pressable>
          ))}
        </View>
      );
    }

    if (stage === 'title' || stage === 'description' || stage === 'preview') return null;

    if (stage === 'category') {
      return (
        <View style={styles.questionCard}>
          <Text style={styles.fieldLabel}>WHAT KIND OF EVENT?</Text>
          <View style={styles.choiceRow}>
            {CATEGORIES.map((option) => (
              <ChoicePill
                key={option}
                label={`${CATEGORY_VISUALS[option].emoji} ${CATEGORY_VISUALS[option].label}`}
                selected={category === option}
                onPress={() => setCategory(option)}
              />
            ))}
          </View>
          <View style={styles.divider} />
          <Text style={styles.fieldLabel}>HOW SHOULD IT FEEL? (OPTIONAL)</Text>
          <View style={styles.choiceRow}>
            {FORMALITY_IDEAS.map((idea) => (
              <ChoicePill
                key={idea}
                label={idea}
                selected={vibe === idea}
                onPress={() => setVibe((current) => (current === idea ? '' : idea))}
              />
            ))}
          </View>
          <TextInput
            value={vibe}
            onChangeText={setVibe}
            placeholder="Or describe the vibe in your own words…"
            placeholderTextColor={colors.muted}
            maxLength={LIMITS.vibe}
            style={styles.styleInput}
          />
          <Text style={styles.questionHint}>
            The type sorts your event into the right discovery sections; the vibe tells
            guests how to show up.
          </Text>
        </View>
      );
    }

    if (stage === 'when') {
      return (
        <View style={styles.questionCard}>
          <Pressable
            onPress={() => {
              if (!date) setDate(dateSeed);
              setDateOpen(true);
            }}
            style={styles.dateChoice}
          >
            <View style={[styles.questionIcon, { backgroundColor: `${visual.tint}35` }]}>
              <Ionicons name="calendar-outline" size={22} color={colors.text} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.fieldLabel}>STARTS</Text>
              <Text style={[styles.dateChoiceValue, !date && styles.placeholderText]}>
                {date
                  ? `${formatEventDate(date.toISOString())} · ${formatEventTime(
                      date.toISOString()
                    )}`
                  : 'Choose when it starts'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>

          <View style={styles.divider} />
          <Text style={styles.fieldLabel}>UNTIL (OPTIONAL)</Text>
          <View style={styles.choiceRow}>
            <ChoicePill
              label="Open end"
              selected={openEnd}
              onPress={() => {
                setQuestionError('');
                setOpenEnd((current) => {
                  if (!current) setEndDate(null);
                  return !current;
                });
              }}
            />
            <ChoicePill
              label={
                endDate && !openEnd
                  ? `Until ${formatEventTime(endDate.toISOString())}`
                  : 'Pick an end time'
              }
              selected={Boolean(endDate) && !openEnd}
              onPress={() => {
                setQuestionError('');
                setOpenEnd(false);
                if (!endDate) {
                  const seed = new Date((date ?? dateSeed).getTime());
                  seed.setHours(seed.getHours() + 3);
                  setEndDate(seed);
                }
                setEndOpen(true);
              }}
            />
            {endDate || openEnd ? (
              <ChoicePill
                label="Clear"
                selected={false}
                onPress={() => {
                  setOpenEnd(false);
                  setEndDate(null);
                }}
              />
            ) : null}
          </View>

          <Text style={styles.fieldLabel}>HOW STRICT IS THE START? (OPTIONAL)</Text>
          <View style={styles.choiceRow}>
            {PUNCTUALITY_OPTIONS.map((option) => (
              <ChoicePill
                key={option}
                label={PUNCTUALITY_META[option].label}
                selected={punctuality === option}
                onPress={() =>
                  setPunctuality((current) => (current === option ? '' : option))
                }
              />
            ))}
          </View>
          {punctuality ? (
            <Text style={styles.questionHint}>{PUNCTUALITY_META[punctuality].hint}</Text>
          ) : null}
        </View>
      );
    }

    if (stage === 'location') {
      return (
        <View style={[styles.questionCard, styles.locationCard]}>
          {chatDraft.locationHint && !location ? (
            <View style={styles.locationHint}>
              <Ionicons name="sparkles-outline" size={16} color={colors.accent} />
              <Text style={styles.locationHintText}>
                AI suggestion: {chatDraft.locationHint}. Search and select the real result below.
              </Text>
            </View>
          ) : null}
          <LocationPicker
            label="EVENT LOCATION"
            labelColor={colors.muted}
            value={location}
            city={city}
            onChange={(nextLocation, nextCity) => {
              setLocation(nextLocation);
              setCity(nextCity);
              setQuestionError('');
            }}
          />
        </View>
      );
    }

    if (stage === 'visibility') {
      return (
        <View style={styles.questionCard}>
          <ToggleRow
            icon={isPublic ? 'earth-outline' : 'lock-closed-outline'}
            label={isPublic ? 'Public event' : 'Invite only'}
            hint={
              isPublic
                ? 'Sent for review before it can appear in Explore.'
                : 'Only people with the invite link can open it.'
            }
            value={isPublic}
            onChange={setIsPublic}
          />
          <View style={styles.divider} />
          <ToggleRow
            icon={hideLocation ? 'eye-off-outline' : 'location-outline'}
            label={hideLocation ? 'Reveal address after RSVP' : 'Show the address'}
            hint={
              hideLocation
                ? 'Confirmed guests unlock the exact location.'
                : 'Everyone with access can see the exact location.'
            }
            value={hideLocation}
            onChange={setHideLocation}
          />
        </View>
      );
    }

    if (stage === 'application') {
      return (
        <View style={styles.questionCard}>
          <ToggleRow
            icon={applyRequired ? 'clipboard-outline' : 'flash-outline'}
            label={applyRequired ? 'Guests apply first' : 'Anyone can join'}
            hint={
              applyRequired
                ? 'You approve every request before someone is in.'
                : 'Whoever sees the event can take a spot right away.'
            }
            value={applyRequired}
            onChange={setApplyRequired}
          />
          {applyRequired ? (
            <>
              <View style={styles.divider} />
              <Text style={styles.fieldLabel}>WHAT SHOULD APPLICANTS ANSWER?</Text>
              {applicationQuestions.map((question) => (
                <View key={question} style={styles.applicationQuestionRow}>
                  <Text style={styles.applicationQuestionText}>{question}</Text>
                  <Pressable
                    onPress={() =>
                      setApplicationQuestions((current) =>
                        current.filter((q) => q !== question)
                      )
                    }
                    hitSlop={8}
                  >
                    <Ionicons name="close-circle" size={19} color={colors.muted} />
                  </Pressable>
                </View>
              ))}
              {applicationQuestions.length < APPLICATION_LIMITS.questions ? (
                <>
                  <View style={styles.choiceRow}>
                    {APPLICATION_QUESTION_IDEAS.filter(
                      (idea) => !applicationQuestions.includes(idea)
                    ).map((idea) => (
                      <Pressable
                        key={idea}
                        onPress={() => addApplicationQuestion(idea)}
                        style={styles.choicePill}
                      >
                        <Ionicons name="add" size={14} color={colors.text} />
                        <Text style={styles.choicePillText}>{idea}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={styles.applicationInputRow}>
                    <TextInput
                      value={applicationQuestionDraft}
                      onChangeText={setApplicationQuestionDraft}
                      placeholder="Or write your own question…"
                      placeholderTextColor={colors.muted}
                      maxLength={APPLICATION_LIMITS.question}
                      style={styles.applicationInput}
                      returnKeyType="done"
                      onSubmitEditing={() => addApplicationQuestion(applicationQuestionDraft)}
                    />
                    <Pressable
                      onPress={() => addApplicationQuestion(applicationQuestionDraft)}
                      disabled={!applicationQuestionDraft.trim()}
                      style={[
                        styles.applicationAddButton,
                        !applicationQuestionDraft.trim() && styles.disabled,
                      ]}
                    >
                      <Ionicons name="add" size={18} color={colors.onInk} />
                    </Pressable>
                  </View>
                </>
              ) : null}
              <Text style={styles.questionHint}>
                {applicationQuestions.length
                  ? 'Applicants answer these when they request a spot.'
                  : 'No questions yet: applicants simply tell you why they would love to join.'}
              </Text>
            </>
          ) : null}
        </View>
      );
    }

    if (stage === 'capacity') {
      return (
        <View style={styles.questionCard}>
          <Text style={styles.fieldLabel}>CAPACITY</Text>
          <View style={styles.choiceRow}>
            <ChoicePill
              label="Set a limit"
              selected={capacityMode === 'limited'}
              onPress={() => setCapacityMode('limited')}
            />
            <ChoicePill
              label="No limit"
              selected={capacityMode === 'unlimited'}
              onPress={() => setCapacityMode('unlimited')}
            />
          </View>
          {capacityMode === 'limited' ? (
            <View style={styles.numberInputRow}>
              <Ionicons name="people-outline" size={20} color={colors.muted} />
              <TextInput
                value={capacityInput}
                onChangeText={(value) => {
                  setCapacityInput(value.replace(/\D/g, ''));
                  setQuestionError('');
                }}
                keyboardType="number-pad"
                placeholder="30"
                placeholderTextColor={colors.muted}
                maxLength={5}
                style={styles.numberInput}
              />
              <Text style={styles.inputSuffix}>guests maximum</Text>
            </View>
          ) : (
            <Text style={styles.questionHint}>
              Guests can RSVP without a capacity or waitlist.
            </Text>
          )}
        </View>
      );
    }

    if (stage === 'plusOnes') {
      return (
        <View style={styles.questionCard}>
          <Counter
            label="Plus-ones per guest"
            hint={
              plusOnes === 0
                ? 'Named guests only.'
                : plusOnes === 1
                  ? 'Each guest can bring one person.'
                  : `Each guest can bring up to ${plusOnes} people.`
            }
            value={plusOnes}
            onChange={setPlusOnes}
            min={0}
            max={MAX_PLUS_ONES}
          />
        </View>
      );
    }

    if (stage === 'price') {
      return (
        <View style={styles.questionCard}>
          <Text style={styles.fieldLabel}>ENTRY</Text>
          <View style={styles.choiceRow}>
            <ChoicePill label="Free" selected={!paid} onPress={() => setPaid(false)} />
            <ChoicePill label="Paid tickets" selected={paid} onPress={() => setPaid(true)} />
          </View>
          {paid ? (
            <View style={styles.numberInputRow}>
              <Text style={styles.currency}>€</Text>
              <TextInput
                value={price}
                onChangeText={(value) => {
                  setPrice(value.replace(/[^0-9,.]/g, ''));
                  setQuestionError('');
                }}
                keyboardType="decimal-pad"
                placeholder="25"
                placeholderTextColor={colors.muted}
                maxLength={10}
                style={styles.numberInput}
              />
              <Text style={styles.inputSuffix}>per ticket</Text>
            </View>
          ) : (
            <Text style={styles.questionHint}>The invite will clearly show free entry.</Text>
          )}
        </View>
      );
    }

    if (stage === 'style') {
      return (
        <View style={styles.questionCard}>
          <Text style={styles.fieldLabel}>VIBE (OPTIONAL)</Text>
          <View style={styles.choiceRow}>
            {VIBE_IDEAS.map((idea) => (
              <ChoicePill
                key={idea}
                label={idea}
                selected={vibe === idea}
                onPress={() => setVibe((current) => (current === idea ? '' : idea))}
              />
            ))}
          </View>
          <TextInput
            value={vibe}
            onChangeText={setVibe}
            placeholder="Or describe the energy in your own words…"
            placeholderTextColor={colors.muted}
            maxLength={LIMITS.vibe}
            style={styles.styleInput}
          />
          <View style={styles.divider} />
          <Text style={styles.fieldLabel}>DRESS CODE (OPTIONAL)</Text>
          <TextInput
            value={dressCode}
            onChangeText={setDressCode}
            placeholder="Come as you are"
            placeholderTextColor={colors.muted}
            maxLength={LIMITS.dressCode}
            style={styles.styleInput}
          />
          <Text style={styles.questionHint}>
            Both show up with the event facts, so guests know how to arrive.
          </Text>
        </View>
      );
    }

    const coverUri = image?.uri ?? (aiCover ? `data:image/jpeg;base64,${aiCover}` : null);
    return (
      <View style={styles.questionCard}>
        <Pressable onPress={chooseImage} disabled={imageBusy} style={styles.imagePicker}>
          {coverUri ? (
            <>
              <Image source={{ uri: coverUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              <View style={styles.imageScrim} />
              {!image ? (
                <View style={styles.aiBadge}>
                  <Ionicons name="sparkles" size={12} color={colors.onInk} />
                  <Text style={styles.aiBadgeText}>AI design</Text>
                </View>
              ) : null}
              {aiCoverBusy ? (
                <View style={styles.coverBusyOverlay}>
                  <ActivityIndicator color="#fff" />
                  <Text style={styles.coverBusyText}>Designing a new cover…</Text>
                </View>
              ) : (
                <View style={styles.changeImagePill}>
                  <Ionicons name="camera" size={14} color={colors.onInk} />
                  <Text style={styles.changeImageText}>Use a photo</Text>
                </View>
              )}
            </>
          ) : aiCoverBusy ? (
            <>
              <View style={[styles.imageIcon, { backgroundColor: `${visual.tint}35` }]}>
                <ActivityIndicator color={colors.text} />
              </View>
              <Text style={styles.imageTitle}>Designing your cover…</Text>
              <Text style={styles.imageHint}>The AI is creating artwork just for this event</Text>
            </>
          ) : (
            <>
              <View style={[styles.imageIcon, { backgroundColor: `${visual.tint}35` }]}>
                {imageBusy ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <Ionicons name="image-outline" size={26} color={colors.text} />
                )}
              </View>
              <Text style={styles.imageTitle}>Add a cover image</Text>
              <Text style={styles.imageHint}>Pick a photo, or let the AI design one</Text>
            </>
          )}
        </Pressable>
        {aiCoverError ? <Text style={styles.footerError}>{aiCoverError}</Text> : null}
        <View style={styles.coverActions}>
          <Pressable
            onPress={() => {
              setImage(null);
              void generateCover();
            }}
            disabled={aiCoverBusy}
            style={[styles.coverActionButton, aiCoverBusy && styles.disabled]}
          >
            <Ionicons name="sparkles-outline" size={15} color={colors.text} />
            <Text style={styles.coverActionText}>
              {aiCover || image ? 'New design' : 'Design with AI'}
            </Text>
          </Pressable>
          {coverUri ? (
            <Pressable onPress={removeCover} style={styles.coverActionButton}>
              <Ionicons name="trash-outline" size={15} color={colors.muted} />
              <Text style={[styles.coverActionText, { color: colors.muted }]}>No cover</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  function renderPreview() {
    if (stage !== 'preview') return null;
    const coverUri = image?.uri ?? (aiCover ? `data:image/jpeg;base64,${aiCover}` : null);
    return (
      <>
        <View style={styles.previewHeading}>
          <Text style={styles.stepTitle}>Your event page</Text>
          <Text style={styles.stepSubtitle}>
            This is the information guests will see. Tap any row below to change it.
          </Text>
        </View>

        <View style={styles.previewCard}>
          <View style={[styles.previewHero, { backgroundColor: visual.tint }]}>
            {coverUri ? (
              <>
                <Image source={{ uri: coverUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                <View style={styles.previewScrim} />
              </>
            ) : aiCoverBusy ? (
              <>
                <View style={styles.previewGlow} />
                <ActivityIndicator color="#fff" />
                <Text style={styles.previewDesigningText}>Designing your cover…</Text>
              </>
            ) : (
              <>
                <View style={styles.previewGlow} />
                <Text style={styles.previewEmoji}>{visual.emoji}</Text>
              </>
            )}
            <View style={styles.previewPrivacy}>
              <Ionicons
                name={isPublic ? 'earth' : 'lock-closed'}
                size={12}
                color="#fff"
              />
              <Text style={styles.previewPrivacyText}>
                {isPublic ? 'Public request' : 'Invite only'}
              </Text>
            </View>
          </View>
          <View style={styles.previewBody}>
            <Text style={styles.previewTitle}>{title.trim()}</Text>
            {date ? (
              <Text style={styles.previewMeta}>
                {formatEventDate(date.toISOString())} · {formatEventTime(date.toISOString())}
                {openEnd
                  ? ' · open end'
                  : endDate
                    ? ` until ${formatEventTime(endDate.toISOString())}`
                    : ''}
              </Text>
            ) : null}
            <Text style={styles.previewMeta} numberOfLines={2}>
              📍 {hideLocation ? `${city || 'Exact location'} · revealed after RSVP` : location}
            </Text>
            <View style={styles.previewPills}>
              <View style={styles.previewPill}>
                <Text style={styles.previewPillText}>
                  👥 {maxGuests == null ? 'No limit' : `${maxGuests} spots`}
                </Text>
              </View>
              <View style={styles.previewPill}>
                <Text style={styles.previewPillText}>
                  {paid ? `🎟️ €${normalizeTicketPrice(price) ?? price}` : '✨ Free'}
                </Text>
              </View>
              <View style={styles.previewPill}>
                <Text style={styles.previewPillText}>
                  {plusOnes ? `+${plusOnes} allowed` : 'No +1s'}
                </Text>
              </View>
              {applyRequired ? (
                <View style={styles.previewPill}>
                  <Text style={styles.previewPillText}>📝 Apply to join</Text>
                </View>
              ) : null}
              {punctuality ? (
                <View style={styles.previewPill}>
                  <Text style={styles.previewPillText}>
                    ⏰ {PUNCTUALITY_META[punctuality].label}
                  </Text>
                </View>
              ) : null}
              {vibe.trim() ? (
                <View style={styles.previewPill}>
                  <Text style={styles.previewPillText}>✨ {vibe.trim()}</Text>
                </View>
              ) : null}
              {dressCode.trim() ? (
                <View style={styles.previewPill}>
                  <Text style={styles.previewPillText}>👗 {dressCode.trim()}</Text>
                </View>
              ) : null}
            </View>
            {description.trim() ? (
              <Text style={styles.previewDescription}>{description.trim()}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.editCard}>
          <PreviewEditRow
            icon="text-outline"
            label="Title"
            value={title.trim()}
            onPress={() => editFromPreview('title')}
          />
          <View style={styles.divider} />
          <PreviewEditRow
            icon="document-text-outline"
            label="Description"
            value={description.trim() || 'No description'}
            onPress={() => editFromPreview('description')}
          />
          <View style={styles.divider} />
          <PreviewEditRow
            icon="calendar-outline"
            label="Date & time"
            value={
              date
                ? `${formatEventDate(date.toISOString())} · ${formatEventTime(
                    date.toISOString()
                  )}${
                    openEnd
                      ? ' · open end'
                      : endDate
                        ? ` until ${formatEventTime(endDate.toISOString())}`
                        : ''
                  }${punctuality ? ` · ${PUNCTUALITY_META[punctuality].label}` : ''}`
                : 'Missing'
            }
            onPress={() => editFromPreview('when')}
          />
          <View style={styles.divider} />
          <PreviewEditRow
            icon="grid-outline"
            label="Type"
            value={`${CATEGORY_VISUALS[category].emoji} ${CATEGORY_VISUALS[category].label}`}
            onPress={() => editFromPreview('category')}
          />
          <View style={styles.divider} />
          <PreviewEditRow
            icon="sparkles-outline"
            label="Vibe & dress code"
            value={
              [vibe.trim(), dressCode.trim()].filter(Boolean).join(' · ') ||
              'Add a vibe or dress code'
            }
            onPress={() => editFromPreview('style')}
          />
          <View style={styles.divider} />
          <PreviewEditRow
            icon="location-outline"
            label="Location"
            value={location || 'Missing'}
            onPress={() => editFromPreview('location')}
          />
          <View style={styles.divider} />
          <PreviewEditRow
            icon={isPublic ? 'earth-outline' : 'lock-closed-outline'}
            label="Access"
            value={`${isPublic ? 'Public' : 'Invite only'} · ${
              hideLocation ? 'address after RSVP' : 'address visible'
            }`}
            onPress={() => editFromPreview('visibility')}
          />
          <View style={styles.divider} />
          <PreviewEditRow
            icon="people-outline"
            label="Guests"
            value={`${maxGuests == null ? 'No limit' : `${maxGuests} max`} · ${
              plusOnes ? `+${plusOnes}` : 'no +1s'
            }`}
            onPress={() => editFromPreview('capacity')}
          />
          <View style={styles.divider} />
          <PreviewEditRow
            icon="clipboard-outline"
            label="Joining"
            value={
              applyRequired
                ? `Apply first${
                    applicationQuestions.length
                      ? ` · ${applicationQuestions.length} question${
                          applicationQuestions.length > 1 ? 's' : ''
                        }`
                      : ''
                  }`
                : 'Anyone can join'
            }
            onPress={() => editFromPreview('application')}
          />
          <View style={styles.divider} />
          <PreviewEditRow
            icon="person-add-outline"
            label="Plus-ones"
            value={plusOnes ? `Up to ${plusOnes} per guest` : 'Not allowed'}
            onPress={() => editFromPreview('plusOnes')}
          />
          <View style={styles.divider} />
          <PreviewEditRow
            icon="ticket-outline"
            label="Entry"
            value={paid ? `€${normalizeTicketPrice(price) ?? price} per ticket` : 'Free'}
            onPress={() => editFromPreview('price')}
          />
          <View style={styles.divider} />
          <PreviewEditRow
            icon="image-outline"
            label="Cover"
            value={
              image
                ? 'Your photo'
                : aiCover
                  ? 'AI design'
                  : aiCoverBusy
                    ? 'Designing…'
                    : 'No cover image'
            }
            onPress={() => editFromPreview('image')}
          />
        </View>

        {isPublic ? (
          <View style={styles.reviewNote}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.warning} />
            <Text style={styles.reviewNoteText}>
              Public events are submitted for review. Your invite link works immediately, but the
              event stays out of Explore until approved.
            </Text>
          </View>
        ) : null}

        {!canPublish ? (
          <View style={styles.validationCard}>
            <Text style={styles.validationTitle}>Before you publish</Text>
            {validationIssues.map((issue) => (
              <Text key={issue} style={styles.validationText}>
                • {issue}
              </Text>
            ))}
          </View>
        ) : null}
      </>
    );
  }

  function renderFooter() {
    if (stage === 'brief' || stage === 'title' || stage === 'description') {
      const value = stage === 'brief' ? composer : stage === 'title' ? title : description;
      const setValue =
        stage === 'brief' ? setComposer : stage === 'title' ? setTitle : setDescription;
      const canSend =
        !aiBusy &&
        (stage === 'description' ? true : value.trim().length >= (stage === 'title' ? 2 : 3));
      return (
        <View style={styles.composerFooter}>
          <View style={styles.composerBox}>
            <TextInput
              value={value}
              onChangeText={(next) => {
                setValue(next);
                setQuestionError('');
              }}
              placeholder={
                stage === 'brief'
                  ? 'Tell me what you’re dreaming up…'
                  : stage === 'title'
                    ? 'Event title'
                    : 'Event description'
              }
              placeholderTextColor={colors.muted}
              editable={!aiBusy}
              multiline={stage !== 'title'}
              maxLength={
                stage === 'title'
                  ? LIMITS.title
                  : stage === 'brief'
                    ? EVENT_DRAFT_CHAT_LIMITS.message
                    : LIMITS.description
              }
              textAlignVertical="top"
              style={[styles.composerInput, stage === 'title' && styles.composerInputSingle]}
              returnKeyType={stage === 'title' ? 'send' : 'default'}
              onSubmitEditing={stage === 'title' ? submitTextAnswer : undefined}
              // Web chat convention: Enter sends, Shift+Enter makes a newline.
              // (The single-line title stage already sends via onSubmitEditing.)
              onKeyPress={
                Platform.OS === 'web' && stage !== 'title'
                  ? (event) => {
                      const native = event.nativeEvent as { key?: string; shiftKey?: boolean };
                      if (native.key === 'Enter' && !native.shiftKey) {
                        event.preventDefault();
                        if (canSend) {
                          (stage === 'brief' ? submitBrief : submitTextAnswer)();
                        }
                      }
                    }
                  : undefined
              }
            />
            <Pressable
              onPress={stage === 'brief' ? submitBrief : submitTextAnswer}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel="Send"
              // Keep the tap from blurring the input first: on mobile web the
              // closing keyboard reflows the page mid-tap and the click lands
              // somewhere else — the send press was silently swallowed.
              {...(Platform.OS === 'web'
                ? ({
                    onMouseDown: (event: { preventDefault?: () => void }) =>
                      event.preventDefault?.(),
                  } as Record<string, unknown>)
                : {})}
              style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
            >
              <Ionicons
                name="arrow-up"
                size={21}
                color={canSend ? colors.onInk : colors.muted}
              />
            </Pressable>
          </View>
          {questionError ? <Text style={styles.footerError}>{questionError}</Text> : null}
        </View>
      );
    }

    let label = 'Continue';
    let onPress = () => completeQuestion('');
    let disabled = false;

    if (stage === 'category') {
      label = 'Save event type';
      onPress = completeCategory;
    } else if (stage === 'when') {
      label = 'Use this date & time';
      onPress = completeDate;
      disabled = !date || date.getTime() <= Date.now();
    } else if (stage === 'location') {
      // No button while nothing is selected: a dangling "Use this location"
      // read like a use-my-current-location action. It only appears once a
      // real place has been picked, as a clear confirmation step.
      if (!location.trim()) return null;
      label = `Confirm: ${location.length > 28 ? `${location.slice(0, 28)}…` : location}`;
      onPress = completeLocation;
    } else if (stage === 'visibility') {
      label = 'Save access settings';
      onPress = () =>
        completeQuestion(
          `${isPublic ? 'Public event' : 'Invite only'}; ${
            hideLocation ? 'address after RSVP' : 'address visible'
          }`,
          { ...chatDraft, isPublic, hideLocation }
        );
    } else if (stage === 'application') {
      label = 'Save joining rules';
      onPress = completeApplication;
    } else if (stage === 'style') {
      label = 'Save vibe & dress code';
      onPress = () => {
        const trimmedVibe = vibe.trim();
        const trimmedDress = dressCode.trim();
        completeQuestion(
          [
            trimmedVibe ? `Vibe: ${trimmedVibe}` : '',
            trimmedDress ? `Dress code: ${trimmedDress}` : '',
          ]
            .filter(Boolean)
            .join('. ') || 'No vibe or dress code notes',
          {
            ...chatDraft,
            vibe: trimmedVibe || null,
            dressCode: trimmedDress || null,
          }
        );
      };
    } else if (stage === 'capacity') {
      label = 'Save guest limit';
      onPress = completeCapacity;
    } else if (stage === 'plusOnes') {
      label = 'Save plus-ones';
      onPress = () =>
        completeQuestion(plusOnes ? `Up to ${plusOnes} per guest` : 'No plus-ones', {
          ...chatDraft,
          plusOneLimit: plusOnes,
        });
    } else if (stage === 'price') {
      label = 'Save entry price';
      onPress = completePrice;
      disabled = paid && !normalizeTicketPrice(price);
    } else if (stage === 'image') {
      label = editingFromPreview ? 'Save cover' : 'Build event preview';
      onPress = () =>
        completeQuestion(
          image ? 'Cover photo added' : aiCover ? 'AI cover design added' : 'Skip cover image'
        );
    } else if (stage === 'preview') {
      label = isPublic ? 'Submit & create event' : 'Publish event';
      onPress = publish;
      disabled = !canPublish || submitting;
    }

    return (
      <View style={styles.actionFooter}>
        {questionError || publishError ? (
          <Text style={styles.footerError}>{questionError || publishError}</Text>
        ) : null}
        <Pressable
          onPress={onPress}
          disabled={disabled || submitting || aiBusy}
          style={[
            styles.primaryButton,
            (disabled || submitting || aiBusy) && styles.primaryButtonDisabled,
          ]}
        >
          {submitting || aiBusy ? (
            <ActivityIndicator color={colors.onInk} />
          ) : (
            <>
              <Text
                style={[
                  styles.primaryButtonText,
                  disabled && styles.primaryButtonTextDisabled,
                ]}
              >
                {label}
              </Text>
              <Ionicons
                name={stage === 'preview' ? 'sparkles' : 'arrow-forward'}
                size={19}
                color={disabled ? colors.muted : colors.onInk}
              />
            </>
          )}
        </Pressable>
      </View>
    );
  }

  if (created) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.success}>
          <View style={[styles.successSeal, { backgroundColor: visual.tint }]}>
            <Ionicons name="checkmark" size={50} color="#fff" />
          </View>
          <Text style={styles.successKicker}>
            {isPublic ? 'SUBMITTED FOR REVIEW' : 'YOUR INVITE IS LIVE'}
          </Text>
          <Text style={styles.successTitle}>{created.title}</Text>
          <Text style={styles.successBody}>
            {isPublic
              ? 'It stays private until an admin approves it for Explore. Your invite link works now.'
              : 'Send it to your people. They can RSVP yes, maybe or no from the link.'}
          </Text>
          <View style={styles.successActions}>
            <Pressable onPress={shareCreated} style={styles.primaryButton}>
              <Ionicons name="paper-plane" size={19} color={colors.onInk} />
              <Text style={styles.primaryButtonText}>Share invite</Text>
            </Pressable>
            <View style={styles.quickShareRow}>
              <Pressable
                onPress={() => {
                  const link = Linking.createURL(`e/${created.slug}`);
                  textInvite('', `You’re invited: ${created.title}\n${link}`, link);
                }}
                style={styles.quickShare}
              >
                <Ionicons name="chatbubble-outline" size={18} color={colors.text} />
                <Text style={styles.quickShareText}>Message</Text>
              </Pressable>
              <Pressable
                onPress={() => copyLink(Linking.createURL(`e/${created.slug}`))}
                style={styles.quickShare}
              >
                <Ionicons name="link-outline" size={18} color={colors.text} />
                <Text style={styles.quickShareText}>Copy link</Text>
              </Pressable>
            </View>
            <Pressable
              onPress={() => router.replace(`/event/${created.slug}`)}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Open event</Text>
            </Pressable>
            <Pressable onPress={onRestart} style={styles.secondaryButton}>
              <Ionicons name="add" size={18} color={colors.text} />
              <Text style={styles.secondaryButtonText}>Create another event</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    // Bottom inset stays with the tab bar below the scene; padding it here too
    // opened a wide dead band between the composer and the task bar.
    <SafeAreaView ref={screenRef} style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.flex, webKeyboardInset > 0 && { paddingBottom: webKeyboardInset }]}
      >
        {/* Slim chat chrome: history and a fresh start on the left, exit on
            the right. The chat itself speaks for the rest. */}
        <View style={styles.header}>
          <Pressable
            onPress={openHistory}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Previous chats"
          >
            <Ionicons name="time-outline" size={20} color={colors.text} />
          </Pressable>
          <Pressable
            onPress={resetChat}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Start a new chat"
          >
            <Ionicons name="refresh" size={19} color={colors.text} />
          </Pressable>
          <View style={styles.flex} />
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/explore'))}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={20} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageRow,
                message.role === 'user' && styles.messageRowUser,
              ]}
            >
              <View
                style={[
                  styles.messageContent,
                  message.role === 'user' ? styles.userBubble : styles.assistantMessage,
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    message.role === 'user' && styles.userMessageText,
                  ]}
                >
                  {message.text}
                </Text>
                {message.tags?.length ? (
                  <View style={styles.messageTags}>
                    {message.tags.map((tag) => (
                      <View key={tag} style={styles.messageTag}>
                        <Text style={styles.messageTagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          ))}

          {aiBusy ? (
            <View style={styles.messageRow}>
              <View style={[styles.messageContent, styles.thinkingBubble]}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={styles.thinkingText}>Give me a sec…</Text>
              </View>
            </View>
          ) : null}

          {aiError ? (
            <View style={styles.aiErrorCard}>
              <View style={styles.aiErrorCopy}>
                <Ionicons name="cloud-offline-outline" size={18} color={colors.warning} />
                <Text style={styles.aiErrorText}>{aiError}</Text>
              </View>
              <Pressable onPress={retryAi} disabled={aiBusy} style={styles.retryButton}>
                <Ionicons name="refresh" size={15} color={colors.text} />
                <Text style={styles.retryButtonText}>Retry AI</Text>
              </Pressable>
            </View>
          ) : null}

          {renderQuestionCard()}
          {renderPreview()}
        </ScrollView>

        {renderFooter()}

        {dateOpen ? (
          <DateTimeSheet
            date={date ?? dateSeed}
            onChange={(next) => {
              setDate(next);
              setQuestionError('');
            }}
            onClose={() => setDateOpen(false)}
          />
        ) : null}
        {endOpen && endDate ? (
          <DateTimeSheet
            date={endDate}
            onChange={(next) => {
              setEndDate(next);
              setOpenEnd(false);
              setQuestionError('');
            }}
            onClose={() => setEndOpen(false)}
          />
        ) : null}

        {historyOpen ? (
          <View style={styles.historyOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setHistoryOpen(false)} />
            <View style={styles.historySheet}>
              <View style={styles.historyHeader}>
                <Text style={styles.historyTitle}>Previous chats</Text>
                <Pressable
                  onPress={() => setHistoryOpen(false)}
                  hitSlop={8}
                  style={styles.historyCloseButton}
                >
                  <Ionicons name="close" size={18} color={colors.text} />
                </Pressable>
              </View>
              {historySessions == null ? (
                <ActivityIndicator color={colors.accent} style={styles.historyLoading} />
              ) : historySessions.length === 0 ? (
                <Text style={styles.historyEmpty}>
                  No previous chats yet. Every draft you start lands here automatically.
                </Text>
              ) : (
                <ScrollView
                  style={styles.historyList}
                  contentContainerStyle={styles.historyListContent}
                  showsVerticalScrollIndicator={false}
                >
                  {historySessions.map((session) => (
                    <View key={session.id} style={styles.historyRow}>
                      <Pressable
                        style={({ pressed }) => [styles.historyMain, pressed && { opacity: 0.7 }]}
                        onPress={() => {
                          if (session.createdSlug) {
                            setHistoryOpen(false);
                            router.push(`/event/${session.createdSlug}`);
                          } else {
                            restoreSession(session);
                          }
                        }}
                      >
                        <Text style={styles.historyLabel} numberOfLines={1}>
                          {chatSessionLabel(session)}
                        </Text>
                        <Text style={styles.historyMeta}>
                          {session.createdSlug ? 'Published' : 'Draft'}
                          {' · '}
                          {new Date(session.updatedAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                          {', '}
                          {new Date(session.updatedAt).toLocaleTimeString(undefined, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </Pressable>
                      <Ionicons
                        name={session.createdSlug ? 'open-outline' : 'chevron-forward'}
                        size={16}
                        color={colors.muted}
                      />
                      <Pressable
                        onPress={() => removeSession(session.id)}
                        hitSlop={8}
                        style={styles.historyDelete}
                      >
                        <Ionicons name="trash-outline" size={17} color={colors.muted} />
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PreviewEditRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.editRow}>
      <View style={styles.editIcon}>
        <Ionicons name={icon} size={18} color={colors.text} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.editLabel}>{label}</Text>
        <Text style={styles.editValue} numberOfLines={2}>
          {value}
        </Text>
      </View>
      <View style={styles.editAction}>
        <Text style={styles.editActionText}>Edit</Text>
      </View>
    </Pressable>
  );
}

export default withScreenBackground(CreateEventScreen, { bloom: false });

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingRight: spacing.lg,
  },
  messageRowUser: { justifyContent: 'flex-end', paddingRight: 0, paddingLeft: spacing.xl },
  messageContent: { flexShrink: 1, maxWidth: '92%' },
  // Only bubble-less assistant text gets the optical nudge; on the user bubble
  // a paddingTop would override paddingVertical and push the text off-center.
  assistantMessage: { paddingTop: 3 },
  userBubble: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 18,
    borderBottomRightRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  thinkingBubble: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  thinkingText: { ...uiText(12, '600'), color: colors.muted },
  messageText: { ...uiText(15, '500', { lineHeight: 1.5 }), color: colors.text },
  userMessageText: { ...uiText(14, '500', { lineHeight: 1.45 }) },
  messageTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  messageTag: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  messageTagText: { ...uiText(11, '600'), color: colors.text },
  aiErrorCard: {
    backgroundColor: 'rgba(232,178,60,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(232,178,60,0.28)',
    borderRadius: radius.md,
    padding: 12,
    gap: 10,
  },
  aiErrorCopy: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  aiErrorText: { ...uiText(11, '500', { lineHeight: 1.4 }), color: colors.text, flex: 1 },
  retryButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.inputBg,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  retryButtonText: { ...uiText(11, '700'), color: colors.text },
  starterArea: { gap: spacing.sm, marginTop: spacing.xs },
  titleIdeas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  titleIdea: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
  },
  titleIdeaText: { ...uiText(14, '600'), color: colors.text },
  starterLabel: { ...uiText(10, '700', { tracking: 0.1 }), color: colors.muted },
  starterPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  starterPromptText: { ...uiText(12, '500'), color: colors.text, flex: 1 },
  questionCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
    ...shadow.card,
  },
  locationCard: { zIndex: 40 },
  locationHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    padding: 10,
  },
  locationHintText: { ...uiText(11, '500', { lineHeight: 1.4 }), color: colors.muted, flex: 1 },
  fieldLabel: { ...uiText(10, '700', { tracking: 0.1 }), color: colors.muted },
  dateChoice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  questionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateChoiceValue: { ...uiText(15, '600'), color: colors.text, marginTop: 2 },
  placeholderText: { color: colors.muted },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  controlIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlTitle: { ...uiText(14, '700'), color: colors.text },
  controlHint: { ...uiText(11), color: colors.muted, marginTop: 1 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.cardBorder },
  switchTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.inputBg,
    padding: 3,
  },
  switchTrackOn: { backgroundColor: colors.success },
  switchKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.muted },
  switchKnobOn: { backgroundColor: '#fff', transform: [{ translateX: 20 }] },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choicePill: {
    minHeight: 42,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.inputBg,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  choicePillSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  choicePillText: { ...uiText(13, '600'), color: colors.text },
  choicePillTextSelected: { color: colors.onInk },
  applicationQuestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  applicationQuestionText: { ...uiText(13, '600'), color: colors.text, flex: 1 },
  applicationInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 4,
  },
  applicationInput: { ...uiText(13), color: colors.text, flex: 1, paddingVertical: 8 },
  styleInput: {
    ...uiText(14),
    color: colors.text,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  applicationAddButton: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: spacing.md,
  },
  numberInput: {
    ...display(23),
    color: colors.text,
    flex: 1,
    minWidth: 60,
    paddingVertical: 10,
  },
  inputSuffix: { ...uiText(11), color: colors.muted },
  currency: { ...display(23), color: colors.text },
  questionHint: { ...uiText(12), color: colors.muted },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  counter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  counterButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterValue: { ...uiText(16, '700'), color: colors.text, minWidth: 26, textAlign: 'center' },
  disabled: { opacity: 0.3 },
  imagePicker: {
    height: 190,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.cardBorder,
    backgroundColor: colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  imageScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.18)' },
  imageIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  imageTitle: { ...uiText(14, '700'), color: colors.text },
  imageHint: { ...uiText(11), color: colors.muted },
  changeImagePill: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  changeImageText: { ...uiText(11, '700'), color: colors.onInk },
  aiBadge: {
    position: 'absolute',
    left: 10,
    top: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  aiBadgeText: { ...uiText(10, '700'), color: colors.onInk },
  coverBusyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  coverBusyText: { ...uiText(12, '600'), color: '#fff' },
  coverActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  coverActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  coverActionText: { ...uiText(12, '700'), color: colors.text },
  previewDesigningText: { ...uiText(12, '600'), color: '#fff', marginTop: 8 },
  previewHeading: { marginTop: spacing.sm },
  stepTitle: { ...display(28), color: colors.text },
  stepSubtitle: { ...uiText(13), color: colors.muted, marginTop: 4 },
  previewCard: {
    backgroundColor: '#F4F1EB',
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...shadow.float,
  },
  previewHero: { height: 200, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  previewScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.18)' },
  previewGlow: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  previewEmoji: { fontSize: 76 },
  previewPrivacy: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.58)',
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  previewPrivacyText: { ...uiText(10, '700'), color: '#fff' },
  previewBody: { padding: spacing.md },
  previewTitle: { ...display(28), color: '#171717' },
  previewMeta: { ...uiText(13, '600'), color: 'rgba(23,23,23,0.65)', marginTop: 3 },
  previewPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md },
  previewPill: {
    backgroundColor: 'rgba(23,23,23,0.08)',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  previewPillText: { ...uiText(11, '700'), color: '#171717' },
  previewDescription: {
    ...uiText(13, '400', { lineHeight: 1.5 }),
    color: 'rgba(23,23,23,0.76)',
    marginTop: spacing.md,
  },
  editCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
  },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 13 },
  editIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editLabel: { ...uiText(11, '700'), color: colors.muted },
  editValue: { ...uiText(13, '600'), color: colors.text, marginTop: 1 },
  editAction: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  editActionText: { ...uiText(11, '700'), color: colors.text },
  reviewNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: 'rgba(232,178,60,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(232,178,60,0.25)',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  reviewNoteText: { ...uiText(12), color: colors.text, flex: 1 },
  validationCard: {
    backgroundColor: 'rgba(255,90,96,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,90,96,0.28)',
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 3,
  },
  validationTitle: { ...uiText(13, '700'), color: colors.danger },
  validationText: { ...uiText(12), color: colors.text },
  // No band behind the composer: it floats on the same backdrop as the chat.
  composerFooter: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  composerBox: {
    flexDirection: 'row',
    // Keep the send button vertically centered in the pill, even when the
    // multiline input grows or the device font scale changes its height.
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 54,
    maxHeight: 150,
    // Translucent fill so the pill sits IN the backdrop instead of on a
    // black band of its own.
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 20,
    paddingLeft: spacing.md,
    paddingRight: 6,
    paddingVertical: 6,
  },
  composerInput: {
    ...uiText(14),
    color: colors.text,
    flex: 1,
    minHeight: 40,
    maxHeight: 130,
    paddingTop: 9,
    paddingBottom: 7,
  },
  composerInputSingle: { paddingTop: 10 },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { backgroundColor: colors.inputBg },
  actionFooter: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: 6,
  },
  footerError: { ...uiText(11, '600'), color: colors.danger, paddingHorizontal: 4 },
  primaryButton: {
    minHeight: 50,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  primaryButtonDisabled: { backgroundColor: colors.inputBg },
  primaryButtonText: { ...uiText(14, '700'), color: colors.onInk },
  primaryButtonTextDisabled: { color: colors.muted },
  secondaryButton: {
    minHeight: 50,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryButtonText: { ...uiText(14, '700'), color: colors.text },
  success: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  historyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
    zIndex: 70,
  },
  historySheet: {
    backgroundColor: '#10141F',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    maxHeight: '72%',
    gap: spacing.md,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyTitle: { ...display(24), color: colors.text },
  historyCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyLoading: { paddingVertical: spacing.lg },
  historyEmpty: { ...uiText(13), color: colors.muted, paddingBottom: spacing.md },
  historyList: { flexGrow: 0 },
  historyListContent: { gap: spacing.sm, paddingBottom: spacing.sm },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  historyMain: { flex: 1, gap: 2 },
  historyLabel: { ...uiText(14, '700'), color: colors.text },
  historyMeta: { ...uiText(11, '500'), color: colors.muted },
  historyDelete: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successSeal: {
    width: 94,
    height: 94,
    borderRadius: 47,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    ...shadow.float,
  },
  successKicker: { ...uiText(11, '700', { tracking: 0.12 }), color: colors.muted },
  successTitle: { ...display(34), color: colors.text, textAlign: 'center', marginTop: 6 },
  successBody: {
    ...uiText(14, '400', { lineHeight: 1.5 }),
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  successActions: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.xl },
  quickShareRow: { flexDirection: 'row', gap: spacing.sm },
  quickShare: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  quickShareText: { ...uiText(12, '700'), color: colors.text },
});
