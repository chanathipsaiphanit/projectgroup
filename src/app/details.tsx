import { uiStyles } from '@/components/form-ui';
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
} from '@/lib/cars';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
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
        {loading ? <ActivityIndicator color={C.red} /> : <Text style={styles.muted}>Car not found</Text>}
      </SafeAreaView>
    );
  }

  const isLow = car.stock < 2;
  const canManage = canManageCar(user, car);

  const specs: [string, string][] = [
    ['Model', car.model || '—'],
    ['Type', car.type || 'General'],
    ['Year', car.year ? String(car.year) : '—'],
    ['Mileage', formatKm(car.mileage)],
    ['Fuel', car.fuel || '—'],
    ['Transmission', car.transmission || '—'],
    ['Seats', car.seats ? String(car.seats) : '—'],
    ['Engine', car.fuel === 'EV' ? 'Electric' : car.engineCc ? `${car.engineCc.toLocaleString()} cc` : '—'],
    ['Economy', car.fuel === 'EV' ? '—' : car.fuelEconomy ? `${car.fuelEconomy} km/l` : '—'],
    ['Color', car.color || '—'],
  ];

  const confirmDelete = async () => {
    try {
      const res = await fetch(api(`/api/inventory/${car.id}`), {
        method: 'DELETE',
        headers: authHeaders(user?.token, false),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        notify('Car deleted successfully');
        router.back();
      } else {
        notify(data.error || 'Failed to delete car');
      }
    } catch (err) {
      console.error(err);
      notify('Unable to delete car');
    }
  };

  const openContact = () => {
    if (!user) {
      notify('Please sign in to contact the seller');
      router.push('/login');
      return;
    }
    setMessage(`Hi, is the ${car.name} still available?`);
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
      if (!res.ok) throw new Error(data.error || 'Could not contact seller');
      setContactOpen(false);
      router.push({ pathname: '/chat', params: { id: String(data.conversationId) } });
    } catch (err: any) {
      notify(err.message || 'Cannot connect to server');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.pageInner}>
        <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>{'←'} Back</Text>
        </TouchableOpacity>

        <View style={[styles.layout, isWide && styles.layoutWide]}>
          <View style={[styles.imageBox, isWide && styles.imageBoxWide]}>
            {car.image ? (
              <Image source={{ uri: car.image }} style={styles.carImg} resizeMode="contain" />
            ) : (
              <Text style={styles.placeholderText}>NOON</Text>
            )}
          </View>

          <View style={[styles.info, isWide && styles.infoWide]}>
            <Text style={styles.title}>{car.name}</Text>
            <Text style={styles.price}>{formatTHB(car.price)}</Text>

            <View style={[styles.stockBadge, isLow && styles.stockBadgeLow]}>
              <Text style={styles.stockBadgeText}>
                {car.stock === 0 ? 'SOLD OUT' : `${car.stock} IN STOCK`}
              </Text>
            </View>

            <View style={styles.sellerBox}>
              <Text style={styles.sellerLabel}>Sold by</Text>
              <Text style={styles.sellerName}>{car.sellerName || 'Noon Home Car'}</Text>
            </View>

            {canManage ? (
              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[uiStyles.outlineBtn, { flex: 1 }]}
                  onPress={() => router.push({ pathname: '/edit', params: { car: JSON.stringify(car) } })}
                >
                  <Text style={uiStyles.outlineBtnText}>Edit Car</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[uiStyles.primaryBtn, { flex: 1 }]}
                  onPress={() => confirmAction('Delete car', `Are you sure you want to delete "${car.name}"?`, confirmDelete)}
                >
                  <Text style={uiStyles.primaryBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            ) : contactOpen ? (
              <View style={styles.contactBox}>
                <Text style={styles.sellerLabel}>Message to seller</Text>
                <TextInput
                  style={styles.contactInput}
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  placeholderTextColor="#666"
                />
                <View style={styles.btnRow}>
                  <TouchableOpacity style={[uiStyles.outlineBtn, { flex: 1 }]} onPress={() => setContactOpen(false)}>
                    <Text style={uiStyles.outlineBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[uiStyles.primaryBtn, { flex: 1 }]} onPress={startConversation} disabled={sending}>
                    {sending ? <ActivityIndicator color="#fff" /> : <Text style={uiStyles.primaryBtnText}>Send</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={uiStyles.primaryBtn} onPress={openContact}>
                <Text style={uiStyles.primaryBtnText}>Contact Seller / Book a Viewing</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Specifications</Text>
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
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{car.description}</Text>
          </>
        )}
      </ScrollView>
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
  sellerLabel: { fontSize: 11, color: C.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
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
