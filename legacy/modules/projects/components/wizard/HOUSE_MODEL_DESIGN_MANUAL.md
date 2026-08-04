# 3D House Selector — Design and Engineering Handover

Last updated: 2026-07-27  
Product route: `/#/projects/new`, step 2 of the project wizard  
Primary component: `HouseModel3D.tsx`

## 1. What this model is

The house is a programmatic React Three Fiber scene. It is not a single
`.glb`, `.gltf`, `.fbx`, or `.obj` file.

The visible house is assembled from Three.js box geometry, simple generated
landscape shapes, lighting, PBR textures, and HTML overlays. This approach
makes each building part directly selectable and lets its selection state stay
connected to the project wizard.

The component has two responsibilities:

1. Present a detailed cutaway house that can be rotated, panned, and zoomed.
2. Convert clicks on the house or building-system panel into stable wizard
   zone IDs.

It is a visual project selector, not a BIM model and not a source of
construction measurements.

## 2. Source map

| Path | Responsibility |
| --- | --- |
| `modules/projects/components/wizard/HouseModel3D.tsx` | 3D geometry, materials, camera, lighting, selection rendering, controls, and building-system drawer |
| `modules/projects/components/wizard/HouseModel3D.test.tsx` | Texture-path, drawer, full-stage, selection-label, group-selection, and select-all regression tests |
| `modules/projects/components/wizard/HouseExteriorSVG.tsx` | Accessible 2D fallback if WebGL cannot render |
| `modules/projects/components/wizard/Step1_VaelgOmraade.tsx` | Embeds the model in the exterior-area tab and connects it to the wizard store |
| `modules/projects/data/wizardCatalog.ts` | Canonical zone names, descriptions, highlight colors, and task mappings |
| `modules/projects/stores/wizardStore.ts` | Persists selected zones during project creation |
| `public/textures/house/` | Desktop PBR texture maps |
| `public/textures/house/mobile/` | Lightweight mobile PBR texture maps |
| `public/textures/house/README.md` | Texture provenance and CC0 licensing |

The relevant folder layout is:

```text
modules/projects/
├── components/wizard/
│   ├── HOUSE_MODEL_DESIGN_MANUAL.md
│   ├── HouseModel3D.tsx
│   ├── HouseModel3D.test.tsx
│   ├── HouseExteriorSVG.tsx
│   └── Step1_VaelgOmraade.tsx
├── data/
│   └── wizardCatalog.ts
└── stores/
    └── wizardStore.ts

public/textures/house/
├── README.md
├── *-diff.jpg
├── *-normal.jpg
├── *-rough.jpg
└── mobile/
    ├── *-diff.webp
    ├── *-normal.webp
    └── *-rough.webp
```

## 3. Runtime architecture

```text
Step1_VaelgOmraade
└── HouseModel3D
    ├── Canvas
    │   └── HouseScene
    │       ├── PartBox       selectable geometry
    │       ├── StaticBox     decorative geometry
    │       ├── Tree
    │       ├── Furniture
    │       ├── lights, fog, and shadows
    │       ├── "valgt" HTML marker
    │       └── OrbitControls
    ├── HouseSystemPanel
    ├── desktop information and controls
    ├── help overlay
    └── HouseExteriorSVG fallback
```

`HouseModel3D` receives:

```ts
interface HouseModel3DProps {
  selectedZoneIds: string[];
  onToggle: (zoneId: string) => void;
}
```

The parent owns selection state. The 3D component must remain controlled: it
may visualize and request a toggle, but it must not become a second source of
truth for selected zones.

## 4. Coordinate system and composition

The scene follows the normal Three.js coordinate system:

- `X`: left/right.
- `Y`: vertical.
- `Z`: depth.
- Positive `Z` faces the initial camera and is treated as the cutaway front.

The initial camera is:

```ts
position: [8.8, 6.2, 10.5]
fov: 38
near: 0.1
far: 60
```

The camera orbits around `[0.4, 1.3, 0]`.

The house is deliberately open toward the camera so users can see the ground
floor, first floor, basement, stairs, furniture, and structural layers at the
same time. Preserve this cutaway direction when adding walls or replacing
geometry.

Approximate scene proportions:

- Site plate: `11.5 × 0.38 × 8`.
- Main house floor plates: about `6.25 × 4.15`.
- Main building: basement, ground floor, first floor, and pitched roof.
- Garage/carport: positive `X`.
- Main garden/tree: negative `X`.
- Terrace and the open face: positive `Z`.

The values are visual scene units. They are internally consistent but must not
be presented as certified metres.

## 5. Geometry conventions

