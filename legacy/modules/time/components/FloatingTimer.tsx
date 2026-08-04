import React, { useState, useRef, useEffect } from 'react';
import { PlayIcon, PauseIcon } from '../../../components/icons';
import { Task } from '../../../types';
import { TimerState } from './TimeManagementTabContent';
import { GenericModal } from '../../../components/ui/GenericModal';

const DRAG_START_DISTANCE = 5;
const EDGE_DOCK_DISTANCE = 24;
const IDLE_DIM_DELAY = 3000;

const TaskPickerModal: React.FC<{
    projectTasks: Task[];
    onSelect: (taskId: string) => void;
    onClose: () => void;
}> = ({ projectTasks, onSelect, onClose }) => {
    return (
        <GenericModal title="Vælg opgave til timer" onClose={onClose} footer={
            <div className="flex justify-end">
                <button type="button" onClick={onClose} title="Annuller opgavevalg" aria-label="Annuller opgavevalg" className="px-4 py-2 rounded-lg border font-medium text-text-primary dark:text-text-dark-primary">Annuller</button>
            </div>
        }>
            <div className="space-y-1">
                <button
                    type="button"
                    onClick={() => onSelect('administration')}
                    title="Start timer på Administration"
                    aria-label="Start timer på Administration"
                    className="w-full text-left px-4 py-3 rounded-control hover:bg-bg-muted dark:hover:bg-bg-dark-muted transition-colors font-medium text-text-primary dark:text-text-dark-primary"
                >
                    Administration
                </button>
                {projectTasks.map(task => (
                    <button
                        type="button"
                        key={task.id}
                        onClick={() => onSelect(task.id)}
                        title={`Start timer på ${task.title}`}
                        aria-label={`Start timer på ${task.title}`}
                        className="w-full text-left px-4 py-3 rounded-control hover:bg-bg-muted dark:hover:bg-bg-dark-muted transition-colors text-text-primary dark:text-text-dark-primary"
                    >
                        {task.title}
                    </button>
                ))}
            </div>
        </GenericModal>
    );
};

