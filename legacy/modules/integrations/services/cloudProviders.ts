
import { ProviderId } from './integrationAuth';

export interface CloudFile {
    id: string;
    name: string;
    type: 'file' | 'folder';
    mimeType?: string;
    size?: number;
}

export const listCloudFiles = async (provider: ProviderId, token: string, folderId?: string): Promise<CloudFile[]> => {
    try {
        switch (provider) {
            case 'google':
                return await listGoogleDrive(token, folderId);
            case 'dropbox':
                return await listDropbox(token, folderId);
            case 'onedrive':
                return await listOneDrive(token, folderId);
            default:
                return [];
        }
    } catch (error) {
        console.error(`Error listing files for ${provider}:`, error);
        throw error;
    }
};

export const downloadCloudFile = async (provider: ProviderId, token: string, fileId: string): Promise<Blob> => {
    try {
        switch (provider) {
            case 'google':
                return await downloadGoogleDrive(token, fileId);
            case 'dropbox':
                return await downloadDropbox(token, fileId);
            case 'onedrive':
                return await downloadOneDrive(token, fileId);
            default:
                throw new Error("Provider not supported");
        }
    } catch (error) {
        console.error(`Error downloading file from ${provider}:`, error);
        throw error;
    }
}

// --- Google Drive ---
async function listGoogleDrive(token: string, folderId: string = 'root'): Promise<CloudFile[]> {
    const query = `'${folderId}' in parents and trashed = false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size)`;
    
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error("Google Drive API Error");
    
    const data = await res.json();
    return data.files.map((f: any) => ({
        id: f.id,
        name: f.name,
        type: f.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file',
        mimeType: f.mimeType,
        size: f.size ? parseInt(f.size) : undefined
    }));
}

async function downloadGoogleDrive(token: string, fileId: string): Promise<Blob> {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error("Google Drive Download Error");
    return await res.blob();
}

// --- Dropbox ---
async function listDropbox(token: string, folderId: string = ''): Promise<CloudFile[]> {
    const url = 'https://api.dropboxapi.com/2/files/list_folder';
    const body = { path: folderId, recursive: false };
    
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    
    if (!res.ok) throw new Error("Dropbox API Error");
    
    const data = await res.json();
    return data.entries.map((e: any) => ({
        id: e.path_lower, // Dropbox uses paths as IDs
        name: e.name,
        type: e['.tag'] === 'folder' ? 'folder' : 'file',
        size: e.size
    }));
}

async function downloadDropbox(token: string, fileId: string): Promise<Blob> {
    // Dropbox uses a different domain for content
    const url = 'https://content.dropboxapi.com/2/files/download';
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Dropbox-API-Arg': JSON.stringify({ path: fileId })
        }
    });
    if (!res.ok) throw new Error("Dropbox Download Error");
    return await res.blob();
}

// --- OneDrive ---
async function listOneDrive(token: string, folderId?: string): Promise<CloudFile[]> {
    const url = folderId 
        ? `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}/children`
        : `https://graph.microsoft.com/v1.0/me/drive/root/children`;

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error("OneDrive API Error");

    const data = await res.json();
    return data.value.map((f: any) => ({
        id: f.id,
        name: f.name,
        type: f.folder ? 'folder' : 'file',
        size: f.size
    }));
}

async function downloadOneDrive(token: string, fileId: string): Promise<Blob> {
    const url = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error("OneDrive Download Error");
    return await res.blob();
}
