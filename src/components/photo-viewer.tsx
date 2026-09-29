import { C } from '@/lib/cars';
import { Image, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Full-screen photo viewer with previous/next arrows
export default function PhotoViewer({
  photos,
  index,
  onChange,
  onClose,
}: {
  photos: string[];
  index: number | null;
  onChange: (index: number) => void;
  onClose: () => void;
}) {
  const open = index != null && index < photos.length;
  const i = index ?? 0;
  const go = (step: number) => onChange((i + step + photos.length) % photos.length);

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        {open && <Image source={{ uri: photos[i] }} style={styles.photo} resizeMode="contain" />}

        {photos.length > 1 && (
          <>
            <TouchableOpacity style={[styles.arrow, { left: 12 }]} onPress={() => go(-1)}>
              <Text style={styles.arrowText}>{'‹'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.arrow, { right: 12 }]} onPress={() => go(1)}>
              <Text style={styles.arrowText}>{'›'}</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={styles.topBar}>
          <Text style={styles.counter}>{`${i + 1} / ${photos.length}`}</Text>
          <TouchableOpacity style={styles.close} onPress={onClose}>
            <Text style={styles.closeText}>ปิด ✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  photo: { width: '92%', height: '80%' },
  arrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -26,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: { color: '#fff', fontSize: 30, fontWeight: '700', marginTop: -3 },
  topBar: { position: 'absolute', top: 20, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  counter: { color: '#fff', fontWeight: '700' },
  close: { backgroundColor: C.red, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  closeText: { color: '#fff', fontWeight: '800' },
});
