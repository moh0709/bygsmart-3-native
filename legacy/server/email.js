// ─────────────────────────────────────────────────────────────────────────────
// Email / SMTP helpers — transport resolution, verification, and sending.
//
// Passwords are stored AES-256-GCM-encrypted in smtp_configs.password_encrypted
// (same format and key as ai_provider_configs, via aiProviders.js helpers).
// Decrypted passwords only ever exist in server memory and are never serialised
// to HTTP responses.
// ─────────────────────────────────────────────────────────────────────────────

import nodemailer from 'nodemailer';
import dns from 'node:dns/promises';
import net from 'node:net';
import { decryptApiKey, encryptApiKey, hasEncryptionSecret } from './aiProviders.js';

export { encryptApiKey, hasEncryptionSecret };

// ─────────────────────────────────────────────────────────────────────────────
// SSRF protection for user-supplied SMTP hosts.
//
// Premium/Enterprise owners configure their own SMTP host:port. Without this
// guard a paying customer could point `host` at an internal address
// (169.254.169.254 cloud metadata, 127.0.0.1, RFC-1918 ranges) and use the
// connection result/timing of test-connection/send-test as an internal port
// scanner / SSRF oracle. assertPublicSmtpHost resolves the host and rejects it
// unless every resolved address is a public, routable unicast IP.
// ─────────────────────────────────────────────────────────────────────────────
const isDisallowedIpv4 = (ip) => {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  if (a === 0) return true;                          // "this host"
  if (a === 10) return true;                         // 10.0.0.0/8 private
  if (a === 127) return true;                        // loopback
  if (a === 169 && b === 254) return true;           // link-local incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;  // 172.16.0.0/12 private
  if (a === 192 && b === 168) return true;           // 192.168.0.0/16 private
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a >= 224) return true;                         // multicast / reserved / broadcast
  return false;
};

const isDisallowedIpv6 = (ip) => {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;                 // loopback / unspecified
  if (lower.startsWith('fe80')) return true;                          // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;  // unique local
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);        // IPv4-mapped
  if (mapped) return isDisallowedIpv4(mapped[1]);
  return false;
};

const isDisallowedAddress = (ip) => {
  if (net.isIPv4(ip)) return isDisallowedIpv4(ip);
  if (net.isIPv6(ip)) return isDisallowedIpv6(ip);
  return true; // unknown format → unsafe
};

export async function assertPublicSmtpHost(host) {
  if (!host || typeof host !== 'string' || host.trim().length === 0 || host.length > 255) {
    throw Object.assign(new Error('Ugyldig SMTP-vært.'), { status: 400 });
  }
  const trimmed = host.trim();
  const lower = trimmed.toLowerCase();
  if (
    lower === 'localhost' ||
    lower.endsWith('.localhost') ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal')
  ) {
    throw Object.assign(new Error('Interne SMTP-værter er ikke tilladt.'), { status: 400 });
  }

  if (net.isIP(trimmed)) {
    if (isDisallowedAddress(trimmed)) {
      throw Object.assign(new Error('Interne SMTP-værter er ikke tilladt.'), { status: 400 });
    }
    return trimmed;
  }

  let addresses;
  try {
    addresses = await dns.lookup(trimmed, { all: true });
  } catch {
    throw Object.assign(new Error('SMTP-værten kunne ikke slås op.'), { status: 400 });
  }
  if (!addresses || addresses.length === 0) {
    throw Object.assign(new Error('SMTP-værten kunne ikke slås op.'), { status: 400 });
  }
  for (const { address } of addresses) {
    if (isDisallowedAddress(address)) {
      throw Object.assign(new Error('Interne SMTP-værter er ikke tilladt.'), { status: 400 });
    }
  }
  return trimmed;
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveSmtpConfig
//
// Looks up the best available SMTP config for a given caller:
//   1. custom row for ownerId (if provided and enabled)
//   2. global row (if enabled)
//   3. null if neither is configured/enabled
//
// Returns an internal transport-options object — never serialised to HTTP.
// ─────────────────────────────────────────────────────────────────────────────
export async function resolveSmtpConfig({ supabaseAdmin, ownerId = null }) {
  const rowToOptions = (row) => {
    let pass = null;
    if (row.password_encrypted) {
      try {
        pass = decryptApiKey(row.password_encrypted);
      } catch {
        return null;
      }
    }
    return {
      host: row.host,
      port: row.port,
      secure: row.secure,
      auth: row.username ? { user: row.username, pass } : undefined,
      fromName: row.from_name,
      fromEmail: row.from_email,
    };
  };

  if (ownerId) {
    const { data: custom } = await supabaseAdmin
      .from('smtp_configs')
      .select('host, port, secure, username, password_encrypted, from_name, from_email')
      .eq('scope', 'custom')
      .eq('owner_id', ownerId)
      .eq('enabled', true)
      .maybeSingle();
    if (custom) {
      const opts = rowToOptions(custom);
      if (opts) return opts;
    }
  }

  const { data: global } = await supabaseAdmin
    .from('smtp_configs')
    .select('host, port, secure, username, password_encrypted, from_name, from_email')
    .eq('scope', 'global')
    .eq('enabled', true)
    .maybeSingle();

  if (global) return rowToOptions(global);
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// buildTransporter — thin wrapper so callers don't import nodemailer directly
// ─────────────────────────────────────────────────────────────────────────────
export function buildTransporter({ host, port, secure, auth }) {
  return nodemailer.createTransport({ host, port, secure, auth });
}

// ─────────────────────────────────────────────────────────────────────────────
// verifyConnection — SMTP NOOP handshake
// ─────────────────────────────────────────────────────────────────────────────
export async function verifyConnection(transportOptions) {
  try {
    await assertPublicSmtpHost(transportOptions?.host);
    const transporter = buildTransporter(transportOptions);
    await transporter.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message ?? String(err) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// sendMail
// ─────────────────────────────────────────────────────────────────────────────
export async function sendMail({ transportOptions, to, subject, html, text, attachments }) {
  try {
    await assertPublicSmtpHost(transportOptions?.host);
    const transporter = buildTransporter(transportOptions);
    const from = `"${transportOptions.fromName}" <${transportOptions.fromEmail}>`;
    const info = await transporter.sendMail({ from, to, subject, html, text, attachments });
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    return { ok: false, error: err?.message ?? String(err) };
  }
}
