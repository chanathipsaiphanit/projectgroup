import { AuthProvider } from '@/context/auth-context';
import { Stack } from 'expo-router';

export default function RootLayout() {
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
