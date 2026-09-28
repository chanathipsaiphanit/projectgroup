import { api } from '@/config';
import { useAuth } from '@/context/auth-context';
import { authHeaders, C, formatTHB } from '@/lib/cars';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type ConversationRow = {
  id: number;
  car_id: number;
  buyer_id: number;
  seller_id: number;
  car_name: string;
  car_image: string;
  car_price: number;
  buyer_name: string;
  seller_name: string;
  last_message: string | null;
  pending_appointments: number;
  updated_at: string;
};

export default function InboxScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      setLoading(true);
      fetch(api('/api/conversations'), { headers: authHeaders(user.token, false) })
        .then(async (res) => {
          const data = await res.json();
          if (res.ok) {
            setRows(data);
            setError('');
          } else setError(data.error || 'Could not load messages');
        })
        .catch(() => setError('Cannot connect to server'))
        .finally(() => setLoading(false));
    }, [user])
  );

  if (!user) {
    return (
      <SafeAreaView style={[styles.screen, styles.center]}>
        <Text style={styles.muted}>Sign in to see your messages.</Text>
        <TouchableOpacity onPress={() => router.replace('/login')}>
          <Text style={styles.link}>Sign in</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.page}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 12 }}>
          <Text style={styles.back}>{'←'} Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Messages</Text>
        <Text style={styles.subtitle}>Chats and viewing appointments with {user.role === 'user' ? 'sellers' : 'buyers and sellers'}</Text>

        {loading ? (
          <ActivityIndicator color={C.red} style={{ marginTop: 40 }} />
        ) : error ? (
          <Text style={styles.empty}>{error}</Text>
        ) : rows.length === 0 ? (
          <Text style={styles.empty}>No conversations yet. Open a car and tap “Contact Seller”.</Text>
        ) : (
          rows.map((c) => {
            const iAmBuyer = Number(c.buyer_id) === Number(user.id);
            const other = iAmBuyer ? c.seller_name : c.buyer_name;
            return (
              <TouchableOpacity
                key={c.id}
                style={styles.row}
                onPress={() => router.push({ pathname: '/chat', params: { id: String(c.id) } })}
              >
                <View style={styles.thumb}>
                  {c.car_image ? (
                    <Image source={{ uri: c.car_image }} style={styles.thumbImg} />
                  ) : (
                    <Text style={styles.thumbText}>NOON</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.carName} numberOfLines={1}>{c.car_name}</Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {iAmBuyer ? 'Seller' : 'Buyer'}: {other} · {formatTHB(Number(c.car_price))}
                  </Text>
                  <Text style={styles.last} numberOfLines={1}>{c.last_message || 'No messages yet'}</Text>
                </View>
                {Number(c.pending_appointments) > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{c.pending_appointments} pending</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  page: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20 },
  back: { color: '#999', fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '900', color: '#fff' },
  subtitle: { color: C.muted, fontSize: 13, marginTop: 4, marginBottom: 18 },
  muted: { color: C.muted },
  link: { color: C.red, fontWeight: '700' },
  empty: { color: '#777', textAlign: 'center', marginTop: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, marginBottom: 10 },
  thumb: { width: 64, height: 48, borderRadius: 6, backgroundColor: '#1E1E1E', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  thumbImg: { width: '100%', height: '100%' },
  thumbText: { color: C.red, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  carName: { color: '#fff', fontWeight: '700', fontSize: 14 },
  meta: { color: C.muted, fontSize: 12, marginTop: 2 },
  last: { color: C.soft, fontSize: 13, marginTop: 4 },
  badge: { backgroundColor: C.amber, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: '#000', fontSize: 11, fontWeight: '800' },
});
