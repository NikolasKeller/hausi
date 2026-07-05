import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { api } from './api';
import { notify } from './dialogs';

export interface PickedImage {
  uri: string;
  width: number;
  height: number;
}

export interface CropRect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

// Open the photo library and hand back the raw pick (no forced editing) so our
// own in-app cropper can run on every platform — the native editor is skipped
// on web and inconsistent across OSes. Returns null if the user cancels.
export async function pickRawImage(): Promise<PickedImage | null> {
  try {
    if (Platform.OS !== 'web') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        notify('Photos access needed', 'Allow photo access to add a cover image.');
        return null;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false, // we crop in-app so the flow is identical everywhere
      quality: 1,
    });
    if (result.canceled || !result.assets?.length) return null;

    const a = result.assets[0];
    return { uri: a.uri, width: a.width ?? 0, height: a.height ?? 0 };
  } catch (e) {
    notify('Couldn’t open photos', e instanceof Error ? e.message : 'Could not add that photo');
    return null;
  }
}

// Crop a picked photo to the region the user framed, normalize to a ~1280px
// JPEG so uploads stay small and consistent, upload it, and return the server
// path (e.g. "/uploads/x.jpg"). Returns null on failure. Works on native and
// web (expo-image-manipulator uses a canvas on web).
export async function uploadCroppedImage(uri: string, crop: CropRect): Promise<string | null> {
  try {
    const edited = await manipulateAsync(
      uri,
      [{ crop }, { resize: { width: 1280 } }],
      { compress: 0.7, format: SaveFormat.JPEG, base64: true }
    );
    if (!edited.base64) return null;

    const { url } = await api.uploadImage(edited.base64, 'image/jpeg');
    return url;
  } catch (e) {
    notify('Upload failed', e instanceof Error ? e.message : 'Could not save that photo');
    return null;
  }
}

// Grab a profile photo from the library or the camera, let the user crop it
// (the native editor shows a square crop UI; on web we center-crop instead,
// since the browser picker has no editor), then upload a small square JPEG.
// Returns the server path, or null if the user cancels.
export async function pickAvatarImage(source: 'library' | 'camera'): Promise<string | null> {
  try {
    if (Platform.OS !== 'web') {
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        notify(
          source === 'camera' ? 'Camera access needed' : 'Photos access needed',
          source === 'camera'
            ? 'Allow camera access to snap a profile pic.'
            : 'Allow photo access to pick a profile pic.'
        );
        return null;
      }
    }

    const options = {
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    } satisfies ImagePicker.ImagePickerOptions;
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets?.length) return null;

    // The crop editor already returns a square on native; anywhere it didn't
    // run (web, or a skipped edit) fall back to a center square crop so
    // avatars are always round-safe.
    const asset = result.assets[0];
    const side = Math.min(asset.width || 0, asset.height || 0);
    const needsCrop = side > 0 && asset.width !== asset.height;
    const edited = await manipulateAsync(
      asset.uri,
      [
        ...(needsCrop
          ? [
              {
                crop: {
                  originX: Math.floor(((asset.width || side) - side) / 2),
                  originY: Math.floor(((asset.height || side) - side) / 2),
                  width: side,
                  height: side,
                },
              },
            ]
          : []),
        { resize: { width: 512 } },
      ],
      { compress: 0.8, format: SaveFormat.JPEG, base64: true }
    );
    if (!edited.base64) return null;

    const { url } = await api.uploadImage(edited.base64, 'image/jpeg');
    return url;
  } catch (e) {
    notify('Upload failed', e instanceof Error ? e.message : 'Could not use that photo');
    return null;
  }
}
