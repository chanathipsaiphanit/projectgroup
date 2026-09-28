import { Field, Pill, uiStyles } from '@/components/form-ui';
import { api } from '@/config';
import { C, formatTHB, FUELS, notify, TRANSMISSIONS } from '@/lib/cars';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const USAGES = [
  { key: 'city', label: 'City driving' },
  { key: 'family', label: 'Family' },
  { key: 'long_trip', label: 'Long trips' },
  { key: 'offroad', label: 'Off-road / upcountry' },
  { key: 'performance', label: 'Performance' },
  { key: 'economy', label: 'Low running cost' },
];

type AiCar = {
  id: number;
  name: string;
  model: string;
  type: string;
  price: number;
  image: string;
  year: number | null;
  mileage: number | null;
  fuel: string;
};

type Recommendation = {
  car: AiCar;
  score: number;
  reasons: string[];
  budgetStatus: 'within' | 'stretch' | 'none';
  monthly: number;
};

type AdviceResult = {
  results: Recommendation[];
  budget: {
    suggestedMin: number | null;
    suggestedMax: number | null;
    affordableMax: number | null;
    maxMonthly: number | null;
    notes: string[];
  };
  considered: number;
  summary: string;
  summarySource: 'claude' | 'rules';
};

const parseNum = (s: string) => {
  const n = Number(s.replace(/,/g, '').trim());
  return s.trim() && Number.isFinite(n) ? n : null;
};

