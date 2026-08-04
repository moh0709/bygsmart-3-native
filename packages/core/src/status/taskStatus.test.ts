import { describe, it, expect } from 'vitest';
import type { TaskStatus } from '../types';
import { TASK_STATUS_TONE, statusLabel } from './taskStatus';

const ALL: TaskStatus[] = ['To Do', 'Igangværende', 'Udført', 'Forfalden', 'Annulleret'];

describe('TASK_STATUS_TONE', () => {
  it('has a tone for every status', () => {
    for (const s of ALL) expect(TASK_STATUS_TONE[s]).toBeTruthy();
  });

  it('maps completion to success and overdue to danger', () => {
    expect(TASK_STATUS_TONE['Udført']).toBe('success');
    expect(TASK_STATUS_TONE['Forfalden']).toBe('danger');
  });
});

describe('statusLabel', () => {
  it('rewrites the raw To Do value', () => {
    expect(statusLabel('To Do')).toBe('Ikke startet');
  });

  it('passes other statuses through unchanged', () => {
    expect(statusLabel('Igangværende')).toBe('Igangværende');
    expect(statusLabel('Udført')).toBe('Udført');
  });
});
