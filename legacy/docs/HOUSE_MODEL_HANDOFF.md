# Handover — matching the wizard's 3D house to `hus.png`

Reference implementation in this project:

| File | Purpose |
| --- | --- |
| `Husvaelger 3D.dc.html` | Full wizard step-2 shell (nav, header, tabs, drawer, controls, hover card, CTA) — the visual target |
| `house-scene.js` | `<house-stage>` custom element: three.js scene, procedural PBR textures, zone selection, orbit controls, `valgt` marker |

`house-scene.js` is written as a *port source*, not as a drop-in: every mesh is
already grouped by canonical zone ID, so each block maps 1:1 onto a `PartBox` /
`StaticBox` call inside `HouseScene` in `HouseModel3D.tsx`.

## 1. What changed relative to the current model

1. **Roof orientation.** Ridge now runs along `X` (gables face ±X). The front
   slope (+Z) is tiled only over the western half; the eastern half is left open
   so the rafters, ridge beam and collar ties read as an exposed cutaway — this
   is the single biggest difference against `hus.png`.
2. **Site plate is cut, not solid.** Soil is four blocks (west, north,
   south-west, east-low) so the basement stays visible through the front notch.
   A solid plate buries the basement.
3. **Split level.** Lower terrain (`y = -2.6`) carries the sunken driveway and
   the garage; the balcony deck sits on the garage roof at ground-floor level.
4. **Hollow window frames.** Frames are four thin bars (`FR()` helper), never a
   single solid box — a solid "karm" renders as a black panel.
5. **Furniture, garden and installations are selectable** (see §3).

## 2. Scene constants

```text
lawn top            y =  0.00      first floor        y = 3.15
ground floor level  y =  0.35      eaves              y = 5.35
basement floor      y = -2.45      ridge              y = 7.50
lower terrain       y = -2.55      roof half-span     2.375 (42.2°)
house footprint     x -3.75…2.50   z -2.075…2.075  (6.25 × 4.15)
garage/balcony      x  2.50…5.40   z -1.600…2.200
site plate          x -6.20…6.00   z -3.600…3.400
```

Camera (deviates from the manual — update §10 of the manual when merging):

```ts
position: spherical r = 22, theta = atan2(8.4, 10.5), phi = 1.22
target:   [0.55, 2.5, 0]
fov 38 · near 0.1 · far 60 · distance clamp 13…30 · polar 0.62…1.46
```

The old `8…17` clamp cannot frame the wider site plate; keep damping `0.06`,
auto-rotate `0.65` and the click-vs-drag threshold `delta <= 4`.

## 3. Zone map (all geometry is tagged)

Existing canonical zones are unchanged. Geometry added per zone:

| Zone | Geometry |
| --- | --- |
| `tag_og_skorsten` | 2 tile planes, ridge cap, 2 fascia boards, chimney + cap + flue |
| `loft_tagetage` | 28 rafters, ridge beam, 4 collar ties, 2 wall plates, attic deck, insulation |
| `solceller_energi` | 2 panels on the north slope |
| `facade_overetage` | north/west/east first-floor brick, sill + header bands, west gable triangle (ExtrudeGeometry) |
| `facade_stueetage` | north/west/east ground-floor brick, piers, headers |
| `vinduer_overetage` | 2 west windows, east glass wall, skylight (frame + glass) |
| `vinduer_doere_stueetage` | west and east sliding doors (frame + glass + mullion) |
| `altan_balkon` | deck, edge beam, 2 glass balustrades, 2 handrails, 3 posts, pergola beams + 7 rafters |
| `garage_carport` | floor, 4 walls, lintel, door box + lamella |
| `terrasse_udendoers` | deck, edge, 2 steps, handrail + 4 posts, bench |
| `indkoersel_belaegning` | gravel drive, paving apron, kerb |
| `have_hegn` | 3 lawn plates, 2 hedges, 5 stepping stones, 8 shrubs, 2 trees, planting bed with 7 flowers + kerb, 9-post picket fence with 2 rails, raised vegetable bed with 5 plants, garden bench, 2 path lamps |
| `fundament_sokkel` | footing slab, 4 plinth walls, 2 basement columns |
| `kaelder_udvendig` | 5 basement walls |
| `kloak_forsyning` | soil stack, water pipe, distribution board, cylinder, sewer run, 2 exterior lamps |
| **`inventar_moebler` (new)** | kitchen (26), dining (9), lounge (12), stairs (12 treads), bathroom (22), bedroom (7), attic lounge (5), basement (10), balcony (4), pots (5) |
| **`ladestander_elbil` (new)** | wall charger + status LED + cable, driveway post + display + base |

