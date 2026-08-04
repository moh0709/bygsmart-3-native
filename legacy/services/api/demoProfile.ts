import { authenticatedServerFetch } from './http';

/**
 * Name seeded on a demo profile by POST /api/demo-session. A demo account still
 * carrying it never completed the welcome step — which is what both the welcome
 * gate and the admin bulk purge key off. Mirrors PLACEHOLDER_DEMO_NAME in
 * server/routes/adminUserRoutes.js.
 */
export const PLACEHOLDER_DEMO_NAME = 'Demo Bruger';

/** True once a demo visitor has given both their name and their company. */
export const isDemoProfileComplete = (
  name: string | null | undefined,
  companyName: string | null | undefined
): boolean =>
  Boolean(name?.trim() && name.trim() !== PLACEHOLDER_DEMO_NAME && companyName?.trim());

export interface SaveDemoProfileResult {
  success: boolean;
  message?: string;
}

/**
 * Welcome step for a fresh demo account: stores the visitor's name and company
 * on the profile (profiles.name / profiles.company_name), mirrors them onto the
 * demo lead row and renames their personal organisation. Server-side only —
 * the lead table is service-role.
 */
export const saveDemoProfile = async (
  name: string,
  companyName: string
): Promise<SaveDemoProfileResult> => {
  try {
    const response = await authenticatedServerFetch('/demo-profile', {
      method: 'POST',
      body: JSON.stringify({ name, companyName }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      saved?: boolean;
      error?: string;
    };

    if (!response.ok || !payload.saved) {
      return { success: false, message: payload.error || 'Kunne ikke gemme oplysningerne. Prøv igen.' };
    }

    return { success: true };
  } catch (err) {
    console.error('[demoProfile] save failed:', err);
    return { success: false, message: 'Kunne ikke gemme oplysningerne. Prøv igen.' };
  }
};
