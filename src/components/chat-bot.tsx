// Floating ✦ button (bottom-right) that opens the chat page.
// Hidden on the chat page itself and on login / register.
import { useRouter, usePathname } from 'expo-router';
import { Platform, StyleSheet, Text, TouchableOpacity } from 'react-native';

const HIDDEN = ['/chatbot', '/login', '/register'];

export default function ChatBot() {
  const router = useRouter();
  const pathname = usePathname();
  if (HIDDEN.includes(pathname)) return null;

  return (
    <TouchableOpacity style={styles.fab} onPress={() => router.push('/chatbot')} accessibilityLabel="ผู้ช่วยหารถ">
      <Text style={styles.icon}>✦</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: (Platform.OS === 'web' ? 'fixed' : 'absolute') as any,
    right: 24,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E4001B',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  icon: { color: '#fff', fontSize: 26, fontWeight: '700' },
});
