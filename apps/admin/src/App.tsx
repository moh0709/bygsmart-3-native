import { PLACEHOLDER_CORE } from '@bygsmart/core';

// Minimal shell. Real back-office (platform admin, org/billing, SMTP, promo codes,
// tool access, 3D wizard, PWA marketplace) is built in P5-D. DOM-native, no RNW.
export function App() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <h1>BygSmart Back-office</h1>
      <p>admin.bygsmart.com — platform administration, org &amp; billing, and the PWA marketplace.</p>
      <small>workspace resolution ok: {PLACEHOLDER_CORE}</small>
    </main>
  );
}
