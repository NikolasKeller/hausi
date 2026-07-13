import { Image } from 'react-native';
import { api, mediaUrl } from './api';
import type { ExploreEvent, HomeFeed } from '../shared/types';

type ExploreResponse = { events: ExploreEvent[]; cities: string[] };

// Started once by the launch intro so the Explore tab opens fully drawn: the
// same two requests its first load makes, plus warming the image cache for
// the covers so cards don't pop into existence one photo at a time.
let homePromise: Promise<HomeFeed | null> | null = null;
let explorePromise: Promise<ExploreResponse> | null = null;

// How many covers to warm. The first screens of the feed matter; anything
// further down has scroll time to load normally.
const COVER_WARM_LIMIT = 24;

export function startExplorePrefetch(): Promise<void> {
  if (!explorePromise) {
    homePromise = api.home().catch(() => null);
    explorePromise = api.explore();
  }
  return explorePromise
    .then(async (res) => {
      const covers = res.events
        .map((e) => mediaUrl(e.coverImage))
        .filter((u): u is string => !!u)
        .slice(0, COVER_WARM_LIMIT);
      await Promise.allSettled(covers.map((u) => Image.prefetch(u)));
    })
    .catch(() => {});
}

// One-shot consumers for the Explore screen's first load. Each returns the
// in-flight promise once (so the screen reuses the request instead of firing
// a duplicate), then clears — later loads always fetch fresh.
export function takePrefetchedHome(): Promise<HomeFeed | null> | null {
  const p = homePromise;
  homePromise = null;
  return p;
}

export function takePrefetchedExplore(): Promise<ExploreResponse> | null {
  const p = explorePromise;
  explorePromise = null;
  return p;
}
