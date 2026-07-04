import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

// Shared-card deep link target: hausi://c/<id> → card viewer.
export default function CardRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/card/${id}`} />;
}
