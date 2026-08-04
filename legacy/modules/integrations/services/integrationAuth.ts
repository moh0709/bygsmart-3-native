
export type ProviderId = 'google' | 'dropbox' | 'onedrive' | 'box';

interface ProviderConfig {
    clientId: string;
    authUrl: string;
    scope: string;
    redirectUri: string;
}

// Helper to get the current origin with a fallback for some environments
const getOrigin = () => {
    if (typeof window !== 'undefined' && window.location.origin) {
        return window.location.origin;
    }
    return 'http://localhost:5173';
};

export const PROVIDER_CONFIG: Record<ProviderId, ProviderConfig> = {
    google: {
        clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        scope: 'https://www.googleapis.com/auth/drive.readonly',
        redirectUri: `${getOrigin()}/auth/callback`
    },
    dropbox: {
        clientId: import.meta.env.VITE_DROPBOX_CLIENT_ID || '',
        authUrl: 'https://www.dropbox.com/oauth2/authorize',
        scope: '',
        redirectUri: `${getOrigin()}/auth/callback`
    },
    onedrive: {
        clientId: import.meta.env.VITE_ONEDRIVE_CLIENT_ID || '',
        authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        scope: 'Files.Read',
        redirectUri: `${getOrigin()}/auth/callback`
    },
    box: {
        clientId: import.meta.env.VITE_BOX_CLIENT_ID || '',
        authUrl: 'https://account.box.com/api/oauth2/authorize',
        scope: '',
        redirectUri: `${getOrigin()}/auth/callback`
    }
};

export const initiateAuthFlow = (provider: ProviderId) => {
    const config = PROVIDER_CONFIG[provider];
    
    // Check if Client ID is configured
    if (!config.clientId) {
        const envName = `VITE_${provider.toUpperCase()}_CLIENT_ID`;
        console.error(`[integrationAuth] Missing ${envName} environment variable.`);
        return;
    }

    // Create a cryptographically random nonce for CSRF protection. It MUST be
    // persisted before redirect and compared on return (see handleAuthCallback),
    // otherwise the state parameter is decorative and an attacker can fixate a
    // token by crafting their own callback URL.
    const nonceArr = new Uint32Array(4);
    crypto.getRandomValues(nonceArr);
    const nonce = Array.from(nonceArr, (n) => n.toString(16)).join('');
    try {
        sessionStorage.setItem(`bygSmart-oauth-nonce-${provider}`, nonce);
    } catch {
        // sessionStorage unavailable — proceed; callback verification will fail
        // closed rather than accept an unverifiable token.
    }
    const state = JSON.stringify({ provider, nonce });

    const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: 'token', // Implicit flow, returns access_token in hash
        scope: config.scope,
        state: state
    });

    if (provider === 'google') {
        params.append('include_granted_scopes', 'true');
        params.append('prompt', 'select_account'); // Forces account selection to avoid auto-login loops
    }

    // Redirect
    window.location.href = `${config.authUrl}?${params.toString()}`;
};

export const handleAuthCallback = (): { provider: ProviderId, token: string } | null => {
    const hash = window.location.hash.substring(1); // Remove #
    const params = new URLSearchParams(hash);
    const token = params.get('access_token');
    const stateRaw = params.get('state');

    if (token && stateRaw) {
        try {
            // Some providers URL-encode the state, usually browser handles it but safe decode helps
            const decodedState = decodeURIComponent(stateRaw);
            const state = JSON.parse(decodedState);
            const provider = state?.provider as ProviderId;

            // Reject unknown providers so state cannot select an arbitrary key.
            if (!provider || !(provider in PROVIDER_CONFIG)) {
                console.error('[integrationAuth] Unknown provider in callback state.');
                return null;
            }

            // Verify the nonce against the one stored before redirect and consume
            // it (single-use). A missing or mismatched nonce means this callback
            // was not initiated by us — reject the token (CSRF / token fixation).
            const storageKey = `bygSmart-oauth-nonce-${provider}`;
            const expectedNonce = sessionStorage.getItem(storageKey);
            sessionStorage.removeItem(storageKey);
            if (!expectedNonce || expectedNonce !== state?.nonce) {
                console.error('[integrationAuth] OAuth state nonce mismatch — rejecting callback.');
                return null;
            }

            return { provider, token };
        } catch (e) {
            console.error("Failed to parse auth state from callback", e);
        }
    }
    return null;
};
