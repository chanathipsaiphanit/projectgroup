import { api } from '@/config';
import { useLocalSearchParams, useRouter } from 'expo-router';
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

const ACCOUNT_TYPES = [
  { role: 'user', title: 'ผู้ซื้อ (Buyer)', desc: 'ดูรถ เปรียบเทียบ และติดต่อผู้ขาย' },
  { role: 'seller', title: 'ผู้ขาย (Seller)', desc: 'ลงขายรถมือสองของคุณ' },
] as const;

export default function RegisterScreen() {
  const router = useRouter();
  // "Sell a car" on the home screen links here with ?role=seller
  const params = useLocalSearchParams<{ role?: string }>();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'user' | 'seller'>(params.role === 'seller' ? 'seller' : 'user');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!username.trim() || !email.trim() || !password || !confirmPassword) {
      alert('กรุณากรอกข้อมูลให้ครบทุกช่อง');
      return;
    }
    if (password !== confirmPassword) {
      alert('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(api('/api/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), email: email.trim(), password, role })
      });
      const data = await response.json();

      if (response.ok) {
        if (Platform.OS === 'web') {
          window.alert('สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบ');
        } else {
          alert('สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบ');
        }
        router.replace('/login');
      } else {
        alert(data.error || 'สมัครสมาชิกไม่สำเร็จ');
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
        <Text style={styles.subtitle}>สมัครสมาชิกใหม่ (Sign Up)</Text>

        <Text style={styles.label}>ฉันต้องการเป็น…</Text>
        <View style={styles.roleRow}>
          {ACCOUNT_TYPES.map((t) => {
            const active = role === t.role;
            return (
              <TouchableOpacity
                key={t.role}
                style={[styles.roleCard, active && styles.roleCardActive]}
                onPress={() => setRole(t.role)}
                disabled={loading}
              >
                <Text style={[styles.roleTitle, active && styles.roleTitleActive]}>{t.title}</Text>
                <Text style={styles.roleDesc}>{t.desc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

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
          placeholder="อีเมล"
          placeholderTextColor="#888"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
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
        />
        <TextInput
          style={styles.input}
          placeholder="ยืนยันรหัสผ่าน"
          placeholderTextColor="#888"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          editable={!loading}
        />

        <TouchableOpacity style={styles.registerBtn} onPress={handleRegister} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.registerBtnText}>{`สมัครเป็น${role === 'seller' ? 'ผู้ขาย' : 'ผู้ซื้อ'}`}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/login')}>
          <Text style={styles.backText}>มีบัญชีอยู่แล้ว? เข้าสู่ระบบ</Text>
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
  subtitle: { fontSize: 14, color: '#999', textAlign: 'center', marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '700', color: '#999', marginBottom: 8 },
  roleRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  roleCard: { flex: 1, padding: 14, borderRadius: 8, borderWidth: 1, borderColor: '#2A2A2A', backgroundColor: '#1A1A1A' },
  roleCardActive: { borderColor: '#E4001B', backgroundColor: '#1F0A0C' },
  roleTitle: { color: '#D0D0D0', fontWeight: '800', fontSize: 15, marginBottom: 4 },
  roleTitleActive: { color: '#fff' },
  roleDesc: { color: '#8A8A8A', fontSize: 12 },
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
  registerBtn: {
    backgroundColor: '#E4001B',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  registerBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  backBtn: { padding: 10, alignItems: 'center' },
  backText: { color: '#999', fontSize: 14 }
});
