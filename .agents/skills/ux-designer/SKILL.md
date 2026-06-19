---
name: ux-designer
description: Provides UX/UI guidelines, design tokens, and components specifications for designing new or improving existing screens in Ghostfolio, ensuring consistency with the redesigned holdings, summary, and overview pages.
license: MIT
metadata:
  author: Alberto Martínez Ballesteros
  version: '1.0'
---

# Ghostfolio UX/UI Design Guidelines

This guide defines the design system, layout rules, typography, component standards, and dark/light mode configurations for Ghostfolio. Use these guidelines when creating new screens, modifying existing components, or polishing user flows.

---

## 1. Core Layout & Grid System

- **Page Container (`.overview`)**:
  - Always bound the main page content wrapper inside a container with a max-width of `100rem` and center it:
    ```scss
    .overview {
      max-width: 100rem;
      margin: 0 auto;
      padding: 1rem; // p-3 bootstrap equivalent
    }
    ```
- **Section Titles**:
  - Main headers for page sections must use a uppercase, slightly tracked font layout to match the overview page:
    ```scss
    .section-title {
      font-size: 1.55rem;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      opacity: 0.95;
      margin-bottom: 1.25rem;
    }
    ```
- **Proportional Card Grids**:
  - Dashboards must align key elements in consistent grids. Ensure that layout widths are visually balanced (e.g. aligning top rows with combined bottom columns).

---

## 2. Light & Dark Mode Color Scheme

All core screens must maintain high contrast and clear separation of cards from page canvases.

| Token / Element                       | Light Mode Value                            | Dark Mode Value                               |
| :------------------------------------ | :------------------------------------------ | :-------------------------------------------- |
| **Page Canvas Background**            | `--gf-surface-light` (`rgb(242, 244, 243)`) | `var(--dark-background)` (`rgb(22, 24, 39)`)  |
| **Standard Card Background**          | `--gf-card-bg-light` (`rgb(255, 255, 255)`) | `rgb(48, 56, 72)` or `var(--gf-card-bg-dark)` |
| **Active Table Row Background**       | `--gf-card-bg-light` (`rgb(255, 255, 255)`) | `rgb(48, 56, 72)`                             |
| **Primary Text (`.text-main`)**       | `rgba(var(--dark-primary-text))`            | `rgba(var(--light-primary-text))`             |
| **Secondary Text (`.text-subtitle`)** | `rgba(var(--dark-primary-text), 0.6)`       | `rgba(var(--light-primary-text), 0.75)`       |
| **Positive Change / Performance**     | `#22c55e`                                   | `#4ade80`                                     |
| **Negative Change / Performance**     | `#f97316`                                   | `#ea580c`                                     |

### Key SCSS Implementation:

- **Card Separation**:
  - The app shell's `.app-rounded-container` must be set to `background-color: var(--gf-surface-light)` in light mode, forcing standard white cards to stand out on a light-gray canvas.
- **Subtitle Contrast**:
  - In dark mode, ensure `.text-subtitle` (for symbol subtitles, linked account names, etc.) is set to `0.75` opacity of light primary text to make it readable against dark cards.

---

## 3. Card Standards & Elements

### KPI Cards

- Use for single metrics (e.g. Net Return, Available Cash).
- **Metric styling**: Set values to `2.7rem` font size, bold (`700`), and `1.2` line height.
- Color code indicators directly (e.g. `.kpi-positive` vs `.kpi-negative`).

### Separated Table Rows as Cards (e.g., Holdings Table)

