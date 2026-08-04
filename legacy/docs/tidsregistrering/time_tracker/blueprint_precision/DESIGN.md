---
name: Blueprint Precision
colors:
  surface: '#f8f9fb'
  surface-dim: '#d9dadc'
  surface-bright: '#f8f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f6'
  surface-container: '#edeef0'
  surface-container-high: '#e7e8ea'
  surface-container-highest: '#e1e2e4'
  on-surface: '#191c1e'
  on-surface-variant: '#434654'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f3'
  outline: '#737685'
  outline-variant: '#c3c6d6'
  surface-tint: '#0c56d0'
  primary: '#003d9b'
  on-primary: '#ffffff'
  primary-container: '#0052cc'
  on-primary-container: '#c4d2ff'
  inverse-primary: '#b2c5ff'
  secondary: '#4c5e85'
  on-secondary: '#ffffff'
  secondary-container: '#bfd1ff'
  on-secondary-container: '#485980'
  tertiary: '#004e32'
  on-tertiary: '#ffffff'
  tertiary-container: '#006844'
  on-tertiary-container: '#72e9af'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2ff'
  primary-fixed-dim: '#b2c5ff'
  on-primary-fixed: '#001848'
  on-primary-fixed-variant: '#0040a2'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#b4c6f3'
  on-secondary-fixed: '#051a3e'
  on-secondary-fixed-variant: '#35466c'
  tertiary-fixed: '#82f9be'
  tertiary-fixed-dim: '#65dca4'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005235'
  background: '#f8f9fb'
  on-background: '#191c1e'
  surface-variant: '#e1e2e4'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-bold:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 64px
---

## Brand & Style

The design system is engineered for the high-stakes environment of construction management. It prioritizes utility, clarity, and structural integrity. The aesthetic is **Corporate Modern**, leaning into a "utilitarian premium" feel—where every pixel serves a functional purpose. 

The target audience consists of project managers, site foremen, and skilled tradespeople who require information at a glance, often in high-glare or high-activity environments. The emotional response should be one of reliability and control. The UI utilizes a generous use of white space to prevent information overload, paired with high-contrast elements that ensure legibility and a sense of "built-to-last" quality.

## Colors

The palette is anchored by **Primary Blue**, a color associated with engineering and architectural precision. 

- **Primary Blue (#0052CC):** Used for primary actions, progress indicators, and key branding moments.
- **Secondary / Text Dark (#091E42):** A deep navy used for headlines and primary body text to ensure maximum contrast against the white background.
- **Success Green (#36B37E):** Utilized for "on-track" status, completion markers, and safety approvals.
- **Surface Gray (#F4F5F7):** A cool neutral used to differentiate background sections, card containers, and disabled states without adding visual noise.

White (#FFFFFF) is the structural foundation for all page backgrounds to maintain a clean, professional workspace.

## Typography

This design system uses **Inter** exclusively to leverage its exceptional legibility and systematic weight distribution. 

Headlines use a bold weight and slightly tighter letter spacing to create a "dense" and authoritative feel. Body text is set with generous line heights to facilitate reading long technical descriptions or site notes. For mobile environments, headline sizes scale down to maintain hierarchy without forcing excessive scrolling. Labels and status chips use semi-bold weights to remain legible even at smaller scale.

## Layout & Spacing

The design system employs a **Fluid Grid** model with strict 4px increments (the "base unit"). 

- **Desktop:** 12-column grid with 24px gutters. Max content width is 1280px.
- **Tablet:** 8-column grid with 20px gutters.
- **Mobile:** 4-column grid with 16px gutters and 16px side margins.

Spacing is used to group related technical data. Large "xl" spacing (32px+) is reserved for separating major sections (e.g., Project Overview from Site Logs). Small "sm/md" spacing (8-16px) is used within components like cards and form groups to maintain a compact, information-rich environment.

## Elevation & Depth

Depth in this design system is primarily communicated through **Tonal Layers** and **Low-Contrast Outlines** rather than heavy shadows. This reinforces the "flat and functional" construction aesthetic.

1.  **Level 0 (Base):** White (#FFFFFF) background.
2.  **Level 1 (Containers):** Surface Gray (#F4F5F7) used for background sections to create grouping.
3.  **Level 2 (Cards/Interactives):** White surfaces with a 1px solid border (#DFE1E6). 
4.  **Level 3 (Popovers/Modals):** Subtle ambient shadows (0px 4px 12px rgba(9, 30, 66, 0.08)) are used only when an element sits physically above the main workspace to provide focus.

Avoid using shadows on standard buttons or cards; use border-color changes or subtle background shifts for hover states instead.

## Shapes

The design system utilizes **Soft (0.25rem)** corners. This subtle rounding provides a modern feel while maintaining a sense of structural rigidity and "architectural" precision. 

- **Standard Elements:** (Inputs, Buttons, Cards) use 4px (0.25rem) radius.
- **Large Components:** (Modals, Feature Sections) use 8px (0.5rem) radius.
- **Tags/Status Chips:** Can use 16px (1rem) pill shapes to distinguish them from actionable buttons.

## Components

### Buttons
- **Primary:** Solid Primary Blue background, white text. No shadow. 4px radius.
- **Secondary:** Transparent background, 1px Primary Blue border, Primary Blue text.
- **Size:** Minimum 48px height for all primary touch targets to accommodate site workers.

### Input Fields
- White background with a 1px solid border (#DFE1E6).
- On focus: Border changes to Primary Blue with a 2px thickness.
- Labels are always visible above the field in Label-Bold typography.

### Cards
- White background, 1px border (#DFE1E6). 
- Use Surface Gray (#F4F5F7) for header areas of cards to distinguish "meta-data" from "content."

### Status Chips
- Small, compact containers with 500-weight text.
- Use Success Green for "Completed," Primary Blue for "In Progress," and a Neutral Gray for "Pending."

### Lists
- High-density rows with 1px bottom borders. 
- Use chevron icons (8px) on the right to indicate drill-down capability.