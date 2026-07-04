import { Platform, Share } from 'react-native';
import { notify } from './dialogs';

// Native share sheet; on web the Web Share API with a clipboard fallback
// (react-native-web's Share.share rejects on browsers without navigator.share,
// i.e. most desktops).
export async function shareText(message: string, url?: string) {
  try {
    if (Platform.OS === 'web') {
      if (navigator.share) {
        await navigator.share(url ? { text: message, url } : { text: message });
      } else {
        await navigator.clipboard.writeText(url ?? message);
        notify('Copied to clipboard', url ?? message);
      }
    } else {
      await Share.share({ message });
    }
  } catch {
    // Share sheet dismissed or clipboard blocked — nothing to report.
  }
}
