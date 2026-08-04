import { describe, it, expect } from 'vitest';
import { ALL_MANIFESTS } from '../registry/manifests';
import { collectSlot, resolveActiveManifests } from '../registry/registry';
import type { ModuleId, ProjectTabContext } from '../registry/types';
import { MODULE_IDS } from '../registry/types';

// ─────────────────────────────────────────────────────────────────────────────
// Tab-matrix net (Phase 5): the slot-resolved tab sets must reproduce the
// original ProjectDetailPage `allowedTabs` memo EXACTLY for every role/
// visibility branch. Expected arrays are the old memo's outputs re-ordered by
// the global contribution order (order only affected the first-tab redirect,
// asserted separately).
// ─────────────────────────────────────────────────────────────────────────────

const ALL_ON = new Set<ModuleId>(MODULE_IDS);

const tabsFor = (ctx: ProjectTabContext, enabled: Set<ModuleId> = ALL_ON): string[] =>
  collectSlot(resolveActiveManifests(enabled, ALL_MANIFESTS), 'projectTabs')
    .filter((c) => c.isAllowed(ctx))
    .map((c) => c.key);

const ctx = (
  userRole: ProjectTabContext['userRole'],
  visibility: ProjectTabContext['visibility'] = null,
  isPartnerResource = false
): ProjectTabContext => ({ userRole, visibility, isPartnerResource });

describe('project tab matrix (parity with the pre-slot allowedTabs memo)', () => {
  it('CLIENT → overblik + dokumenter only', () => {
    expect(tabsFor(ctx('CLIENT'))).toEqual(['overblik', 'dokumenter']);
    // CLIENT precedence beats any visibility setting
    expect(tabsFor(ctx('CLIENT', 'all'))).toEqual(['overblik', 'dokumenter']);
  });

  it('OWNER / MANAGER → all 12 tabs', () => {
    const expected = [
      'overblik', 'opgaver', 'tid-plan', 'budget', 'indkob', 'partnere',
      'opfølgning', 'punch-list', 'pamindelser', 'dokumenter', 'detaljer', 'tilbud',
    ];
    expect(tabsFor(ctx('OWNER'))).toEqual(expected);
    expect(tabsFor(ctx('MANAGER'))).toEqual(expected);
    // role precedence beats visibility
    expect(tabsFor(ctx('OWNER', 'none'))).toEqual(expected);
  });

  it("visibility 'all' → economy visible, partnere/tilbud stay OWNER-only", () => {
    expect(tabsFor(ctx('EMPLOYEE', 'all'))).toEqual([
      'overblik', 'opgaver', 'tid-plan', 'budget', 'indkob',
      'opfølgning', 'punch-list', 'pamindelser', 'dokumenter', 'detaljer',
    ]);
  });

  it("visibility 'some' and 'standard' → operational set without economy", () => {
    const expected = [
      'overblik', 'opgaver', 'tid-plan', 'opfølgning',
      'punch-list', 'pamindelser', 'dokumenter', 'detaljer',
    ];
    expect(tabsFor(ctx('EMPLOYEE', 'some'))).toEqual(expected);
    expect(tabsFor(ctx('EMPLOYEE', 'standard'))).toEqual(expected);
    // an EXTERNAL with an explicit visibility resolves through the visibility
    // branch — the old if-chain subtlety, preserved
    expect(tabsFor(ctx('EXTERNAL', 'standard'))).toEqual(expected);
  });

  it("visibility 'none' → opgaver + punch-list; first tab is opgaver", () => {
    const tabs = tabsFor(ctx('EMPLOYEE', 'none'));
    expect(tabs).toEqual(['opgaver', 'punch-list']);
    expect(tabs[0]).toBe('opgaver'); // redirect target
  });

  it('EXTERNAL / partner-resource without visibility → field set', () => {
    const expected = ['overblik', 'opgaver', 'tid-plan', 'opfølgning', 'punch-list', 'pamindelser'];
    expect(tabsFor(ctx('EXTERNAL'))).toEqual(expected);
    expect(tabsFor(ctx('EMPLOYEE', null, true))).toEqual(expected);
  });

  it('fallback (no visibility, internal role) → standard-equivalent set', () => {
    expect(tabsFor(ctx('EMPLOYEE'))).toEqual([
      'overblik', 'opgaver', 'tid-plan', 'opfølgning',
      'punch-list', 'pamindelser', 'dokumenter', 'detaljer',
    ]);
  });

  it('disabling a module collapses its tabs (entitlement gating)', () => {
    const withoutEconomy = new Set<ModuleId>(
      MODULE_IDS.filter((id) => id !== 'budget' && id !== 'purchasing' && id !== 'quotations')
    );
    const tabs = tabsFor(ctx('OWNER'), withoutEconomy);
    expect(tabs).not.toContain('budget');
    expect(tabs).not.toContain('indkob');
    expect(tabs).not.toContain('tilbud');
    expect(tabs).toContain('overblik');
  });

  it('first allowed tab is overblik for every branch that has it', () => {
    for (const c of [ctx('CLIENT'), ctx('OWNER'), ctx('EMPLOYEE', 'all'), ctx('EMPLOYEE', 'some'), ctx('EXTERNAL')]) {
      expect(tabsFor(c)[0]).toBe('overblik');
    }
  });
});
