import { AuthProvider } from '@/context/auth-context';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

export default function RootLayout() {
  // Same guard as +html.tsx, applied at runtime too: Chrome's translate
  // bar rewrites text nodes and crashes React ("removeChild") on web.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.documentElement.setAttribute('translate', 'no');
    document.documentElement.classList.add('notranslate');
    if (!document.querySelector('meta[name="google"]')) {
      const meta = document.createElement('meta');
      meta.name = 'google';
      meta.content = 'notranslate';
      document.head.appendChild(meta);
    }
  }, []);

  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="index" />
        <Stack.Screen name="add" />
        <Stack.Screen name="details" />
        <Stack.Screen name="edit" />
        <Stack.Screen name="inbox" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="ai-advisor" />
        <Stack.Screen name="compare" />
      </Stack>
    </AuthProvider>
  );
}
