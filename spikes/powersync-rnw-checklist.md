# PowerSync — tri-target setup checklist (RNW support is BETA)

The point of scenario **R1** is to establish whether this beta actually works in React Native
Web against our schema. Treat every step as a finding.

## Prerequisites
- [ ] Supabase project provisioned + baseline deployed
- [ ] PowerSync instance connected to the Supabase Postgres (publication + sync rules)
- [ ] Sync rules written to mirror the 28 syncable tables + RLS-equivalent row filters

## Native (iOS + Android)
- [ ] Add `@powersync/react-native` (RN SDK ≥ 1.12.1) + the op-sqlite/wa-sqlite backend it requires
- [ ] Implement `SyncEngineAdapter` (`src/repository-contract.ts`) over the PowerSync database
- [ ] Verify B1–B5, W1–W4, N1–N4 on a **physical** device (not a simulator)

## Web / RNW (the beta — the actual unknown)
- [ ] Add `@powersync/web` (Web SDK ≥ 1.8.0)
- [ ] **Copy the wasm + worker assets** into the web build output (documented manual step)
- [ ] Configure **Metro platform-specific resolution** — PowerSync ships separate `react-native` vs `web` entry points; wire `.web` resolution
- [ ] Watch for packages "implemented with only their specific platform in mind" (per PowerSync docs) → find per-platform alternatives
- [ ] Verify R1–R8 in Chrome, **Safari (incl. private browsing)**, Firefox; desktop + a real mobile browser
- [ ] Record: does OPFS multi-tab (R6) work, or does the VFS allow only one connection?

## Findings to capture
- [ ] RNW build succeeded? worker/wasm asset story? Metro friction level (dev-days)?
- [ ] Any scenario PowerSync cannot pass, and why
