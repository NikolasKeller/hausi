import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

// Invite deep link target: iykyk://e/<slug> → event page.
export default function InviteRedirect() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <Redirect href={`/event/${slug}`} />;
}
