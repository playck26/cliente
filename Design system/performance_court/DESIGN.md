---
name: Performance Court
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f4'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#414940'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f0f1f1'
  outline: '#71796f'
  outline-variant: '#c0c9bd'
  surface-tint: '#006e2a'
  primary: '#00531e'
  on-primary: '#ffffff'
  primary-container: '#006e2a'
  on-primary-container: '#75f38a'
  inverse-primary: '#61df78'
  secondary: '#006c51'
  on-secondary: '#ffffff'
  secondary-container: '#66f8c7'
  on-secondary-container: '#007054'
  tertiary: '#930024'
  on-tertiary: '#ffffff'
  tertiary-container: '#c00032'
  on-tertiary-container: '#ffcece'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#7efc92'
  primary-fixed-dim: '#61df78'
  on-primary-fixed: '#002108'
  on-primary-fixed-variant: '#00531e'
  secondary-fixed: '#69fbca'
  secondary-fixed-dim: '#47deaf'
  on-secondary-fixed: '#002116'
  on-secondary-fixed-variant: '#00513c'
  tertiary-fixed: '#ffdad9'
  tertiary-fixed-dim: '#ffb3b4'
  on-tertiary-fixed: '#40000a'
  on-tertiary-fixed-variant: '#920024'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.02em
  display-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 30px
    letterSpacing: -0.01em
  title-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  title-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  margin-mobile: 20px
  gutter-mobile: 16px
---

## Brand & Style

This design system is engineered for a high-performance sports environment, blending the precision of professional tennis with a modern, lifestyle-oriented aesthetic. The personality is disciplined yet welcoming, focusing on athletic excellence and community.

The visual style draws from **Minimalism** and **Corporate/Modern** influences, emphasizing massive whitespace to allow "room to breathe" between dense scheduling data. Key stylistic signatures include:
- **Kinetic Energy:** Use of high-contrast, electric green and teal accents to draw focus to progress and action.
- **Structural Integrity:** Elements are grounded in a rigid grid but softened by generous radii to feel approachable.
- **Subtle Thematic Textures:** Decorative tennis court line patterns (single or double lines) are used at low opacity (3-5%) as background motifs to reinforce the sport's geometry.

## Colors

The palette is anchored in a "Hyper-Court" aesthetic, moving from traditional greens toward high-visibility, athletic neon tones to represent the energy of a modern competition facility.

- **Primary (Electric Grass):** Used for branding, primary actions, and status indicators. This hex (#009C3F) represents the vibrant core identity of the club.
- **Secondary (Neon Teal):** A bright, high-energy teal (#00BD90) used for supporting elements and secondary actions to maintain a cohesive high-performance theme.
- **Tertiary (Match Point Red):** A punchy, aggressive red (#ED0040) used for contrast, specific alerts, or high-priority decorative accents.
- **Background & Surface:** A clean, neutral white background creates a professional, premium feel, while high-elevation surfaces indicate interactive or elevated cards.

## Typography

This design system utilizes **Inter** for its neutral, geometric humanist qualities, ensuring maximum legibility across scheduling tables and booking interfaces.

- **Headlines:** Use tight letter-spacing for large titles to create a bold, professional impact.
- **Body:** Standardized on a 16px base for comfort during rapid scanning.
- **Labels:** Small labels use a medium or semi-bold weight to maintain clarity against colorful badge backgrounds.

## Layout & Spacing

The layout follows an **8px grid system**. On mobile, the system utilizes a fluid grid with 20px side margins and 16px gutters between card elements.

- **Vertical Rhythm:** Use `32px` spacing between major sections and `12-16px` between elements within a card.
- **Touch Targets:** No interactive element (links, buttons, icons) should have a hit area smaller than 48x48px.
- **Content Density:** Maintain generous internal padding in cards (minimum 20px) to uphold the premium feel.

## Elevation & Depth

Hierarchy is established through **Ambient Shadows** on pure white surfaces. Because the palette is more vibrant, shadows should remain extremely neutral to avoid visual clutter.

- **Level 1 (Default Card):** `0px 4px 12px rgba(0, 0, 0, 0.05)`. This creates a soft, realistic lift against the clean background.
- **Level 2 (Active/Floating):** `0px 8px 24px rgba(0, 0, 0, 0.10)`. Used for active state cards or modals.
- **Thematic Depth:** To separate sections without adding height, use horizontal dividers or the subtle court-line texture patterns mentioned in the Brand section.

## Shapes

The shape language is "athletic-organic"—balanced between the precision of the court and the comfort of lifestyle wear.

- **Small Components:** Buttons, input fields, and chips use a **8px (0.5rem)** radius.
- **Large Components:** Cards and main containers use a **16px (1.0rem)** or **24px (1.5rem)** radius for a softer, more premium appearance.
- **Interactive States:** Buttons do not change shape on press, only elevation or color density.

## Components

### Buttons
- **Primary:** Electric Grass background, White text. 8px radius. Height: 52px.
- **Secondary:** Neon Teal background, White text. Used for secondary navigation.
- **Tertiary/Ghost:** Transparent with Electric Grass border and text.

### Cards
- **Structure:** Always elevated with soft shadows. 16px+ corner radius. 
- **Thematic Element:** Backgrounds may feature a 5% opacity "Baseline" or "Service Box" graphic in the top right corner to signify different court types or categories.

### Bottom Navigation
- **Height:** 80px (including safe area).
- **Items:** Home, Aulas, Quadras, Reservas.
- **Active State:** The active icon and label use the Primary Electric Grass. Inactive items use Text Secondary.

### Status Badges
- **Shape:** Fully rounded (pill) with a height of 24px.
- **Success ("Pago"):** Electric Grass background with White text.
- **Warning ("Pendente"):** Match Point Red background with White text.

### Input Fields
- **Style:** Outlined with a 1px border. 
- **Focus:** 2px solid Electric Grass border. 
- **Label:** Floating or positioned above the field in Label-MD typography.