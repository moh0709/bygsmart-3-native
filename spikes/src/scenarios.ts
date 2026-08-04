// D-11 spike — the scenario matrix as typed, runnable-shaped data.
// Mirrors P0.1_D11_tritarget_spike_plan.md §3. Each candidate × each applicable runtime
// runs these; the runner records a Verdict + evidence per cell.

export type Arm = 'all' | 'native' | 'web';
export type Group = 'baseline' | 'write' | 'native' | 'web';
export type Verdict = 'pass' | 'pass-with-caveat' | 'fail' | 'not-run';

export interface Scenario {
  id: string;
  group: Group;
  arm: Arm;
  title: string;
  passCriterion: string;
  /** Hard gate: a FAIL here eliminates the candidate outright (plan §4.1). */
  hardGate?: boolean;
}

export const SCENARIOS: Scenario[] = [
  // 3.1 Baseline capability (all runtimes)
  { id: 'B1', group: 'baseline', arm: 'all', title: 'Initial hydration of a typical scope', passCriterion: 'Completes with progress; <=60s on 4G', hardGate: true },
  { id: 'B2', group: 'baseline', arm: 'all', title: 'Online CRUD round-trip to a 2nd client', passCriterion: 'Converges; RLS-scoped', hardGate: true },
  { id: 'B3', group: 'baseline', arm: 'all', title: 'Tombstone / delete-while-offline', passCriterion: 'Offline client learns the delete on reconnect; no resurrection', hardGate: true },
  { id: 'B4', group: 'baseline', arm: 'all', title: 'Cursor (updated_at,id) correctness under paging', passCriterion: 'No row skipped or duplicated across page boundaries', hardGate: true },
  { id: 'B5', group: 'baseline', arm: 'all', title: 'Real schema + RLS fit', passCriterion: 'No table/relationship the engine cannot express', hardGate: true },

  // 3.2 Offline write path (all runtimes)
  { id: 'W1', group: 'write', arm: 'all', title: 'Offline create -> reconnect', passCriterion: 'Replays; idempotent (client UUID); one row' },
  { id: 'W2', group: 'write', arm: 'all', title: 'Dependency-ordered replay (photo on offline task)', passCriterion: 'Photo replays AFTER its task' },
  { id: 'W3', group: 'write', arm: 'all', title: 'Reference offline day (8h,40 photos,12 checkins,30 mut)', passCriterion: 'Outbox drains to empty within 5 min' },
  { id: 'W4', group: 'write', arm: 'all', title: 'Conflict — two clients edit same task', passCriterion: 'Deterministic LWW-with-server-guard resolution' },

  // 3.3 Native-specific
  { id: 'N1', group: 'native', arm: 'native', title: 'Kill app mid-upload -> relaunch', passCriterion: 'Outbox survives; reconcile-on-launch resumes' },
  { id: 'N2', group: 'native', arm: 'native', title: 'Reboot device with full outbox', passCriterion: 'No loss' },
  { id: 'N3', group: 'native', arm: 'native', title: 'SQLCipher encryption at rest coexists', passCriterion: 'Engine works with an encrypted store, or documents the gap' },
  { id: 'N4', group: 'native', arm: 'native', title: 'Large Supabase session vs secure-store 2KB cap', passCriterion: 'Chunking adapter keeps auth token storage working' },

  // 3.4 Web / RNW-specific (the hardest arm)
  { id: 'R1', group: 'web', arm: 'web', title: 'PowerSync RNW beta setup (workers, Metro resolution)', passCriterion: 'Builds and runs in RNW at all — the primary unknown' },
  { id: 'R2', group: 'web', arm: 'web', title: 'wasm SQLite over OPFS basic op', passCriterion: 'Reads/writes persist across reload' },
  { id: 'R3', group: 'web', arm: 'web', title: 'Storage eviction mid-outbox', passCriterion: 'No silent loss; surfaced honestly' },
  { id: 'R4', group: 'web', arm: 'web', title: 'Quota exceeded (incognito ~100MB)', passCriterion: 'Graceful; media retained locally; user informed' },
  { id: 'R5', group: 'web', arm: 'web', title: 'Safari private browsing — no OPFS', passCriterion: 'Online-only tier REFUSES to queue (never lies about state)', hardGate: true },
  { id: 'R6', group: 'web', arm: 'web', title: 'Multi-tab, one DB — two tabs mutate one record', passCriterion: 'Web Locks single-writer election; no corruption' },
  { id: 'R7', group: 'web', arm: 'web', title: 'Tab closed mid-upload', passCriterion: 'Resumes on return (documented degradation, not loss)' },
  { id: 'R8', group: 'web', arm: 'web', title: 'persist() + tier detection at startup', passCriterion: 'Correct tier reported to Sync Centre' },
];

export interface Cell {
  scenarioId: string;
  runtime: 'ios' | 'android' | 'web';
  verdict: Verdict;
  evidence: string;
}

export type Candidate = 'powersync' | 'electricsql';

export interface Scorecard {
  candidate: Candidate;
  cells: Cell[];
}

/** A blank scorecard: every applicable (scenario × runtime) cell set to not-run. */
export function blankScorecard(candidate: Candidate): Scorecard {
  const runtimes = ['ios', 'android', 'web'] as const;
  const cells: Cell[] = [];
  for (const s of SCENARIOS) {
    for (const rt of runtimes) {
      const applies =
        s.arm === 'all' ||
        (s.arm === 'native' && (rt === 'ios' || rt === 'android')) ||
        (s.arm === 'web' && rt === 'web');
      if (applies) cells.push({ scenarioId: s.id, runtime: rt, verdict: 'not-run', evidence: '' });
    }
  }
  return { candidate, cells };
}

/** Hard-gate check (plan §4.1): any hard-gate scenario failing on an applicable runtime eliminates the candidate. */
export function passesHardGates(card: Scorecard): boolean {
  const hardIds = new Set(SCENARIOS.filter((s) => s.hardGate).map((s) => s.id));
  return !card.cells.some((c) => hardIds.has(c.scenarioId) && c.verdict === 'fail');
}
