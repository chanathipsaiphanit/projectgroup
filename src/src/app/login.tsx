import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Link, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = 'http://localhost:3092/api';

interface LoginUser {
  id: number;
  username: string;
  role: 'admin' | 'user';
}

interface LoginResponse {
  message: string;
  token: string;
  user: LoginUser;
}

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async () => {
    setError('');
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data: LoginResponse = await res.json();

      if (!res.ok) {
        setError(data.message || 'เข้าสู่ระบบไม่สำเร็จ');
        return;
      }

      await AsyncStorage.setItem('token', data.token);
      await AsyncStorage.setItem('role', data.user.role);
      await AsyncStorage.setItem('username', data.user.username);

      router.replace('/');
    } catch (err) {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>เข้าสู่ระบบ</Text>

      <Text>Username</Text>
      <TextInput style={styles.input} value={username} onChangeText={setUsername} autoCapitalize="none" />

      <Text>Password</Text>
      <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>เข้าสู่ระบบ</Text>
      </TouchableOpacity>

      <Link href="/register" style={styles.link}>
        ยังไม่มีบัญชี? สมัครสมาชิก
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 10, marginBottom: 12 },
  button: { backgroundColor: '#1976d2', padding: 12, borderRadius: 6, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  link: { marginTop: 16, color: '#1976d2', textAlign: 'center' },
  error: { color: 'red', marginBottom: 8 }
});