Non-selectable `StaticBox` remains: soil masses, floor slabs, interior
partitions, and the car — the car is now 27 meshes (body, bonnet, boot, cabin,
roof, 4 glazed openings, 2 bumpers, grille, 2 headlights, 2 tail lights, 2
mirrors, 4 tyres + 4 rims) using the `car / chrome / rim / headlight /
taillight / glassDark` materials.

### Adding `inventar_moebler` and `ladestander_elbil` (required before merge)

1. `wizardCatalog.ts` — add both zones with `tasksKey` and highlight colours
   `#fbbf24` / `#22c55e`.
2. `SYSTEM_GROUPS` — new group **Inventar & Møbler**; `ladestander_elbil` joins
   **Installationer**.
3. `ZONE_NOTICE_POSITIONS` — fallback anchor `[0.4, 1.3, 0.6]`.
4. `HouseExteriorSVG.tsx` — add a toggleable region.
5. Extend `HouseModel3D.test.tsx` (group toggle, select-all, partial state).

If the product does not want furniture as a billable zone, delete the tag from
those meshes and pass them through `StaticBox` — nothing else changes.

## 4. Textures

`house-scene.js` generates the seven families procedurally on canvas (colour +
derived normal map) so the reference runs offline. **In the app, keep the
existing Poly Haven maps** — the families map straight across:

| Scene family | App prefix | Texel density used here |
| --- | --- | --- |
| `roof` | `grey_roof_tiles` | 0.85 rep/unit |
| `brick` | `white_bricks` | 1.15 |
| `wood` (structural pine) | `wooden_planks` | 0.90 |
| `deck` (terrace) | `wooden_planks` | 0.80 |
| `floor` (interior oak) | `wooden_planks` | 0.65 |
| `concrete` | `concrete_floor` | 0.55 |
| `grass` | `leafy_grass` | 0.50 |
| `dirt` | `dirt` | 0.45 |
| `gravel` | `gravel_road` | 0.70 |
| `tiles` (paving, new) | needs a desktop + mobile pair, e.g. `concrete_pavers` | 0.62 |

Density is applied **per geometry**, not per material: `_boxGeo(w,h,d,density)`
rescales the UVs face by face so a 6 m wall and a 0.5 m pier show the same
brick size. Port this helper — it removes the "repeated textures change
apparent scale" limitation in §15 of the manual. Material rules are unchanged
(sRGB diffuse, linear normal/rough, anisotropy 8, normal scale 0.42/0.38,
white base colour).

## 5. Selection feedback

- Selected: catalog colour as emissive at `0.13` (`0.20` while hovered) plus
  `EdgesGeometry` in `#7dbcff` with `depthTest: false`.
- Hover: emissive `0.06` on every mesh of the zone.
- `valgt` marker: 20 ms delay, 180 ms fade, 5 s lifetime, anchored to the 3D
  click point and re-projected every frame.

Emissive above ~0.15 washes the texture out — the reference deliberately stays
below the manual's earlier, stronger values.

## 5b. Plan view ("Indvendig") and daylight

**Plan view.** The `Indvendig` tab calls `stage.setStageMode('plan', level)`:

- camera animates to `phi 0.21`, `theta 0.02`, `r 18.5–19.5`, target on the
  level's floor — the target is damped (`target.lerp(targetTo, 0.11)`), so the
  transition reads as a move, not a cut;
- polar clamp opens to `0.08` in plan mode only;
- every mesh is tagged `userData.level` = `kaelder | stue | etage1 | tag | site`
  by `_classify()` (roof/loft/solar zones forced to `tag`, ground and paving to
  `site`, everything else by bounding-box centre height);
- `_applyVisibility()` hides `tag` entirely, hides levels above the selected
  one, applies a **plan cut at floor + 1.55 m** (anything whose bounding box
  starts above the cut is hidden, so upper cabinets, hoods, pendants and the
  pergola stop covering the plan), and hides `site` props whose centre sits more
  than 3.4 m above the shown floor (so the basement plan is not covered by lawn,
  hedge or tree crowns);
- room labels (`stage.rooms`, 12 entries) are DOM chips in the stage overlay,
  re-projected every frame, filtered to the shown level;
- `pickables` is rebuilt from the visible set, so hidden geometry cannot be
  clicked. Selection state itself is untouched — a zone selected in the exterior
  view stays selected.

