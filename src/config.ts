// Central place for the backend URL.
// Change it here once instead of in every screen.
//
// Backend runs on the school server (SSH'd in via PuTTY), not on this PC —
// so this must be the server's public URL, not localhost. This works the
// same whether you're on Expo Web, Expo Go, or an emulator, since it's a
// real public address rather than a loopback one.
export const API_BASE_URL = 'http://119.59.102.161:3092';

export const api = (path: string) => `${API_BASE_URL}${path}`;
