import React, { useState, useEffect } from 'react';
import { useToast } from '../../../contexts/ToastContext';
import { ProviderId } from '../services/integrationAuth';
import { listCloudFiles, downloadCloudFile, CloudFile } from '../services/cloudProviders';
import { FolderIcon, FileTextIcon, ChevronLeftIcon, XIcon, DownloadIcon, AlertTriangleIcon } from '../../../components/icons';

interface CloudFileBrowserProps {
    provider: ProviderId;
    onClose: () => void;
    onFileSelected: (file: File) => void;
}

const CloudFileBrowser: React.FC<CloudFileBrowserProps> = ({ provider, onClose, onFileSelected }) => {
    const { showToast } = useToast();
    const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined);
    const [history, setHistory] = useState<{id: string | undefined, name: string}[]>([{id: undefined, name: 'Root'}]);
    const [files, setFiles] = useState<CloudFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [authError, setAuthError] = useState(false);

    const token = sessionStorage.getItem(`bygSmart-${provider}-token`);

    useEffect(() => {
        if (!token) {
            setError("Ingen adgangstoken fundet. Prøv at forbinde igen.");
            setAuthError(true);
            return;
        }
        loadFiles(currentFolderId);
    }, [currentFolderId, token]);

    const loadFiles = async (folderId?: string) => {
        setLoading(true);
        setError(null);
        setAuthError(false);
        try {
            const list = await listCloudFiles(provider, token!, folderId);
            setFiles(list);
        } catch (err: any) {
            console.error(err);
            if (err.message && (err.message.includes('401') || err.message.includes('403'))) {
                setError("Adgang nægtet. Din session er muligvis udløbet.");
                setAuthError(true);
            } else {
                setError("Kunne ikke hente filer. Tjek din internetforbindelse.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleNavigate = (folder: CloudFile) => {
        setHistory([...history, { id: folder.id, name: folder.name }]);
        setCurrentFolderId(folder.id);
    };

    const handleBack = () => {
        if (history.length <= 1) return;
        const newHistory = [...history];
        newHistory.pop();
        setHistory(newHistory);
        setCurrentFolderId(newHistory[newHistory.length - 1].id);
    };

    const handleSelectFile = async (file: CloudFile) => {
        if (!token) return;
        setDownloadingId(file.id);
        try {
            const blob = await downloadCloudFile(provider, token, file.id);
            const nativeFile = new File([blob], file.name, { type: blob.type || file.mimeType });
            onFileSelected(nativeFile);
            onClose();
        } catch (err) {
            showToast('Kunne ikke downloade filen. Prøv igen.', 'error');
        } finally {
            setDownloadingId(null);
        }
    };
    
    const handleReconnect = () => {
        // Clear old token
        sessionStorage.removeItem(`bygSmart-${provider}-token`);
        localStorage.removeItem(`bygSmart-${provider}-connected`);
        // Redirect user to settings to reconnect
        window.location.hash = '/settings';
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-bg dark:bg-bg-dark-surface rounded-card shadow-xl w-full max-w-lg h-[80vh] flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-border dark:border-border-dark flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        {history.length > 1 && (
                            <button onClick={handleBack} className="min-w-11 min-h-11 flex items-center justify-center hover:bg-bg-muted dark:hover:bg-bg-dark-muted rounded-full">
                                <ChevronLeftIcon className="w-5 h-5 text-text-primary dark:text-text-dark-primary"/>
                            </button>
                        )}
                        <h3 className="font-bold text-lg text-text-primary dark:text-text-dark-primary capitalize">{provider} - {history[history.length-1].name}</h3>
                    </div>
                    <button onClick={onClose}><XIcon className="w-5 h-5 text-text-secondary"/></button>
                </div>

                {/* List */}
                <div className="flex-grow overflow-y-auto p-2">
                    {loading ? (
                        <div className="flex justify-center items-center h-full">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
                            <div className="bg-danger-subtle dark:bg-danger-subtle-dark p-3 rounded-full">
                                <AlertTriangleIcon className="w-8 h-8 text-danger-strong dark:text-danger" />
                            </div>
                            <p className="text-danger-strong dark:text-danger font-medium">{error}</p>
                            {authError && (
                                <button 
                                    onClick={handleReconnect}
                                    className="px-4 py-2 min-h-11 bg-brand-primary text-white rounded-control text-sm font-semibold hover:bg-brand-strong transition-colors"
                                >
                                    Forbind på ny
                                </button>
                            )}
                        </div>
                    ) : files.length === 0 ? (
                        <div className="text-center p-8 text-text-secondary">Mappen er tom.</div>
                    ) : (
                        <div className="space-y-1">
                            {files.map(file => (
                                <div key={file.id} 
                                     className="flex items-center gap-3 p-3 hover:bg-bg-subtle dark:hover:bg-bg-dark-muted rounded-control cursor-pointer transition-colors border border-transparent hover:border-border dark:hover:border-border-dark"
                                     onClick={() => file.type === 'folder' ? handleNavigate(file) : handleSelectFile(file)}
                                >
                                    <div className={`p-2 rounded-control ${file.type === 'folder' ? 'bg-brand-subtle text-brand-primary dark:bg-brand-subtle-dark dark:text-brand-light' : 'bg-bg-muted text-text-secondary dark:bg-bg-dark-muted dark:text-text-dark-secondary'}`}>
                                        {file.type === 'folder' ? <FolderIcon className="w-5 h-5"/> : <FileTextIcon className="w-5 h-5"/>}
                                    </div>
                                    <div className="flex-grow min-w-0">
                                        <p className="text-sm font-medium text-text-primary dark:text-text-dark-primary truncate">{file.name}</p>
                                        {file.size && <p className="text-xs text-text-secondary">{(file.size/1024).toFixed(0)} KB</p>}
                                    </div>
                                    {file.type === 'file' && (
                                        <div className="text-text-secondary">
                                            {downloadingId === file.id ? (
                                                <div className="w-4 h-4 border-2 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
                                            ) : (
                                                <DownloadIcon className="w-4 h-4 opacity-50"/>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CloudFileBrowser;