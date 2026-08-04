# D-11 tri-target sync spike — harness

Resolves **D-11** (buy PowerSync · buy ElectricSQL · build bespoke). Governed by
`docs/mobile-fork/P0.1_D11_tritarget_spike_plan.md`. **Throwaway** — deleted once D-11 is signed.

## What is built now (hardware-independent, in this folder)
- **`src/repository-contract.ts`** — the shared interface both candidates must satisfy. Screens depend only on this; measuring both engines behind one contract is the AR-05 property under test.
- **`src/scenarios.ts`** — the full scenario matrix (B1–B5, W1–W4, N1–N4, R1–R8) as typed data, with hard-gate flags and a blank-scorecard generator.
- **`src/web-capability.ts`** — graded web-offline tier detection (Full / Session-durable / Online-only), the OPFS/persist/quota probes, and the P3 refusal rule. **Real Web-API code**; the pure logic is unit-tested.
- **`src/web-locks-election.ts`** — single-writer election across tabs (scenario R6 / S-14).
- **`scoring-sheet.md`** — the fillable rubric (plan §4).
- **`powersync-rnw-checklist.md`, `electricsql-checklist.md`** — engine setup, so PRE-4 is a checklist not a research task.

Run the hardware-independent tests: `pnpm test:spike` (tier logic + scenario integrity).

## What CANNOT be built until the owner acts (the spike proper)
- **Two Expo SDK 56 spike apps** (one per candidate) that install PowerSync / ElectricSQL and implement `SyncEngineAdapter` — need the **provisioned Supabase project + baseline schema** to sync against.
- **Running B/W/N/R on real hardware** — needs the **physical iPhone + Android**.

## To run the spike once unblocked (PRE-1..4 in the plan)
1. Provision the Supabase project; deploy `supabase/baseline/`.
2. For each candidate: copy the `apps/app` Expo scaffold, add the engine, implement `SyncEngineAdapter` against the contract.
3. Execute `SCENARIOS` on iOS, Android and web (Chrome, Safari incl. private, Firefox); fill a `Scorecard` per candidate.
4. Score with `scoring-sheet.md`; write the signed D-11 record. Escalate if both fail the RNW hard gates.
