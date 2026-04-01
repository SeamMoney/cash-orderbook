# Uniswap TDP — Exact Visual Specifications

> Reverse-engineered from https://github.com/Uniswap/interface (main branch).
> All values cite the source file. "Ours" = current `cash-orderbook/web` code.

---

## 1. Theme / Design Tokens (Dark Mode)

### Colors
*Source: `packages/ui/src/theme/color/colors.ts` — sporeDark object*

| Token | Uniswap Value | Our Value | Notes |
|---|---|---|---|
| background | `#000000` (colors.black via darkTheme) | `#000000` (--color-background) | ✅ Match |
| neutral1 (primary text) | `#FFFFFF` (sporeDark.neutral1) | `#FFFFFF` (--color-foreground) | ✅ Match |
| neutral2 (secondary text) | `rgba(255, 255, 255, 0.65)` | `#888888` (--color-text-secondary) | ❌ **Diff**: ours is opaque gray, Uniswap uses 65% white opacity |
| neutral3 (muted text) | `rgba(255, 255, 255, 0.38)` | `#555555` (--color-text-muted) | ❌ **Diff**: ours is opaque gray, Uniswap uses 38% white opacity |
| surface1 (card bg) | `#131313` (sporeDark.surface1) | `#111111` (--color-card) | ❌ **Diff**: change `#111111` → `#131313` |
| surface1Hovered | `#1A1A1A` | `#1A1A1A` (--color-surface-hover) | ✅ Match |
| surface2 (input bg) | `#1F1F1F` (sporeDark.surface2) | `#1A1A1A` (--color-secondary) | ❌ **Diff**: change `#1A1A1A` → `#1F1F1F` |
| surface2Hovered | `#242424` | N/A | ❌ Missing — add `#242424` |
| surface3 (borders) | `rgba(255,255,255,0.12)` | `#1A1A1A` (--color-border) | ❌ **Diff**: Uniswap uses semi-transparent border, we use opaque |
| surface3Solid | `#393939` | `#2A2A2A` (--color-surface-raised) | ❌ **Diff**: change `#2A2A2A` → `#393939` |
| accent1 (primary accent) | `#FF37C7` (pink) | `#00D54B` (green) | Intentional brand difference — keep ours |
| statusSuccess (green) | `#21C95E` | `#00D54B` (--color-cash-green) | Intentional brand difference — keep ours |
| statusCritical (red) | `#FF593C` | `#FF3B30` (--color-cash-red) | Close enough, minor diff |
| scrim | `rgba(0,0,0,0.60)` | N/A | Missing — add for modals |

### Font Family
*Source: `packages/ui/src/theme/fonts.ts` — baselMedium / baselBook*

| Token | Uniswap Value | Our Value | Notes |
|---|---|---|---|
| Primary (web) | `Basel, -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif` | Geist Sans (`var(--font-geist-sans)`) | Intentional brand difference — keep ours |
| Monospace (web) | `ui-monospace, SFMono-Regular, SF Mono, Menlo, Monaco, ...` | Geist Mono (`var(--font-geist-mono)`) | Intentional brand difference — keep ours |

### Font Weights
*Source: `packages/ui/src/theme/fonts.ts` — BOOK_WEIGHT_WEB / MEDIUM_WEIGHT_WEB*

| Token | Uniswap Value | Our Value | Notes |
|---|---|---|---|
| Book (body/heading) | `485` | `400-700` (various) | ❌ **Note**: Uniswap uses non-standard 485 weight for their Basel font. With Geist Sans, use `font-medium` (500) for body and `font-semibold` (600) for headings |
| Medium (buttons) | `535` | `600-700` (font-semibold/bold) | ❌ Similar — Uniswap's 535 maps roughly to our `font-semibold` (600) |

### Font Sizes (Web = adjustedSize adds +1 to base)
*Source: `packages/ui/src/theme/fonts.ts`*

| Variant | Uniswap fontSize | Uniswap lineHeight | Our equivalent |
|---|---|---|---|
| heading1 | 53px | ~50.88px (×0.96) | Not used |
| heading2 | 37px | 40px | Not used currently |
| heading3 | 25px | 30px (×1.2) | `text-lg` (18px) ❌ |
| subheading1 | 19px | 24px | Not used |
| subheading2 | 17px | 20px | Not used |
| body1 | 19px | ~24.7px (×1.3) | Not used |
| body2 | 17px | ~22.1px (×1.3) | ~`text-sm` (14px) ❌ |
| body3 | 15px | ~19.5px (×1.3) | Not used |
| body4 | 13px | 16px | `text-xs` (12px) ❌ |
| buttonLabel1 | 19px | ~21.85px | Not used |
| buttonLabel2 | 17px | ~19.55px | `text-base` (16px) close |
| buttonLabel3 | 15px | ~17.25px | `text-sm` (14px) ❌ |

