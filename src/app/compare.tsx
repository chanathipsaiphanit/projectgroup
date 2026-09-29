import { api } from '@/config';
import { Heading } from '@/components/form-ui';
import { C, formatKm, formatTHB, notify, resolveImage, thFuel, thTransmission, thType } from '@/lib/cars';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useGoBack } from '@/lib/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type DimKey = 'value' | 'economy' | 'newness' | 'lowMileage' | 'space' | 'power';

type CompareCar = {
  id: number;
  name: string;
  model: string;
  type: string;
  price: number;
  image: string;
  year: number | null;
  mileage: number | null;
  fuel: string;
  transmission: string;
  seats: number | null;
  engineCc: number | null;
  fuelEconomy: number | null;
  scores: Record<DimKey, number | null>;
  overall: number | null;
  fairPrice: number | null;
  dealPct: number | null;
  dealLabel: 'Good deal' | 'Fair price' | 'Above market' | null;
  monthly: number;
};

type CompareResult = {
  cars: CompareCar[];
  dimensions: { key: DimKey; label: string; weight: number }[];
  winners: Record<DimKey, number | null>;
  bestOverallId: number | null;
  similarity: { a: number; b: number; percent: number }[];
  priceModel: { samples: number; r2: number; used: boolean } | null;
  summary: string;
  summarySource: 'claude' | 'rules';
};

const PRIORITY_LEVELS = [
  { label: 'ไม่สนใจ', value: 0 },
  { label: 'ปกติ', value: 1 },
  { label: 'สำคัญมาก', value: 2 },
];

const LABEL_W = 130;
const COL_W = 180;

const DEAL_COLOR: Record<string, string> = { 'Good deal': C.green, 'Fair price': C.soft, 'Above market': C.amber };
const DEAL_TH: Record<string, string> = { 'Good deal': 'ราคาดี คุ้มค่า', 'Fair price': 'ราคาเหมาะสม', 'Above market': 'แพงกว่าราคาตลาด' };

// Thai names for the scoring dimensions (the backend sends English keys)
const DIM_TH: Record<DimKey, string> = {
  value: 'ความคุ้มค่า',
  economy: 'ความประหยัดน้ำมัน',
  newness: 'ความใหม่ของรถ',
  lowMileage: 'ไมล์น้อย',
  space: 'ความจุ / ที่นั่ง',
  power: 'สมรรถนะ',
};