Level switching is state-driven from the wizard (`level` in component state);
the camera only moves when `mode|level` actually changes, so the user keeps
control of rotate and zoom inside a level.

**Sky.** Two layers, so the background parallaxes instead of feeling pasted on:

1. A featureless gradient on a camera-facing plane (`renderOrder -1`, `fog:false`,
   `toneMapped:false`), refitted to the frustum every frame at distance 120 —
   day and night canvases, 1024×640.
2. World-space celestial objects in a `Group` at radius ~105 that rotate with
   the model: 1 800 stars as three `THREE.Points` layers (`sizeAttenuation:
   false`, additive, per-vertex brightness — points stay pixel-sharp at any
   zoom), a 512 px moon (maria, 26 rimmed craters, ray system, limb shading)
   with a separate halo sprite, a sun sprite, 12 drifting cloud sprites
   (`_cloudGroup` rotates 0.0075 rad/s and each cloud bobs vertically), and a
   shooting-star streak that fires every 45–75 s at night along a random path
   with its sprite rotation aligned to the projected direction.

Because the wizard camera looks *down* at the model, the visible background band
sits below the horizon — celestial objects therefore live at negative elevation
(−2° to −12° for sun/moon/clouds, −62° to +14° for stars). A sky *dome* was
tried first and rejected: it only ever showed its pale ground half. Camera far
plane is 240. `_skyFrame(dt)` drives drift and the shooting star.

Two canvas-drawing gotchas worth keeping in mind when editing these textures:
create radial gradients **after** any `translate`/`scale` (a gradient built in
canvas space then drawn under a transform samples its outermost stop and turns
invisible), and set `fog:false` on every sky material — at radius 105 the scene
fog would erase them.

**Daylight.** `stage.setLighting('nat' | 'dag')` is now a real preset pair, not
an intensity multiplier: ambient/hemisphere colours, key light colour and
intensity, warm interior lights at 30 %, fog colour and tone-mapping exposure
all switch. The wizard exposes it as a labelled `Aften / Dagslys` pill (the
manual's §9 rule "the lighting toggle does not swap the material set" still
holds — no materials change). The stage's CSS backdrop switches with it.

## 5c. Layer view ("Lag" tab) and the task catalog

**Layers.** Every mesh also carries `userData.layer`, derived in `_layerOf()`
from its zone (with name overrides: `isolering` → klimaskærm, `skillevaeg /
trappevaeg / bil_` → inventar, `terraen / stoettemur` → terræn, other statics →
konstruktion). `setLayer(id)` shows only that layer plus `terraen` as ground
context; `alle` restores everything. Layers double as the structural read of
the house (terræn → fundament → bærende konstruktion → klimaskærm → uderum →
installationer → overflader/inventar) and combine with the plan-level filter.

**Task catalog.** The drawer is now three levels deep: group → zone → tasks
(4–5 per zone, 74 total, in `TASKS`). Task rows are 32 px tall with 44 px group
rows, so the accordion stays thumb-friendly on phone and tablet; only one
category and one zone are usually open at a time. Ticking a task auto-selects
its zone (and fires the `valgt` marker). In the app these strings should come
from `wizardCatalog.ts` alongside each zone's `tasksKey` — do not keep a second
copy in the 3D component.

**Geometry added this round:** kitchen (26 meshes: base run with doors and
handles, worktop, tiled splashback, sink + tap, hob with zones, oven, fridge,
wall cabinets, extractor + duct, island with bar stools and two pendants),
bathroom (22 meshes: tiled floor and two tiled walls, bath with water surface,
vanity with basin/tap/mirror, wc with cistern and flush plate, shower tray with
two glass panels and head, towel rail), and a new `ladestander_elbil` zone
(wall box with status LED, cable, driveway charging post with display and base).

## 6. Host contract

The element is controlled exactly like `HouseModel3D`:

```js
stage.setSelected(ids)      // full array, every change
stage.setHover(zoneId|null)
stage.flashMarker(zoneId)   // drawer-originated selection
stage.resetView() / setAutoRotate(b) / setLighting('nat'|'dag') / setViewMode('orbit'|'pan'|'grid')
stage.setStageMode('udvendig'|'plan', 'kaelder'|'stue'|'etage1')
stage.setLayer('alle'|'terraen'|'fundament'|'konstruktion'|'klimaskaerm'|'tilbygning'|'installationer'|'inventar')
stage.setQuality('hoj'|'mobil')   // persisted; rebuilds the renderer
stage.invalidate(n)               // mark n frames dirty (render-on-demand)
// window events: housestage:ready | housestage:hover | housestage:toggle
```

