import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Project, TaskChatMessage } from '../../../types';
import {
  listTaskChatMessages,
  notifyMentions,
  sendTaskChatMessage,
  subscribeToTaskChat,
} from '../services/taskChat';
import { processFileForStorage, resolveFileUrl } from '../../../utils/fileUtils';
import FilePicker from '../../../components/FilePicker';
import { Button, cn } from '../../../components/ui';
import { SendIcon, XIcon } from '../../../components/icons';

export interface TaskChatTabProps {
  taskId: string;
  projectId: string | null;
  projectTeam: Project['team'];
  currentUserId: string;
  currentUserName: string;
  /**
   * When set, the composer (input row, mention picker, error/photo preview)
   * renders inside this element instead of inline after the message list —
   * lets a page-level fixed bottom bar host it directly above another
   * persistent bar (e.g. a check-in action bar) instead of it sitting
   * wherever the message list happens to end.
   */
  composerPortalTarget?: HTMLElement | null;
}

const formatTime = (iso: string) => new Intl.DateTimeFormat('da-DK', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
}).format(new Date(iso));

const MessageImage: React.FC<{ path: string }> = ({ path }) => {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let active = true;
    resolveFileUrl(path).then((resolved) => { if (active) setUrl(resolved); }).catch(() => undefined);
    return () => { active = false; };
  }, [path]);
  return url ? <img src={url} alt="Delt billede" className="mt-2 max-h-64 rounded-control object-contain" /> : null;
};

const highlightedBody = (message: TaskChatMessage, team: Project['team']) => {
  const names = message.mentions
    .map((id) => team.find((member) => member.id === id)?.name)
    .filter((name): name is string => Boolean(name))
    .sort((a, b) => b.length - a.length);
  if (!message.body || !names.length) return message.body;
  const escaped = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const matcher = new RegExp(`(@(?:${escaped.join('|')}))`, 'g');
  return message.body.split(matcher).map((part, index) => (
    names.includes(part.slice(1))
      ? <mark key={`${part}-${index}`} className="rounded bg-warning-subtle px-0.5 text-inherit">{part}</mark>
      : <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
  ));
};

