# Production Readiness Design

## Goal

Prepare BygSmart for VPS production deployment with isolated demo access, installable PWA support, and standards-based web push.

## Demo Access

The login screen keeps one normal credential form. When a visitor clicks `Demo adgang`, the value in the existing e-mail field is treated as the visitor contact e-mail. The backend validates and stores that e-mail, creates a fresh confirmed Supabase demo auth user with generated credentials, marks it as demo metadata, and returns temporary credentials for immediate sign-in. The frontend then seeds demo project data for that new account, so each demo visitor starts from clean content.

Demo users cannot start Stripe checkout or delete accounts through the production API. Demo records are identifiable through auth metadata and profile columns so future cleanup jobs can remove old demo accounts.

## Production Hardening

The API fails closed when required production environment variables are missing, CORS only allows configured origins outside development, request rate limits protect expensive endpoints, and client-facing errors avoid leaking internal exception details. Docker builds exclude local files and secrets via `.dockerignore`, and the API container uses a lockfile with `npm ci`.

## PWA And Push

The app ships a valid web app manifest, iOS web app metadata, a service worker with fetch and push handlers, and client push subscription code. Push subscriptions are stored server-side per authenticated user using VAPID Web Push. Android/Chromium can request push from the browser/PWA. On iOS, push requires iOS 16.4+ and the app installed to the Home Screen before the Push API is available.

## Verification

Run typecheck, lint, production build, unit tests, Playwright smoke tests, and production dependency audits for both frontend and API before calling the app production-ready.