In React these become the existing props (`selectedZoneIds`, `onToggle`) — the
event bridge only exists because the reference is framework-free.

## 7. Performance and quality profiles

A tick control in the top bar switches two profiles; the choice is persisted in
`localStorage['byggeapp.house3d.kvalitet']` and survives reload.

| | Høj | Mobil |
| --- | --- | --- |
| procedural texture size | 256 | 128 |
| anisotropy | 8 (capped to GPU max) | 4 |
| device pixel ratio cap | 1.65 | 1.2 |
| antialias | on | off |
| shadow map | 1024 | 512 |
| warm point lights | 13 | 8 |
| sky canvas | 1024×640 | 640×400 |
| stars / clouds | 1800 / 12 | 648 / 6 |
| environment reflections | PMREM from the sky | none |

Default: **Mobil** on a phone (coarse pointer *and* min viewport ≤ 700 px, or
`navigator.deviceMemory ≤ 4`), **Høj** on tablet and desktop; the user can
override on any device. `setQuality` tears the renderer down and re-boots the
scene, then re-applies selection, hover, layer, level, lighting and camera. The
stage re-fires `housestage:ready`, and the host must treat that as "re-apply
everything" — the reference clears its stage reference so the next sync is full.

### What was changed

- **One material per zone+family** instead of one clone per mesh: 367 → 75.
  Selection emissive is a per-zone signal, so behaviour is identical.
- **`shadowMap.autoUpdate = false`.** The scene is static; shadows are re-baked
  only after a build, a visibility change or a lighting change.
- **Render on demand.** `invalidate(n)` marks frames dirty; the loop skips
  rendering once the camera has settled and nothing animates. Every setter and
  input handler invalidates. Cloud drift wakes it at ~20 fps (10 fps on Mobil)
  instead of pinning 60 fps forever — the biggest battery/thermal win on tablets.
- **Shadow casting only where it reads:** off for furniture, installations, the
  car, and anything under 0.4 m.
- **One shared micro-normal map** on all flat-colour materials (plaster, lacquer,
  fabric) so they stop reading as plastic; `normalScale 0.12`.
- **Anisotropy** is `min(profile, capabilities.getMaxAnisotropy())`.

### Still worth doing in the app

- **Merge geometry per zone+family+level.** 423 meshes ≈ 423 draw calls at only
  8.6 k triangles; merging should reach 40–60. Left out here because the
  plan-view cut filters per mesh — merge keys must include the level and the
  above/below-cut bucket.
- **KTX2 / Basis for the Poly Haven maps.** 14.8 MB of JPEG decodes to ~40 MB of
  VRAM; compressed textures stay compressed on the GPU. This matters more than
  pixel dimensions.
- `preserveDrawingBuffer: true` is on for snapshot/export support — drop it if
  you never capture the canvas.

## 8. Content added in this pass

- Gutters on both eaves, three downpipes with hoppers (`tag_og_skorsten`) — the
  "Tagrender & nedløb" task previously had no geometry.
- Roof vent and a ventilation plant with ducts in the technical room
  (`kloak_forsyning`) — same reason, for "Ventilationsanlæg".
- Room labels carry area (`Køkken · 12 m²`), and an `Entré` label was added; 13
  rooms across three levels. Areas are authored constants — recompute them from
  the real floor plates if the app ever changes the footprint.
- Selection recap above the CTA: one chip per selected part with its task count,
  click to remove, plus "Ryd alle".
- The third tab is **Listevisning** (was `Lejlighed`): a sideways tree
  configurator over the same data — Kategori → Bygningsdel → Opgaver in three
  scrollable columns, tri-state checkboxes at every level (a category shows
  `n/total` and a dash when partial), drill arrows, a search field that matches
  category, part and task names (a hit at any depth keeps its ancestors
  visible), and "Fravælg alle". It writes to the same `selected` / `tasks` state
  as the 3D drawer, so the model, the recap and the list are always in sync —
  useful on a phone where clicking a 3D part is fiddly.

## 9. Still open

- `tiles` texture family needs licensed desktop + mobile maps before merge.
- Draw-call merging (above) is the one remaining large performance item.
- Room areas are hard-coded, not derived from geometry.
- Task strings live in the reference component; they must move to
  `wizardCatalog.ts` with `tasksKey`, and ideally gain unit/price/duration so
  step 3 can pre-fill estimates.
- SVG fallback has not been updated for the new zone or the new roof reading.
