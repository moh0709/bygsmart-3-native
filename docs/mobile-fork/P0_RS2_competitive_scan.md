# P0 · RS-2 — Competitive Scan

**Task:** RS-2 from PRD §2.2 — test the unexamined assumption behind the D-13 commerce model ("who buys and why they would switch").
**Status:** P0 research spike.
**Date compiled:** 2026-08-04. All "accessed" dates below are 2026-08-04 unless noted.
**Method:** Web search + page fetch. Facts are cited inline. Anything not verifiable from public sources is labelled **[GAP]**, not guessed.

> **Bottom line up front.** The buyers BygSmart 3.0 competes against do **not** sell the way D-13 assumes. Every serious field competitor in the Danish market is either (a) sales-led/quote-only at the org level (Dalux paid tiers, Ajour/EG, LetsBuild, Procore, Autodesk) or (b) self-serve but priced per administrative seat with a human onboarding motion (Minuba). None of them competes on payment-rail economics, and there is **no evidence a construction buyer has ever switched field tools because a marketplace took 0 % vs 15–30 % commission.** The 0 %-commission web marketplace is real margin for BygSmart, but it is almost certainly *not* the reason a Danish crew or PM would switch. Switching in this market is driven by offline reliability, BIM/drawing gravity, the general contractor's mandate, and da-DK fit. That is where the differentiation case has to be won.

---

## 1. Per-competitor findings

### Dalux (Dalux Field) — the incumbent to beat in DK
- **Origin / market:** Danish company; ~USD 100M revenue in 2024; claims Europe's largest BIM user base; adoption strongest in UK, Ireland, Germany, Poland and the Nordics. Denmark mandates BIM on public projects ≥ €2M since 2013, and larger Danish contractors' projects are ~90 % BIM — a tailwind Dalux rides directly. [aec-business.com, accessed 2026-08-04] [theconstructionindex.co.uk, accessed 2026-08-04]
- **Platforms / offline:** Native iOS + Android + web viewer. Offline is a headline strength — the viewer and field data capture work offline; marketing explicitly cites "working in a basement." Strong on-site 3D/BIM viewing on phones and tablets. [dalux.com/products/dalux-field, accessed 2026-08-04] [softwarefinder.com, accessed 2026-08-04]
- **Primary user / features:** Whole project team — contractors, subs, owners, architects, site managers, safety inspectors. Core: BIM/model viewing, site tasks, inspection plans, snagging/defects, handover, SiteWalk (360° helmet-cam auto-mapped to 3D). [dalux.com, accessed 2026-08-04]
- **Commercial model:** **Freemium → sales-led.** "Dalux Field Basic" is genuinely free (unlimited tasks, 3D upload). Paid tiers (Field Standard, Field Pro) add inspection plans and are **quote-based, tailored to company size — no public per-seat price.** [dalux.com/products/dalux-field-basic, accessed 2026-08-04] [capterra.com/p/154695, accessed 2026-08-04]
- **Strength:** BIM/model gravity + strong offline + free entry tier + deep DK public-sector penetration. **Gap vs. an offline-first field tool:** it is model-centric and heavy; a gloves-on, 2-taps-to-photo-proof crew flow is not its centre of gravity. Complexity/onboarding is the soft underbelly.

### Ajour System (EG Ajour) — the DK quality-assurance/KS incumbent
- **Origin / market:** Danish; now part of EG (Nordic B2B software group). Squarely targets the Danish bygge- og ejendomsbranche for kvalitetsstyring (KS), mangelgennemgang, tilsyn, dokumenthåndtering. da-DK native. [ajoursystem.com, accessed 2026-08-04] [installator.dk, accessed 2026-08-04]
- **Platforms / offline:** Native iOS app (+ AjourBox for documents) and web. **Offline supported** — "you can work offline and have access even with poor coverage." [App Store DK listing, accessed 2026-08-04] [ajoursystem.com/produkter/ajourinspect, accessed 2026-08-04]
- **Primary user / features:** PM / inspector / office-leaning. AjourInspect: inspection notes, safety notes, defect review, building condition reports; plus drawing management, bidding, handover. Strong on the KS/handover paperwork the Danish market legally cares about.
- **Commercial model:** **Sales-led, fixed monthly price with "full transparency" claimed, but no public price list.** Quote via EG. [ajoursystem.com, accessed 2026-08-04] **[GAP: no published per-seat / per-project figure.]**
- **Strength:** Deep fit with Danish KS/handover compliance culture and EG's enterprise distribution. **Gap:** office/inspector-centric, not a fast one-thumb field-crew capture tool; UX is compliance-forms-first.

