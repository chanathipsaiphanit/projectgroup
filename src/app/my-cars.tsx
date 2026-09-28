import { Heading } from '@/components/form-ui';
import { api } from '@/config';
import { useAuth } from '@/context/auth-context';
import { authHeaders, C, canSell, Car, confirmAction, formatTHB, normalizeCar, notify, thTransmission } from '@/lib/cars';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Seller's own listings: what they posted, and quick actions on each one
export default function MyCarsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(api('/api/inventory'));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const me = Number(user.id);
      // Admins also look after the shop's own cars (listed without a seller)
      const mine = data
        .map(normalizeCar)
        .filter((c: Car) => (c.sellerId != null ? Number(c.sellerId) === me : user.role === 'admin'));
      setCars(mine);
    } catch {
      notify('โหลดรายการรถไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!canSell(user)) {
    return (
      <SafeAreaView style={[styles.screen, styles.center]}>
        <Text style={styles.muted}>หน้านี้สำหรับบัญชีผู้ขายเท่านั้น</Text>
        <TouchableOpacity onPress={() => router.replace(user ? '/' : '/login')}>
          <Text style={styles.link}>{user ? 'กลับหน้าแรก' : 'เข้าสู่ระบบ'}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const setStock = async (car: Car, stock: number) => {
    try {
      const res = await fetch(api(`/api/inventory/${car.id}/stock`), {
        method: 'PATCH',
        headers: authHeaders(user?.token),
        body: JSON.stringify({ stock }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      load();
    } catch (err: any) {
      notify(err.message || 'บันทึกไม่สำเร็จ');
    }
  };

  const remove = (car: Car) =>
    confirmAction(
      'ลบประกาศ',
      `ต้องการลบประกาศ "${car.name}" ใช่ไหม?`,
      async () => {
        try {
          const res = await fetch(api(`/api/inventory/${car.id}`), { method: 'DELETE', headers: authHeaders(user?.token, false) });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          load();
        } catch (err: any) {
          notify(err.message || 'ลบไม่สำเร็จ');
        }
      },
      'ลบ'
    );

  const onSale = cars.filter((c) => c.stock > 0).length;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.page}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 12 }}>
          <Text style={styles.back}>{'← ย้อนกลับ'}</Text>
        </TouchableOpacity>

        <View style={styles.titleRow}>
          <Heading style={styles.title} th="รถที่ฉันลงขาย" en="My Listings" />
          <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/add')}>
            <Text style={styles.addBtnText}>+ ลงขายรถคันใหม่</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{cars.length}</Text>
            <Text style={styles.statLabel}>ประกาศทั้งหมด</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: C.green }]}>{onSale}</Text>
            <Text style={styles.statLabel}>กำลังขาย</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: C.muted }]}>{cars.length - onSale}</Text>
            <Text style={styles.statLabel}>ขายแล้ว</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={C.red} style={{ marginTop: 40 }} />
        ) : cars.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.muted}>คุณยังไม่ได้ลงขายรถ</Text>
            <TouchableOpacity style={[styles.addBtn, { marginTop: 12 }]} onPress={() => router.push('/add')}>
              <Text style={styles.addBtnText}>+ ลงขายรถคันแรก</Text>
            </TouchableOpacity>
          </View>
        ) : (
          cars.map((car) => {
            const sold = car.stock === 0;
            return (
              <View key={car.id} style={styles.row}>
                <TouchableOpacity
                  style={styles.thumb}
                  onPress={() => router.push({ pathname: '/details', params: { car: JSON.stringify(car) } })}
                >
                  {car.image ? <Image source={{ uri: car.image }} style={styles.thumbImg} /> : <Text style={styles.thumbText}>NOON</Text>}
                </TouchableOpacity>

                <View style={styles.info}>
                  <Text style={styles.name} numberOfLines={1}>{`${car.name} ${car.model}`}</Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {[car.year ? `ปี ${car.year}` : null, car.mileage != null ? `${car.mileage.toLocaleString()} กม.` : null, car.transmission ? thTransmission(car.transmission) : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  <Text style={styles.price}>{formatTHB(car.price)}</Text>
                  <View style={[styles.status, sold ? styles.statusSold : styles.statusOn]}>
                    <Text style={styles.statusText}>{sold ? 'ขายแล้ว' : `กำลังขาย · ${car.stock} คัน`}</Text>
                  </View>
                </View>

                <View style={styles.actions}>
                  <TouchableOpacity style={styles.btn} onPress={() => router.push({ pathname: '/edit', params: { car: JSON.stringify(car) } })}>
                    <Text style={styles.btnText}>แก้ไข</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btn} onPress={() => setStock(car, sold ? 1 : 0)}>
                    <Text style={styles.btnText}>{sold ? 'เปิดขายอีกครั้ง' : 'ขายแล้ว'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={() => remove(car)}>
                    <Text style={styles.btnText}>ลบ</Text>
                  </TouchableOpacity>
                </View>
              </View>
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
  page: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 20, paddingBottom: 40 },
  back: { color: '#999', fontWeight: '600' },
  muted: { color: C.muted },
  link: { color: C.red, fontWeight: '700' },

  titleRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  title: { fontSize: 24, fontWeight: '900', color: '#fff' },
  addBtn: { backgroundColor: C.red, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  addBtnText: { color: '#fff', fontWeight: '800' },

  stats: { flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 18 },
  stat: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  statValue: { color: '#fff', fontSize: 24, fontWeight: '900' },
  statLabel: { color: C.muted, fontSize: 12, marginTop: 2 },

  empty: { alignItems: 'center', marginTop: 40 },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    borderRadius: 10,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 10,
  },
  thumb: { width: 120, height: 90, borderRadius: 6, backgroundColor: '#1E1E1E', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  thumbImg: { width: '100%', height: '100%' },
  thumbText: { color: C.red, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  info: { flex: 1, minWidth: 180 },
  name: { color: '#fff', fontWeight: '800', fontSize: 15 },
  meta: { color: C.muted, fontSize: 12, marginTop: 3 },
  price: { color: C.red, fontWeight: '900', fontSize: 16, marginTop: 6 },
  status: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, marginTop: 6 },
  statusOn: { backgroundColor: '#12351F' },
  statusSold: { backgroundColor: '#2A2A2A' },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  btn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: '#3A3A3A' },
  btnDanger: { backgroundColor: C.red, borderColor: C.red },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
