<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# BygSmart 2.0 - Construction Management PWA

BygSmart 2.0 is a React + TypeScript + Vite application with Supabase for auth/data and a server-side API proxy for Gemini and Stripe.

## Local Development

Prerequisites: Node.js 20+

1. Install dependencies:
```bash
npm install
```

2. Copy env file and fill values:
```bash
cp .env.example .env
```

3. Start frontend:
```bash
npm run dev
```

4. Start API service (optional in local dev):
```bash
npm run api
```

## Quality & Tests

```bash
npm run typecheck
npm run lint
npm run test
npm run test:coverage
npm run test:e2e
```

## Production Build

```bash
npm run build
# Output: dist/
```

## Deploy

Production targets are `bygsmart.com` (landing) and `app.bygsmart.com` (SPA + API).
See [deploy/simply/README.md](deploy/simply/README.md) for full steps.

Quick deploy:
```bash
bash deploy/deploy-simply.sh
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite 6 |
| Styling | Tailwind CSS v4 |
| API Service | Node.js + Express |
| Backend | Supabase (PostgreSQL + Auth + Storage) |
| AI | Google Gemini 2.5 Flash (server-side key) |
| Payments | Stripe Checkout + Webhook |
| Observability | Sentry + Web Vitals |
| PWA | Service Worker |
| 3D/AR | Three.js, @react-three/fiber |