// Simple Modal for stopping timer
const StopTimerModal: React.FC<{
    timerState: TimerState;
    projectTasks: Task[];
    onClose: () => void;
    onSaveLog: (data: { hours: number, taskId: string, description: string }) => void;
    user: any;
}> = ({ timerState, projectTasks, onClose, onSaveLog, user }) => {
    const [activityType, setActivityType] = useState('Udførelse');
    const [selectedTaskId, setSelectedTaskId] = useState(timerState.taskId || '');
    const [description, setDescription] = useState('');
    
    const hours = Math.max(0.1, parseFloat((timerState.seconds / 3600).toFixed(2)));
    const activityTypes = ['Planlægning', 'Indkøb', 'Udførelse', 'Møde', 'Kørsel', 'Dokumentation', 'Andet'];

    const handleSave = () => {
        const fullDesc = `[${activityType}] ${description}`.trim();
        onSaveLog({ hours, taskId: selectedTaskId, description: fullDesc });
    };

    return (
        <GenericModal title="Registrer Tid" onClose={onClose} footer={
            <div className="flex justify-end gap-2">
                <button type="button" onClick={onClose} title="Annuller" aria-label="Annuller" className="px-4 py-2 rounded-lg border font-medium text-text-primary dark:text-text-dark-primary">Annuller</button>
                <button type="button" onClick={handleSave} title="Gem og stop timer" aria-label="Gem og stop timer" className="px-4 py-2 bg-brand-primary text-white rounded-lg font-bold">Gem & Stop</button>
            </div>
        }>
            <div className="space-y-4">
                <div className="text-center bg-brand-subtle dark:bg-brand-subtle-dark p-4 rounded-card mb-4">
                    <p className="text-sm text-text-secondary">Total tid registreret</p>
                    <p className="text-4xl font-bold text-brand-primary dark:text-brand-light mt-1">{hours} <span className="text-lg font-medium text-text-secondary">timer</span></p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <label className="block space-y-1"><span className="text-sm text-text-secondary">Aktivitet</span><select value={activityType} onChange={(e) => setActivityType(e.target.value)} className="w-full min-h-11 border border-border-strong dark:border-border-dark-strong rounded-control px-3 py-2 bg-bg dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary">{activityTypes.map(t => <option key={t} value={t}>{t}</option>)}</select></label>
                    <label className="block space-y-1"><span className="text-sm text-text-secondary">Opgave</span><select value={selectedTaskId} onChange={(e) => setSelectedTaskId(e.target.value)} className="w-full min-h-11 border border-border-strong dark:border-border-dark-strong rounded-control px-3 py-2 bg-bg dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary"><option value="">Ingen / Generelt</option><option value="administration">Administration</option>{projectTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
                </div>
                <label className="block space-y-1"><span className="text-sm text-text-secondary">Beskrivelse</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Hvad har du lavet?" rows={3} className="w-full border border-border-strong dark:border-border-dark-strong rounded-control px-3 py-2 bg-bg dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary" /></label>
                {user && <div className="text-xs text-text-secondary text-right">Logges som: <strong>{user.name}</strong></div>}
            </div>
        </GenericModal>
    );
}

export const FloatingTimer: React.FC<{
    timerState: TimerState;
    projectTasks: Task[];
    onOpenTimeTab: () => void;
    onSaveLog: (data: { hours: number, taskId: string, description: string }) => void;
    user?: any;
}> = ({ timerState, projectTasks, onOpenTimeTab, onSaveLog, user }) => {
    // null = not yet dragged → anchor to the bottom-right. On phones, keep the
    // timer above the floating bottom navigation and the device safe area.
    // Once the user drags, we switch to explicit left/top coordinates.
    const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
    const [edgeDock, setEdgeDock] = useState<{ side: 'left' | 'right'; y: number; compact: boolean } | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isDimmed, setIsDimmed] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showTaskPicker, setShowTaskPicker] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });
    const pointerStart = useRef({ x: 0, y: 0 });
    const lastDragPosition = useRef({ x: 0, y: 0 });
    const activePointerId = useRef<number | null>(null);
    const didDrag = useRef(false);
    const suppressNextClick = useRef(false);
    const inactivityTimer = useRef<number | null>(null);
    const timerRef = useRef<HTMLDivElement>(null);

    const formatTime = (sec: number) => {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const wakeTimer = () => {
        setIsDimmed(false);
        if (inactivityTimer.current) window.clearTimeout(inactivityTimer.current);
        inactivityTimer.current = window.setTimeout(() => setIsDimmed(true), IDLE_DIM_DELAY);
    };

    useEffect(() => {
        inactivityTimer.current = window.setTimeout(() => setIsDimmed(true), IDLE_DIM_DELAY);
        return () => {
            if (inactivityTimer.current) window.clearTimeout(inactivityTimer.current);
        };
    }, []);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;

        wakeTimer();
        const rect = timerRef.current?.getBoundingClientRect();
        activePointerId.current = e.pointerId;
        didDrag.current = false;
        pointerStart.current = { x: e.clientX, y: e.clientY };
        dragOffset.current = {
            x: e.clientX - (rect?.left ?? 0),
            y: e.clientY - (rect?.top ?? 0),
        };
        lastDragPosition.current = { x: rect?.left ?? 0, y: rect?.top ?? 0 };
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (activePointerId.current !== e.pointerId) return;

        wakeTimer();
        const distance = Math.hypot(
            e.clientX - pointerStart.current.x,
            e.clientY - pointerStart.current.y,
        );
        if (!didDrag.current && distance < DRAG_START_DISTANCE) return;

        e.preventDefault();
        if (!didDrag.current) {
            e.currentTarget.setPointerCapture?.(e.pointerId);
        }
        didDrag.current = true;
        suppressNextClick.current = true;
        setIsDragging(true);

        const width = timerRef.current?.offsetWidth || 100;
        const height = timerRef.current?.offsetHeight || 50;
        const maxX = Math.max(0, window.innerWidth - width);
        const maxY = Math.max(8, window.innerHeight - height - 8);
        const nextPosition = {
            x: Math.max(0, Math.min(e.clientX - dragOffset.current.x, maxX)),
            y: Math.max(8, Math.min(e.clientY - dragOffset.current.y, maxY)),
        };

        lastDragPosition.current = nextPosition;
        setEdgeDock(null);
        setPosition(nextPosition);
    };

    const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
        if (activePointerId.current !== e.pointerId) return;

        if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
        activePointerId.current = null;
        setIsDragging(false);

        if (!didDrag.current) return;

        const width = timerRef.current?.offsetWidth || 100;
        const { x, y } = lastDragPosition.current;
        if (x <= EDGE_DOCK_DISTANCE) {
            setPosition(null);
            setEdgeDock({ side: 'left', y, compact: true });
        } else if (x + width >= window.innerWidth - EDGE_DOCK_DISTANCE) {
            setPosition(null);
            setEdgeDock({ side: 'right', y, compact: true });
        }

        window.setTimeout(() => {
            suppressNextClick.current = false;
        }, 0);
    };

    const handleClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
        wakeTimer();
        if (!suppressNextClick.current) return;
        e.preventDefault();
        e.stopPropagation();
        suppressNextClick.current = false;
    };

    const handleStopClick = () => { setIsModalOpen(true); timerState.pause(); };
    const handleSaveAndClose = (data: { hours: number, taskId: string, description: string }) => {
        onSaveLog(data);
        timerState.stop();
        setIsModalOpen(false);
    };

    const containerStyle: React.CSSProperties = position
        ? { left: position.x, top: position.y, touchAction: 'none' }
        : edgeDock?.side === 'left'
            ? { left: 0, top: edgeDock.y, touchAction: 'none' }
            : edgeDock?.side === 'right'
                ? { right: 0, top: edgeDock.y, touchAction: 'none' }
                : { touchAction: 'none' };

    const wrapperClass = `fixed z-50 cursor-move ${isDimmed ? 'opacity-60' : 'opacity-100'} ${edgeDock ? '' : 'scale-95'} ${position || edgeDock ? '' : 'right-4 bottom-[calc(96px+env(safe-area-inset-bottom,0px))] md:bottom-4'} ${isDragging ? 'cursor-grabbing' : 'transition-[left,top,opacity] duration-500 ease-out'}`;
    const dragHandlers = {
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerEnd,
        onPointerCancel: handlePointerEnd,
        onClickCapture: handleClickCapture,
        onFocus: wakeTimer,
    };

    if (edgeDock?.compact) {
        const statusClass = timerState.isPaused
            ? 'bg-warning'
            : timerState.isRunning
                ? 'bg-success animate-pulse'
                : 'bg-text-dark-secondary';

        return (
            <div ref={timerRef} style={containerStyle} className={wrapperClass} {...dragHandlers}>
                <button
                    type="button"
                    onClick={() => setEdgeDock(current => current ? { ...current, compact: false } : current)}
                    aria-label="Udvid timer"
                    title="Udvid timer"
                    className={`flex min-h-11 items-center gap-1.5 bg-bg-dark px-2.5 py-2 text-white shadow-2xl border border-white/20 hover:bg-black/80 transition-colors select-none ${edgeDock.side === 'left' ? 'rounded-r-full border-l-0' : 'rounded-l-full border-r-0'}`}
                >
                    <span className={`block h-2 w-2 shrink-0 rounded-full ${statusClass}`} aria-hidden="true" />
                    <span className="font-mono text-xs font-bold leading-none">{formatTime(timerState.seconds)}</span>
                </button>
            </div>
        );
    }

    if (!timerState.isRunning) {
        return (
            <>
                <div ref={timerRef} style={containerStyle} className={wrapperClass} {...dragHandlers}>
                    <button type="button" onClick={() => !isDragging && setShowTaskPicker(true)} aria-label="Start tid" title="Start tid" className="bg-bg-dark backdrop-blur-md text-white p-2 pr-4 rounded-full shadow-2xl flex items-center gap-3 border border-white/20 hover:bg-black/80 transition-all duration-300 ring-1 ring-black/5 group select-none">
                        <div className="w-8 h-8 bg-success/20 text-success rounded-full flex items-center justify-center group-hover:bg-success group-hover:text-white transition-colors pointer-events-none"><PlayIcon className="w-4 h-4 ml-0.5" /></div>
                        <span className="font-semibold text-sm pointer-events-none">Start Tid</span>
                    </button>
                </div>
                {showTaskPicker && <TaskPickerModal projectTasks={projectTasks} onSelect={(taskId) => { timerState.start(taskId); setShowTaskPicker(false); }} onClose={() => setShowTaskPicker(false)} />}
            </>
        );
    }

    return (
        <>
            <div ref={timerRef} style={containerStyle} className={wrapperClass} {...dragHandlers}>
                <div className="bg-white/10 backdrop-blur-md text-white p-1 pr-3 rounded-full shadow-2xl flex items-center gap-2 border border-white/20 hover:bg-black/80 transition-all duration-300 ring-1 ring-black/5 bg-bg-dark select-none">
                     <div className={`w-8 h-8 rounded-full flex items-center justify-center pointer-events-none ${timerState.isPaused ? 'bg-warning/20 text-warning' : 'bg-success/20 text-success'}`}>{timerState.isPaused ? <PauseIcon className="w-4 h-4" /> : <span className="block w-2.5 h-2.5 rounded-full bg-success animate-pulse" />}</div>
                     <button type="button" onClick={() => !isDragging && onOpenTimeTab()} aria-label="Åbn tidsfane" title="Åbn tidsfane" className="flex flex-col"><span className={`font-mono font-bold text-sm leading-none ${timerState.isPaused ? 'text-warning' : 'text-success'}`}>{formatTime(timerState.seconds)}</span><span className="text-caption text-text-dark-secondary leading-none font-medium uppercase tracking-wider">{timerState.isPaused ? 'Pauset' : 'Aktiv'}</span></button>
                     <div className="w-px h-6 bg-border-dark mx-1 pointer-events-none"></div>
                     <button type="button" onClick={(e) => { e.stopPropagation(); timerState.isPaused ? timerState.start(timerState.taskId) : timerState.pause(); }} aria-label={timerState.isPaused ? 'Genoptag timer' : 'Sæt timer på pause'} title={timerState.isPaused ? 'Genoptag timer' : 'Sæt timer på pause'} className="p-1.5 hover:bg-white/10 rounded-full text-text-dark-secondary hover:text-white transition-colors">{timerState.isPaused ? <PlayIcon className="w-3 h-3" /> : <PauseIcon className="w-3 h-3" />}</button>
                     <button type="button" onClick={(e) => { e.stopPropagation(); handleStopClick(); }} aria-label="Stop timer" title="Stop timer" className="p-1.5 hover:bg-danger/20 text-text-dark-secondary hover:text-danger rounded-full transition-colors"><div className="w-2.5 h-2.5 bg-current rounded-[1px]" /></button>
                </div>
            </div>
            {isModalOpen && <StopTimerModal timerState={timerState} projectTasks={projectTasks} onClose={() => setIsModalOpen(false)} onSaveLog={handleSaveAndClose} user={user} />}
        </>
    );
};