### Minuba — the DK håndværker (SMB trades) suite
- **Origin / market:** Danish, aimed at håndværkere / small trade firms (ordrestyring, hours, materials, invoicing, KS). Distributed partly via wholesalers (e.g. AO's "Minuba Go"). da-DK native. [minuba.dk, accessed 2026-08-04]
- **Platforms / offline:** Native app (iOS/Android) + web for order management on phone/tablet. **Offline capability: [GAP] — not documented on the pricing or feature pages; offline is not marketed, suggesting it is weak or absent for field docs.** [minuba.dk/pris, accessed 2026-08-04]
- **Primary user / features:** Field trades + owner/office. Order management, time & materials registration, documentation, digital KS. It is an **ERP-lite / order-to-invoice** tool more than a pure field-docs tool.
- **Commercial model:** **Self-serve-ish but sales-assisted, published per-seat DKK pricing.** Free tier "Minuba GO!" (max 2 admin users). Minuba Plus: administrative user **279 DKK/mo**, limited user **189 DKK/mo**, resource user **119 DKK/mo**, resource **29 DKK/mo**; unlimited users. One-time onboarding packages 0–10,995 DKK. Motion emphasises "Book møde" + startup consultants — **not pure self-checkout.** [minuba.dk/pris, accessed 2026-08-04]
- **Strength:** Closest thing to transparent SMB pricing + trade-firm workflow (invoice-out is the killer feature for a 5-person firm). **Gap:** office/invoicing gravity; offline field-first not its story; not BIM/drawing-centric.

### Fieldwire (by Hilti) — the global field-first tool
- **Origin / market:** US, owned by Hilti. Global; field-crew-first positioning. da-DK localisation **[GAP: not confirmed; UI is multi-language but Danish specifically unverified].**
- **Platforms / offline:** Native iOS + Android + web. **Offline is a core feature** — view/add annotations, markups, hyperlinks offline; syncs on reconnect across all devices/users. [buildbite.com, accessed 2026-08-04] [projul.com, accessed 2026-08-04]
- **Primary user / features:** Field crews + foremen. Plans/drawings, task management, punch lists, markups, reporting. Genuinely field-worker-centric.
- **Commercial model:** **Self-serve per-seat with a free tier — the closest analogue to a self-serve model.** Free plan exists; paid Pro/Business/Business Plus roughly **$54 / $74 / $104 per user/month** (reports vary; annual billing cheaper, offline access gated to paid tiers). Enterprise = custom/sales. [capterra.com/p/142801, accessed 2026-08-04] [projul.com, accessed 2026-08-04]
- **Strength:** Field-first UX + offline + transparent per-seat + free entry — the model most like a self-serve marketplace. **Gap:** not Danish-native; no KS/handover-compliance or Danish economy/invoicing fit; Hilti-tool-ecosystem bias.

### Autodesk Build (now "Forma Build") — the enterprise BIM stack
- **Origin / market:** US (Autodesk). Rebranded from Autodesk Construction Cloud to Autodesk Forma in March 2026. Enterprise/large-contractor focus. [g2.com, accessed 2026-08-04] [softwareconnect.com, accessed 2026-08-04]
- **Platforms / offline:** Native mobile app + web. **Offline is a noted weakness** — "restricted offline access" listed as a limitation. [g2.com, accessed 2026-08-04]
- **Primary user / features:** PM / office / BIM coordinators; field via mobile app. Docs, sheets, RFIs, issues, model coordination.
- **Commercial model:** **Sales-led / per-user list + account-based bundles.** List ~$1,680/user/yr for unlimited sheets; lower tiers from ~$700/yr scaled by drawing quota; large contractors negotiate flat account agreements. [g2.com, accessed 2026-08-04] [contractorsandbuilders.com, accessed 2026-08-04]
- **Strength:** BIM authority + enterprise data gravity. **Gap:** weak offline, heavy, expensive, office-centric — poor fit for a Danish SMB crew on a dead-signal site.

### Procore — the enterprise GC platform
- **Origin / market:** US. Large GC / enterprise. DK-specific presence **[GAP: not confirmed in sources].**
- **Platforms / offline:** Native iOS + Android + web; offline supported in the field app (general knowledge; not the focus of sources found).
- **Primary user / features:** GC/PM/office, unlimited users. Full project management, financials, quality/safety, drawings.
- **Commercial model:** **Sales-led, priced on Annual Construction Volume (ACV), unlimited users.** Typical **$15k–30k/yr small GC ($10–50M ACV), $30k–80k/yr mid-size**; ~0.1–0.3 % of ACV. No self-serve, no per-seat. [scanmanifold.com, accessed 2026-08-04] [procore.com/pricing, accessed 2026-08-04]
- **Strength:** Breadth + unlimited-user economics for big GCs. **Gap:** enterprise-only pricing and complexity — irrelevant to a 1–15-person Danish firm (BygSmart's "Søren"). Not a same-segment competitor for the SMB field buyer.

### Also-rans / adjacent (lighter scan)
- **LetsBuild (GenieBelt + APROPLAN):** Copenhagen + Brussels merger (2019). LB Aproplan = site inspections/defects/QHSE with **offline usage**, mobile + web; LB Geniebelt = scheduling, web-only. **Sales-led, "contact us" pricing** (tiers reportedly ~$35–59). Danish roots via GenieBelt. [trustradius.com/products/letsbuild, accessed 2026-08-04] [letsbuild.com/pricing, accessed 2026-08-04]
- **Sablono:** Progress/workflow-centric; added an **offline mode** in its 3.0 mobile app. Enterprise/large-project focus; not DK-specific. [sablono.com/en/blog/offline-mode, accessed 2026-08-04]
- **Fonn:** Norwegian, mobile-first field tool, **built to work without connectivity**, positioned as lower-cost/easier than PM tools. Nordic-adjacent but not DK-native. [fonn.com, accessed 2026-08-04] [softwareadvice.com, accessed 2026-08-04]
- **Archdesk:** Broad ERP-style platform (estimating, scheduling, cost control, procurement, payments) — office/back-office gravity, not a field-first offline tool. [archdesk.com, accessed 2026-08-04]

---

## 2. Comparison table

| Product | Native iOS/Android | Web/PWA | Offline strength | Primary user | DK / da-DK fit | Commercial model | Public per-seat price? |
|---|---|---|---|---|---|---|---|
| **Dalux Field** | Yes | Web viewer | **Strong** ("basement") | Whole team, BIM-led | **Native DK, deep public-sector** | Freemium → **sales-led** paid | No (quote) |
| **Ajour (EG)** | Yes (+AjourBox) | Yes | **Yes**, "poor coverage" | PM / inspector / office | **Native DK KS/handover** | **Sales-led**, fixed monthly | No (quote) |
| **Minuba** | Yes | Yes | **[GAP] not marketed** | Trades SMB + office | **Native DK trades** | Self-serve + sales assist | **Yes** (279/189/119/29 DKK) |
| **Fieldwire (Hilti)** | Yes | Yes | **Strong** (paid tiers) | **Field crew / foreman** | **[GAP]** da-DK unconfirmed | **Self-serve per-seat** + free | **Yes** (~$54–104/user) |
| **Autodesk Build/Forma** | Yes | Yes | **Weak** (restricted) | PM / BIM / office | Multi-lang; not DK-specific | Sales-led + account bundles | ~$700–1,680/user/yr |
| **Procore** | Yes | Yes | Yes | GC / PM / office | **[GAP]** DK presence | **Sales-led, ACV-based** | No (ACV, $15k–80k/yr) |
| **LetsBuild** | Aproplan yes | Yes | Yes (Aproplan) | Inspection / PM | DK roots (GenieBelt) | Sales-led "contact us" | No |
| **Fonn** | Yes | Yes | **Yes** (offline-built) | Field crew | Nordic, not DK-native | **[GAP]** | **[GAP]** |
| **Sablono** | Yes | Yes | Yes (3.0) | Progress/workflow | Not DK-specific | Sales-led | **[GAP]** |
| **Archdesk** | Mobile | Yes | **[GAP]** | Office/back-office | Not DK-specific | Sales-led | **[GAP]** |
| **BygSmart 3.0 (thesis)** | **Yes, universal** | **Yes (PWA + commerce)** | **Offline-first (14d native)** | **Field crew first** | **Native da-DK** | **PWA self-serve, 0 % commission** | Own pricing |

---

## 3. Where BygSmart's thesis is genuinely differentiated vs. already-served

**Already served (do not claim as differentiation):**
- **Offline field capture per se.** Dalux, Ajour, Fieldwire, LetsBuild/Aproplan, Fonn and Sablono all ship offline modes. "We work offline" is table stakes in this category, not a wedge. The honest differentiator is *degree and honesty of offline*, not its existence.
- **Native mobile + web.** Everyone has native iOS/Android and a web surface.
- **Punch lists / quality / handover.** Directly served by Dalux, Ajour (the DK KS incumbent), LetsBuild, Sablono.

**Genuinely differentiated (defensible wedges):**
1. **Offline-first as a hard contract, not a mode.** Competitors treat offline as a feature that degrades gracefully. BygSmart's P3 ("the app never lies about state" — pending/syncing/synced/failed always visible; refuses work it cannot durably hold) + P0 A-06 (14-day native / 72-hour web grace) is a *stronger, auditable* offline posture than "works in a basement." No competitor markets state-honesty as a principle. This is real, but must be **proven in RS-1 ride-alongs** to be credible.
2. **Gloves-on, 2-taps-to-proof, camera-first (P2/P6).** Dalux and Autodesk are BIM/model-first; Ajour and Minuba are forms/invoice-first; Fieldwire is plans-first. **No incumbent's centre of gravity is "photograph work as proof against a task in ≤2 taps from cold start."** This is the clearest unoccupied position — the crew-capture speed lane.
3. **One universal codebase, three shapes, with deliberate scope refusal (P5/P7).** Competitors bolt a phone app onto an office platform (Autodesk, Procore, Archdesk, Minuba) or a model viewer onto BIM (Dalux). BygSmart's "the field, not the office — office flows live in back-office" is a product-shape bet none of them make; they all drag office weight onto the phone.
4. **da-DK native + SMB fit + modern field UX, together.** Dalux and Ajour are DK-native but heavy/compliance- or BIM-led; Fieldwire/Fonn are field-modern but not DK-native. **The intersection — Danish-native AND field-crew-modern AND SMB-priced — is thinly occupied.** Minuba is the nearest neighbour but is invoice/ERP-led with unproven offline.

**Weakest part of the thesis:** "one universal app" as a *buyer-facing* benefit. Buyers do not purchase "universal codebase"; they buy outcomes. Universality is an engineering/margin advantage (and a real one), not a switching driver. Do not lead marketing with it.

---

## 4. Read on the D-13 commerce assumption

**D-13 assumes:** selling on the web surface at **0 % commission** (vs. store 15–30 %) is a meaningful advantage, implying buyers care about, or switch because of, marketplace economics.

**What the scan shows:**
- **Nobody in this market sells field tools through an app-store in-app-purchase marketplace to begin with.** Dalux, Ajour, Autodesk, Procore, LetsBuild are **sales-led/quote-based**; Minuba and Fieldwire are **web self-serve per-seat**. The "30 % Apple tax" that D-13 routes around is a problem **none of the competitors even have** — they already bill on the web/by invoice. So the 0 %-commission framing is a margin win **for BygSmart's own P&L**, not a competitive differentiator the buyer will perceive.
- **The real commercial split in the market is sales-led (enterprise/GC: Dalux paid, Autodesk, Procore, Ajour, LetsBuild) vs. self-serve-per-seat (SMB: Fieldwire, Minuba, Dalux free tier).** BygSmart's "PWA self-serve marketplace" lands correctly on the **self-serve SMB side** — that is the right *motion* for "Søren" the 1–15-person owner. That validation is genuine: SMB construction buyers **do** buy software self-serve (Minuba and Fieldwire prove it) with light human onboarding.
- **But switching is not driven by commission or checkout mechanics.** The evident switching drivers in this market are: (a) **the general contractor's mandate** — if the GC runs Dalux/Ajour on the project, subs use it; this is top-down, not self-serve; (b) **BIM/drawing gravity** on public and large projects; (c) **offline reliability** on real sites; (d) **da-DK + KS/handover compliance fit**; (e) **invoice-out / economy integration** for trade firms (Minuba's wedge). Payment-rail economics appears **nowhere** as a switching reason.

**Verdict on D-13:** The *mechanism* (web self-serve, avoid store rules, 0 % commission) is **sound and defensible for margin and for App Store compliance** — and the self-serve SMB motion is validated by Minuba/Fieldwire. **But the underlying assumption that "0 % commission web marketplace" is a *reason to switch* is not supported.** It is a cost structure, not a value proposition. **The buyer switches for offline trust, crew speed, da-DK fit, and — critically — because someone above them (the GC) or the org owner decided to.** D-13 should be re-framed internally: "0 % commission" is how we *keep margin and stay App-Store-legal," not "why customers choose us." The acquisition thesis still needs a demand-side answer that RS-1 must supply.

**Confidence:** Medium-high on the "nobody switches on commission" conclusion (strongly implied by the uniform absence of IAP-marketplace selling across all 10 competitors). **[GAP: no primary buyer interviews]** — RS-1 ride-alongs / buyer conversations are still required to confirm the *positive* switching drivers rather than inferring them.

---

## 5. Risks / threats and scope implications

**Threats (ranked):**
1. **Dalux is the structural threat, not a feature threat.** It is Danish, well-funded (~$100M rev), has a genuinely free tier, strong offline, and — decisively — **top-down distribution**: it enters via the GC/public-project BIM mandate and pulls every sub onto it for free. BygSmart cannot out-BIM Dalux and should not try; the risk is Dalux's free tier + GC mandate makes BygSmart redundant on any project Dalux already owns.
2. **Ajour/EG owns the DK KS/handover compliance relationship** — the paperwork Danish law and clients actually demand. If BygSmart's quality/handover module is weaker than Ajour on Danish KS conventions, the compliance buyer stays with Ajour.
3. **Minuba owns the SMB trade-firm wallet via invoice-out.** For "Søren," the day-to-day economic hook is order→hours→materials→invoice. BygSmart deliberately pushes economy to back-office (P5) — but if the field app doesn't at least feed that loop, Minuba's integrated order-to-invoice is stickier than field docs alone.
4. **Fieldwire is the proof that a field-first self-serve model works** — and Hilti has the balance sheet to localise to da-DK at any time. Today's da-DK gap is a moat that could close.

**Scope implications for the launch set:**
- **Do not compete on BIM/model viewing** against Dalux/Autodesk in the launch scope — it's their gravity well and it's expensive. Reinforce the offline-crew-capture lane instead.
- **Offline honesty (P3) must be demonstrably better, not merely present** — it is the one wedge no competitor markets. Make sync-state visibility a *demoable* launch differentiator, not internal plumbing.
- **da-DK KS/handover quality module must be at parity with Ajour conventions** or the compliance buyer won't switch — prioritise the quality/handover module's Danish-standard fit in launch.
- **The commerce narrative should be repositioned** from "0 % commission marketplace" (a margin story) to "self-serve in minutes, priced for a Danish SMB, no sales call" — that is the motion Minuba/Fieldwire validate and the one that actually competes with sales-led incumbents' friction.
- **GC-mandate / top-down distribution is the real go-to-market question RS-1/GTM must answer** — because every enterprise competitor wins that way and BygSmart's self-serve motion is bottom-up. A bottom-up SMB tool can be locked out of any project a GC has standardised on Dalux/Procore.

---

## 6. Gaps to close (labelled, not guessed)
- **[GAP]** Dalux / Ajour / LetsBuild / Autodesk enterprise: no public per-seat price — all quote-based.
- **[GAP]** Minuba offline capability for field docs — not documented; likely weak/absent, unverified.
- **[GAP]** Fieldwire and Fonn da-DK localisation — unconfirmed.
- **[GAP]** Procore's actual footprint among Danish SMBs — unconfirmed (likely negligible at BygSmart's segment, but not verified).
- **[GAP]** No primary buyer research — *why* Danish crews/PMs/owners actually switch is inferred from market structure, not interviewed. **This is exactly RS-1's job; RS-2 can narrow but not close it.**

