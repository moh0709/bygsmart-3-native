import type { Database } from '../database.types';

// --- HELPERS ---
export type ProjectRow = Database['public']['Tables']['projects']['Row'];
export type TaskRow = Database['public']['Tables']['tasks']['Row'];
export type RegulationRow = Database['public']['Tables']['regulations']['Row'];
export type PurchaseRow = Database['public']['Tables']['purchases']['Row'];
export type ReminderRow = Database['public']['Tables']['reminders']['Row'];
export type NotificationRow = Database['public']['Tables']['notifications']['Row'];
export type DocumentRow = Database['public']['Tables']['documents']['Row'];
export type TimeEntryRow = Database['public']['Tables']['time_entries']['Row'];
export type PunchListLayoutRow = Database['public']['Tables']['punch_list_layouts']['Row'];
export type PunchListItemRow = Database['public']['Tables']['punch_list_items']['Row'];

export const TASK_COLUMNS =
    'id, project_id, owner_id, scope, title, status, priority, due_date, description, is_milestone, estimated_hours, step, related_link, assignees, checklist, attachments, comments, suggested_regulations, dependencies, handover_status, completed_at, acceptance_report_path, archived_at, created_at, updated_at, disabled_tabs';
export const REGULATION_COLUMNS =
    'id, title, chapter, section_ref, snippet, body_html, effective_from, tags, version, source_url, category';
export const PURCHASE_COLUMNS =
    'id, project_id, name, details, quantity, price, status, supplier, item_number, attachment, expected_delivery_date, task_id, assignee_id, created_at, updated_at';
export const REMINDER_COLUMNS = 'id, project_id, title, date_time, context, is_completed, created_by, created_at';
export const NOTIFICATION_COLUMNS = 'id, user_id, text, timestamp, is_read, link, type, metadata';
export const DOCUMENT_COLUMNS =
    'id, project_id, name, storage_path, size_bytes, mime_type, category, reference_no, short_description, access_level, password_protected, created_by, created_at, review_deadline, is_drawing, discipline, drawing_no, revision, scale, issue_date, sheet_no, plan_type, plan_index, is_latest_revision';
export const TIME_ENTRY_COLUMNS =
    'id, project_id, task_id, user_id, user_name, hours, date, description, created_at';
export const PUNCH_LAYOUT_COLUMNS = 'id, project_id, title, reference, file_url, created_at';
export const PUNCH_ITEM_COLUMNS =
    'id, project_id, layout_id, photo_url, pin, description, status, resolution_due_date, created_at';
