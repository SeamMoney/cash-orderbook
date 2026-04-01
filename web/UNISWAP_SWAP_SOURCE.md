# Uniswap Interface — Swap Widget & Token Detail Page: Source Code Style Reference

> **Source**: [github.com/Uniswap/interface](https://github.com/Uniswap/interface) (main branch, commit ae3dd1a, March 30 2026)
> **Key packages**: `apps/web/`, `packages/ui/`, `packages/uniswap/`

---

## Table of Contents

1. [Design System Foundation (Spore)](#1-design-system-foundation-spore)
2. [Color System](#2-color-system)
3. [Typography / Fonts](#3-typography--fonts)
4. [Spacing Tokens](#4-spacing-tokens)
5. [Border Radius Tokens](#5-border-radius-tokens)
6. [Icon Sizes](#6-icon-sizes)
7. [Breakpoints](#7-breakpoints)
8. [Swap Page Wrapper](#8-swap-page-wrapper)
9. [Swap Section (Currency Input Container)](#9-swap-section-currency-input-container)
10. [Arrow / Switch Currencies Button](#10-arrow--switch-currencies-button)
11. [Currency Input Panel](#11-currency-input-panel)
12. [Select Token Button](#12-select-token-button)
13. [Swap Form Screen Layout](#13-swap-form-screen-layout)
14. [Numerical Input (Legacy Styled)](#14-numerical-input-legacy-styled)
15. [Swap Skeleton (Loading State)](#15-swap-skeleton-loading-state)
16. [Token Details Page Layout](#16-token-details-page-layout)
17. [Stats Section (TDP)](#17-stats-section-tdp)
18. [Transitions & Animations](#18-transitions--animations)
19. [Shadows](#19-shadows)
20. [Global CSS](#20-global-css)
21. [Theme Provider & Overrides](#21-theme-provider--overrides)

---

## 1. Design System Foundation (Spore)

Uniswap uses their **Spore Design System** built on **Tamagui**. Key architectural choices:

- **Tamagui** for cross-platform styled components (web/mobile/extension)
- **styled-components** (deprecated, still used in older web components)
- **Basel Grotesk** font family (Book weight = 485 on web, Medium weight = 535 on web)
- **Monospace**: `ui-monospace, SFMono-Regular, SF Mono, Menlo, Monaco, ...`
- Token-based theming with `$` prefix (e.g., `$surface2`, `$spacing16`)

**Source**: `packages/ui/src/theme/tokens.ts`, `packages/ui/src/theme/fonts.ts`

---

## 2. Color System

### Dark Theme (Primary — Spore Dark)

| Token | Value | Usage |
|-------|-------|-------|
| `neutral1` | `#FFFFFF` | Primary text |
| `neutral1Hovered` | `rgba(255, 255, 255, 0.85)` | Hovered text |
| `neutral2` | `rgba(255, 255, 255, 0.65)` | Secondary text |
| `neutral2Hovered` | `rgba(255, 255, 255, 0.85)` | Hovered secondary |
| `neutral3` | `rgba(255, 255, 255, 0.38)` | Tertiary/placeholder |
| `neutral3Hovered` | `rgba(255, 255, 255, 0.58)` | Hovered tertiary |
| `surface1` | `#131313` | Page background |
| `surface1Hovered` | `#1A1A1A` | Hovered background |
| `surface2` | `#1F1F1F` | Card/panel background |
| `surface2Hovered` | `#242424` | Hovered card |
| `surface3` | `rgba(255,255,255,0.12)` | Borders, dividers |
| `surface3Solid` | `#393939` | Solid variant of surface3 |
| `surface3Hovered` | `rgba(255,255,255,0.16)` | Hovered border |
| `surface4` | `rgba(255,255,255,0.20)` | Overlay |
| `surface5` | `rgba(0,0,0,0.04)` | Subtle bg |
| `accent1` | `#FF37C7` | Primary accent (pink) |
| `accent1Hovered` | `#E500A5` | Hovered accent |
| `accent2` | `rgba(255, 55, 199, 0.08)` | Accent background |
| `accent2Solid` | `#261621` | Solid accent bg |
| `accent3` | `#FFFFFF` | Secondary accent |
| `background` | `#000000` | HTML background |
| `scrim` | `rgba(0,0,0,0.60)` | Overlay scrim |

### Light Theme (Spore Light)

| Token | Value | Usage |
|-------|-------|-------|
| `neutral1` | `#131313` | Primary text |
| `neutral2` | `rgba(19, 19, 19, 0.63)` | Secondary text |
| `neutral3` | `rgba(19, 19, 19, 0.35)` | Tertiary |
| `surface1` | `#FFFFFF` | Page background |
| `surface2` | `#F9F9F9` | Card background |
| `surface2Hovered` | `#F2F2F2` | Hovered card |
| `surface3` | `rgba(19, 19, 19, 0.08)` | Borders |
| `surface3Solid` | `#F2F2F2` | Solid border |
| `accent1` | `#FF37C7` | Primary accent |
| `background` | `#FFFFFF` | HTML background |

### Status Colors (Dark)

| Token | Value |
|-------|-------|
| `statusSuccess` | `#21C95E` |
| `statusWarning` | `#FFBF17` |
| `statusCritical` | `#FF593C` |
| `statusCritical2` | `rgba(255, 89, 60, 0.12)` |

### Status Colors (Light)

| Token | Value |
|-------|-------|
| `statusSuccess` | `#0C8911` |
| `statusWarning` | `#996F01` |
| `statusCritical` | `#E10F0F` |

### Accent Colors (Shared)

| Name | Value |
|------|-------|
| `pinkBase` | `#FC74FE` |
| `pinkVibrant` | `#F50DB4` |
| `redBase` | `#FF5F52` |
| `greenBase` | `#0C8911` |
| `greenVibrant` | `#21C95E` |
| `blueBase` | `#4981FF` |
| `yellowBase` | `#FFBF17` |
| `orangeBase` | `#FF8934` |

### Legacy Web Theme Colors

| Token | Dark Value | Light Value |
|-------|-----------|-------------|
| `gray50` | — | `#F5F6FC` |
| `gray100` | — | `#E8ECFB` |
| `gray300` | — | `#98A1C0` |
| `gray700` | `#293249` | — |
| `gray900` | `#0D111C` | — |
| `blue400` | `#4C82FB` | `#4C82FB` |
| `green300` | `#40B66B` | — |
| `red400` | `#FA2B39` | — |

**Source**: `packages/ui/src/theme/color/colors.ts`, `apps/web/src/theme/colors.ts`

---

## 3. Typography / Fonts

### Font Family

```
Web: 'Basel, -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
Monospace: 'ui-monospace, SFMono-Regular, SF Mono, Menlo, Monaco, "Cascadia Mono", "Segoe UI Mono", "Roboto Mono", "Courier New", monospace'
```

### Font Weights (Web)

| Name | Weight |
|------|--------|
| Book (default) | `485` |
| Medium (buttons) | `535` |
| Theme heading | `485` |

### Font Scale (Web — `adjustedSize(n)` = `n + 1`)

| Token | Font Size | Line Height | Weight | Max Multiplier |
|-------|-----------|-------------|--------|----------------|
| `heading1` | 53px | 50.88px (0.96×) | 400 | 1.2 |
| `heading2` | 37px | 40px | 400 | 1.2 |
| `heading3` | 25px | 30px (1.2×) | 400 | 1.2 |
| `subheading1` | 19px | 24px | 400 | 1.4 |
| `subheading2` | 17px | 20px | 400 | 1.4 |
| `body1` | 19px | 24.7px (1.3×) | 400 | 1.4 |
| `body2` | 17px | 22.1px (1.3×) | 400 | 1.4 |
| `body3` | 15px | 19.5px (1.3×) | 400 | 1.4 |
| `body4` | 13px | 16px | 400 | 1.4 |
| `buttonLabel1` | 19px | 21.85px | 500 | 1.2 |
| `buttonLabel2` | 17px | 19.55px | 500 | 1.2 |
| `buttonLabel3` | 15px | 17.25px | 500 | 1.2 |
| `buttonLabel4` | 13px | 14.95px | 500 | 1.2 |
| `monospace` | 13px | 16px | — | 1.2 |

### Numerical Input (Swap Amount) — Legacy Styled

```css
font-size: 70px (default, configurable via $fontSize prop)
font-weight: 500
line-height: 60px
text-align: left
max-height: 84px
```

**Source**: `packages/ui/src/theme/fonts.ts`, `apps/web/src/pages/Swap/common/shared.tsx`

---

## 4. Spacing Tokens

| Token | Value (px) |
|-------|-----------|
| `$none` | 0 |
| `$spacing1` | 1 |
| `$spacing2` | 2 |
| `$spacing4` | 4 |
| `$spacing6` | 6 |
| `$spacing8` | 8 |
| `$spacing12` | 12 |
| `$spacing16` | 16 |
| `$spacing18` | 18 |
| `$spacing20` | 20 |
| `$spacing24` | 24 |
| `$spacing28` | 28 |
| `$spacing32` | 32 |
| `$spacing36` | 36 |
| `$spacing40` | 40 |
| `$spacing48` | 48 |
| `$spacing60` | 60 |

### Padding Aliases

| Token | Value |
|-------|-------|
| `$padding6` | 6 |
| `$padding8` | 8 |
| `$padding12` | 12 |
| `$padding16` | 16 |
| `$padding20` | 20 |
| `$padding36` | 36 |

### Gap Aliases

| Token | Value |
|-------|-------|
| `$gap4` | 4 |
| `$gap8` | 8 |
| `$gap12` | 12 |
| `$gap16` | 16 |
| `$gap20` | 20 |
| `$gap24` | 24 |
| `$gap32` | 32 |
| `$gap36` | 36 |

**Source**: `packages/ui/src/theme/spacing.ts`

---

## 5. Border Radius Tokens

| Token | Value (px) |
|-------|-----------|
| `$none` | 0 |
| `$rounded4` | 4 |
| `$rounded6` | 6 |
| `$rounded8` | 8 |
| `$rounded12` | 12 |
| `$rounded16` | 16 |
| `$rounded20` | 20 |
| `$rounded24` | 24 |
| `$rounded32` | 32 |
| `$roundedFull` | 999999 |

**Source**: `packages/ui/src/theme/borderRadii.ts`

---

## 6. Icon Sizes

| Token | Value (px) |
|-------|-----------|
| `icon8` | 8 |
| `icon12` | 12 |
| `icon16` | 16 |
| `icon18` | 18 |
| `icon20` | 20 |
| `icon24` | 24 |
| `icon28` | 28 |
| `icon32` | 32 |
| `icon36` | 36 |
| `icon40` | 40 |
| `icon44` | 44 |
| `icon48` | 48 |
| `icon56` | 56 |
| `icon64` | 64 |
| `icon70` | 70 |
| `icon100` | 100 |

**Source**: `packages/ui/src/theme/iconSizes.ts`

---

## 7. Breakpoints

| Name | Width (px) |
|------|-----------|
| `xxs` | 360 |
| `xs` | 380 |
| `sm` | 450 |
| `md` | 640 |
| `lg` | 768 |
| `xl` | 1024 |
| `xxl` | 1280 |
| `xxxl` | 1536 |

### Height Breakpoints

| Name | Height (px) |
|------|------------|
| `short` | 736 |
| `midHeight` | 800 |
| `lgHeight` | 960 |

### Legacy Web Media Widths

| Name | Width (px) |
|------|-----------|
| `deprecated_upToExtraSmall` | 500 |
| `deprecated_upToSmall` | 720 |
| `deprecated_upToMedium` | 960 |
| `deprecated_upToLarge` | 1280 |

**Max content width**: `1200px` (`MAX_CONTENT_WIDTH_PX`)

**Source**: `packages/ui/src/theme/breakpoints.ts`, `apps/web/src/theme/index.tsx`

---

## 8. Swap Page Wrapper

```
Component: PageWrapper (Tamagui styled Flex)
File: apps/web/src/components/swap/styled.tsx
```

| Property | Value |
|----------|-------|
| `max-width` | **480px** (`PAGE_WRAPPER_MAX_WIDTH`) |
| `width` | 100% |
| `padding-top` | 60px (`$spacing60`) |
| `padding-left/right` | 8px (`$spacing8`) |
| `padding-bottom` | 40px (`$spacing40`) |
| **@lg** `padding-top` | 48px (`$spacing48`) |
| **@md** `padding-top` | 20px (`$spacing20`) |

**Source**: `apps/web/src/components/swap/styled.tsx`

---

## 9. Swap Section (Currency Input Container)

```
Component: SwapSection (Tamagui styled Flex)
File: apps/web/src/components/swap/styled.tsx
```

| Property | Value |
|----------|-------|
| `background-color` | `$surface2` (dark: `#1F1F1F`, light: `#F9F9F9`) |
| `border-radius` | `$rounded16` (16px) |
| `height` | **120px** |
| `padding` | `$spacing16` (16px) |
| `position` | relative |
| `border-style` | solid |
| `border-width` | `$spacing1` (1px) |
| `border-color` | `$surface2` (same as bg — invisible default) |
| **hover** `border-color` | `$surface2Hovered` (dark: `#242424`) |
| **focus-within** `border-color` | `$surface3` (dark: `rgba(255,255,255,0.12)`) |

**Source**: `apps/web/src/components/swap/styled.tsx`

---

## 10. Arrow / Switch Currencies Button

### ArrowWrapper (Web — styled-components)

```
Component: ArrowWrapper (Tamagui styled Flex)
File: apps/web/src/components/swap/styled.tsx
```

| Property | Value |
|----------|-------|
| `display` | flex |
| `border-radius` | `$rounded12` (12px) |
| `height` | **40px** |
| `width` | **40px** |
| `position` | relative |
| `margin-top` | **-18px** |
| `margin-bottom` | **-18px** |
| `margin-left` | auto |
| `margin-right` | auto |
| `background-color` | `$surface2` (dark: `#1F1F1F`) |
| `border-width` | `$spacing4` (4px) |
| `border-style` | solid |
| `border-color` | `$surface1` (dark: `#131313`) |
| `z-index` | 2 |
| **hover** (clickable) | `cursor: pointer`, `opacity: 0.8` |

### ArrowContainer (inner)

| Property | Value |
|----------|-------|
| `display` | inline-flex |
| `align-items` | center |
| `justify-content` | center |
| `width` | 100% |
| `height` | 100% |

### SwapArrowButton (shared package — Tamagui)

```
Component: SwapArrowButton
File: packages/uniswap/src/features/transactions/swap/components/SwapArrowButton.tsx
```

| Property | Value |
|----------|-------|
| `background-color` | `$surface2` |
| `border-radius` | `$roundedFull` (999999px — circle) |
| `padding` | `$spacing8` (8px) |
| `align-self` | center |
| `hover bg` | `$surface2Hovered` |
| Press scale | `0.98` (via PRESS_SCALE constant) |
| Arrow icon | `$neutral2` color, default `icon24` (24px) |
| Arrow direction | `'south'` |

### SwitchCurrenciesButton Sizes

| Variant | Icon Size | Inner Padding | Border Width |
|---------|----------|--------------|-------------|
| Regular | 24px (`icon24`) | 10px (`spacing8 + spacing2`) | 4px (`spacing4`) |
| Small (short device) | 12px (`icon12`) | 8px (`spacing8`) | 1px (`spacing1`) |

**Source**: `apps/web/src/components/swap/styled.tsx`, `packages/uniswap/src/features/transactions/swap/components/SwapArrowButton.tsx`, `packages/uniswap/src/features/transactions/swap/form/SwapFormScreen/SwitchCurrenciesButton.tsx`

---

## 11. Currency Input Panel

```
Component: CurrencyInputPanel
File: packages/uniswap/src/components/CurrencyInputPanel/CurrencyInputPanel.tsx
       packages/uniswap/src/components/CurrencyInputPanel/CurrencyInputPanelInput.tsx
```

### Input Row

| Property | Value |
|----------|-------|
| `padding-vertical` | `$spacing8` (8px, default `inputRowPaddingVertical`) |
| `min-height` | `MIN_INPUT_FONT_SIZE + spacing36` (~36 + 36 = 72px area) |
| `flex-direction` | row |
| `align-items` | center |

### Fiat Symbol Prefix

| Property | Value |
|----------|-------|
| `font-family` | `$body` |
| `font-size` | Dynamic (matches amount input) |
| `color` | `$neutral1` |
| `line-height` | (inherits from AmountInput) |

### Amount Input

| Property | Value |
|----------|-------|
| `color` | `$neutral1` (normal) or `$neutral3` (placeholder) |
| `flex` | 1 |
| `font-family` | `$heading` |
| `font-weight` | `$book` (485 on web) |
| `overflow` | visible |
| `px` | `$none` (0) |
| `caret-color` | Uses `tokenColor` or `$neutral1` |
| `placeholder-color` | `$neutral3` |

### Placeholder "0" (when no currency selected)

| Property | Value |
|----------|-------|
| `color` | `$neutral3` |
| `font-size` | 36px |
| `font-family` | `$heading` |
| `font-weight` | `$book` |

**Source**: `packages/uniswap/src/components/CurrencyInputPanel/CurrencyInputPanelInput.tsx`

---

## 12. Select Token Button

```
Component: SelectTokenButton
File: packages/uniswap/src/components/CurrencyInputPanel/SelectTokenButton.tsx
```

### When token IS selected

| Property | Value |
|----------|-------|
| `background-color` | `$surface1` (dark: `#131313`) |
| `hover bg` | `$surface1Hovered` (dark: `#1A1A1A`) |
| `border-radius` | `$roundedFull` (pill shape) |
| `padding-left` | `$spacing4` (4px) |
| `padding-right` | `$spacing8` (8px) |
| `padding-vertical` | `$spacing4` (4px) |
| `gap` | `$gap8` (8px) — between logo and text |
| Logo size | `icon28` (28px, compact) or `icon36` (36px, desktop) |
| Text color | `$neutral1` |
| Text variant | `buttonLabel2` (17px, weight 535) — compact: `buttonLabel3` (15px) |
| Chevron color | `$neutral2` |
| Chevron size | `$icon20` (20px) |
| Press scale | `0.98` |

### When NO token selected ("Choose token")

| Property | Value |
|----------|-------|
| `background-color` | `tokenColor` or `$accent1` (dark: `#FF37C7`) |
| `hover bg` | `tokenColor` hovered or `$accent1Hovered` (`#E500A5`) |
| `border-radius` | `$roundedFull` |
| `padding-left` | `$spacing12` (12px) — compact: `$spacing8` |
| `padding-right` | `$spacing12` — compact: `$spacing8` |
| `padding-vertical` | `$spacing6` (6px) — compact: `$spacing4` |
| Text color | `$white` (`#FFFFFF`) |
| Text variant | `buttonLabel2` (17px) — compact: `buttonLabel3` (15px) |

**Source**: `packages/uniswap/src/components/CurrencyInputPanel/SelectTokenButton.tsx`

---

## 13. Swap Form Screen Layout

```
Component: SwapFormScreen → SwapFormContent
File: packages/uniswap/src/features/transactions/swap/form/SwapFormScreen/SwapFormScreen.tsx
```

### Content Layout

| Property | Value |
|----------|-------|
| `flex-direction` | column |
| Inner container | `TransactionModalInnerContainer` |
| Content wrapper | `Flex` with `gap` (set by children) |
| Settings | `SwapFormSettings` row above input panels |
| Input panel | `SwapFormCurrencyInputPanel` |
| Switch button | `SwitchCurrenciesButton` (centered between panels) |
| Output panel | `SwapFormCurrencyOutputPanel` |
| Details | `SwapFormScreenDetails` (swap details row) |

### Focused Style (CurrencyInput)

Applied when currency input panel is focused. The style is a per-component hook (`useCurrencyInputFocusedStyle`), typically adding:
- Elevated border color to `$surface3`
- Possible subtle background shift

**Source**: `packages/uniswap/src/features/transactions/swap/form/SwapFormScreen/SwapFormScreen.tsx`

---

## 14. Numerical Input (Legacy Styled — Web)

```
Component: StyledNumericalInput, NumericalInputFontStyle
File: apps/web/src/pages/Swap/common/shared.tsx
```

| Property | Value |
|----------|-------|
| `font-size` | **70px** (default, configurable) |
| `font-weight` | **500** |
| `line-height` | **60px** |
| `text-align` | left |
| `max-height` | **84px** |
| `max-width` | 100% (or `calc(100% - 43px)` with prefix) |
| `width` | 43px default (dynamic based on content) |
| `::placeholder opacity` | 1 |

### Hidden Measurement Span (NumericalInputMimic)

| Property | Value |
|----------|-------|
| `position` | absolute |
| `visibility` | hidden |
| `bottom` | 0px |
| `right` | 0px |
| Same font as input | ✓ |

**Source**: `apps/web/src/pages/Swap/common/shared.tsx`

---

## 15. Swap Skeleton (Loading State)

```
Component: SwapSkeleton
File: apps/web/src/components/swap/SwapSkeleton.tsx
```

### Outer Wrapper (LoadingWrapper)

| Property | Value |
|----------|-------|
| `display` | flex |
| `flex-direction` | column |
| `gap` | **4px** |
| `justify-content` | space-between |
| `padding` | **8px** |
| `border` | `1px solid ${theme.surface3}` |
| `border-radius` | **16px** |
| `background-color` | `${theme.surface1}` |

### InputColumn

| Property | Value |
|----------|-------|
| `background-color` | `${theme.surface2}` |
| `border-radius` | **16px** |
| `gap` | **30px** |
| `padding` | **48px 12px** |

### Blob (skeleton placeholder)

| Property | Value |
|----------|-------|
| `background-color` | `${theme.surface2}` |
| `border-radius` | 4px |
| `height` | 56px |
| `width` | 100% or custom |

### ModuleBlob

| Property | Value |
|----------|-------|
| `background-color` | `${theme.surface3}` |
| `height` | 36px |

### Title

| Property | Value |
|----------|-------|
| Text content | "Swap" |
| `color` | `$neutral1` |
| `font-variant` | `buttonLabel2` (17px medium) |
| `padding-top` | `$spacing4` |
| `padding-bottom` | `$spacing16` |
| `padding-left` | `$spacing12` |

### Arrow (inside skeleton)

| Property | Value |
|----------|-------|
| `position` | absolute |
| `left` | 50% |
| `transform` | `translate(-50%, -50%)` |
| `margin` | 0 |
| Icon | `ArrowDown`, size `$icon.16`, color `$neutral3` |

**Source**: `apps/web/src/components/swap/SwapSkeleton.tsx`

---

## 16. Token Details Page Layout

```
Component: TokenDetailsLayout, LeftPanel, RightPanel
File: apps/web/src/pages/TokenDetails/components/skeleton/Skeleton.tsx
```

### TokenDetailsLayout (main container)

| Property | Value |
|----------|-------|
| `display` | flex-row |
| `justify-content` | center |
| `width` | 100% |
| `gap` | **80px** |
| `margin-top` | `$spacing32` (32px) |
| `padding-bottom` | `$spacing48` (48px) |
| `padding-left/right` | `$spacing40` (40px) |
| **@lg** `padding-top` | 0 |
| **@lg** `padding-left/right` | `$padding20` (20px) |
| **@lg** `padding-bottom` | 52px |
| **@xl** `flex-direction` | column |
| **@xl** `align-items` | center |
| **@xl** `gap` | `$none` |

### LeftPanel

| Property | Value |
|----------|-------|
| `width` | 100% |
| `flex-grow` | 1 |
| `flex-shrink` | 1 |

### RightPanel (Swap Component)

| Property | Value |
|----------|-------|
| `width` | **360px** (`SWAP_COMPONENT_WIDTH`) |
| `gap` | **40px** |
| **@xl** `width` | 100% |
| **@xl** `max-width` | 780px |

**Source**: `apps/web/src/pages/TokenDetails/components/skeleton/Skeleton.tsx`

---

## 17. Stats Section (TDP)

```
Component: StatsSection, StatsWrapper, StatWrapper
File: apps/web/src/pages/TokenDetails/components/info/StatsSection.tsx
```

### StatsWrapper

| Property | Value |
|----------|-------|
| `flex-direction` | row |
| `flex-wrap` | wrap |
| `gap` | `$gap20` (20px) |
| `width` | 100% |

### StatWrapper

| Property | Value |
|----------|-------|
| `flex-direction` | column |
| `flex` | `1 1 calc(50% - 20px)` (2-column grid with gap) |
| `gap` | `$gap4` (4px) |

### Stat Title

| Property | Value |
|----------|-------|
| Text variant | `body3` (15px) |
| `color` | `$neutral2` |

### Stat Value

| Property | Value |
|----------|-------|
| Text variant | `heading3` (25px) |
| `color` | `$neutral1` |

### Section Header ("Stats")

| Property | Value |
|----------|-------|
| Text variant | `heading3` (25px) |
| `color` | `$neutral1` |
| `padding-top` | `$spacing24` (24px) |
| `padding-bottom` | `$spacing4` (4px) |

**Source**: `apps/web/src/pages/TokenDetails/components/info/StatsSection.tsx`

---

## 18. Transitions & Animations

### Duration Tokens

| Name | Value |
|------|-------|
| `slow` | 500ms |
| `medium` | 250ms |
| `fast` | 125ms |

### Timing Functions

| Name | Value |
|------|-------|
| `ease` | ease |
| `in` | ease-in |
| `out` | ease-out |
| `inOut` | ease-in-out |

### Opacity States

| State | Value |
|-------|-------|
| `hover` | 0.6 |
| `click` | 0.4 |
| `disabled` | 0.5 |
| `enabled` | 1 |

### Press Scale

```
PRESS_SCALE = 0.98 (used on TouchableArea / buttons)
```

### CSS Keyframe Animations (global.css)

```css
@keyframes cloud-float-animation {
  0%   { transform: translateY(-8px); }
  50%  { transform: translateY(8px); }
  100% { transform: translateY(-8px); }
}

@keyframes token-rotate-animation {
  0%   { transform: rotate(-22deg); }
  100% { transform: rotate(22deg); }
}
```

### Layout Animation Classes

```css
.layout-animation-ease-in-ease-out * { transition: all 0.3s ease-in-out; }
.layout-animation-linear *           { transition: all 0.5s linear; }
```

### Fade In

```css
animation: fadeIn 125ms ease-in;
```

**Source**: `apps/web/src/theme/index.tsx`, `apps/web/src/theme/styles.ts`, `apps/web/src/global.css`

---

## 19. Shadows

### Deprecated Shadows (still in use)

```js
// Dark mode deep shadow
'12px 16px 24px rgba(0, 0, 0, 0.24), 12px 8px 12px rgba(0, 0, 0, 0.24), 4px 4px 8px rgba(0, 0, 0, 0.32)'

// Light mode deep shadow
'8px 12px 20px rgba(51, 53, 72, 0.04), 4px 6px 12px rgba(51, 53, 72, 0.02), 4px 4px 8px rgba(51, 53, 72, 0.04)'

// Shallow shadow (both modes)
'0px 0px 10px 0px rgba(34, 34, 34, 0.04)'
```

### Hover/State Overlays

```js
deprecated_stateOverlayHover:   opacify(8, '#98A1C0')   // ~rgba(152,161,192,0.08)
deprecated_stateOverlayPressed: opacify(24, '#B8C0DC')  // ~rgba(184,192,220,0.24)
deprecated_hoverDefault:        opacify(8, '#98A1C0')   // ~rgba(152,161,192,0.08)
```

**Source**: `apps/web/src/theme/deprecatedColors.ts`

---

## 20. Global CSS

### Scrollbar Styling

```css
html {
  overscroll-behavior: none;
  overflow-x: hidden;
}

::-webkit-scrollbar {
  background-color: transparent;
  width: 6px;
}
::-webkit-scrollbar-track { background-color: transparent; }
::-webkit-scrollbar-thumb {
  border-radius: 8px;
  width: 8px;
  background-color: gray;
}
scrollbar-width: thin;
scrollbar-color: gray transparent;
```

### Themed Global (styled-components)

```css
html {
  color: ${theme.neutral1};
  background-color: ${theme.background} !important;
}
a { color: ${theme.accent1}; }
```

**Source**: `apps/web/src/global.css`, `apps/web/src/theme/index.tsx`

---

## 21. Theme Provider & Overrides

### Token Color Overrides

When on TDP (Token Detail Page), the swap widget receives `tokenColor` which overrides:
- `accent1` → token brand color
- `accent2` → derived from `accent1 + surface1` blend
- `neutralContrast` → computed to ensure contrast against `accent1`

### Blur

```js
light: 'blur(12px)'
```

### Grid/Gap Values (legacy)

```js
xs: '4px',
sm: '8px',
md: '12px',
lg: '24px',
xl: '32px'
```

### Mobile Bottom Bar Height

```js
mobileBottomBarHeight: 48
```

**Source**: `apps/web/src/theme/index.tsx`

---

## Component Hierarchy Summary

```
SwapPage
└── MultichainContextProvider
    └── SwapAndLimitContextProvider
        └── PrefetchBalancesWrapper
            └── Swap
                └── SwapFormStoreContextProvider
                    └── SwapDependenciesStoreContextProvider
                        └── SwapTransactionSettingsStoreContextProvider
                            └── UniversalSwapFlow
                                ├── SegmentedControl (Swap | Limit | Buy | Sell tabs)
                                ├── SwapFlow (when Swap tab)
                                │   └── TransactionModal
                                │       └── SwapFormScreen
                                │           ├── SwapFormSettings
                                │           ├── SwapFormCurrencyInputPanel
                                │           │   └── CurrencyInputPanel
                                │           │       ├── CurrencyInputPanelHeader
                                │           │       ├── CurrencyInputPanelInput
                                │           │       │   ├── AmountInput (dynamic font sizing)
                                │           │       │   └── SelectTokenButton
                                │           │       ├── CurrencyInputPanelValue (USD value)
                                │           │       └── CurrencyInputPanelBalance
                                │           ├── SwitchCurrenciesButton
                                │           │   └── SwapArrowButton
                                │           ├── SwapFormCurrencyOutputPanel
                                │           └── SwapFormScreenDetails
                                ├── LimitFormWrapper (when Limit tab)
                                └── BuyForm (when Buy/Sell tab)

TokenDetailsPage
└── TDPStoreContextProvider
    └── TokenDetailsContent
        ├── TokenDetailsLayout (flex-row, gap: 80px)
        │   ├── LeftPanel (flex-grow)
        │   │   ├── DetailsHeaderContainer
        │   │   │   └── TokenDetailsHeader (price, chart)
        │   │   ├── ChartSection
        │   │   ├── StatsSection
        │   │   ├── TokenDescription
        │   │   ├── BridgedAssetSection
        │   │   └── ActivitySection
        │   └── RightPanel (width: 360px)
        │       ├── TDPSwapComponent (Swap widget)
        │       ├── BalanceSummary
        │       └── BridgedAssetSection
        └── TokenCarousel
```

---

## Key Findings for Replication

### Critical Dimensions
- **Swap widget max-width**: 480px
- **TDP swap widget width**: 360px
- **TDP layout gap**: 80px
- **SwapSection height**: 120px
- **SwapSection padding**: 16px
- **SwapSection border-radius**: 16px
- **Arrow button size**: 40×40px (web), with 4px border
- **Arrow overlap**: -18px top and bottom margins

### Critical Colors (Dark Mode)
- **Background**: `#000000` (html), `#131313` (surface1)
- **Card background**: `#1F1F1F` (surface2)
- **Card hover**: `#242424` (surface2Hovered)
- **Border**: `rgba(255,255,255,0.12)` (surface3)
- **Primary text**: `#FFFFFF` (neutral1)
- **Secondary text**: `rgba(255,255,255,0.65)` (neutral2)
- **Placeholder**: `rgba(255,255,255,0.38)` (neutral3)
- **Accent/CTA**: `#FF37C7` (accent1 pink)
- **Success green**: `#21C95E`
- **Error red**: `#FF593C`
- **Warning yellow**: `#FFBF17`

### Font Stack
```
Basel, -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif
```
- Book weight: **485** (web default)
- Medium weight: **535** (buttons)
- Heading weight in theme: **485**

### The Swap Input Amount
- Legacy styled: 70px font, 500 weight, 60px line-height
- Modern (Tamagui CurrencyInputPanel): Dynamic sizing using `useCurrencyInputFontSize` hook
- Heading font family, book weight
