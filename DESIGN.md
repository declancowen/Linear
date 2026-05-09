---
version: "alpha"
name: "Linear Workspace App"
description: "Compact project workspace interface for issue tracking, projects, documents, chat, and collaboration. Built around precise neutral surfaces, small controls, status metadata, and configurable low-volume color."
colors:
  background: "#fdfdfd"
  foreground: "#121212"
  card: "#ffffff"
  surface: "#ffffff"
  surface-2: "#fafafa"
  surface-3: "#f3f3f3"
  bg-sunken: "#f7f7f7"
  line: "#e6e6e6"
  line-soft: "#f0f0f0"
  text-2: "#4d4d4d"
  text-3: "#7a7a7a"
  text-4: "#9e9e9e"
  primary: "#1a1a1a"
  primary-foreground: "#fafafa"
  accent: "#f5f5f5"
  accent-foreground: "#171717"
  accent-bg: "#ebf2ff"
  accent-fg: "#14359b"
  focus-ring: "#a1a1a1"
  template-focus: "#537feb"
  destructive: "#e7000b"
  dark-background: "#0c0c0c"
  dark-foreground: "#f5f5f5"
  dark-surface: "#131313"
  dark-surface-2: "#171717"
  dark-surface-3: "#1e1e1e"
  dark-bg-sunken: "#080808"
  dark-line: "#2a2a2a"
  dark-line-soft: "#202020"
  dark-text-2: "#aeaeae"
  dark-text-3: "#808080"
  dark-text-4: "#5d5d5d"
  dark-accent: "#2e2e2e"
  dark-accent-foreground: "#fafafa"
  dark-accent-bg: "#1d2842"
  dark-accent-fg: "#98b7f8"
  dark-focus-ring: "#737373"
  workspace-accent-emerald: "#10b981"
  workspace-accent-blue: "#3b82f6"
  workspace-accent-violet: "#8b5cf6"
  workspace-accent-amber: "#f59e0b"
  workspace-accent-rose: "#f43f5e"
  workspace-accent-slate: "#64748b"
  status-backlog: "#9e9e9e"
  status-todo: "#6da3da"
  status-doing: "#c99f00"
  status-review: "#b679e1"
  status-done: "#32b36e"
  status-cancelled: "#e94740"
  priority-urgent: "#e62c2c"
  priority-high: "#f07900"
  priority-medium: "#c2a140"
  priority-low: "#9e9e9e"
  label-1: "#f66d67"
  label-2: "#d9a514"
  label-3: "#2fc183"
  label-4: "#00aeee"
  label-5: "#b082f7"
typography:
  display:
    fontFamily: "Noto Sans"
    fontSize: "24px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.005em"
  title:
    fontFamily: "Noto Sans"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.005em"
  body:
    fontFamily: "Noto Sans"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "0"
  body-compact:
    fontFamily: "Noto Sans"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "0"
  label:
    fontFamily: "Noto Sans"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "0"
  caption:
    fontFamily: "Noto Sans"
    fontSize: "11.5px"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "0"
  code:
    fontFamily: "Geist Mono"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0"
spacing:
  0: "0"
  0.5: "2px"
  1: "4px"
  1.5: "6px"
  2: "8px"
  2.5: "10px"
  3: "12px"
  3.5: "14px"
  4: "16px"
  5: "20px"
  6: "24px"
  8: "32px"
  10: "40px"
  12: "48px"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "999px"
shadows:
  xs: "0 1px 0 0 rgb(18 18 18 / 0.04)"
  sm: "0 1px 2px 0 rgb(18 18 18 / 0.05), 0 1px 1px 0 rgb(18 18 18 / 0.04)"
  md: "0 4px 12px -2px rgb(18 18 18 / 0.08), 0 2px 4px -1px rgb(18 18 18 / 0.05)"
  lg: "0 12px 32px -6px rgb(18 18 18 / 0.14), 0 6px 12px -4px rgb(18 18 18 / 0.08)"
components:
  button:
    height: "32px"
    radius: "{rounded.md}"
    paddingInline: "{spacing.2.5}"
    fontSize: "{typography.body-compact.fontSize}"
  input:
    height: "32px"
    radius: "{rounded.md}"
    border: "{colors.line}"
    focusRing: "{colors.focus-ring}"
  card:
    radius: "{rounded.lg}"
    background: "{colors.card}"
    border: "{colors.line}"
    shadow: "{shadows.xs}"
  sidebar:
    width: "248px"
    background: "{colors.bg-sunken}"
    border: "{colors.line}"