### Selectable geometry: `PartBox`

Use `PartBox` for every mesh that represents a project-selectable building
part.

Required properties:

```tsx
<PartBox
  zoneId="facade_stueetage"
  position={[x, y, z]}
  size={[width, height, depth]}
  selectedZoneIds={selectedZoneIds}
  onToggle={onToggle}
  onHover={onHover}
/>
```

`PartBox` provides:

- Click-versus-drag protection through `event.delta <= 4`.
- Hover state.
- Selection state derived from `selectedZoneIds`.
- Zone-specific selection color from `wizardCatalog.ts`.
- Blue selection edges.
- Emissive selected-state feedback.
- A click-point anchor for the temporary `valgt` marker.

Multiple meshes may share one `zoneId`. This is intentional. For example,
several walls together represent `facade_stueetage`.

### Decorative geometry: `StaticBox`

Use `StaticBox` only for non-selectable visual context such as furniture,
interior partitions, and the garage vehicle. It must not receive a zone ID or
selection handlers.

### Generated scene helpers

- `Tree` uses cylinder and icosahedron geometry.
- `Furniture` uses simple box geometry for the kitchen, living room,
  bedroom, workbench, and stairs.
- Roof pitch is calculated from `roofAngle` and `roofLength`.
- Rafters are generated from an array so spacing remains consistent.

When adding geometry, prefer a small data array mapped to `PartBox` or
`StaticBox` instead of copying large JSX blocks.

## 6. Canonical selection contract

Zone IDs are product data. They connect the visual selector to task
recommendations and must match `EXTERIOR_ZONES` in `wizardCatalog.ts`.

| Drawer group | Zone IDs |
| --- | --- |
| Tag | `tag_og_skorsten`, `loft_tagetage`, `solceller_energi` |
| Ydervægge | `facade_overetage`, `facade_stueetage` |
| Vinduer & Døre | `vinduer_overetage`, `vinduer_doere_stueetage` |
| Tilbygninger & Uderum | `altan_balkon`, `garage_carport`, `terrasse_udendoers` |
| Grund & Belægning | `indkoersel_belaegning`, `have_hegn` |
| Fundament | `fundament_sokkel` |
| Kælder | `kaelder_udvendig` |
| Installationer | `kloak_forsyning` |

Rules:

1. Do not rename a zone only in `HouseModel3D.tsx`.
2. A new zone must first be defined in `wizardCatalog.ts`, including its
   `tasksKey`.
3. Add the new zone to one `SYSTEM_GROUPS` entry.
4. Add selectable geometry using exactly the same ID.
5. Add a fallback position to `ZONE_NOTICE_POSITIONS`.
6. Update the SVG fallback if the zone must be selectable without WebGL.
7. Extend the tests before deployment.

## 7. Selection feedback

Selected parts use two simultaneous signals:

- The zone's catalog color is applied as an emissive accent.
- `Edges` changes to bright blue (`#60a5fa`).

When a part is newly selected, a small `valgt` label attaches to the actual
3D click point. If selection originates from the drawer, its position comes
from `ZONE_NOTICE_POSITIONS`.

Current timing:

- Fade-in delay: `20 ms`.
- Fade transition: `180 ms`.
- Total marker lifetime: `5,000 ms`.
- Fade-out begins `180 ms` before removal.

The marker is an `Html` sprite, so it faces the camera while remaining attached
to the selected 3D location.

## 8. Materials and texture system

Seven PBR material families are loaded:

| Surface | Source prefix | Repeat |
| --- | --- | --- |
| Roof | `grey_roof_tiles` | `2.5 × 2.5` |
| Brick facade | `white_bricks` | `3.2 × 1.8` |
| Timber | `wooden_planks` | `3 × 2` |
| Concrete | `concrete_floor` | `3 × 3` |
| Grass | `leafy_grass` | `5 × 4` |
| Soil | `dirt` | `4 × 3` |
| Driveway | `gravel_road` | `3 × 4` |

Each material family needs three maps:

- `*-diff`: diffuse/albedo color.
- `*-normal`: OpenGL normal map.
- `*-rough`: roughness map.

Material configuration:

- Textures use `RepeatWrapping`.
- Diffuse maps use `SRGBColorSpace`.
- Normal and roughness maps remain in linear color space.
- Texture anisotropy is `8`.
- Selectable surfaces use a normal scale of `0.42`.
- Static surfaces use a normal scale of `0.38`.

`buildHouseTexturePaths(import.meta.env.BASE_URL, profile)` must remain the
single path builder. Using `import.meta.env.BASE_URL` keeps texture loading
working when the app is hosted below a path prefix.

