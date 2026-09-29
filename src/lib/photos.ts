import { api } from '@/config';
import { authHeaders } from '@/lib/cars';
import * as ImagePicker from 'expo-image-picker';

// Let the user pick up to `limit` photos, upload each one, and return the
// stored paths (/uploads/...). Photos that fail to upload are skipped.
export async function pickAndUploadPhotos(token: string | undefined, limit: number): Promise<string[]> {
  if (limit <= 0) return [];
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
    base64: true,
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
  });
  if (picked.canceled || !picked.assets?.length) return [];

  const paths: string[] = [];
  for (const asset of picked.assets.slice(0, limit)) {
    // Web gives a data: URI instead of the base64 field
    const dataUri = asset.uri.startsWith('data:') ? asset.uri : '';
    const data = asset.base64 || dataUri.split(',')[1];
    const mimeType = asset.mimeType || dataUri.slice(5, dataUri.indexOf(';')) || 'image/jpeg';
    if (!data) continue;

    const res = await fetch(api('/api/upload'), {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ data, mimeType }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'อัปโหลดรูปไม่สำเร็จ');
    paths.push(json.path);
  }
  return paths;
}
