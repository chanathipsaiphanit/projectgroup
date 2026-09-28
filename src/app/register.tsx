import { api } from '@/config';
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

export default function RegisterScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!username.trim() || !email.trim() || !password || !confirmPassword) {
      alert('Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(api('/api/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), email: email.trim(), password })
      });
      const data = await response.json();

      if (response.ok) {
        if (Platform.OS === 'web') {
          window.alert('Registration successful! Please sign in.');
        } else {
          alert('Registration successful! Please sign in.');
        }
        router.replace('/login');
      } else {
        alert(data.error || 'Registration failed');
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
        <Text style={styles.subtitle}>Create a new account</Text>

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
          placeholder="Email"
          placeholderTextColor="#888"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
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
        <TextInput
          style={styles.input}
          placeholder="Confirm Password"
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
            <Text style={styles.registerBtnText}>Sign Up</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/login')}>
          <Text style={styles.backText}>Already have an account? Sign In</Text>
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
