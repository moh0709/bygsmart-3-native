
/**
 * Utilities for handling file input and image optimization.
 */

// Simple in-memory cache for the session to avoid re-reading files repeatedly
const fileCache = new Map<string, Blob>();

export const processFileForStorage = (file: File, maxWidth = 1280, quality = 0.7): Promise<{ dataUrl: string; name: string; type: string }> => {
    return new Promise((resolve, reject) => {
        const processResult = (blob: Blob) => {
            // For this Supabase migration phase without a dedicated Storage Bucket upload implementation in the UI yet:
            // We will convert to Base64 Data URL. 
            // Ideally, you should upload `blob` to Supabase Storage and return the public URL.
            
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64data = reader.result as string;
                resolve({
                    dataUrl: base64data,
                    name: file.name,
                    type: blob.type
                });
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        };

        // If it's not an image, just save original file blob as base64
        if (!file.type.startsWith('image/')) {
            processResult(file);
            return;
        }

        // Compress Image
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const elem = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Resize logic
                if (width > maxWidth) {
                    height = height * (maxWidth / width);
                    width = maxWidth;
                }

                elem.width = width;
                elem.height = height;
                const ctx = elem.getContext('2d');
                if (!ctx) {
                    reject(new Error("Could not get canvas context"));
                    return;
                }
                
                ctx.drawImage(img, 0, 0, width, height);
                
                // Export as Blob
                elem.toBlob((blob) => {
                    if(blob) {
                        processResult(blob);
                    } else {
                        reject(new Error("Canvas to Blob failed"));
                    }
                }, 'image/jpeg', quality);
            };
        };
        reader.onerror = error => reject(error);
    });
};

export const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

export const resolveFileUrl = async (url: string): Promise<string> => {
    // Pass through base64 data URLs and absolute http(s) links unchanged.
    if (!url || url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }

    // Convert task-docs/... storage paths to a signed URL (60-minute validity).
    if (url.startsWith('task-docs/')) {
        const { supabase } = await import('../services/supabaseClient');
        const { data, error } = await supabase.storage
            .from('task-docs')
            .createSignedUrl(url.replace(/^task-docs\//, ''), 3600);
        if (error) {
            console.error('resolveFileUrl signed URL error:', error);
            return url;
        }
        return data.signedUrl;
    }

    return url;
};

/**
 * Resolve a stored file (storage path, signed URL, http(s) link or data URL) to
 * a base64 data URL suitable for embedding in a generated PDF. Extracted from
 * the repeated `resolveFileUrl → fetch → blob → FileReader.readAsDataURL`
 * pattern (see pages/TaskDetailPage/GodkendModal.tsx) so signatures and photos
 * can be embedded without duplicating that code.
 *
 * Fails gracefully: returns `undefined` on a missing path or any error so a
 * missing signature/photo never crashes the caller.
 */
export const resolveStoragePathToDataUrl = async (
    path?: string | null
): Promise<string | undefined> => {
    if (!path) return undefined;
    try {
        const url = await resolveFileUrl(path);
        const resp = await fetch(url);
        const blob = await resp.blob();
        return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch {
        return undefined;
    }
};