---

# Design System for Linear Workspace App

This file is the design contract for UI work in this repo. It follows the extended DESIGN.md structure used by the public awesome-design-md collection while grounding the tokens in the local implementation in `app/globals.css`, `templates/styles.css`, and `components/ui/*`.

When editing the app, prefer the existing Tailwind tokens and CSS variables over hard-coded hex values. Use the hex values above for external mockups, generated prototypes, or Design.md tooling that requires sRGB colors.

## 1. Visual Theme & Atmosphere

The interface is a compact operational workspace for product teams. It should feel quiet, precise, and durable: a place for repeated issue triage, project review, document editing, chat, and collaboration. Avoid marketing-page styling inside the authenticated app. The first impression should be "dense but calm" rather than decorative or expressive.

The visual language is built from near-monochrome OKLCH neutrals, thin borders, shallow elevation, compact controls, and metadata-rich rows. Surfaces are separated by 1px lines and very small shadow cues, not by heavy cards or dramatic color blocks. Color is deliberately secondary: status, priority, labels, document icons, collaboration cursors, and workspace branding may introduce color, but the app shell itself is neutral.

Density matters. Most working UI should sit in a 12px to 14px type range, with 28px to 32px controls, small icons, and 4px to 12px spacing increments. Large display text is appropriate only for auth, onboarding, empty states, and top-level onboarding moments.

Key characteristics:

- Neutral workspace canvas with subtle contrast between `background`, `bg-sunken`, and `surface`.
- Compact information architecture: left sidebar, topbar, view controls, list/board/timeline surfaces, optional detail panel.
- Small rounded rectangles: 4px to 8px for controls, 12px for cards and modal panels, full radius only for avatars, pills, and progress tracks.
- Metadata is visualized through chips, status dots, priority colors, avatars, collaboration colors, and tiny counters.
- Motion is short and utility-focused: color transitions near 100ms to 150ms, panel/dialog transitions near 150ms to 200ms.

## 2. Color Palette & Roles

Use the semantic CSS variables as the source of truth inside the app. The implementation defines colors in OKLCH; the hex values below are approximate sRGB equivalents for Design.md consumers.

### Core Light Palette

- **Background** (`var(--background)`, `#fdfdfd`): main app canvas and page background.
- **Foreground** (`var(--foreground)`, `#121212`): primary text and filled primary button background.
- **Card / Surface** (`var(--card)`, `var(--surface)`, `#ffffff`): cards, popovers, rows, grouped controls.
- **Surface 2** (`var(--surface-2)`, `#fafafa`): subtle alternate rows, drag/drop lanes, muted panels.
- **Surface 3** (`var(--surface-3)`, `#f3f3f3`): hover states, active low-emphasis controls, icon button hover.
- **Sunken Background** (`var(--bg-sunken)`, `#f7f7f7`): sidebar and inset navigation zones.
- **Line** (`var(--line)`, `#e6e6e6`): primary 1px borders.
- **Line Soft** (`var(--line-soft)`, `#f0f0f0`): section dividers and secondary separators.

### Text Scale

- **Primary Text** (`var(--foreground)`, `#121212`): titles, row names, selected navigation.
- **Secondary Text** (`var(--text-2)`, `#4d4d4d`): normal navigation items and supporting content.
- **Tertiary Text** (`var(--text-3)`, `#7a7a7a`): timestamps, placeholders, helper text, empty metadata.
- **Quaternary Text** (`var(--text-4)`, `#9e9e9e`): counters, inactive icons, divider-adjacent hints.

### Interactive and Selection Color

- **Primary** (`var(--primary)`, `#1a1a1a`): filled primary controls, workspace logo fallback, selected strong elements.
- **Neutral Accent** (`var(--accent)`, `#f5f5f5`): shadcn/Radix hover and active backgrounds. This is neutral, not a brand color.
- **Neutral Accent Foreground** (`var(--accent-foreground)`, `#171717`): text over neutral accent surfaces.
- **Focus Ring** (`var(--ring)`, `#a1a1a1`): default focus ring for live app controls.
- **Tint Background** (`var(--accent-bg)`, `#ebf2ff`): selected chips, mentions, and subtle selected metadata.
- **Tint Foreground** (`var(--accent-fg)`, `#14359b`): readable text/icons over tint background.
- **Template Focus Accent** (`#537feb`): used in standalone HTML templates for focus outlines and a few preview accents. Treat it as a preview/prototype helper, not the live app's default brand color.

