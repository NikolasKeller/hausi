import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../lib/theme';
import { GlassTabBar } from '../../components/GlassTabBar';

// Each tab screen paints its own opaque backdrop (see withScreenBackground), so
// the sceneStyle stays opaque here too: on web the navigator stacks every
// mounted tab and only a solid scene keeps blurred tabs from bleeding through.
// Explore — labeled "Iykyk" — is the app's main page and initial route; the
// old home feed is gone ("index" only survives as a hidden "/" redirect).
export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="explore"
      tabBar={(props) => <GlassTabBar {...(props as any)} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Iykyk',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'earth' : 'earth-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={22} color={color} />
          ),
        }}
      />
      {/* Hidden "/" redirect — never shown in the bar. */}
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'person-circle' : 'person-circle-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
