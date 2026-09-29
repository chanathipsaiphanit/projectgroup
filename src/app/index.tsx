import { Heading } from '@/components/form-ui';
import { api } from '@/config';
import { useAuth } from '@/context/auth-context';
import { C, canSell, Car, formatTHB, FUELS, normalizeCar, notify, thFuel, thTransmission, thType, TRANSMISSIONS } from '@/lib/cars';
import { useIsNarrow } from '@/lib/layout';
import { useFocusEffect, useRouter } from 'expo-router';
import { ReactNode, useCallback, useMemo, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

type SortKey = 'newest' | 'price_asc' | 'price_desc' | 'year_desc' | 'mileage_asc';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'ลงขายล่าสุด' },
  { key: 'price_asc', label: 'ราคาต่ำ → สูง' },
  { key: 'price_desc', label: 'ราคาสูง → ต่ำ' },
  { key: 'year_desc', label: 'ปีใหม่สุด' },
  { key: 'mileage_asc', label: 'ไมล์น้อยสุด' },
];

const PRICE_CAPS: { label: string; max: number | null }[] = [
  { label: 'ทุกราคา', max: null },
  { label: 'ไม่เกิน 3 แสน', max: 300000 },
  { label: 'ไม่เกิน 5 แสน', max: 500000 },
  { label: 'ไม่เกิน 8 แสน', max: 800000 },
  { label: 'ไม่เกิน 1 ล้าน', max: 1000000 },
];

const ROLE_LABEL: Record<string, string> = { user: 'ผู้ซื้อ', seller: 'ผู้ขาย', admin: 'แอดมิน' };
const MAX_COMPARE = 4;
const MAX_CONTENT_WIDTH = 1200;
const GAP = 16;