### Desktop and mobile profiles

Desktop loads 1K JPG maps from:

```text
public/textures/house/
```

Mobile loads 512 × 512 WebP maps from:

```text
public/textures/house/mobile/
```

Current approximate totals:

- Desktop texture folder: `14.8 MB`.
- Mobile texture set: `0.62 MB`.

The mobile profile is selected at a viewport width of `767 px` or less. Any new
texture family must include both desktop and mobile variants in the same
three-map structure.

The existing textures are from Poly Haven and licensed CC0. Preserve source
and license information in `public/textures/house/README.md`. Do not introduce
an asset unless the team has recorded its reuse rights.

## 9. Lighting and visual language

The intended look is a premium architectural cutaway on a deep blue-black
stage, with cool exterior illumination and warm interior light.

Core colors and effects:

- Stage and fog: `#06101a`.
- Background gradient: blue-black with a subtle radial glow.
- Cool ambient, hemisphere, and directional light.
- Warm point lights inside the house.
- Soft contact shadow below the model.
- Selected part: catalog accent, blue edge, subtle emissive glow.
- Panel: translucent dark navy with a restrained blue border.

The lighting toggle changes intensity; it does not swap the material set.

Avoid:

- Fully black unlit surfaces.
- Saturated selection fills that obscure the texture.
- Heavy bloom that reduces part boundaries.
- Texture tinting. Textured materials intentionally use white as their base
  color.

## 10. Camera and controls

`OrbitControls` is the only camera controller.

Shared constraints:

- Minimum distance: `8`.
- Maximum distance: `17`.
- Polar angle: `0.62` to `1.46`.
- Damping: enabled at `0.06`.
- Auto-rotation speed: `0.65`.

Desktop:

- Drag to rotate.
- Wheel/trackpad to zoom.
- Optional auto-rotate, reset, lighting, help, and full-screen controls.
- Panning is disabled by default.

Mobile:

- One finger rotates.
- Two-finger hold and drag pans horizontally and vertically.
- Pinch zooms.
- `screenSpacePanning` keeps two-finger movement intuitive.

Do not place pointer-active transparent elements over the mobile canvas. The
drawer wrapper is intentionally `pointer-events-none`; only the visible drawer
or its reopen button restores pointer events.

## 11. Responsive layout contract

The model must fill the complete wizard content area between the area tabs and
the fixed `Vælg opgaver` action.

This depends on all three layout layers:

```text
Step1 root:      h-full min-h-0 flex flex-col
Exterior panel:  min-h-0 flex-1 overflow-hidden
3D stage:        h-full min-h-0 overflow-hidden
Canvas area:     absolute inset-0
```

Do not reintroduce a fixed mobile canvas height or `overflow-y-auto` on the
exterior model panel. Either change recreates the empty scroll area previously
seen below the model.

Mobile drawer:

- Opens from the left.
- Maximum width: `min(88vw, 340px)`.
- Maximum height: `min(70dvh, 470px)`.
- When collapsed, the complete drawer moves off-screen.
- Only a `44 × 44 px` reopen button remains visible.
- Hidden contents are removed from keyboard navigation.

Desktop/tablet panel:

- Positioned at the upper right of the 3D stage.
- Width: `292 px`.
- Maximum height: `470 px`.
- Remains visible rather than becoming a drawer.

Rendering resolution:

- Mobile DPR: `1` to `1.25`.
- Desktop DPR: `1` to `1.65`.

These limits protect mobile memory and GPU fill rate. Raise them only after
testing older Android devices and Safari on iPhone.

## 12. Accessibility and fallback

Accessibility requirements:

- Drawer buttons keep Danish `aria-label` values.
- Drawer state uses `aria-expanded`, `aria-controls`, and `aria-hidden`.
- Hidden drawer controls must have `tabIndex={-1}`.
- Selection status is exposed through an `aria-live` region.
- Hover information is also available to screen readers.
- Icon-only controls require `aria-label` and `title`.

`WebGlBoundary` catches render failures and shows `HouseExteriorSVG`. The
fallback still has to support zone selection. Do not remove it when replacing
or refactoring the 3D implementation.

## 13. How to extend the model safely

### Add geometry to an existing selectable zone

1. Find the correct canonical zone ID.
2. Add a `PartBox` in `HouseScene`.
3. Reuse the existing zone ID.
4. Keep the cutaway front visible.
5. Check selection from both the mesh and drawer.
6. Test at mobile and desktop camera distances.

### Add a new selectable zone

