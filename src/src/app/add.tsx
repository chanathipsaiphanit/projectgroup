import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = 'http://localhost:3092/api';

export default function Add() {
  const [name, setName] = useState('');
  const [model, setModel] = useState('');
  const [type, setType] = useState('');
  const [price, setPrice] = useState('');
  const [image, setImage] = useState('');
  const [stock, setStock] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async () => {
    setError('');
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${API_BASE}/inventory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          model,
          type,
          price: Number(price),
          image,
          stock: Number(stock)
        })
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'เพิ่มรถไม่สำเร็จ');
        return;
      }

      router.replace('/');
    } catch (err) {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>เพิ่มรถใหม่</Text>

      <Text>ชื่อ (name)</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} />

      <Text>รุ่น (model)</Text>
      <TextInput style={styles.input} value={model} onChangeText={setModel} />

      <Text>ประเภท (type)</Text>
      <TextInput style={styles.input} value={type} onChangeText={setType} />

      <Text>ราคา (price)</Text>
      <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="numeric" />

      <Text>รูปภาพ (image URL)</Text>
      <TextInput style={styles.input} value={image} onChangeText={setImage} />

      <Text>สต๊อก (stock)</Text>
      <TextInput style={styles.input} value={stock} onChangeText={setStock} keyboardType="numeric" />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>บันทึก</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 10, marginBottom: 12 },
  button: { backgroundColor: '#1976d2', padding: 12, borderRadius: 6, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  error: { color: 'red', marginBottom: 8 }
});