---

## Sources
- Dalux Field product & Basic (free) tier — https://www.dalux.com/products/dalux-field/ , https://www.dalux.com/products/dalux-field-basic/ (accessed 2026-08-04)
- Dalux Field pricing/features — https://softwarefinder.com/construction/dalux-field , https://www.capterra.com/p/154695/Dalux-Field/ (accessed 2026-08-04)
- Dalux revenue / European adoption / offline / DK BIM mandate — https://aec-business.com/dalux-reports-100-million-revenue-milestone-and-widespread-european-adoption/ , https://www.theconstructionindex.co.uk/news/view/sitewalk-propels-dalux-to-european-bim-leadership (accessed 2026-08-04)
- Ajour / EG Ajour — https://ajoursystem.com/ , https://ajoursystem.com/produkter/ajourinspect/ , https://apps.apple.com/dk/app/ajour-system-a-s/id1496345964 , https://www.installator.dk/arkitektbranchen-bruger-ajour-system-til-digital-ks-og-dokumenth%C3%A5ndtering (accessed 2026-08-04)
- Minuba pricing (DKK) & features — https://minuba.dk/pris/ , https://minuba.dk/funktioner/ordrestyring-app-til-haandvaerkere/ , https://minuba.dk/support/brugere/ (accessed 2026-08-04)
- Fieldwire pricing & offline — https://www.capterra.com/p/142801/Fieldwire/ , https://projul.com/blog/fieldwire-pricing-breakdown/ , https://buildbite.com/insights/fieldwire-pricing-review (accessed 2026-08-04)
- Autodesk Build/Forma pricing & offline limitation & rebrand — https://www.g2.com/products/autodesk-construction-cloud/pricing , https://softwareconnect.com/reviews/autodesk-build/ , https://contractorsandbuilders.com/pricing/autodesk-acc/ (accessed 2026-08-04)
- Procore ACV pricing model — https://www.procore.com/pricing , https://www.scanmanifold.com/blog-posts/procore-pricing-2026-contractors , https://projul.com/blog/procore-pricing-analysis-2026/ (accessed 2026-08-04)
- LetsBuild (GenieBelt + APROPLAN) — https://www.trustradius.com/products/letsbuild/pricing , https://www.letsbuild.com/pricing (accessed 2026-08-04)
- Sablono offline mode — https://www.sablono.com/en/blog/offline-mode (accessed 2026-08-04)
- Fonn — https://fonn.com/ , https://www.softwareadvice.com/construction/fonn-construction-profile/ (accessed 2026-08-04)
- Archdesk — https://archdesk.com/ (accessed 2026-08-04)
