import { api } from '@/config';
import { C, formatKm, formatTHB, notify } from '@/lib/cars';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
  { label: 'Ignore', value: 0 },
  { label: 'Normal', value: 1 },
  { label: 'Important', value: 2 },
];

const LABEL_W = 130;
const COL_W = 180;

const DEAL_COLOR: Record<string, string> = { 'Good deal': C.green, 'Fair price': C.soft, 'Above market': C.amber };

export default function CompareScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ ids?: string }>();
  const ids = useMemo(() => (params.ids || '').split(',').filter(Boolean), [params.ids]);

  const [priorities, setPriorities] = useState<Record<string, number>>({});
  const [data, setData] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (ids.length < 2) {
      setError('Pick at least 2 cars to compare');
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
        } else setError(json.error || 'Comparison failed');
      })
      .catch(() => !cancelled && notify('Cannot connect to server'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [ids, priorities]);

  const nameOf = (id: number) => data?.cars.find((c) => c.id === id)?.name ?? '';

  const specRows: [string, (c: CompareCar) => string][] = [
    ['Price', (c) => formatTHB(c.price)],
    ['Est. monthly', (c) => `${formatTHB(c.monthly)}/mo`],
    ['Year', (c) => (c.year ? String(c.year) : '—')],
    ['Mileage', (c) => formatKm(c.mileage)],
    ['Type', (c) => c.type || '—'],
    ['Fuel', (c) => c.fuel || '—'],
    ['Transmission', (c) => c.transmission || '—'],
    ['Seats', (c) => (c.seats ? String(c.seats) : '—')],
    ['Engine', (c) => (c.fuel === 'EV' ? 'Electric' : c.engineCc ? `${c.engineCc.toLocaleString()} cc` : '—')],
    ['Economy', (c) => (c.fuel === 'EV' ? 'EV' : c.fuelEconomy ? `${c.fuelEconomy} km/l` : '—')],
  ];

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.page}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 12 }}>
          <Text style={styles.back}>{'←'} Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>⇄ AI Car Comparison</Text>

        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : !data ? (
          <ActivityIndicator color={C.red} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Summary */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryHead}>
                <Text style={styles.summaryTitle}>AI verdict</Text>
                <Text style={styles.sourceTag}>{data.summarySource === 'claude' ? 'Claude' : 'Scoring model'}</Text>
              </View>
              <Text style={styles.summaryText}>{data.summary}</Text>
              {loading && <ActivityIndicator color="#fff" style={{ marginTop: 8, alignSelf: 'flex-start' }} />}
            </View>

            {/* Priorities */}
            <View style={styles.panel}>
              <Text style={styles.blockTitle}>What matters to you?</Text>
              <Text style={styles.hint}>Changes how the overall score is weighted.</Text>
              {data.dimensions.map((d) => {
                const current = priorities[d.key] ?? 1;
                return (
                  <View key={d.key} style={styles.priorityRow}>
                    <Text style={styles.priorityLabel}>{d.label}</Text>
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
                        {c.image ? <Image source={{ uri: c.image }} style={styles.img} /> : <Text style={styles.thumbText}>NOON</Text>}
                      </View>
                      <Text style={styles.headName} numberOfLines={2}>{c.name}</Text>
                      {c.id === data.bestOverallId && <Text style={styles.bestTag}>★ BEST OVERALL</Text>}
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

                <Text style={styles.groupTitle}>AI scores (0–100)</Text>
                {data.dimensions.map((d) => (
                  <View key={d.key} style={styles.tr}>
                    <Text style={[styles.labelCell, styles.labelText, d.weight === 0 && { opacity: 0.4 }]}>{d.label}</Text>
                    {data.cars.map((c) => {
                      const s = c.scores[d.key];
                      const win = data.winners[d.key] === c.id;
                      return (
                        <View key={c.id} style={styles.cell}>
                          {s == null ? (
                            <Text style={styles.cellMuted}>n/a</Text>
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
                  <Text style={[styles.labelCell, styles.labelText, { color: '#fff' }]}>Overall</Text>
                  {data.cars.map((c) => (
                    <Text key={c.id} style={[styles.cell, styles.overallText, c.id === data.bestOverallId && { color: C.red }]}>
                      {c.overall ?? '—'}
                    </Text>
                  ))}
                </View>

                {data.priceModel?.used && (
                  <>
                    <Text style={styles.groupTitle}>Market price (ML model)</Text>
                    <View style={styles.tr}>
                      <Text style={[styles.labelCell, styles.labelText]}>Est. fair price</Text>
                      {data.cars.map((c) => (
                        <View key={c.id} style={styles.cell}>
                          <Text style={styles.cellText}>{formatTHB(c.fairPrice)}</Text>
                          {c.dealLabel && (
                            <Text style={[styles.dealText, { color: DEAL_COLOR[c.dealLabel] }]}>
                              {c.dealLabel}
                              {c.dealPct ? ` (${c.dealPct > 0 ? '-' : '+'}${Math.abs(c.dealPct)}%)` : ''}
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
                <Text style={styles.blockTitle}>How similar are they?</Text>
                {data.similarity.map((s) => (
                  <View key={`${s.a}-${s.b}`} style={styles.simRow}>
                    <Text style={styles.simNames} numberOfLines={1}>{nameOf(s.a)} ↔ {nameOf(s.b)}</Text>
                    <Text style={styles.simPct}>{s.percent}%</Text>
                  </View>
                ))}
                <Text style={styles.hint}>High similarity means they compete for the same buyer — pick on price and condition.</Text>
              </View>
            )}

            <Text style={styles.footnote}>
              Scores are relative to all cars in our inventory.
              {data.priceModel
                ? ` Fair price comes from a regression model trained on ${data.priceModel.samples} cars (R² ${data.priceModel.r2})${data.priceModel.used ? '' : ' — too inaccurate to use yet'}.`
                : ' Add year and mileage to more cars to enable fair-price estimates.'}
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
  sourceTag: { color: C.soft, fontSize: 11, fontWeight: '700', borderWidth: 1, borderColor: '#444', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
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
