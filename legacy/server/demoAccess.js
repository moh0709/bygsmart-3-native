import crypto from 'crypto';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateContactEmail = (email) => {
  const normalized = String(email || '').trim().toLowerCase();
  if (!EMAIL_PATTERN.test(normalized) || normalized.length > 254) {
    throw new Error('A valid e-mail is required for demo access.');
  }
  return normalized;
};

export const createDemoSuffix = () => {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(5).toString('hex');
  return `${timestamp}${random}`;
};

export const buildDemoUsername = (suffix) => `demo_${suffix}`.slice(0, 63);

export const createDemoLoginEmail = (domain, suffix) => {
  const cleanDomain = String(domain || '').trim().toLowerCase();
  if (!cleanDomain || cleanDomain.includes('@')) {
    throw new Error('Demo login e-mail domain is not configured correctly.');
  }
  return `demo+${suffix}@${cleanDomain}`;
};

export const createTemporaryPassword = () =>
  `${crypto.randomBytes(18).toString('base64url')}aA1!`;

// The demo welcome step asks for a contact name and a company name. Both are
// free text typed by an anonymous visitor, so they are trimmed, length-capped
// and required to hold at least two characters before they touch the profile.
const validateFreeText = (value, { field, min = 2, max = 120 }) => {
  const normalized = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (normalized.length < min || normalized.length > max) {
    throw new Error(`${field} skal være mellem ${min} og ${max} tegn.`);
  }
  return normalized;
};

export const validateDemoName = (value) =>
  validateFreeText(value, { field: 'Navn', max: 80 });

export const validateDemoCompanyName = (value) =>
  validateFreeText(value, { field: 'Firmanavn', max: 120 });

// "Mette Bak Jensen" → "MJ", "Byggefirma" → "BY". Mirrors the initials rule the
// registration form uses so demo profiles render the same avatar as real ones.
export const deriveInitials = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'DB';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export const isDemoUser = (user) => {
  const metadata = user?.app_metadata || {};
  return metadata.is_demo === true || metadata.is_demo === 'true';
};

export const isSupabaseCredentialError = (error) => {
  const message = String(error?.message || error || '').toLowerCase();
  return (
    message.includes('invalid api key') ||
    message.includes('jwt expired') ||
    message.includes('invalid jwt')
  );
};