export default function AiAdvisorScreen() {
  const router = useRouter();
  const [budget, setBudget] = useState('');
  const [income, setIncome] = useState('');
  const [passengers, setPassengers] = useState('');
  const [usages, setUsages] = useState<string[]>([]);
  const [fuel, setFuel] = useState('Any');
  const [transmission, setTransmission] = useState('Any');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AdviceResult | null>(null);

  const toggleUsage = (key: string) =>
    setUsages((prev) => (prev.includes(key) ? prev.filter((u) => u !== key) : [...prev, key]));

  const analyze = async () => {
    if (!budget.trim() && usages.length === 0) {
      notify('Tell us at least your budget or how you will use the car');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(api('/api/ai/recommend'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          budget: parseNum(budget),
          monthlyIncome: parseNum(income),
          passengers: parseNum(passengers),
          usages,
          fuel,
          transmission,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed');
      setResult(data);
    } catch (err: any) {
      notify(err.message || 'Cannot connect to server');
    } finally {
      setLoading(false);
    }
  };

  const compareTop = () => {
    if (!result) return;
    const ids = result.results.slice(0, 3).map((r) => r.car.id);
    router.push({ pathname: '/compare', params: { ids: ids.join(',') } });
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 12 }}>
          <Text style={styles.back}>{'←'} Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>✦ AI Car Advisor</Text>
        <Text style={styles.subtitle}>
          Tell us how you'll use the car and your budget — we'll score every car in stock and suggest a budget that fits.
        </Text>

        {/* ---------- Form ---------- */}
        <View style={styles.panel}>
          <View style={styles.row}>
            <Field label="Budget (THB)" placeholder="e.g. 900000" value={budget} onChangeText={setBudget} keyboardType="numeric" />
            <Field label="Monthly income (optional)" placeholder="e.g. 50000" value={income} onChangeText={setIncome} keyboardType="numeric" />
            <Field label="Passengers" placeholder="e.g. 5" value={passengers} onChangeText={setPassengers} keyboardType="numeric" />
          </View>

          <Text style={uiStyles.sectionLabel}>How will you use it? (pick any)</Text>
          <View style={styles.pills}>
            {USAGES.map((u) => (
              <Pill key={u.key} small label={u.label} active={usages.includes(u.key)} onPress={() => toggleUsage(u.key)} />
            ))}
          </View>

          <Text style={uiStyles.sectionLabel}>Fuel preference</Text>
          <View style={styles.pills}>
            {['Any', ...FUELS].map((f) => (
              <Pill key={f} small label={f} active={fuel === f} onPress={() => setFuel(f)} />
            ))}
          </View>

          <Text style={uiStyles.sectionLabel}>Transmission</Text>
          <View style={styles.pills}>
            {['Any', ...TRANSMISSIONS].map((t) => (
              <Pill key={t} small label={t} active={transmission === t} onPress={() => setTransmission(t)} />
            ))}
          </View>

          <Field
            label="Anything else? (optional)"
            placeholder="e.g. I drive Bangkok–Chonburi every weekend"
            value={notes}
            onChangeText={setNotes}
            multiline
            style={{ minHeight: 70, textAlignVertical: 'top' }}
          />

          <TouchableOpacity style={uiStyles.primaryBtn} onPress={analyze} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={uiStyles.primaryBtnText}>Analyze with AI</Text>}
          </TouchableOpacity>
        </View>

        {/* ---------- Results ---------- */}
        {result && (
          <>
            <View style={styles.summaryCard}>
              <View style={styles.summaryHead}>
                <Text style={styles.summaryTitle}>AI summary</Text>
                <Text style={styles.sourceTag}>{result.summarySource === 'claude' ? 'Claude' : 'Scoring model'}</Text>
              </View>
              <Text style={styles.summaryText}>{result.summary}</Text>
            </View>

            <View style={styles.panel}>
              <Text style={styles.blockTitle}>Budget analysis</Text>
              <View style={styles.statRow}>
                {result.budget.suggestedMin != null && (
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>Suggested range</Text>
                    <Text style={styles.statValue}>
                      {formatTHB(result.budget.suggestedMin)} – {formatTHB(result.budget.suggestedMax)}
                    </Text>
                  </View>
                )}
                {result.budget.affordableMax != null && (
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>Affordable up to</Text>
                    <Text style={styles.statValue}>{formatTHB(result.budget.affordableMax)}</Text>
                    <Text style={styles.statHint}>≤ {formatTHB(result.budget.maxMonthly)}/month</Text>
                  </View>
                )}
              </View>
              {result.budget.notes.map((n, i) => (
                <Text key={i} style={styles.note}>• {n}</Text>
              ))}
            </View>

            <View style={styles.resultsHead}>
              <Text style={styles.blockTitle}>Top matches ({result.results.length} of {result.considered} in stock)</Text>
              {result.results.length >= 2 && (
                <TouchableOpacity onPress={compareTop}>
                  <Text style={styles.link}>Compare top picks ⇄</Text>
                </TouchableOpacity>
              )}
            </View>

            {result.results.map((r, i) => (
              <TouchableOpacity
                key={r.car.id}
                style={styles.resultCard}
                onPress={() => router.push({ pathname: '/details', params: { id: String(r.car.id) } })}
              >
                <View style={styles.thumb}>
                  {r.car.image ? (
                    <Image source={{ uri: r.car.image }} style={styles.thumbImg} />
                  ) : (
                    <Text style={styles.thumbText}>NOON</Text>
                  )}
                  <View style={styles.rank}><Text style={styles.rankText}>#{i + 1}</Text></View>
                </View>

                <View style={{ flex: 1 }}>
                  <View style={styles.resultTop}>
                    <Text style={styles.carName} numberOfLines={1}>{r.car.name}</Text>
                    <Text style={styles.score}>{r.score}</Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${r.score}%` }]} />
                  </View>
                  <Text style={styles.meta}>
                    {[r.car.year, r.car.type, r.car.fuel].filter(Boolean).join(' · ')}
                  </Text>
                  <Text style={styles.price}>
                    {formatTHB(r.car.price)}
                    <Text style={styles.monthly}>  ≈ {formatTHB(r.monthly)}/mo</Text>
                  </Text>
                  {r.budgetStatus === 'stretch' && <Text style={styles.stretch}>Slightly over budget</Text>}
                  {r.reasons.map((reason) => (
                    <Text key={reason} style={styles.reason}>✓ {reason}</Text>
                  ))}
                </View>
              </TouchableOpacity>
            ))}

            <Text style={styles.disclaimer}>
              Installments are estimates (25% down, 5 years, 2.99% flat rate). Actual finance terms depend on the lender.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  page: { width: '100%', maxWidth: 820, alignSelf: 'center', padding: 20, paddingBottom: 40 },
  back: { color: '#999', fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '900', color: '#fff' },
  subtitle: { color: C.muted, fontSize: 13, marginTop: 6, marginBottom: 18, lineHeight: 19 },
  link: { color: C.red, fontWeight: '700' },

  panel: { padding: 16, borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, marginBottom: 16 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },

  summaryCard: { padding: 16, borderRadius: 10, backgroundColor: '#1F0A0C', borderWidth: 1, borderColor: C.red, marginBottom: 16 },
  summaryHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  summaryTitle: { color: '#fff', fontWeight: '900', fontSize: 15 },
  sourceTag: { color: C.soft, fontSize: 11, fontWeight: '700', borderWidth: 1, borderColor: '#444', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  summaryText: { color: '#fff', fontSize: 14, lineHeight: 21 },

  blockTitle: { color: '#fff', fontWeight: '800', fontSize: 15, marginBottom: 10 },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  stat: { flexGrow: 1, flexBasis: 200, padding: 12, borderRadius: 8, backgroundColor: C.input },
  statLabel: { color: C.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  statValue: { color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 4 },
  statHint: { color: C.muted, fontSize: 12, marginTop: 2 },
  note: { color: C.soft, fontSize: 13, lineHeight: 20, marginTop: 4 },

  resultsHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  resultCard: { flexDirection: 'row', gap: 14, padding: 12, borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, marginBottom: 10 },
  thumb: { width: 110, height: 82, borderRadius: 6, backgroundColor: '#1E1E1E', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  thumbImg: { width: '100%', height: '100%' },
  thumbText: { color: C.red, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  rank: { position: 'absolute', top: 0, left: 0, backgroundColor: C.red, paddingHorizontal: 6, paddingVertical: 2, borderBottomRightRadius: 6 },
  rankText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  resultTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  carName: { color: '#fff', fontWeight: '800', fontSize: 15, flex: 1 },
  score: { color: C.red, fontWeight: '900', fontSize: 18 },
  barTrack: { height: 5, borderRadius: 3, backgroundColor: '#262626', marginTop: 6, marginBottom: 6, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: C.red },
  meta: { color: C.muted, fontSize: 12 },
  price: { color: '#fff', fontWeight: '700', fontSize: 14, marginTop: 4 },
  monthly: { color: C.muted, fontWeight: '500', fontSize: 12 },
  stretch: { color: C.amber, fontSize: 12, fontWeight: '700', marginTop: 4 },
  reason: { color: C.soft, fontSize: 12, marginTop: 3 },
  disclaimer: { color: '#666', fontSize: 11, marginTop: 8, textAlign: 'center' },
});
