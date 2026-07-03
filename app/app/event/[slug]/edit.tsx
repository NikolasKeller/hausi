import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import type { EventDetail } from '../../../shared/types';
import { api } from '../../../lib/api';
import { colors, spacing } from '../../../lib/theme';
import { EventForm } from '../../../components/EventForm';

export default function EditEventScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!slug || event) return;
      api
        .eventBySlug(slug)
        .then((res) => setEvent(res.event))
        .catch((e) => setError(e instanceof Error ? e.message : 'Could not load event'));
    }, [slug, event])
  );

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <EventForm
      submitLabel="Save changes"
      initial={{
        title: event.title,
        description: event.description,
        location: event.location,
        coverTheme: event.coverTheme,
        date: new Date(event.date),
        maxGuests: event.maxGuests,
      }}
      onSubmit={async (data) => {
        await api.updateEvent(event.id, data);
        router.back();
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  errorText: {
    color: colors.danger,
    fontSize: 16,
    textAlign: 'center',
  },
});
