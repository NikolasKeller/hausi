import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
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
  // Mirrors `query` for the deferred blur handler, which must read the value
  // at fire time rather than the render it was created in.
  const queryRef = useRef('');
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
    queryRef.current = '';
    setResults([]);
    setSearched(false);
    setErrored(false);
  }

  function select(r: AddressResult) {
    if (blurRef.current) clearTimeout(blurRef.current);
    onChange(r.location, r.city ?? '');
    setEditing(false);
    setQuery('');
    queryRef.current = '';
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
    // zIndex lifts the suggestion overlay above the fields that follow in the
    // form, so opening it never pushes the layout around.
    <View style={[{ gap: 6 }, showResults && styles.raised]}>
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
                queryRef.current = t;
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
              // Keep the search open while a query is typed: keyboard shuffles
              // (insets, viewport pans) fire spurious blurs on phones and used
              // to throw people out mid-word. With text in the field the edit
              // mode only ends by picking a result or clearing; an empty field
              // still collapses after a moment, so a stray tap backs out.
              onBlur={() => {
                blurRef.current = setTimeout(() => {
                  if (!queryRef.current.trim()) setEditing(false);
                }, 150);
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
          ) : editing && query ? (
            <Pressable
              onPress={() => {
                if (blurRef.current) clearTimeout(blurRef.current);
                setQuery('');
                queryRef.current = '';
                setResults([]);
                setSearched(false);
                setEditing(false);
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Cancel search"
            >
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          ) : value && !editing ? (
            <Pressable onPress={clear} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>

        {showResults ? (
          // Absolutely positioned dropdown: the field itself keeps its exact
          // size while suggestions float on top of whatever is below.
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
  raised: {
    zIndex: 30,
    ...(Platform.OS === 'android' ? { elevation: 30 } : null),
  },
  results: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    overflow: 'hidden',
    maxHeight: 280,
    zIndex: 30,
    ...shadow.float,
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
