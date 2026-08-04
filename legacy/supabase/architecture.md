
# BYGGE APP - Supabase Database Architecture

This document contains the complete SQL schema required to power the BYGGE APP. It is designed to match the TypeScript interfaces defined in the frontend, ensuring seamless data fetching.

## 1. Setup Instructions

1.  **Create Project:** Go to [database.new](https://database.new) and create a new Supabase project.
2.  **SQL Editor:** Open the SQL Editor in the Supabase Dashboard.
3.  **Execute Scripts:** Copy and paste the SQL blocks below into the editor and run them in order.

---

## 2. Schema Definitions

### 2.1 Extensions & Cleanup
First, we clean up any existing public tables to ensure a fresh start and enable necessary UUID extensions.

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Optional: Clean slate (WARNING: DELETES ALL DATA)
-- DROP SCHEMA public CASCADE;
-- CREATE SCHEMA public;
```

### 2.2 Users & Connections
Matches `interface User` and connection logic.

```sql
CREATE TABLE public.users (
    "id" TEXT PRIMARY KEY,
    "username" TEXT UNIQUE NOT NULL,
    "password" TEXT NOT NULL, -- Note: In production, integrate with Supabase Auth (auth.users)
    "name" TEXT,
    "initials" TEXT,
    "email" TEXT,
    "subscriptionTier" TEXT DEFAULT 'FREE',
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.user_connections (
    "user_id" TEXT REFERENCES public.users("id") ON DELETE CASCADE,
    "connected_user_id" TEXT REFERENCES public.users("id") ON DELETE CASCADE,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY ("user_id", "connected_user_id")
);
```

### 2.3 Regulations
Matches `interface Regulation`.

```sql
CREATE TABLE public.regulations (
    "id" TEXT PRIMARY KEY,
    "title" TEXT,
    "chapter" TEXT,
    "section_ref" TEXT,
    "snippet" TEXT,
    "body_html" TEXT,
    "effective_from" TEXT,
    "tags" JSONB DEFAULT '[]'::jsonb, -- Array of strings
    "version" TEXT,
    "source_url" TEXT,
    "category" TEXT
);
```

### 2.4 Projects
Matches `interface Project`. Note that complex objects like `milestone` and `budget` are stored as JSONB to maintain flexibility.

```sql
CREATE TABLE public.projects (
    "id" TEXT PRIMARY KEY,
    "ownerId" TEXT REFERENCES public.users("id") ON DELETE SET NULL,
    "projectNumber" TEXT,
    "name" TEXT,
    "clientName" TEXT,
    "status" TEXT,
    "progress" INTEGER DEFAULT 0,
    "startDate" TEXT,
    "endDate" TEXT,
    "address" TEXT,
    "description" TEXT,
    "isFavorite" BOOLEAN DEFAULT FALSE, -- 0/1 in SQLite, Boolean in Postgres
    "floorPlanUrl" TEXT,
    "milestone" JSONB DEFAULT '{}'::jsonb, -- { title: string, dueDateRelative: string }
    "team" JSONB DEFAULT '[]'::jsonb, -- Array of ProjectMember objects
    "budget" JSONB, -- { total: number, used: number }
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.5 Tasks
Matches `interface Task`.

```sql
CREATE TABLE public.tasks (
    "id" TEXT PRIMARY KEY,
    "project_id" TEXT REFERENCES public.projects("id") ON DELETE CASCADE,
    "title" TEXT,
    "status" TEXT,
    "dueDate" TEXT,
    "description" TEXT,
    "isMilestone" BOOLEAN DEFAULT FALSE,
    "estimatedHours" NUMERIC DEFAULT 0,
    "step" TEXT, -- Hierarchy step
    
    -- JSONB fields for complex arrays/objects
    "relatedLink" JSONB, 
    "assignees" JSONB DEFAULT '[]'::jsonb,
    "checklist" JSONB DEFAULT '[]'::jsonb,
    "attachments" JSONB DEFAULT '[]'::jsonb,
    "comments" JSONB DEFAULT '[]'::jsonb,
    "suggestedRegulations" JSONB DEFAULT '[]'::jsonb,
    "dependencies" JSONB DEFAULT '[]'::jsonb,
    
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.6 Financials (Purchases)
Matches `interface PurchaseItem`.

```sql
CREATE TABLE public.purchases (
    "id" TEXT PRIMARY KEY,
    "project_id" TEXT REFERENCES public.projects("id") ON DELETE CASCADE,
    "name" TEXT,
    "details" TEXT,
    "quantity" NUMERIC DEFAULT 0,
    "price" NUMERIC DEFAULT 0,
    "status" TEXT,
    "supplier" TEXT,
    "itemNumber" TEXT,
    "attachment" JSONB, -- { url, type, name }
    "expectedDeliveryDate" TEXT,
    "taskId" TEXT, -- Optional link to task
    "assigneeId" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.7 Reminders & Logs
Matches `interface Reminder` and `ActivityLogItem`.

```sql
CREATE TABLE public.reminders (
    "id" TEXT PRIMARY KEY,
    "project_id" TEXT REFERENCES public.projects("id") ON DELETE CASCADE,
    "title" TEXT,
    "dateTime" TEXT,
    "context" TEXT,
    "isCompleted" BOOLEAN DEFAULT FALSE,
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.activity_log (
    "id" TEXT PRIMARY KEY,
    "project_id" TEXT REFERENCES public.projects("id") ON DELETE CASCADE,
    "type" TEXT, -- 'completed' | 'upload' | 'addUser'
    "user" TEXT,
    "description" TEXT,
    "timestamp" TEXT
);

CREATE TABLE public.logs (
    "id" TEXT PRIMARY KEY,
    "timestamp" TEXT,
    "level" TEXT,
    "message" TEXT
);

CREATE TABLE public.notifications (
    "id" TEXT PRIMARY KEY,
    "text" TEXT,
    "timestamp" TEXT,
    "isRead" BOOLEAN DEFAULT FALSE,
    "link" TEXT
);
```

### 2.8 Quality Assurance (Punch Lists)
Matches `PunchListLayout` and `PunchListItem`.

```sql
CREATE TABLE public.punch_list_layouts (
    "id" TEXT PRIMARY KEY,
    "projectId" TEXT REFERENCES public.projects("id") ON DELETE CASCADE,
    "title" TEXT,
    "reference" TEXT,
    "fileUrl" TEXT,
    "createdAt" TEXT
);

CREATE TABLE public.punch_list_items (
    "id" TEXT PRIMARY KEY,
    "project_id" TEXT REFERENCES public.projects("id") ON DELETE CASCADE,
    "layoutId" TEXT REFERENCES public.punch_list_layouts("id") ON DELETE CASCADE,
    "photoUrl" TEXT,
    "pin" JSONB, -- { x: number, y: number }
    "description" TEXT,
    "status" TEXT,
    "timestamp" TEXT,
    "resolutionDueDate" TEXT
);
```

### 2.9 Documents
Matches `interface DocumentItem`.

```sql
CREATE TABLE public.documents (
    "id" TEXT PRIMARY KEY,
    "projectId" TEXT REFERENCES public.projects("id") ON DELETE CASCADE,
    "name" TEXT,
    "storagePath" TEXT, -- In a real app, this points to Storage Bucket path
    "sizeBytes" BIGINT,
    "mimeType" TEXT,
    "category" TEXT,
    "referenceNo" TEXT,
    "shortDescription" TEXT,
    "accessLevel" TEXT,
    "passwordProtected" BOOLEAN DEFAULT FALSE,
    "createdBy" TEXT,
    "createdAt" TEXT,
    "reviewDeadline" TEXT,
    
    -- Drawing specific
    "isDrawing" BOOLEAN DEFAULT FALSE,
    "discipline" TEXT,
    "drawingNo" TEXT,
    "revision" TEXT,
    "scale" TEXT,
    "issueDate" TEXT,
    "sheetNo" TEXT,
    "planType" TEXT,
    "planIndex" INTEGER,
    "isLatestRevision" BOOLEAN DEFAULT TRUE
);
```

### 2.10 Time Tracking
Matches `interface TimeEntry`.

```sql
CREATE TABLE public.time_entries (
    "id" TEXT PRIMARY KEY,
    "projectId" TEXT REFERENCES public.projects("id") ON DELETE CASCADE,
    "taskId" TEXT REFERENCES public.tasks("id") ON DELETE SET NULL,
    "userId" TEXT, -- References public.users(id) conceptually
    "userName" TEXT,
    "hours" NUMERIC,
    "date" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 3. Storage Buckets

To handle images and documents properly, you should create a bucket in the Storage section of Supabase.

1.  Go to **Storage**.
2.  Create a new bucket named **`project-files`**.
3.  Set it to **Public** (for this demo app architecture; in production, use private with signed URLs).

---

## 4. Row Level Security (RLS) - Optional but Recommended

For a multi-tenant app, enable RLS. For this demo architecture, we will keep it open or simple.

```sql
-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows everything for now (Dev Mode)
CREATE POLICY "Enable all access for all users" ON public.projects
FOR ALL USING (true) WITH CHECK (true);

-- Repeat for other tables if RLS is enabled on them.
```
