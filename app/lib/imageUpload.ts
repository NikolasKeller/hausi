import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { api } from './api';
import { notify } from './dialogs';

// Pick a photo, downscale + compress it to a small JPEG, upload it, and return
// the server path (e.g. "/uploads/x.jpg"). Returns null if the user cancels.
// Works on native (photo library) and web (file picker).
export async function pickCoverImage(): Promise<string | null> {
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
      allowsEditing: true,
      aspect: [16, 10],
      quality: 1,
    });
    if (result.canceled || !result.assets?.length) return null;

    // Normalize to a ~1280px-wide JPEG so uploads stay small and consistent.
    const edited = await manipulateAsync(
      result.assets[0].uri,
      [{ resize: { width: 1280 } }],
      { compress: 0.7, format: SaveFormat.JPEG, base64: true }
    );
    if (!edited.base64) return null;

    const { url } = await api.uploadImage(edited.base64, 'image/jpeg');
    return url;
  } catch (e) {
    notify('Upload failed', e instanceof Error ? e.message : 'Could not add that photo');
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
