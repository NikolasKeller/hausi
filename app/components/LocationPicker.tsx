import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow } from '../lib/theme';
import { kicker, uiText } from '../lib/fonts';
import { searchAddresses, type AddressResult } from '../lib/geocoding';

interface Props {
  // The committed location string (full address).
  value: string;
  // The derived city (kept alongside the address for Explore grouping).
  city: string;
  onChange: (location: string, city: string) => void;
  label?: string;
  labelColor?: string;
}

// A single search-and-select Location field: type a street/venue and pick a
// real address from the live geocoder. The committed value only changes when a
// result is tapped, and each pick also fills the derived city so Explore keeps
// grouping by real, on-the-map cities without a separate field.
export function LocationPicker({ value, city, onChange, label, labelColor }: Props) {
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AddressResult[]>([]);
  const [loading, setLoading] = useState(false);
  // True once a query has resolved — gates the "no matches" message so it
  // doesn't flash before the first search returns.
  const [searched, setSearched] = useState(false);
  // Distinguishes a network/geocoder failure from a genuine no-results, so an
  // outage doesn't misleadingly read as "no address by that name".
  const [errored, setErrored] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const blurRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (blurRef.current) clearTimeout(blurRef.current);
      abortRef.current?.abort();
    },
    []
  );

  function runSearch(text: string) {
    const q = text.trim();
    setSearched(false);
    setErrored(false);
    // Clear stale results immediately so a previous query's addresses never
    // linger under the spinner while a new query is in flight.
    setResults([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();
    if (q.length < 3) {
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      searchAddresses(q, ctrl.signal)
        .then((found) => {
          if (ctrl.signal.aborted) return;
          setResults(found);
          setSearched(true);
          setLoading(false);
        })
        .catch(() => {
          if (ctrl.signal.aborted) return;
          setResults([]);
          setErrored(true);
          setSearched(true);
          setLoading(false);
        });
    }, 300);
  }

  function beginEdit() {
    setEditing(true);
    setQuery('');
    setResults([]);
    setSearched(false);
    setErrored(false);
  }

  function select(r: AddressResult) {
    if (blurRef.current) clearTimeout(blurRef.current);
    onChange(r.location, r.city ?? '');
    setEditing(false);
    setQuery('');
    setResults([]);
    setSearched(false);
    Keyboard.dismiss();
  }

  function clear() {
    onChange('', '');
    beginEdit();
  }

  const showResults = editing && query.trim().length >= 3;

  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Text style={[styles.label, labelColor ? { color: labelColor } : null]}>{label}</Text>
      ) : null}
      <View style={styles.card}>
        <View style={styles.row}>
          <Ionicons name="location-outline" size={18} color={colors.muted} />
          {editing ? (
            <TextInput
              value={query}
              onChangeText={(t) => {
                setQuery(t);
                runSearch(t);
              }}
              placeholder="Search an address or place…"
              placeholderTextColor={colors.muted}
              style={styles.input}
              autoFocus
              autoCorrect={false}
              returnKeyType="search"
              // The search key commits the top real result (never free text).
              onSubmitEditing={() => {
                if (!loading && results[0]) select(results[0]);
              }}
              // Defer collapsing so a tap on a result row registers first.
              onBlur={() => {
                blurRef.current = setTimeout(() => setEditing(false), 150);
              }}
            />
          ) : (
            <Pressable style={styles.input} onPress={beginEdit}>
              <Text style={[styles.valueText, !value && styles.placeholder]} numberOfLines={1}>
                {value || 'Search an address or place…'}
              </Text>
            </Pressable>
          )}
          {loading ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : value && !editing ? (
            <Pressable onPress={clear} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>

        {showResults ? (
          <View style={styles.results}>
            {results.map((r, index) => (
              <Pressable
                key={r.id}
                // Cancel the pending blur-collapse on touch-down so the row
                // stays mounted through the press — a slow/long tap still lands
                // on onPress instead of the results vanishing mid-gesture.
                onPressIn={() => {
                  if (blurRef.current) clearTimeout(blurRef.current);
                }}
                onPress={() => select(r)}
                style={[styles.resultRow, index < results.length - 1 && styles.resultBorder]}
              >
                <Text style={styles.resultTitle} numberOfLines={1}>
                  📍 {r.title}
                </Text>
                {r.subtitle ? (
                  <Text style={styles.resultSubtitle} numberOfLines={1}>
                    {r.subtitle}
                  </Text>
                ) : null}
              </Pressable>
            ))}
            {!loading && errored ? (
              <Text style={styles.noMatch}>Couldn’t reach address search - try again</Text>
            ) : !loading && searched && results.length === 0 ? (
              <Text style={styles.noMatch}>No address by that name - check the spelling</Text>
            ) : null}
            {results.length > 0 ? (
              <Text style={styles.attribution}>Addresses © OpenStreetMap</Text>
            ) : null}
          </View>
        ) : null}
      </View>
      {!editing && value && city ? (
        <Text style={styles.cityHint}>City: {city}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    ...kicker(colors.muted),
  },
  card: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    ...shadow.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    // Full line box (+ headroom) so the placeholder isn't clipped on web.
    lineHeight: 22,
    minHeight: 24,
    paddingVertical: 0,
  },
  valueText: {
    ...uiText(16),
    color: colors.text,
  },
  placeholder: {
    color: colors.muted,
  },
  results: {
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  resultRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 2,
  },
  resultBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  resultTitle: {
    ...uiText(15, '600'),
    color: colors.text,
  },
  resultSubtitle: {
    ...uiText(13),
    color: colors.muted,
  },
  noMatch: {
    ...uiText(14),
    color: colors.muted,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  attribution: {
    ...uiText(11),
    color: colors.muted,
    paddingHorizontal: 16,
    paddingVertical: 8,
    textAlign: 'right',
  },
  cityHint: {
    ...uiText(12),
    color: colors.muted,
    paddingHorizontal: 4,
  },
});
