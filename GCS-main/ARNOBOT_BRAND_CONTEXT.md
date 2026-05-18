# ARNOBOT — Brand Context

> Extracted from arnobot.in · May 2026

---

## 1. Brand Identity

| Field | Value |
|---|---|
| **Name** | ARNOBOT |
| **Tagline** | Robotics Redefined |
| **Page Title** | ARNOBOT — Robotics Redefined |
| **Core Message** | Intelligent automation for defence, industrial inspection, and mission-critical environments. |
| **Origin Badge** | Made in India |
| **Mission Statement** | To make industrial maintenance safer, smarter, and more efficient through intelligent robotics. |

### Hero Headline
> "Robotics Redefined."

The `<span>` highlight on the H1 uses `--blue-light` (`#A7BCE3`), making a portion of the headline a muted steel-blue against white.

### Hero Sub-copy
> "Intelligent automation for defence, industrial inspection, and mission-critical environments."

### About One-liner
> "ARNOBOT develops rugged, intelligent robots engineered for extreme reliability in defence, industrial inspection, and hazardous environments."

---

## 2. Color Palette

All colors are defined as CSS custom properties on `:root`.

### Core Palette

| Token | Hex | Usage |
|---|---|---|
| `--black` | `#000000` | Primary background |
| `--near-black` | `#0a0a0a` | Dark section backgrounds |
| `--dark` | `#111111` | Subtle dark surfaces |
| `--white` | `#ffffff` | Primary text on dark, button fill |
| `--off-white` | `#f5f5f5` | Light section backgrounds |
| `--grey-light` | `#e8e8e8` | Borders on light sections |
| `--grey-mid` | `#999999` | Eyebrow labels, subdued text |
| `--grey-dark` | `#444444` | Body copy on white backgrounds |

### Brand Blue Palette

| Token | Hex | Usage |
|---|---|---|
| `--blue` | `#38559D` | Medium brand blue |
| `--blue-light` | `#A7BCE3` | Accent highlights, hero text span, canvas dots |
| `--blue-deep` | `#200B76` | Deep navy, gradient base |
| *(unnamed)* | `#2D358E` | Radial gradient in loading SVG |

### Interaction / State Colors

| Hex | Usage |
|---|---|
| `rgba(255,255,255,0.55)` | Hero sub-copy, hero eyebrow |
| `rgba(255,255,255,0.7)` | Nav links default |
| `rgba(255,255,255,0.45)` | Product description text |
| `rgba(255,255,255,0.4)` | Eyebrow labels on dark sections |
| `rgba(255,255,255,0.12)` | Hero eyebrow border |
| `rgba(255,255,255,0.06)` | Nav border, grid lines |
| `rgba(167,188,227,0.6)` | Tagline in SVG splash screen |
| `rgba(167,188,227,0.08)` | Subtle canvas surface glow |

---

## 3. Typography

### Font Stack

| Token | Font | Weights | Usage |
|---|---|---|---|
| `--font-display` | **Syne** (Google Fonts) | 400–800 | All headings, nav links, eyebrows, buttons, labels |
| `--font-body` | **DM Sans** (Google Fonts) | 300–500 | All body/paragraph text |
| *(monospace)* | **Courier New** | — | Tactical HUD overlays on canvas |

### Type Scale

| Class | Size | Weight | Tracking | Usage |
|---|---|---|---|---|
| `.hero-h1` | clamp(52px → 96px) | 700 | -0.02em | Hero headline |
| `.display-xl` | clamp(40px → 72px) | 700 | -0.02em | Section headings |
| `.display-lg` | clamp(28px → 52px) | 700 | -0.02em | Sub-section headings |
| `.panel-h2` | clamp(36px → 72px) | 700 | -0.02em | Full-bleed panel headings |
| `.eyebrow` | 11px | 500 | 0.2em | Section category labels (uppercase) |
| `.nav-links a` | 12px | 500 | 0.12em | Navigation (uppercase) |
| `.nav-demo` | 12px | 600 | 0.1em | Nav CTA button |
| `.body-copy` | 16px | 300 | — | Body paragraphs, line-height 1.75 |
| Product desc | 15px | 300 | — | Product card descriptions |
| Canvas labels | 11px | — | 0.12em | HUD tactical labels (Courier New) |

