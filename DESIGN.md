# DESIGN.md: Faza Fauzan Adzima Portfolio 3D

## Design Read
Reading this as: personal developer and cybersecurity portfolio for technical reviewers, educators, and collaborators, in an Editorial Bold red-on-obsidian visual language, dial `ENERGY 3 / RHYTHM 3 / MOTION 2`.

## Brand Identity & Direction
- **Owner**: Faza Fauzan Adzima (student, web developer, cybersecurity practitioner)
- **Theme**: Red and black ("berani" / bold), anchored by a real-time procedural 3D obsidian-crimson dragon in the hero canvas.
- **Wordmark (`R-23`)**: Text wordmark `FAZA.` only. No AI-generated avatar, portrait, or invented emblem.
- **Language**: Full Indonesian (`<html lang="id">`) in a direct, clear, non-promotional voice.

## Palette & Contrast Ledger (Verified via `contrast-check.py`)
Active palette adheres to `R-29` (1 neutral base scale + 1 crimson brand accent + 3 functional state indicators).

| Role | Token | Hex | Measured Contrast | Usage Rule |
| :--- | :--- | :--- | :--- | :--- |
| Background Obsidian | `--bg-obsidian` | `#0A090B` | Base canvas | Primary page ground |
| Surface Primary | `--surface-1` | `#151216` | Raised panel | Section panels, cards, forms |
| Surface Accent Tint | `--surface-crimson` | `#1B1013` | Accent field | Achievement emphasis block |
| Text Primary | `--text-primary` | `#F4F1EE` | `17.66:1` on `#0A090B` | Headlines, body prose, values |
| Text Secondary | `--text-secondary` | `#B8B2AE` | `9.48:1` on `#0A090B`, `8.87:1` on `#151216` | Subheadings, summaries |
| Text Muted | `--text-muted` | `#9C9590` | `6.30:1` on `#151216` | Metadata, helper labels |
| Crimson CTA Fill | `--crimson-cta` | `#B91624` | `6.56:1` with `#FFFFFF` text | Primary CTA button fill (`#9A111D` hover = `8.50:1`) |
| Crimson Text & Focus | `--crimson-text` | `#F25764` | `5.98:1` on `#0A090B`, `5.60:1` on `#151216` | Small accent text, active links, `:focus-visible` ring |
| Crimson 3D & Display | `--crimson-vivid` | `#DC1E2E` | `4.04:1` on `#0A090B` (PASS large text 3.0:1, FAIL normal 4.5:1) | 3D dragon rim light, display punctuation, large numerals (>= 24px bold) ONLY |
| Border Subtle | `--border-base` | `#635B61` | `3.03:1` on `#0A090B` | Outer section dividers, input boundaries |
| Border Surface | `--border-surface` | `#6E656B` | `3.31:1` on `#151216` | Card outlines, button borders on `#151216` |
| State Good | `--state-good` | `#4ADE80` | `10.66:1` on `#151216` | Present security header indicator (paired with text `Ada`) |
| State Warn | `--state-warn` | `#FBBF24` | `11.13:1` on `#151216` | Partial score / grade B-C indicator (paired with text) |
| State Missing | `--state-danger` | `#F25764` | `5.60:1` on `#151216` | Missing header / form error indicator (paired with text) |

## Typography (`R-06`)
- **Display**: `Syne` (700/800) for sharp geometric angles that match the sculpted dragon horns and editorial scale contrast.
- **Body**: `Plus Jakarta Sans` (400/500/600/700) for crisp Indonesian legibility across long descriptions and form controls.
- **Technical Readout**: `IBM Plex Mono` (400/500) used strictly for domain strings, HTTP header names, status codes, and tabular scores (never as giant decorative headings).
- Avoids AI defaults (`Inter`, `Geist`, `Space Grotesk`, `JetBrains Mono`).

## R-31 Decision Ledger
- **Why Obsidian + Crimson**: Directly executes the user's red-black ("berani") identity while isolating `#B91624` / `#F25764` to key focal points (`R-01`, `R-29`).
- **Why Fixed Dark Theme (`R-21`)**: The user explicitly requested a black-and-red theme anchored by an obsidian-crimson 3D dragon atmosphere, making dark mode an authentic brand requirement rather than a generic tech default.
- **Why Asymmetric Mixed Section Compositions (`R-05`, `R-14`)**: Matches `RHYTHM 3` by giving each section a distinct structure: full-bleed 3D hero, numbered index rows for projects, large typographic split for achievements, functional two-column audit workbench for the Security Lab, and split contact/form footer.
- **Why Procedural WebGL Dragon (`R-22`)**: Real-time Three.js geometry renders the requested 3D dragon directly from code without multi-megabyte external binary downloads, paired with `dragon-fallback.svg` for immediate LCP paint and non-WebGL resilience (`R-40`).
- **Why Dose Caps (`R-10`, `R-11`, `R-12`, `R-13`, `R-19`)**: Glassmorphism (`backdrop-filter`) is restricted solely to the sticky header bar (`1` element); crimson rim glow is restricted to the 3D dragon and primary CTA (`2` focal accents); radii differentiate sharp structural cards (`2px`) from actionable buttons (`4px`); motion respects `prefers-reduced-motion` and provides a visible pause toggle (`R-39`).
- **Why No Decorative Icons/Badges (`R-04`, `R-08`, `R-09`)**: No floating eyebrow pill above `<h1>`, no emoji in headings/UI, no arrows on every button, and custom minimalist SVG glyphs only where action semantics benefit (menu toggle, motion pause/play).