Do not describe the core UI as purple. Violet exists in the repo as a label/status/user-selectable workspace swatch, but it is not the product's primary visual theme.

### Configurable Workspace Accent

Workspace branding exposes selectable accent values: emerald, blue, violet, amber, rose, and slate. New workspaces are usually seeded with emerald, while minimal shell data may use black. These values belong to workspace identity, badges, highlights, and preview surfaces. They should not override the neutral app chrome unless a specific workspace-branding feature requires it.

### Dark Palette

- **Dark Background** (`#0c0c0c`): main app canvas.
- **Dark Surface** (`#131313`): primary cards and panels.
- **Dark Surface 2** (`#171717`): nested panels and toolbar zones.
- **Dark Surface 3** (`#1e1e1e`): hover and active low-emphasis states.
- **Dark Line** (`#2a2a2a`): primary borders.
- **Dark Line Soft** (`#202020`): subtle dividers.
- **Dark Text 2** (`#aeaeae`), **Dark Text 3** (`#808080`), **Dark Text 4** (`#5d5d5d`): secondary text ladder.
- **Dark Neutral Accent** (`#2e2e2e`): neutral hover and active background.
- **Dark Accent Background** (`#1d2842`) and **Dark Accent Foreground** (`#98b7f8`): selected chip / mention tint pair.
- **Dark Focus Ring** (`#737373`): default focus ring.

### Status, Priority, and Labels

Status colors should be applied to dots, rings, tiny badges, progress bars, and grouped list headings. Keep chroma moderate and pair with text labels for accessibility.

- **Backlog** `#9e9e9e`
- **Todo** `#6da3da`
- **Doing** `#c99f00`
- **Review** `#b679e1`
- **Done** `#32b36e`
- **Cancelled** `#e94740`
- **Priority urgent** `#e62c2c`
- **Priority high** `#f07900`
- **Priority medium** `#c2a140`
- **Priority low** `#9e9e9e`
- **Label swatches** `#f66d67`, `#d9a514`, `#2fc183`, `#00aeee`, `#b082f7`

## 3. Typography Rules

The app loads **Noto Sans** as `--font-sans` and **Geist Mono** as `--font-mono`. Use Noto Sans for nearly all interface text. Use Geist Mono only for code, IDs, compact technical values, and editor code blocks.

Typography should be crisp and functional. Avoid oversized type in core workspace screens. Use tabular numbers for counts, percentages, dates, and compact metrics.

| Role | Size | Weight | Line height | Usage |
| --- | ---: | ---: | ---: | --- |
| Display | 24px | 650 | 1.2 | Auth/onboarding headings and rare top-level moments |
| Page title | 18px to 20px | 600 | 1.25 | Workspace entry pages and main panel headings |
| Section title | 15px to 16px | 600 | 1.3 | Dialog titles, card titles, major subpanels |
| Row title | 13.5px to 14px | 600 | 1.3 | Issue rows, project cards, view cards |
| Body | 13px to 14px | 400 | 1.45 to 1.55 | Main interface copy and rich-text content |
| Label | 12px to 12.5px | 500 | 1.35 | Buttons, tabs, chips, form labels |
| Caption | 10.5px to 11.5px | 500 | 1.35 | Counters, keyboard hints, metadata, helper text |
| Code | 12px to 13px | 400 | 1.55 to 1.65 | Inline code, code blocks, technical diagnostics |

Letter spacing should be `0` by default. A tiny negative value like `-0.005em` is acceptable on dense row titles and card titles, matching existing code. Avoid uppercase tracking except for very small operational labels, and keep it subtle.

## 4. Component Stylings

### Buttons

Buttons use the local `Button` primitive in `components/ui/button.tsx`.

- Default height: 32px (`h-8`), small height: 28px (`h-7`), extra small: 24px (`h-6`).
- Default radius: 8px, capped variants often resolve to 6px to 8px.
- Padding: 8px to 10px horizontally for compact actions.
- Font: 12px to 14px, medium weight.
- Primary: dark foreground fill on light theme, light fill on dark theme.
- Outline: transparent or background surface with 1px border.
- Ghost: no border or fill until hover.
- Destructive: tinted red background with destructive foreground, never full red unless confirming a high-risk action.
- Active press: 1px downward translation is acceptable for direct buttons.

Use icon buttons for tool actions and dense command surfaces. Prefer Phosphor icons, matching `components.json`.

