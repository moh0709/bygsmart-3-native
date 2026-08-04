import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { TaskDocumentationItem } from '../../../types';
import {
    listTaskDocumentation,
    addTaskDocumentation,
    deleteTaskDocumentation,
    addCommentToTaskDoc,
} from '../services/taskWorkspace';
import { processFileForStorage, resolveFileUrl } from '../../../utils/fileUtils';
import FilePicker from '../../../components/FilePicker';
import { useToast } from '../../../contexts/ToastContext';
import {
    PinIcon, DownloadIcon, MicIcon, FileTextIcon,
    LinkIcon, PaperclipIcon, TrashIcon, PlayIcon, PauseIcon,
    XIcon, MessageSquareIcon, SendIcon,
} from '../../../components/icons';

// ── Local comment type ─────────────────────────────────────────────────────────
interface DocComment {
    id: string;
    authorId: string;
    authorName: string;
    text: string;
    createdAt: string;
}

// ── Props ──────────────────────────────────────────────────────────────────────
export interface TaskDocumentationTabProps {
    taskId: string;
    projectId: string | null;
    currentUserId: string;
    currentUserName: string;
    /** true = project owner or manager (can comment + delete any, cannot author) */
    isOwnerOrManager: boolean;
    /** true = current user is the assigned worker or accepted partner (sole author of entries) */
    isAssignedWorker: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const KIND_LABEL: Record<string, string> = {
    text: 'Note', photo: 'Foto', audio: 'Lyd',
    link: 'Link', file: 'Fil', report: 'Rapport',
};

const fmtSec = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString('da-DK', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });

// ── Sub-components ─────────────────────────────────────────────────────────────

const DocImage: React.FC<{
    storagePath: string;
    className?: string;
    onClick?: () => void;
}> = ({ storagePath, className, onClick }) => {
    const [src, setSrc] = useState('');
    useEffect(() => { resolveFileUrl(storagePath).then(setSrc); }, [storagePath]);
    if (!src) return (
        <div className={`bg-bg-muted dark:bg-bg-dark-muted rounded-lg animate-pulse ${className ?? 'w-16 h-16'}`} />
    );
    return (
        <img
            src={src}
            alt="Foto"
            className={`object-cover rounded-lg ${onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''} ${className ?? 'w-16 h-16'}`}
            onClick={onClick}
        />
    );
};

const FullScreenImage: React.FC<{ storagePath: string; onClose: () => void }> = ({ storagePath, onClose }) => {
    const [src, setSrc] = useState('');
    useEffect(() => { resolveFileUrl(storagePath).then(setSrc); }, [storagePath]);
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 animate-fade-in"
            onClick={onClose}
        >
            <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 bg-white/10 rounded-full text-white hover:bg-white/20"
            >
                <XIcon className="w-6 h-6" />
            </button>
            {src
                ? <img
                    src={src}
                    alt="Foto"
                    className="max-w-full max-h-full object-contain rounded-lg"
                    onClick={e => e.stopPropagation()}
                />
                : <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
            }
        </div>
    );
};

const AudioPlayer: React.FC<{ storagePath: string }> = ({ storagePath }) => {
    const [src, setSrc] = useState('');
    const [playing, setPlaying] = useState(false);
    const [duration, setDuration] = useState<number | null>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => { resolveFileUrl(storagePath).then(setSrc); }, [storagePath]);

    const toggle = () => {
        const el = audioRef.current;
        if (!el) return;
        if (playing) { el.pause(); setPlaying(false); }
        else { el.play().then(() => setPlaying(true)).catch(() => {}); }
    };

    return (
        <div className="flex items-center gap-3 mt-1">
            <button
                type="button"
                onClick={toggle}
                className="w-8 h-8 bg-brand-primary rounded-full flex items-center justify-center text-white flex-shrink-0"
            >
                {playing
                    ? <PauseIcon className="w-3.5 h-3.5" />
                    : <PlayIcon className="w-3.5 h-3.5" />
                }
            </button>
            <span className="text-sm text-text-secondary">
                Lydoptagelse{duration != null ? ` (${fmtSec(Math.round(duration))})` : ''}
            </span>
            {src && (
                <audio
                    ref={audioRef}
                    src={src}
                    onEnded={() => setPlaying(false)}
                    onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? null)}
                    className="hidden"
                />
            )}
        </div>
    );
};

