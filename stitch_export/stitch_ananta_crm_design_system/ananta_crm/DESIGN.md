---
name: Ananta CRM
colors:
  surface: '#fff8f7'
  surface-dim: '#f7d1cf'
  surface-bright: '#fff8f7'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fff0ef'
  surface-container: '#ffe9e7'
  surface-container-high: '#ffe1df'
  surface-container-highest: '#ffdad7'
  on-surface: '#2a1615'
  on-surface-variant: '#5f3e3d'
  inverse-surface: '#412b29'
  inverse-on-surface: '#ffedeb'
  outline: '#946e6c'
  outline-variant: '#e9bcb9'
  surface-tint: '#bf0023'
  primary: '#bb0022'
  on-primary: '#ffffff'
  primary-container: '#e9002d'
  on-primary-container: '#fffbff'
  inverse-primary: '#ffb3af'
  secondary: '#b4262e'
  on-secondary: '#ffffff'
  secondary-container: '#fd5c5d'
  on-secondary-container: '#60000c'
  tertiary: '#006574'
  on-tertiary: '#ffffff'
  tertiary-container: '#008092'
  on-tertiary-container: '#f8fdff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdad8'
  primary-fixed-dim: '#ffb3af'
  on-primary-fixed: '#410006'
  on-primary-fixed-variant: '#930018'
  secondary-fixed: '#ffdad8'
  secondary-fixed-dim: '#ffb3af'
  on-secondary-fixed: '#410006'
  on-secondary-fixed-variant: '#91061a'
  tertiary-fixed: '#a2eeff'
  tertiary-fixed-dim: '#6ed5e9'
  on-tertiary-fixed: '#001f25'
  on-tertiary-fixed-variant: '#004e5a'
  background: '#fff8f7'
  on-background: '#2a1615'
  surface-variant: '#ffdad7'
typography:
  display:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Hanken Grotesk
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-caps:
    fontFamily: Hanken Grotesk
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  table-data:
    fontFamily: Hanken Grotesk
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-padding: 24px
  gutter: 16px
  stack-sm: 8px
  stack-md: 16px
  sidebar-width: 260px
---

## Brand & Style

The design system is engineered for a high-performance printing and graphics CRM, balancing industrial precision with modern SaaS aesthetics. The brand personality is authoritative, organized, and technical, catering to professionals who manage complex workflows and high-volume data.

The visual style follows a **Modern Corporate** approach, drawing inspiration from high-density interfaces like Stripe and Linear. It prioritizes clarity and efficiency through:
- **High Information Density:** Maximizing screen real estate without sacrificing legibility.
- **Structural Integrity:** Using subtle borders and tonal layering rather than aggressive shadows to define hierarchy.
- **Vibrant Precision:** Utilizing a high-chroma "Signal Red" as a precision tool for navigation and primary intent, supported by a specialized palette of deep berries and teal accents for data clarity.

## Colors

The palette is rooted in the printing industry's heritage, updated with high-visibility digital signals.

- **Primary (#F80031):** A high-chroma "Signal Red" used exclusively for primary actions, active navigation states, and critical data points.
- **Secondary (#D64044):** A muted berry-red used for secondary interactive elements and decorative accents.
- **Tertiary (#008C9F):** A deep teal used for balanced data visualization and distinguishing non-primary workflows.
- **Neutral Core (#8E706E):** A warm taupe-grey used for borders and secondary text to maintain a professional, sophisticated environment.
- **Typography:** Text uses a deep, ink-like near-black for maximum contrast and professional feel.

## Typography

The design system utilizes **Hanken Grotesk** for its modern geometric clarity and excellent legibility at small sizes. 

- **Tabular Figures:** For all numerical data in tables and financial totals, `tabular-nums` must be enabled to ensure columns of figures align vertically for easy comparison.
- **Hierarchy:** We use a tight typographic scale. Section headers use `label-caps` in a muted neutral tone to provide structure without competing with content.
- **Refinement:** Headlines use slight negative letter-spacing to appear more "set" and professional, mimicking high-end editorial layouts.

## Layout & Spacing

The layout employs a **Fluid Grid** model with high-density spacing.

- **Grid:** A 12-column grid is used for main content areas. Form layouts typically use a 2-column span for better data scannability.
- **Sidebar:** A fixed left navigation (`260px`) provides a persistent anchor. It uses a 1px border-right rather than a shadow.
- **Density:** We utilize a 4px base unit. Most interactive elements (inputs, list items) use a condensed vertical padding of 8px to 10px to ensure maximum information is visible above the fold.
- **Breakpoints:** 
    - Desktop: 1200px+ (Full sidebar)
    - Tablet: 768px - 1199px (Collapsed sidebar/Icon only)
    - Mobile: Below 768px (Bottom nav or Hamburger menu, stacked 1-column forms).

## Elevation & Depth

This design system uses a **Tonal Layering** approach combined with **Low-Contrast Outlines**.

- **Page Base:** The background-page color acts as the lowest level.
- **Surface Layer:** All primary cards, tables, and containers are pure white or surface-container variants with 1px solid borders. 
- **Shadows:** Use a single, extremely subtle shadow for "floating" elements like dropdowns or modals: `0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)`. 
- **Active State:** Focus states for inputs and buttons utilize a 2px outer ring in the primary Signal Red with low opacity.

## Shapes

The shape language is professional and calibrated. 

- **Standard Radius:** 8px (equivalent to `rounded-lg` in this configuration) is used for all primary containers, including cards, input fields, and buttons. This softens the high-density grid and makes the app feel approachable yet precise.
- **Small Radius:** 4px is used for internal elements like status pills or small nested chips.
- **Pills:** Status indicators use a fully rounded (pill) shape to distinguish them from interactive buttons.

## Components

### Buttons
- **Primary:** Solid Signal Red background, white text. No gradient. 8px radius.
- **Secondary:** White background or Berry Red tint, 1px border, neutral or berry text.
- **States:** Hover on Primary should be a slightly more intense red; Hover on Secondary should be a light neutral wash.

### Tables
- **Header:** Light neutral-tinted background, `label-caps` typography, 1px bottom border.
- **Cells:** High-density (12px vertical padding). Use hairline dividers between rows.
- **Hover:** Rows should highlight in a very faint primary red tint to assist tracking across wide screens.

### Forms
- **Labels:** Vertical, positioned above the input. Use `body-sm` with 600 weight.
- **Inputs:** 8px radius, white background, 1px border. Searchable comboboxes should include a small magnifying glass icon in the prefix slot.

### Status Pills
- **Structure:** Transparent or very light tinted background, 4px radius or pill shape.
- **Visuals:** Use Signal Red for alerts, Tertiary Teal for operational success, and Secondary Red for warnings.

### Sidebar & Navigation
- **Active Indicator:** A 3px thick vertical bar on the extreme left edge of the navigation item in Signal Red.
- **Icons:** Use 20px stroke-based icons with a consistent 1.5px or 2px weight in neutral tones.