export default function CompareScreen() {
  const router = useRouter();
  const goBack = useGoBack();
  const params = useLocalSearchParams<{ ids?: string }>();
  const ids = useMemo(() => (params.ids || '').split(',').filter(Boolean), [params.ids]);

  const [priorities, setPriorities] = useState<Record<string, number>>({});
  const [data, setData] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (ids.length < 2) {
      setError('กรุณาเลือกรถอย่างน้อย 2 คันเพื่อเปรียบเทียบ');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(api('/api/ai/compare'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, priorities }),
    })
      .then(async (res) => {
        const json = await res.json();
        if (cancelled) return;
        if (res.ok) {
          setData(json);
          setError('');
        } else setError(json.error || 'เปรียบเทียบไม่สำเร็จ');
      })
      .catch(() => !cancelled && notify('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [ids, priorities]);

  const nameOf = (id: number) => data?.cars.find((c) => c.id === id)?.name ?? '';

  const specRows: [string, (c: CompareCar) => string][] = [
    ['ราคา', (c) => formatTHB(c.price)],
    ['ค่างวดโดยประมาณ', (c) => `${formatTHB(c.monthly)}/เดือน`],
    ['ปีรถ', (c) => (c.year ? String(c.year) : '—')],
    ['เลขไมล์', (c) => formatKm(c.mileage)],
    ['ประเภทรถ', (c) => thType(c.type)],
    ['เชื้อเพลิง', (c) => thFuel(c.fuel)],
    ['ระบบเกียร์', (c) => thTransmission(c.transmission)],
    ['จำนวนที่นั่ง', (c) => (c.seats ? `${c.seats} ที่นั่ง` : '—')],
    ['เครื่องยนต์', (c) => (c.fuel === 'EV' ? 'มอเตอร์ไฟฟ้า' : c.engineCc ? `${c.engineCc.toLocaleString()} ซีซี` : '—')],
    ['อัตราสิ้นเปลือง', (c) => (c.fuel === 'EV' ? 'ไฟฟ้า' : c.fuelEconomy ? `${c.fuelEconomy} กม./ลิตร` : '—')],
  ];

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.page}>
        <TouchableOpacity onPress={() => goBack()} style={{ marginBottom: 12 }}>
          <Text style={styles.back}>{'← ย้อนกลับ'}</Text>
        </TouchableOpacity>
        <Heading style={styles.title} th="⇄ เปรียบเทียบรถ" en="Compare Cars" />

        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : !data ? (
          <ActivityIndicator color={C.red} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Summary */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryHead}>
                <Heading style={styles.summaryTitle} th="สรุปผลการเปรียบเทียบ" en="Summary" />
              </View>
              <Text style={styles.summaryText}>{data.summary}</Text>
              {loading && <ActivityIndicator color="#fff" style={{ marginTop: 8, alignSelf: 'flex-start' }} />}
            </View>

            {/* Priorities */}
            <View style={styles.panel}>
              <Heading style={styles.blockTitle} th="คุณให้ความสำคัญกับอะไร?" en="Your Priorities" />
              <Text style={styles.hint}>ปรับน้ำหนักของคะแนนรวมตามสิ่งที่คุณสนใจ</Text>
              {data.dimensions.map((d) => {
                const current = priorities[d.key] ?? 1;
                return (
                  <View key={d.key} style={styles.priorityRow}>
                    <Text style={styles.priorityLabel}>{DIM_TH[d.key] ?? d.label}</Text>
                    <View style={styles.priorityPills}>
                      {PRIORITY_LEVELS.map((p) => (
                        <TouchableOpacity
                          key={p.value}
                          style={[styles.pPill, current === p.value && styles.pPillActive]}
                          onPress={() => setPriorities((prev) => ({ ...prev, [d.key]: p.value }))}
                        >
                          <Text style={[styles.pPillText, current === p.value && { color: '#fff' }]}>{p.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Comparison table */}
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View style={styles.table}>
                {/* Header */}
                <View style={styles.tr}>
                  <View style={[styles.labelCell, { justifyContent: 'flex-end' }]} />
                  {data.cars.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.headCell, c.id === data.bestOverallId && styles.headCellBest]}
                      onPress={() => router.push({ pathname: '/details', params: { id: String(c.id) } })}
                    >
                      <View style={styles.headImg}>
                        {c.image ? <Image source={{ uri: resolveImage(c.image) }} style={styles.img} /> : <Text style={styles.thumbText}>NOON</Text>}
                      </View>
                      <Text style={styles.headName} numberOfLines={2}>{c.name}</Text>
                      {c.id === data.bestOverallId && <Text style={styles.bestTag}>★ ดีที่สุดโดยรวม</Text>}
                    </TouchableOpacity>
                  ))}
                </View>

                {specRows.map(([label, get]) => (
                  <View key={label} style={styles.tr}>
                    <Text style={[styles.labelCell, styles.labelText]}>{label}</Text>
                    {data.cars.map((c) => (
                      <Text key={c.id} style={[styles.cell, styles.cellText]}>{get(c)}</Text>
                    ))}
                  </View>
                ))}

                <Heading style={styles.groupTitle} th="คะแนนแต่ละด้าน (0–100)" en="Scores" />
                {data.dimensions.map((d) => (
                  <View key={d.key} style={styles.tr}>
                    <Text style={[styles.labelCell, styles.labelText, d.weight === 0 && { opacity: 0.4 }]}>{DIM_TH[d.key] ?? d.label}</Text>
                    {data.cars.map((c) => {
                      const s = c.scores[d.key];
                      const win = data.winners[d.key] === c.id;
                      return (
                        <View key={c.id} style={styles.cell}>
                          {s == null ? (
                            <Text style={styles.cellMuted}>ไม่มีข้อมูล</Text>
                          ) : (
                            <>
                              <Text style={[styles.cellText, win && styles.winText]}>{win ? '★ ' : ''}{s}</Text>
                              <View style={styles.barTrack}>
                                <View style={[styles.barFill, { width: `${s}%` }, !win && { backgroundColor: '#555' }]} />
                              </View>
                            </>
                          )}
                        </View>
                      );
                    })}
                  </View>
                ))}

                <View style={[styles.tr, styles.overallRow]}>
                  <Text style={[styles.labelCell, styles.labelText, { color: '#fff' }]}>คะแนนรวม</Text>
                  {data.cars.map((c) => (
                    <Text key={c.id} style={[styles.cell, styles.overallText, c.id === data.bestOverallId && { color: C.red }]}>
                      {c.overall ?? '—'}
                    </Text>
                  ))}
                </View>

                {data.priceModel?.used && (
                  <>
                    <Heading style={styles.groupTitle} th="ราคาตลาดโดยประมาณ" en="Market Price" />
                    <View style={styles.tr}>
                      <Text style={[styles.labelCell, styles.labelText]}>ราคาที่เหมาะสม</Text>
                      {data.cars.map((c) => (
                        <View key={c.id} style={styles.cell}>
                          <Text style={styles.cellText}>{formatTHB(c.fairPrice)}</Text>
                          {c.dealLabel && (
                            <Text style={[styles.dealText, { color: DEAL_COLOR[c.dealLabel] }]}>
                              {`${DEAL_TH[c.dealLabel] ?? c.dealLabel}${c.dealPct ? ` (${c.dealPct > 0 ? '-' : '+'}${Math.abs(c.dealPct)}%)` : ''}`}
                            </Text>
                          )}
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </View>
            </ScrollView>

            {/* Similarity */}
            {data.similarity.length > 0 && (
              <View style={[styles.panel, { marginTop: 16 }]}>
                <Heading style={styles.blockTitle} th="รถแต่ละคันคล้ายกันแค่ไหน?" en="Similarity" />
                {data.similarity.map((s) => (
                  <View key={`${s.a}-${s.b}`} style={styles.simRow}>
                    <Text style={styles.simNames} numberOfLines={1}>{`${nameOf(s.a)} ↔ ${nameOf(s.b)}`}</Text>
                    <Text style={styles.simPct}>{s.percent}%</Text>
                  </View>
                ))}
                <Text style={styles.hint}>ถ้าคล้ายกันมาก แปลว่าเป็นรถกลุ่มเดียวกัน ให้ตัดสินใจจากราคาและสภาพรถ</Text>
              </View>
            )}

            <Text style={styles.footnote}>
              {`คะแนนเทียบกับรถทุกคันในสต็อก${
                data.priceModel
                  ? ` · ราคาตลาดประเมินจากรถ ${data.priceModel.samples} คันในระบบ${data.priceModel.used ? '' : ' (ข้อมูลยังไม่พอจะประเมินราคา)'}`
                  : ' · เพิ่มปีรถและเลขไมล์ให้รถหลายคันขึ้น เพื่อเปิดใช้การประเมินราคาตลาด'
              }`}
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  page: { width: '100%', maxWidth: 1000, alignSelf: 'center', padding: 20, paddingBottom: 40 },
  back: { color: '#999', fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '900', color: '#fff', marginBottom: 16 },
  error: { color: C.red, marginTop: 30, textAlign: 'center' },
  hint: { color: C.muted, fontSize: 12, marginBottom: 10 },

  summaryCard: { padding: 16, borderRadius: 10, backgroundColor: '#1F0A0C', borderWidth: 1, borderColor: C.red, marginBottom: 16 },
  summaryHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  summaryTitle: { color: '#fff', fontWeight: '900', fontSize: 15 },
  summaryText: { color: '#fff', fontSize: 14, lineHeight: 21 },

  panel: { padding: 16, borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, marginBottom: 16 },
  blockTitle: { color: '#fff', fontWeight: '800', fontSize: 15, marginBottom: 4 },
  priorityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, paddingVertical: 6 },
  priorityLabel: { color: C.soft, fontSize: 13, fontWeight: '600' },
  priorityPills: { flexDirection: 'row', gap: 6 },
  pPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1, borderColor: C.borderStrong },
  pPillActive: { backgroundColor: C.red, borderColor: C.red },
  pPillText: { color: C.muted, fontSize: 11, fontWeight: '700' },

  table: { borderWidth: 1, borderColor: C.border, borderRadius: 10, backgroundColor: C.card, paddingBottom: 6 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#1E1E1E' },
  labelCell: { width: LABEL_W, paddingHorizontal: 12, paddingVertical: 10 },
  labelText: { color: C.muted, fontSize: 12, fontWeight: '700' },
  headCell: { width: COL_W, padding: 10, borderLeftWidth: 1, borderLeftColor: '#1E1E1E' },
  headCellBest: { backgroundColor: '#1F0A0C' },
  headImg: { width: '100%', aspectRatio: 4 / 3, borderRadius: 6, backgroundColor: '#1E1E1E', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  img: { width: '100%', height: '100%' },
  thumbText: { color: C.red, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  headName: { color: '#fff', fontWeight: '800', fontSize: 14 },
  bestTag: { color: C.red, fontSize: 10, fontWeight: '900', marginTop: 4, letterSpacing: 0.5 },
  cell: { width: COL_W, paddingHorizontal: 12, paddingVertical: 10, borderLeftWidth: 1, borderLeftColor: '#1E1E1E' },
  cellText: { color: '#fff', fontSize: 13 },
  cellMuted: { color: '#555', fontSize: 12 },
  winText: { color: C.red, fontWeight: '900' },
  barTrack: { height: 4, borderRadius: 2, backgroundColor: '#262626', marginTop: 6, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: C.red },
  groupTitle: { color: '#fff', fontWeight: '800', fontSize: 13, paddingHorizontal: 12, paddingTop: 16, paddingBottom: 8 },
  overallRow: { backgroundColor: '#181818' },
  overallText: { color: '#fff', fontSize: 20, fontWeight: '900' },
  dealText: { fontSize: 12, fontWeight: '800', marginTop: 4 },

  simRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1E1E1E', gap: 10 },
  simNames: { color: C.soft, fontSize: 13, flex: 1 },
  simPct: { color: '#fff', fontWeight: '900', fontSize: 15 },

  footnote: { color: '#666', fontSize: 11, marginTop: 12, lineHeight: 16 },
});
