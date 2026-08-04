import React, {
    useState,
    useRef,
    useCallback,
    useEffect,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
    XIcon,
    PlusIcon,
    CameraIcon,
    ImageIcon,
    MicIcon,
    TrashIcon,
    CalendarIcon,
    MapPinIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    CheckIcon,
    PlayIcon,
    PauseIcon,
} from '../../../components/icons';
import { createProjectWithPlan } from '../services/projects';
import { useAuth } from '../../../contexts/AuthProvider';
import { useModuleGate } from '../../../core/entitlements/ModuleGate';
import { useToast } from '../../../contexts/ToastContext';
import { Button, Input, Textarea, EmptyState, Badge, Modal } from '../../../components/ui';

// ── Danish task types ─────────────────────────────────────────────────────────
const DEFAULT_TASK_TYPES = [
    'Nedrivning',
    'Murer',
    'Tømrer',
    'Snedker',
    'VVS',
    'El-installation',
    'Malerarbejde',
    'Gulvlægning',
    'Flisesætning',
    'Tagdækning',
    'Vinduer & Døre',
    'Isolering',
    'Ventilation',
    'Betonarbejde',
    'Facadearbejde',
    'Terrasse & Udendørs',
    'Rengøring',
    'Inspektion',
    'Transport',
    'Andet',
];

const STORAGE_KEY = 'bygsmart_quick_task_types';

function loadTaskTypes(): string[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw) as string[];
    } catch {}
    return [...DEFAULT_TASK_TYPES];
}
function saveTaskTypes(types: string[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(types));
}

// ── QuickTask (local, before persisted) ──────────────────────────────────────
interface QuickTask {
    id: string;
    description: string;
    type: string;
    room: string;
    deadline: string;
    address: string;
    photos: { url: string; name: string }[];
    audioUrl: string | null;
    audioDuration: number;
}

// ── AudioRecorder hook ────────────────────────────────────────────────────────
function useAudioRecorder() {
    const [isRecording, setIsRecording] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [seconds, setSeconds] = useState(0);
    const mediaRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const start = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const rec = new MediaRecorder(stream);
            chunksRef.current = [];
            rec.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };
            rec.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                setAudioUrl(URL.createObjectURL(blob));
                stream.getTracks().forEach((t) => t.stop());
            };
            rec.start();
            mediaRef.current = rec;
            setIsRecording(true);
            setSeconds(0);
            timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
        } catch {
            // Mic not available
        }
    }, []);

    const stop = useCallback(() => {
        mediaRef.current?.stop();
        setIsRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
    }, []);

    const clear = useCallback(() => {
        setAudioUrl(null);
        setSeconds(0);
    }, []);

    useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

    return { isRecording, audioUrl, seconds, start, stop, clear };
}

