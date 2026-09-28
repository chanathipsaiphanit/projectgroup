import { Pill } from '@/components/form-ui';
import { api } from '@/config';
import { useAuth } from '@/context/auth-context';
import {
  authHeaders,
  C,
  canManageCar,
  canSell,
  Car,
  confirmAction,
  formatTHB,
  FUELS,
  normalizeCar,
  notify,
  TRANSMISSIONS,
} from '@/lib/cars';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
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
  View
} from 'react-native';

type PriceTier = 'Low' | 'Mid' | 'High';
type TieredCar = Car & { priceTier: PriceTier };

// Client-side K-Means — groups cars into three price tiers on-device
// instead of asking the server, based on .price.
function clusterPricesLocally(data: Car[]): TieredCar[] {
  if (!data || data.length === 0) return [];
  const prices = data.map((item) => item.price);

  let centroids = [
    Math.min(...prices),
    (Math.min(...prices) + Math.max(...prices)) / 2,
    Math.max(...prices),
  ];

  let assignments: number[] = [];
  let changed = true;
  let iterations = 0;

  while (changed && iterations < 100) {
    iterations++;
    changed = false;
    assignments = prices.map((price) => {
      const diffs = centroids.map((c) => Math.abs(price - c));
      return diffs.indexOf(Math.min(...diffs));
    });

    const newCentroids = [0, 1, 2].map((i) => {
      const clusterPrices = prices.filter((_, index) => assignments[index] === i);
      return clusterPrices.length
        ? clusterPrices.reduce((a, b) => a + b, 0) / clusterPrices.length
        : centroids[i];
    });

    if (JSON.stringify(centroids) !== JSON.stringify(newCentroids)) {
      centroids = newCentroids;
      changed = true;
    }
  }

  const sortedCentroids = [...centroids].sort((a, b) => a - b);
  const labels: PriceTier[] = ['Low', 'Mid', 'High'];

  return data.map((item, index) => {
    const myCentroid = centroids[assignments[index]];
    const tierIndex = sortedCentroids.indexOf(myCentroid);
    return { ...item, priceTier: labels[tierIndex] };
  });
}

// ---------- Advanced filters ----------
type SortKey = 'newest' | 'price_asc' | 'price_desc' | 'year_desc' | 'mileage_asc';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'ลงขายล่าสุด' },
  { key: 'price_asc', label: 'ราคา: ต่ำ → สูง' },
  { key: 'price_desc', label: 'ราคา: สูง → ต่ำ' },
  { key: 'year_desc', label: 'ปีรถใหม่สุด' },
  { key: 'mileage_asc', label: 'ไมล์น้อยสุด' },
];

type Filters = {
  minPrice: string;
  maxPrice: string;
  minYear: string;
  maxMileage: string;
  brand: string;
  fuel: string;
  transmission: string;
  sort: SortKey;
  onlyMine: boolean;
};

const EMPTY_FILTERS: Filters = {
  minPrice: '',
  maxPrice: '',
  minYear: '',
  maxMileage: '',
  brand: 'All',
  fuel: 'All',
  transmission: 'All',
  sort: 'newest',
  onlyMine: false,
};

const parseNum = (s: string) => {
  const t = s.trim().replace(/,/g, '');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

// Brand = first word of the listing name ("Toyota Yaris Ativ" -> "Toyota")
const brandOf = (car: Car) => car.name.trim().split(/\s+/)[0] || '';

const TIER_LABEL: Record<'All' | PriceTier, string> = { All: 'ทุกช่วงราคา', Low: 'ราคาประหยัด', Mid: 'ราคากลาง', High: 'ราคาสูง' };
const ROLE_LABEL: Record<string, string> = { user: 'ผู้ซื้อ', seller: 'ผู้ขาย', admin: 'แอดมิน' };

const MAX_COMPARE = 4;
const MAX_CONTENT_WIDTH = 1200;
const CARD_GAP = 16;

function ImagePlaceholder() {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText} numberOfLines={1} adjustsFontSizeToFit>
        NOON
      </Text>
    </View>
  );
}

