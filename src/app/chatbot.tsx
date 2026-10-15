// Chat page: src/app/chatbot.tsx  (opens at /chatbot)
// Rule-based assistant + quick-help buttons. Talks to POST /api/ai/chat.
import { api } from '@/config';
import { useAuth } from '@/context/auth-context';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// ===== แก้ตรงนี้: ช่องทางติดต่อแอดมิน (เว้นว่างไว้ = ไม่แสดงช่องทางนั้น) =====
const ADMIN_CONTACT = {
  phone: '', // เช่น '0812345678'
  email: '', // เช่น 'admin@example.com'
  line: '', // LINE ID เช่น '@noonhomecar'
};
// ===========================================================================

type BotLink = { label: string; to?: string; params?: Record<string, string>; url?: string };
type Msg = { role: 'user' | 'assistant'; content: string; links?: BotLink[] };
type Chip = { label: string; ask?: string; reply?: () => Msg; accent?: boolean };

const RED = '#E4001B';
const GREETING: Msg = {
  role: 'assistant',
  content: 'สวัสดีครับ ผมช่วยแนะนำรถตามงบและการใช้งาน หรือบอกขั้นตอนต่างๆ ได้ กดปุ่มด้านล่างหรือลองพิมพ์ "งบ 900000" ดูครับ',
};

const bot = (content: string, links?: BotLink[]): Msg => ({ role: 'assistant', content, links });

function adminContactReply(): Msg {
  const lines: string[] = [];
  const links: BotLink[] = [];
  const { phone, email, line } = ADMIN_CONTACT;
  if (phone) {
    lines.push(`โทร: ${phone}`);
    links.push({ label: 'โทรหาแอดมิน', url: `tel:${phone}` });
  }
  if (email) {
    lines.push(`อีเมล: ${email}`);
    links.push({ label: 'ส่งอีเมล', url: `mailto:${email}` });
  }
  if (line) {
    lines.push(`LINE: ${line}`);
    links.push({ label: 'เปิด LINE', url: `https://line.me/R/ti/p/${line}` });
  }
  if (!lines.length) {
    return bot('ตอนนี้ยังไม่มีช่องทางติดต่อแอดมินโดยตรง ถ้าเกี่ยวกับรถคันไหน ติดต่อผู้ขายผ่านแชทได้เลยครับ', [
      { label: 'ข้อความของฉัน', to: '/inbox' },
    ]);
  }
  return bot(`ติดต่อแอดมินได้ที่\n${lines.join('\n')}`, links);
}

function buildChips(role?: string): Chip[] {
  const isSeller = role === 'seller' || role === 'admin';
  const chips: Chip[] = [
    {
      label: 'แนะนำรถตามงบ',
      reply: () =>
        bot('พิมพ์งบหรือการใช้งานได้เลย เช่น "งบ 9 แสน ใช้กับครอบครัว 5 คน" หรือใช้หน้าแนะนำรถแบบเต็มที่วิเคราะห์งบให้ด้วย', [
          { label: 'เปิดหน้าแนะนำรถ', to: '/ai-advisor' },
        ]),
    },
    {
      label: 'ติดต่อผู้ขาย / นัดดูรถ',
      reply: () =>
        bot(
          'วิธีติดต่อผู้ขายและนัดดูรถ:\n1) เปิดรถที่สนใจ แล้วกด "ติดต่อผู้ขาย / นัดดูรถ"\n2) พิมพ์ข้อความแล้วกดส่ง ระบบจะเปิดแชทกับผู้ขาย\n3) ในแชท เสนอวัน เวลา และสถานที่นัดได้ ผู้ขายจะกดยอมรับหรือปฏิเสธ',
          [
            { label: 'ดูรถทั้งหมด', to: '/' },
            { label: 'ข้อความของฉัน', to: '/inbox' },
          ]
        ),
    },
    {
      label: 'เปรียบเทียบรถ',
      reply: () =>
        bot('ที่หน้ารถทั้งหมด กดปุ่ม "เปรียบเทียบรถ" แล้วเลือกรถ 2–4 คัน จากนั้นกดเปรียบเทียบ ระบบจะสรุปข้อดีข้อเสียให้', [
          { label: 'ไปหน้ารถทั้งหมด', to: '/' },
        ]),
    },
    {
      label: 'เช็กประวัติรถก่อนซื้อ',
      reply: () =>
        bot(
          'ในหน้ารายละเอียดรถ มีหัวข้อ "ประวัติและเอกสาร" ให้ดูก่อนตัดสินใจ: ประวัติอุบัติเหตุ น้ำท่วม เล่มทะเบียน ประวัติเข้าศูนย์/อู่ วันสิ้นอายุภาษีและประกัน ถ้าข้อมูลไหนไม่ระบุ ลองถามผู้ขายในแชทก่อนนัดดูรถครับ',
          [{ label: 'ดูรถทั้งหมด', to: '/' }]
        ),
    },
    {
      label: 'ข้อความของฉัน',
      reply: () => bot('ดูแชทและนัดหมายทั้งหมดของคุณได้ที่หน้าข้อความครับ', [{ label: 'เปิดข้อความ', to: '/inbox' }]),
    },
    {
      label: 'วิธีลงขายรถ',
      reply: () =>
        isSeller
          ? bot('กด "ลงขายรถ" กรอกรายละเอียดและรูปรถ แล้วบันทึก ดูและแก้ไขประกาศของคุณได้ที่ "รถที่ฉันลงขาย"', [
              { label: 'ลงขายรถ', to: '/add' },
              { label: 'รถที่ฉันลงขาย', to: '/my-cars' },
            ])
          : bot('บัญชีผู้ซื้อลงขายรถไม่ได้ครับ ต้องสมัครบัญชีผู้ขายก่อน', [
              { label: 'สมัครบัญชีผู้ขาย', to: '/register', params: { role: 'seller' } },
            ]),
    },
  ];
  if (isSeller) chips.push({ label: 'รถที่ฉันลงขาย', reply: () => bot('จัดการประกาศของคุณ แก้ไข ปิดการขาย หรือลบได้ที่นี่', [{ label: 'เปิดรถที่ฉันลงขาย', to: '/my-cars' }]) });
  if (role === 'admin') chips.push({ label: 'จัดการระบบ', reply: () => bot('เข้าหน้าจัดการระบบเพื่อดูสถิติ ประกาศ และผู้ใช้ทั้งหมด', [{ label: 'เปิดหน้าจัดการระบบ', to: '/admin' }]) });
  chips.push({ label: 'ติดต่อแอดมิน', accent: true, reply: adminContactReply });
  return chips;
}

