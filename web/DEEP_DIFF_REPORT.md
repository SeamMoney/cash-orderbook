# Deep Visual Diff: CASH App vs Uniswap Token Detail Page

> Every visual difference between our frontend and the Uniswap TDP, compiled from
> source code analysis, reference screenshots, and the official Uniswap interface repo.

---

## Component: Page Background & Body
### File: `web/app/globals.css` + `web/app/layout.tsx`

1. **DIFFERENCE: Page background color is pure black instead of Uniswap's dark gray**
   CURRENT: `#000000` (both `--color-background` in globals.css and `bg-[#000000]` in layout.tsx body)
   UNISWAP: `#131313` (sporeDark.surface1 — the base page background in dark mode)
   FIX: Change `--color-background: #000000` → `--color-background: #131313` in globals.css, and change `bg-[#000000]` → `bg-[#131313]` in layout.tsx body class

2. **DIFFERENCE: Body background hardcoded black in globals.css**
   CURRENT: `body { background-color: #000000; }`
   UNISWAP: `#131313`
   FIX: Change `body { background-color: #000000; }` → `body { background-color: #131313; }`

3. **DIFFERENCE: Secondary text color is opaque gray instead of semi-transparent white**
   CURRENT: `--color-muted-foreground: #888888` (opaque gray)
   UNISWAP: `neutral2 = rgba(255, 255, 255, 0.65)` (65% white)
   FIX: Change `--color-muted-foreground: #888888` → `--color-muted-foreground: rgba(255, 255, 255, 0.65)` (or use `#A6A6A6` as solid equivalent)

4. **DIFFERENCE: Muted/tertiary text color is opaque gray instead of semi-transparent white**
   CURRENT: `--color-text-muted: #555555`
   UNISWAP: `neutral3 = rgba(255, 255, 255, 0.38)` (38% white)
   FIX: Change `--color-text-muted: #555555` → `--color-text-muted: rgba(255, 255, 255, 0.38)` (or use `#616161` as solid equivalent)

5. **DIFFERENCE: Card background color slightly off**
   CURRENT: `--color-card: #131313`
   UNISWAP: `surface1 = #131313`
   FIX: ✅ Already matches. BUT when page bg changes to #131313, card and page will be the same color. Uniswap's page bg IS surface1 (#131313) — the swap widget/card uses the same bg with a border to differentiate.

6. **DIFFERENCE: Secondary/input background color wrong**
   CURRENT: `--color-secondary: #1F1F1F`
   UNISWAP: `surface2 = #1F1F1F`
   FIX: ✅ This now matches in the variable, but was `#1A1A1A` previously. Verify all usages.

7. **DIFFERENCE: Border color is opaque instead of semi-transparent**
   CURRENT: `--color-border: #1A1A1A`
   UNISWAP: `surface3 = rgba(255, 255, 255, 0.12)` (12% white)
   FIX: Change `--color-border: #1A1A1A` → `--color-border: rgba(255, 255, 255, 0.12)`. Note: `rgba(255,255,255,0.12)` on `#131313` bg ≈ `#333333`, on `#000000` bg ≈ `#1F1F1F`. This matters because Uniswap borders are translucent.

