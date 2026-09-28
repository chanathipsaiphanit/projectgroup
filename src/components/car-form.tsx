import { Field, Heading, Pill, uiStyles } from '@/components/form-ui';
import { C, CAR_TYPES, Car, FUELS, notify, thFuel, thTransmission, thType, TRANSMISSIONS } from '@/lib/cars';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type CarPayload = {
  name: string;
  model: string;
  type: string;
  fuel: string;
  transmission: string;
  price: number;
  stock: number;
  year: number | null;
  mileage: number | null;
  seats: number | null;
  engine_cc: number | null;
  fuel_economy: number | null;
  color: string;
  image: string;
  description: string;
};

type Props = {
  title: string;
  titleEn: string;
  submitLabel: string;
  initial?: Partial<Car>;
  onSubmit: (payload: CarPayload) => Promise<void>;
  onCancel: () => void;
};

const str = (v: any) => (v === null || v === undefined ? '' : String(v));
const numOrNull = (s: string) => {
  const t = s.trim().replace(/,/g, '');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

// Keep a value that isn't in the predefined list selectable (older cars
// may have free-text types) instead of silently dropping it.
const withExisting = (list: string[], current?: string) =>
  current && !list.includes(current) ? [current, ...list] : list;

// Shared form for Add + Edit
export default function CarForm({ title, titleEn, submitLabel, initial = {}, onSubmit, onCancel }: Props) {
  const [f, setF] = useState({
    name: str(initial.name),
    model: str(initial.model),
    price: str(initial.price),
    stock: str(initial.stock ?? 1),
    year: str(initial.year),
    mileage: str(initial.mileage),
    seats: str(initial.seats),
    engineCc: str(initial.engineCc),
    fuelEconomy: str(initial.fuelEconomy),
    color: str(initial.color),
    image: str(initial.image),
    description: str(initial.description),
  });
  const [type, setType] = useState(initial.type || CAR_TYPES[0]);
  const [fuel, setFuel] = useState(initial.fuel || FUELS[0]);
  const [transmission, setTransmission] = useState(initial.transmission || TRANSMISSIONS[0]);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof typeof f) => (value: string) => setF((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    if (!f.name.trim() || !f.model.trim()) return notify('กรุณากรอกชื่อรถและรุ่น');
    const price = numOrNull(f.price);
    if (!price || price <= 0) return notify('กรุณากรอกราคาให้ถูกต้อง');
    const year = numOrNull(f.year);
    const maxYear = new Date().getFullYear() + 1;
    if (year != null && (year < 1950 || year > maxYear)) return notify(`ปีรถต้องอยู่ระหว่าง 1950 ถึง ${maxYear}`);

    setSaving(true);
    try {
      await onSubmit({
        name: f.name.trim(),
        model: f.model.trim(),
        type,
        fuel,
        transmission,
        price,
        stock: numOrNull(f.stock) ?? 0,
        year,
        mileage: numOrNull(f.mileage),
        seats: numOrNull(f.seats),
        engine_cc: fuel === 'EV' ? null : numOrNull(f.engineCc),
        fuel_economy: fuel === 'EV' ? null : numOrNull(f.fuelEconomy),
        color: f.color.trim(),
        image: f.image.trim(),
        description: f.description.trim(),
      });
    } catch (err: any) {
      notify(err?.message || 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Heading style={styles.title} th={title} en={titleEn} />

      <Heading style={styles.section} th="ข้อมูลหลัก" en="Basics" />
      <Field label="ชื่อรถ (ยี่ห้อ + รุ่น) *" placeholder="เช่น Honda Civic FE" value={f.name} onChangeText={set('name')} />
      <Field label="รุ่นย่อย *" placeholder="เช่น EL+" value={f.model} onChangeText={set('model')} />
      <View style={styles.row}>
        <Field label="ราคา (บาท) *" placeholder="929000" value={f.price} onChangeText={set('price')} keyboardType="decimal-pad" />
        <Field label="จำนวนรถ (คัน)" placeholder="1" value={f.stock} onChangeText={set('stock')} keyboardType="numeric" />
      </View>

      <Text style={uiStyles.sectionLabel}>ประเภทรถ</Text>
      <View style={styles.pillRow}>
        {withExisting(CAR_TYPES, initial.type).map((t) => (
          <Pill key={t} label={thType(t)} active={type === t} onPress={() => setType(t)} />
        ))}
      </View>

      <Heading style={styles.section} th="รายละเอียดรถ" en="Details" />
      <View style={styles.row}>
        <Field label="ปีรถ" placeholder="2023" value={f.year} onChangeText={set('year')} keyboardType="numeric" />
        <Field label="เลขไมล์ (กม.)" placeholder="18000" value={f.mileage} onChangeText={set('mileage')} keyboardType="numeric" />
      </View>
      <View style={styles.row}>
        <Field label="จำนวนที่นั่ง" placeholder="5" value={f.seats} onChangeText={set('seats')} keyboardType="numeric" />
        <Field label="สี" placeholder="เช่น ขาว" value={f.color} onChangeText={set('color')} />
      </View>

      <Text style={uiStyles.sectionLabel}>เชื้อเพลิง</Text>
      <View style={styles.pillRow}>
        {withExisting(FUELS, initial.fuel).map((t) => (
          <Pill key={t} label={thFuel(t)} active={fuel === t} onPress={() => setFuel(t)} />
        ))}
      </View>

      {fuel !== 'EV' && (
        <View style={styles.row}>
          <Field label="ขนาดเครื่องยนต์ (ซีซี)" placeholder="1500" value={f.engineCc} onChangeText={set('engineCc')} keyboardType="numeric" />
          <Field label="อัตราสิ้นเปลือง (กม./ลิตร)" placeholder="16.5" value={f.fuelEconomy} onChangeText={set('fuelEconomy')} keyboardType="decimal-pad" />
        </View>
      )}

      <Text style={uiStyles.sectionLabel}>ระบบเกียร์</Text>
      <View style={styles.pillRow}>
        {withExisting(TRANSMISSIONS, initial.transmission).map((t) => (
          <Pill key={t} label={thTransmission(t)} active={transmission === t} onPress={() => setTransmission(t)} />
        ))}
      </View>

      <Heading style={styles.section} th="รูปและคำอธิบาย" en="Listing" />
      <Field label="ลิงก์รูปรถ (URL)" placeholder="https://..." value={f.image} onChangeText={set('image')} autoCapitalize="none" />
      <Field
        label="คำอธิบาย"
        placeholder="สภาพรถ ประวัติการเข้าศูนย์ ของแต่ง ฯลฯ"
        value={f.description}
        onChangeText={set('description')}
        multiline
        style={{ minHeight: 90, textAlignVertical: 'top' }}
      />

      <TouchableOpacity style={[uiStyles.primaryBtn, { marginTop: 10 }]} onPress={handleSubmit} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={uiStyles.primaryBtnText}>{submitLabel}</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={styles.backBtn} onPress={onCancel}>
        <Text style={styles.backText}>ยกเลิก</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  container: { padding: 16, width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '900', marginBottom: 8, color: '#fff' },
  section: { fontSize: 15, fontWeight: '800', color: '#fff', marginTop: 16, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: C.red, paddingLeft: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  backBtn: { padding: 12, alignItems: 'center', marginTop: 6 },
  backText: { color: '#999', fontWeight: 'bold' },
});
