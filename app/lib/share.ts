import { Platform, Share } from 'react-native';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import { notify } from './dialogs';

// Native share sheet; on web the Web Share API with a clipboard fallback
// (react-native-web's Share.share rejects on browsers without navigator.share,
// i.e. most desktops).
export async function shareText(message: string, url?: string) {
  if (Platform.OS === 'web') {
    const nav = (globalThis as any).navigator;
    // Try the native share sheet first (mobile browsers / some desktops).
    if (nav?.share) {
      try {
        await nav.share(url ? { text: message, url } : { text: message });
        return;
      } catch (e: any) {
        // User dismissed the sheet — done. Anything else (unsupported in this
        // browser, insecure context, embedded webview) → fall back to copy.
        if (e?.name === 'AbortError') return;
      }
    }
    // Fallback: copy the link so pressing the button always does *something*.
    try {
      await nav?.clipboard?.writeText(url ?? message);
      notify('Link copied', url ?? message);
    } catch {
      notify('Copy this link', url ?? message);
    }
    return;
  }
  try {
    await Share.share({ message });
  } catch {
    // Share sheet dismissed — nothing to report.
  }
}

// Open the Messages app straight to a draft to `phone`, with the invite body
// pre-filled, so the host fires off the +1 invite with a single tap. (iOS/
// Android can't send an SMS silently, by design — the user still taps Send.)
// iOS and Android disagree on the sms: separator (& vs ?); web has no Messages
// app, so fall back to the share sheet there.
export async function textInvite(phone: string, message: string, url?: string) {
  if (Platform.OS === 'web') {
    await shareText(message, url);
    return;
  }
  const to = phone.replace(/[^\d+]/g, '');
  const sep = Platform.OS === 'ios' ? '&' : '?';
  const smsUrl = `sms:${to}${sep}body=${encodeURIComponent(message)}`;
  try {
    await Linking.openURL(smsUrl);
  } catch {
    // No Messages app or the OS refused the scheme — hand over the share sheet.
    await shareText(message, url).catch(() => {});
  }
}

// Copy a link to the clipboard (expo-clipboard works on web too). Falls back to
// the share sheet if the clipboard is unavailable (e.g. an insecure context).
export async function copyLink(url: string) {
  try {
    await Clipboard.setStringAsync(url);
    notify('Link copied', url);
  } catch {
    await shareText(url, url);
  }
}