---

## 4. Logo & Visual Mark

- **Wordmark:** All-caps `ARNOBOT` in Syne bold, white.
- **Chevron/V Icon:** An SVG polygon shape (chevron pointing right) used alongside the wordmark. In the splash screen SVG it appears before the text.
- **Nav treatment:** Logo rendered as an `<img>` with CSS `filter: brightness(0) invert(1)` — always white regardless of source file color.
- **Splash SVG:** On the pre-load screen, the wordmark is set at `font-size: 80px`, `letter-spacing: 4`, with the tagline "ROBOTICS REDEFINED" at `font-size: 20px`, `font-weight: 300`, `letter-spacing: 8`, in `rgba(167,188,227,0.6)` (muted steel-blue).

---

## 5. Visual Identity & Design Language

### Overall Aesthetic
- **Dark, cinematic, military-grade.** Pure black backgrounds dominate. The palette deliberately echoes defence/aerospace HUDs and tactical displays.
- **Minimal chrome.** No gradients on UI surfaces — only black, near-black, and white sections. Colour is used only as accent.
- **Full-bleed immersion.** Hero and panel sections are 100vh with video/image backgrounds, dark gradient overlays, and a subtle diagonal hatching overlay (`repeating-linear-gradient` at -45°) creating a film-grain / stealth texture.

### Canvas Animation (Hero Background)
A custom `<canvas>` renders a live tactical HUD:
- Rotating radar sweep (right portion of screen)
- Topographic dot grid
- Animated horizontal scan lines (moving left/right)
- Corner reticle boxes labeled: `SECTOR ALPHA / BRAVO / GAMMA / DELTA` with statuses (`CLEAR`, `ACTIVE`, `SCANNING`)
- Radar blips: `TGT-01` through `TGT-06` tagged `FRIENDLY`, `HOSTILE`, `UNKNOWN`
- All elements use `rgba(167,188,227,…)` — the brand's steel-blue

