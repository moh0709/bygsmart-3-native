// Native image picker — expo-image-picker + expo-file-system to read the bytes. Kept
// out of the web bundle by the .ts/.web.ts split.
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

export interface PickedImage {
  bytes: Uint8Array;
  contentType: string;
  name: string;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function fromBase64(str: string): Uint8Array {
  const clean = str.replace(/[^A-Za-z0-9+/]/g, '');
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const n = (B64.indexOf(clean[i]!) << 18) | (B64.indexOf(clean[i + 1]!) << 12) |
      (B64.indexOf(clean[i + 2] ?? 'A') << 6) | B64.indexOf(clean[i + 3] ?? 'A');
    out.push((n >> 16) & 0xff);
    if (clean[i + 2] !== undefined) out.push((n >> 8) & 0xff);
    if (clean[i + 3] !== undefined) out.push(n & 0xff);
  }
  return new Uint8Array(out);
}

export async function pickImage(): Promise<PickedImage | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];
  const b64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
  return {
    bytes: fromBase64(b64),
    contentType: asset.mimeType ?? 'image/jpeg',
    name: asset.fileName ?? `photo-${asset.assetId ?? 'x'}.jpg`,
  };
}
