// Web image picker — a hidden <input type=file>. Returns the raw bytes + mime so the
// caller can queue the upload. Kept out of the native bundle by the .ts/.web.ts split.
export interface PickedImage {
  bytes: Uint8Array;
  contentType: string;
  name: string;
}

export function pickImage(): Promise<PickedImage | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      const reader = new FileReader();
      reader.onload = () =>
        resolve({ bytes: new Uint8Array(reader.result as ArrayBuffer), contentType: f.type || 'image/jpeg', name: f.name });
      reader.onerror = () => resolve(null);
      reader.readAsArrayBuffer(f);
    };
    input.click();
  });
}
