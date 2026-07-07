import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../lib/api';
import { EventForm, type EventFormValues } from '../components/EventForm';
import { getEventTemplate } from '../lib/eventTemplates';
import { EventCreatedCelebration } from '../components/EventCreatedCelebration';

export default function CreateEventScreen() {
  const router = useRouter();
  // Slug of the just-created event: set on a successful *create* to play the
  // celebration overlay, then used to navigate once it finishes. Stays null on
  // the edit flow, so the animation only ever fires for brand-new events.
  const [createdSlug, setCreatedSlug] = React.useState<string | null>(null);
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
    <>
      <EventForm
        initial={initial}
        submitLabel="Create event 🎉"
        onSubmit={async (data) => {
          const res = await api.createEvent(data);
          // Trigger the success celebration and hold the form in its saving
          // state under the overlay; navigation happens when it finishes. The
          // never-resolving promise keeps the submit button locked so the
          // create can't be double-fired behind the animation.
          setCreatedSlug(res.event.slug);
          await new Promise<never>(() => {});
        }}
      />
      {createdSlug ? (
        <EventCreatedCelebration
          onDone={() => router.replace(`/event/${createdSlug}`)}
        />
      ) : null}
    </>
  );
}