// ── Mode type ──────────────────────────────────────────────────────────────────
type CaptureMode = 'idle' | 'text' | 'photo' | 'audio' | 'link' | 'file';

// ── Main component ─────────────────────────────────────────────────────────────
const TaskDocumentationTab: React.FC<TaskDocumentationTabProps> = ({
    taskId,
    projectId,
    currentUserId,
    currentUserName,
    isOwnerOrManager,
    isAssignedWorker,
}) => {
    const { showToast } = useToast();

    const canAuthor = isAssignedWorker;
    const canDeleteAny = isOwnerOrManager;

    // ── Entries ────────────────────────────────────────────────────────────────
    const [entries, setEntries] = useState<TaskDocumentationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // ── Capture mode ───────────────────────────────────────────────────────────
    const [mode, setMode] = useState<CaptureMode>('idle');

    // Text
    const [textNote, setTextNote] = useState('');

    // Photo
    const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [compressedPhotoDataUrl, setCompressedPhotoDataUrl] = useState<string | null>(null);

    // Audio
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingSeconds, setRecordingSeconds] = useState(0);
    const [mediaRecorderSupported, setMediaRecorderSupported] = useState(true);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Link
    const [linkUrl, setLinkUrl] = useState('');
    const [linkCaption, setLinkCaption] = useState('');

    // File
    const [pendingFile, setPendingFile] = useState<File | null>(null);

    // Comments
    const [expandedCommentId, setExpandedCommentId] = useState<string | null>(null);
    const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
    const [addingCommentId, setAddingCommentId] = useState<string | null>(null);

    // Image viewer
    const [viewingImage, setViewingImage] = useState<string | null>(null);

    // ── Load ───────────────────────────────────────────────────────────────────
    const loadEntries = useCallback(async () => {
        setLoading(true);
        const data = await listTaskDocumentation(taskId);
        setEntries(data);
        setLoading(false);
    }, [taskId]);

    useEffect(() => { loadEntries(); }, [loadEntries]);

    // ── Check MediaRecorder support ────────────────────────────────────────────
    useEffect(() => {
        setMediaRecorderSupported(
            typeof MediaRecorder !== 'undefined' &&
            !!navigator.mediaDevices?.getUserMedia
        );
    }, []);

    // ── Cleanup blob URL on unmount ────────────────────────────────────────────
    useEffect(() => {
        return () => {
            if (audioBlobUrl) URL.revokeObjectURL(audioBlobUrl);
        };
    }, [audioBlobUrl]);

    // ── Reset capture state ────────────────────────────────────────────────────
    const resetMode = useCallback(() => {
        setMode('idle');
        setTextNote('');
        setPendingPhotoFile(null);
        setPhotoPreview(null);
        setCompressedPhotoDataUrl(null);
        setAudioBlob(null);
        if (audioBlobUrl) URL.revokeObjectURL(audioBlobUrl);
        setAudioBlobUrl(null);
        setIsRecording(false);
        setRecordingSeconds(0);
        setLinkUrl('');
        setLinkCaption('');
        setPendingFile(null);
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
    }, [audioBlobUrl]);

    // ── Generic add entry ──────────────────────────────────────────────────────
    const addEntry = async (params: Parameters<typeof addTaskDocumentation>[0]) => {
        setSubmitting(true);
        try {
            await addTaskDocumentation(params);
            await loadEntries();
            resetMode();
            showToast('Tilføjet!', 'success');
        } catch (err: any) {
            showToast(err?.message ?? 'Fejl ved tilføjelse', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // ── Submit: text ───────────────────────────────────────────────────────────
    const handleSubmitText = async () => {
        if (!textNote.trim()) return;
        await addEntry({
            taskId, projectId,
            authorId: currentUserId, authorName: currentUserName,
            kind: 'text', body: textNote.trim(),
        });
    };

    // ── Submit: photo ──────────────────────────────────────────────────────────
    const handlePhotoSelect = async (file: File) => {
        setPendingPhotoFile(file);
        const result = await processFileForStorage(file);
        setPhotoPreview(result.dataUrl);
        setCompressedPhotoDataUrl(result.dataUrl);
    };

    const handleSubmitPhoto = async () => {
        if (!compressedPhotoDataUrl) return;
        // Convert compressed base64 back to Blob for storage upload
        const response = await fetch(compressedPhotoDataUrl);
        const blob = await response.blob();
        await addEntry({
            taskId, projectId,
            authorId: currentUserId, authorName: currentUserName,
            kind: 'photo',
            file: blob,
            mimeType: 'image/jpeg',
            sizeBytes: blob.size,
        });
    };

    // ── Submit: audio ──────────────────────────────────────────────────────────
    const handleStartRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mr = new MediaRecorder(stream);
            audioChunksRef.current = [];
            mr.ondataavailable = e => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };
            mr.onstop = () => {
                stream.getTracks().forEach(t => t.stop());
                const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || 'audio/webm' });
                const url = URL.createObjectURL(blob);
                setAudioBlob(blob);
                setAudioBlobUrl(url);
            };
            mr.start();
            mediaRecorderRef.current = mr;
            setIsRecording(true);
            setRecordingSeconds(0);
            recordingTimerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
        } catch {
            showToast('Mikrofon ikke tilgængelig', 'error');
        }
    };

    const handleStopRecording = () => {
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
    };

    const handleSubmitAudio = async () => {
        if (!audioBlob) return;
        await addEntry({
            taskId, projectId,
            authorId: currentUserId, authorName: currentUserName,
            kind: 'audio',
            file: audioBlob,
            mimeType: audioBlob.type || 'audio/webm',
            sizeBytes: audioBlob.size,
        });
    };

    // ── Submit: link ───────────────────────────────────────────────────────────
    const handleSubmitLink = async () => {
        if (!linkUrl.trim()) return;
        let url = linkUrl.trim();
        if (!url.startsWith('http://') && !url.startsWith('https://')) url = `https://${url}`;
        const body = linkCaption.trim() ? `${linkCaption.trim()}\n${url}` : url;
        await addEntry({
            taskId, projectId,
            authorId: currentUserId, authorName: currentUserName,
            kind: 'link', body,
        });
    };

    // ── Submit: file ───────────────────────────────────────────────────────────
    const handleSubmitFile = async () => {
        if (!pendingFile) return;
        await addEntry({
            taskId, projectId,
            authorId: currentUserId, authorName: currentUserName,
            kind: 'file',
            file: pendingFile,
            mimeType: pendingFile.type,
            sizeBytes: pendingFile.size,
            body: pendingFile.name,
        });
    };

    // ── Delete ─────────────────────────────────────────────────────────────────
    const handleDelete = async (entry: TaskDocumentationItem) => {
        const canDelete = canDeleteAny || entry.authorId === currentUserId;
        if (!canDelete) { showToast('Du kan ikke slette denne post', 'error'); return; }
        if (!window.confirm('Slet denne dokumentationspost?')) return;
        try {
            await deleteTaskDocumentation(entry.id);
            setEntries(prev => prev.filter(e => e.id !== entry.id));
            showToast('Slettet', 'info');
        } catch (err: any) {
            showToast(err?.message ?? 'Kunne ikke slette', 'error');
        }
    };

    // ── Add comment ────────────────────────────────────────────────────────────
    const handleAddComment = async (entryId: string) => {
        const text = (commentTexts[entryId] ?? '').trim();
        if (!text) return;
        setAddingCommentId(entryId);
        try {
            const updated = await addCommentToTaskDoc(entryId, {
                authorId: currentUserId,
                authorName: currentUserName,
                text,
            });
            setEntries(prev => prev.map(e =>
                e.id === entryId
                    ? { ...e, comments: updated }
                    : e
            ));
            setCommentTexts(prev => ({ ...prev, [entryId]: '' }));
        } catch {
            showToast('Kunne ikke tilføje kommentar', 'error');
        } finally {
            setAddingCommentId(null);
        }
    };

    // ── Open signed URL in new tab ─────────────────────────────────────────────
    const handleOpenFile = async (storagePath: string) => {
        const url = await resolveFileUrl(storagePath);
        window.open(url, '_blank', 'noopener');
    };

    // ── Derived lists ──────────────────────────────────────────────────────────
    const pinnedReport = entries.find(e => e.kind === 'report' && e.isPinned);
    const regularEntries = entries.filter(e => !(e.kind === 'report' && e.isPinned));

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-4">

            {/* ── Add buttons (worker only) ───────────────────────────────────── */}
            {canAuthor && mode === 'idle' && (
                <div className="bg-bg dark:bg-bg-dark-surface rounded-card border border-border dark:border-border-dark p-4">
                    <p className="text-xs font-semibold text-text-secondary dark:text-text-dark-secondary mb-3 uppercase tracking-wider">
                        Tilføj dokumentation
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {([
                            { m: 'text', icon: '📝', label: 'Tekst' },
                            { m: 'photo', icon: '📷', label: 'Foto' },
                            { m: 'audio', icon: '🎙', label: 'Lyd' },
                            { m: 'link', icon: '🔗', label: 'Link' },
                            { m: 'file', icon: '📎', label: 'Fil' },
                        ] as { m: CaptureMode; icon: string; label: string }[]).map(({ m, icon, label }) => (
                            <button
                                key={m}
                                type="button"
                                onClick={() => setMode(m)}
                                className="flex items-center gap-1.5 border border-border dark:border-border-dark bg-bg dark:bg-bg-dark-surface hover:bg-bg-subtle dark:hover:bg-bg-dark-muted active:bg-bg-muted dark:active:bg-bg-dark-muted rounded-control px-3 py-2 min-h-11 text-sm font-semibold text-text-primary dark:text-text-dark-primary transition-colors"
                            >
                                <span>{icon}</span> {label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Capture panel ──────────────────────────────────────────────── */}
            {canAuthor && mode !== 'idle' && (
                <div className="bg-bg dark:bg-bg-dark-surface rounded-card border border-border dark:border-border-dark p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-base">
                            {mode === 'text' && '📝 Tekst-note'}
                            {mode === 'photo' && '📷 Foto'}
                            {mode === 'audio' && '🎙 Lydoptagelse'}
                            {mode === 'link' && '🔗 Link'}
                            {mode === 'file' && '📎 Fil'}
                        </h3>
                        <button type="button" onClick={resetMode} className="text-text-secondary hover:text-text-primary dark:text-text-dark-secondary dark:hover:text-text-dark-primary min-w-11 min-h-11 flex items-center justify-center -m-2">
                            <XIcon className="w-5 h-5" />
                        </button>
                    </div>

                    {/* ── TEXT ─────────────────────────────────────────────── */}
                    {mode === 'text' && (
                        <>
                            <textarea
                                value={textNote}
                                onChange={e => setTextNote(e.target.value)}
                                placeholder="Skriv din note..."
                                rows={4}
                                className="w-full border border-border-strong dark:border-border-dark-strong rounded-control px-3 py-2 text-sm focus:ring-2 focus:ring-brand-primary focus:outline-none resize-none bg-bg dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary"
                            />
                            <button
                                type="button"
                                onClick={handleSubmitText}
                                disabled={!textNote.trim() || submitting}
                                className="w-full py-2.5 min-h-11 bg-brand-primary text-white rounded-control font-bold text-sm disabled:opacity-50 transition-colors hover:bg-brand-strong"
                            >
                                {submitting ? 'Gemmer...' : 'Tilføj note'}
                            </button>
                        </>
                    )}

                    {/* ── PHOTO ────────────────────────────────────────────── */}
                    {mode === 'photo' && (
                        photoPreview ? (
                            <div className="space-y-3">
                                <img
                                    src={photoPreview}
                                    alt="Preview"
                                    className="w-full max-h-52 object-contain rounded-xl bg-bg-muted dark:bg-bg-dark-muted"
                                />
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => { setPendingPhotoFile(null); setPhotoPreview(null); setCompressedPhotoDataUrl(null); }}
                                        className="flex-1 py-2 min-h-11 border border-border-strong dark:border-border-dark-strong rounded-control text-sm font-medium text-text-primary dark:text-text-dark-primary hover:bg-bg-subtle dark:hover:bg-bg-dark-muted"
                                    >
                                        Vælg andet
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSubmitPhoto}
                                        disabled={submitting}
                                        className="flex-1 py-2 min-h-11 bg-brand-primary text-white rounded-control font-bold text-sm disabled:opacity-50"
                                    >
                                        {submitting ? 'Uploader...' : 'Gem foto'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <FilePicker
                                onFileSelect={handlePhotoSelect}
                                accept="image/*"
                                label="Vælg eller tag foto"
                                buttonStyle="dashed"
                            />
                        )
                    )}

                    {/* ── AUDIO ────────────────────────────────────────────── */}
                    {mode === 'audio' && (
                        mediaRecorderSupported ? (
                            <div className="space-y-3">
                                {/* State: ready to start */}
                                {!audioBlob && !isRecording && (
                                    <button
                                        type="button"
                                        onClick={handleStartRecording}
                                        className="w-full py-3 bg-danger hover:bg-danger-strong text-white rounded-control font-bold flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <MicIcon className="w-5 h-5" />
                                        Start optagelse
                                    </button>
                                )}
                                {/* State: recording */}
                                {isRecording && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3 bg-danger-subtle dark:bg-danger-subtle-dark border border-danger-border dark:border-danger/30 rounded-control p-3">
                                            <span className="w-3 h-3 bg-danger rounded-full animate-pulse flex-shrink-0" />
                                            <span className="font-mono font-bold text-danger-strong dark:text-danger text-lg tabular-nums">
                                                {fmtSec(recordingSeconds)}
                                            </span>
                                            <span className="text-sm text-danger-strong dark:text-danger">Optager...</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleStopRecording}
                                            className="w-full py-2.5 min-h-11 bg-bg-dark hover:bg-bg-dark-subtle text-white rounded-control font-bold transition-colors"
                                        >
                                            Stop optagelse
                                        </button>
                                    </div>
                                )}
                                {/* State: recorded, preview */}
                                {audioBlob && audioBlobUrl && (
                                    <div className="space-y-3">
                                        <div className="bg-bg-subtle dark:bg-bg-dark-muted border border-border dark:border-border-dark rounded-control p-3">
                                            <p className="text-xs text-text-secondary dark:text-text-dark-secondary mb-2">Forhåndsvisning:</p>
                                            <audio src={audioBlobUrl} controls className="w-full" />
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => { setAudioBlob(null); if (audioBlobUrl) URL.revokeObjectURL(audioBlobUrl); setAudioBlobUrl(null); setRecordingSeconds(0); }}
                                                className="flex-1 py-2 min-h-11 border border-border-strong dark:border-border-dark-strong rounded-control text-sm font-medium text-text-primary dark:text-text-dark-primary hover:bg-bg-subtle dark:hover:bg-bg-dark-muted"
                                            >
                                                Optag igen
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleSubmitAudio}
                                                disabled={submitting}
                                                className="flex-1 py-2 min-h-11 bg-brand-primary text-white rounded-control font-bold text-sm disabled:opacity-50"
                                            >
                                                {submitting ? 'Uploader...' : 'Gem lyd'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* Fallback: audio file upload */
                            <div className="space-y-3">
                                <p className="text-sm text-text-secondary">
                                    Optagelse understøttes ikke på denne enhed. Upload en lydfil i stedet:
                                </p>
                                <FilePicker
                                    onFileSelect={async (file) => {
                                        await addEntry({
                                            taskId, projectId,
                                            authorId: currentUserId, authorName: currentUserName,
                                            kind: 'audio',
                                            file,
                                            mimeType: file.type,
                                            sizeBytes: file.size,
                                        });
                                    }}
                                    accept="audio/*"
                                    label="Upload lydfil"
                                    buttonStyle="dashed"
                                />
                            </div>
                        )
                    )}

                    {/* ── LINK ─────────────────────────────────────────────── */}
                    {mode === 'link' && (
                        <>
                            <input
                                type="url"
                                value={linkUrl}
                                onChange={e => setLinkUrl(e.target.value)}
                                placeholder="https://..."
                                className="w-full min-h-11 border border-border-strong dark:border-border-dark-strong rounded-control px-3 py-2 text-sm focus:ring-2 focus:ring-brand-primary focus:outline-none bg-bg dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary"
                            />
                            <input
                                type="text"
                                value={linkCaption}
                                onChange={e => setLinkCaption(e.target.value)}
                                placeholder="Titel / beskrivelse (valgfri)"
                                className="w-full min-h-11 border border-border-strong dark:border-border-dark-strong rounded-control px-3 py-2 text-sm focus:ring-2 focus:ring-brand-primary focus:outline-none bg-bg dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary"
                            />
                            <button
                                type="button"
                                onClick={handleSubmitLink}
                                disabled={!linkUrl.trim() || submitting}
                                className="w-full py-2.5 min-h-11 bg-brand-primary text-white rounded-control font-bold text-sm disabled:opacity-50 hover:bg-brand-strong transition-colors"
                            >
                                {submitting ? 'Gemmer...' : 'Tilføj link'}
                            </button>
                        </>
                    )}

                    {/* ── FILE ─────────────────────────────────────────────── */}
                    {mode === 'file' && (
                        pendingFile ? (
                            <div className="space-y-3">
                                <div className="flex items-center gap-3 bg-bg-subtle dark:bg-bg-dark-muted border border-border dark:border-border-dark rounded-control p-3">
                                    <PaperclipIcon className="w-5 h-5 text-text-secondary flex-shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-text-primary dark:text-text-dark-primary truncate">{pendingFile.name}</p>
                                        <p className="text-xs text-text-secondary dark:text-text-dark-secondary">
                                            {(pendingFile.size / 1024).toFixed(1)} KB
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPendingFile(null)}
                                        className="flex-1 py-2 min-h-11 border border-border-strong dark:border-border-dark-strong rounded-control text-sm font-medium text-text-primary dark:text-text-dark-primary hover:bg-bg-subtle dark:hover:bg-bg-dark-muted"
                                    >
                                        Vælg andet
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSubmitFile}
                                        disabled={submitting}
                                        className="flex-1 py-2 min-h-11 bg-brand-primary text-white rounded-control font-bold text-sm disabled:opacity-50"
                                    >
                                        {submitting ? 'Uploader...' : 'Upload fil'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <FilePicker
                                onFileSelect={setPendingFile}
                                label="Vælg fil"
                                buttonStyle="dashed"
                            />
                        )
                    )}
                </div>
            )}

            {/* ── Loading ─────────────────────────────────────────────────────── */}
            {loading && (
                <div className="flex justify-center py-12">
                    <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                </div>
            )}

            {/* ── Pinned acceptance report ───────────────────────────────────── */}
            {!loading && pinnedReport && (
                <div className="bg-brand-subtle dark:bg-brand-subtle-dark border border-brand-primary rounded-card p-4 flex items-center gap-3">
                    <PinIcon className="w-5 h-5 text-brand-primary dark:text-brand-light flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-text-primary dark:text-text-dark-primary truncate">
                            {pinnedReport.body ?? 'Afleveringsrapport'}
                        </p>
                        <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-0.5">
                            PDF · {fmtDate(pinnedReport.createdAt)}
                        </p>
                    </div>
                    {pinnedReport.storagePath && (
                        <button
                            type="button"
                            onClick={() => handleOpenFile(pinnedReport.storagePath!)}
                            className="flex-shrink-0 bg-brand-primary text-white text-xs font-bold px-3 py-1.5 min-h-11 rounded-control flex items-center gap-1.5 hover:bg-brand-strong transition-colors"
                        >
                            <DownloadIcon className="w-3.5 h-3.5" />
                            Åbn
                        </button>
                    )}
                </div>
            )}

            {/* ── Empty state ──────────────────────────────────────────────────── */}
            {!loading && entries.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                    <div className="w-14 h-14 bg-bg-muted dark:bg-bg-dark-muted rounded-full flex items-center justify-center">
                        <FileTextIcon className="w-7 h-7 text-text-tertiary dark:text-text-dark-tertiary" />
                    </div>
                    <div>
                        <p className="font-semibold text-text-primary dark:text-text-dark-primary">Ingen dokumentation endnu</p>
                        <p className="text-sm text-text-secondary dark:text-text-dark-secondary mt-1">
                            {canAuthor
                                ? 'Tilføj fotos, noter, lydfiler eller links til denne opgave.'
                                : 'Dokumentation fra den ansvarlige medarbejder vises her.'}
                        </p>
                    </div>
                </div>
            )}

            {/* ── Entry list ──────────────────────────────────────────────────── */}
            {!loading && regularEntries.map(entry => {
                const comments = (entry.comments ?? []) as unknown as DocComment[];
                const isExpanded = expandedCommentId === entry.id;
                const canDelete = canDeleteAny || entry.authorId === currentUserId;

                // Parse link body: "caption\nurl" or just "url"
                let linkHref = '';
                let linkLabel = '';
                if (entry.kind === 'link' && entry.body) {
                    const lines = entry.body.split('\n');
                    if (lines.length >= 2) {
                        linkLabel = lines[0];
                        linkHref = lines[1];
                    } else {
                        linkHref = lines[0];
                        linkLabel = lines[0];
                    }
                }

                return (
                    <div key={entry.id} className="bg-bg dark:bg-bg-dark-surface rounded-card border border-border dark:border-border-dark p-4">

                        {/* ── Entry header ─────────────────────────────────── */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="text-xs text-text-secondary dark:text-text-dark-secondary leading-relaxed">
                                <span className="font-semibold text-text-primary dark:text-text-dark-primary">{entry.authorName}</span>
                                {' · '}{fmtDate(entry.createdAt)}
                                {' · '}<span className="font-medium">{KIND_LABEL[entry.kind] ?? entry.kind}</span>
                            </p>
                            {canDelete && (
                                <button
                                    type="button"
                                    onClick={() => handleDelete(entry)}
                                    className="p-3.5 -m-2.5 text-text-tertiary dark:text-text-dark-tertiary hover:text-danger transition-colors flex-shrink-0"
                                    title="Slet"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* ── Content by kind ──────────────────────────────── */}
                        {entry.kind === 'text' && entry.body && (
                            <p className="text-sm text-text-primary dark:text-text-dark-primary whitespace-pre-wrap">{entry.body}</p>
                        )}

                        {entry.kind === 'photo' && entry.storagePath && (
                            <DocImage
                                storagePath={entry.storagePath}
                                className="w-full max-h-52"
                                onClick={() => setViewingImage(entry.storagePath!)}
                            />
                        )}

                        {entry.kind === 'audio' && entry.storagePath && (
                            <AudioPlayer storagePath={entry.storagePath} />
                        )}

                        {entry.kind === 'link' && (
                            <a
                                href={linkHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-sm text-brand-primary font-medium hover:underline"
                            >
                                <LinkIcon className="w-4 h-4 flex-shrink-0" />
                                <span className="truncate">{linkLabel || linkHref}</span>
                            </a>
                        )}

                        {entry.kind === 'file' && (
                            <div className="flex items-center gap-2">
                                <PaperclipIcon className="w-4 h-4 text-text-secondary flex-shrink-0" />
                                {entry.storagePath ? (
                                    <button
                                        type="button"
                                        onClick={() => handleOpenFile(entry.storagePath!)}
                                        className="text-sm text-brand-primary font-medium hover:underline truncate"
                                    >
                                        {entry.body ?? 'Fil'}
                                    </button>
                                ) : (
                                    <span className="text-sm text-text-secondary">{entry.body ?? 'Fil'}</span>
                                )}
                                {entry.sizeBytes != null && (
                                    <span className="text-xs text-text-secondary flex-shrink-0">
                                        ({(entry.sizeBytes / 1024).toFixed(1)} KB)
                                    </span>
                                )}
                            </div>
                        )}

                        {/* ── Comments section ─────────────────────────────── */}
                        <div className="mt-3 pt-3 border-t border-border dark:border-border-dark">
                            <button
                                type="button"
                                onClick={() => setExpandedCommentId(isExpanded ? null : entry.id)}
                                className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
                            >
                                <MessageSquareIcon className="w-3.5 h-3.5" />
                                {comments.length > 0
                                    ? `${comments.length} kommentar${comments.length !== 1 ? 'er' : ''}`
                                    : 'Kommentarer'}
                            </button>

                            {isExpanded && (
                                <div className="mt-3 space-y-2">
                                    {comments.map(c => (
                                        <div key={c.id} className="bg-bg-subtle dark:bg-bg-dark-muted rounded-lg px-3 py-2">
                                            <div className="flex justify-between items-baseline gap-2">
                                                <span className="text-xs font-semibold text-text-primary dark:text-text-dark-primary">
                                                    {c.authorName}
                                                </span>
                                                <span className="text-xs text-text-secondary dark:text-text-dark-secondary flex-shrink-0">
                                                    {fmtDate(c.createdAt)}
                                                </span>
                                            </div>
                                            <p className="text-sm mt-1 text-text-primary dark:text-text-dark-primary">{c.text}</p>
                                        </div>
                                    ))}

                                    {/* Comment input (Mester only) */}
                                    {isOwnerOrManager && (
                                        <div className="flex gap-2 mt-2">
                                            <input
                                                type="text"
                                                value={commentTexts[entry.id] ?? ''}
                                                onChange={e => setCommentTexts(prev => ({ ...prev, [entry.id]: e.target.value }))}
                                                onKeyDown={e => { if (e.key === 'Enter') handleAddComment(entry.id); }}
                                                placeholder="Tilføj kommentar..."
                                                className="flex-1 min-h-11 border border-border-strong dark:border-border-dark-strong rounded-control px-3 py-1.5 text-sm focus:ring-2 focus:ring-brand-primary focus:outline-none bg-bg dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleAddComment(entry.id)}
                                                disabled={!commentTexts[entry.id]?.trim() || addingCommentId === entry.id}
                                                className="px-3 py-1.5 min-h-11 min-w-11 flex items-center justify-center bg-brand-primary text-white rounded-control text-sm disabled:opacity-50 flex-shrink-0 hover:bg-brand-strong transition-colors"
                                            >
                                                {addingCommentId === entry.id
                                                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                    : <SendIcon className="w-4 h-4" />
                                                }
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}

            {/* ── Full-screen image viewer ─────────────────────────────────────── */}
            {viewingImage && (
                <FullScreenImage
                    storagePath={viewingImage}
                    onClose={() => setViewingImage(null)}
                />
            )}
        </div>
    );
};

export default TaskDocumentationTab;
