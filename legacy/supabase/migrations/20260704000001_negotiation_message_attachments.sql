-- Attachments for partner negotiation messages: share pictures / PDF / Word /
-- Excel inside a "Forhandling" thread. Files live in the private task-docs bucket
-- under negotiations/{resource_id}/... and are readable only by parties to that
-- negotiation (is_partner_invite_party). Message rows carry the attachment
-- metadata; the actual bytes are served via short-lived signed URLs.

ALTER TABLE public.partner_negotiation_messages
    ADD COLUMN IF NOT EXISTS attachment_path text,
    ADD COLUMN IF NOT EXISTS attachment_name text,
    ADD COLUMN IF NOT EXISTS attachment_type text;

-- Prefix/UUID-safe party check for negotiation storage objects, mirroring the
-- existing storage_taskdocs_* helpers.
CREATE OR REPLACE FUNCTION public.storage_taskdocs_negotiation(object_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    seg text;
    rid uuid;
BEGIN
    IF split_part(object_name, '/', 1) <> 'negotiations' THEN
        RETURN false;
    END IF;
    seg := split_part(object_name, '/', 2);
    BEGIN
        rid := seg::uuid;
    EXCEPTION WHEN others THEN
        RETURN false;
    END;
    RETURN public.is_partner_invite_party(rid);
END;
$$;

-- Additive PERMISSIVE policies (OR'd with the existing task-docs policies).
DROP POLICY IF EXISTS "task_docs_negotiation_select" ON storage.objects;
CREATE POLICY "task_docs_negotiation_select" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'task-docs' AND public.storage_taskdocs_negotiation(name));

DROP POLICY IF EXISTS "task_docs_negotiation_insert" ON storage.objects;
CREATE POLICY "task_docs_negotiation_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'task-docs' AND public.storage_taskdocs_negotiation(name));
