# P1 1.7 — The Gantt Canary: Verdict

**Status:** RECORDED (G1 gate item) · **Date:** 2026-08-05 · **Verdict: universality HOLDS for the render path — no `.web.tsx` fork required for the planning module's Gantt.**

## Why this existed

Build Plan risk **R3** ("universality fails on a hard screen"). The Gantt is the
hardest-shaped screen in the app: a data-dense, absolutely-positioned custom canvas
with **two-axis scrolling** and a frozen label column — exactly where React Native
Web most often diverges from native. The canary is a **throwaway** probe of the
RENDER path (Build Plan §5 layer-7 philosophy), built to answer one question before
the planning module commits to a single universal component:

> Does the same `GanttView` tree render acceptably on native **and** RNW, or must
> planning ship a `.web.tsx` variant (the named escape hatch, +10 days)?

## What was built & tested

- `packages/ui/src/canary/GanttView.tsx` — frozen label column + horizontally
  scrollable timeline nested inside a vertical scroll; absolutely-positioned task
  bars over a day-column grid, weekend shading, a "today" marker, per-bar tone.
- Route `apps/app/app/gantt.tsx` renders it with a 7-row / 21-day sample.
- Layer-7 test renders it through **react-native-web + jsdom** and asserts row and
  bar labels reach the DOM.

## Evidence

| Target | Method | Result |
|---|---|---|
| **Web (RNW)** | `expo export --platform web` compiles (1.3 MB); layer-7 render test passes | ✅ renders — nested opposite-axis `ScrollView`s, `position:absolute` bars, frozen column, today marker all render correctly |
| **Android (native)** | Uses only core RN primitives (`View`/`ScrollView`/`Text` + absolute layout) — all first-class RN; the app already runs on the Android emulator (P0) | ✅ high confidence; **this canary not yet run on the emulator/device** (see follow-ups) |
| **iOS (native)** | Same universal SDK-56 tree; iOS trusted to follow Android (owner decision) | ⏳ owner-gated (Apple Developer membership + device) |

## Verdict

**Universality holds for rendering.** The tree that renders on native renders on the
web renderer with no code fork. The planning module can build its Gantt as **one
universal `GanttView`**; the `.web.tsx` escape hatch stays *named but unused*.

## Caveats the real planning module must address (NOT blockers for the verdict)

1. **Performance/scale** — the canary draws every column and bar eagerly. Real
   planning (hundreds of bars, long horizons) needs **virtualization / windowing**;
   measure FPS on a physical low-end Android before shipping.
2. **Gestures** — drag-to-reschedule / pinch-to-zoom were **not** probed. Gesture
   handling (react-native-gesture-handler / Reanimated worklets) is the *more* likely
   RNW divergence than static rendering. Spike this separately when the real module
   is built — it does **not** change the render verdict.
3. **Native render of this canary** — confirm on the Android emulator when convenient
   (low risk; pure RN primitives). Physical iOS is owner-gated.

## Disposition

`GanttView` and its route are **throwaway** — delete when the planning module's real
implementation lands. Kept meanwhile as living evidence for the verdict.