const TaskChatTab: React.FC<TaskChatTabProps> = ({
  taskId,
  projectId,
  projectTeam,
  currentUserId,
  currentUserName,
  composerPortalTarget = null,
}) => {
  const [messages, setMessages] = useState<TaskChatMessage[]>([]);
  const [body, setBody] = useState('');
  const [selectedMentionIds, setSelectedMentionIds] = useState<string[]>([]);
  const [photo, setPhoto] = useState<{ blob: Blob; preview: string; mimeType: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listTaskChatMessages(taskId)
      .then((loaded) => { if (active) setMessages(loaded); })
      .catch(() => { if (active) setError('Chatten kunne ikke indlæses.'); })
      .finally(() => { if (active) setLoading(false); });
    const unsubscribe = subscribeToTaskChat(taskId, (incoming) => {
      setMessages((previous) => previous.some((item) => item.id === incoming.id)
        ? previous
        : [...previous, incoming]);
    });
    return () => { active = false; unsubscribe(); };
  }, [taskId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const mentionMatch = body.match(/(?:^|\s)@([^@\s]*)$/);
  const mentionQuery = mentionMatch?.[1]?.toLocaleLowerCase('da-DK') ?? null;
  const mentionOptions = useMemo(() => mentionQuery === null ? [] : projectTeam
    .filter((member) => member.id !== currentUserId && member.name.toLocaleLowerCase('da-DK').includes(mentionQuery))
    .slice(0, 6), [currentUserId, mentionQuery, projectTeam]);

  const selectMention = (member: Project['team'][number]) => {
    setBody((value) => value.replace(/@[^@\s]*$/, `@${member.name} `));
    setSelectedMentionIds((ids) => ids.includes(member.id) ? ids : [...ids, member.id]);
  };

  const selectPhoto = async (file: File) => {
    try {
      const processed = await processFileForStorage(file);
      const blob = await (await fetch(processed.dataUrl)).blob();
      setPhoto({ blob, preview: processed.dataUrl, mimeType: processed.type });
    } catch {
      setError('Billedet kunne ikke klargøres.');
    }
  };

  const send = async () => {
    const text = body.trim();
    if ((!text && !photo) || sending) return;
    const mentions = selectedMentionIds.filter((id) => {
      const name = projectTeam.find((member) => member.id === id)?.name;
      return name ? text.includes(`@${name}`) : false;
    });
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimistic: TaskChatMessage = {
      id: tempId,
      taskId,
      projectId,
      senderId: currentUserId,
      senderName: currentUserName,
      body: text || undefined,
      attachmentPath: photo?.preview,
      attachmentMime: photo?.mimeType,
      mentions,
      createdAt: new Date().toISOString(),
    };
    setMessages((previous) => [...previous, optimistic]);
    setBody('');
    setPhoto(null);
    setSelectedMentionIds([]);
    setSending(true);
    setError('');
    try {
      const saved = await sendTaskChatMessage({
        taskId,
        projectId,
        body: text || undefined,
        mentions,
        file: photo?.blob,
        mimeType: photo?.mimeType,
      });
      setMessages((previous) => previous.map((message) => message.id === tempId ? saved : message));
      void notifyMentions({
        taskId,
        mentionedUserIds: mentions,
        preview: text.slice(0, 180) || 'Har delt et billede i opgavechatten.',
        link: `/task/${taskId}`,
      });
    } catch {
      setMessages((previous) => previous.filter((message) => message.id !== tempId));
      setBody(text);
      setPhoto(photo);
      setSelectedMentionIds(mentions);
      setError('Beskeden kunne ikke sendes. Prøv igen.');
    } finally {
      setSending(false);
    }
  };

  const composer = (
    <div className={composerPortalTarget
      ? 'border-t border-border bg-bg px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 dark:border-border-dark dark:bg-bg-dark-surface md:px-6'
      : 'sticky bottom-0 z-10 border-t border-border bg-bg pb-3 pt-3 dark:border-border-dark dark:bg-bg-dark-surface'}
    >
      <div className="relative mx-auto w-full max-w-3xl">
        {error && <p role="alert" className="mb-2 text-caption text-danger">{error}</p>}
        {photo && (
          <div className="mb-2 flex items-start gap-2">
            <img src={photo.preview} alt="Valgt billede" className="h-20 w-20 rounded-control object-cover" />
            <button type="button" onClick={() => setPhoto(null)} aria-label="Fjern billede"><XIcon className="h-5 w-5" /></button>
          </div>
        )}
        {mentionOptions.length > 0 && (
          <div className="absolute bottom-full left-0 z-20 mb-2 w-64 rounded-control border border-border bg-bg p-1 shadow-lg dark:border-border-dark dark:bg-bg-dark-surface">
            {mentionOptions.map((member) => (
              <button key={member.id} type="button" onClick={() => selectMention(member)} className="flex w-full items-center gap-2 rounded-control px-3 py-2 text-left hover:bg-bg-subtle dark:hover:bg-bg-dark-muted">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-subtle text-caption font-bold text-brand-primary">{member.initials}</span>
                <span className="text-label font-medium">{member.name}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <FilePicker onFileSelect={selectPhoto} accept="image/*" label="Foto" buttonStyle="icon" />
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(); } }}
            placeholder="Skriv en besked… Brug @ for at nævne"
            aria-label="Besked"
            rows={2}
            className="min-h-11 grow resize-none rounded-control border border-border bg-bg px-3 py-2 text-body dark:border-border-dark dark:bg-bg-dark-surface"
          />
          <Button onClick={send} disabled={(!body.trim() && !photo) || sending} loading={sending} aria-label="Send besked" className="h-11 w-11 shrink-0 px-0" iconLeft={<SendIcon className="h-5 w-5" />} />
        </div>
      </div>
    </div>
  );

  return (
    <section className="flex min-h-[360px] flex-col" aria-label="Opgavechat">
      <div className="min-h-[240px] max-h-[50vh] grow space-y-2 overflow-y-auto pb-4" aria-live="polite">
        {loading && <p className="py-8 text-center text-label text-text-secondary">Indlæser chat…</p>}
        {!loading && messages.length === 0 && <p className="py-8 text-center text-label text-text-secondary">Ingen beskeder endnu.</p>}
        {messages.map((message) => {
          const mine = message.senderId === currentUserId;
          return (
            <div key={message.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[85%] rounded-2xl px-3.5 py-2.5', mine
                ? 'rounded-br-md bg-brand-primary text-white'
                : 'rounded-bl-md border border-border bg-bg-subtle text-text-primary dark:border-border-dark dark:bg-bg-dark-muted dark:text-text-dark-primary')}>
                {!mine && <p className="mb-1 text-caption font-semibold">{message.senderName}</p>}
                {message.body && <p className="whitespace-pre-wrap break-words text-body">{highlightedBody(message, projectTeam)}</p>}
                {message.attachmentPath && (message.attachmentPath.startsWith('data:')
                  ? <img src={message.attachmentPath} alt="Delt billede" className="mt-2 max-h-64 rounded-control object-contain" />
                  : <MessageImage path={message.attachmentPath} />)}
                <p className={cn('mt-1 text-caption', mine ? 'text-white/70' : 'text-text-tertiary')}>{formatTime(message.createdAt)}</p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {composerPortalTarget ? createPortal(composer, composerPortalTarget) : composer}
    </section>
  );
};

export default TaskChatTab;
