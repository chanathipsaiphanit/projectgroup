import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, Alert, RefreshControl } from 'react-native';
import { Link, useRouter, useFocusEffect } from 'expo-router';
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

export default function Index() {
  const [cars, setCars] = useState<Car[]>([]);
  const [error, setError] = useState('');
  const [role, setRole] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const loadUser = async () => {
    const r = await AsyncStorage.getItem('role');
    const u = await AsyncStorage.getItem('username');
    setRole(r);
    setUsername(u);
  };

  const fetchCars = async () => {
    try {
      const res = await fetch(`${API_BASE}/inventory`);
      const data: Car[] = await res.json();
      setCars(data);
    } catch (err) {
      setError('ไม่สามารถโหลดข้อมูลรถได้');
    }
  };

  // โหลดข้อมูลใหม่ทุกครั้งที่กลับมาที่หน้านี้ (เช่น หลัง login หรือหลังแก้ไข/ลบ)
  useFocusEffect(
    useCallback(() => {
      loadUser();
      fetchCars();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCars();
    setRefreshing(false);
  };

  const handleDelete = (id: number) => {
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
            if (res.ok) {
              setCars((prev) => prev.filter((c) => c.id !== id));
            } else {
              const data = await res.json();
              Alert.alert('ลบไม่สำเร็จ', data.message || '');
            }
          } catch (err) {
            Alert.alert('ผิดพลาด', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
          }
        }
      }
    ]);
  };

  const handleLogout = async () => {
    await AsyncStorage.clear();
    setRole(null);
    setUsername(null);
    router.replace('/login');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>รายการรถทั้งหมด</Text>
        {username ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ marginRight: 8 }}>
              {username} ({role})
            </Text>
            <TouchableOpacity onPress={handleLogout}>
              <Text style={styles.link}>ออกจากระบบ</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Link href="/login" style={styles.link}>
            เข้าสู่ระบบ
          </Link>
        )}
      </View>

      {role === 'admin' && (
        <Link href="/add" style={[styles.link, { marginBottom: 12 }]}>
          + เพิ่มรถใหม่
        </Link>
      )}

      {error ? <Text style={{ color: 'red' }}>{error}</Text> : null}

      <FlatList
        data={cars}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            {item.image ? <Image source={{ uri: item.image }} style={styles.image} /> : null}
            <View style={{ flex: 1 }}>
              <Text style={styles.carName}>
                {item.name} - {item.model}
              </Text>
              <Text>ประเภท: {item.type}</Text>
              <Text>ราคา: {Number(item.price).toLocaleString()} บาท</Text>
              <Text>สต๊อก: {item.stock}</Text>
              {role === 'admin' && (
                <View style={{ flexDirection: 'row', marginTop: 6 }}>
                  <Link href={`/edit/${item.id}`} style={[styles.link, { marginRight: 16 }]}>
                    แก้ไข
                  </Link>
                  <TouchableOpacity onPress={() => handleDelete(item.id)}>
                    <Text style={{ color: 'red' }}>ลบ</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 50 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 20, fontWeight: 'bold' },
  link: { color: '#1976d2' },
  card: { flexDirection: 'row', padding: 10, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginBottom: 10 },
  image: { width: 80, height: 60, borderRadius: 6, marginRight: 10 },
  carName: { fontWeight: 'bold', fontSize: 16 }
});
