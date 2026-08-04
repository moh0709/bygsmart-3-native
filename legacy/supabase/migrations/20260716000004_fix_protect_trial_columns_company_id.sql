-- HOTFIX: protect_trial_columns still referenced profiles.company_id after
-- 20260716000002 dropped the column, so EVERY authenticated profiles UPDATE
-- failed with 42703 ("record new has no field company_id") — breaking
-- create_organization, team creation and profile edits. Server-side writes
-- (auth.uid() IS NULL) were unaffected. The company_id block is removed;
-- everything else is unchanged.
CREATE OR REPLACE FUNCTION public.protect_trial_columns()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF auth.uid() IS NOT NULL THEN
        NEW.trial_tier := OLD.trial_tier;
        NEW.trial_ends_at := OLD.trial_ends_at;
        NEW.trial_granted_by := OLD.trial_granted_by;
        NEW.trial_granted_at := OLD.trial_granted_at;
        NEW.app_role := OLD.app_role;
        NEW.is_demo := OLD.is_demo;
        NEW.stripe_customer_id := OLD.stripe_customer_id;
        NEW.stripe_subscription_id := OLD.stripe_subscription_id;

        IF current_setting('app.privileged_profile_write', true) IS DISTINCT FROM 'on' THEN
            NEW.team_id := OLD.team_id;
            NEW.team_role := OLD.team_role;
            -- Active org moves only through set_active_org(), which validates
            -- membership — a forged active_org_id can never widen access.
            NEW.active_org_id := OLD.active_org_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;
