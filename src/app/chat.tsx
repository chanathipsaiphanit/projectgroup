import { Field, Heading, uiStyles } from '@/components/form-ui';
import { api } from '@/config';
import { useAuth } from '@/context/auth-context';
import { authHeaders, C, formatTHB, notify } from '@/lib/cars';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

type Message = { id: number; sender_id: number; body: string; created_at: string };
type Appointment = {
  id: number;
  proposed_by: number;
  appointment_at: string; // 'YYYY-MM-DD HH:MM'
  location: string;
  note: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
};
type Conversation = {
  id: number;
  car_id: number;
  buyer_id: number;
  seller_id: number;
  car_name: string;
  car_price: number;
  buyer_name: string;
  seller_name: string;
};

const POLL_MS = 5000;

const STATUS_TH: Record<string, string> = { pending: 'รอตอบรับ', accepted: 'ยืนยันแล้ว', declined: 'ปฏิเสธ', cancelled: 'ยกเลิกแล้ว' };

const STATUS_COLOR: Record<Appointment['status'], string> = {
  pending: C.amber,
  accepted: C.green,
  declined: '#555',
  cancelled: '#555',
};

const pad = (n: number) => String(n).padStart(2, '0');
const tomorrow = () => {
  const d = new Date(Date.now() + 24 * 3600 * 1000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export default function ChatScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [conv, setConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [apptOpen, setApptOpen] = useState(false);
  const [appt, setAppt] = useState({ date: tomorrow(), time: '10:00', location: '', note: '' });
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    if (!user || !id) return;
    try {
      const res = await fetch(api(`/api/conversations/${id}`), { headers: authHeaders(user.token, false) });
      const data = await res.json();
      if (res.ok) {
        setConv(data.conversation);
        setMessages(data.messages);
        setAppointments(data.appointments);
        setError('');
      } else {
        setError(data.error || 'โหลดแชทไม่สำเร็จ');
      }
    } catch {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    }
  }, [id, user]);

  // Poll for new messages while this screen is open
  useFocusEffect(
    useCallback(() => {
      load();
      const t = setInterval(load, POLL_MS);
      return () => clearInterval(t);
    }, [load])
  );

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }, [messages.length]);

  if (!user) {
    return (
      <SafeAreaView style={[styles.screen, styles.center]}>
        <Text style={styles.muted}>กรุณาเข้าสู่ระบบเพื่อดูแชทนี้</Text>
        <TouchableOpacity onPress={() => router.replace('/login')}>
          <Text style={styles.link}>เข้าสู่ระบบ</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const me = Number(user.id);
  const iAmBuyer = conv ? Number(conv.buyer_id) === me : true;
  const otherName = conv ? (iAmBuyer ? conv.seller_name : conv.buyer_name) : '';

  const post = async (path: string, body: object, method = 'POST') => {
    const res = await fetch(api(path), { method, headers: authHeaders(user.token), body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'ทำรายการไม่สำเร็จ');
    return data;
  };

  const sendMessage = async () => {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      await post(`/api/conversations/${id}/messages`, { body });
      setText('');
      await load();
    } catch (err: any) {
      notify(err.message);
    } finally {
      setSending(false);
    }
  };

  const proposeAppointment = async () => {
    try {
      await post(`/api/conversations/${id}/appointments`, appt);
      setApptOpen(false);
      setAppt({ date: tomorrow(), time: '10:00', location: '', note: '' });
      await load();
    } catch (err: any) {
      notify(err.message);
    }
  };

  const updateAppointment = async (apptId: number, status: Appointment['status']) => {
    try {
      await post(`/api/appointments/${apptId}`, { status }, 'PATCH');
      await load();
    } catch (err: any) {
      notify(err.message);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inner}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.back}>{'←'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1 }}
              disabled={!conv}
              onPress={() => conv && router.push({ pathname: '/details', params: { id: String(conv.car_id) } })}
            >
              <Text style={styles.headerTitle} numberOfLines={1}>{conv?.car_name || 'แชท'}</Text>
              {conv && (
                <Text style={styles.headerSub} numberOfLines={1}>
                  {`คุยกับ ${otherName} (${iAmBuyer ? 'ผู้ขาย' : 'ผู้ซื้อ'}) · ${formatTHB(Number(conv.car_price))}`}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.apptBtn} onPress={() => setApptOpen((v) => !v)}>
              <Text style={styles.apptBtnText}>{apptOpen ? 'ปิด' : '📅 นัดดูรถ'}</Text>
            </TouchableOpacity>
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.body}>
            {/* Propose-a-meeting form */}
            {apptOpen && (
              <View style={styles.apptForm}>
                <Heading style={styles.apptFormTitle} th="นัดดูรถ / ทดลองขับ" en="Book a Viewing" />
                <View style={styles.formRow}>
                  <Field label="วันที่ (ปี ค.ศ.-เดือน-วัน เช่น 2026-10-05)" value={appt.date} onChangeText={(v) => setAppt({ ...appt, date: v })} />
                  <Field label="เวลา (ชม.:นาที เช่น 10:00)" value={appt.time} onChangeText={(v) => setAppt({ ...appt, time: v })} />
                </View>
                <Field label="สถานที่นัด" placeholder="เช่น โชว์รูม Noon Home Car" value={appt.location} onChangeText={(v) => setAppt({ ...appt, location: v })} />
                <Field label="หมายเหตุ (ไม่บังคับ)" placeholder="เช่น ขอทดลองขับด้วย" value={appt.note} onChangeText={(v) => setAppt({ ...appt, note: v })} />
                <TouchableOpacity style={uiStyles.primaryBtn} onPress={proposeAppointment}>
                  <Text style={uiStyles.primaryBtnText}>ส่งคำขอนัด</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Appointments */}
            {appointments.map((a) => {
              const mine = Number(a.proposed_by) === me;
              return (
                <View key={a.id} style={[styles.apptCard, { borderLeftColor: STATUS_COLOR[a.status] }]}>
                  <View style={styles.apptTop}>
                    <Text style={styles.apptWhen}>📅 {a.appointment_at}</Text>
                    <Text style={[styles.apptStatus, { color: STATUS_COLOR[a.status] }]}>{STATUS_TH[a.status] ?? a.status}</Text>
                  </View>
                  <Text style={styles.apptWhere}>{a.location}</Text>
                  {!!a.note && <Text style={styles.apptNote}>{a.note}</Text>}
                  <Text style={styles.apptBy}>{`เสนอนัดโดย ${mine ? 'คุณ' : otherName}`}</Text>

                  <View style={styles.apptActions}>
                    {!mine && a.status === 'pending' && (
                      <>
                        <TouchableOpacity style={[styles.smallBtn, { backgroundColor: C.green }]} onPress={() => updateAppointment(a.id, 'accepted')}>
                          <Text style={styles.smallBtnText}>ตอบรับ</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.smallBtn, styles.smallBtnOutline]} onPress={() => updateAppointment(a.id, 'declined')}>
                          <Text style={styles.smallBtnText}>ปฏิเสธ</Text>
                        </TouchableOpacity>
                      </>
                    )}
                    {mine && (a.status === 'pending' || a.status === 'accepted') && (
                      <TouchableOpacity style={[styles.smallBtn, styles.smallBtnOutline]} onPress={() => updateAppointment(a.id, 'cancelled')}>
                        <Text style={styles.smallBtnText}>ยกเลิกนัด</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}

            {/* Messages */}
            {!conv && !error ? (
              <ActivityIndicator color={C.red} style={{ marginTop: 40 }} />
            ) : messages.length === 0 ? (
              <Text style={styles.emptyText}>ยังไม่มีข้อความ — ทักทายผู้ขายได้เลย!</Text>
            ) : (
              messages.map((m) => {
                const mine = Number(m.sender_id) === me;
                return (
                  <View key={m.id} style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
                    <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                      <Text style={styles.bubbleText}>{m.body}</Text>
                      <Text style={styles.bubbleTime}>{new Date(m.created_at).toLocaleString('th-TH')}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Composer */}
          <View style={styles.composer}>
            <TextInput
              style={styles.composerInput}
              placeholder="พิมพ์ข้อความ…"
              placeholderTextColor="#666"
              value={text}
              onChangeText={setText}
              onSubmitEditing={sendMessage}
              returnKeyType="send"
            />
            <TouchableOpacity style={styles.sendBtn} onPress={sendMessage} disabled={sending || !text.trim()}>
              {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendText}>ส่ง</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  muted: { color: C.muted },
  link: { color: C.red, fontWeight: '700' },
  inner: { flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  back: { color: '#fff', fontSize: 22, fontWeight: '700' },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  headerSub: { color: C.muted, fontSize: 12, marginTop: 2 },
  apptBtn: { borderWidth: 1, borderColor: C.red, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7 },
  apptBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  error: { color: C.red, textAlign: 'center', padding: 10 },
  body: { padding: 16, gap: 10 },

  apptForm: { padding: 14, borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  apptFormTitle: { color: '#fff', fontWeight: '800', marginBottom: 12 },
  formRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  apptCard: { padding: 12, borderRadius: 8, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderLeftWidth: 4 },
  apptTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  apptWhen: { color: '#fff', fontWeight: '800', fontSize: 14 },
  apptStatus: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  apptWhere: { color: C.soft, marginTop: 4 },
  apptNote: { color: C.muted, marginTop: 2, fontStyle: 'italic' },
  apptBy: { color: '#666', fontSize: 11, marginTop: 6 },
  apptActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  smallBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6 },
  smallBtnOutline: { borderWidth: 1, borderColor: '#3A3A3A' },
  smallBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  emptyText: { color: '#777', textAlign: 'center', marginTop: 30 },
  bubbleRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '80%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  bubbleMine: { backgroundColor: C.red, borderBottomRightRadius: 3 },
  bubbleTheirs: { backgroundColor: '#1E1E1E', borderBottomLeftRadius: 3 },
  bubbleText: { color: '#fff', fontSize: 14, lineHeight: 19 },
  bubbleTime: { color: 'rgba(255,255,255,0.55)', fontSize: 10, marginTop: 4, textAlign: 'right' },

  composer: { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: C.border },
  composerInput: { flex: 1, backgroundColor: C.input, borderWidth: 1, borderColor: '#2A2A2A', color: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  sendBtn: { backgroundColor: C.red, borderRadius: 20, paddingHorizontal: 18, justifyContent: 'center' },
  sendText: { color: '#fff', fontWeight: '800' },
});
