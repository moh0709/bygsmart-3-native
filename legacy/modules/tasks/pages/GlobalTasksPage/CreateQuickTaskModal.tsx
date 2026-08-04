import React, { useState, useRef } from 'react';
import { createQuickTask, patchTaskAttachments } from '../../services/quickTasks';
import { useToast } from '../../../../contexts/ToastContext';
import type { Task, TaskStatus } from '../../../../types';
import {
    XIcon, ZapIcon,
    PaperclipIcon, ImageIcon,
} from '../../../../components/icons';
import {
    Button,
    Input,
    Modal,
    Select,
    Textarea,
} from '../../../../components/ui';
import { ACCEPTED_FILE_TYPES } from './constants';

export const CreateQuickTaskModal: React.FC<{
    onClose: () => void;
    onCreated: (task: Task) => void;
}> = ({ onClose, onCreated }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [status, setStatus] = useState<TaskStatus>('To Do');
    const [estimatedHours, setEstimatedHours] = useState('');
    const [estimatedPrice, setEstimatedPrice] = useState('');
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const [saving, setSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { showToast } = useToast();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = Array.from(e.target.files ?? []);
        setPendingFiles(prev => {
            const existingNames = new Set(prev.map(f => f.name));
            return [...prev, ...selected.filter(f => !existingNames.has(f.name))];
        });
        e.target.value = '';
    };

    const removeFile = (index: number) => {
        setPendingFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleCreate = async () => {
        if (!title.trim()) { showToast('Opgavetitel kræves', 'warning'); return; }
        setSaving(true);
        try {
            const hours = estimatedHours ? parseFloat(estimatedHours) : undefined;
            const price = estimatedPrice ? parseFloat(estimatedPrice) : undefined;

            const task = await createQuickTask({
                title: title.trim(),
                description: description.trim(),
                dueDate: dueDate || undefined,
                status,
                estimatedHours: hours,
                estimatedPrice: price,
            });

            let finalTask = task;

            if (pendingFiles.length > 0) {
                try {
                    const uploaded: NonNullable<Task['attachments']> = await Promise.all(
                        pendingFiles.map(async file => {
                            // field depends on tasks (requires:['tasks']) -- import its upload
                            // helper at the call site so tasks never statically imports field.
                            const { uploadTaskFile } = await import('../../../field');
                            const url = await uploadTaskFile(null, task.id, file);
                            const type = file.type.startsWith('image/') ? 'image' as const : 'pdf' as const;
                            return { url, type, name: file.name };
                        })
                    );
                    await patchTaskAttachments(task.id, uploaded);
                    finalTask = { ...task, attachments: uploaded };
                } catch {
                    showToast('Opgave oprettet, men filer kunne ikke uploades', 'warning');
                }
            }

            onCreated(finalTask);
            showToast('Hurtigopgave oprettet', 'success');
            onClose();
        } catch {
            showToast('Kunne ikke oprette opgave', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open
            onClose={onClose}
            title={
                <span className="inline-flex items-center gap-2">
                    <ZapIcon className="w-5 h-5 text-warning" />
                    Ny hurtigopgave
                </span>
            }
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>Luk</Button>
                    <Button onClick={handleCreate} loading={saving} disabled={!title.trim()}>
                        {saving ? (pendingFiles.length > 0 ? 'Uploader…' : 'Opretter…') : 'Opret opgave'}
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <Input
                    label="Titel"
                    required
                    autoFocus
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !saving) handleCreate(); }}
                    placeholder="Hvad skal gøres?"
                />

                <Textarea
                    label="Beskrivelse"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={2}
                    placeholder="Valgfri beskrivelse…"
                />

                <div className="grid grid-cols-2 gap-3">
                    <Input
                        label="Forfaldsdato"
                        type="date"
                        value={dueDate}
                        onChange={e => setDueDate(e.target.value)}
                    />
                    <Select
                        label="Status"
                        value={status}
                        onChange={e => setStatus(e.target.value as TaskStatus)}
                    >
                        <option value="To Do">Ikke startet</option>
                        <option value="Igangværende">Igangværende</option>
                        <option value="Udført">Udført</option>
                    </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <Input
                        label="Estimeret pris (kr.)"
                        type="number"
                        min="0"
                        step="0.01"
                        value={estimatedPrice}
                        onChange={e => setEstimatedPrice(e.target.value)}
                        placeholder="0,00"
                    />
                    <Input
                        label="Estimeret tid (t)"
                        type="number"
                        min="0"
                        step="0.5"
                        value={estimatedHours}
                        onChange={e => setEstimatedHours(e.target.value)}
                        placeholder="0"
                    />
                </div>

                {/* Attachments */}
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-text-primary dark:text-text-dark-primary">
                            Vedhæftninger &amp; billeder
                        </span>
                        <Button
                            size="sm"
                            variant="ghost"
                            iconLeft={<PaperclipIcon className="w-3.5 h-3.5" />}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            Tilføj fil
                        </Button>
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept={ACCEPTED_FILE_TYPES}
                        onChange={handleFileChange}
                        className="hidden"
                        aria-label="Vælg filer"
                    />
                    {pendingFiles.length > 0 ? (
                        <div className="space-y-1.5">
                            {pendingFiles.map((file, i) => (
                                <div
                                    key={`${file.name}-${i}`}
                                    className="flex items-center gap-2 px-3 py-2 rounded-control bg-bg-muted dark:bg-bg-dark-muted border border-border dark:border-border-dark"
                                >
                                    {file.type.startsWith('image/') ? (
                                        <ImageIcon className="w-4 h-4 text-warning flex-shrink-0" />
                                    ) : (
                                        <PaperclipIcon className="w-4 h-4 text-text-tertiary dark:text-text-dark-tertiary flex-shrink-0" />
                                    )}
                                    <span className="flex-1 text-label text-text-primary dark:text-text-dark-primary truncate min-w-0">
                                        {file.name}
                                    </span>
                                    <span className="text-caption text-text-secondary dark:text-text-dark-secondary flex-shrink-0">
                                        {(file.size / 1024).toFixed(0)} KB
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => removeFile(i)}
                                        aria-label={`Fjern ${file.name}`}
                                        className="flex-shrink-0 inline-flex w-8 h-8 items-center justify-center rounded-full text-text-secondary dark:text-text-dark-secondary hover:text-danger-strong hover:bg-danger-subtle dark:hover:text-danger dark:hover:bg-danger-subtle-dark transition-colors duration-150"
                                    >
                                        <XIcon className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full min-h-11 flex items-center justify-center gap-2 px-3 py-3 rounded-control border border-dashed border-border-strong dark:border-border-dark-strong bg-bg-subtle dark:bg-bg-dark-muted text-label text-text-secondary dark:text-text-dark-secondary hover:border-brand-primary hover:text-brand-primary dark:hover:text-brand-light transition-colors duration-150"
                        >
                            <PaperclipIcon className="w-4 h-4" />
                            Klik for at vedhæfte billeder eller filer
                        </button>
                    )}
                </div>
            </div>
        </Modal>
    );
};