// A plain geometric magnifying-glass drawn from two Views — crisper and
// more consistent across platforms than relying on an emoji glyph.
function SearchIcon({ size = 13, color = '#111' }: { size?: number; color?: string }) {
  const box = size + 8;
  return (
    <View style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1.6, borderColor: color }} />
      <View
        style={{
          position: 'absolute',
          width: 1.6,
          height: size * 0.5,
          backgroundColor: color,
          bottom: 1,
          right: 2,
          borderRadius: 1,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { width, height: windowHeight } = useWindowDimensions();

  const cardWidth = width < 640 ? 220 : width < 960 ? 260 : 300;
  const scrollStep = cardWidth + CARD_GAP;
  const cardHeight = Math.round((cardWidth * 3) / 4) + 150;
  const searchOverlayHeight = Math.round(windowHeight * 0.5);

  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState('All');
  const [activeTier, setActiveTier] = useState<'All' | PriceTier>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<Car['id'][]>([]);
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(0);

  const fetchCars = async () => {
    try {
      const response = await fetch(api('/api/inventory'));
      const data = await response.json();
      if (response.ok) {
        setCars(data.map(normalizeCar));
      }
    } catch (err) {
      console.error('Failed to fetch inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch every time this screen comes back into focus (e.g. after
  // returning from Add/Edit), so the list is never stale.
  useFocusEffect(
    useCallback(() => {
      fetchCars();
    }, [])
  );

  // Price tier per car (K-Means over the whole inventory) — a lookup so
  // each card can show its own badge and the tier tabs can filter by it.
  const tierById = useMemo(() => {
    const map = new Map<Car['id'], PriceTier>();
    clusterPricesLocally(cars).forEach((c) => map.set(c.id, c.priceTier));
    return map;
  }, [cars]);

  const types = useMemo(() => {
    const unique = Array.from(new Set(cars.map((c) => c.type).filter(Boolean)));
    return ['All', ...unique];
  }, [cars]);

  const brands = useMemo(() => {
    const unique = Array.from(new Set(cars.map(brandOf).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    return ['All', ...unique];
  }, [cars]);

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const activeFilterCount =
    (filters.minPrice.trim() ? 1 : 0) +
    (filters.maxPrice.trim() ? 1 : 0) +
    (filters.minYear.trim() ? 1 : 0) +
    (filters.maxMileage.trim() ? 1 : 0) +
    (filters.brand !== 'All' ? 1 : 0) +
    (filters.fuel !== 'All' ? 1 : 0) +
    (filters.transmission !== 'All' ? 1 : 0) +
    (filters.sort !== 'newest' ? 1 : 0) +
    (filters.onlyMine ? 1 : 0);

  const filteredCars = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const minPrice = parseNum(filters.minPrice);
    const maxPrice = parseNum(filters.maxPrice);
    const minYear = parseNum(filters.minYear);
    const maxMileage = parseNum(filters.maxMileage);

    const list = cars.filter((item) => {
      if (activeType !== 'All' && item.type !== activeType) return false;
      if (activeTier !== 'All' && tierById.get(item.id) !== activeTier) return false;
      if (q && !`${item.name} ${item.model} ${item.type}`.toLowerCase().includes(q)) return false;
      if (filters.brand !== 'All' && brandOf(item) !== filters.brand) return false;
      if (minPrice != null && item.price < minPrice) return false;
      if (maxPrice != null && item.price > maxPrice) return false;
      if (minYear != null && (item.year == null || item.year < minYear)) return false;
      if (maxMileage != null && (item.mileage == null || item.mileage > maxMileage)) return false;
      if (filters.fuel !== 'All' && item.fuel !== filters.fuel) return false;
      if (filters.transmission !== 'All' && item.transmission !== filters.transmission) return false;
      if (filters.onlyMine && !(user && item.sellerId != null && Number(item.sellerId) === Number(user.id))) return false;
      return true;
    });

    const sorted = [...list];
    switch (filters.sort) {
      case 'price_asc': sorted.sort((a, b) => a.price - b.price); break;
      case 'price_desc': sorted.sort((a, b) => b.price - a.price); break;
      case 'year_desc': sorted.sort((a, b) => (b.year ?? 0) - (a.year ?? 0)); break;
      case 'mileage_asc': sorted.sort((a, b) => (a.mileage ?? Infinity) - (b.mileage ?? Infinity)); break;
      default: break; // server already returns newest listings first
    }
    return sorted;
  }, [cars, activeType, activeTier, searchQuery, filters, tierById, user]);

  const sectionTitle = searchQuery
    ? `ผลการค้นหา "${searchQuery}"`
    : filters.onlyMine
    ? 'รถที่ฉันลงขาย'
    : [filters.brand !== 'All' ? filters.brand : '', activeType !== 'All' ? activeType : ''].filter(Boolean).join(' · ') || 'รถทั้งหมด';

  // ---------- Feature shortcuts ----------
  const goSell = () => {
    if (!user) {
      notify('กรุณาเข้าสู่ระบบด้วยบัญชีผู้ขายก่อนลงขายรถ');
      router.push('/login');
    } else if (canSell(user)) {
      router.push('/add');
    } else {
      confirmAction(
        'ต้องใช้บัญชีผู้ขาย',
        'บัญชีนี้เป็นบัญชีผู้ซื้อ ลงขายรถได้เฉพาะบัญชีผู้ขาย ต้องการออกจากระบบแล้วสมัครบัญชีผู้ขายไหม?',
        () => {
          logout();
          router.push({ pathname: '/register', params: { role: 'seller' } });
        },
        'สมัครผู้ขาย'
      );
    }
  };

  const goMessages = () => {
    if (!user) {
      notify('กรุณาเข้าสู่ระบบก่อนดูข้อความ');
      router.push('/login');
    } else router.push('/inbox');
  };

  const startCompare = () => {
    setCompareMode(true);
    setCompareIds([]);
  };

  const FEATURES = [
    { key: 'sell', icon: '＋', title: 'ลงขายรถ', desc: 'สำหรับผู้ขาย', onPress: goSell },
    { key: 'filter', icon: '☰', title: 'กรองรถ', desc: 'ยี่ห้อ ราคา ปี ไมล์', onPress: () => setFiltersOpen((v) => !v) },
    { key: 'chat', icon: '✉', title: 'ติดต่อผู้ขาย', desc: 'แชท / นัดดูรถ', onPress: goMessages },
    { key: 'ai', icon: '✦', title: 'AI แนะนำรถ', desc: 'ตามงบและการใช้งาน', onPress: () => router.push('/ai-advisor') },
    { key: 'compare', icon: '⇄', title: 'เปรียบเทียบรถ', desc: 'AI/ML 2–4 คัน', onPress: startCompare },
  ];

  const handleLogout = () => {
    logout();
    if (Platform.OS === 'web') window.alert('ออกจากระบบแล้ว');
    router.replace('/login');
  };

  const doDelete = async (id: number | string) => {
    try {
      const res = await fetch(api(`/api/inventory/${id}`), {
        method: 'DELETE',
        headers: authHeaders(user?.token, false),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchCars();
      } else {
        notify(data.error || 'Failed to delete car');
      }
    } catch (err) {
      console.error(err);
      notify('Unable to delete car');
    }
  };

  const handleDeletePress = (id: number | string, name: string) =>
    confirmAction('Delete car', `Are you sure you want to delete "${name}"?`, () => doDelete(id));

  const openDetail = (item: Car) => {
    router.push({ pathname: '/details', params: { car: JSON.stringify(item) } });
  };

  // ---------- Compare selection ----------
  const toggleCompare = (id: Car['id']) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_COMPARE) {
        notify(`You can compare up to ${MAX_COMPARE} cars`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const exitCompare = () => {
    setCompareMode(false);
    setCompareIds([]);
  };

  const goCompare = () => {
    router.push({ pathname: '/compare', params: { ids: compareIds.join(',') } });
  };

  const scrollByStep = (direction: 1 | -1) => {
    const next = Math.max(0, scrollX.current + direction * scrollStep * 2);
    scrollRef.current?.scrollTo({ x: next, animated: true });
  };

  const openSearch = () => {
    setSearchDraft(searchQuery);
    setSearchOpen(true);
  };

  const applySearch = (value: string) => {
    setSearchQuery(value);
    setSearchOpen(false);
  };

  const cancelSearch = () => {
    setSearchOpen(false);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: compareMode ? 110 : 30 }}>
        <View style={styles.pageInner}>
          {/* Top bar: brand + account actions */}
          <View style={styles.topBar}>
            <Text style={styles.brandTitle}>Noon Home Car</Text>

            <View style={styles.topBarActions}>
              <TouchableOpacity style={styles.searchPill} onPress={openSearch}>
                <SearchIcon size={12} color="#B0B0B0" />
                <Text style={styles.searchPillText} numberOfLines={1}>
                  {searchQuery || 'ค้นหารถ'}
                </Text>
              </TouchableOpacity>

              {user ? (
                <TouchableOpacity style={styles.actionBtnOutline} onPress={handleLogout}>
                  <Text style={styles.actionBtnOutlineText}>ออกจากระบบ</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.actionBtnPrimary} onPress={() => router.push('/login')}>
                  <Text style={styles.actionBtnPrimaryText}>เข้าสู่ระบบ</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <Text style={styles.welcomeText}>
            {user
              ? `สวัสดี ${user.username} · บัญชี${ROLE_LABEL[user.role] ?? user.role}`
              : 'ยังไม่ได้เข้าสู่ระบบ · ดูรถได้เลย หรือเข้าสู่ระบบเพื่อลงขาย/ติดต่อผู้ขาย'}
          </Text>

          {/* The marketplace features, always visible so nothing is hidden behind a role */}
          <View style={styles.featureGrid}>
            {FEATURES.map((f) => {
              const active = (f.key === 'filter' && filtersOpen) || (f.key === 'compare' && compareMode);
              return (
                <Pressable
                  key={f.key}
                  onPress={f.onPress}
                  style={({ hovered }: any) => [styles.featureCard, (active || hovered) && styles.featureCardActive]}
                >
                  <Text style={styles.featureIcon}>{f.icon}</Text>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureDesc}>{f.desc}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.detailHint}>แตะที่รถคันไหนก็ได้เพื่อดูรายละเอียดรถ และทักแชทหรือนัดดูรถกับผู้ขาย</Text>

          {/* Brand tabs (Toyota / Honda / ...) */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsRow}>
            {brands.map((b) => {
              const active = b === filters.brand;
              return (
                <TouchableOpacity
                  key={b}
                  style={[styles.tabPill, active && styles.tabPillActive]}
                  onPress={() => setFilter('brand', b)}
                >
                  <Text style={[styles.tabPillText, active && styles.tabPillTextActive]}>{b === 'All' ? 'ทุกยี่ห้อ' : b}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Type tabs (Sedan / SUV / Sports Car / ...) */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tierTabsRow}>
            {types.map((t) => {
              const active = t === activeType;
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.tierTabPill, active && styles.tierTabPillActive]}
                  onPress={() => setActiveType(t)}
                >
                  <Text style={[styles.tierTabPillText, active && styles.tierTabPillTextActive]}>{t === 'All' ? 'ทุกประเภท' : t}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Price tiers (K-Means) + advanced filter toggle */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tierTabsRow}>
            {(['All', 'Low', 'Mid', 'High'] as const).map((tier) => {
              const active = tier === activeTier;
              return (
                <TouchableOpacity
                  key={tier}
                  style={[styles.tierTabPill, active && styles.tierTabPillActive]}
                  onPress={() => setActiveTier(tier)}
                >
                  <Text style={[styles.tierTabPillText, active && styles.tierTabPillTextActive]}>
                    {TIER_LABEL[tier]}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={[styles.filterToggle, (filtersOpen || activeFilterCount > 0) && styles.filterToggleActive]}
              onPress={() => setFiltersOpen((v) => !v)}
            >
              <Text style={styles.filterToggleText}>
                {`${filtersOpen ? '▲' : '▼'} ตัวกรองเพิ่มเติม${activeFilterCount ? ` (${activeFilterCount})` : ''}`}
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {filtersOpen && (
            <View style={styles.filterPanel}>
              <View style={styles.filterInputs}>
                {([
                  ['minPrice', 'ราคาต่ำสุด (บาท)'],
                  ['maxPrice', 'ราคาสูงสุด (บาท)'],
                  ['minYear', 'ปีรถตั้งแต่'],
                  ['maxMileage', 'ไมล์ไม่เกิน (กม.)'],
                ] as const).map(([key, label]) => (
                  <View key={key} style={styles.filterInputWrap}>
                    <Text style={styles.filterLabel}>{label}</Text>
                    <TextInput
                      style={styles.filterInput}
                      value={filters[key]}
                      onChangeText={(v) => setFilter(key, v)}
                      keyboardType="numeric"
                      placeholder="ไม่จำกัด"
                      placeholderTextColor="#555"
                    />
                  </View>
                ))}
              </View>

              <Text style={styles.filterLabel}>ยี่ห้อ</Text>
              <View style={styles.filterPills}>
                {brands.map((b) => (
                  <Pill key={b} small label={b === 'All' ? 'ทั้งหมด' : b} active={filters.brand === b} onPress={() => setFilter('brand', b)} />
                ))}
              </View>

              <Text style={styles.filterLabel}>เชื้อเพลิง</Text>
              <View style={styles.filterPills}>
                {['All', ...FUELS].map((f) => (
                  <Pill key={f} small label={f === 'All' ? 'ทั้งหมด' : f} active={filters.fuel === f} onPress={() => setFilter('fuel', f)} />
                ))}
              </View>

              <Text style={styles.filterLabel}>เกียร์</Text>
              <View style={styles.filterPills}>
                {['All', ...TRANSMISSIONS].map((t) => (
                  <Pill key={t} small label={t === 'All' ? 'ทั้งหมด' : t} active={filters.transmission === t} onPress={() => setFilter('transmission', t)} />
                ))}
              </View>

              <Text style={styles.filterLabel}>เรียงตาม</Text>
              <View style={styles.filterPills}>
                {SORTS.map((s) => (
                  <Pill key={s.key} small label={s.label} active={filters.sort === s.key} onPress={() => setFilter('sort', s.key)} />
                ))}
              </View>

              <View style={styles.filterFooter}>
                {canSell(user) && (
                  <Pill small label="เฉพาะรถที่ฉันลงขาย" active={filters.onlyMine} onPress={() => setFilter('onlyMine', !filters.onlyMine)} />
                )}
                <TouchableOpacity
                  onPress={() => {
                    setFilters(EMPTY_FILTERS);
                    setActiveType('All');
                    setActiveTier('All');
                  }}
                >
                  <Text style={styles.resetText}>ล้างตัวกรองทั้งหมด</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Section header with compare toggle + prev/next arrows */}
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>{sectionTitle}</Text>
              <Text style={styles.countText}>{`${filteredCars.length} คัน`}</Text>
            </View>
            <View style={styles.arrowRow}>
              <TouchableOpacity
                style={[styles.compareToggle, compareMode && styles.compareToggleActive]}
                onPress={() => (compareMode ? exitCompare() : startCompare())}
              >
                <Text style={styles.compareToggleText}>{compareMode ? 'ยกเลิกเปรียบเทียบ' : '⇄ เปรียบเทียบรถ'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.arrowBtn} onPress={() => scrollByStep(-1)}>
                <Text style={styles.arrowText}>{'‹'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.arrowBtn} onPress={() => scrollByStep(1)}>
                <Text style={styles.arrowText}>{'›'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {compareMode && (
            <Text style={styles.compareHint}>{`โหมดเปรียบเทียบ: แตะเลือกรถ 2–${MAX_COMPARE} คัน แล้วกด "เปรียบเทียบด้วย AI" ด้านล่าง`}</Text>
          )}

          {loading ? (
            <Text style={styles.emptyText}>กำลังโหลดรถ…</Text>
          ) : filteredCars.length === 0 ? (
            <Text style={styles.emptyText}>ไม่พบรถที่ตรงกับตัวกรอง</Text>
          ) : (
            <ScrollView
              ref={scrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              onScroll={(e) => { scrollX.current = e.nativeEvent.contentOffset.x; }}
              scrollEventThrottle={16}
              style={{ minHeight: cardHeight, flexGrow: 0 }}
              contentContainerStyle={styles.carousel}
            >
              {filteredCars.map((item) => {
                const isLow = item.stock < 2;
                const tier = tierById.get(item.id);
                const selected = compareIds.includes(item.id);
                const subtitle = [item.year, item.model || item.type, item.mileage != null ? `${item.mileage.toLocaleString()} km` : null]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => (compareMode ? toggleCompare(item.id) : openDetail(item))}
                    style={({ hovered, pressed }: any) => [
                      styles.card,
                      { width: cardWidth },
                      hovered && styles.cardHovered,
                      pressed && styles.cardPressed,
                      selected && styles.cardSelected,
                    ]}
                  >
                    <View style={styles.imageWrap}>
                      {item.image ? (
                        <Image source={{ uri: item.image }} style={styles.carImage} resizeMode="cover" />
                      ) : (
                        <ImagePlaceholder />
                      )}
                      {tier && (
                        <View
                          style={[
                            styles.tierBadge,
                            tier === 'Low' && styles.tierBadgeLow,
                            tier === 'Mid' && styles.tierBadgeMid,
                            tier === 'High' && styles.tierBadgeHigh,
                          ]}
                        >
                          <Text style={[styles.tierBadgeText, tier === 'Low' && styles.tierBadgeTextLow]}>
                            {TIER_LABEL[tier]}
                          </Text>
                        </View>
                      )}
                      {isLow && (
                        <View style={styles.stockTag}>
                          <Text style={styles.stockTagText}>
                            {item.stock === 0 ? 'ขายแล้ว' : `เหลือ ${item.stock} คัน`}
                          </Text>
                        </View>
                      )}
                      {compareMode && (
                        <View style={[styles.checkBox, selected && styles.checkBoxOn]}>
                          <Text style={styles.checkMark}>{selected ? '✓' : ''}</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.cardInfo}>
                      <Text style={styles.carName} numberOfLines={2}>{item.name}</Text>
                      <Text style={styles.carModel} numberOfLines={1}>{subtitle}</Text>
                      <Text style={styles.carPrice}>{formatTHB(item.price)}</Text>
                    </View>

                    {!compareMode && canManageCar(user, item) && (
                      <View style={styles.adminActionRow}>
                        <TouchableOpacity
                          style={styles.editBtn}
                          onPress={() => router.push({ pathname: '/edit', params: { car: JSON.stringify(item) } })}
                        >
                          <Text style={styles.editText}>แก้ไข</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeletePress(item.id, item.name)}>
                          <Text style={styles.deleteText}>ลบ</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      </ScrollView>

      {/* Compare tray */}
      {compareMode && (
        <View style={styles.compareBar}>
          <Text style={styles.compareBarText}>
            {`เลือกแล้ว ${compareIds.length} คัน${compareIds.length < 2 ? ' — เลือกอย่างน้อย 2 คัน' : ''}`}
          </Text>
          <View style={styles.compareBarActions}>
            <TouchableOpacity onPress={() => setCompareIds([])}>
              <Text style={styles.resetText}>ล้าง</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.compareGo, compareIds.length < 2 && { opacity: 0.4 }]}
              disabled={compareIds.length < 2}
              onPress={goCompare}
            >
              <Text style={styles.compareGoText}>เปรียบเทียบด้วย AI</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Half-screen search panel — the carousel stays visible below it */}
      {searchOpen && (
        <>
          <Pressable style={[styles.searchBackdrop, { top: searchOverlayHeight }]} onPress={cancelSearch} />
          <View style={[styles.searchOverlay, { height: searchOverlayHeight }]}>
            <SafeAreaView style={styles.searchOverlayInner}>
              <View style={styles.searchOverlayTopRow}>
                <View style={styles.searchOverlayInputWrap}>
                  <SearchIcon size={14} color="#E4001B" />
                  <TextInput
                    style={styles.searchOverlayInput}
                    placeholder="ค้นหาชื่อรถ รุ่น หรือประเภท..."
                    placeholderTextColor="#999"
                    value={searchDraft}
                    onChangeText={setSearchDraft}
                    autoFocus
                    onSubmitEditing={() => applySearch(searchDraft)}
                    returnKeyType="search"
                  />
                </View>
                <TouchableOpacity onPress={cancelSearch}>
                  <Text style={styles.cancelText}>ยกเลิก</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.popularLabel}>ยี่ห้อ</Text>
              <View style={styles.popularTags}>
                {brands.filter((b) => b !== 'All').map((b) => (
                  <TouchableOpacity
                    key={b}
                    style={styles.popularTag}
                    onPress={() => {
                      setFilter('brand', b);
                      applySearch('');
                    }}
                  >
                    <Text style={styles.popularTagText}>{b}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.popularLabel}>ประเภทรถ</Text>
              <View style={styles.popularTags}>
                {types.filter((t) => t !== 'All').map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={styles.popularTag}
                    onPress={() => {
                      setActiveType(t);
                      applySearch('');
                    }}
                  >
                    <Text style={styles.popularTagText}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </SafeAreaView>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Palette: near-black background, a single racing-red accent for
  // anything actionable or urgent (buttons, price, low-stock/sold-out),
  // everything else stays grayscale so the red actually stands out.
  screen: { flex: 1, backgroundColor: C.bg },
  pageInner: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 16 },

  topBar: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  brandTitle: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  welcomeText: { fontSize: 12, color: C.muted, marginTop: 6, marginBottom: 4 },

  topBarActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },

  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  featureCard: {
    flexGrow: 1,
    flexBasis: 150,
    padding: 12,
    borderRadius: 10,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  featureCardActive: { borderColor: C.red, backgroundColor: '#1F0A0C' },
  featureIcon: { color: C.red, fontSize: 18, fontWeight: '900', marginBottom: 4 },
  featureTitle: { color: '#fff', fontSize: 14, fontWeight: '800' },
  featureDesc: { color: C.muted, fontSize: 11, marginTop: 2 },
  detailHint: { color: C.muted, fontSize: 12, marginTop: 10 },

  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.input,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxWidth: 160,
    gap: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  searchPillText: { fontSize: 13, color: '#B0B0B0' },

  actionBtnPrimary: { backgroundColor: C.red, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  actionBtnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  actionBtnOutline: { borderWidth: 1, borderColor: C.borderStrong, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  actionBtnOutlineText: { color: '#fff', fontWeight: '600', fontSize: 12 },

  tabsRow: { marginTop: 18, flexGrow: 0 },
  tabPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: C.input, borderWidth: 1, borderColor: C.border },
  tabPillActive: { backgroundColor: C.red, borderColor: C.red },
  tabPillText: { fontSize: 13, fontWeight: '600', color: C.soft },
  tabPillTextActive: { color: '#fff' },

  // Price-tier tabs — same pill style as type tabs, on their own row.
  tierTabsRow: { marginTop: 10, flexGrow: 0 },
  tierTabPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: C.borderStrong },
  tierTabPillActive: { backgroundColor: C.red, borderColor: C.red },
  tierTabPillText: { fontSize: 12, fontWeight: '600', color: C.soft },
  tierTabPillTextActive: { color: '#fff' },

  filterToggle: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: C.borderStrong, backgroundColor: C.input },
  filterToggleActive: { borderColor: C.red },
  filterToggleText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  filterPanel: { marginTop: 12, padding: 14, borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  filterInputs: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 6 },
  filterInputWrap: { flexGrow: 1, flexBasis: 130 },
  filterLabel: { fontSize: 11, fontWeight: '700', color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  filterInput: { backgroundColor: C.input, borderWidth: 1, borderColor: '#2A2A2A', color: '#fff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, marginBottom: 8 },
  filterPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  filterFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
  resetText: { color: '#999', fontWeight: '700', fontSize: 13 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 10, gap: 10, flexWrap: 'wrap' },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  countText: { fontSize: 12, color: C.muted, marginTop: 2 },
  arrowRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  arrowBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: C.borderStrong, alignItems: 'center', justifyContent: 'center' },
  arrowText: { fontSize: 18, color: '#fff', fontWeight: '700' },
  compareToggle: { paddingHorizontal: 12, height: 34, borderRadius: 17, borderWidth: 1, borderColor: C.borderStrong, justifyContent: 'center' },
  compareToggleActive: { borderColor: C.red, backgroundColor: '#1F0A0C' },
  compareToggleText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  compareHint: { color: C.muted, fontSize: 12, marginBottom: 10 },

  emptyText: { color: '#777', textAlign: 'center', marginTop: 60 },

  carousel: { gap: CARD_GAP, alignItems: 'flex-start' },
  card: {
    backgroundColor: C.card,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    alignSelf: 'flex-start',
    ...(Platform.OS === 'web'
      ? ({ transitionProperty: 'transform, box-shadow, border-color', transitionDuration: '150ms' } as any)
      : null),
  },
  cardHovered: Platform.OS === 'web'
    ? ({ transform: [{ translateY: -4 }], borderColor: C.red, boxShadow: '0 10px 24px rgba(228,0,27,0.18)' } as any)
    : {},
  cardPressed: { opacity: 0.9 },
  cardSelected: { borderColor: C.red, borderWidth: 2 },

  imageWrap: { width: '100%', aspectRatio: 4 / 3, backgroundColor: '#1E1E1E' },
  carImage: { width: '100%', height: '100%' },

  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#161616', paddingHorizontal: 10, borderBottomWidth: 2, borderBottomColor: C.red },
  placeholderText: { color: C.red, fontSize: 18, fontWeight: '800', letterSpacing: 3 },

  stockTag: { position: 'absolute', left: 0, bottom: 0, backgroundColor: C.red, paddingHorizontal: 8, paddingVertical: 4 },
  stockTagText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  checkBox: { position: 'absolute', left: 8, top: 8, width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: '#fff', backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  checkBoxOn: { backgroundColor: C.red, borderColor: C.red },
  checkMark: { color: '#fff', fontWeight: '900', fontSize: 14 },

  cardInfo: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 8 },
  carName: { fontSize: 13, fontWeight: '600', color: '#fff', lineHeight: 17 },
  carModel: { fontSize: 12, color: '#8C8C8C', marginTop: 3 },
  carPrice: { fontSize: 13, fontWeight: '700', color: C.red, marginTop: 4 },

  adminActionRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingBottom: 10, paddingTop: 2 },
  editBtn: { flex: 1, backgroundColor: 'transparent', paddingVertical: 6, borderRadius: 6, alignItems: 'center', borderWidth: 1, borderColor: '#3A3A3A' },
  editText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  deleteBtn: { flex: 1, backgroundColor: C.red, paddingVertical: 6, borderRadius: 6, alignItems: 'center' },
  deleteText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },

  // Price-tier badge on each card — red intensity (muted → solid) marks
  // Low/Mid/High. Sits opposite the low-stock tag so they never collide.
  tierBadge: { position: 'absolute', right: 0, top: 0, paddingHorizontal: 8, paddingVertical: 4, borderBottomLeftRadius: 6 },
  tierBadgeLow: { backgroundColor: '#2A2A2A' },
  tierBadgeMid: { backgroundColor: C.redDim },
  tierBadgeHigh: { backgroundColor: C.red },
  tierBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  tierBadgeTextLow: { color: C.soft },

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
    zIndex: 10,
  },
  compareBarText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  compareBarActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  compareGo: { backgroundColor: C.red, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  compareGoText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  // Search overlay: a dropdown panel over the top half of the screen, with
  // a dim backdrop over the remaining area so the carousel still peeks
  // through and tapping it closes the search.
  searchBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 15,
  },
  searchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: C.panel,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    zIndex: 20,
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 12px 24px rgba(0,0,0,0.5)' } as any) : null),
  },
  searchOverlayInner: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  searchOverlayTopRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  searchOverlayInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.input,
    borderWidth: 1.5,
    borderColor: C.red,
    borderRadius: 10,
    paddingHorizontal: 14,
    gap: 8,
  },
  searchOverlayInput: { flex: 1, paddingVertical: 10, fontSize: 15, color: '#fff' },
  cancelText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  popularLabel: { fontSize: 13, color: C.muted, fontWeight: '600', marginTop: 28, marginBottom: 12 },
  popularTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  popularTag: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: C.input, borderWidth: 1, borderColor: C.border },
  popularTagText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
