# BygSmart 2.1 — Project Instructions

## Deploy skill

When the user asks to deploy, ship to production, or run a deployment — invoke the deploy skill:

```
Skill: deploy
```

The skill is at `.claude/skills/deploy/SKILL.md`. It contains the complete runbook including pre-flight checks, Supabase migration steps, the correct deploy command, verification, and known failure modes.

**Quick reference:**
- Deploy command (Git Bash only): `bash deploy/deploy-simply.sh`
- Double-click `_deploy.bat` to open Git Bash and deploy in one shot
- Full guide: `deploy/simply/README.md`

## Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS 4
- **Backend:** Node.js v20/v23, Express, Supabase, Stripe, Gemini AI
- **Database:** Supabase (PostgreSQL 17, project: `pkzburssqetnlcbvabdq`, region: eu-west-1)
- **Hosting:** simply.com shared hosting (CloudLinux), SSH alias `simply_bygsmart`
- **Domain:** `bygsmart.com` (landing, static) + `app.bygsmart.com` (React SPA), API at `app.bygsmart.com/api/`
- **Retired:** omniware.dk/byggeapp is decommissioned — bygsmart.com/app.bygsmart.com are the only supported targets.
