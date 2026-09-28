import React, { useEffect, useState } from 'react';
import { Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = 'http://localhost:3092/api';

interface Car {
  id: number;
  name: string;
  model: string;
  type: string;
  price: number;
  image: string;
  stock: number;
}

export default function Edit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [name, setName] = useState('');
  const [model, setModel] = useState('');
  const [type, setType] = useState('');
  const [price, setPrice] = useState('');
  const [image, setImage] = useState('');
  const [stock, setStock] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchCar = async () => {
    try {
      const res = await fetch(`${API_BASE}/inventory/${id}`);
      const data: Car = await res.json();
      setName(data.name);
      setModel(data.model);
      setType(data.type);
      setPrice(String(data.price));
      setImage(data.image);
      setStock(String(data.stock));
    } catch (err) {
      setError('ไม่สามารถโหลดข้อมูลรถได้');
    }
  };

  const handleSubmit = async () => {
    setError('');
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${API_BASE}/inventory/${id}`, {
        method: 'PUT',
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
        setError(data.message || 'แก้ไขไม่สำเร็จ');
        return;
      }

      router.replace('/');
    } catch (err) {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    }
  };

  const handleDelete = () => {
    Alert.alert('ยืนยันการลบ', 'ต้องการลบรถคันนี้ใช่หรือไม่?', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบ',
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await AsyncStorage.getItem('token');
            const res = await fetch(`${API_BASE}/inventory/${id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) {
              setError(data.message || 'ลบไม่สำเร็จ');
              return;
            }
            router.replace('/');
          } catch (err) {
            setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
          }
        }
      }
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>แก้ไขข้อมูลรถ #{id}</Text>

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
        <Text style={styles.buttonText}>บันทึกการแก้ไข</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.deleteButton]} onPress={handleDelete}>
        <Text style={styles.buttonText}>ลบรถคันนี้</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 10, marginBottom: 12 },
  button: { backgroundColor: '#1976d2', padding: 12, borderRadius: 6, alignItems: 'center' },
  deleteButton: { backgroundColor: '#e53935', marginTop: 10 },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  error: { color: 'red', marginBottom: 8 }
});
