# ElectricSQL — tri-target setup checklist

The contingency candidate if PowerSync's RNW beta proves unusable (risk R-02).

## Prerequisites
- [ ] Supabase project provisioned + baseline deployed
- [ ] Electric sync service connected to the Supabase Postgres (logical replication)
- [ ] Shapes defined to mirror the 28 syncable tables + RLS-equivalent row filters

## Native (iOS + Android)
- [ ] Add the Electric client + its SQLite driver for RN
- [ ] Implement `SyncEngineAdapter` (`src/repository-contract.ts`) over the Electric database
- [ ] Verify B1–B5, W1–W4, N1–N4 on a **physical** device

## Web / RNW
- [ ] Add the Electric web client over wasm SQLite / OPFS
- [ ] Wire Metro `.web` resolution for the web driver
- [ ] Verify R1–R8 in Chrome, **Safari (incl. private browsing)**, Firefox
- [ ] Confirm the write path / conflict model maps to our per-entity policy (append-only · LWW-with-server-guard · explicit resolution)

## Findings to capture
- [ ] Shape/partial-replication expressiveness vs our RLS row filters
- [ ] Write-path maturity and conflict semantics
- [ ] RNW build + multi-tab (R6) behaviour
- [ ] Integration cost (dev-days) vs PowerSync
