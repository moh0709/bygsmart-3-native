-- ============================================================
-- Touch project_resources.updated_at on new negotiation activity
-- ============================================================
-- sendNegotiationMessage() (services/partners.ts) inserts directly into
-- partner_negotiation_messages without touching the parent project_resources
-- row. The manager-side "Åbne" unread badge in PartnerInvitesPanel.tsx is
-- derived from max(project_resources.created_at, project_resources.updated_at),
-- so new messages/offers/counter-offers on an open negotiation were invisible
-- to the badge — it only reacted to invite creation or terminal status
-- changes (accept/decline), which already flow through project_resources
-- UPDATEs and the existing project_resources_updated_at trigger.
--
-- This trigger bumps the related project_resources row whenever a new
-- partner_negotiation_messages row is inserted, so ongoing negotiation
-- activity is reflected in updated_at like any other change.

CREATE OR REPLACE FUNCTION public.touch_resource_on_negotiation_message()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.resource_id IS NOT NULL THEN
    UPDATE public.project_resources
    SET updated_at = now()
    WHERE id = NEW.resource_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS partner_negotiation_messages_touch_resource
  ON public.partner_negotiation_messages;

CREATE TRIGGER partner_negotiation_messages_touch_resource
  AFTER INSERT ON public.partner_negotiation_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_resource_on_negotiation_message();
