import CarForm, { CarPayload } from '@/components/car-form';
import { api } from '@/config';
import { useAuth } from '@/context/auth-context';
import { authHeaders, C, canSell, notify } from '@/lib/cars';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function AddCarScreen() {
  const router = useRouter();
  const { user } = useAuth();

  if (!canSell(user)) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>Only seller accounts can list cars for sale.</Text>
        <TouchableOpacity onPress={() => router.replace(user ? '/' : '/login')}>
          <Text style={styles.link}>{user ? 'Back to cars' : 'Sign in'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const submit = async (payload: CarPayload) => {
    const res = await fetch(api('/api/inventory'), {
      method: 'POST',
      headers: authHeaders(user?.token),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to add car');
    notify('Car listed successfully!');
    router.back();
  };

  return <CarForm title="List a Car for Sale" submitLabel="Save Car" onSubmit={submit} onCancel={() => router.back()} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  msg: { color: '#fff', fontSize: 15, textAlign: 'center', marginBottom: 14 },
  link: { color: C.red, fontWeight: '700' },
});
