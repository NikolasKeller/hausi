import { Platform } from 'react-native';

export interface LocatedCity {
  city: string;
  // Human-readable context shown under the city, e.g. "Bavaria, Germany".
  region: string | null;
}

// All failures from locateCity() carry a user-presentable message.
export class LocateError extends Error {}

const LOCATE_TIMEOUT_MS = 15000;

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

async function doLocate(): Promise<LocatedCity> {
  const Location = await getLocationModule();
  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) {
    // The web shim reports granted:false with a non-denied status when the
    // position lookup itself failed — only a real deny gets the permission copy.
    throw perm.status === Location.PermissionStatus.DENIED
      ? new LocateError('Location is off - enable it in Settings')
      : new LocateError('Could not find your location');
  }
  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  const { latitude, longitude } = pos.coords;

  if (Platform.OS !== 'web') {
    try {
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
