import React from 'react';
import { Stack } from 'expo-router';
import { light } from '../../lib/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: light.bg },
      }}
    />
  );
}