// Brand = first word of the listing name ("Toyota Yaris Ativ" -> "Toyota")
const brandOf = (car: Car) => car.name.trim().split(/\s+/)[0] || '';

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.filterRow}>
      <Text style={styles.filterLabel}>{label}</Text>
      {/* Chips wrap onto new lines so every option is visible without scrolling sideways */}
      <View style={styles.chipWrap}>{children}</View>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { width } = useWindowDimensions();
  // Phone-sized screens stack the header and the sort bar instead of squeezing them into one row
  const narrow = useIsNarrow();

  const contentWidth = Math.min(width, MAX_CONTENT_WIDTH) - 40;
  const columns = contentWidth >= 1000 ? 4 : contentWidth >= 720 ? 3 : contentWidth >= 460 ? 2 : 1;
  const cardWidth = Math.floor((contentWidth - GAP * (columns - 1)) / columns);

  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [brand, setBrand] = useState('All');
  const [type, setType] = useState('All');
  const [priceMax, setPriceMax] = useState<number | null>(null);
  const [sort, setSort] = useState<SortKey>('newest');
  const [moreOpen, setMoreOpen] = useState(false);
  const [fuel, setFuel] = useState('All');
  const [transmission, setTransmission] = useState('All');
  const [minYear, setMinYear] = useState('');
  const [maxMileage, setMaxMileage] = useState('');
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<Car['id'][]>([]);

  const fetchCars = async () => {
    try {
      const response = await fetch(api('/api/inventory'));
      const data = await response.json();
      if (response.ok) setCars(data.map(normalizeCar));
    } catch (err) {
      console.error('Failed to fetch inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  // Refresh whenever the screen comes back into focus (e.g. after selling a car)
  useFocusEffect(
    useCallback(() => {
      fetchCars();
    }, [])
  );

  const brands = useMemo(() => ['All', ...Array.from(new Set(cars.map(brandOf).filter(Boolean))).sort()], [cars]);
  const types = useMemo(() => ['All', ...Array.from(new Set(cars.map((c) => c.type).filter(Boolean)))], [cars]);

  const filteredCars = useMemo(() => {
    const q = query.trim().toLowerCase();
    const yearMin = Number(minYear) || null;
    const mileageMax = Number(maxMileage.replace(/,/g, '')) || null;

    const list = cars.filter((c) => {
      if (q && !`${c.name} ${c.model} ${c.type} ${thType(c.type)}`.toLowerCase().includes(q)) return false;
      if (brand !== 'All' && brandOf(c) !== brand) return false;
      if (type !== 'All' && c.type !== type) return false;
      if (priceMax != null && c.price > priceMax) return false;
      if (fuel !== 'All' && c.fuel !== fuel) return false;
      if (transmission !== 'All' && c.transmission !== transmission) return false;
      if (yearMin != null && (c.year == null || c.year < yearMin)) return false;
      if (mileageMax != null && (c.mileage == null || c.mileage > mileageMax)) return false;
      return true;
    });

    const sorted = [...list];
    if (sort === 'price_asc') sorted.sort((a, b) => a.price - b.price);
    if (sort === 'price_desc') sorted.sort((a, b) => b.price - a.price);
    if (sort === 'year_desc') sorted.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
    if (sort === 'mileage_asc') sorted.sort((a, b) => (a.mileage ?? Infinity) - (b.mileage ?? Infinity));
    // Sold cars go last
    sorted.sort((a, b) => Number(a.stock === 0) - Number(b.stock === 0));
    return sorted;
  }, [cars, query, brand, type, priceMax, fuel, transmission, minYear, maxMileage, sort]);

  const hasFilters =
    !!query || brand !== 'All' || type !== 'All' || priceMax != null || fuel !== 'All' || transmission !== 'All' || !!minYear || !!maxMileage;

  const resetFilters = () => {
    setQuery('');
    setBrand('All');
    setType('All');
    setPriceMax(null);
    setFuel('All');
    setTransmission('All');
    setMinYear('');
    setMaxMileage('');
  };

  const goSell = () => {
    if (!user) {
      notify('กรุณาเข้าสู่ระบบด้วยบัญชีผู้ขายก่อนลงขายรถ');
      router.push('/login');
    } else if (canSell(user)) {
      router.push('/add');
    } else {
      notify('บัญชีนี้เป็นบัญชีผู้ซื้อ ลงขายรถได้เฉพาะบัญชีผู้ขาย กรุณาสมัครบัญชีผู้ขาย');
      logout();
      router.push({ pathname: '/register', params: { role: 'seller' } });
    }
  };

  const handleLogout = () => {
    logout();
    if (Platform.OS === 'web') window.alert('ออกจากระบบแล้ว');
  };

  const toggleCompare = (id: Car['id']) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_COMPARE) {
        notify(`เปรียบเทียบได้สูงสุด ${MAX_COMPARE} คัน`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const exitCompare = () => {
    setCompareMode(false);
    setCompareIds([]);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: compareMode ? 110 : 40 }}>
        {/* ---------- Header ---------- */}
        <View style={styles.header}>
          <View style={styles.inner}>
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.brandTitle}>Noon Home Car</Text>
                <Text style={styles.brandTagline}>ตลาดรถมือสอง · Used Cars</Text>
              </View>

              <View style={[styles.nav, narrow && styles.navNarrow]}>
                <TouchableOpacity style={styles.navLink} onPress={() => router.push('/ai-advisor')}>
                  <Text style={styles.navLinkText}>แนะนำรถให้คุณ</Text>
                </TouchableOpacity>
                {user && (
                  <TouchableOpacity style={styles.navLink} onPress={() => router.push('/inbox')}>
                    <Text style={styles.navLinkText}>ข้อความ</Text>
                  </TouchableOpacity>
                )}
                {canSell(user) && (
                  <TouchableOpacity style={styles.navLink} onPress={() => router.push('/my-cars')}>
                    <Text style={styles.navLinkText}>รถของฉัน</Text>
                  </TouchableOpacity>
                )}
                {user?.role === 'admin' && (
                  <TouchableOpacity style={styles.navLink} onPress={() => router.push('/admin')}>
                    <Text style={styles.navLinkText}>จัดการระบบ</Text>
                  </TouchableOpacity>
                )}
                {user ? (
                  <TouchableOpacity style={styles.navLink} onPress={handleLogout}>
                    <Text style={styles.navLinkMuted}>{`ออกจากระบบ (${user.username})`}</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.navLink} onPress={() => router.push('/login')}>
                    <Text style={styles.navLinkText}>เข้าสู่ระบบ</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.sellBtn, narrow && styles.sellBtnNarrow]} onPress={goSell}>
                  <Text style={styles.sellBtnText}>+ ลงขายรถ</Text>
                </TouchableOpacity>
              </View>
            </View>
            {user && <Text style={styles.roleText}>{`บัญชี${ROLE_LABEL[user.role] ?? user.role}`}</Text>}

            {/* ---------- Search ---------- */}
            <Text style={styles.heroTitle}>ค้นหารถมือสองที่ใช่สำหรับคุณ</Text>
            <View style={styles.searchBox}>
              <TextInput
                style={styles.searchInput}
                placeholder="พิมพ์ยี่ห้อ รุ่น หรือประเภทรถ เช่น Honda, Civic, กระบะ"
                placeholderTextColor="#777"
                value={query}
                onChangeText={setQuery}
                returnKeyType="search"
              />
              {!!query && (
                <TouchableOpacity onPress={() => setQuery('')}>
                  <Text style={styles.clearText}>ล้าง</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        <View style={styles.inner}>
          {/* ---------- Filters ---------- */}
          <View style={styles.filters}>
            <ChipRow label="ยี่ห้อ">
              {brands.map((b) => (
                <Chip key={b} label={b === 'All' ? 'ทั้งหมด' : b} active={brand === b} onPress={() => setBrand(b)} />
              ))}
            </ChipRow>
            <ChipRow label="ประเภท">
              {types.map((t) => (
                <Chip key={t} label={t === 'All' ? 'ทั้งหมด' : thType(t)} active={type === t} onPress={() => setType(t)} />
              ))}
            </ChipRow>
            <ChipRow label="ราคา">
              {PRICE_CAPS.map((p) => (
                <Chip key={p.label} label={p.label} active={priceMax === p.max} onPress={() => setPriceMax(p.max)} />
              ))}
            </ChipRow>

            {moreOpen && (
              <>
                <ChipRow label="เชื้อเพลิง">
                  {['All', ...FUELS].map((f) => (
                    <Chip key={f} label={f === 'All' ? 'ทั้งหมด' : thFuel(f)} active={fuel === f} onPress={() => setFuel(f)} />
                  ))}
                </ChipRow>
                <ChipRow label="เกียร์">
                  {['All', ...TRANSMISSIONS].map((t) => (
                    <Chip key={t} label={t === 'All' ? 'ทั้งหมด' : thTransmission(t)} active={transmission === t} onPress={() => setTransmission(t)} />
                  ))}
                </ChipRow>
                <View style={styles.filterRow}>
                  <Text style={styles.filterLabel}>ปี / ไมล์</Text>
                  <View style={styles.inputsRow}>
                    <TextInput
                      style={styles.smallInput}
                      placeholder="ปีตั้งแต่ เช่น 2019"
                      placeholderTextColor="#666"
                      keyboardType="numeric"
                      value={minYear}
                      onChangeText={setMinYear}
                    />
                    <TextInput
                      style={styles.smallInput}
                      placeholder="ไมล์ไม่เกิน (กม.)"
                      placeholderTextColor="#666"
                      keyboardType="numeric"
                      value={maxMileage}
                      onChangeText={setMaxMileage}
                    />
                  </View>
                </View>
              </>
            )}

            <View style={styles.filterFooter}>
              <TouchableOpacity onPress={() => setMoreOpen((v) => !v)}>
                <Text style={styles.linkText}>{moreOpen ? '▲ ซ่อนตัวกรองเพิ่มเติม' : '▼ ตัวกรองเพิ่มเติม (เชื้อเพลิง เกียร์ ปี ไมล์)'}</Text>
              </TouchableOpacity>
              {hasFilters && (
                <TouchableOpacity onPress={resetFilters}>
                  <Text style={styles.resetText}>ล้างตัวกรองทั้งหมด</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* ---------- Results ---------- */}
          <View style={styles.resultsHead}>
            <View>
              <Heading style={styles.sectionTitle} th="รถมือสองทั้งหมด" en="Used Cars" />
              <Text style={styles.countText}>{`พบ ${filteredCars.length} คัน · แตะที่รถเพื่อดูรายละเอียดและติดต่อผู้ขาย`}</Text>
            </View>
            <View style={[styles.resultsActions, narrow && styles.resultsActionsNarrow]}>
              <View style={styles.sortWrap}>
                {SORTS.map((s) => (
                  <Chip key={s.key} label={s.label} active={sort === s.key} onPress={() => setSort(s.key)} />
                ))}
              </View>
              <TouchableOpacity
                style={[styles.compareToggle, compareMode && styles.compareToggleActive, narrow && { alignSelf: 'flex-start' }]}
                onPress={() => (compareMode ? exitCompare() : setCompareMode(true))}
              >
                <Text style={styles.compareToggleText}>{compareMode ? 'ยกเลิกเปรียบเทียบ' : '⇄ เปรียบเทียบรถ'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {compareMode && <Text style={styles.compareHint}>{`แตะเลือกรถ 2–${MAX_COMPARE} คันที่ต้องการเปรียบเทียบ`}</Text>}

          {loading ? (
            <Text style={styles.emptyText}>กำลังโหลดรถ…</Text>
          ) : filteredCars.length === 0 ? (
            <Text style={styles.emptyText}>ไม่พบรถที่ตรงกับการค้นหา</Text>
          ) : (
            <View style={styles.grid}>
              {filteredCars.map((item) => {
                const selected = compareIds.includes(item.id);
                const sold = item.stock === 0;
                const meta = [
                  item.year ? `ปี ${item.year}` : null,
                  item.mileage != null ? `${item.mileage.toLocaleString()} กม.` : null,
                  item.transmission ? thTransmission(item.transmission) : null,
                ]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <Pressable
                    key={item.id}
                    onPress={() =>
                      compareMode
                        ? toggleCompare(item.id)
                        : router.push({ pathname: '/details', params: { car: JSON.stringify(item) } })
                    }
                    style={({ hovered }: any) => [
                      styles.card,
                      { width: cardWidth },
                      hovered && styles.cardHovered,
                      selected && styles.cardSelected,
                    ]}
                  >
                    <View style={styles.imageWrap}>
                      {item.image ? (
                        <Image source={{ uri: item.image }} style={[styles.carImage, sold && { opacity: 0.4 }]} resizeMode="cover" />
                      ) : (
                        <View style={styles.placeholder}>
                          <Text style={styles.placeholderText}>NOON</Text>
                        </View>
                      )}
                      {sold && (
                        <View style={styles.soldTag}>
                          <Text style={styles.soldTagText}>ขายแล้ว</Text>
                        </View>
                      )}
                      {compareMode && (
                        <View style={[styles.checkBox, selected && styles.checkBoxOn]}>
                          <Text style={styles.checkMark}>{selected ? '✓' : ''}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={styles.carName} numberOfLines={1}>{`${item.name} ${item.model}`}</Text>
                      <Text style={styles.carMeta} numberOfLines={1}>{meta}</Text>
                      <Text style={styles.carPrice}>{formatTHB(item.price)}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ---------- Compare tray ---------- */}
      {compareMode && (
        <View style={styles.compareBar}>
          <Text style={styles.compareBarText}>
            {`เลือกแล้ว ${compareIds.length} คัน${compareIds.length < 2 ? ' (เลือกอย่างน้อย 2 คัน)' : ''}`}
          </Text>
          <View style={styles.compareBarActions}>
            <TouchableOpacity onPress={() => setCompareIds([])}>
              <Text style={styles.resetText}>ล้าง</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.compareGo, compareIds.length < 2 && { opacity: 0.4 }]}
              disabled={compareIds.length < 2}
              onPress={() => router.push({ pathname: '/compare', params: { ids: compareIds.join(',') } })}
            >
              <Text style={styles.compareGoText}>เปรียบเทียบ</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  inner: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', paddingHorizontal: 20 },

  header: { backgroundColor: C.panel, borderBottomWidth: 1, borderBottomColor: C.border, paddingTop: 14, paddingBottom: 22 },
  headerRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  brandTitle: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  brandTagline: { fontSize: 12, color: C.red, fontWeight: '700', marginTop: 2 },
  nav: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  navNarrow: { width: '100%', marginLeft: -10, flexShrink: 1 },
  navLink: { paddingHorizontal: 10, paddingVertical: 8 },
  navLinkText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  navLinkMuted: { color: C.muted, fontWeight: '600', fontSize: 13 },
  sellBtn: { backgroundColor: C.red, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8, marginLeft: 6 },
  sellBtnNarrow: { marginLeft: 10, marginTop: 4 },
  sellBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  roleText: { color: C.muted, fontSize: 12, marginTop: 4 },

  heroTitle: { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 22, marginBottom: 12 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 16,
    gap: 10,
  },
  searchInput: { flex: 1, paddingVertical: 14, fontSize: 16, color: '#111' },
  clearText: { color: '#666', fontWeight: '700' },

  filters: { marginTop: 18, padding: 14, borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, gap: 10 },
  filterRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  filterLabel: { width: 64, paddingTop: 7, color: C.muted, fontSize: 13, fontWeight: '700' },
  chipWrap: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sortWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flexShrink: 1 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: C.borderStrong, backgroundColor: C.input },
  chipActive: { backgroundColor: C.red, borderColor: C.red },
  chipText: { color: C.soft, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  inputsRow: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  smallInput: {
    flexGrow: 1,
    flexBasis: 150,
    backgroundColor: C.input,
    borderWidth: 1,
    borderColor: C.borderStrong,
    color: '#fff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  filterFooter: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginTop: 2 },
  linkText: { color: C.soft, fontWeight: '700', fontSize: 13 },
  resetText: { color: C.red, fontWeight: '700', fontSize: 13 },

  resultsHead: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10, marginTop: 24, marginBottom: 14 },
  resultsActions: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  resultsActionsNarrow: { width: '100%', flexDirection: 'column', alignItems: 'stretch' },
  sectionTitle: { fontSize: 20, fontWeight: '900', color: '#fff' },
  countText: { fontSize: 12, color: C.muted, marginTop: 4 },
  compareToggle: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: C.borderStrong },
  compareToggleActive: { borderColor: C.red, backgroundColor: '#1F0A0C' },
  compareToggleText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  compareHint: { color: C.soft, fontSize: 13, marginBottom: 12 },
  emptyText: { color: '#777', textAlign: 'center', marginTop: 60 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  card: {
    backgroundColor: C.card,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    ...(Platform.OS === 'web' ? ({ transitionProperty: 'transform, border-color', transitionDuration: '150ms' } as any) : null),
  },
  cardHovered: Platform.OS === 'web' ? ({ transform: [{ translateY: -3 }], borderColor: C.red } as any) : {},
  cardSelected: { borderColor: C.red, borderWidth: 2 },
  imageWrap: { width: '100%', aspectRatio: 4 / 3, backgroundColor: '#1E1E1E' },
  carImage: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: C.red, fontSize: 18, fontWeight: '800', letterSpacing: 3 },
  soldTag: { position: 'absolute', left: 10, top: 10, backgroundColor: C.red, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
  soldTagText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  checkBox: { position: 'absolute', right: 10, top: 10, width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#fff', backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  checkBoxOn: { backgroundColor: C.red, borderColor: C.red },
  checkMark: { color: '#fff', fontWeight: '900', fontSize: 15 },
  cardInfo: { padding: 12 },
  carName: { fontSize: 15, fontWeight: '700', color: '#fff' },
  carMeta: { fontSize: 12, color: C.muted, marginTop: 4 },
  carPrice: { fontSize: 17, fontWeight: '900', color: C.red, marginTop: 8 },

  compareBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: C.panel,
    borderTopWidth: 1,
    borderTopColor: C.red,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compareBarText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  compareBarActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  compareGo: { backgroundColor: C.red, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8 },
  compareGoText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
