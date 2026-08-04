import React, { useState } from 'react';
import {
    Button,
    Modal,
    Select,
    Textarea,
} from '../../../../components/ui';

// ─── Check-out modal ─────────────────────────────────────────────────────────

export const CheckOutModal: React.FC<{
    elapsedSeconds: number;
    onClose: () => void;
    onConfirm: (data: { hours: number; description: string }) => void;
}> = ({ elapsedSeconds, onClose, onConfirm }) => {
    const [activityType, setActivityType] = useState('Udførelse');
    const [description, setDescription] = useState('');
    const hours = Math.max(0.1, parseFloat((elapsedSeconds / 3600).toFixed(2)));
    const activityTypes = ['Planlægning', 'Indkøb', 'Udførelse', 'Møde', 'Kørsel', 'Dokumentation', 'Andet'];

    return (
        <Modal
            open
            title="Check ud & registrer tid"
            onClose={onClose}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>Annuller</Button>
                    <Button
                        variant="danger"
                        onClick={() => onConfirm({ hours, description: `[${activityType}] ${description}`.trim() })}
                    >
                        Check ud & gem
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <div className="rounded-card bg-brand-subtle p-4 text-center dark:bg-brand-subtle-dark">
                    <p className="text-caption text-text-secondary dark:text-text-dark-secondary">Tid på opgaven</p>
                    <p className="mt-1 text-display text-brand-primary dark:text-brand-light">
                        {hours} <span className="text-body font-medium text-text-secondary dark:text-text-dark-secondary">timer</span>
                    </p>
                </div>
                <Select
                    label="Aktivitet"
                    value={activityType}
                    onChange={e => setActivityType(e.target.value)}
                >
                    {activityTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </Select>
                <Textarea
                    label="Beskrivelse"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Hvad har du lavet?"
                    rows={3}
                />
            </div>
        </Modal>
    );
};
