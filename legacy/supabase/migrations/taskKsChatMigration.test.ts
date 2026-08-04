// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const sql = readFileSync(new URL('./20260703000001_task_ks_and_chat.sql', import.meta.url), 'utf8');

describe('task chat migration security invariants', () => {
  test('enforces the task/project pair independently of RLS', () => {
    expect(sql).toContain('CREATE TRIGGER task_chat_project_guard');
    expect(sql).toContain('t.project_id IS NOT DISTINCT FROM NEW.project_id');
  });

  test('authorizes message reads and inserts through the referenced task', () => {
    expect(sql).toMatch(/CREATE POLICY "task_chat_select"[\s\S]*can_access_task_chat\(task_id, project_id\)/);
    expect(sql).toMatch(/CREATE POLICY "task_chat_insert"[\s\S]*can_access_task_chat\(task_id, project_id\)/);
  });

  test('stores private per-user read cursors', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.task_chat_reads');
    expect(sql).toContain('PRIMARY KEY (task_id, user_id)');
    expect(sql).toContain('user_id = auth.uid()');
  });
});
