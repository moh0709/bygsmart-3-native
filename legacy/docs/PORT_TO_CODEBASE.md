# Porting the 3D house wizard into Byggeapp 2.1

Two files carry everything:

- **`house-scene.js`** — the whole scene as a framework-free `<house-stage>`
  custom element (geometry, materials, sky, plan view, layers, room entry,
  quality profiles, batch merging). No React, no imports except three.js.
- **`HOUSE_MODEL_HANDOFF.md`** — the engineering reference: zone table, layer
  map, camera contract, host events, quality profiles, known gotchas.

`Husvaelger 3D.dc.html` is the reference *host UI* — treat it as a spec for the
panel, not as code to copy.

---

## Step 1 — get the files into the repo

Download this project, then copy into
`E:\01PROJEKTER\04 Mobil APPS\bygsmart 2.1\Byggeapp-2.1\`:

```
src/features/wizard/house3d/house-scene.js      <- house-scene.js
docs/HOUSE_MODEL_HANDOFF.md                     <- HOUSE_MODEL_HANDOFF.md
docs/PORT_TO_CODEBASE.md                        <- this file
```

## Step 2 — decide the integration route

**Route A (recommended): keep `house-scene.js` as the renderer.**
`HouseModel3D.tsx` becomes a thin React wrapper — mount the element, push props
in, listen for events. The scene stays plain JS, so it never fights React
re-renders, and future scene edits are one file. ~150 lines of wrapper.

**Route B: fold the builder into the existing `HouseScene`.**
More work, more risk, only worth it if you need the geometry to live in TSX for
other reasons. The handoff documents what to move.

Route A is what the rest of this assumes.

## Step 3 — the prompt for Claude Code

Open Claude Code in the repo root and give it this:

> Read `docs/HOUSE_MODEL_HANDOFF.md` and `src/features/wizard/house3d/house-scene.js` first.
>
> Task: replace the current 3D house in the project wizard (`/#/projects/new`,
> step 2) with the `<house-stage>` element from `house-scene.js`, keeping our
> existing wizard state, catalog and styling.
>
> 1. **Wrapper.** Rewrite `HouseModel3D.tsx` as a thin wrapper around
>    `<house-stage>`: load `house-scene.js` once, render the tag, and bridge
>    state. In → `setSelected(ids)`, `setHover(id)`, `setStageMode(mode, level)`,
>    `setLayer(id)`, `setLighting('dag'|'nat')`, `setQuality('hoj'|'mobil')`,
>    `enterRoom(i)`, `exitRoom()`. Out → window events `housestage:ready`,
>    `housestage:hover`, `housestage:toggle`, `housestage:longpress`,
>    `housestage:room`. Treat `housestage:ready` as "re-apply all state" — it
>    fires again after a quality switch. Delete the old `HouseScene` geometry.
> 2. **Catalog.** Add the 51 zones to `wizardCatalog.ts` with the ids, Danish
>    names, descriptions and highlight colours from the handoff's zone table,
>    each with a `tasksKey`. Add the ~200 task strings under those keys — they
>    are currently duplicated in the reference UI and must live only in the
>    catalog. Update `SYSTEM_GROUPS` to the 15 categories and
>    `ZONE_NOTICE_POSITIONS` for the new zones.
> 3. **Panel.** Extend the existing "Vælg bygningsdele" drawer to three levels
>    (kategori → bygningsdel → opgaver), add the `Lag` tab with the 9 layers,
>    and rename the third view tab to `Listevisning` with the sideways-tree
>    configurator (search + tri-state selection + fravælg alle). Match the
>    reference in `Husvaelger 3D.dc.html` for behaviour, but use our components
>    and tokens for styling.
> 4. **Textures.** Point the scene's material families at our Poly Haven maps
>    per the handoff's family→prefix table; keep the procedural fallbacks for
>    anything unlicensed (currently `tiles`/paving).
> 5. **Fallback + tests.** Update `HouseExteriorSVG` so every one of the 51
>    zones has a hit region, and extend the wizard tests to cover: select/toggle
>    round-trip, layer isolation, plan level switching, room entry/exit, and the
>    quality switch persisting to localStorage.
>
> Constraints: no npm additions beyond three.js; keep TypeScript strict; do not
> change the wizard's existing step flow or persistence shape.

## Step 4 — verify after the port

- 51 zones all selectable, all with geometry (`Object.keys(stage.byZone).length === 51`)
- draw calls ≈ 220, not ≈ 550 (batch merging survived the port)
- `Kvalitet` defaults to Mobil on a phone, Høj on tablet/desktop, and persists
- plan view cuts at floor + 1.55 m on all three levels
- room entry works for all 15 rooms and the Tilbage button clears both states

## Known follow-ups (not blockers)

- Room areas are authored constants; derive them from the floor plates.
- KTX2/Basis for the texture set — 14.8 MB of JPEG decodes to ~40 MB VRAM.
- A licensed paving (`tiles`) family is still missing, desktop and mobile.
- Task rows have no unit/price/duration yet; adding them in `wizardCatalog.ts`
  is what lets step 3 pre-fill estimates.

## Two gotchas that will bite

1. **Collision auditing must use authored coordinates, not the scene graph.**
   After batch merging, one mesh spans a whole zone, so mesh-vs-mesh AABB tests
   against `house.children` are meaningless.
2. **Never scale the house group non-uniformly.** It shears rotated slabs,
   flattens the roof pitch and makes wheels elliptical. Resize rooms by moving
   partitions instead.
