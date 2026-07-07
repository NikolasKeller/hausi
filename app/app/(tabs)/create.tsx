import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing } from '../../lib/theme';
import { display, uiText } from '../../lib/fonts';
import { withScreenBackground } from '../../components/ScreenBackground';
import { EVENT_TEMPLATES, type EventTemplate } from '../../lib/eventTemplates';

export default withScreenBackground(CreateScreen);

function CreateScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.content}>
        <View style={styles.heading}>
          <Text style={styles.title}>
            Make something{'\n'}happen
          </Text>
        </View>

        <View style={styles.rows}>
          <Pressable
            onPress={() => router.push('/new-event')}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={styles.rowIcon}>
              <Ionicons name="add" size={24} color={colors.accent} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>New event</Text>
              <Text style={styles.rowSubtitle}>Collect RSVPs</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Pressable>
        </View>

        <View style={styles.sectionGroup}>
          <Text style={styles.sectionTitle}>Party starters</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            style={styles.horizontalScroll}
          >
            {EVENT_TEMPLATES.map((template) => (
              <TemplateCard key={template.id} template={template} />
            ))}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

function TemplateCard({ template }: { template: EventTemplate }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/new-event', params: { template: template.id } })}
      style={({ pressed }) => [styles.templateCard, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.templateCover}>
        <Text style={styles.templateEmoji}>{template.emoji}</Text>
      </View>
      <View style={styles.templateBody}>
        <Text style={styles.templateName} numberOfLines={1}>
          {template.name}
        </Text>
        <Text style={styles.templateVibe} numberOfLines={2}>
          {template.vibe}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.xl,
    paddingBottom: spacing.xl * 2,
  },
  heading: {
    gap: spacing.md,
  },
  title: {
    ...display(52),
    color: colors.text,
  },
  rows: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    padding: spacing.lg,
    ...shadow.card,
  },
  pressed: {
    opacity: 0.75,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...display(22),
    color: colors.text,
  },
  rowSubtitle: {
    ...uiText(14),
    color: colors.muted,
  },
  sectionGroup: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...display(30),
    color: colors.text,
  },
  horizontalScroll: {
    marginHorizontal: -spacing.lg,
  },
  horizontalList: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  templateCard: {
    width: 172,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    ...shadow.card,
  },
  templateCover: {
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inputBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  templateEmoji: {
    fontSize: 46,
  },
  templateBody: {
    padding: spacing.sm,
    gap: 2,
    minHeight: 96,
  },
  templateName: {
    ...display(16),
    color: colors.text,
  },
  templateVibe: {
    ...uiText(12),
    color: colors.muted,
    flex: 1,
  },
});
