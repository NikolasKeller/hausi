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