### Border Radii
*Source: `packages/ui/src/theme/borderRadii.ts`*

| Token | Uniswap | Tailwind equiv |
|---|---|---|
| rounded4 | 4px | `rounded` (4px) |
| rounded8 | 8px | `rounded-lg` (8px) |
| rounded12 | 12px | `rounded-xl` (12px) |
| rounded16 | 16px | `rounded-2xl` (16px) |
| rounded20 | 20px | `rounded-[20px]` |
| rounded24 | 24px | `rounded-3xl` (24px) |
| rounded32 | 32px | `rounded-[32px]` |
| roundedFull | 999999px | `rounded-full` |

### Breakpoints
*Source: `packages/ui/src/theme/breakpoints.ts`*

| Token | Uniswap | Tailwind default | Notes |
|---|---|---|---|
| sm | 450px | 640px | Very different |
| md | 640px | 768px | Uniswap md = Tailwind sm |
| lg | 768px | 1024px | Uniswap lg = Tailwind md |
| xl | 1024px | 1280px | Uniswap xl = Tailwind lg |
| xxl | 1280px | 1536px | — |

**IMPORTANT**: The `$xl` breakpoint in Uniswap (1024px) is where the layout switches from 2-column to 1-column. This matches our `xl:` breakpoint.

### Deprecated Media Widths
*Source: `apps/web/src/theme/index.tsx`*

| Token | Value |
|---|---|
| upToExtraSmall | 500px |
| upToSmall | 720px |
| upToMedium | 960px |
| upToLarge | 1280px |

---

## 2. Overall Page Layout

### TokenDetailsLayout
*Source: `apps/web/src/pages/TokenDetails/components/skeleton/Skeleton.tsx`*

```
TokenDetailsLayout = styled(Flex, {
  row: true,
  justifyContent: 'center',
  width: '100%',
  gap: 80,                    // 80px gap between columns
  mt: '$spacing32',           // 32px margin-top
  pb: '$spacing48',           // 48px padding-bottom
  px: '$spacing40',           // 40px padding-x (desktop)
  $lg: { pt: 0, px: '$padding20', pb: 52 },   // 20px padding-x at ≤768px
  $xl: { flexDirection: 'column', alignItems: 'center', gap: '$none' },  // stack at ≤1024px
})
```

| Property | Uniswap | Ours | Diff |
|---|---|---|---|
| max-width | `1200px` (MAX_CONTENT_WIDTH_PX) | `max-w-[1200px]` | ✅ Match |
| column gap | `80px` | `gap-20` (80px) | ✅ Match |
| margin-top | `32px` ($spacing32) | `mt-8` (32px) | ✅ Match |
| padding-bottom | `48px` ($spacing48) | `pb-12` (48px) | ✅ Match |
| padding-x (desktop) | `40px` ($spacing40) | `xl:px-10` (40px) | ✅ Match |
| padding-x (mobile) | `20px` ($padding20, at ≤768px) | `px-5` (20px) | ✅ Match |
| stack breakpoint | `$xl` = 1024px | `xl:flex-row` (≥1280px) | ❌ **Diff**: Uniswap stacks at ≤1024px, we stack at <1280px. Change our breakpoint from `xl` (1280px) to `lg` (1024px) |

### LeftPanel
*Source: `Skeleton.tsx`*

```
LeftPanel = styled(Flex, {
  width: '100%',
  flexGrow: 1,
  flexShrink: 1,
})
```

| Property | Uniswap | Ours | Diff |
|---|---|---|---|
| layout | flex-1 min-w-0 | `flex-1 min-w-0` | ✅ Match |
| spacing (children) | Implicit from component ordering | `space-y-4 md:space-y-6` | See individual section gaps below |

### RightPanel
*Source: `Skeleton.tsx`*

```
RightPanel = styled(Flex, {
  gap: 40,                     // 40px between swap + other items
  width: SWAP_COMPONENT_WIDTH, // 360px
  $xl: { width: '100%', maxWidth: 780 },
})
```

| Property | Uniswap | Ours | Diff |
|---|---|---|---|
| width | `360px` | `w-[360px]` | ✅ Match |
| gap (internal) | `40px` | N/A (single child) | ✅ N/A |
| sticky top | Based on `useAppHeaderHeight()` (≈72px) | `top-[72px]` | Needs to match nav height |

---

## 3. Navbar

### Nav Container
*Source: `apps/web/src/components/NavBar/index.tsx` + `packages/ui/src/theme/heights.ts`*

```
INTERFACE_NAV_HEIGHT = 72

Nav = styled(TamaguiNav, {
  position: 'unset',
  px: '$padding12',     // 12px
  width: '100%',
  height: INTERFACE_NAV_HEIGHT,  // 72px
  zIndex: zIndexes.sticky,
  justifyContent: 'center',
})
```

