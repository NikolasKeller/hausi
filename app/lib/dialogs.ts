import { Alert, Platform } from 'react-native';

// react-native-web ships Alert as an empty stub, so confirm dialogs and error
// alerts silently do nothing on web. These wrappers fall back to the browser's
// native dialogs there and keep Alert on iOS/Android.

export function confirmDialog(
  title: string,
  message: string,
  confirmLabel: string,
  cancelLabel = 'Cancel'
): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

export function notify(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n${message}`);
    return;
  }
  Alert.alert(title, message);
}
