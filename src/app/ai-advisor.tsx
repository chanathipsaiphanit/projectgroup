import { Field, Heading, Pill, uiStyles } from '@/components/form-ui';
import { api } from '@/config';
import { C, formatTHB, FUELS, notify, resolveImage, thFuel, thTransmission, thType, TRANSMISSIONS } from '@/lib/cars';
import { useRouter } from 'expo-router';
import { useGoBack } from '@/lib/navigation';
import { useState } from 'react';
import { ActivityIndicator, Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const USAGES = [
  { key: 'city', label: 'ขับในเมือง' },
  { key: 'family', label: 'ใช้กับครอบครัว' },
  { key: 'long_trip', label: 'เดินทางไกล' },
  { key: 'offroad', label: 'ออฟโรด / ต่างจังหวัด' },
  { key: 'performance', label: 'สมรรถนะ / ขับสนุก' },
  { key: 'economy', label: 'ค่าใช้จ่ายต่ำ' },
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
  const goBack = useGoBack();
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
      notify('กรุณากรอกงบประมาณ หรือเลือกลักษณะการใช้งานอย่างน้อย 1 อย่าง');
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
      if (!res.ok) throw new Error(data.error || 'วิเคราะห์ไม่สำเร็จ');
      setResult(data);
    } catch (err: any) {
      notify(err.message || 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
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
        <TouchableOpacity onPress={() => goBack()} style={{ marginBottom: 12 }}>
          <Text style={styles.back}>{'← ย้อนกลับ'}</Text>
        </TouchableOpacity>

        <Heading style={styles.title} th="แนะนำรถให้คุณได้ที่นี่" en="Find Your Car" />
        <Text style={styles.subtitle}>
          บอกเราว่าจะใช้รถแบบไหนและมีงบเท่าไหร่ ระบบจะให้คะแนนรถมือสองทุกคันในสต็อก และแนะนำงบประมาณที่เหมาะกับคุณ
        </Text>

        {/* ---------- Form ---------- */}
        <View style={styles.panel}>
          <View style={styles.row}>
            <Field label="งบประมาณ (บาท)" placeholder="เช่น 900000" value={budget} onChangeText={setBudget} keyboardType="numeric" />
            <Field label="รายได้ต่อเดือน (ไม่บังคับ)" placeholder="เช่น 50000" value={income} onChangeText={setIncome} keyboardType="numeric" />
            <Field label="จำนวนผู้โดยสาร" placeholder="เช่น 5" value={passengers} onChangeText={setPassengers} keyboardType="numeric" />
          </View>

          <Text style={uiStyles.sectionLabel}>ใช้รถทำอะไรบ้าง? (เลือกได้หลายข้อ)</Text>
          <View style={styles.pills}>
            {USAGES.map((u) => (
              <Pill key={u.key} small label={u.label} active={usages.includes(u.key)} onPress={() => toggleUsage(u.key)} />
            ))}
          </View>

          <Text style={uiStyles.sectionLabel}>เชื้อเพลิงที่ต้องการ</Text>
          <View style={styles.pills}>
            {['Any', ...FUELS].map((f) => (
              <Pill key={f} small label={f === 'Any' ? 'ไม่ระบุ' : thFuel(f)} active={fuel === f} onPress={() => setFuel(f)} />
            ))}
          </View>

          <Text style={uiStyles.sectionLabel}>ระบบเกียร์</Text>
          <View style={styles.pills}>
            {['Any', ...TRANSMISSIONS].map((t) => (
              <Pill key={t} small label={t === 'Any' ? 'ไม่ระบุ' : thTransmission(t)} active={transmission === t} onPress={() => setTransmission(t)} />
            ))}
          </View>

          <Field
            label="ข้อมูลเพิ่มเติม (ไม่บังคับ)"
            placeholder="เช่น ขับกรุงเทพ–ชลบุรีทุกสุดสัปดาห์"
            value={notes}
            onChangeText={setNotes}
            multiline
            style={{ minHeight: 70, textAlignVertical: 'top' }}
          />

          <TouchableOpacity style={uiStyles.primaryBtn} onPress={analyze} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={uiStyles.primaryBtnText}>ค้นหารถที่เหมาะกับฉัน</Text>}
          </TouchableOpacity>
        </View>

        {/* ---------- Results ---------- */}
        {result && (
          <>
            <View style={styles.summaryCard}>
              <View style={styles.summaryHead}>
                <Heading style={styles.summaryTitle} th="สรุปคำแนะนำ" en="Summary" />
              </View>
              <Text style={styles.summaryText}>{result.summary}</Text>
            </View>

            <View style={styles.panel}>
              <Heading style={styles.blockTitle} th="วิเคราะห์งบประมาณ" en="Budget Analysis" />
              <View style={styles.statRow}>
                {result.budget.suggestedMin != null && (
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>ช่วงราคาที่แนะนำ</Text>
                    <Text style={styles.statValue}>
                      {formatTHB(result.budget.suggestedMin)} – {formatTHB(result.budget.suggestedMax)}
                    </Text>
                  </View>
                )}
                {result.budget.affordableMax != null && (
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>ซื้อได้สบายๆ ไม่เกิน</Text>
                    <Text style={styles.statValue}>{formatTHB(result.budget.affordableMax)}</Text>
                    <Text style={styles.statHint}>{`ค่างวด ≤ ${formatTHB(result.budget.maxMonthly)}/เดือน`}</Text>
                  </View>
                )}
              </View>
              {result.budget.notes.map((n, i) => (
                <Text key={i} style={styles.note}>• {n}</Text>
              ))}
            </View>

            <View style={styles.resultsHead}>
              <Heading style={styles.blockTitle} th={`รถที่เหมาะกับคุณ (${result.results.length} จาก ${result.considered} คันในสต็อก)`} en="Top Matches" />
              {result.results.length >= 2 && (
                <TouchableOpacity onPress={compareTop}>
                  <Text style={styles.link}>เปรียบเทียบคันที่ดีที่สุด ⇄</Text>
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
                    <Image source={{ uri: resolveImage(r.car.image) }} style={styles.thumbImg} />
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
                    {[r.car.year, r.car.type && thType(r.car.type), r.car.fuel && thFuel(r.car.fuel)].filter(Boolean).join(' · ')}
                  </Text>
                  <Text style={styles.price}>
                    {formatTHB(r.car.price)}
                    <Text style={styles.monthly}>{`  ≈ ${formatTHB(r.monthly)}/เดือน`}</Text>
                  </Text>
                  {r.budgetStatus === 'stretch' && <Text style={styles.stretch}>เกินงบเล็กน้อย</Text>}
                  {r.reasons.map((reason) => (
                    <Text key={reason} style={styles.reason}>✓ {reason}</Text>
                  ))}
                </View>
              </TouchableOpacity>
            ))}

            <Text style={styles.disclaimer}>
              ค่างวดเป็นการประมาณ (ดาวน์ 25%, ผ่อน 5 ปี, ดอกเบี้ยคงที่ 2.99% ต่อปี) เงื่อนไขจริงขึ้นอยู่กับไฟแนนซ์
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
  summaryText: { color: '#fff', fontSize: 14, lineHeight: 21 },

  blockTitle: { color: '#fff', fontWeight: '800', fontSize: 15, marginBottom: 10 },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  stat: { flexGrow: 1, flexBasis: 200, padding: 12, borderRadius: 8, backgroundColor: C.input },
  statLabel: { color: C.muted, fontSize: 12, fontWeight: '700' },
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