export default function ChatbotScreen() {
  const router = useRouter();
  const { user } = useAuth() as any;
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }, [messages.length, loading]);

  const send = async (override?: string) => {
    const content = (override ?? text).trim();
    if (!content || loading || !user) return;

    const next: Msg[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setText('');
    setLoading(true);
    try {
      const res = await fetch(api('/api/ai/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
        body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })) }),
      });
      const data = await res.json();
      const reply = res.ok ? data.reply : data.error || 'ตอนนี้ตอบไม่ได้ ลองใหม่อีกครั้งครับ';
      setMessages((prev) => [...prev, bot(reply)]);
    } catch {
      setMessages((prev) => [...prev, bot('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้งครับ')]);
    } finally {
      setLoading(false);
    }
  };

  const runChip = (chip: Chip) => {
    if (loading) return;
    if (chip.ask) return send(chip.ask);
    setMessages((prev) => [...prev, { role: 'user', content: chip.label }, chip.reply!()]);
  };

  const openLink = (l: BotLink) => {
    if (l.url) Linking.openURL(l.url).catch(() => {});
    else if (l.to) router.push((l.params ? { pathname: l.to, params: l.params } : l.to) as any);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
            <Text style={styles.back}>{'←'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>✦ ผู้ช่วยหารถ</Text>
          <View style={{ width: 20 }} />
        </View>

        {!user ? (
          <View style={styles.signIn}>
            <Text style={styles.muted}>เข้าสู่ระบบก่อนเพื่อใช้แชท</Text>
            <TouchableOpacity style={styles.primary} onPress={() => router.push('/login')}>
              <Text style={styles.primaryText}>เข้าสู่ระบบ</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ gap: 8, padding: 16 }}>
              {messages.map((m, i) => (
                <View key={i} style={[styles.bubble, m.role === 'user' ? styles.mine : styles.theirs]}>
                  <Text style={styles.bubbleText}>{m.content}</Text>
                  {!!m.links?.length && (
                    <View style={styles.linkRow}>
                      {m.links.map((l) => (
                        <TouchableOpacity key={l.label} style={styles.linkBtn} onPress={() => openLink(l)}>
                          <Text style={styles.linkText}>{l.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              ))}
              {loading && <ActivityIndicator color={RED} style={{ alignSelf: 'flex-start', marginLeft: 8 }} />}
            </ScrollView>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipBar} contentContainerStyle={styles.chipRow}>
              {buildChips(user.role).map((chip) => (
                <TouchableOpacity key={chip.label} style={[styles.chip, chip.accent && styles.chipAccent]} onPress={() => runChip(chip)} disabled={loading}>
                  <Text style={styles.chipText}>{chip.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.composer}>
              <TextInput
                style={styles.input}
                placeholder="พิมพ์คำถาม…"
                placeholderTextColor="#666"
                value={text}
                onChangeText={setText}
                onSubmitEditing={() => send()}
                returnKeyType="send"
                editable={!loading}
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!text.trim() || loading) && { opacity: 0.4 }]}
                onPress={() => send()}
                disabled={!text.trim() || loading}
              >
                <Text style={styles.sendText}>ส่ง</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0A0A0A' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  back: { color: '#fff', fontSize: 22, fontWeight: '700' },
  headerTitle: { color: '#fff', fontWeight: '800', fontSize: 16 },
  bubble: { maxWidth: '80%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  mine: { alignSelf: 'flex-end', backgroundColor: RED, borderBottomRightRadius: 3 },
  theirs: { alignSelf: 'flex-start', backgroundColor: '#1E1E1E', borderBottomLeftRadius: 3 },
  bubbleText: { color: '#fff', fontSize: 14, lineHeight: 20 },
  linkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  linkBtn: { borderWidth: 1, borderColor: RED, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  linkText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  chipBar: { flexGrow: 0, borderTopWidth: 1, borderTopColor: '#262626' },
  chipRow: { gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  chip: { borderWidth: 1, borderColor: '#333', backgroundColor: '#141414', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 },
  chipAccent: { borderColor: RED },
  chipText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  composer: { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: '#262626' },
  input: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    color: '#fff',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  sendBtn: { backgroundColor: RED, borderRadius: 20, paddingHorizontal: 18, justifyContent: 'center' },
  sendText: { color: '#fff', fontWeight: '800' },
  signIn: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  muted: { color: '#8A8A8A', fontSize: 14 },
  primary: { backgroundColor: RED, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  primaryText: { color: '#fff', fontWeight: '800' },
});
