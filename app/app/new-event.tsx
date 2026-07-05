import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../lib/api';
import { EventForm, type EventFormValues } from '../components/EventForm';
import { getEventTemplate } from '../lib/eventTemplates';

export default function CreateEventScreen() {
  const router = useRouter();
  // When launched from a Home-tab "party starter", pre-fill the form from that
  // template. Copy/style fields are seeded, plus dress code & cost — those two
  // live in the form's Settings sheet (the gear flags them with a dot). Date
  // and the remaining logistics stay default.
  const { template } = useLocalSearchParams<{ template?: string }>();
  const tpl = template ? getEventTemplate(template) : undefined;
  const initial: Partial<EventFormValues> | undefined = tpl
    ? {
        title: tpl.title,
        description: tpl.description,
        category: tpl.category,
        coverTheme: tpl.coverTheme,
        titleFont: tpl.titleFont,
        effect: tpl.effect,
        dressCode: tpl.dressCode ?? '',
        costPerPerson: tpl.costPerPerson ?? '',
      }
    : undefined;

  return (
    <EventForm
      initial={initial}
      submitLabel="Create event 🎉"
      onSubmit={async (data) => {
        const res = await api.createEvent(data);
        router.replace(`/event/${res.event.slug}`);
      }}
    />
  );
}
