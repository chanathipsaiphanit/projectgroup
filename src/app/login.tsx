import { api } from '@/config';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      alert('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(api('/api/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });
      const data = await response.json();

      if (response.ok && data.success) {
        // id is needed to know which listings/chats belong to this user
        login({
          id: data.user.id,
          username: data.user.username,
          role: data.user.role,
          token: data.token,
        });

        if (Platform.OS === 'web') {
          window.alert(`ยินดีต้อนรับ ${data.user.username} (${({ user: 'ผู้ซื้อ', seller: 'ผู้ขาย', admin: 'แอดมิน' } as Record<string, string>)[data.user.role] ?? data.user.role})`);
        }

        router.replace('/');
      } else {
        alert(data.error || 'เข้าสู่ระบบไม่สำเร็จ');
      }
    } catch (err) {
      console.error(err);
      alert('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.brandTitle}>Noon Home Car</Text>
        <View style={styles.brandAccent} />
        <Text style={styles.subtitle}>ตลาดรถมือสอง · เข้าสู่ระบบ (Sign In)</Text>

        <TextInput
          style={styles.input}
          placeholder="ชื่อผู้ใช้"
          placeholderTextColor="#888"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          editable={!loading}
        />
        <TextInput
          style={styles.input}
          placeholder="รหัสผ่าน"
          placeholderTextColor="#888"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          editable={!loading}
          onSubmitEditing={handleLogin}
        />

        <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.loginBtnText}>เข้าสู่ระบบ</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.registerLink} onPress={() => router.push('/register')}>
          <Text style={styles.registerLinkText}>ยังไม่มีบัญชี? สมัครสมาชิก</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.registerLink} onPress={() => router.replace('/')}>
          <Text style={styles.registerLinkText}>ดูรถโดยไม่ต้องเข้าสู่ระบบ</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#0A0A0A' },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, width: '100%', maxWidth: 460, alignSelf: 'center' },
  brandTitle: { fontSize: 32, fontWeight: '900', color: '#fff', textAlign: 'center', letterSpacing: 2, marginBottom: 8 },
  brandAccent: { width: 40, height: 3, backgroundColor: '#E4001B', alignSelf: 'center', marginBottom: 16, borderRadius: 2 },
  subtitle: { fontSize: 14, color: '#999', textAlign: 'center', marginBottom: 32 },
  input: {
    backgroundColor: '#1A1A1A',
    color: '#fff',
    padding: 14,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  loginBtn: {
    backgroundColor: '#E4001B',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  loginBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  registerLink: { padding: 10, alignItems: 'center', marginTop: 8 },
  registerLinkText: { color: '#999', fontSize: 14 }
});