### Layout
- Max-width container: **1440px**, padding **64px** horizontal (48px on mobile)
- Alternating section backgrounds: `#000` → `#0a0a0a` → `#ffffff` → `#f5f5f5`
- Products grid: two-column, alternating image-left / image-right (CSS `direction: rtl` trick)
- Product cards: minimum 520px tall, dark image panels (#0d0d0d) with hover brightening
- Scroll-reveal animations on all major content blocks (`reveal`, `reveal-d1`)
- 3px slim scrollbar in dark grey on black

### Buttons / CTAs
| Type | Style |
|---|---|
| Primary | White fill, black text, uppercase, 14×32px padding |
| Ghost/Outline | Transparent, white border (15% opacity), white text (50% opacity), hover brightens border & text |
| Nav CTA | White text, 30% opacity border, uppercase |

### Imagery Placeholders
- Hero: Full-bleed video/image (canvas fallback)
- Products: `imgSaibya`, `imgAltius`, `imgNexus` (JPEG assets, object-fit cover)
- Panel: Atmospheric media with 0.55 opacity + dark gradient overlay
- Intelligence panel caption: `"ALTIUS climbing ship hull"` — confirms physical environment context

---

## 6. Products

| Product | Type | Description |
|---|---|---|
| **SAIBYA** | UGV (Unmanned Ground Vehicle) | Versatile UGV for reliable payload transport across slopes, stairs, and desert sands. Available in Remote, Semi-autonomous, and Fully Autonomous variants. |
| **NEXUS** | Tactical Robot | Tactical ground robot (details in product sheet) |
| **ALTIUS** | Climbing Robot | Designed for vertical surface climbing — demonstrated on ship hulls |
| **ATM** | Any Terrain Machine | All-terrain platform |

All robots share a **product PDF brochure** (Saibya and Altius confirmed), downloadable on hover.

---

## 7. Navigation Structure

```
Products  |  Technology  |  Industries  |  Company  |  Careers  |  [Request a Demo]
```

### Page Sections (scroll order)
1. **Hero** — Tagline + CTA ("Explore Robots", "Request a Demo")
2. **Intelligence Panel** — "The intelligence behind every mission." + "Explore Technology"
3. **Products** — "Our Robots / Advanced ground systems for any mission."
4. **Technology** — "Intelligence Layer / The AI that powers every mission." (Computer vision, sensor fusion, semi-autonomous navigation)
5. **Industries** — "Built for the world's most demanding environments." (defence, oil & gas, shipyards, disaster response)
6. **Why ARNOBOT** — Comparison table: Traditional Inspection vs. ARNOBOT System
7. **About** — "Transforming how critical assets are inspected."
8. **Careers** — "Join the Team / Build robots that matter."
9. **Contact** — Address, email, phone, inquiry form
10. **Footer** — Product links, company links, social, copyright

---

## 8. Comparison Table (Why ARNOBOT)

| Metric | Traditional Inspection | ARNOBOT System |
|---|---|---|
| Human safety risk | High exposure | Zero human risk |
| Inspection frequency | Periodic only | Continuous monitoring |
| Data intelligence | Manual records | AI-driven analytics |
| Downtime impact | High downtime | Optimised efficiency |
| Operational cost | Recurring labour | Long-term ROI |

---

## 9. Target Audience

**Primary:** B2B enterprise buyers in:
- **Defence** — Indian Navy, military procurement (BHEL / Indian Navy referenced in inquiry form)
- **Oil & Gas** — Asset inspection, hazardous environment monitoring
- **Shipbuilding / Maritime** — Hull inspection (ALTIUS climbing)
- **Industrial / Heavy Industry** — Automated inspection, maintenance
- **Disaster Response** — Hazardous environment access

**Inquiry Types offered:**
- Schedule a Consultation
- Request a Demo
- Book Site Assessment
- Partnership / Distribution
- Defence Procurement
- General Inquiry

**Tone signals:** Technical, credibility-focused, government-procurement-aware. "Made in India" badge is prominent — targets domestic defence/industrial self-reliance buyers (Atmanirbhar Bharat positioning).

---

## 10. Technology Positioning

- **Computer vision** + **sensor fusion**
- **Semi-autonomous / fully autonomous** navigation modes
- "Operating where humans cannot, continuously collecting and acting on data"
- **AI-driven analytics** as a differentiator vs. manual inspection
- Intelligence platform framed as "the AI that powers every mission" — software layer as a product, not just hardware

---

## 11. Contact & Social

| Channel | Value |
|---|---|
| **Email** | info.arnobot@gmail.com |
| **Phone** | +91 99255 12860 |
| **Address** | G-2, Parul Apartments, Satellite Road, Ahmedabad – 380015, India |
| **LinkedIn** | https://www.linkedin.com/company/arnobot/ |
| **Instagram** | https://www.instagram.com/robots_arnobot/ |

---

## 12. Summary — Brand Voice & Tone

| Axis | Character |
|---|---|
| **Tone** | Serious, precise, confident. No playfulness. |
| **Register** | Technical-professional, defence-adjacent |
| **Voice** | Active, direct ("Zero human risk", "Build robots that matter") |
| **Aspirational frame** | India's leading robotics partner for critical environments |
| **Cultural signal** | "Made in India" — national pride + defence-sector positioning |
| **Typography mood** | Geometric (Syne) + clean reading (DM Sans) — modern industrial |
| **Visual mood** | Dark aerospace / tactical HUD — trust, reliability, precision |
