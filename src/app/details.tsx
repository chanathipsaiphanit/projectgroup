import { api } from '@/config';
import { useAuth } from '@/context/auth-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Alert,
  Image,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';

const MAX_CONTENT_WIDTH = 900;
const WIDE_BREAKPOINT = 720;

export default function CarDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;

  const car = params.car ? JSON.parse(params.car as string) : {};
  const userRole = user?.role || (params.role as string) || 'user';
  const isLow = car.stock < 2;

  const handleDeletePress = () => {
    const message = `Are you sure you want to delete "${car.name}"?`;

    if (Platform.OS === 'web') {
      if (window.confirm(message)) {
        confirmDelete();
      }
    } else {
      Alert.alert('Delete car', message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: confirmDelete }
      ]);
    }
  };

  const confirmDelete = async () => {
    try {
      const id = car.id;
      const res = await fetch(api(`/api/inventory/${id}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      const data = await res.json();

      if (res.ok && data.success) {
        if (Platform.OS === 'web') window.alert('Car deleted successfully');
        router.back();
      } else {
        alert(data.error || 'Failed to delete car');
      }
    } catch (err) {
      console.error(err);
      alert('Unable to delete car');
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.pageInner}>
        <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>{'\u2190'} Back to list</Text>
        </TouchableOpacity>

        <View style={[styles.layout, isWide && styles.layoutWide]}>
          <View style={[styles.imageBox, isWide && styles.imageBoxWide]}>
            {car.image ? (
              <Image
                source={{ uri: car.image }}
                style={styles.carImg}
                resizeMode="contain"
              />
            ) : (
              <Text style={styles.placeholderText}>NOON</Text>
            )}
          </View>

          <View style={[styles.info, isWide && styles.infoWide]}>
            <Text style={styles.title}>{car.name}</Text>
            <Text style={styles.price}>{Number(car.price ?? 0).toLocaleString()} THB</Text>

            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Model</Text>
              <Text style={styles.metaValue}>{car.model || '—'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Type</Text>
              <Text style={styles.metaValue}>{car.type || 'General'}</Text>
            </View>

            <View style={[styles.stockBadge, isLow && styles.stockBadgeLow]}>
              <Text style={styles.stockBadgeText}>
                {car.stock === 0 ? 'SOLD OUT' : `${car.stock} IN STOCK`}
              </Text>
            </View>

            {/* Edit/Delete only shown to admins */}
            {userRole === 'admin' && (
              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => router.push({ pathname: '/edit', params: { car: JSON.stringify(car) } })}
                >
                  <Text style={styles.editBtnText}>Edit Car</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.deleteBtn} onPress={handleDeletePress}>
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0A0A0A' },
  pageInner: { flex: 1, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', padding: 20 },

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
    borderColor: '#262626',
    borderBottomWidth: 3,
    borderBottomColor: '#E4001B',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  imageBoxWide: { width: 420, aspectRatio: 4 / 3 },
  carImg: { width: '100%', height: '100%' },
  placeholderText: { color: '#E4001B', fontSize: 20, fontWeight: '800', letterSpacing: 3 },

  info: { flex: 1 },
  infoWide: { paddingTop: 4 },

  title: { fontSize: 26, fontWeight: '900', color: '#fff', marginBottom: 8 },
  price: { fontSize: 20, fontWeight: '700', color: '#E4001B', marginBottom: 16 },

  metaRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1E1E1E' },
  metaLabel: { width: 90, fontSize: 13, color: '#8A8A8A', fontWeight: '600' },
  metaValue: { flex: 1, fontSize: 14, color: '#fff' },

  stockBadge: { alignSelf: 'flex-start', backgroundColor: '#E4001B', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, marginTop: 18, marginBottom: 24 },
  stockBadgeLow: { backgroundColor: '#E4001B' },
  stockBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },

  btnRow: { flexDirection: 'row', gap: 10 },
  editBtn: { flex: 1, backgroundColor: 'transparent', padding: 14, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#3A3A3A' },
  deleteBtn: { flex: 1, backgroundColor: '#E4001B', padding: 14, borderRadius: 8, alignItems: 'center' },
  editBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  deleteBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});