- Reformat standard table data rows to look like independent cards:

  ```scss
  table.gf-table {
    border-collapse: separate !important;
    border-spacing: 0 12px !important; // Vertically separates rows
    background: transparent !important;
    border: none !important;

    tr.mat-mdc-row {
      background-color: var(--gf-card-bg-light);
      border-radius: 16px;
      transition:
        transform 0.2s ease,
        box-shadow 0.2s ease;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
      }

      td {
        padding: 1rem 0.75rem !important;
        border-top: 1px solid rgba(var(--dark-dividers)) !important;
        border-bottom: 1px solid rgba(var(--dark-dividers)) !important;
        vertical-align: middle;

        &:first-child {
          border-left: 1px solid rgba(var(--dark-dividers)) !important;
          border-top-left-radius: 16px;
          border-bottom-left-radius: 16px;
        }
        &:last-child {
          border-right: 1px solid rgba(var(--dark-dividers)) !important;
          border-top-right-radius: 16px;
          border-bottom-right-radius: 16px;
        }
      }
    }
  }
  ```

### Performance Badges

- Display performance percentages using high-contrast solid backgrounds with white text:

  ```scss
  .perf-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.35rem 0.75rem;
    border-radius: 8px;
    font-size: 0.82rem;
    font-weight: 600;
    white-space: nowrap;
    color: #ffffff !important;

    &--positive {
      background-color: #22c55e;
    }
    &--negative {
      background-color: #f97316; // Light Mode Orange/Red
    }
  }
  ```

---

## 4. Typography & Data Columns

- **Large Typography**:
  - Data columns (First Activity, Quantity, Value, Allocation, Change, Performance) must be prominent and easily scannable:
    ```scss
    td.mat-column-dateOfFirstActivity,
    td.mat-column-quantity,
    td.mat-column-valueInBaseCurrency,
    td.mat-column-allocationInPercentage,
    td.mat-column-performance,
    td.mat-column-performanceInPercentage {
      font-size: 1.05rem;
      font-weight: 500;
    }
    ```
- **Currency Symbols**:
  - Always link the correct base currency to output numbers alongside their currency prefix (e.g. `€142.500,30` instead of a raw number).

---

## 5. Asset Type Icons

To prevent slow page loads and network error logs (404s) from fetching external images:

- **Avoid image-based logos** in detailed overview/holdings tables.
- **Use vector icons** based on the subclass of the asset.
- ** Circular Avatar wrapper**: Wrap the icon in a 36px circular background with a subtle shadow:

  ```html
  <div class="asset-icon-wrapper" [title]="element.assetProfile.name">
    <ion-icon [name]="getAssetIcon(element)" />
  </div>
  ```

  ```scss
  .asset-icon-wrapper {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50% !important;
    height: 2.25rem !important;
    width: 2.25rem !important;
    background-color: var(--gf-surface-light) !important;
    border: 1px solid rgba(var(--dark-dividers)) !important;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);

    ion-icon {
      font-size: 1.25rem;
      color: rgba(var(--dark-primary-text), 0.7);
    }
  }
  ```

### Asset Type Mapping Rules:

- **Liquidity / Cash**: `wallet-outline`
- **Cryptocurrency**: `logo-bitcoin`
- **Stock**: `business-outline`
- **ETF**: `pie-chart-outline`
- **Mutual Fund**: `layers-outline`
- **Bond / Loan**: `receipt-outline`
- **Precious Metal**: `leaf-outline`
- **Others / Default**: `help-circle-outline`

---

## 6. Mobile Responsiveness & Micro-animations

- **Responsive Viewports**:
  - On screens narrower than `576px` (mobile), hide non-essential columns (First Activity, Allocation, Change). Keep only the **Logo**, **Name** (with accounts subtitle), **Value**, and **Performance Badge**.
  - Let users tap the card row to expand the remaining details inside a sliding panel.
- **Sliding Animation**:
  - Animate row expansions smoothly:

    ```scss
    .mobile-detail-content {
      animation: slideDown 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      overflow: hidden;

      .border-bottom-subtle {
        border-bottom: 1px solid rgba(var(--dark-dividers), 0.5);
      }
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        max-height: 0;
      }
      to {
        opacity: 1;
        max-height: 300px;
      }
    }
    ```

- **Chevron Rotation**:
  - Apply transition to chevrons to rotate smoothly:
    ```scss
    .transition-transform {
      transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .rotate-180 {
      transform: rotate(180deg);
    }
    ```