// ── StepIndicator ─────────────────────────────────────────────────────────────
const WIZARD_STEPS = ['Projekt', 'Opgaver'];
const StepIndicator: React.FC<{ current: number }> = ({ current }) => (
    <div className="flex items-center gap-1.5" role="img" aria-label={`Trin ${current} af ${WIZARD_STEPS.length}`}>
        {WIZARD_STEPS.map((label, i) => {
            const step = i + 1;
            const isDone = step < current;
            const isCurrent = step === current;
            return (
                <React.Fragment key={label}>
                    {i > 0 && (
                        <div
                            className={`w-4 h-0.5 rounded-full transition-colors duration-300 ${
                                current >= step ? 'bg-brand-primary' : 'bg-border-strong dark:bg-border-dark-strong'
                            }`}
                        />
                    )}
                    <div
                        title={label}
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors duration-300 ${
                            isDone
                                ? 'bg-brand-primary text-white'
                                : isCurrent
                                ? 'bg-brand-primary text-white ring-2 ring-brand-primary/25'
                                : 'bg-bg-muted dark:bg-bg-dark-muted text-text-tertiary dark:text-text-dark-tertiary'
                        }`}
                    >
                        {isDone ? <CheckIcon className="w-3.5 h-3.5" /> : step}
                    </div>
                </React.Fragment>
            );
        })}
    </div>
);

// ── TaskTypeDropdown ──────────────────────────────────────────────────────────
interface TaskTypeDropdownProps {
    value: string;
    onChange: (v: string) => void;
    types: string[];
    onAddType: (t: string) => void;
    onDeleteType: (t: string) => void;
}
const TaskTypeDropdown: React.FC<TaskTypeDropdownProps> = ({ value, onChange, types, onAddType, onDeleteType }) => {
    const [open, setOpen] = useState(false);
    const [newType, setNewType] = useState('');
    const holdTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    const handleAdd = () => {
        const trimmed = newType.trim();
        if (trimmed && !types.includes(trimmed)) {
            onAddType(trimmed);
            setNewType('');
        }
    };

    const startHold = (type: string) => {
        holdTimers.current[type] = setTimeout(() => {
            onDeleteType(type);
        }, 600);
    };

    const cancelHold = (type: string) => {
        clearTimeout(holdTimers.current[type]);
    };

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-haspopup="listbox"
                aria-expanded={open}
                className="w-full h-11 flex items-center justify-between border border-border-strong dark:border-border-dark-strong rounded-control px-3 text-sm bg-bg dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary transition-colors duration-150 focus:border-brand-primary"
            >
                <span className={value ? '' : 'text-text-tertiary dark:text-text-dark-tertiary'}>{value || 'Vælg opgavetype...'}</span>
                {open ? <ChevronUpIcon className="w-4 h-4 text-text-tertiary" /> : <ChevronDownIcon className="w-4 h-4 text-text-tertiary" />}
            </button>

            {open && (
                <div className="absolute z-50 mt-1 w-full bg-bg dark:bg-bg-dark-surface border border-border dark:border-border-dark rounded-card shadow-modal overflow-hidden animate-scale-in">
                    <div className="max-h-48 overflow-y-auto">
                        {types.map((t) => (
                            <div
                                key={t}
                                className="flex items-center justify-between"
                            >
                                <button
                                    type="button"
                                    className={`flex-1 text-left px-4 py-2.5 text-sm hover:bg-bg-subtle dark:hover:bg-bg-dark-muted transition-colors ${value === t ? 'text-brand-primary font-semibold' : 'text-text-primary dark:text-text-dark-primary'}`}
                                    onClick={() => { onChange(t); setOpen(false); }}
                                    onPointerDown={() => startHold(t)}
                                    onPointerUp={() => cancelHold(t)}
                                    onPointerLeave={() => cancelHold(t)}
                                >
                                    {t}
                                    {value === t && <CheckIcon className="w-3.5 h-3.5 inline ml-2 text-brand-primary" />}
                                </button>
                            </div>
                        ))}
                    </div>
                    {/* Add new type */}
                    <div className="border-t border-border dark:border-border-dark p-2 flex gap-2">
                        <input
                            value={newType}
                            onChange={(e) => setNewType(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                            placeholder="Tilføj ny type..."
                            aria-label="Tilføj ny opgavetype"
                            className="flex-1 text-sm px-3 py-1.5 border border-border-strong dark:border-border-dark-strong rounded-control bg-bg dark:bg-bg-dark-muted text-text-primary dark:text-text-dark-primary focus:outline-none focus:border-brand-primary transition-colors duration-150"
                        />
                        <button
                            type="button"
                            onClick={handleAdd}
                            aria-label="Tilføj type"
                            className="px-3 py-1.5 bg-brand-primary text-white rounded-control text-sm font-semibold hover:bg-brand-primary/90 transition-colors duration-150"
                        >
                            <PlusIcon className="w-4 h-4" />
                        </button>
                    </div>
                    <p className="text-caption text-center text-text-tertiary dark:text-text-dark-tertiary pb-1.5">Hold på en type for at slette den</p>
                </div>
            )}
        </div>
    );
};

// ── TaskFormPanel ─────────────────────────────────────────────────────────────
interface TaskFormPanelProps {
    taskTypes: string[];
    onAddType: (t: string) => void;
    onDeleteType: (t: string) => void;
    onSubmit: (task: Omit<QuickTask, 'id'>) => void;
    onCancel: () => void;
}
const TaskFormPanel: React.FC<TaskFormPanelProps> = ({ taskTypes, onAddType, onDeleteType, onSubmit, onCancel }) => {
    const [description, setDescription] = useState('');
    const [type, setType] = useState('');
    const [room, setRoom] = useState('');
    const [deadline, setDeadline] = useState('');
    const [address, setAddress] = useState('');
    const [photos, setPhotos] = useState<{ url: string; name: string }[]>([]);
    const photoInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const audio = useAudioRecorder();

    const handlePhotoFiles = (files: FileList | null) => {
        if (!files) return;
        Array.from(files).forEach((f) => {
            const url = URL.createObjectURL(f);
            setPhotos((prev) => [...prev, { url, name: f.name }]);
        });
    };

    const handleSubmit = () => {
        if (!description.trim()) return;
        onSubmit({
            description,
            type,
            room,
            deadline,
            address,
            photos,
            audioUrl: audio.audioUrl,
            audioDuration: audio.seconds,
        });
    };

    return (
        <Modal
            open
            onClose={onCancel}
            title="Ny Opgave"
            sheet
            size="md"
            footer={
                <Button
                    size="lg"
                    fullWidth
                    onClick={handleSubmit}
                    disabled={!description.trim()}
                    iconLeft={<PlusIcon className="w-5 h-5" />}
                >
                    Tilføj Opgave
                </Button>
            }
        >
                <div className="space-y-4 pt-1">
                    {/* Description */}
                    <Textarea
                        label="Beskrivelse"
                        required
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                        placeholder="Beskriv opgaven..."
                        className="resize-none"
                    />

                    {/* Task type */}
                    <div>
                        <span className="block text-sm font-medium text-text-primary dark:text-text-dark-primary mb-1.5">Opgavetype</span>
                        <TaskTypeDropdown
                            value={type}
                            onChange={setType}
                            types={taskTypes}
                            onAddType={onAddType}
                            onDeleteType={onDeleteType}
                        />
                    </div>

                    {/* Room + Deadline row */}
                    <div className="grid grid-cols-2 gap-3">
                        <Input
                            label="Rum"
                            value={room}
                            onChange={(e) => setRoom(e.target.value)}
                            placeholder="F.eks. Badeværelse"
                        />
                        <Input
                            label="Deadline"
                            type="date"
                            value={deadline}
                            onChange={(e) => setDeadline(e.target.value)}
                        />
                    </div>

                    {/* Address optional */}
                    <Input
                        label="Adresse"
                        hint="Valgfri"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="F.eks. Søgade 12, 2. tv"
                    />

                    {/* Photos */}
                    <div>
                        <span className="block text-sm font-medium text-text-primary dark:text-text-dark-primary mb-1.5">Fotos</span>
                        <div className="flex gap-2 flex-wrap">
                            {/* Camera button */}
                            <button
                                type="button"
                                onClick={() => cameraInputRef.current?.click()}
                                className="w-16 h-16 rounded-control border-2 border-dashed border-border-strong dark:border-border-dark-strong flex flex-col items-center justify-center gap-1 text-text-tertiary dark:text-text-dark-tertiary hover:border-brand-primary hover:text-brand-primary transition-colors duration-150"
                            >
                                <CameraIcon className="w-5 h-5" />
                                <span className="text-caption font-medium">Kamera</span>
                            </button>
                            {/* Gallery button */}
                            <button
                                type="button"
                                onClick={() => photoInputRef.current?.click()}
                                className="w-16 h-16 rounded-control border-2 border-dashed border-border-strong dark:border-border-dark-strong flex flex-col items-center justify-center gap-1 text-text-tertiary dark:text-text-dark-tertiary hover:border-brand-primary hover:text-brand-primary transition-colors duration-150"
                            >
                                <ImageIcon className="w-5 h-5" />
                                <span className="text-caption font-medium">Galleri</span>
                            </button>
                            {/* Photo thumbnails */}
                            {photos.map((p, i) => (
                                <div key={i} className="relative w-16 h-16">
                                    <img src={p.url} alt={p.name} className="w-16 h-16 object-cover rounded-control" />
                                    <button
                                        type="button"
                                        onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                                        aria-label={`Fjern foto ${p.name}`}
                                        className="absolute -top-1.5 -right-1.5 bg-danger text-white rounded-full w-5 h-5 flex items-center justify-center shadow-sm hover:bg-danger/90 transition-colors duration-150"
                                    >
                                        <XIcon className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <input
                            ref={photoInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => handlePhotoFiles(e.target.files)}
                        />
                        <input
                            ref={cameraInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => handlePhotoFiles(e.target.files)}
                        />
                    </div>

                    {/* Audio recorder */}
                    <div>
                        <span className="block text-sm font-medium text-text-primary dark:text-text-dark-primary mb-1.5">Lydoptagelse</span>
                        {!audio.audioUrl ? (
                            <button
                                type="button"
                                onClick={audio.isRecording ? audio.stop : audio.start}
                                className={`flex items-center gap-3 px-4 py-3 rounded-card border-2 w-full transition-all duration-150 ${
                                    audio.isRecording
                                        ? 'border-danger bg-danger-subtle dark:bg-danger-subtle-dark text-danger'
                                        : 'border-border-strong dark:border-border-dark-strong bg-bg-subtle dark:bg-bg-dark-muted text-text-secondary dark:text-text-dark-secondary hover:border-brand-primary hover:text-brand-primary'
                                }`}
                            >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${audio.isRecording ? 'bg-danger' : 'bg-bg-muted dark:bg-bg-dark-muted'}`}>
                                    <MicIcon className={`w-4 h-4 ${audio.isRecording ? 'text-white' : 'text-text-secondary dark:text-text-dark-secondary'}`} />
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="text-sm font-semibold">{audio.isRecording ? 'Stopper optagelse...' : 'Optag lyd'}</p>
                                    {audio.isRecording && (
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <div className="flex gap-0.5">
                                                {[1,2,3,4,5].map((b) => (
                                                    <div
                                                        key={b}
                                                        className="w-0.5 bg-danger/70 rounded-full animate-pulse"
                                                        style={{ height: `${8 + Math.sin(b * 1.5) * 6}px`, animationDelay: `${b * 0.1}s` }}
                                                    />
                                                ))}
                                            </div>
                                            <span className="text-xs text-danger font-mono">
                                                {String(Math.floor(audio.seconds / 60)).padStart(2, '0')}:{String(audio.seconds % 60).padStart(2, '0')}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                {audio.isRecording && (
                                    <div className="w-3 h-3 bg-danger rounded-full animate-ping flex-shrink-0" />
                                )}
                            </button>
                        ) : (
                            <div className="flex items-center gap-3 p-3 rounded-card bg-success-subtle dark:bg-success-subtle-dark border border-success/30">
                                <audio src={audio.audioUrl} controls className="flex-1 h-8 min-w-0" style={{ maxWidth: 'calc(100% - 3rem)' }} />
                                <button
                                    type="button"
                                    onClick={audio.clear}
                                    aria-label="Slet lydoptagelse"
                                    className="p-2 rounded-full bg-danger-subtle dark:bg-danger-subtle-dark text-danger hover:bg-danger/20 transition-colors duration-150 flex-shrink-0"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
        </Modal>
    );
};

// ── Task Card ─────────────────────────────────────────────────────────────────
const TaskCard: React.FC<{ task: QuickTask; onDelete: () => void }> = ({ task, onDelete }) => (
    <div className="bg-bg dark:bg-bg-dark-surface rounded-card border border-border dark:border-border-dark p-4 shadow-card animate-fade-in">
        <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
                <p className="font-semibold text-text-primary dark:text-text-dark-primary text-sm leading-snug">{task.description}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                    {task.type && <Badge variant="brand">{task.type}</Badge>}
                    {task.room && <Badge variant="neutral">{task.room}</Badge>}
                    {task.deadline && (
                        <Badge variant="warning">
                            <CalendarIcon className="w-3 h-3" />
                            {new Date(task.deadline).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}
                        </Badge>
                    )}
                    {task.photos.length > 0 && (
                        <Badge variant="info">
                            <CameraIcon className="w-3 h-3" />
                            {task.photos.length} foto{task.photos.length > 1 ? 's' : ''}
                        </Badge>
                    )}
                    {task.audioUrl && (
                        <Badge variant="success">
                            <MicIcon className="w-3 h-3" />
                            Lyd
                        </Badge>
                    )}
                </div>
                {task.address && (
                    <p className="text-caption text-text-tertiary dark:text-text-dark-tertiary mt-1.5 flex items-center gap-1">
                        <MapPinIcon className="w-2.5 h-2.5" />
                        {task.address}
                    </p>
                )}
            </div>
            <button type="button" onClick={onDelete} aria-label="Slet opgave" className="p-2 -m-1 rounded-full hover:bg-danger-subtle dark:hover:bg-danger-subtle-dark text-text-tertiary hover:text-danger transition-colors duration-150 flex-shrink-0">
                <TrashIcon className="w-4 h-4" />
            </button>
        </div>
        {task.photos.length > 0 && (
            <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1">
                {task.photos.map((p, i) => (
                    <img key={i} src={p.url} alt={p.name} className="w-14 h-14 object-cover rounded-control flex-shrink-0" />
                ))}
            </div>
        )}
    </div>
);

// ── Main component ────────────────────────────────────────────────────────────
export interface QuickProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const QuickProjectModal: React.FC<QuickProjectModalProps> = ({ isOpen, onClose }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showToast } = useToast();
    const budgetEnabled = useModuleGate('budget');

    const [step, setStep] = useState<'setup' | 'tasks'>('setup');
    // Setup step
    const [projectName, setProjectName] = useState('');
    const [projectAddress, setProjectAddress] = useState('');
    const [coverPhoto, setCoverPhoto] = useState<{ url: string; name: string } | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);
    // Tasks step
    const [tasks, setTasks] = useState<QuickTask[]>([]);
    const [showTaskForm, setShowTaskForm] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    // Task types
    const [taskTypes, setTaskTypes] = useState<string[]>(loadTaskTypes);
    const coverInputRef = useRef<HTMLInputElement>(null);
    const coverCameraRef = useRef<HTMLInputElement>(null);

    const handleAddType = (t: string) => {
        const updated = [...taskTypes, t];
        setTaskTypes(updated);
        saveTaskTypes(updated);
    };

    const handleDeleteType = (t: string) => {
        // Only allow deleting user-added (non-default) types
        const updated = taskTypes.filter((x) => x !== t);
        setTaskTypes(updated);
        saveTaskTypes(updated);
        showToast(`"${t}" slettet`, 'info');
    };

    const handleCoverFile = (files: FileList | null) => {
        if (!files?.[0]) return;
        const url = URL.createObjectURL(files[0]);
        setCoverPhoto({ url, name: files[0].name });
    };

    const handleCreateProject = async () => {
        if (!projectName.trim()) return;
        setIsCreating(true);
        try {
            const today = new Date().toISOString().split('T')[0];
            const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const project = await createProjectWithPlan(
                projectName.trim(),
                '',
                [],
                [],
                [],
                today,
                endDate,
                user?.id,
                { address: projectAddress.trim() || undefined },
                budgetEnabled
            );
            setCreatedProjectId(project.id);
            setStep('tasks');
        } catch {
            showToast('Kunne ikke oprette projekt. Prøv igen.', 'error');
        } finally {
            setIsCreating(false);
        }
    };

    const handleAddTask = async (taskData: Omit<QuickTask, 'id'>) => {
        const newTask: QuickTask = { ...taskData, id: `qt-${Date.now()}` };
        setTasks((prev) => [...prev, newTask]);
        setShowTaskForm(false);

        // Persist immediately if we have a project
        if (createdProjectId) {
            const attachments = taskData.photos.map((p) => ({
                url: p.url,
                type: 'image' as const,
                name: p.name,
            }));
            // Reverse edge of tasks->projects stays dynamic (no module cycle).
            const { createTaskForProject } = await import('../../tasks');
            await createTaskForProject(createdProjectId, {
                title: taskData.description.split('\n')[0].slice(0, 80),
                description: `${taskData.description}${taskData.room ? `\nRum: ${taskData.room}` : ''}${taskData.address ? `\nAdresse: ${taskData.address}` : ''}${taskData.type ? `\nType: ${taskData.type}` : ''}`,
                status: 'To Do',
                dueDate: taskData.deadline || undefined,
                attachments,
                assignees: [],
            });
        }
    };

    const handleDeleteTask = (id: string) => {
        setTasks((prev) => prev.filter((t) => t.id !== id));
    };

    const handleFinish = () => {
        if (createdProjectId) {
            navigate(`/project-detail/${createdProjectId}`);
        }
        handleClose();
    };

    const handleClose = () => {
        setStep('setup');
        setProjectName('');
        setProjectAddress('');
        setCoverPhoto(null);
        setTasks([]);
        setCreatedProjectId(null);
        setShowTaskForm(false);
        onClose();
    };

    if (!isOpen) return null;

    // ── Step: Setup ───────────────────────────────────────────────────────────
    if (step === 'setup') {
        return (
            <Modal
                open
                onClose={handleClose}
                title="Hurtigt Projekt"
                size="sm"
                footer={
                    <div className="flex w-full flex-col gap-2">
                        <Button
                            size="lg"
                            fullWidth
                            onClick={handleCreateProject}
                            disabled={!projectName.trim()}
                            loading={isCreating}
                            iconLeft={<PlusIcon className="w-5 h-5" />}
                        >
                            {isCreating ? 'Opretter…' : 'Opret Projekt'}
                        </Button>
                        <Button variant="ghost" fullWidth onClick={handleClose}>
                            Annuller
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4 pt-1">
                    <div className="flex items-center justify-between">
                        <p className="text-caption text-text-tertiary dark:text-text-dark-tertiary">Trin 1 af 2 · Projekt</p>
                        <StepIndicator current={1} />
                    </div>

                    {/* Cover photo preview */}
                    {coverPhoto ? (
                        <div className="relative h-40 sm:h-36 -mx-5 overflow-hidden">
                            <img src={coverPhoto.url} alt="Cover" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/60 flex items-end p-4">
                                <button
                                    type="button"
                                    onClick={() => setCoverPhoto(null)}
                                    aria-label="Fjern billede"
                                    className="ml-auto p-2 bg-white/20 backdrop-blur rounded-full text-white hover:bg-white/30 transition-colors duration-150"
                                >
                                    <XIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => coverCameraRef.current?.click()}
                                className="flex-1 flex flex-col items-center gap-1.5 py-4 rounded-card border-2 border-dashed border-border-strong dark:border-border-dark-strong text-text-tertiary dark:text-text-dark-tertiary hover:border-brand-primary hover:text-brand-primary transition-colors duration-150"
                            >
                                <CameraIcon className="w-6 h-6" />
                                <span className="text-xs font-medium">Tag billede</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => coverInputRef.current?.click()}
                                className="flex-1 flex flex-col items-center gap-1.5 py-4 rounded-card border-2 border-dashed border-border-strong dark:border-border-dark-strong text-text-tertiary dark:text-text-dark-tertiary hover:border-brand-primary hover:text-brand-primary transition-colors duration-150"
                            >
                                <ImageIcon className="w-6 h-6" />
                                <span className="text-xs font-medium">Vælg billede</span>
                            </button>
                        </div>
                    )}

                    <input ref={coverInputRef} type="file" accept="image/*" className="hidden" aria-label="Vælg coverbillede" onChange={(e) => handleCoverFile(e.target.files)} />
                    <input ref={coverCameraRef} type="file" accept="image/*" capture="environment" className="hidden" aria-label="Tag coverbillede" onChange={(e) => handleCoverFile(e.target.files)} />

                    <Input
                        label="Projektnavn"
                        required
                        autoFocus
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                        placeholder="Indtast Projektnavn"
                    />

                    <Input
                        label="Adresse"
                        hint="Valgfri"
                        value={projectAddress}
                        onChange={(e) => setProjectAddress(e.target.value)}
                        placeholder="F.eks. Nørregade 5, 1165 København"
                    />
                </div>
            </Modal>
        );
    }

    // ── Step: Tasks ───────────────────────────────────────────────────────────
    return (
        <>
            <div className="fixed inset-0 bg-bg-subtle dark:bg-bg-dark z-[60] flex flex-col">
                {/* Header */}
                <header
                    className="bg-bg dark:bg-bg-dark-surface border-b border-border dark:border-border-dark flex items-center gap-3 px-4 py-3 flex-shrink-0"
                    style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0.75rem))' }}
                >
                    <button
                        type="button"
                        onClick={() => setStep('setup')}
                        aria-label="Tilbage til projektopsætning"
                        className="min-w-11 min-h-11 -ml-2 flex items-center justify-center rounded-full hover:bg-bg-muted dark:hover:bg-bg-dark-muted text-text-secondary dark:text-text-dark-secondary transition-colors duration-150"
                    >
                        <XIcon className="w-5 h-5" />
                    </button>
                    <div className="flex-1 min-w-0">
                        <h2 className="font-bold text-text-primary dark:text-text-dark-primary truncate">{projectName}</h2>
                        <p className="text-xs text-text-secondary dark:text-text-dark-secondary">
                            {tasks.length === 0 ? 'Tilføj opgaver' : `${tasks.length} opgave${tasks.length !== 1 ? 'r' : ''} tilføjet`}
                        </p>
                    </div>
                    <StepIndicator current={2} />
                    <Button size="sm" onClick={handleFinish}>
                        Færdig
                    </Button>
                </header>

                {/* Task list */}
                <main className="flex-grow overflow-y-auto p-4 space-y-3"
                    style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}>
                    {tasks.length === 0 ? (
                        <EmptyState
                            icon={<PlusIcon />}
                            title="Ingen opgaver endnu"
                            description="Tilføj den første opgave med beskrivelse, fotos og lyd — direkte fra pladsen."
                            className="py-16 animate-fade-in"
                            action={
                                <Button size="sm" iconLeft={<PlusIcon className="w-4 h-4" />} onClick={() => setShowTaskForm(true)}>
                                    Tilføj opgave
                                </Button>
                            }
                        />
                    ) : (
                        tasks.map((t) => (
                            <TaskCard key={t.id} task={t} onDelete={() => handleDeleteTask(t.id)} />
                        ))
                    )}
                </main>

                {/* FAB */}
                <button
                    onClick={() => setShowTaskForm(true)}
                    className="fixed bottom-6 right-4 bg-brand-primary text-white rounded-full w-14 h-14 flex items-center justify-center shadow-raised z-[65] hover:bg-brand-primary/90 active:scale-95 transition-all"
                    style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
                    aria-label="Tilføj opgave"
                >
                    <PlusIcon className="w-7 h-7" />
                </button>
            </div>

            {showTaskForm && (
                <TaskFormPanel
                    taskTypes={taskTypes}
                    onAddType={handleAddType}
                    onDeleteType={handleDeleteType}
                    onSubmit={handleAddTask}
                    onCancel={() => setShowTaskForm(false)}
                />
            )}
        </>
    );
};

export default QuickProjectModal;