| Property | Uniswap | Ours | Diff |
|---|---|---|---|
| height | `72px` | `h-14` (56px) | ❌ **Diff**: change `h-14` → `h-[72px]` |
| padding-x | `12px` ($padding12) | `px-4` (16px) → `sm:px-6` (24px) | ❌ **Diff**: change to `px-3` (12px) |
| max-width (inner) | No max-width on nav | `max-w-[1400px]` | ❌ **Diff**: Uniswap has no max-width constraint on nav bar. Consider removing or keeping as design choice |
| z-index | `zIndexes.sticky` (1020) | `z-50` (50) | Different z-index systems, both work |
| background | Transparent / `theme.background` | `bg-background` | ✅ Match concept |
| position | `position: unset` (parent is sticky) | `sticky top-0` | ✅ Functionally same |

### Nav Tab Items
*Source: `NavBar/index.tsx` — NavItems CSS*

```css
gap: 12px;
@media (max-width: 640px) { gap: 4px; }
```

| Property | Uniswap | Ours | Diff |
|---|---|---|---|
| Tab gap | `12px` | `gap-1` (4px) | ❌ **Diff**: change `gap-1` → `gap-3` (12px) |
| Tab padding | Varies by component | `px-4 py-1.5` | See tab styling specifics |
| Tab text (active) | color `$neutral1` (#FFFFFF) | `text-white` | ✅ Match |
| Tab text (inactive) | color `$neutral2` (rgba(255,255,255,0.65)) | `text-[#9B9B9B]` | ❌ **Diff**: change to `text-white/65` or keep #9B9B9B as close approximation |
| Tab font | body2-ish, ~17px | `text-sm` (14px) | ❌ **Diff**: change to `text-[15px]` or `text-sm` is close enough for Geist |

### Search Bar
*Source: Not detailed in NavBar/index.tsx — SearchBar is a separate component. From live inspection, it's roughly:*

| Property | Uniswap (approx) | Ours | Diff |
|---|---|---|---|
| border-radius | `rounded-full` (~999px) | `rounded-full` | ✅ Match |
| background | `surface2` (#1F1F1F) | `bg-card` (#111111) | ❌ **Diff**: change to `bg-[#1F1F1F]` |
| border | `1px solid surface3` | `border border-border` | ❌ Border color differs (see colors) |
| width | ~240px (varies) | `w-[200px]` | ❌ **Diff**: increase to `w-[240px]` |

---

## 4. Breadcrumb

### BreadcrumbNavContainer
*Source: `apps/web/src/components/BreadcrumbNav/index.tsx`*

```
BreadcrumbNavContainer = styled(Flex, {
  row: true,
  alignItems: 'center',
  gap: '$gap4',    // 4px
  mb: 20,          // 20px
  width: 'fit-content',
})
```

| Property | Uniswap | Ours | Diff |
|---|---|---|---|
| margin-bottom | `20px` | `mb-3` (12px) | ❌ **Diff**: change `mb-3` → `mb-5` (20px) |
| gap | `4px` ($gap4) | `gap-1.5` (6px) | ❌ **Diff**: change `gap-1.5` → `gap-1` (4px) |
| text color (link) | `$neutral2` (rgba(255,255,255,0.65)) | `text-muted-foreground` (#888) | Close |
| hover color | `$neutral2Hovered` (rgba(255,255,255,0.85)) | `hover:text-white` | ❌ Slightly different — Uniswap hover is 85% white, not pure white |
| separator | `RotatableChevron` icon (chevron right) | `>` text character | ❌ **Diff**: change from `>` text to a chevron SVG icon |

### BreadcrumbWrapper (Skeleton.tsx — the wrapper ABOVE the main layout)
*Source: `Skeleton.tsx`*

```
BreadcrumbWrapper = styled(Flex, {
  width: '100%',
  px: '$spacing40',    // 40px
  pt: '$spacing48',    // 48px
  $lg: { px: '$padding20' },  // 20px at ≤768px
})
```

| Property | Uniswap | Ours | Diff |
|---|---|---|---|
| padding-top | `48px` | Breadcrumb is inside the main content area | ❌ **Diff**: Uniswap places breadcrumb ABOVE TokenDetailsLayout with 48px top padding |

---

## 5. Token Details Header

### DetailsHeaderContainer
*Source: `apps/web/src/components/Explore/stickyHeader/DetailsHeaderContainer.tsx`*

```
Flex {
  position: 'sticky',
  top: appHeaderHeight (≈72px),
  zIndex: '$default',
  backgroundColor: '$background',
  row: true,
  width: '100%',
  justifyContent: 'space-between',
  alignItems: 'center',
  pt: isCompact ? '$spacing8' : '$spacing16',
  pb: isCompact ? '$spacing8' : '$spacing16',
  gap: '$gap12',
  $platform-web: { transition: HEADER_TRANSITION ('all 0.2s ease') },
}
```

### Token Logo
*Source: `apps/web/src/components/Explore/stickyHeader/constants.ts` + `getHeaderLogoSize.ts`*

```
HEADER_LOGO_SIZE = {
  compact: iconSizes.icon40,   // 40px
  medium: iconSizes.icon48,    // 48px  (mobile)
  expanded: iconSizes.icon56,  // 56px  (desktop default)
}
```

| Property | Uniswap | Ours | Diff |
|---|---|---|---|
| Logo size (desktop) | `56px` | `h-9 w-9` (36px) | ❌ **Diff**: change `h-9 w-9` → `h-14 w-14` (56px) |
| Logo size (mobile) | `48px` | `h-9 w-9` (36px) | ❌ **Diff**: change to `h-12 w-12` (48px) on mobile |
| Logo border-radius | Circular (rounded-full) | `rounded-full` | ✅ Match |

### Token Name (Title)
*Source: `getHeaderLogoSize.ts` + `TokenDetailsHeader.tsx`*

```
getHeaderTitleVariant:
  - isMobile → 'subheading1' (19px / 24px lineHeight)
  - isCompact → 'subheading2' (17px / 20px lineHeight)  
  - default → 'heading3' (25px / 30px lineHeight)

Token name: <Text variant={titleVariant} color="$neutral1">
Token symbol: <Text variant="body2" color="$neutral2">
```

| Property | Uniswap | Ours | Diff |
|---|---|---|---|
| Token name font-size (desktop) | `25px` (heading3) | `text-xl` (20px) | ❌ **Diff**: change to `text-[25px]` or `text-2xl` (24px) |
| Token name line-height | `30px` (25×1.2) | default | ❌ **Diff**: add `leading-[30px]` |
| Token name font-weight | `485` | `font-bold` (700) | ❌ **Diff**: change to `font-medium` (500) — Uniswap uses lighter weight |
| Symbol font-size | `17px` (body2) | `text-sm` (14px) | ❌ **Diff**: change to `text-[17px]` |
| Symbol color | `$neutral2` (rgba(255,255,255,0.65)) | `text-muted-foreground` (#888) | Close |
| Gap (logo to text) | `$gap12` (12px) | `gap-3` (12px) | ✅ Match |
| Gap (name to symbol) | `$gap12` (12px) | `gap-2` (8px) | ❌ **Diff**: change `gap-2` → `gap-3` (12px) |
| Header sticky | Yes, with smooth transition | Not sticky | ❌ **Diff**: Uniswap header is sticky with compact mode on scroll |
| Transition | `all 0.2s ease` | None | ❌ Missing transition |

---

## 6. Price Display (Above Chart)

*Source: Uniswap shows price in a header-like component using shared hooks. The price text uses `heading2` variant.*

| Property | Uniswap | Ours | Diff |
|---|---|---|---|
| Price font-size | `37px` (heading2) | `text-2xl sm:text-3xl` (24px/30px) | ❌ **Diff**: change to `text-[36px]` |
| Price line-height | `40px` | default | ❌ **Diff**: add `leading-[40px]` |
| Price font-weight | `485` | `font-bold` (700) | ❌ **Diff**: change to `font-medium` (500) |
| Price color | `$neutral1` (#FFF) | `text-white` | ✅ Match |
| Change % font-size | `body2` (17px) | `text-sm` (14px) | ❌ **Diff**: change to `text-[17px]` |
| Change % positive color | `$statusSuccess` (#21C95E) | `text-cash-green` (#00D54B) | Brand choice — keep |
| Change % negative color | `$statusCritical` (#FF593C) | `text-cash-red` (#FF3B30) | Brand choice — keep |
| Gap (price to change) | Inline with small gap | `gap-3` (12px) | Reasonable |
| Margin below price | Part of chart section flow | `mb-3` (12px) | Check against Uniswap layout |

---

## 7. Chart Section

### Chart Container
*Source: `apps/web/src/components/Explore/constants.ts`*

```
EXPLORE_CHART_HEIGHT_PX = 356
```

| Property | Uniswap | Ours | Diff |
|---|---|---|---|
| Chart height | `356px` | `h-[356px]` | ✅ Match |
| Border-radius | COULD NOT DETERMINE from chart source (likely `rounded12` or none) | `rounded-lg` (8px) | May differ |
| Background | Transparent (chart draws on page bg) | Transparent | ✅ Match |

### Chart Controls
*Source: `apps/web/src/pages/TokenDetails/components/chart/ChartControls.tsx`*

```
ChartActionsContainer: row, gap none, alignItems center, justifyContent space-between, flexWrap wrap
```

| Property | Uniswap | Ours | Diff |
|---|---|---|---|
| Layout | flex row, space-between, wrap | flex row, space-between | ✅ Match concept |
| Chart type toggle | `AdvancedPriceChartToggle` (Line/Candlestick) | Candle/Line buttons | ✅ Similar |
| Toggle bg | COULD NOT DETERMINE (likely `surface2` or `surface3`) | `bg-secondary/50` | Check |
| Toggle active | COULD NOT DETERMINE exactly | `bg-primary text-black` (green) | ❌ Uniswap likely uses `$accent1` or neutral treatment |
| Time selector | `SegmentedControl` with pill style | Plain text buttons | ❌ **Diff**: Uniswap uses a proper SegmentedControl (pill-style selector), we use plain text |
| Time options | 1H, 1D, 1W, 1M, 1Y, ALL | 1H, 1D, 1W, 1M, 1Y, ALL | ✅ Match |
| Time text size | Part of SegmentedControl (likely ~13-15px) | `text-xs` (12px) | ❌ **Diff**: slightly small |
| Chart type options | Price, Volume, TVL (token-details specific) | Candle, Line | Different — ours is chart mode, theirs is data type |

---

## 8. Stats Section

### Section Header
*Source: `apps/web/src/pages/TokenDetails/components/info/StatsSection.tsx`*

```
<Text variant="heading3">{t('common.stats')}</Text>
// heading3 = 25px, lineHeight 30px, fontWeight 485
```

| Property | Uniswap | Ours | Diff |
|---|---|---|---|
| Title font-size | `25px` (heading3) | `text-lg` (18px) | ❌ **Diff**: change `text-lg` → `text-[25px]` or `text-2xl` (24px) |
| Title font-weight | `485` | `font-semibold` (600) | ❌ Change to `font-medium` (500) |
| Title margin-bottom | Implicit from layout | `mb-4` (16px) | Check |

### Stats Layout (StatsWrapper)
*Source: `StatsSection.tsx`*

```
STATS_GAP = '$gap20'  // 20px

StatsWrapper = <Flex row flexWrap="wrap" width="100%" gap={STATS_GAP}>

StatWrapper (when tableRow=true) = <Flex
  row
  justifyContent="space-between"
  width="50%"          // half-width for 2-column wrapping
  pb="$spacing16"      // 16px bottom padding
  borderBottomWidth={0.5}
  borderColor="$surface3"
>
```

| Property | Uniswap | Ours | Diff |
|---|---|---|---|
| Wrapper layout | `flex-row flex-wrap` | `flex flex-wrap` | ✅ Match concept |
| Gap | `20px` ($gap20) | `gap-5` (20px) | ✅ Match |
| Stat width | `50%` (2-column) with row layout | Auto (flex-wrap) | ❌ **Diff**: Uniswap stats are 2-column rows (label left, value right). Each stat is a full-width row within a 50% column. Ours stack label-above-value |
| Stat divider | `0.5px border-bottom, $surface3` | None | ❌ **Diff**: add bottom border to each stat row |

### Individual Stat
*Source: `StatsSection.tsx` — Stat component*

```
<StatWrapper tableRow>
  <MouseoverTooltip text={description}>
    <Text variant="body2" color="$neutral2">{title}</Text>
  </MouseoverTooltip>
  <Text variant="heading3" color="$neutral1">{value}</Text>
</StatWrapper>
```

| Property | Uniswap | Ours | Diff |
|---|---|---|---|
| Label font-size | `17px` (body2) | `text-xs` (12px) | ❌ **Diff**: change to `text-[17px]` |
| Label color | `$neutral2` (rgba(255,255,255,0.65)) | `text-[#9B9B9B]` | Close |
| Label font-weight | `485` | Normal | ❌ Change to `font-medium` |
| Value font-size | `25px` (heading3) | `text-sm` (14px) | ❌ **Diff**: change to `text-[25px]` |
| Value color | `$neutral1` (#FFFFFF) | `text-white` | ✅ Match |
| Value font-weight | `485` | `font-medium` (500) | Close enough |
| Layout | Row (label left, value right) | Column (label top, value bottom) | ❌ **Diff**: change from column to row layout |
| Tooltip on label | Yes (description hover) | No | ❌ Missing tooltips |
| Stats shown | Market cap, FDV, 24H volume, TVL, 52W high, 52W low | Market cap, 24H volume, FDV, Total supply | Different set — adjust to match |

---

## 9. About / Token Description

### Section Header
*Source: `apps/web/src/pages/TokenDetails/components/info/TokenDescription.tsx`*

```
<Text variant="heading3">{t('common.about')}</Text>
```

| Property | Uniswap | Ours | Diff |
|---|---|---|---|
| Title font-size | `25px` (heading3) | `text-lg` (18px) | ❌ **Diff**: change `text-lg` → `text-[25px]` |
| Title font-weight | `485` | `font-semibold` (600) | ❌ Change to `font-medium` (500) |
| Title margin-bottom | Inline with content | `mb-3` (12px) | Check |

### Description Text
*Source: `TokenDescription.tsx`*

```
TokenDescriptionContainer = styled(Text, {
  variant: 'body1',      // 19px, lineHeight 24.7px (19*1.3)
  color: '$neutral1',    // #FFFFFF
  maxWidth: '100%',
  whiteSpace: 'pre-wrap',
  lineHeight: 24,        // explicit override to 24px
})
TRUNCATE_CHARACTER_COUNT = 300
```

| Property | Uniswap | Ours | Diff |
|---|---|---|---|
| Font-size | `19px` (body1) | `text-sm` (14px) | ❌ **Diff**: change to `text-[17px]` or `text-base` (16px) |
| Line-height | `24px` (explicit override) | `leading-relaxed` (~1.625) | ❌ **Diff**: change to `leading-6` (24px) |
| Color | `$neutral1` (#FFFFFF) | `text-[#9B9B9B]` | ❌ **Diff**: Uniswap description text is WHITE, not gray. Change to `text-white` |
| Truncation | 300 characters with "Show more" button | No truncation | ❌ **Diff**: add truncation at 300 chars with toggle |
| Show more color | ClickableTamaguiStyle (neutral2 → neutral1 on hover) | N/A | ❌ Missing |

### Link Pills
*Source: `TokenDescription.tsx` — TokenLinkButton*

```
TouchableArea {
  row: true,
  gap: '$gap8',           // 8px
  alignItems: 'center',
  py: '$spacing8',        // 8px
  px: '$padding12',       // 12px
  borderRadius: '$rounded20',  // 20px
  backgroundColor: '$surface2',  // #1F1F1F
  hoverStyle: { backgroundColor: '$surface2Hovered' },  // #242424
}
Icon: iconSizes.icon16 (16px)
Name: variant body2, color $neutral2
```

| Property | Uniswap | Ours | Diff |
|---|---|---|---|
| Border-radius | `20px` ($rounded20) | `rounded-full` (9999px) | ❌ **Diff**: change to `rounded-[20px]` |
| Background | `$surface2` (#1F1F1F) | `bg-[#1A1A1A]` | ❌ **Diff**: change to `bg-[#1F1F1F]` |
| Hover bg | `$surface2Hovered` (#242424) | `hover:bg-[#252525]` | Close — change to `hover:bg-[#242424]` |
| Padding-y | `8px` ($spacing8) | `py-1.5` (6px) | ❌ **Diff**: change to `py-2` (8px) |
| Padding-x | `12px` ($padding12) | `px-3` (12px) | ✅ Match |
| Gap (icon to text) | `8px` ($gap8) | `gap-1.5` (6px) | ❌ **Diff**: change to `gap-2` (8px) |
| Icon size | `16px` | `h-3.5 w-3.5` (14px) | ❌ **Diff**: change to `h-4 w-4` (16px) |
| Text font-size | `17px` (body2) | `text-sm` (14px) | ❌ **Diff**: change to `text-[15px]` |
| Text color | `$neutral2` (rgba(255,255,255,0.65)) | `text-[#9B9B9B]` | Close |

---

## 10. Activity / Transactions Section

### Section Tabs
*Source: `apps/web/src/pages/TokenDetails/components/activity/ActivitySection.tsx`*

```
Tab = styled(Text, {
  color: '$neutral1',
  variant: 'heading3',   // 25px, lineHeight 30px
  variants: { clickable: { true: ClickableTamaguiStyle } },
})
```

| Property | Uniswap | Ours | Diff |
|---|---|---|---|
| Tab font-size | `25px` (heading3) | `text-lg` (18px) | ❌ **Diff**: change to `text-[25px]` |
| Tab color (active) | `$neutral1` (#FFF) | `text-white` | ✅ Match |
| Tab color (inactive) | `$neutral1` with reduced opacity (ClickableTamaguiStyle) | N/A (single tab) | ❌ We don't have Pools tab |
| Tab labels | "Transactions" / "Pools" | "Transactions" only | ❌ Missing "Pools" tab |
| Section heading | Tab-style heading (clickable) | `h3 text-lg` with `mb-4` | ❌ Different treatment |

### Transactions Table
*Source: `TransactionsTable` is a separate component — COULD NOT DETERMINE exact styling from the fetched files. The ActivitySection uses `TransactionsTable` from `~/pages/TokenDetails/components/activity/TransactionsTable`.*

| Property | Uniswap (estimated) | Ours | Notes |
|---|---|---|---|
| Row height | ~48-52px | `py-2.5` (~40px) | ❌ Slightly tight |
| Font-size (cells) | body3 (~15px) | `text-xs` (12px) | ❌ **Diff**: increase to `text-[13px]` |
| Header font | body3 or body4 | `text-xs` (12px) | May match body4 (13px) |
| Border color | `$surface3` | `border-border` | Semantic match |
| Side colors | Success/Critical | `text-cash-green`/`text-cash-red` | ✅ Match concept |

---

## 11. Swap Widget (Right Panel)

### Swap Container
*Source: `apps/web/src/components/swap/SwapSkeleton.tsx` + `styled.tsx`*

```
LoadingWrapper (SwapSkeleton):
  padding: 8px
  border: 1px solid surface3
  border-radius: 16px
  background-color: surface1

PAGE_WRAPPER_MAX_WIDTH = 480  (full-page swap, not used on TDP)
```

| Property | Uniswap | Ours | Diff |
|---|---|---|---|
| Border-radius | `16px` (rounded16) | `rounded-2xl` (16px) | ✅ Match |
| Border | `1px solid $surface3` (rgba(255,255,255,0.12)) | `border border-border` (#1A1A1A) | ❌ **Diff**: border color is different. Uniswap uses semi-transparent white |
| Background | `$surface1` (#131313) | `bg-card` (#111111) | ❌ **Diff**: change to `#131313` |
| Padding | `8px` | `p-5` (20px) | ❌ **Diff**: Uniswap swap wrapper has only 8px padding (the input sections have their own padding). Change `p-5` → `p-2` (8px) |
| Width (TDP) | `360px` (from RightPanel) | `w-[360px]` (from parent) | ✅ Match |

### Swap Input Section (SwapSection)
*Source: `apps/web/src/components/swap/styled.tsx`*

```
SwapSection = styled(Flex, {
  backgroundColor: '$surface2',        // #1F1F1F
  borderRadius: '$rounded16',          // 16px
  height: '120px',
  p: '$spacing16',                     // 16px
  position: 'relative',
  borderStyle: 'solid',
  borderWidth: '$spacing1',            // 1px
  borderColor: '$surface2',            // same as bg (invisible border)
  hoverStyle: { borderColor: '$surface2Hovered' },  // #242424
  focusWithinStyle: { borderColor: '$surface3' },    // rgba(255,255,255,0.12)
})
```

| Property | Uniswap | Ours | Diff |
|---|---|---|---|
| Background | `$surface2` (#1F1F1F) | `bg-background` (#000) | ❌ **Diff**: change to `bg-[#1F1F1F]` |
| Border-radius | `16px` ($rounded16) | `rounded-xl` (12px) | ❌ **Diff**: change to `rounded-2xl` (16px) |
| Height | `120px` | Auto | ❌ **Diff**: consider setting min-height to 120px |
| Padding | `16px` ($spacing16) | `p-4` (16px) | ✅ Match |
| Border | `1px solid $surface2` (invisible) | `border border-border` (visible #1A1A1A) | ❌ **Diff**: Uniswap border is invisible by default (matches bg), visible on hover/focus |
| Hover border | `$surface2Hovered` (#242424) | None | ❌ Missing hover state |
| Focus border | `$surface3` (rgba(255,255,255,0.12)) | None | ❌ Missing focus state |
| Gap between sections | `4px` (from SwapSkeleton gap) | `mb-1` (4px) via margin | ✅ Match |

### Arrow/Direction Toggle
*Source: `apps/web/src/components/swap/styled.tsx`*

```
ArrowWrapper = styled(Flex, {
  borderRadius: '$rounded12',      // 12px
  height: 40,
  width: 40,
  position: 'relative',
  mt: -18,
  mb: -18,
  ml: 'auto',
  mr: 'auto',
  backgroundColor: '$surface2',    // #1F1F1F
  borderWidth: '$spacing4',        // 4px
  borderStyle: 'solid',
  borderColor: '$surface1',        // #131313
  zIndex: 2,
})
```

| Property | Uniswap | Ours | Diff |
|---|---|---|---|
| Size | `40×40px` | Auto (p-2 makes it ~32px) | ❌ **Diff**: set explicit `h-10 w-10` (40px) |
| Border-radius | `12px` ($rounded12) | `rounded-xl` (12px) | ✅ Match |
| Background | `$surface2` (#1F1F1F) | `bg-card` (#111111) | ❌ **Diff**: change to `bg-[#1F1F1F]` |
| Border | `4px solid $surface1` (#131313) | `border border-border` (1px #1A1A1A) | ❌ **Diff**: change to `border-4 border-[#131313]` — Uniswap uses thick border matching the page bg |
| Margin-top/bottom | `-18px` (overlaps sections) | `-my-3` (-12px) | ❌ **Diff**: change to `-my-[18px]` |
| Hover | `opacity: 0.8, cursor: pointer` | `scale 1.1` (framer) | Different approach |

### Swap CTA Button
*Source: Not directly extracted from a single file — assembled from Swap component patterns*

| Property | Uniswap (estimated) | Ours | Diff |
|---|---|---|---|
| Border-radius | `$rounded20` (20px) | `rounded-2xl` (16px) | ❌ **Diff**: change to `rounded-[20px]` |
| Height | ~56px | `py-3.5 min-h-[44px]` | ❌ **Diff**: increase min-height or padding |
| Font-size | buttonLabel1 (19px) or buttonLabel2 (17px) | `text-base` (16px) | Close |
| Font-weight | `535` | `font-semibold` (600) | Close |
| Background (primary) | `$accent1` (#FF37C7 pink) | `bg-primary` (#00D54B green) | Brand choice — keep |
| Background (disabled) | `$surface3` or `$accent2` | `bg-secondary` | Different tokens |

### Swap Tab Selector
*Source: `pages/Swap/index.tsx` — uses SegmentedControl*

| Property | Uniswap | Ours | Diff |
|---|---|---|---|
| Component | `SegmentedControl` (Tamagui built-in) | Custom pill tabs with motion | Different implementation |
| Tabs | Swap / Limit / Buy / Sell | Swap / Limit | ❌ Missing Buy/Sell tabs |
| Border-radius | Part of SegmentedControl (likely rounded16 or rounded20) | `rounded-full` | May differ |

---

## 12. Summary: Critical Differences to Fix

### High Impact (layout/sizing)
1. **Navbar height**: `56px` → `72px`
2. **Token logo size**: `36px` → `56px` (desktop), `48px` (mobile)
3. **Section headings** (Stats, About, Transactions): `18px` → `25px`
4. **Stat values**: `14px` → `25px` (massively undersized)
5. **Stat labels**: `12px` → `17px`
6. **Description text**: `14px` → ~`17px`, color gray → white
7. **Price display**: `24-30px` → `36px`
8. **Swap container padding**: `20px` → `8px`
9. **Swap input bg**: `#000` → `#1F1F1F`
10. **Swap input border-radius**: `12px` → `16px`
11. **Breadcrumb margin-bottom**: `12px` → `20px`
12. **Stats layout**: Column (label over value) → Row (label left, value right)

### Medium Impact (colors/borders)
13. **Surface1 (card bg)**: `#111111` → `#131313`
14. **Surface2 (input bg)**: `#1A1A1A` → `#1F1F1F`
15. **Link pill bg**: `#1A1A1A` → `#1F1F1F`
16. **Link pill border-radius**: `rounded-full` → `rounded-[20px]`
17. **Arrow toggle**: needs 4px border in surface1 color, 40×40 size
18. **Arrow toggle margin**: `-12px` → `-18px`
19. **Token name font-weight**: `bold` (700) → `medium` (500)
20. **Token name gap to symbol**: `8px` → `12px`

### Low Impact (polish)
21. **Nav tab gap**: `4px` → `12px`
22. **Breadcrumb gap**: `6px` → `4px`
23. **Breadcrumb separator**: text `>` → chevron SVG
24. **Pill icon size**: `14px` → `16px`
25. **Pill gap**: `6px` → `8px`
26. **Pill padding-y**: `6px` → `8px`
27. **Description truncation**: none → 300 chars with "Show more"
28. **Swap CTA border-radius**: `16px` → `20px`
29. **Swap hover/focus borders**: missing on input sections
30. **Search bar bg**: `#111` → `#1F1F1F`

---

## Appendix: Key Source File References

| Component | Uniswap Source |
|---|---|
| Theme colors | `packages/ui/src/theme/color/colors.ts` (sporeDark object) |
| Font system | `packages/ui/src/theme/fonts.ts` |
| Border radii | `packages/ui/src/theme/borderRadii.ts` |
| Breakpoints | `packages/ui/src/theme/breakpoints.ts` |
| Spacing | `packages/ui/src/theme/spacing.ts` |
| Nav height | `packages/ui/src/theme/heights.ts` (INTERFACE_NAV_HEIGHT = 72) |
| Page layout | `apps/web/src/pages/TokenDetails/components/skeleton/Skeleton.tsx` |
| Token header | `apps/web/src/pages/TokenDetails/components/header/TokenDetailsHeader.tsx` |
| Header sizing | `apps/web/src/components/Explore/stickyHeader/getHeaderLogoSize.ts` |
| Header constants | `apps/web/src/components/Explore/stickyHeader/constants.ts` |
| Breadcrumb | `apps/web/src/components/BreadcrumbNav/index.tsx` |
| Chart height | `apps/web/src/components/Explore/constants.ts` (356px) |
| Chart controls | `apps/web/src/pages/TokenDetails/components/chart/ChartControls.tsx` |
| Stats section | `apps/web/src/pages/TokenDetails/components/info/StatsSection.tsx` |
| About section | `apps/web/src/pages/TokenDetails/components/info/TokenDescription.tsx` |
| Activity tabs | `apps/web/src/pages/TokenDetails/components/activity/ActivitySection.tsx` |
| Swap styled | `apps/web/src/components/swap/styled.tsx` |
| Swap skeleton | `apps/web/src/components/swap/SwapSkeleton.tsx` |
| Swap page | `apps/web/src/pages/Swap/index.tsx` |
| Navbar | `apps/web/src/components/NavBar/index.tsx` |
| Theme index | `apps/web/src/theme/index.tsx` (MAX_CONTENT_WIDTH_PX = 1200) |
