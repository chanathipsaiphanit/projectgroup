import { Heading, uiStyles } from '@/components/form-ui';
import PhotoViewer from '@/components/photo-viewer';
import { api } from '@/config';
import { useAuth } from '@/context/auth-context';
import {
  authHeaders,
  C,
  canManageCar,
  Car,
  confirmAction,
  formatKm,
  formatTHB,
  normalizeCar,
  notify,
  thColor,
  thFuel,
  thTransmission,
  thType,
} from '@/lib/cars';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useGoBack } from '@/lib/navigation';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';

const MAX_CONTENT_WIDTH = 900;
const WIDE_BREAKPOINT = 720;

export default function CarDetailScreen() {
  const router = useRouter();
  const goBack = useGoBack();
  const params = useLocalSearchParams<{ car?: string; id?: string }>();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;

  // Show whatever the list passed in straight away, then refresh from the API
  const initial = useMemo(() => {
    try {
      return params.car ? normalizeCar(JSON.parse(params.car)) : null;
    } catch {
      return null;
    }
  }, [params.car]);
  const carId = initial?.id ?? params.id;

  const [car, setCar] = useState<Car | null>(initial);
  const [loading, setLoading] = useState(!initial);
  const [contactOpen, setContactOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (carId == null) return;
      let cancelled = false;
      fetch(api(`/api/inventory/${carId}`))
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!cancelled && d) setCar(normalizeCar(d));
        })
        .catch((err) => console.error(err))
        .finally(() => !cancelled && setLoading(false));
      return () => {
        cancelled = true;
      };
    }, [carId])
  );

  if (!car) {
    return (
      <SafeAreaView style={[styles.screen, styles.center]}>
        {loading ? <ActivityIndicator color={C.red} /> : <Text style={styles.muted}>ไม่พบรถคันนี้</Text>}
      </SafeAreaView>
    );
  }

  const photos = car.images;
  const shown = Math.min(photoIndex, Math.max(photos.length - 1, 0));
  const isLow = car.stock < 2;
  const canManage = canManageCar(user, car);

  const specs: [string, string][] = [
    ['รุ่น', car.model || '—'],
    ['ประเภทรถ', car.type ? thType(car.type) : 'ทั่วไป'],
    ['ปีรถ', car.year ? String(car.year) : '—'],
    ['เลขไมล์', formatKm(car.mileage)],
    ['เชื้อเพลิง', thFuel(car.fuel)],
    ['ระบบเกียร์', thTransmission(car.transmission)],
    ['จำนวนที่นั่ง', car.seats ? `${car.seats} ที่นั่ง` : '—'],
    ['เครื่องยนต์', car.fuel === 'EV' ? 'มอเตอร์ไฟฟ้า' : car.engineCc ? `${car.engineCc.toLocaleString()} ซีซี` : '—'],
    ['อัตราสิ้นเปลือง', car.fuel === 'EV' ? '—' : car.fuelEconomy ? `${car.fuelEconomy} กม./ลิตร` : '—'],
    ['สี', thColor(car.color)],
  ];

  const confirmDelete = async () => {
    try {
      const res = await fetch(api(`/api/inventory/${car.id}`), {
        method: 'DELETE',
        headers: authHeaders(user?.token, false),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        notify('ลบรถเรียบร้อยแล้ว');
        goBack();
      } else {
        notify(data.error || 'ลบรถไม่สำเร็จ');
      }
    } catch (err) {
      console.error(err);
      notify('ไม่สามารถลบรถได้');
    }
  };

  const openContact = () => {
    if (!user) {
      notify('กรุณาเข้าสู่ระบบก่อนติดต่อผู้ขาย');
      router.push('/login');
      return;
    }
    setMessage(`สวัสดีครับ/ค่ะ ${car.name} คันนี้ยังอยู่ไหม?`);
    setContactOpen(true);
  };

  const startConversation = async () => {
    if (!user) return;
    setSending(true);
    try {
      const res = await fetch(api('/api/conversations'), {
        method: 'POST',
        headers: authHeaders(user.token),
        body: JSON.stringify({ carId: car.id, message: message.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ติดต่อผู้ขายไม่สำเร็จ');
      setContactOpen(false);
      router.push({ pathname: '/chat', params: { id: String(data.conversationId) } });
    } catch (err: any) {
      notify(err.message || 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.pageInner}>
        <TouchableOpacity style={styles.backLink} onPress={() => goBack()}>
          <Text style={styles.backLinkText}>{'← ย้อนกลับ'}</Text>
        </TouchableOpacity>

        <View style={[styles.layout, isWide && styles.layoutWide]}>
          <View style={[styles.gallery, isWide && styles.imageBoxWide]}>
            <View style={styles.imageBox}>
              {photos.length ? (
                <TouchableOpacity style={styles.carImg} onPress={() => setViewerIndex(shown)}>
                  <Image source={{ uri: photos[shown] }} style={styles.carImg} resizeMode="contain" />
                </TouchableOpacity>
              ) : (
                <Text style={styles.placeholderText}>NOON</Text>
              )}
              {photos.length > 1 && (
                <>
                  <TouchableOpacity style={[styles.galleryArrow, { left: 8 }]} onPress={() => setPhotoIndex((shown - 1 + photos.length) % photos.length)}>
                    <Text style={styles.galleryArrowText}>{'‹'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.galleryArrow, { right: 8 }]} onPress={() => setPhotoIndex((shown + 1) % photos.length)}>
                    <Text style={styles.galleryArrowText}>{'›'}</Text>
                  </TouchableOpacity>
                  <View style={styles.galleryCount}>
                    <Text style={styles.galleryCountText}>{`${shown + 1} / ${photos.length}`}</Text>
                  </View>
                </>
              )}
            </View>
            {photos.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbRow}>
                {photos.map((p, i) => (
                  <TouchableOpacity key={`${p}-${i}`} onPress={() => setPhotoIndex(i)} style={[styles.thumb, i === shown && styles.thumbActive]}>
                    <Image source={{ uri: p }} style={styles.carImg} resizeMode="cover" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            {photos.length > 0 && <Text style={styles.galleryHint}>แตะที่รูปเพื่อดูแบบเต็มจอ</Text>}
          </View>

          <View style={[styles.info, isWide && styles.infoWide]}>
            <Text style={styles.title}>{car.name}</Text>
            <Text style={styles.price}>{formatTHB(car.price)}</Text>

            <View style={[styles.stockBadge, isLow && styles.stockBadgeLow]}>
              <Text style={styles.stockBadgeText}>
                {car.stock === 0 ? 'ขายแล้ว' : `มีรถพร้อมขาย ${car.stock} คัน`}
              </Text>
            </View>

            <View style={styles.sellerBox}>
              <Heading style={styles.sellerLabel} th="ผู้ขาย" en="Seller" />
              <Text style={styles.sellerName}>{car.sellerName || 'Noon Home Car'}</Text>
            </View>

            {canManage ? (
              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[uiStyles.outlineBtn, { flex: 1 }]}
                  onPress={() => router.push({ pathname: '/edit', params: { car: JSON.stringify(car) } })}
                >
                  <Text style={uiStyles.outlineBtnText}>แก้ไขข้อมูลรถ</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[uiStyles.primaryBtn, { flex: 1 }]}
                  onPress={() => confirmAction('ลบรถ', `ต้องการลบ "${car.name}" ใช่ไหม?`, confirmDelete, 'ลบ')}
                >
                  <Text style={uiStyles.primaryBtnText}>ลบรถ</Text>
                </TouchableOpacity>
              </View>
            ) : contactOpen ? (
              <View style={styles.contactBox}>
                <Heading style={styles.sellerLabel} th="ข้อความถึงผู้ขาย" en="Message to Seller" />
                <TextInput
                  style={styles.contactInput}
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  placeholderTextColor="#666"
                />
                <View style={styles.btnRow}>
                  <TouchableOpacity style={[uiStyles.outlineBtn, { flex: 1 }]} onPress={() => setContactOpen(false)}>
                    <Text style={uiStyles.outlineBtnText}>ยกเลิก</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[uiStyles.primaryBtn, { flex: 1 }]} onPress={startConversation} disabled={sending}>
                    {sending ? <ActivityIndicator color="#fff" /> : <Text style={uiStyles.primaryBtnText}>ส่งข้อความ</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={uiStyles.primaryBtn} onPress={openContact}>
                <Text style={uiStyles.primaryBtnText}>ติดต่อผู้ขาย / นัดดูรถ</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <Heading style={styles.sectionTitle} th="ข้อมูลจำเพาะ" en="Specifications" />
        <View style={styles.specGrid}>
          {specs.map(([label, value]) => (
            <View key={label} style={[styles.specCell, isWide && styles.specCellWide]}>
              <Text style={styles.specLabel}>{label}</Text>
              <Text style={styles.specValue}>{value}</Text>
            </View>
          ))}
        </View>

        {!!car.description && (
          <>
            <Heading style={styles.sectionTitle} th="รายละเอียดเพิ่มเติม" en="Description" />
            <Text style={styles.description}>{car.description}</Text>
          </>
        )}
      </ScrollView>
      <PhotoViewer photos={photos} index={viewerIndex} onChange={setViewerIndex} onClose={() => setViewerIndex(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  muted: { color: C.muted },
  pageInner: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', padding: 20, paddingBottom: 40 },

  backLink: { alignSelf: 'flex-start', marginBottom: 16 },
  backLinkText: { color: '#999', fontSize: 14, fontWeight: '600' },

  layout: { flexDirection: 'column', gap: 20 },
  layoutWide: { flexDirection: 'row', gap: 40, alignItems: 'flex-start' },

  imageBox: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 10,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: C.border,
    borderBottomWidth: 3,
    borderBottomColor: C.red,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  imageBoxWide: { width: 420 },
  gallery: { width: '100%', gap: 8 },
  galleryArrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryArrowText: { color: '#fff', fontSize: 24, fontWeight: '700', marginTop: -2 },
  galleryCount: { position: 'absolute', right: 8, bottom: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  galleryCountText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  thumbRow: { gap: 8 },
  thumb: { width: 80, height: 60, borderRadius: 6, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', backgroundColor: '#1E1E1E' },
  thumbActive: { borderColor: C.red },
  galleryHint: { color: C.muted, fontSize: 11 },
  carImg: { width: '100%', height: '100%' },
  placeholderText: { color: C.red, fontSize: 20, fontWeight: '800', letterSpacing: 3 },

  info: { flex: 1 },
  infoWide: { paddingTop: 4 },

  title: { fontSize: 26, fontWeight: '900', color: '#fff', marginBottom: 8 },
  price: { fontSize: 20, fontWeight: '700', color: C.red, marginBottom: 12 },

  stockBadge: { alignSelf: 'flex-start', backgroundColor: '#2A2A2A', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, marginBottom: 16 },
  stockBadgeLow: { backgroundColor: C.red },
  stockBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },

  sellerBox: { padding: 12, borderRadius: 8, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, marginBottom: 16 },
  sellerLabel: { fontSize: 12, color: C.muted, fontWeight: '700', marginBottom: 4 },
  sellerName: { fontSize: 15, color: '#fff', fontWeight: '700' },

  contactBox: { gap: 10 },
  contactInput: { minHeight: 80, backgroundColor: C.input, borderWidth: 1, borderColor: '#2A2A2A', color: '#fff', borderRadius: 8, padding: 12, fontSize: 15, textAlignVertical: 'top' },

  btnRow: { flexDirection: 'row', gap: 10 },

  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#fff', marginTop: 28, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: C.red, paddingLeft: 8 },
  specGrid: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderTopColor: '#1E1E1E' },
  specCell: { width: '50%', paddingVertical: 10, paddingRight: 10, borderBottomWidth: 1, borderBottomColor: '#1E1E1E' },
  specCellWide: { width: '33.33%' },
  specLabel: { fontSize: 12, color: C.muted, fontWeight: '600', marginBottom: 3 },
  specValue: { fontSize: 14, color: '#fff', fontWeight: '600' },

  description: { color: C.soft, fontSize: 14, lineHeight: 21 },
});
