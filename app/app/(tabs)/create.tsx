import React, { useMemo, useState } from 'react';
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
import type { Category, EventDetail } from '../../shared/types';
import { api } from '../../lib/api';
import { notify } from '../../lib/dialogs';
import { pickRawImage, uploadCroppedImage, type PickedImage } from '../../lib/imageUpload';
import { copyLink, shareText, textInvite } from '../../lib/share';
import { colors, radius, shadow, spacing } from '../../lib/theme';
import { display, uiText } from '../../lib/fonts';
import { LocationPicker } from '../../components/LocationPicker';
import { DateTimeSheet } from '../../components/DateTimeSheet';
import { formatEventDate, formatEventTime } from '../../components/EventCard';
import { withScreenBackground } from '../../components/ScreenBackground';

type Step = 'vibe' | 'details' | 'guests' | 'preview';

const STEPS: { key: Step; label: string }[] = [
  { key: 'vibe', label: 'Vibe' },
  { key: 'details', label: 'Details' },
  { key: 'guests', label: 'Guests' },
  { key: 'preview', label: 'Preview' },
];

const VIBES: {
  label: string;
  emoji: string;
  category: Category;
  tint: string;
  description: string;
}[] = [
  { label: 'Night out', emoji: '🪩', category: 'music', tint: '#6D5AE6', description: 'Late, loud, unforgettable.' },
  { label: 'House party', emoji: '🏠', category: 'community', tint: '#EF6F57', description: 'Your place, your people.' },
  { label: 'Dinner', emoji: '🍝', category: 'food', tint: '#D79B42', description: 'Good food, better company.' },
  { label: 'Birthday', emoji: '🎂', category: 'community', tint: '#D95E9F', description: 'One night with main-character energy.' },
  { label: 'Culture', emoji: '🎨', category: 'arts', tint: '#398A87', description: 'Art, cinema, ideas and people.' },
  { label: 'Movement', emoji: '🏀', category: 'sports', tint: '#4E8E55', description: 'Play, sweat, connect.' },
];

function tomorrowAtEight(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(20, 0, 0, 0);
  return d;
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
  onChange: (n: number) => void;
  min: number;
  max: number;
}) {
  return (
    <View style={styles.counterRow}>
      <View style={{ flex: 1 }}>
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
  onChange: (next: boolean) => void;
}) {
  return (
    <Pressable onPress={() => onChange(!value)} style={styles.toggleRow}>
      <View style={styles.controlIcon}>
        <Ionicons name={icon} size={20} color={colors.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.controlTitle}>{label}</Text>
        <Text style={styles.controlHint}>{hint}</Text>
      </View>
      <View style={[styles.switchTrack, value && styles.switchTrackOn]}>
        <View style={[styles.switchKnob, value && styles.switchKnobOn]} />
      </View>
    </Pressable>
  );
}

function CreateEventScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('vibe');
  const [vibeIndex, setVibeIndex] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(tomorrowAtEight);
  const [dateOpen, setDateOpen] = useState(false);
  const [location, setLocation] = useState('');
  const [city, setCity] = useState('');
  const [image, setImage] = useState<PickedImage | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [hideLocation, setHideLocation] = useState(false);
  const [maxGuests, setMaxGuests] = useState(30);
  const [plusOnes, setPlusOnes] = useState(1);
  const [paid, setPaid] = useState(false);
  const [price, setPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<EventDetail | null>(null);

  const vibe = VIBES[vibeIndex];
  const currentIndex = STEPS.findIndex((s) => s.key === step);
  const canContinue = useMemo(() => {
    if (step === 'vibe') return title.trim().length >= 2;
    if (step === 'details') return Boolean(location && date.getTime() > Date.now());
    if (step === 'guests') return !paid || price.trim().length > 0;
    return true;
  }, [step, title, location, date, paid, price]);

  async function chooseImage() {
    if (imageBusy) return;
    setImageBusy(true);
    try {
      setImage(await pickRawImage());
    } finally {
      setImageBusy(false);
    }
  }

  async function publish() {
    if (submitting || !canContinue) return;
    setSubmitting(true);
    try {
      let coverImage = '';
      if (image) {
        const targetRatio = 4 / 3;
        const sourceRatio = image.width / image.height;
        const width = sourceRatio > targetRatio ? Math.floor(image.height * targetRatio) : image.width;
        const height = sourceRatio > targetRatio ? image.height : Math.floor(image.width / targetRatio);
        coverImage =
          (await uploadCroppedImage(image.uri, {
            originX: Math.max(0, Math.floor((image.width - width) / 2)),
            originY: Math.max(0, Math.floor((image.height - height) / 2)),
            width,
            height,
          })) ?? '';
      }

      const result = await api.createEvent({
        title: title.trim(),
        description: description.trim(),
        date: date.toISOString(),
        location,
        city,
        category: vibe.category,
        isPublic,
        hideLocation,
        coverImage,
        maxGuests,
        plusOneLimit: plusOnes,
        costPerPerson: paid ? price.trim() : '',
        rsvpsOpen: true,
      });
      setCreated(result.event);
    } catch (e) {
      notify('Could not publish', e instanceof Error ? e.message : 'Try again');
    } finally {
      setSubmitting(false);
    }
  }

  async function shareCreated() {
    if (!created) return;
    const link = Linking.createURL(`e/${created.slug}`);
    await shareText(
      `${created.title} — ${formatEventDate(created.date)} at ${formatEventTime(created.date)}\n${link}`,
      link
    );
  }

  if (created) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.success}>
          <View style={[styles.successSeal, { backgroundColor: vibe.tint }]}>
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
                  textInvite('', `You're invited: ${created.title}\n${link}`, link);
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
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>EVENT STUDIO</Text>
            <Text style={styles.headerTitle}>Make it happen.</Text>
          </View>
          <Pressable onPress={() => router.replace('/explore')} style={styles.closeButton}>
            <Ionicons name="close" size={20} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.progress}>
          {STEPS.map((item, index) => (
            <View key={item.key} style={styles.progressItem}>
              <View
                style={[
                  styles.progressLine,
                  index <= currentIndex && { backgroundColor: vibe.tint },
                ]}
              />
              <Text style={[styles.progressLabel, index === currentIndex && styles.progressLabelOn]}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 'vibe' ? (
            <>
              <View>
                <Text style={styles.stepTitle}>What are we making?</Text>
                <Text style={styles.stepSubtitle}>Start with a feeling. You can refine it later.</Text>
              </View>
              <View style={styles.vibeGrid}>
                {VIBES.map((item, index) => {
                  const selected = index === vibeIndex;
                  return (
                    <Pressable
                      key={item.label}
                      onPress={() => setVibeIndex(index)}
                      style={[
                        styles.vibeCard,
                        selected && { borderColor: item.tint, backgroundColor: `${item.tint}24` },
                      ]}
                    >
                      <Text style={styles.vibeEmoji}>{item.emoji}</Text>
                      <Text style={styles.vibeTitle}>{item.label}</Text>
                      <Text style={styles.vibeDescription}>{item.description}</Text>
                      {selected ? (
                        <View style={[styles.selectedDot, { backgroundColor: item.tint }]}>
                          <Ionicons name="checkmark" size={13} color="#fff" />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
              <View>
                <Text style={styles.fieldLabel}>EVENT NAME</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="The one everyone talks about"
                  placeholderTextColor={colors.muted}
                  maxLength={120}
                  style={styles.titleInput}
                />
              </View>
            </>
          ) : null}

          {step === 'details' ? (
            <>
              <View>
                <Text style={styles.stepTitle}>Set the scene.</Text>
                <Text style={styles.stepSubtitle}>The essentials people need before they say yes.</Text>
              </View>
              <Pressable onPress={() => setDateOpen(true)} style={styles.detailCard}>
                <View style={[styles.detailIcon, { backgroundColor: `${vibe.tint}30` }]}>
                  <Ionicons name="calendar-outline" size={22} color={colors.text} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>WHEN</Text>
                  <Text style={styles.detailValue}>
                    {formatEventDate(date.toISOString())} · {formatEventTime(date.toISOString())}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
              <View style={styles.locationWrap}>
                <LocationPicker
                  label="WHERE"
                  labelColor={colors.muted}
                  value={location}
                  city={city}
                  onChange={(nextLocation, nextCity) => {
                    setLocation(nextLocation);
                    setCity(nextCity);
                  }}
                />
              </View>
              <Pressable onPress={chooseImage} style={styles.imagePicker}>
                {image ? (
                  <Image source={{ uri: image.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                ) : (
                  <>
                    <View style={[styles.imageIcon, { backgroundColor: `${vibe.tint}35` }]}>
                      {imageBusy ? (
                        <ActivityIndicator color={colors.text} />
                      ) : (
                        <Ionicons name="image-outline" size={26} color={colors.text} />
                      )}
                    </View>
                    <Text style={styles.imageTitle}>Add a cover</Text>
                    <Text style={styles.imageHint}>A strong image makes the invite feel real.</Text>
                  </>
                )}
                {image ? (
                  <View style={styles.changeImagePill}>
                    <Ionicons name="camera" size={14} color={colors.onInk} />
                    <Text style={styles.changeImageText}>Change</Text>
                  </View>
                ) : null}
              </Pressable>
              <View>
                <Text style={styles.fieldLabel}>THE STORY</Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="What should people know? Dress code, energy, surprises…"
                  placeholderTextColor={colors.muted}
                  multiline
                  maxLength={4000}
                  textAlignVertical="top"
                  style={styles.descriptionInput}
                />
              </View>
            </>
          ) : null}

          {step === 'guests' ? (
            <>
              <View>
                <Text style={styles.stepTitle}>Your door, your rules.</Text>
                <Text style={styles.stepSubtitle}>Keep it intimate, open it up, or sell the night.</Text>
              </View>
              <View style={styles.settingsCard}>
                <ToggleRow
                  icon={isPublic ? 'earth-outline' : 'lock-closed-outline'}
                  label={isPublic ? 'Public event' : 'Invite only'}
                  hint={
                    isPublic
                      ? 'Submitted to admins before it appears in Explore.'
                      : 'Only people with your link can see it.'
                  }
                  value={isPublic}
                  onChange={setIsPublic}
                />
                <View style={styles.divider} />
                <ToggleRow
                  icon="location-outline"
                  label={hideLocation ? 'Hide exact location' : 'Show exact location'}
                  hint={
                    hideLocation
                      ? 'Confirmed guests unlock the address.'
                      : 'Everyone with access sees the address.'
                  }
                  value={hideLocation}
                  onChange={setHideLocation}
                />
                <View style={styles.divider} />
                <Counter
                  label="Maximum guests"
                  hint="Going guests and their +1s count."
                  value={maxGuests}
                  onChange={setMaxGuests}
                  min={2}
                  max={500}
                />
                <View style={styles.divider} />
                <Counter
                  label="Plus-ones per guest"
                  hint={plusOnes ? `Each guest can bring up to ${plusOnes}.` : 'Named guests only.'}
                  value={plusOnes}
                  onChange={setPlusOnes}
                  min={0}
                  max={10}
                />
                <View style={styles.divider} />
                <ToggleRow
                  icon="ticket-outline"
                  label={paid ? 'Paid tickets' : 'Free entry'}
                  hint={paid ? 'Show a ticket price on the invite.' : 'No ticket price.'}
                  value={paid}
                  onChange={setPaid}
                />
                {paid ? (
                  <View style={styles.priceWrap}>
                    <Text style={styles.currency}>€</Text>
                    <TextInput
                      value={price}
                      onChangeText={setPrice}
                      keyboardType="decimal-pad"
                      placeholder="25"
                      placeholderTextColor={colors.muted}
                      style={styles.priceInput}
                    />
                    <Text style={styles.priceSuffix}>per ticket</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.socialNote}>
                <View style={[styles.socialIcon, { backgroundColor: `${vibe.tint}30` }]}>
                  <Ionicons name="people-outline" size={22} color={colors.text} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.socialTitle}>Social by default</Text>
                  <Text style={styles.socialBody}>
                    Guests RSVP yes, maybe or no. You see the live guest list and mutual friends.
                  </Text>
                </View>
              </View>
            </>
          ) : null}

          {step === 'preview' ? (
            <>
              <View>
                <Text style={styles.stepTitle}>This is the invite.</Text>
                <Text style={styles.stepSubtitle}>One last look before your people see it.</Text>
              </View>
              <View style={styles.previewCard}>
                <View style={[styles.previewHero, { backgroundColor: vibe.tint }]}>
                  {image ? (
                    <>
                      <Image source={{ uri: image.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                      <View style={styles.previewScrim} />
                    </>
                  ) : (
                    <Text style={styles.previewEmoji}>{vibe.emoji}</Text>
                  )}
                  <View style={styles.previewPrivacy}>
                    <Ionicons
                      name={isPublic ? 'earth' : 'lock-closed'}
                      size={12}
                      color="#fff"
                    />
                    <Text style={styles.previewPrivacyText}>{isPublic ? 'Public' : 'Invite only'}</Text>
                  </View>
                </View>
                <View style={styles.previewBody}>
                  <Text style={styles.previewTitle}>{title.trim()}</Text>
                  <Text style={styles.previewMeta}>
                    {formatEventDate(date.toISOString())} · {formatEventTime(date.toISOString())}
                  </Text>
                  <Text style={styles.previewMeta} numberOfLines={2}>
                    📍 {hideLocation ? `${city || 'Location'} · revealed after RSVP` : location}
                  </Text>
                  <View style={styles.previewPills}>
                    <View style={styles.previewPill}>
                      <Text style={styles.previewPillText}>👥 {maxGuests} spots</Text>
                    </View>
                    <View style={styles.previewPill}>
                      <Text style={styles.previewPillText}>
                        {paid ? `🎟️ €${price}` : '✨ Free'}
                      </Text>
                    </View>
                    <View style={styles.previewPill}>
                      <Text style={styles.previewPillText}>+{plusOnes}</Text>
                    </View>
                  </View>
                  {description.trim() ? (
                    <Text style={styles.previewDescription} numberOfLines={4}>
                      {description.trim()}
                    </Text>
                  ) : null}
                  <View style={styles.rsvpPreview}>
                    <View style={[styles.rsvpButton, { backgroundColor: vibe.tint }]}>
                      <Text style={styles.rsvpButtonText}>I'm in</Text>
                    </View>
                    <View style={styles.rsvpButtonGhost}>
                      <Text style={styles.rsvpButtonGhostText}>Maybe</Text>
                    </View>
                    <View style={styles.rsvpButtonGhost}>
                      <Text style={styles.rsvpButtonGhostText}>Can't</Text>
                    </View>
                  </View>
                </View>
              </View>
            </>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          {currentIndex > 0 ? (
            <Pressable
              onPress={() => setStep(STEPS[currentIndex - 1].key)}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => {
              if (step === 'preview') publish();
              else if (canContinue) setStep(STEPS[currentIndex + 1].key);
            }}
            disabled={!canContinue || submitting}
            style={[
              styles.primaryButton,
              { flex: 1, backgroundColor: canContinue ? colors.ink : colors.inputBg },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color={colors.onInk} />
            ) : (
              <>
                <Text
                  style={[
                    styles.primaryButtonText,
                    !canContinue && { color: colors.muted },
                  ]}
                >
                  {step === 'preview' ? 'Publish event' : 'Continue'}
                </Text>
                <Ionicons
                  name={step === 'preview' ? 'sparkles' : 'arrow-forward'}
                  size={19}
                  color={canContinue ? colors.onInk : colors.muted}
                />
              </>
            )}
          </Pressable>
        </View>

        {dateOpen ? (
          <DateTimeSheet date={date} onChange={setDate} onClose={() => setDateOpen(false)} />
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default withScreenBackground(CreateEventScreen, { bloom: false });

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  eyebrow: { ...uiText(11, '700', { tracking: 0.12 }), color: colors.muted },
  headerTitle: { ...display(28), color: colors.text },
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
  progress: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  progressItem: { flex: 1, gap: 5 },
  progressLine: { height: 3, borderRadius: 2, backgroundColor: colors.inputBg },
  progressLabel: { ...uiText(10, '600'), color: colors.muted },
  progressLabelOn: { color: colors.text },
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.lg },
  stepTitle: { ...display(30), color: colors.text },
  stepSubtitle: { ...uiText(14), color: colors.muted, marginTop: 4 },
  vibeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  vibeCard: {
    width: '48.5%',
    minHeight: 128,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    padding: spacing.md,
    position: 'relative',
  },
  vibeEmoji: { fontSize: 28, marginBottom: 8 },
  vibeTitle: { ...uiText(15, '700'), color: colors.text },
  vibeDescription: { ...uiText(12), color: colors.muted, marginTop: 2 },
  selectedDot: {
    position: 'absolute',
    right: 10,
    top: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: { ...uiText(11, '700', { tracking: 0.1 }), color: colors.muted },
  titleInput: {
    ...display(24),
    color: colors.text,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
    paddingVertical: spacing.sm,
  },
  detailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
  },
  detailIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailValue: { ...uiText(15, '600'), color: colors.text, marginTop: 2 },
  locationWrap: {
    zIndex: 10,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  imagePicker: {
    height: 180,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  imageIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  imageTitle: { ...uiText(15, '700'), color: colors.text },
  imageHint: { ...uiText(12), color: colors.muted },
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
  changeImageText: { ...uiText(12, '700'), color: colors.onInk },
  descriptionInput: {
    ...uiText(15),
    minHeight: 130,
    marginTop: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    color: colors.text,
    padding: spacing.md,
  },
  settingsCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  controlIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlTitle: { ...uiText(15, '700'), color: colors.text },
  controlHint: { ...uiText(12), color: colors.muted, marginTop: 1 },
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
  priceWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  currency: { ...display(24), color: colors.text },
  priceInput: { ...display(24), color: colors.text, flex: 1, paddingVertical: 10 },
  priceSuffix: { ...uiText(12), color: colors.muted },
  socialNote: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  socialIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialTitle: { ...uiText(15, '700'), color: colors.text },
  socialBody: { ...uiText(13), color: colors.muted, marginTop: 2 },
  previewCard: {
    backgroundColor: '#F4F1EB',
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...shadow.float,
  },
  previewHero: { height: 180, alignItems: 'center', justifyContent: 'center' },
  previewScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.18)' },
  previewEmoji: { fontSize: 72 },
  previewPrivacy: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  previewPrivacyText: { ...uiText(11, '700'), color: '#fff' },
  previewBody: { padding: spacing.md },
  previewTitle: { ...display(28), color: '#171717' },
  previewMeta: { ...uiText(14, '600'), color: 'rgba(23,23,23,0.65)', marginTop: 3 },
  previewPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md },
  previewPill: {
    backgroundColor: 'rgba(23,23,23,0.08)',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  previewPillText: { ...uiText(12, '700'), color: '#171717' },
  previewDescription: {
    ...uiText(14, '400', { lineHeight: 1.5 }),
    color: 'rgba(23,23,23,0.75)',
    marginTop: spacing.md,
  },
  rsvpPreview: { flexDirection: 'row', gap: 6, marginTop: spacing.md },
  rsvpButton: {
    flex: 1,
    borderRadius: radius.pill,
    paddingVertical: 10,
    alignItems: 'center',
  },
  rsvpButtonText: { ...uiText(13, '700'), color: '#fff' },
  rsvpButtonGhost: {
    flex: 1,
    borderRadius: radius.pill,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(23,23,23,0.15)',
  },
  rsvpButtonGhostText: { ...uiText(13, '700'), color: '#171717' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: 'rgba(8,11,22,0.95)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
  },
  backButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
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
  primaryButtonText: { ...uiText(15, '700'), color: colors.onInk },
  secondaryButton: {
    minHeight: 50,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { ...uiText(15, '700'), color: colors.text },
  success: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
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
  successKicker: { ...uiText(12, '700', { tracking: 0.12 }), color: colors.muted },
  successTitle: { ...display(36), color: colors.text, textAlign: 'center', marginTop: 6 },
  successBody: {
    ...uiText(15, '400', { lineHeight: 1.5 }),
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
  quickShareText: { ...uiText(13, '700'), color: colors.text },
});
