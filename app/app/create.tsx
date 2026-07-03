import React from 'react';
import { useRouter } from 'expo-router';
import { api } from '../lib/api';
import { EventForm } from '../components/EventForm';

export default function CreateEventScreen() {
  const router = useRouter();

  return (
    <EventForm
      submitLabel="Create event 🎉"
      onSubmit={async (data) => {
        const res = await api.createEvent(data);
        router.replace(`/event/${res.event.slug}`);
      }}
    />
  );
}
