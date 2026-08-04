-- Task priority: adds a 3-tier priority to tasks (Høj/Mellem/Lav), used by
-- the zoomable project timeline's day view to sort a day's tasks so the
-- most important ones surface first. Additive migration — one column with
-- a CHECK constraint and a safe default, no changes to existing columns.

ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'Mellem'
        CHECK (priority IN ('Høj', 'Mellem', 'Lav'));