1. Add the zone and task mapping in `wizardCatalog.ts`.
2. Add it to `SYSTEM_GROUPS`.
3. Add one or more `PartBox` meshes.
4. Add a `ZONE_NOTICE_POSITIONS` fallback.
5. Update the SVG fallback.
6. Add group and select-all test coverage.
7. Confirm step 3 of the wizard receives the expected task category.

### Add or replace a texture

1. Obtain diffuse, OpenGL normal, and roughness maps.
2. Record the source and license.
3. Add desktop JPG files using the established suffixes.
4. Generate matching 512 × 512 mobile WebP files.
5. Extend `buildHouseTexturePaths`.
6. Add repeat values in `useHouseMaterials`.
7. Expose the three maps through one `SurfaceMaps` object.
8. Add texture-path tests for both profiles.
9. Compare mobile transfer size before merging.

### Replace procedural geometry with a GLTF model

A future GLTF migration is possible, but preserve the public component
contract. Each selectable mesh must map back to one canonical zone ID, either
through stable mesh names or explicit `userData`.

Migration guardrails:

- Keep `selectedZoneIds` and `onToggle`.
- Keep drawer-to-zone behavior.
- Keep the SVG fallback.
- Keep the mobile texture and geometry budget.
- Keep the cutaway view and initial camera composition.
- Keep click-versus-drag filtering.
- Keep the attached selection marker.
- Prefer Meshopt or Draco compression and test decoder loading in production.

Do not migrate only for visual fidelity. Confirm that the new asset preserves
selection reliability, accessibility, mobile performance, and licensing.

## 14. Performance guardrails

Current mobile texture transfer is approximately `0.62 MB`. Treat `0.75 MB` as
the preferred upper limit unless a measured visual improvement justifies more.

Before adding detail:

- Prefer reused geometry and material instances.
- Avoid high-segment cylinders and spheres for background objects.
- Do not add 4K textures.
- Keep decorative objects non-interactive.
- Test GPU memory after several route changes.
- Confirm texture objects are reused rather than recreated per mesh.
- Keep mobile DPR capped at `1.25`.

If mobile rendering becomes unstable, investigate in this order:

1. Texture dimensions and total transfer.
2. Device pixel ratio.
3. Shadow-map resolution.
4. Antialiasing.
5. Mesh count and draw calls.
6. Transparent overlapping surfaces.

## 15. Known limitations

- Geometry is intentionally simplified and mostly box-based.
- Repeated textures can change apparent scale between differently sized boxes.
- The model has no authored UV unwrap.
- The full texture set loads when the 3D scene mounts.
- Camera position is not persisted between visits.
- The front cutaway is a composition technique, not a physically complete
  building envelope.
- The SVG fallback is schematic and will not match every future 3D detail
  automatically.

These limitations are acceptable for the current selector. Treat a change as a
product improvement only if it improves the selection experience without
making mobile use less reliable.

## 16. Required validation

Run these checks after changing the model:

```powershell
npx vitest run modules/projects/components/wizard/HouseModel3D.test.tsx
npx eslint modules/projects/components/wizard/HouseModel3D.tsx modules/projects/components/wizard/HouseModel3D.test.tsx modules/projects/components/wizard/Step1_VaelgOmraade.tsx
npx tsc --noEmit
npm run build
```

Manual viewport matrix:

| Viewport | Required checks |
| --- | --- |
| Small mobile, about `390 × 844` | Model fills available height; drawer fully disappears; reopen button works; one-finger rotate; two-finger pan; pinch zoom |
| Large mobile, about `430 × 932` | No empty scroll region; CTA remains reachable; selection marker stays attached |
| Tablet, about `768 × 1024` | Panel is visible on the right; model does not go behind app navigation; controls do not overlap |
| Desktop, `1440 px` or wider | Cutaway composition, hover card, lighting, reset, auto-rotate, full screen, and panel scrolling |

Selection regression checklist:

- Select and deselect every individual visible part.
- Select and deselect every drawer group.
- Run `Vælg alle` and `Fravælg alle`.
- Verify partial group state.
- Verify the `valgt` marker appears only when selecting.
- Verify dragging the model does not select a part.
- Verify the SVG fallback still toggles zones.

## 17. Definition of done for future house work

A house-model change is ready only when:

- The reference composition is visibly improved or preserved.
- All canonical zone IDs still work.
- Mobile gestures work over the full canvas.
- The collapsed drawer leaves only its reopen button.
- The model fills the complete available stage without page-level empty
  scrolling.
- Texture loading stays within the mobile budget.
- The WebGL fallback remains usable.
- Focus, labels, and drawer state remain accessible.
- Tests, lint, typecheck, and production build pass.
- Texture licensing has been recorded.

