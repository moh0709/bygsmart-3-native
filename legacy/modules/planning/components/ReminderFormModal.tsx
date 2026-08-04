import React, { useState } from 'react';
import { Reminder } from '../../../types';
import { Button, Input, Modal, Textarea } from '../../../components/ui';

export const ReminderFormModal: React.FC<{
  reminder?: Reminder;
  onClose: () => void;
  onSave: (payload: { title: string; dateTime: string; context: string }, id?: string) => void | Promise<void>;
}> = ({ reminder, onClose, onSave }) => {
    const [title, setTitle] = useState(reminder?.title || '');

    const formatDateTimeForInput = (isoString: string | undefined) => {
        if (!isoString) return '';
        try {
            const date = new Date(isoString);
            const timezoneOffset = date.getTimezoneOffset() * 60000;
            const localDate = new Date(date.getTime() - timezoneOffset);
            return localDate.toISOString().slice(0, 16);
        } catch {
            return '';
        }
    };

    const [dateTime, setDateTime] = useState(formatDateTimeForInput(reminder?.dateTime));
    const [context, setContext] = useState(reminder?.context || '');
    const [saving, setSaving] = useState(false);

    const handleSaveClick = async () => {
        if (!title.trim() || !dateTime || saving) return;
        setSaving(true);
        try {
            await Promise.resolve(onSave({ title, dateTime, context }, reminder?.id));
            onClose();
        } finally {
            setSaving(false);
        }
    };

  return (
    <Modal
      open
      onClose={onClose}
      title={reminder ? 'Rediger påmindelse' : 'Ny påmindelse'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Annuller
          </Button>
          <Button
            onClick={handleSaveClick}
            loading={saving}
            disabled={!title.trim() || !dateTime}
          >
            {reminder ? 'Gem' : 'Opret'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Titel"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Husk at..."
          autoFocus
        />
        <Input
          label="Dato & tid"
          type="datetime-local"
          value={dateTime}
          onChange={(e) => setDateTime(e.target.value)}
        />
        <Textarea
          label="Kontekst (valgfri)"
          rows={3}
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Yderligere noter..."
        />
      </div>
    </Modal>
  );
};
