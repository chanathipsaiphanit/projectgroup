import { api } from '@/config';
import { useAuth } from '@/context/auth-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const TYPES = ['Sedan', 'SUV', 'Sports Car', 'Hatchback', 'Pickup'];

export default function EditCarScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();

  const car = params.car ? JSON.parse(params.car as string) : {};

  const [name, setName] = useState(car.name || '');
  const [model, setModel] = useState(car.model || '');
  const [stock, setStock] = useState(String(car.stock ?? '0'));
  const [price, setPrice] = useState(String(car.price ?? '0'));
  const [image, setImage] = useState(car.image || '');

  const existingType = car.type || TYPES[0];
  const [type, setType] = useState(existingType);

  // Cars saved before this picker existed (or with free-text types) might
  // hold a type that isn't in our predefined list — keep it selectable
  // instead of silently dropping it.
  const typeOptions = TYPES.includes(existingType) ? TYPES : [existingType, ...TYPES];

  const handleUpdate = async () => {
    try {
      const id = car.id;
      const res = await fetch(api(`/api/inventory/${id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.token}`,
        },
        body: JSON.stringify({
          name,
          model,
          type,
          stock: Number(stock) || 0,
          price: Number(price) || 0,
          image,
        })
      });
      const data = await res.json();

      if (res.ok) {
        if (Platform.OS === 'web') window.alert('Car updated successfully!');
        router.back();
      } else {
        alert(data.error || 'Failed to update car');
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to server');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Edit Car</Text>

      <TextInput style={styles.input} placeholder="Name" placeholderTextColor="#777" value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder="Model" placeholderTextColor="#777" value={model} onChangeText={setModel} />
      <TextInput style={styles.input} placeholder="Stock" placeholderTextColor="#777" value={stock} onChangeText={setStock} keyboardType="numeric" />
      <TextInput style={styles.input} placeholder="Price" placeholderTextColor="#777" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
      <TextInput style={styles.input} placeholder="Image URL" placeholderTextColor="#777" value={image} onChangeText={setImage} />

      <Text style={styles.label}>Type</Text>
      <View style={styles.pillRow}>
        {typeOptions.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.pill, type === t && styles.pillActive]}
            onPress={() => setType(t)}
          >
            <Text style={[styles.pillText, type === t && styles.pillTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={handleUpdate}>
        <Text style={styles.saveText}>Update Car</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#0A0A0A' },
  title: { fontSize: 22, fontWeight: '900', marginBottom: 20, color: '#fff' },
  input: { borderWidth: 1, borderColor: '#2A2A2A', backgroundColor: '#1A1A1A', color: '#fff', padding: 12, borderRadius: 8, marginBottom: 12, fontSize: 15 },
  label: { fontSize: 13, fontWeight: '700', color: '#999', marginBottom: 8, marginTop: 4 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  pill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#2A2A2A', backgroundColor: '#1A1A1A' },
  pillActive: { backgroundColor: '#E4001B', borderColor: '#E4001B' },
  pillText: { fontSize: 14, fontWeight: '700', color: '#D0D0D0' },
  pillTextActive: { color: '#fff' },
  saveBtn: { backgroundColor: '#E4001B', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  saveText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  backBtn: { padding: 12, alignItems: 'center', marginTop: 6 },
  backText: { color: '#999', fontWeight: 'bold' }
});
