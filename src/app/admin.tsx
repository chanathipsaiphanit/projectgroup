import { Heading } from '@/components/form-ui';
import { api } from '@/config';
import { useAuth } from '@/context/auth-context';
import { authHeaders, C, Car, confirmAction, formatTHB, normalizeCar, notify } from '@/lib/cars';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type Stats = {
  cars: { total: number; onSale: number; sold: number };
  users: { buyers: number; sellers: number; admins: number };
  conversations: number;
  pendingAppointments: number;
};
type AdminUser = { id: number; username: string; email: string; role: string; created_at: string; car_count: number };

const ROLES = [
  { key: 'user', label: 'ผู้ซื้อ' },
  { key: 'seller', label: 'ผู้ขาย' },
  { key: 'admin', label: 'แอดมิน' },
];

export default function AdminScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<'cars' | 'users'>('cars');
  const [stats, setStats] = useState<Stats | null>(null);
  const [cars, setCars] = useState<Car[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const request = useCallback(
    async (path: string, method = 'GET', body?: object) => {
      const res = await fetch(api(path), {
        method,
        headers: authHeaders(user?.token, !!body),
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ทำรายการไม่สำเร็จ');
      return data;
    },
    [user]
  );

  const load = useCallback(async () => {
    if (user?.role !== 'admin') return;
    try {
      const [s, c, u] = await Promise.all([request('/api/admin/stats'), request('/api/inventory'), request('/api/admin/users')]);
      setStats(s);
      setCars(c.map(normalizeCar));
      setUsers(u);
    } catch (err: any) {
      notify(err.message || 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    } finally {
      setLoading(false);
    }
  }, [request, user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (user?.role !== 'admin') {
    return (
      <SafeAreaView style={[styles.screen, styles.center]}>
        <Text style={styles.muted}>หน้านี้สำหรับแอดมินเท่านั้น</Text>
        <TouchableOpacity onPress={() => router.replace(user ? '/' : '/login')}>
          <Text style={styles.link}>{user ? 'กลับหน้าแรก' : 'เข้าสู่ระบบ'}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const deleteCar = (car: Car) =>
    confirmAction('ลบประกาศ', `ต้องการลบประกาศ "${car.name}" ใช่ไหม?`, () =>
      request(`/api/inventory/${car.id}`, 'DELETE').then(load).catch((e) => notify(e.message))
    , 'ลบ');

  const changeRole = (u: AdminUser, role: string) =>
    request(`/api/admin/users/${u.id}`, 'PATCH', { role }).then(load).catch((e) => notify(e.message));

  const deleteUser = (u: AdminUser) =>
    confirmAction('ลบผู้ใช้', `ต้องการลบผู้ใช้ "${u.username}" ใช่ไหม? แชทของผู้ใช้นี้จะถูกลบด้วย`, () =>
      request(`/api/admin/users/${u.id}`, 'DELETE').then(load).catch((e) => notify(e.message))
    , 'ลบ');

  const q = search.trim().toLowerCase();
  const shownCars = cars.filter((c) => !q || `${c.name} ${c.model} ${c.sellerName}`.toLowerCase().includes(q));
  const shownUsers = users.filter((u) => !q || `${u.username} ${u.email}`.toLowerCase().includes(q));

  const statCards: [string, number | string][] = stats
    ? [
        ['รถทั้งหมด', stats.cars.total],
        ['กำลังขาย', stats.cars.onSale],
        ['ขายแล้ว', stats.cars.sold],
        ['ผู้ซื้อ', stats.users.buyers],
        ['ผู้ขาย', stats.users.sellers],
        ['แชททั้งหมด', stats.conversations],
        ['นัดดูรถรอตอบ', stats.pendingAppointments],
      ]
    : [];

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.page}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 12 }}>
          <Text style={styles.back}>{'← ย้อนกลับ'}</Text>
        </TouchableOpacity>
        <Heading style={styles.title} th="จัดการระบบ" en="Admin" />

        {loading ? (
          <ActivityIndicator color={C.red} style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={styles.stats}>
              {statCards.map(([label, value]) => (
                <View key={label} style={styles.stat}>
                  <Text style={styles.statValue}>{value}</Text>
                  <Text style={styles.statLabel}>{label}</Text>
                </View>
              ))}
            </View>

            <View style={styles.tabs}>
              {(
                [
                  ['cars', `ประกาศรถ (${cars.length})`],
                  ['users', `ผู้ใช้ (${users.length})`],
                ] as const
              ).map(([key, label]) => (
                <TouchableOpacity key={key} style={[styles.tab, tab === key && styles.tabActive]} onPress={() => setTab(key)}>
                  <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.search}
              placeholder={tab === 'cars' ? 'ค้นหาชื่อรถ หรือชื่อผู้ขาย' : 'ค้นหาชื่อผู้ใช้ หรืออีเมล'}
              placeholderTextColor="#666"
              value={search}
              onChangeText={setSearch}
            />

            {tab === 'cars'
              ? shownCars.map((car) => (
                  <View key={car.id} style={styles.row}>
                    <View style={styles.thumb}>
                      {car.image ? <Image source={{ uri: car.image }} style={styles.thumbImg} /> : <Text style={styles.thumbText}>NOON</Text>}
                    </View>
                    <View style={styles.info}>
                      <Text style={styles.name} numberOfLines={1}>{`${car.name} ${car.model}`}</Text>
                      <Text style={styles.meta}>{`ผู้ขาย: ${car.sellerName || 'ร้าน (ไม่มีผู้ขาย)'} · ${car.stock === 0 ? 'ขายแล้ว' : 'กำลังขาย'}`}</Text>
                      <Text style={styles.price}>{formatTHB(car.price)}</Text>
                    </View>
                    <View style={styles.actions}>
                      <TouchableOpacity style={styles.btn} onPress={() => router.push({ pathname: '/details', params: { car: JSON.stringify(car) } })}>
                        <Text style={styles.btnText}>ดู</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.btn} onPress={() => router.push({ pathname: '/edit', params: { car: JSON.stringify(car) } })}>
                        <Text style={styles.btnText}>แก้ไข</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={() => deleteCar(car)}>
                        <Text style={styles.btnText}>ลบ</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              : shownUsers.map((u) => {
                  const isMe = Number(u.id) === Number(user.id);
                  return (
                    <View key={u.id} style={styles.row}>
                      <View style={styles.info}>
                        <Text style={styles.name}>{`${u.username}${isMe ? ' (คุณ)' : ''}`}</Text>
                        <Text style={styles.meta}>{`${u.email} · ลงขาย ${u.car_count} คัน`}</Text>
                      </View>
                      <View style={styles.actions}>
                        {ROLES.map((r) => (
                          <TouchableOpacity
                            key={r.key}
                            disabled={isMe}
                            style={[styles.roleBtn, u.role === r.key && styles.roleBtnActive, isMe && { opacity: 0.5 }]}
                            onPress={() => u.role !== r.key && changeRole(u, r.key)}
                          >
                            <Text style={styles.btnText}>{r.label}</Text>
                          </TouchableOpacity>
                        ))}
                        {!isMe && (
                          <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={() => deleteUser(u)}>
                            <Text style={styles.btnText}>ลบ</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
            {tab === 'users' && (
              <Text style={styles.note}>เปลี่ยนสิทธิ์แล้ว ผู้ใช้คนนั้นต้องออกจากระบบแล้วเข้าสู่ระบบใหม่ สิทธิ์ใหม่จึงจะมีผล</Text>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  page: { width: '100%', maxWidth: 1000, alignSelf: 'center', padding: 20, paddingBottom: 40 },
  back: { color: '#999', fontWeight: '600' },
  muted: { color: C.muted },
  link: { color: C.red, fontWeight: '700' },
  title: { fontSize: 24, fontWeight: '900', color: '#fff' },

  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16, marginBottom: 18 },
  stat: { flexGrow: 1, flexBasis: 120, padding: 14, borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  statValue: { color: '#fff', fontSize: 24, fontWeight: '900' },
  statLabel: { color: C.muted, fontSize: 12, marginTop: 2 },

  tabs: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tab: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: C.borderStrong },
  tabActive: { backgroundColor: C.red, borderColor: C.red },
  tabText: { color: C.soft, fontWeight: '700' },
  tabTextActive: { color: '#fff' },
  search: { backgroundColor: C.input, borderWidth: 1, borderColor: C.borderStrong, color: '#fff', borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 12 },

  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 8,
  },
  thumb: { width: 90, height: 68, borderRadius: 6, backgroundColor: '#1E1E1E', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  thumbImg: { width: '100%', height: '100%' },
  thumbText: { color: C.red, fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  info: { flex: 1, minWidth: 180 },
  name: { color: '#fff', fontWeight: '800', fontSize: 14 },
  meta: { color: C.muted, fontSize: 12, marginTop: 3 },
  price: { color: C.red, fontWeight: '800', fontSize: 14, marginTop: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  btn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6, borderWidth: 1, borderColor: '#3A3A3A' },
  btnDanger: { backgroundColor: C.red, borderColor: C.red },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  roleBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 6, borderWidth: 1, borderColor: '#3A3A3A' },
  roleBtnActive: { backgroundColor: '#12351F', borderColor: C.green },
  note: { color: C.muted, fontSize: 12, marginTop: 8 },
});
