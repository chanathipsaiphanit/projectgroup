import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Link, useRouter } from 'expo-router';

const API_BASE = 'http://localhost:3092/api';

interface RegisterResponse {
  message: string;
  userId?: number;
}

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  const handleSubmit = async () => {
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });
      const data: RegisterResponse = await res.json();

      if (!res.ok) {
        setError(data.message || 'สมัครสมาชิกไม่สำเร็จ');
        return;
      }

      setSuccess('สมัครสมาชิกสำเร็จ กำลังไปหน้าเข้าสู่ระบบ...');
      setTimeout(() => router.replace('/login'), 1000);
    } catch (err) {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>สมัครสมาชิก</Text>

      <Text>Username</Text>
      <TextInput style={styles.input} value={username} onChangeText={setUsername} autoCapitalize="none" />

      <Text>Email</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <Text>Password</Text>
      <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}

      <TouchableOpacity style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>สมัครสมาชิก</Text>
      </TouchableOpacity>

      <Link href="/login" style={styles.link}>
        มีบัญชีอยู่แล้ว? เข้าสู่ระบบ
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
  error: { color: 'red', marginBottom: 8 },
  success: { color: 'green', marginBottom: 8 }
});
