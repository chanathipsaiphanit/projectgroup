import { C } from '@/lib/cars';
import { StyleSheet, Text, TextInput, TextInputProps, TouchableOpacity, View } from 'react-native';

// Selectable chip used by forms, filters and the AI screens
export function Pill({
  label,
  active,
  onPress,
  small,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  small?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.pill, small && styles.pillSmall, active && styles.pillActive]}
      onPress={onPress}
    >
      <Text style={[styles.pillText, small && styles.pillTextSmall, active && styles.pillTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// Single-choice row of pills
export function PillGroup({
  options,
  value,
  onChange,
  small,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  small?: boolean;
}) {
  return (
    <View style={styles.row}>
      {options.map((o) => (
        <Pill key={o} label={o} active={value === o} onPress={() => onChange(o)} small={small} />
      ))}
    </View>
  );
}

// Labelled text input
export function Field({ label, style, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor="#666" style={[styles.input, style]} {...props} />
    </View>
  );
}

export const uiStyles = StyleSheet.create({
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#999', marginBottom: 8, marginTop: 6 },
  primaryBtn: { backgroundColor: C.red, padding: 14, borderRadius: 8, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  outlineBtn: { borderWidth: 1, borderColor: '#3A3A3A', padding: 14, borderRadius: 8, alignItems: 'center' },
  outlineBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  pill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#2A2A2A', backgroundColor: C.input },
  pillSmall: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  pillActive: { backgroundColor: C.red, borderColor: C.red },
  pillText: { fontSize: 14, fontWeight: '700', color: C.soft },
  pillTextSmall: { fontSize: 12, fontWeight: '600' },
  pillTextActive: { color: '#fff' },
  field: { marginBottom: 12, flexGrow: 1, flexBasis: 140 },
  label: { fontSize: 12, fontWeight: '700', color: '#999', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#2A2A2A', backgroundColor: C.input, color: '#fff', padding: 12, borderRadius: 8, fontSize: 15 },
});
