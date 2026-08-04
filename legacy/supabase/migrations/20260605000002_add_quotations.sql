-- Phase 2: Quotations & Reports
-- Apply this migration in the Supabase dashboard or via: supabase db push

-- quotations table
CREATE TABLE IF NOT EXISTS quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  number text NOT NULL,
  title text NOT NULL,
  client_name text,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED')),
  currency text NOT NULL DEFAULT 'DKK',
  vat_rate numeric(5,2) NOT NULL DEFAULT 25,
  valid_until date,
  notes text,
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  vat_total numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  created_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- quotation_line_items table
CREATE TABLE IF NOT EXISTS quotation_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'MATERIAL' CHECK (kind IN ('MATERIAL', 'LABOR', 'OTHER')),
  description text NOT NULL,
  quantity numeric(14,4) NOT NULL DEFAULT 1,
  unit text,
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  line_total numeric(14,2) NOT NULL DEFAULT 0,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_line_items ENABLE ROW LEVEL SECURITY;

-- quotations: project members can read
CREATE POLICY "quotations_select"
  ON quotations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = quotations.project_id
        AND (
          p.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(p.team) AS m
            WHERE (m->>'id')::text = auth.uid()::text
          )
        )
    )
  );

-- quotations: owner/manager can insert
CREATE POLICY "quotations_insert"
  ON quotations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_id
        AND (
          p.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(p.team) AS m
            WHERE (m->>'id')::text = auth.uid()::text
              AND (m->>'role')::text IN ('OWNER', 'MANAGER')
          )
        )
    )
  );

-- quotations: owner/manager can update
CREATE POLICY "quotations_update"
  ON quotations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = quotations.project_id
        AND (
          p.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(p.team) AS m
            WHERE (m->>'id')::text = auth.uid()::text
              AND (m->>'role')::text IN ('OWNER', 'MANAGER')
          )
        )
    )
  );

-- quotations: owner/manager can delete
CREATE POLICY "quotations_delete"
  ON quotations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = quotations.project_id
        AND (
          p.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(p.team) AS m
            WHERE (m->>'id')::text = auth.uid()::text
              AND (m->>'role')::text IN ('OWNER', 'MANAGER')
          )
        )
    )
  );

-- line_items: project members can read
CREATE POLICY "quotation_line_items_select"
  ON quotation_line_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quotations q
      JOIN projects p ON p.id = q.project_id
      WHERE q.id = quotation_line_items.quotation_id
        AND (
          p.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(p.team) AS m
            WHERE (m->>'id')::text = auth.uid()::text
          )
        )
    )
  );

-- line_items: owner/manager can insert
CREATE POLICY "quotation_line_items_insert"
  ON quotation_line_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotations q
      JOIN projects p ON p.id = q.project_id
      WHERE q.id = quotation_id
        AND (
          p.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(p.team) AS m
            WHERE (m->>'id')::text = auth.uid()::text
              AND (m->>'role')::text IN ('OWNER', 'MANAGER')
          )
        )
    )
  );

-- line_items: owner/manager can update
CREATE POLICY "quotation_line_items_update"
  ON quotation_line_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM quotations q
      JOIN projects p ON p.id = q.project_id
      WHERE q.id = quotation_line_items.quotation_id
        AND (
          p.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(p.team) AS m
            WHERE (m->>'id')::text = auth.uid()::text
              AND (m->>'role')::text IN ('OWNER', 'MANAGER')
          )
        )
    )
  );

-- line_items: owner/manager can delete
CREATE POLICY "quotation_line_items_delete"
  ON quotation_line_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM quotations q
      JOIN projects p ON p.id = q.project_id
      WHERE q.id = quotation_line_items.quotation_id
        AND (
          p.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(p.team) AS m
            WHERE (m->>'id')::text = auth.uid()::text
              AND (m->>'role')::text IN ('OWNER', 'MANAGER')
          )
        )
    )
  );

-- Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE quotations;
ALTER PUBLICATION supabase_realtime ADD TABLE quotation_line_items;