### Inputs and Textareas

Inputs use 32px height, 8px radius, 1px border, transparent background, and 10px horizontal padding. Focus state is a border color plus a 3px translucent ring. Textareas use the same visual language with a 64px minimum height and 8px radius.

Placeholder text should use `muted-foreground` or `text-3`. Error state uses destructive border plus a faint destructive ring.

### Cards and Panels

Cards are not decorative marketing tiles. Use them for real repeated items, auth containers, project summaries, modal bodies, and enclosed settings groups.

- Radius: 12px for app cards, 8px for small row containers.
- Border: 1px line or `ring-1 ring-foreground/10`.
- Background: `surface` / `card`.
- Shadow: `xs` or none by default; `sm`/`md` only for popovers, drag overlays, and elevated menus.
- Padding: 12px to 16px.

Do not put cards inside other cards unless the inner card is a genuine repeated item or modal sub-section.

### Navigation and Shell

The shell uses a 248px left sidebar, a 44px topbar, and a 42px viewbar in the static template. Sidebars should use `bg-sunken` or `sidebar`, with a right border. Active nav items use `surface` plus tiny shadow or border; hover uses `surface-3`.

Primary navigation items are 28px to 32px tall, left-aligned, icon-first, with counts on the right. Section labels are 11px to 12px and low contrast.

### Tabs, Chips, and Pills

Tabs are compact rounded controls with 5px by 10px padding. Active tabs gain a surface background, line border, and small shadow.

Chips represent filters, properties, labels, and quick metadata:

- Height: 20px to 26px.
- Radius: 6px for rectangular chips, full radius for pills.
- Text: 11.5px to 12.5px.
- Border: line or dashed line for optional/add controls.
- Selected/tinted chips use `accent-bg` and `accent-fg`; they read as a pale blue selection tint, not as a purple theme.

Pills with status color should include a dot or icon and avoid color-only meaning.

### Lists, Tables, Boards, and Timelines

Rows should have clear scan rhythm: left icon/status, title, metadata, assignee/avatar, then trailing actions. Use borders and sticky group headers rather than heavy boxes. Hover should reveal secondary actions with minimal background change.

Boards and timelines should preserve the same density. Columns and swimlanes should be separated by `line-soft`; group headers can use sticky translucent backgrounds with a slight backdrop blur.

### Dialogs, Popovers, Dropdowns

Floating surfaces use `popover` / `surface`, 8px to 12px radius, `ring-1 ring-foreground/10`, and `shadow-md` or `shadow-lg`. Menus should have 4px internal padding, compact items, and subtle entrance animations. Avoid oversized modal padding unless the dialog is onboarding or auth.

### Rich Text Editor Content

Rich text should stay utilitarian:

- Tables: collapsed borders, 1px border, 10px to 12px cell padding.
- Blockquotes: left 3px border, muted background, muted text.
- Code blocks: bordered rounded surface, mono font, 14px-ish size, comfortable line height.
- Mentions: full pill radius, muted/accent background, medium weight.
- Images: max-width 100%, radius slightly smaller than the global radius.

## 5. Layout Principles

Use an 8px base grid with allowed half-steps. The active spacing vocabulary is 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 32, 40, and 48px.

Core authenticated layout:

- Left sidebar: 248px desktop.
- Main topbar: 44px.
- Viewbar/subheader: 42px.
- Optional right detail panel: about 380px.
- Row controls: usually 28px to 32px.
- Icon buttons: 24px, 28px, or 32px square.
- Gutters in dense panes: 14px to 20px.

The layout should optimize for scanning and repeated action. Prefer stable column widths, sticky headers, and predictable control placement. Avoid hero sections, floating page bands, oversized empty spacing, and visual flourishes inside the app shell.

When building empty states, keep them centered and restrained. Use concise copy, one primary action, and optional secondary action. Avoid illustration-heavy empty states unless a custom product asset already exists.

## 6. Depth & Elevation

Depth is shallow and mostly structural. Borders carry most hierarchy; shadows only lift surfaces that visually float.

Shadow scale:

- **None**: base app panes, tables, row groups, sidebar, main content.
- **XS**: active nav items, active tabs, subtle cards, project rows.
- **SM**: drag previews, slightly elevated cards, compact panels.
- **MD**: dropdown menus, command palettes, hover cards, popovers.
- **LG**: modal overlays and large floating panels.

Use `ring-1 ring-foreground/10` for many component boundaries, especially shadcn/Radix primitives. Avoid thick shadows, colored glows, glassmorphism, and gradient depth.

