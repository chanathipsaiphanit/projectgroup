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
      alert('Please fill in all fields');
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
        // Store the session in AuthContext — this is what index/add/edit
        // read from to know who's logged in and what token to send.
        login({
          username: data.user.username,
          role: data.user.role,
          token: data.token,
        });

        if (Platform.OS === 'web') {
          window.alert(`Welcome back, ${data.user.username} (${data.user.role})`);
        }

        router.replace('/');
      } else {
        alert(data.error || 'Login failed');
      }
    } catch (err) {
      console.error(err);
      alert('Cannot connect to server');
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
        <Text style={styles.subtitle}>Sign in with your account</Text>

        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor="#888"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          editable={!loading}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#888"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          editable={!loading}
        />

        <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.loginBtnText}>Sign In</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.registerLink} onPress={() => router.push('/register')}>
          <Text style={styles.registerLinkText}>Don't have an account? Sign Up</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#0A0A0A' },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
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
  registerLink: { padding: 12, alignItems: 'center', marginTop: 16 },
  registerLinkText: { color: '#999', fontSize: 14 }
});
