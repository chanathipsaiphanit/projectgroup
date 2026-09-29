import { Field, Heading, Pill, uiStyles } from '@/components/form-ui';
import { useAuth } from '@/context/auth-context';
import { C, CAR_TYPES, Car, FUELS, notify, resolveImage, storedImagePath, thFuel, thTransmission, thType, TRANSMISSIONS } from '@/lib/cars';
import { pickAndUploadPhotos } from '@/lib/photos';
import { useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
  images: string[];
  description: string;
};

const MAX_PHOTOS = 10;

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
    description: str(initial.description),
  });
  const [type, setType] = useState(initial.type || CAR_TYPES[0]);
  const [fuel, setFuel] = useState(initial.fuel || FUELS[0]);
  const [transmission, setTransmission] = useState(initial.transmission || TRANSMISSIONS[0]);
  const [saving, setSaving] = useState(false);
  // Stored paths (/uploads/...) or outside URLs; the first one is the cover photo
  const [photos, setPhotos] = useState<string[]>(() =>
    (initial.images?.length ? initial.images : initial.image ? [initial.image] : []).map(storedImagePath)
  );
  const [uploading, setUploading] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');
  const { user } = useAuth();

  const set = (key: keyof typeof f) => (value: string) => setF((prev) => ({ ...prev, [key]: value }));

  const addPhotos = async () => {
    setUploading(true);
    try {
      const added = await pickAndUploadPhotos(user?.token, MAX_PHOTOS - photos.length);
      setPhotos((prev) => [...prev, ...added].slice(0, MAX_PHOTOS));
    } catch (err: any) {
      notify(err.message || 'อัปโหลดรูปไม่สำเร็จ');
    } finally {
      setUploading(false);
    }
  };

  const addPhotoUrl = () => {
    const url = photoUrl.trim();
    if (!url) return;
    if (photos.length >= MAX_PHOTOS) return notify(`ใส่รูปได้สูงสุด ${MAX_PHOTOS} รูป`);
    setPhotos((prev) => [...prev, url]);
    setPhotoUrl('');
  };

  const removePhoto = (i: number) => setPhotos((prev) => prev.filter((_, k) => k !== i));
  const makeCover = (i: number) => setPhotos((prev) => [prev[i], ...prev.filter((_, k) => k !== i)]);

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
        image: photos[0] ?? '',
        images: photos,
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
      <Text style={uiStyles.sectionLabel}>{`รูปรถ (${photos.length}/${MAX_PHOTOS}) · รูปแรกคือรูปหน้าปก แตะรูปอื่นเพื่อตั้งเป็นหน้าปก`}</Text>
      <View style={styles.photoGrid}>
        {photos.map((p, i) => (
          <TouchableOpacity key={`${p}-${i}`} style={styles.photoBox} onPress={() => makeCover(i)}>
            <Image source={{ uri: resolveImage(p) }} style={styles.photo} resizeMode="cover" />
            {i === 0 && (
              <View style={styles.coverTag}>
                <Text style={styles.coverTagText}>หน้าปก</Text>
              </View>
            )}
            <TouchableOpacity style={styles.removeBtn} onPress={() => removePhoto(i)}>
              <Text style={styles.removeText}>✕</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
        {photos.length < MAX_PHOTOS && (
          <TouchableOpacity style={[styles.photoBox, styles.addBox]} onPress={addPhotos} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.addPlus}>＋</Text>
                <Text style={styles.addText}>เพิ่มรูป</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
      <TouchableOpacity onPress={() => setShowUrl((v) => !v)} style={{ marginBottom: 10 }}>
        <Text style={styles.linkText}>{showUrl ? 'ซ่อนช่องลิงก์รูป' : 'หรือเพิ่มรูปจากลิงก์เว็บ'}</Text>
      </TouchableOpacity>
      {showUrl && (
        <View style={styles.urlRow}>
          <Field label="ลิงก์รูปรถ (URL)" placeholder="https://..." value={photoUrl} onChangeText={setPhotoUrl} autoCapitalize="none" />
          <TouchableOpacity style={[uiStyles.outlineBtn, styles.urlAdd]} onPress={addPhotoUrl}>
            <Text style={uiStyles.outlineBtnText}>เพิ่ม</Text>
          </TouchableOpacity>
        </View>
      )}

      <Field
        label="คำอธิบาย"
        placeholder="สภาพรถ ประวัติการเข้าศูนย์ ของแต่ง ฯลฯ"
        value={f.description}
        onChangeText={set('description')}
        multiline
        style={{ minHeight: 90, textAlignVertical: 'top' }}
      />

      <TouchableOpacity style={[uiStyles.primaryBtn, { marginTop: 10 }]} onPress={handleSubmit} disabled={saving || uploading}>
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
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  photoBox: { width: 132, aspectRatio: 4 / 3, borderRadius: 8, backgroundColor: C.input, borderWidth: 1, borderColor: '#2A2A2A', overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  coverTag: { position: 'absolute', left: 0, bottom: 0, backgroundColor: C.red, paddingHorizontal: 6, paddingVertical: 2, borderTopRightRadius: 6 },
  coverTagText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  removeBtn: { position: 'absolute', right: 4, top: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  removeText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  addBox: { alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderColor: '#555' },
  addPlus: { color: '#fff', fontSize: 24, fontWeight: '700' },
  addText: { color: C.soft, fontSize: 12, fontWeight: '700', marginTop: 2 },
  urlRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  urlAdd: { marginBottom: 12, paddingVertical: 12 },
  linkText: { color: C.soft, fontWeight: '700', fontSize: 13 },
  backBtn: { padding: 12, alignItems: 'center', marginTop: 6 },
  backText: { color: '#999', fontWeight: 'bold' },
});