Z-order should follow function: sticky headers above scroll content, dropdowns above headers, dialogs above dropdowns, toasts above dialogs only when system-level feedback is required.

## 7. Do's and Don'ts

Do:

- Use existing CSS variables from `app/globals.css` and Tailwind semantic tokens.
- Keep app screens compact, scannable, and metadata-rich.
- Use Phosphor icons for navigation, buttons, menus, status, and entity affordances.
- Use borders, tinted surfaces, and small shadows to separate layers.
- Use status, priority, and label colors only for metadata and state.
- Keep button labels short and pair dense actions with icons.
- Preserve keyboard-first and command-palette-friendly interaction patterns.
- Test both light and dark themes when changing shared primitives.

Don't:

- Do not introduce large saturated gradients, decorative blobs, or visual noise.
- Do not use marketing-site hero layouts inside workspace screens.
- Do not make cards the default page layout primitive.
- Do not create unrelated color scales when a semantic token already exists.
- Do not use oversized rounded corners on standard controls.
- Do not rely on color alone for status, priority, or destructive intent.
- Do not increase typography scale to solve hierarchy in dense views; use weight, spacing, and borders first.
- Do not hard-code one-off hex values in React components unless rendering user-supplied or data-driven color swatches.

## 8. Responsive Behavior

Desktop is the primary workspace target. Preserve density and multi-pane navigation on medium and large screens. The sidebar can collapse or move off-canvas when width is constrained, but the main content should keep headers and primary actions reachable.

Breakpoints and behavior:

- **Mobile below 640px**: single-column surfaces, off-canvas navigation, full-width dialogs/sheets, 44px minimum touch targets for primary controls.
- **Tablet 640px to 1024px**: collapse optional right panels into sheets, keep topbar and viewbar sticky, reduce metadata columns before truncating titles.
- **Desktop above 1024px**: full shell, left sidebar, main content, optional right detail panel.
- **Wide desktop above 1440px**: increase content capacity with columns or right panels, not larger type or decorative whitespace.

Long text should truncate in rows and chips with accessible full labels available through titles, tooltips, popovers, or detail views. Avoid wrapping row titles in dense tables unless the view is explicitly document-like.

Touch targets may stay compact on pointer-precise desktop surfaces, but any mobile sheet, command, or form should use larger hit areas and more vertical spacing.

## 9. Agent Prompt Guide

Use this section when asking an AI agent to build or refactor UI in this repo.

Quick reference:

- Primary canvas: `var(--background)` / `#fdfdfd`, dark `#0c0c0c`.
- Primary text: `var(--foreground)` / `#121212`, dark `#f5f5f5`.
- Surfaces: `var(--surface)`, `var(--surface-2)`, `var(--surface-3)`.
- Borders: `var(--line)` and `var(--line-soft)`.
- Core accent in the live app is neutral: `var(--accent)` / `#f5f5f5`.
- Selected/tinted metadata uses `accent-bg` / `accent-fg`: `#ebf2ff` / `#14359b`.
- Standalone templates use `#537feb` for focus outlines; do not turn that into a broad brand color.
- Workspace accent is configurable: emerald, blue, violet, amber, rose, or slate.
- Font: Noto Sans for UI, Geist Mono for code.
- Radius: 6px to 8px for controls, 12px for cards, full only for pills/avatars.
- Icons: Phosphor.
- Density: 13px to 14px body text, 28px to 32px controls.

Prompt starter:

> Build this UI as a compact project workspace screen using the repo's DESIGN.md. Use the existing CSS variables and shadcn/Radix primitives. Keep the layout dense, neutral, and operational: thin borders, shallow elevation, Noto Sans, Phosphor icons, compact controls, status chips, and muted metadata. Use color only for status, priority, labels, mentions, collaboration presence, or workspace branding. Avoid marketing styling, decorative gradients, large cards, and hard-coded colors.

Component prompt:

> Create a new workspace component that matches the current app: 32px controls, 8px radius, `surface` backgrounds, `line` borders, hover states on `surface-3`, muted metadata text, and status/priority colors only for semantic state. Use existing UI primitives where available.

Dark-mode prompt:

> Verify the component in dark mode using the same semantic tokens. Replace light-only borders, backgrounds, and shadows with tokenized `background`, `surface`, `surface-2`, `surface-3`, `line`, and `line-soft` values. Keep contrast clear without adding glow or saturated accents.