8. **DIFFERENCE: Input color same as border**
   CURRENT: `--color-input: #1A1A1A`
   UNISWAP: Input bg is surface2 (#1F1F1F), border is surface3 (rgba(255,255,255,0.12))
   FIX: Change `--color-input: #1A1A1A` → `--color-input: #1F1F1F`

9. **DIFFERENCE: Surface-raised color too dark**
   CURRENT: `--color-surface-raised: #2A2A2A`
   UNISWAP: `surface3Solid = #393939`
   FIX: Change `--color-surface-raised: #2A2A2A` → `--color-surface-raised: #393939`

10. **DIFFERENCE: Missing surface2Hovered token**
    CURRENT: `--color-surface2-hovered: #242424` (defined but inconsistently used)
    UNISWAP: `surface2Hovered = #242424`
    FIX: Ensure `--color-surface2-hovered: #242424` is consistently used for input hover states

11. **DIFFERENCE: Missing scrim/overlay color**
    CURRENT: No scrim token defined
    UNISWAP: `scrim = rgba(0, 0, 0, 0.60)`
    FIX: Add `--color-scrim: rgba(0, 0, 0, 0.60)` for modal overlays

---

## Component: Nav
### File: `web/components/nav.tsx`

12. **DIFFERENCE: Nav height already correct but padding differs**
    CURRENT: `h-[72px]` — correct
    UNISWAP: 72px
    FIX: ✅ Height matches

13. **DIFFERENCE: Nav horizontal padding too small on some breakpoints**
    CURRENT: `px-3` (12px)
    UNISWAP: `px: $padding12` (12px)
    FIX: ✅ Already matches at `px-3`

14. **DIFFERENCE: Nav has a max-width constraint that Uniswap doesn't**
    CURRENT: `max-w-[1400px]` on the inner flex container
    UNISWAP: No max-width on nav — it stretches full width
    FIX: Remove `max-w-[1400px]` from nav inner container, or keep as a design choice. Uniswap nav stretches edge-to-edge.

15. **DIFFERENCE: Nav tab gap too small**
    CURRENT: `gap-3` (12px) for center nav tabs
    UNISWAP: `gap: 12px`
    FIX: ✅ `gap-3` = 12px matches

16. **DIFFERENCE: Inactive nav tab text color**
    CURRENT: `text-[#9B9B9B]` (solid gray, ~61% brightness)
    UNISWAP: `neutral2 = rgba(255, 255, 255, 0.65)` (≈ #A6A6A6 on black bg)
    FIX: Change `text-[#9B9B9B]` → `text-white/65` or `text-[#A6A6A6]`

17. **DIFFERENCE: Nav tab font size slightly small**
    CURRENT: `text-sm` (14px)
    UNISWAP: ~15px (body3 variant) or ~17px (body2)
    FIX: Change `text-sm` → `text-[15px]` for nav tabs

18. **DIFFERENCE: Search bar background color wrong**
    CURRENT: `bg-[#1F1F1F]` 
    UNISWAP: `surface2 = #1F1F1F`
    FIX: ✅ Already matches

19. **DIFFERENCE: Search bar has border that Uniswap might not**
    CURRENT: `border border-border` (visible border)
    UNISWAP: Search bar has subtle border or no border (surface2 bg only)
    FIX: Consider removing `border border-border` from search bar, or change to `border-transparent hover:border-white/10`

20. **DIFFERENCE: Search bar width**
    CURRENT: `w-[200px]`
    UNISWAP: ~320-400px (much wider, includes keyboard shortcut hint)
    FIX: Change `w-[200px]` → `w-[280px]` or `w-[320px]`

21. **DIFFERENCE: Search bar height too small**
    CURRENT: `py-1.5` (~30px total)
    UNISWAP: ~40px height
    FIX: Change `py-1.5` → `py-2` or set explicit `h-10`

22. **DIFFERENCE: Nav background should match page background**
    CURRENT: `bg-background` which is `#000000`
    UNISWAP: Transparent or same as page bg (`#131313` in dark mode)
    FIX: When page bg changes to `#131313`, this auto-fixes via the CSS variable

23. **DIFFERENCE: Logo text size**
    CURRENT: `text-xl` (20px)
    UNISWAP: Logo is the Uniswap unicorn icon, not text. But ~18-20px is reasonable for our text logo.
    FIX: Keep as-is — intentional brand difference

24. **DIFFERENCE: Sign Up button uses emerald-500 instead of our brand green**
    CURRENT: `bg-emerald-500 hover:bg-emerald-600`
    UNISWAP: Uses accent1 (#FF37C7 pink) for their connect button
    FIX: Change to `bg-primary hover:brightness-110` to use our brand green (#00D54B) consistently

---

## Component: Page Layout (Main Content Area)
### File: `web/app/page.tsx`

25. **DIFFERENCE: Column gap correct**
    CURRENT: `gap-20` (80px)
    UNISWAP: `gap: 80`
    FIX: ✅ Matches

26. **DIFFERENCE: Margin-top correct**
    CURRENT: `mt-8` (32px)
    UNISWAP: `mt: $spacing32` (32px)
    FIX: ✅ Matches

27. **DIFFERENCE: Padding-bottom correct**
    CURRENT: `pb-12` (48px)
    UNISWAP: `pb: $spacing48` (48px)
    FIX: ✅ Matches

28. **DIFFERENCE: Two-column breakpoint**
    CURRENT: `lg:flex-row` (≥1024px) — columns become row at lg
    UNISWAP: `$xl: { flexDirection: 'column' }` where $xl = 1024px — stacks at ≤1024px
    FIX: ✅ Our `lg:` breakpoint (1024px) matches Uniswap's `$xl` threshold. The columns stack below 1024px.

29. **DIFFERENCE: Padding-x uses different values**
    CURRENT: `px-5 xl:px-10` (20px default, 40px at ≥1280px)
    UNISWAP: `px: $spacing40` (40px default), `$lg: { px: $padding20 }` (20px at ≤768px)
    FIX: Change to `px-5 md:px-10` — 20px default (mobile), 40px at ≥768px. Currently xl breakpoint (1280px) is too late.

30. **DIFFERENCE: Right column width correct**
    CURRENT: `w-[360px]`
    UNISWAP: `SWAP_COMPONENT_WIDTH = 360`
    FIX: ✅ Matches

31. **DIFFERENCE: Left column children spacing**
    CURRENT: `space-y-4 md:space-y-6` (16px/24px)
    UNISWAP: Individual gaps between sections — `$spacing40` (40px) between chart/stats/about sections
    FIX: Change `space-y-4 md:space-y-6` → `space-y-6 md:space-y-10` (24px/40px) to better match Uniswap's generous spacing

32. **DIFFERENCE: Motion entrance animation present (Uniswap doesn't have page-level entrance)**
    CURRENT: `initial={{ opacity: 0, y: 8 }}` motion animation
    UNISWAP: No page-level entrance animation (content loads via skeleton)
    FIX: Keep or remove — minor preference. Uniswap uses skeleton loading instead of fade-in.

---

## Component: Breadcrumb
### File: `web/app/page.tsx` (inline Breadcrumb function)

33. **DIFFERENCE: Breadcrumb margin-bottom**
    CURRENT: `mb-5` (20px)
    UNISWAP: `mb: 20px` (BreadcrumbNavContainer)
    FIX: ✅ Matches

34. **DIFFERENCE: Breadcrumb gap**
    CURRENT: `gap-1` (4px)
    UNISWAP: `gap: $gap4` (4px)
    FIX: ✅ Matches

35. **DIFFERENCE: Breadcrumb separator is text character instead of chevron icon**
    CURRENT: `>` text character with `text-text-muted` color
    UNISWAP: `RotatableChevron` component (direction="right", size=16px) — a proper SVG chevron icon
    FIX: Replace `<span className="text-text-muted">&gt;</span>` with a `<ChevronRight className="h-4 w-4 text-white/38" />` from lucide-react

36. **DIFFERENCE: Breadcrumb text color slightly off**
    CURRENT: `text-muted-foreground` (#888888)
    UNISWAP: `neutral2` (rgba(255,255,255,0.65))
    FIX: Change `text-muted-foreground` → `text-white/65` — muted-foreground maps to #888 which is brighter than neutral2

37. **DIFFERENCE: Breadcrumb hover color too stark**
    CURRENT: `hover:text-white` (100% white)
    UNISWAP: `neutral2Hovered` = rgba(255,255,255,0.85) (85% white, not pure white)
    FIX: Change `hover:text-white` → `hover:text-white/85`

38. **DIFFERENCE: Breadcrumb active item is white**
    CURRENT: `text-white` for "CASH"
    UNISWAP: Active breadcrumb uses neutral1 (#FFFFFF) — same
    FIX: ✅ Matches

39. **DIFFERENCE: Breadcrumb font size**
    CURRENT: `text-sm` (14px)
    UNISWAP: body2 or body3 (~15-17px)
    FIX: Change `text-sm` → `text-[15px]`

---

## Component: Token Header
### File: `web/components/token-header.tsx`

40. **DIFFERENCE: Token icon size correct**
    CURRENT: `h-14 w-14` (56px)
    UNISWAP: `iconSizes.icon56` (56px desktop)
    FIX: ✅ Matches

41. **DIFFERENCE: Token name font size correct**
    CURRENT: `text-[25px] leading-[30px]` (25px/30px)
    UNISWAP: `heading3 = 25px, lineHeight 30px`
    FIX: ✅ Matches

42. **DIFFERENCE: Token name font weight should be medium, not bold**
    CURRENT: `font-medium` (500)
    UNISWAP: `485` (Basel Book weight — maps to ~medium/500 in Geist)
    FIX: ✅ `font-medium` is correct

43. **DIFFERENCE: Symbol/ticker font size correct**
    CURRENT: `text-[17px] font-medium text-muted-foreground`
    UNISWAP: `body2 = 17px, color: neutral2`
    FIX: ✅ Size matches. But color should be `text-white/65` instead of `text-muted-foreground` (see item #3)

44. **DIFFERENCE: Gap between name and symbol**
    CURRENT: `gap-3` (12px)
    UNISWAP: `gap: $gap12` (12px)
    FIX: ✅ Matches

45. **DIFFERENCE: Gap from icon to text**
    CURRENT: `gap-3` (12px) on outer div
    UNISWAP: `gap: $gap12` (12px)
    FIX: ✅ Matches

46. **DIFFERENCE: Missing share/social action buttons**
    CURRENT: Just logo + name + ticker
    UNISWAP: Has share button, etherscan link, X (twitter) link, share arrow — right-aligned on same row
    FIX: Add action buttons (copy link, etherscan, social) right-aligned in the token header row. These are small icon buttons (~32px circles).

47. **DIFFERENCE: Token header is not sticky on scroll**
    CURRENT: Static positioning
    UNISWAP: Header becomes sticky and compact on scroll (reduces logo size to 40px, name to 17px)
    FIX: Add sticky behavior with compact mode transition when scrolled. (Medium-effort enhancement)

---

## Component: Price Display (Above Chart)
### File: `web/components/price-chart.tsx` (price display section)

48. **DIFFERENCE: Price font size correct**
    CURRENT: `text-[36px] leading-[40px]`
    UNISWAP: `heading2 = 37px, lineHeight 40px`
    FIX: Change `text-[36px]` → `text-[37px]` (1px difference, minor)

49. **DIFFERENCE: Price font weight**
    CURRENT: `font-medium` (500)
    UNISWAP: `485` (Basel Book)
    FIX: ✅ Close enough — `font-medium` (500) approximates 485

50. **DIFFERENCE: Change percentage font size correct**
    CURRENT: `text-[17px] font-medium`
    UNISWAP: `body2 = 17px`
    FIX: ✅ Matches

51. **DIFFERENCE: Price gap to change percentage**
    CURRENT: `gap-3` (12px)
    UNISWAP: Inline with gap — looks like ~8-12px
    FIX: ✅ Reasonable match

52. **DIFFERENCE: Change percentage negative color**
    CURRENT: `text-cash-red` (#FF3B30)
    UNISWAP: `statusCritical = #FF593C`
    FIX: Brand choice — keep #FF3B30 or change to #FF593C. Minor difference.

53. **DIFFERENCE: Flash animation on price change**
    CURRENT: Has `animate-flash-green`/`animate-flash-red` background flash
    UNISWAP: No visible flash animation on price (subtle or none)
    FIX: Keep — this is a nice UX addition. Or make it more subtle.

54. **DIFFERENCE: OHLC data display when hovering candles**
    CURRENT: Shows O/H/L/C values below price in mono font
    UNISWAP: Shows OHLC in a similar fashion
    FIX: ✅ Reasonable match

---

## Component: Chart Controls
### File: `web/components/price-chart.tsx` (chart type toggle + time range)

55. **DIFFERENCE: Chart type toggle background**
    CURRENT: `bg-secondary/50` (semi-transparent #1F1F1F)
    UNISWAP: Uses segmented control with surface2 bg
    FIX: Change `bg-secondary/50` → `bg-[#1F1F1F]` (solid surface2)

56. **DIFFERENCE: Chart type toggle active button uses brand green**
    CURRENT: `bg-primary text-black` (#00D54B green)
    UNISWAP: Uses a more neutral treatment (inverted text, not accent-colored)
    FIX: This is our brand choice — keep green active state. But Uniswap uses a subtle `surface3` or inverted bg, not a bright accent color.

57. **DIFFERENCE: Chart type toggle inactive text color**
    CURRENT: `text-text-muted` (#555555)
    UNISWAP: `neutral3` (rgba(255,255,255,0.38))
    FIX: Change `text-text-muted` → `text-white/38` for inactive chart toggle buttons

58. **DIFFERENCE: Time range selector layout**
    CURRENT: Plain text buttons with `text-xs` (12px)
    UNISWAP: Uses SegmentedControl component — time ranges shown below the chart, with pill/underline style selection
    FIX: Keep text buttons but change font size: `text-xs` → `text-[13px]`

59. **DIFFERENCE: Time range active indicator**
    CURRENT: `text-white font-semibold` (just bold white text)
    UNISWAP: Has a visible underline or pill background on active time range
    FIX: Add a subtle underline indicator (2px bottom border) or pill background for active time range

60. **DIFFERENCE: Time range position**
    CURRENT: Time ranges are ABOVE the chart, same row as chart type toggle
    UNISWAP: Time ranges are BELOW the chart area
    FIX: Move time range selectors below the chart container. In Uniswap, chart type controls (line/candle icons + "Price" dropdown) are below-right of the chart, and time ranges (1H, 1D, 1W, 1M, 1Y) are below-left.

---

## Component: Chart Area
### File: `web/components/price-chart.tsx` (chart container)

61. **DIFFERENCE: Chart height correct**
    CURRENT: `h-[356px]`
    UNISWAP: `EXPLORE_CHART_HEIGHT_PX = 356`
    FIX: ✅ Matches

62. **DIFFERENCE: Chart container border-radius**
    CURRENT: `rounded-lg` (8px)
    UNISWAP: Likely no border-radius on chart area (chart is inline, not in a card)
    FIX: Remove `rounded-lg` — Uniswap chart sits directly on the page without a rounded container

63. **DIFFERENCE: Chart container has no border in normal state**
    CURRENT: (implied from the empty state: `border border-dashed border-border`)
    UNISWAP: No border on chart area in normal state
    FIX: The dashed border in empty state is fine. Normal chart state already has no border.

64. **DIFFERENCE: Chart background transparency**
    CURRENT: Chart layout `background: transparent`
    UNISWAP: Transparent chart background
    FIX: ✅ Matches

65. **DIFFERENCE: Chart grid horizontal lines**
    CURRENT: `horzLines: { color: "#1A1A1A", style: 2 }`
    UNISWAP: Likely uses `surface3` (rgba(255,255,255,0.12)) for grid lines
    FIX: Change chart horzLines color from `#1A1A1A` to `rgba(255,255,255,0.12)` or `#333333` (depends on bg)

66. **DIFFERENCE: Chart crosshair label bg**
    CURRENT: `labelBackgroundColor: "#1A1A1A"`
    UNISWAP: Likely uses surface2 (#1F1F1F) or surface3Solid (#393939)
    FIX: Change `labelBackgroundColor: "#1A1A1A"` → `"#1F1F1F"` or `"#393939"`

67. **DIFFERENCE: Chart axis border color**
    CURRENT: `borderColor: "#1A1A1A"` (rightPriceScale + timeScale)
    UNISWAP: Uses surface3 rgba(255,255,255,0.12)
    FIX: Change axis borderColor to `rgba(255,255,255,0.12)` or equivalent

68. **DIFFERENCE: Chart text font size**
    CURRENT: `fontSize: 11`
    UNISWAP: Likely 11-12px for axis labels
    FIX: ✅ Close enough

---

## Component: Token Stats Grid
### File: `web/components/token-stats-grid.tsx`

69. **DIFFERENCE: Stats section title size correct**
    CURRENT: `text-[25px] leading-[30px] font-medium`
    UNISWAP: `heading3 = 25px, 30px lineHeight`
    FIX: ✅ Matches

70. **DIFFERENCE: Stats layout uses row with label-value pairs**
    CURRENT: `flex-row` layout with label left, value right (within 50% width items)
    UNISWAP: Same — `flex-row justify-between` within 50%-width wrappers
    FIX: ✅ Matches

71. **DIFFERENCE: Stat label font size**
    CURRENT: `text-[17px] font-medium text-[#9B9B9B]`
    UNISWAP: `body2 = 17px, color: neutral2` (rgba(255,255,255,0.65))
    FIX: Change label color `text-[#9B9B9B]` → `text-white/65`. Size ✅ matches.

72. **DIFFERENCE: Stat value font size correct**
    CURRENT: `text-[25px] leading-[30px] font-medium text-white`
    UNISWAP: `heading3 = 25px, lineHeight 30px, neutral1`
    FIX: ✅ Matches

73. **DIFFERENCE: Stat item bottom border**
    CURRENT: `border-b border-white/10 pb-4`
    UNISWAP: `borderBottomWidth: 0.5, borderColor: $surface3` (rgba(255,255,255,0.12))
    FIX: Change `border-white/10` → `border-white/12` or `border-[rgba(255,255,255,0.12)]`. Minor.

74. **DIFFERENCE: Stat gap between items**
    CURRENT: `gap-5` (20px)
    UNISWAP: `STATS_GAP = $gap20` (20px)
    FIX: ✅ Matches

75. **DIFFERENCE: Stat item width calculation**
    CURRENT: `w-[calc(50%-10px)]`
    UNISWAP: `width: 50%` with flex-wrap
    FIX: Minor — both achieve 2-column layout. Our calc accounts for the gap.

76. **DIFFERENCE: Missing tooltips on stat labels**
    CURRENT: No tooltips
    UNISWAP: Each stat label has a `MouseoverTooltip` with description text
    FIX: Add tooltip wrappers to stat labels (low priority)

---

## Component: Token Info / About Section
### File: `web/components/token-info.tsx`

77. **DIFFERENCE: About section title size correct**
    CURRENT: `text-[25px] leading-[30px] font-medium`
    UNISWAP: `heading3 = 25px, 30px lineHeight`
    FIX: ✅ Matches

78. **DIFFERENCE: Description text color — should be WHITE**
    CURRENT: `text-white` — correct
    UNISWAP: `neutral1` (#FFFFFF) — white
    FIX: ✅ Matches (was previously gray, now fixed to white)

79. **DIFFERENCE: Description text font size**
    CURRENT: `text-[17px] leading-6`
    UNISWAP: `body1 = 19px, lineHeight 24px` (but with explicit override to 24px)
    FIX: Change `text-[17px]` → `text-[19px]` to match Uniswap body1. Or keep 17px as body2 equivalent.

80. **DIFFERENCE: Description text line-height**
    CURRENT: `leading-6` (24px)
    UNISWAP: `lineHeight: 24` (explicit 24px)
    FIX: ✅ Matches

81. **DIFFERENCE: Description truncation at 300 chars**
    CURRENT: Has truncation with "Show more" toggle — correct
    UNISWAP: `TRUNCATE_CHARACTER_COUNT = 300` with show more
    FIX: ✅ Matches

82. **DIFFERENCE: "Show more" button color**
    CURRENT: `text-[#9B9B9B] hover:text-white`
    UNISWAP: `neutral2 → neutral1 on hover` (ClickableTamaguiStyle)
    FIX: Change to `text-white/65 hover:text-white`

83. **DIFFERENCE: Link pill border-radius**
    CURRENT: `rounded-[20px]`
    UNISWAP: `borderRadius: $rounded20` (20px)
    FIX: ✅ Matches

84. **DIFFERENCE: Link pill background color**
    CURRENT: `bg-[#1F1F1F]`
    UNISWAP: `surface2 = #1F1F1F`
    FIX: ✅ Matches

85. **DIFFERENCE: Link pill hover background**
    CURRENT: `hover:bg-[#242424]`
    UNISWAP: `surface2Hovered = #242424`
    FIX: ✅ Matches

86. **DIFFERENCE: Link pill padding**
    CURRENT: `px-3 py-2` (12px x 8px)
    UNISWAP: `px: $padding12, py: $spacing8` (12px x 8px)
    FIX: ✅ Matches

87. **DIFFERENCE: Link pill icon gap**
    CURRENT: `gap-2` (8px)
    UNISWAP: `gap: $gap8` (8px)
    FIX: ✅ Matches

88. **DIFFERENCE: Link pill icon size**
    CURRENT: `h-4 w-4` (16px)
    UNISWAP: `iconSizes.icon16` (16px)
    FIX: ✅ Matches

89. **DIFFERENCE: Link pill text font size**
    CURRENT: `text-[15px]`
    UNISWAP: `body2 = 17px`
    FIX: Change `text-[15px]` → `text-[17px]`

90. **DIFFERENCE: Link pill text color**
    CURRENT: `text-[#9B9B9B]`
    UNISWAP: `neutral2 = rgba(255,255,255,0.65)`
    FIX: Change `text-[#9B9B9B]` → `text-white/65`

91. **DIFFERENCE: Link pill hover text color**
    CURRENT: `hover:text-white`
    UNISWAP: Hover changes to neutral1 (white)
    FIX: ✅ Matches

---

## Component: Transactions Table
### File: `web/components/transactions-table.tsx`

92. **DIFFERENCE: Transactions heading size correct**
    CURRENT: `text-[25px] leading-[30px] font-medium`
    UNISWAP: `heading3 = 25px, 30px lineHeight`
    FIX: ✅ Matches

93. **DIFFERENCE: Missing "Pools" tab next to "Transactions"**
    CURRENT: Single "Transactions" heading
    UNISWAP: Two clickable tabs: "Transactions" and "Pools" side by side
    FIX: Add "Pools" tab (even as a placeholder) next to "Transactions". Active tab has neutral1 color, inactive has neutral1 with reduced opacity.

94. **DIFFERENCE: Table cell font size**
    CURRENT: `text-[13px]`
    UNISWAP: `body4 = 13px`
    FIX: ✅ Matches

95. **DIFFERENCE: Table header color**
    CURRENT: `text-[#9B9B9B]`
    UNISWAP: `neutral2` (rgba(255,255,255,0.65))
    FIX: Change `text-[#9B9B9B]` → `text-white/65`

96. **DIFFERENCE: Table row padding/height**
    CURRENT: `py-2.5` (~40px row height)
    UNISWAP: ~48-52px rows
    FIX: Change `py-2.5` → `py-3.5` (~52px)

97. **DIFFERENCE: Table border color**
    CURRENT: `border-border` (#1A1A1A) and `border-border/50`
    UNISWAP: `surface3` (rgba(255,255,255,0.12))
    FIX: When border CSS variable changes (item #7), this auto-fixes

98. **DIFFERENCE: Address column shows maker address**
    CURRENT: Shows maker/address column
    UNISWAP: Shows "Account" column with ENS name or address + link to explorer
    FIX: Minor — keep our format. Uniswap also shows "Total value", "Token amount" columns differently.

99. **DIFFERENCE: Table columns differ from Uniswap**
    CURRENT: Time, Type, Price, Amount, Address
    UNISWAP: Time stamp, Action (Buy/Sell), USD value, Token amount, Token amount (second), Account
    FIX: Consider renaming columns to match Uniswap layout (low priority)

---

## Component: Swap Widget Container
### File: `web/components/swap/swap-widget.tsx`

100. **DIFFERENCE: Swap widget outer border**
     CURRENT: `border border-border` (#1A1A1A opaque)
     UNISWAP: `border: 1px solid $surface3` (rgba(255,255,255,0.12))
     FIX: When `--color-border` changes (item #7), auto-fixes. Or change explicitly to `border-white/12`

101. **DIFFERENCE: Swap widget background**
     CURRENT: `bg-card` (#131313)
     UNISWAP: `surface1 = #131313`
     FIX: ✅ Matches

102. **DIFFERENCE: Swap widget padding**
     CURRENT: `p-2` (8px)
     UNISWAP: `padding: 8px` (LoadingWrapper/SwapSkeleton)
     FIX: ✅ Matches

103. **DIFFERENCE: Swap widget border-radius**
     CURRENT: `rounded-2xl` (16px)
     UNISWAP: `border-radius: 16px`
     FIX: ✅ Matches

---

## Component: Swap Tab Bar
### File: `web/components/swap/swap-widget.tsx` (tab section)

104. **DIFFERENCE: Swap tab bar background**
     CURRENT: `bg-background` (currently #000000)
     UNISWAP: Surface within the card (likely surface1 or slightly different)
     FIX: When page bg changes to #131313, this will match. OR change to `bg-[#0D0D0D]` for subtle differentiation.

105. **DIFFERENCE: Swap tab indicator style**
     CURRENT: `bg-secondary` (#1F1F1F) pill with motion layout animation
     UNISWAP: SegmentedControl with subtle bg highlight
     FIX: ✅ Reasonable match — our animated pill is a good equivalent

106. **DIFFERENCE: Missing additional swap tabs**
     CURRENT: "Swap" and "Limit" tabs
     UNISWAP: "Swap", "Limit", "Send", "Buy" tabs + settings gear icon
     FIX: Consider adding "Send" and "Buy" placeholder tabs (low priority). Add settings gear icon (⚙) right-aligned.

107. **DIFFERENCE: Tab bar margin-bottom**
     CURRENT: `mb-5` (20px)
     UNISWAP: SwapSkeleton shows "Swap" title with 8px padding
     FIX: Change `mb-5` → `mb-3` (12px) — less space between tabs and input

---

## Component: Swap Input Sections ("You pay" / "You receive")
### File: `web/components/swap/swap-widget.tsx`

108. **DIFFERENCE: Input section background**
     CURRENT: `bg-[#1F1F1F]`
     UNISWAP: `surface2 = #1F1F1F`
     FIX: ✅ Matches

109. **DIFFERENCE: Input section border-radius**
     CURRENT: `rounded-2xl` (16px)
     UNISWAP: `borderRadius: $rounded16` (16px)
     FIX: ✅ Matches

110. **DIFFERENCE: Input section padding**
     CURRENT: `p-4` (16px)
     UNISWAP: `p: $spacing16` (16px)
     FIX: ✅ Matches

111. **DIFFERENCE: Input section height**
     CURRENT: Auto height
     UNISWAP: `height: 120px` (fixed)
     FIX: Add `min-h-[120px]` to input sections

112. **DIFFERENCE: Input section border — invisible by default in Uniswap**
     CURRENT: `border border-[#1F1F1F]` (same as bg — technically invisible)
     UNISWAP: `borderColor: $surface2` (same as bg — invisible), `hoverStyle: { borderColor: $surface2Hovered }` (#242424)
     FIX: ✅ Already matches! Border is same as bg = invisible by default.

113. **DIFFERENCE: Input section hover border**
     CURRENT: `hover:border-white/10`
     UNISWAP: `hoverStyle: { borderColor: $surface2Hovered }` (#242424)
     FIX: Change `hover:border-white/10` → `hover:border-[#242424]`

114. **DIFFERENCE: Input section focus-within border**
     CURRENT: `focus-within:border-white/15`
     UNISWAP: `focusWithinStyle: { borderColor: $surface3 }` (rgba(255,255,255,0.12))
     FIX: Change `focus-within:border-white/15` → `focus-within:border-white/12`

115. **DIFFERENCE: "You pay" / "You receive" label**
     CURRENT: `text-xs text-text-muted` (12px)
     UNISWAP: Uses "Sell" and "Buy" labels (not "You pay"/"You receive") in the TDP swap
     FIX: Consider changing labels to "Sell" and "Buy" to match Uniswap TDP. Or keep "You pay"/"You receive" as our brand choice.

116. **DIFFERENCE: Input amount font size**
     CURRENT: `text-2xl` (24px)
     UNISWAP: ~28-36px (heading2 range) for the amount input
     FIX: Change `text-2xl` → `text-[28px]` or `text-3xl` (30px)

117. **DIFFERENCE: Input placeholder**
     CURRENT: `placeholder="0"`
     UNISWAP: `placeholder="0"` — same
     FIX: ✅ Matches

118. **DIFFERENCE: USD equivalent text**
     CURRENT: `text-xs text-text-muted` (12px)
     UNISWAP: Shows `$0` in neutral3 color
     FIX: ✅ Reasonable match. Color should be `text-white/38`

119. **DIFFERENCE: Gap between input sections**
     CURRENT: `mb-1` (4px) on "You pay" + `mt-1` (4px) on "You receive"
     UNISWAP: `gap: 4px` between sections
     FIX: ✅ Effectively 4px gap matches

---

## Component: Direction Toggle Arrow
### File: `web/components/swap/swap-widget.tsx`

120. **DIFFERENCE: Arrow button size**
     CURRENT: `h-10 w-10` (40px)
     UNISWAP: `height: 40, width: 40`
     FIX: ✅ Matches

121. **DIFFERENCE: Arrow button border-radius**
     CURRENT: `rounded-xl` (12px)
     UNISWAP: `borderRadius: $rounded12` (12px)
     FIX: ✅ Matches

122. **DIFFERENCE: Arrow button background**
     CURRENT: `bg-[#1F1F1F]`
     UNISWAP: `surface2 = #1F1F1F`
     FIX: ✅ Matches

123. **DIFFERENCE: Arrow button border**
     CURRENT: `border-4 border-[#131313]`
     UNISWAP: `borderWidth: $spacing4 (4px), borderColor: $surface1 (#131313)`
     FIX: ✅ Matches

124. **DIFFERENCE: Arrow button margin overlap**
     CURRENT: `-my-[18px]`
     UNISWAP: `mt: -18, mb: -18`
     FIX: ✅ Matches

125. **DIFFERENCE: Arrow button hover state**
     CURRENT: Framer Motion `whileHover={{ scale: 1.1 }}` + `whileTap={{ scale: 0.9 }}`
     UNISWAP: `hoverStyle: { cursor: 'pointer', opacity: 0.8 }`
     FIX: Uniswap uses opacity on hover, we use scale. Our approach is flashier. Change `whileHover={{ scale: 1.1 }}` → `whileHover={{ opacity: 0.8 }}` to match, or keep as brand choice.

126. **DIFFERENCE: Arrow icon**
     CURRENT: `ArrowDownUp` from lucide-react (h-4 w-4)
     UNISWAP: `ArrowDown` icon (single direction, flips)
     FIX: Consider using `ArrowDown` instead of `ArrowDownUp` for cleaner look. Minor.

---

## Component: Token Selector Button (in Swap)
### File: `web/components/swap/swap-widget.tsx` (TokenSelectorButton)

127. **DIFFERENCE: Token selector button background**
     CURRENT: `bg-secondary` (uses CSS var — #1F1F1F)
     UNISWAP: Token selector uses a distinct pill with slightly different styling
     FIX: ✅ Reasonable match

128. **DIFFERENCE: Token selector button border-radius**
     CURRENT: `rounded-full` (9999px)
     UNISWAP: Pill shape (rounded-full)
     FIX: ✅ Matches

129. **DIFFERENCE: Token selector icon size**
     CURRENT: `h-5 w-5` (20px)
     UNISWAP: ~24px token icons in selector
     FIX: Change `h-5 w-5` → `h-6 w-6` (24px)

130. **DIFFERENCE: Token selector chevron**
     CURRENT: `h-3 w-3` (12px) ChevronDown
     UNISWAP: Slightly larger chevron
     FIX: Change `h-3 w-3` → `h-3.5 w-3.5` (14px)

131. **DIFFERENCE: Token selector min-height**
     CURRENT: `min-h-[44px]`
     UNISWAP: ~36-40px
     FIX: Change `min-h-[44px]` → `min-h-[36px]` (our 44px is for touch targets, which is good for mobile)

132. **DIFFERENCE: "Select a token" variant**
     CURRENT: Always shows a token (default is USD1/CASH)
     UNISWAP: One side shows "Select token" button (pink/accent colored) when no token selected
     FIX: Low priority — we always have defaults which is fine

---

## Component: Swap CTA Button
### File: `web/components/swap/swap-widget.tsx`

133. **DIFFERENCE: CTA button border-radius**
     CURRENT: `rounded-[20px]`
     UNISWAP: `$rounded20` (20px) or `$rounded16` (16px)
     FIX: ✅ Matches

134. **DIFFERENCE: CTA button padding/height**
     CURRENT: `py-3.5 min-h-[44px]` (~52px total)
     UNISWAP: ~56px button height
     FIX: Change `py-3.5` → `py-4` or set `min-h-[56px]`

135. **DIFFERENCE: CTA button font size**
     CURRENT: `text-base` (16px) `font-semibold`
     UNISWAP: `buttonLabel2 = 17px` or `buttonLabel1 = 19px`
     FIX: Change `text-base` → `text-[17px]`

136. **DIFFERENCE: CTA button disabled state**
     CURRENT: `disabled:bg-secondary disabled:text-text-muted`
     UNISWAP: Disabled uses muted surface3 or accent2 background
     FIX: ✅ Reasonable — our disabled state is subdued. Could change to `disabled:bg-[#393939] disabled:text-white/38`

137. **DIFFERENCE: CTA margin-top**
     CURRENT: `mt-4` (16px)
     UNISWAP: Within the wrapper gap
     FIX: ✅ Reasonable

---

## Component: Swap Price Details
### File: `web/components/swap/swap-price-details.tsx`

138. **DIFFERENCE: Price details container styling**
     CURRENT: `rounded-xl bg-background border border-border`
     UNISWAP: Similar expandable section
     FIX: ✅ Reasonable match

139. **DIFFERENCE: Price details summary row min-height**
     CURRENT: `min-h-[44px]`
     UNISWAP: ~36-40px
     FIX: Keep 44px for accessibility touch targets

140. **DIFFERENCE: Price details text colors**
     CURRENT: `text-text-muted` and `text-text-secondary`
     UNISWAP: neutral2 and neutral3
     FIX: Auto-fixes when CSS vars change (items #3, #4)

---

## Component: Token Selector Modal
### File: `web/components/swap/token-selector-modal.tsx`

141. **DIFFERENCE: Modal overlay**
     CURRENT: `bg-black/60 backdrop-blur-sm`
     UNISWAP: `scrim = rgba(0,0,0,0.60)` — same opacity
     FIX: ✅ Matches

142. **DIFFERENCE: Modal border**
     CURRENT: `border border-border bg-card`
     UNISWAP: `border: 1px solid surface3, bg: surface1`
     FIX: Border auto-fixes with item #7

143. **DIFFERENCE: Modal border-radius**
     CURRENT: `rounded-2xl` (16px) via CSS class `token-selector-dialog`
     UNISWAP: `rounded-16` (16px) on desktop
     FIX: ✅ `border-radius: 1rem` (16px) in globals.css matches

144. **DIFFERENCE: Modal max-width**
     CURRENT: `max-width: 420px`
     UNISWAP: Token selector modal is ~420px
     FIX: ✅ Matches

145. **DIFFERENCE: Modal search input styling**
     CURRENT: `rounded-xl border border-border bg-background`
     UNISWAP: Uses surface2 bg, rounded-16 or rounded-12
     FIX: Change `bg-background` → `bg-[#1F1F1F]` for search input

146. **DIFFERENCE: Popular token pill styling**
     CURRENT: `rounded-full border border-border bg-background`
     UNISWAP: Similar pill styling
     FIX: ✅ Reasonable match

---

## Component: Swap Button (Standalone - unused in main widget)
### File: `web/components/swap/swap-button.tsx`

147. **DIFFERENCE: This component uses white bg instead of green**
     CURRENT: `bg-white text-black hover:bg-gray-200`
     UNISWAP: Uses accent1 color (#FF37C7 pink) for primary swap button
     FIX: This component appears unused (swap-widget.tsx has its own inline CTA). If used, change to `bg-primary text-primary-foreground`.

---

## Summary: ALL Remaining Issues by Priority

### 🔴 Critical (Immediately Noticeable)

| # | Issue | Component | Fix |
|---|-------|-----------|-----|
| 1 | Page background #000000 → #131313 | globals.css + layout.tsx | Change bg color |
| 7 | Border color opaque → semi-transparent | globals.css | Change --color-border |
| 3 | Secondary text #888 → rgba(255,255,255,0.65) | globals.css | Change --color-muted-foreground |
| 4 | Muted text #555 → rgba(255,255,255,0.38) | globals.css | Change --color-text-muted |
| 111 | Swap input min-height 120px | swap-widget.tsx | Add min-h-[120px] |
| 116 | Swap input amount 24px → 28px | swap-widget.tsx | Change text-2xl → text-[28px] |

### 🟡 Medium (Noticeable on Close Inspection)

| # | Issue | Component | Fix |
|---|-------|-----------|-----|
| 9 | surface-raised #2A2A2A → #393939 | globals.css | Change color |
| 16 | Nav tab inactive #9B9B9B → white/65 | nav.tsx | Change color |
| 17 | Nav tab font 14px → 15px | nav.tsx | Change size |
| 20 | Search bar 200px → 280px+ | nav.tsx | Widen |
| 29 | Padding-x breakpoint (xl→md for 40px) | page.tsx | Change breakpoint |
| 31 | Section spacing 16-24px → 24-40px | page.tsx | Increase spacing |
| 35 | Breadcrumb separator > → chevron SVG | page.tsx | Use icon |
| 39 | Breadcrumb font 14px → 15px | page.tsx | Change size |
| 57 | Chart toggle inactive text color | price-chart.tsx | Use white/38 |
| 60 | Time range position: above → below chart | price-chart.tsx | Move controls |
| 71 | Stat label color #9B9B9B → white/65 | token-stats-grid.tsx | Change color |
| 79 | Description text 17px → 19px | token-info.tsx | Change size |
| 89 | Link pill text 15px → 17px | token-info.tsx | Change size |
| 90 | Link pill text color → white/65 | token-info.tsx | Change color |
| 95 | Table header color → white/65 | transactions-table.tsx | Change color |
| 96 | Table row padding → py-3.5 | transactions-table.tsx | Increase padding |
| 107 | Tab bar margin-bottom 20px → 12px | swap-widget.tsx | Reduce |
| 113 | Input hover border → #242424 | swap-widget.tsx | Change color |
| 129 | Token selector icon 20px → 24px | swap-widget.tsx | Increase |
| 134 | CTA button height → 56px | swap-widget.tsx | Increase |
| 135 | CTA button font 16px → 17px | swap-widget.tsx | Increase |

### 🟢 Minor (Polish/Perfectionism)

| # | Issue | Component | Fix |
|---|-------|-----------|-----|
| 14 | Nav max-width constraint | nav.tsx | Remove or keep |
| 19 | Search bar border → transparent | nav.tsx | Remove border |
| 21 | Search bar height → 40px | nav.tsx | Increase |
| 24 | Sign Up button → use brand green | nav.tsx | Use bg-primary |
| 37 | Breadcrumb hover → white/85 | page.tsx | Subtle change |
| 46 | Missing share/social buttons | token-header.tsx | Add icons |
| 47 | Token header not sticky | token-header.tsx | Add sticky |
| 48 | Price 36px → 37px | price-chart.tsx | 1px diff |
| 55 | Chart toggle bg → solid | price-chart.tsx | Remove opacity |
| 59 | Time range active indicator | price-chart.tsx | Add underline |
| 62 | Chart container rounded-lg → none | price-chart.tsx | Remove radius |
| 65 | Chart grid line color | price-chart.tsx | Change color |
| 82 | Show more color → white/65 | token-info.tsx | Change color |
| 93 | Missing Pools tab | transactions-table.tsx | Add tab |
| 106 | Missing Send/Buy swap tabs | swap-widget.tsx | Add tabs |
| 114 | Focus border white/15 → white/12 | swap-widget.tsx | Tiny change |
| 125 | Arrow hover: scale → opacity | swap-widget.tsx | Match Uniswap |
| 136 | CTA disabled state colors | swap-widget.tsx | Refine |
| 145 | Modal search bg | token-selector-modal.tsx | Change bg |

---

## Quick-Fix CSS Variable Changes (globals.css)

These 6 variable changes will fix the most visual differences across the entire app:

```css
--color-background: #131313;        /* was #000000 */
--color-muted-foreground: rgba(255, 255, 255, 0.65);  /* was #888888 */
--color-text-muted: rgba(255, 255, 255, 0.38);        /* was #555555 */
--color-border: rgba(255, 255, 255, 0.12);             /* was #1A1A1A */
--color-input: #1F1F1F;             /* was #1A1A1A */
--color-surface-raised: #393939;    /* was #2A2A2A */
```

Plus the body style:
```css
body { background-color: #131313; }  /* was #000000 */
```

And layout.tsx:
```tsx
bg-[#131313]  /* was bg-[#000000] */
```
