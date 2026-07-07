import { Platform } from 'react-native';

export interface LocatedCity {
  city: string;
  // Human-readable context shown under the city, e.g. "Bavaria, Germany".
  region: string | null;
}

// All failures from locateCity() carry a user-presentable message.
export class LocateError extends Error {}

const LOCATE_TIMEOUT_MS = 8000;

// A cached fix from the last ~10 min is plenty for city-level detection and
// returns instantly, so try it before firing up the GPS.
const LAST_KNOWN_MAX_AGE_MS = 10 * 60 * 1000;

// Browser geolocation prompts can pend forever when dismissed (not denied),
// which would otherwise leave callers stuck in a loading state.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new LocateError('Took too long to find you - try again')),
      ms
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

// Loaded lazily so a native build without the expo-location module still
// renders screens that import this file; the failure surfaces on tap instead.
async function getLocationModule() {
  try {
    return await import('expo-location');
  } catch {
    throw new LocateError('Location is not available in this build');
  }
}

export async function hasLocationPermission(): Promise<boolean> {
  // On web, query the browser Permissions API directly — the expo-location web
  // shim can stall, which would hang the Explore first-load that awaits this.
  if (Platform.OS === 'web') {
    try {
      const perms = (globalThis as any).navigator?.permissions;
      if (perms?.query) {
        const status = await perms.query({ name: 'geolocation' });
        return status.state === 'granted';
      }
    } catch {
      // Permissions API unsupported — treat as not-yet-granted.
    }
    return false;
  }
  try {
    const Location = await getLocationModule();
    return (await Location.getForegroundPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

export async function locateCity(): Promise<LocatedCity> {
  try {
    return await withTimeout(doLocate(), LOCATE_TIMEOUT_MS);
  } catch (e) {
    throw e instanceof LocateError ? e : new LocateError('Could not find your location');
  }
}

// Web: use the browser Geolocation API directly. expo-location's web shim is
// unreliable — its permission flow can hang and never resolve — whereas the
// native API gives us a real timeout and honors a cached fix.
function locateCoordsWeb(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    const geo = (globalThis as any).navigator?.geolocation;
    if (!geo) {
      reject(new LocateError('Location is not available in this browser'));
      return;
    }
    geo.getCurrentPosition(
      (p: any) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      (err: any) =>
        reject(
          err && err.code === 1 // 1 = PERMISSION_DENIED
            ? new LocateError('Location is off - allow it in your browser')
            : new LocateError('Could not find your location')
        ),
      { enableHighAccuracy: false, timeout: LOCATE_TIMEOUT_MS, maximumAge: LAST_KNOWN_MAX_AGE_MS }
    );
  });
}

async function locateCoordsNative(): Promise<{ latitude: number; longitude: number }> {
  const Location = await getLocationModule();
  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) {
    throw perm.status === Location.PermissionStatus.DENIED
      ? new LocateError('Location is off - enable it in Settings')
      : new LocateError('Could not find your location');
  }
  // A recent cached fix is instant and plenty for city-level detection.
  try {
    const last = await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS });
    if (last) return { latitude: last.coords.latitude, longitude: last.coords.longitude };
  } catch {
    // No cached fix — fall through to a live, low-accuracy lookup.
  }
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
  return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
}

async function doLocate(): Promise<LocatedCity> {
  const { latitude, longitude } =
    Platform.OS === 'web' ? await locateCoordsWeb() : await locateCoordsNative();

  if (Platform.OS !== 'web') {
    try {
      const Location = await getLocationModule();
      const [first] = await Location.reverseGeocodeAsync({ latitude, longitude });
      const city = first?.city ?? first?.subregion ?? first?.region;
      if (city) {
        const region = [first.region, first.country].filter(Boolean).join(', ');
        return { city, region: region || null };
      }
    } catch {
      // Fall through to the HTTP geocoder below.
    }
  }

  // Key-free reverse geocoder with CORS support; also the web path, where
  // Location.reverseGeocodeAsync is unavailable.
  const res = await fetch(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
  );
  if (!res.ok) throw new LocateError('Could not look up your city');
  const data = (await res.json()) as {
    city?: string;
    locality?: string;
    principalSubdivision?: string;
    countryName?: string;
  };
  const city = data.city || data.locality || data.principalSubdivision;
  if (!city) throw new LocateError('Could not look up your city');
  const region = [data.principalSubdivision, data.countryName]
    .filter((part): part is string => Boolean(part && part !== city))
    .join(', ');
  return { city, region: region || null };
}
