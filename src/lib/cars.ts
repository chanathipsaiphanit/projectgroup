import { Alert, Platform } from 'react-native';

export const CAR_TYPES = ['Sedan', 'SUV', 'Sports Car', 'Hatchback', 'Pickup'];
export const FUELS = ['Petrol', 'Diesel', 'Hybrid', 'EV'];
export const TRANSMISSIONS = ['Automatic', 'Manual'];

const toNum = (v: any): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// The DB returns snake_case MySQL columns; screens pass cars around in
// camelCase. This accepts either, so it's safe to call twice.
export function normalizeCar(item: any) {
  return {
    id: item.id,
    name: item.name ?? '',
    model: item.model ?? '',
    type: item.type ?? '',
    stock: Number(item.stock ?? 0),
    image: item.image ?? '',
    price: Number(item.price ?? 0),
    year: toNum(item.year),
    mileage: toNum(item.mileage),
    fuel: (item.fuel ?? '') as string,
    transmission: (item.transmission ?? '') as string,
    seats: toNum(item.seats),
    engineCc: toNum(item.engine_cc ?? item.engineCc),
    fuelEconomy: toNum(item.fuel_economy ?? item.fuelEconomy),
    color: (item.color ?? '') as string,
    description: (item.description ?? '') as string,
    sellerId: (item.seller_id ?? item.sellerId ?? null) as number | null,
    sellerName: (item.seller_name ?? item.sellerName ?? '') as string,
  };
}

export type Car = ReturnType<typeof normalizeCar>;

export const formatTHB = (v: number | null | undefined) =>
  v == null ? '—' : `${Math.round(v).toLocaleString()} THB`;

export const formatKm = (v: number | null | undefined) => (v == null ? '—' : `${v.toLocaleString()} km`);

type MaybeUser = { id?: number; role?: string } | null | undefined;

export const canSell = (user: MaybeUser) => user?.role === 'seller' || user?.role === 'admin';

// Admins manage everything; sellers only their own listings
export function canManageCar(user: MaybeUser, car: { sellerId?: number | null }) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return car.sellerId != null && user.id != null && Number(car.sellerId) === Number(user.id);
}

export function authHeaders(token?: string, json = true) {
  const h: Record<string, string> = {};
  if (json) h['Content-Type'] = 'application/json';
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export function notify(message: string) {
  if (Platform.OS === 'web') window.alert(message);
  else Alert.alert(message);
}

export function confirmAction(title: string, message: string, onConfirm: () => void, confirmLabel = 'Delete') {
  if (Platform.OS === 'web') {
    if (window.confirm(message)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: confirmLabel, style: 'destructive', onPress: onConfirm },
    ]);
  }
}

// Palette shared by every screen: near-black, one racing-red accent
export const C = {
  bg: '#0A0A0A',
  panel: '#111',
  card: '#141414',
  input: '#1A1A1A',
  border: '#262626',
  borderStrong: '#333',
  red: '#E4001B',
  redDim: '#8A0010',
  text: '#fff',
  soft: '#D0D0D0',
  muted: '#8A8A8A',
  green: '#1E9E5A',
  amber: '#C98A00',
};
