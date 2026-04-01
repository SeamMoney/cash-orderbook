# Uniswap Token Detail Page (TDP) — Detailed Comparison Report

## Table of Contents
1. [Uniswap TDP Architecture & File Paths](#1-uniswap-tdp-architecture--file-paths)
2. [Layout Structure Comparison](#2-layout-structure-comparison)
3. [Navbar Comparison](#3-navbar-comparison)
4. [Token Header Comparison](#4-token-header-comparison)
5. [Chart Comparison](#5-chart-comparison)
6. [Stats Section Comparison](#6-stats-section-comparison)
7. [Swap Widget Comparison](#7-swap-widget-comparison)
8. [Activity/Transactions Table Comparison](#8-activitytransactions-table-comparison)
9. [Token Info / Description Comparison](#9-token-info--description-comparison)
10. [Color Scheme & Theme Comparison](#10-color-scheme--theme-comparison)
11. [Typography Comparison](#11-typography-comparison)
12. [Summary of Changes Needed](#12-summary-of-changes-needed)

---

## 1. Uniswap TDP Architecture & File Paths

### Uniswap repo paths (under `apps/web/src/`):
| Component | Path |
|-----------|------|
| **Page entry** | `pages/TokenDetails/TokenDetailsPage.tsx` |
| **Main layout/content** | `pages/TokenDetails/components/TokenDetails.tsx` |
| **Layout skeleton (LeftPanel/RightPanel)** | `pages/TokenDetails/components/skeleton/Skeleton.tsx` |
| **Token header** | `pages/TokenDetails/components/header/TokenDetailsHeader.tsx` |
| **Breadcrumb** | `pages/TokenDetails/components/header/TDPBreadcrumb.tsx` |
| **Chart section** | `pages/TokenDetails/components/chart/ChartSection.tsx` |
| **Chart controls (time/type toggle)** | `pages/TokenDetails/components/chart/ChartControls.tsx` |
| **Stats section** | `pages/TokenDetails/components/info/StatsSection.tsx` |
| **Token description** | `pages/TokenDetails/components/info/TokenDescription.tsx` |
| **Swap component** | `pages/TokenDetails/components/swap/TDPSwapComponent.tsx` |
| **Activity section** | `pages/TokenDetails/components/activity/ActivitySection.tsx` |
| **Token carousel** | `pages/TokenDetails/components/TokenCarousel/TokenCarousel.tsx` |
| **Navbar** | `components/NavBar/index.tsx` |
| **Nav tabs** | `components/NavBar/Tabs/Tabs.tsx` |
| **Search bar** | `components/NavBar/SearchBar/` |
| **Theme/colors** | `theme/colors.ts`, `theme/index.tsx` |
| **Global CSS** | `global.css` |

### Our repo paths (under `web/`):
| Component | Path |
|-----------|------|
| **Page entry** | `app/page.tsx` |
| **Layout wrapper** | `app/layout.tsx` |
| **Navbar** | `components/nav.tsx` |
| **Token header** | `components/token-header.tsx` |
| **Price chart** | `components/price-chart.tsx` |
| **Token stats** | `components/token-stats-grid.tsx` |
| **Swap widget** | `components/swap/swap-widget.tsx` |
| **Transactions table** | `components/transactions-table.tsx` |
| **Token info** | `components/token-info.tsx` |
| **Global CSS** | `app/globals.css` |

### Component Hierarchy Comparison

**Uniswap TDP:**
```
TokenDetailsPage
└── TDPStoreContextProvider
    └── TDPPageContent
        ├── Helmet (SEO)
        ├── DetailsHeaderContainer (sticky compact header on scroll)
        │   └── TokenDetailsHeader (logo, name, symbol, address, actions)
        └── TokenDetailsLayout (two-column flexbox row)
            ├── LeftPanel
            │   ├── TDPBreadcrumb ("Tokens > ETH")
            │   ├── TokenDetailsHeader (full, non-compact)
            │   ├── ChartSection
            │   │   ├── PriceChart / VolumeChart / LineChart (TVL)
            │   │   └── ChartControls (Price/Volume/TVL toggle + time pills)
            │   ├── StatsSection (Market cap, FDV, Volume, TVL, 52W high/low)
            │   ├── TokenDescription (About, links, address pills)
            │   ├── ActivitySection
            │   │   ├── Tab: Transactions
            │   │   └── Tab: Pools
            │   └── TokenCarousel (similar tokens)
            └── RightPanel
                ├── TDPSwapComponent (Swap widget + TokenWarningCard)
                ├── PageChainBalanceSummary (user's balance)
                └── BridgedAssetSection
```

**Our TDP (CASH):**
```
Home
├── Nav
├── Toaster
└── <main> (two-column flexbox)
    ├── Left Column (65%)
    │   ├── TokenHeader
    │   ├── PriceChart
    │   ├── TokenStatsGrid
    │   ├── SwapWidget (mobile only)
    │   ├── TransactionsTable
    │   └── TokenInfo
    └── Right Column (35%)
        └── SwapWidget (sticky, desktop only)
```

---

## 2. Layout Structure Comparison

### Uniswap TDP Layout
- **Mechanism**: `styled(Flex)` (Tamagui) — renders as flexbox `row`
- **Main container**: `TokenDetailsLayout`
  - `row: true` (flexbox row direction)
  - `justifyContent: 'center'`
  - `width: '100%'`
  - **Gap: `80px`** between left and right panels
  - `margin-top: 32px` (`$spacing32`)
  - `padding-bottom: 48px` (`$spacing48`)
  - `padding-horizontal: 40px` (`$spacing40`)
  - On `$lg` breakpoint: `px: 20px`, `pt: 0`, `pb: 52px`
  - On `$xl` breakpoint: column direction, centered, gap: 0
- **LeftPanel**: `flexGrow: 1`, `flexShrink: 1`, `width: 100%`
- **RightPanel**: **fixed width `360px`** (`SWAP_COMPONENT_WIDTH = 360`)
  - On `$xl`: `width: 100%`, `maxWidth: 780px`
- **Max content width**: `MAX_CONTENT_WIDTH_PX = 1200` (from theme/index.tsx)

### Our Layout
- **Mechanism**: Tailwind CSS classes on `<div>`
- **Main container**: `<motion.main>`
  - `mx-auto w-full max-w-[1280px] flex-1 px-3 py-4 sm:px-4 md:px-6 md:py-6`
- **Two-column div**:
  - `flex flex-col md:flex-row md:gap-6 lg:gap-8`
- **Left column**: `w-full md:w-[65%] space-y-4 md:space-y-6`
- **Right column**: `hidden md:block md:w-[35%]`
  - Swap widget: `md:sticky md:top-[72px]`

### Key Differences
| Property | Uniswap | Ours |
|----------|---------|------|
| **Max content width** | `1200px` | `1280px` |
| **Left/Right split** | Left = fluid (grows), Right = **fixed 360px** | Left = **65%**, Right = **35%** |
| **Gap between columns** | `80px` | `24px (md:gap-6)` to `32px (lg:gap-8)` |
| **Horizontal padding** | `40px` (desktop), `20px` (mobile) | `12px`, `16px (sm)`, `24px (md)` |
| **Top padding/margin** | `32px` margin-top | `16px (py-4)` to `24px (md:py-6)` |
| **Bottom padding** | `48px` | None explicit |
| **Responsive breakpoint** | `$xl` (~1280px) → column | `md` (768px) → column |
| **Right panel width** | **Fixed 360px** | **Percentage 35%** |
| **Sticky swap** | Not explicitly sticky in Skeleton; **display-based** show/hide | `sticky top-[72px]` |

### What to change:
1. Change `max-w-[1280px]` → `max-w-[1200px]`
2. Change left/right split from percentage to: Left = `flex-grow flex-shrink`, Right = `w-[360px] flex-shrink-0`
3. Increase gap from `md:gap-6 lg:gap-8` → `gap-20` (80px)
4. Increase horizontal padding from `md:px-6` → `px-10` (40px) desktop, `px-5` (20px) mobile
5. Add `mt-8` (32px) top margin
6. Add `pb-12` (48px) bottom padding
7. Change responsive breakpoint from `md` to `xl` (1280px)

---

## 3. Navbar Comparison

### Uniswap Navbar
- **Component**: `components/NavBar/index.tsx`
- **Framework**: Tamagui (`styled`, `Flex`, `Nav`)
- **Height**: `INTERFACE_NAV_HEIGHT` (from ui/src/theme — typically **64px**)
- **Layout**: Full width, `z-index: sticky`, centered content
- **Left section**: Logo (Uniswap icon) + Tabs (when screen is wide enough)
- **Center/Left Tabs**: Trade (dropdown: Swap, Limit, Buy, Sell), Explore (dropdown: Tokens, Auctions, Pools, Transactions), Pool, Portfolio
- **Right section**: SearchBar, TestnetModeTooltip, CompanyMenu, PreferenceMenu, Web3Status (wallet connect), NewUserCTAButton
- **Tab style**: Text styled with `color: $neutral2` (muted), hover: `$neutral1`, active: `$neutral1`
- **No background pill** on active tab — just color change
- **Sticky behavior**: `z-index: sticky`
- **No border-bottom explicitly**; uses background color + shadow separation
- **Gap between items**: `12px` (desktop), `4px` (mobile under `md` breakpoint)

### Our Navbar
- **Component**: `components/nav.tsx`
- **Framework**: Tailwind CSS + Framer Motion
- **Height**: `h-14` (56px)
- **Layout**: `sticky top-0 z-50`, `border-b border-border`, `bg-background/90 backdrop-blur-md`
- **Left**: "CASH" text logo
- **Center**: Trade/Explore tabs with animated pill indicator (Framer Motion `layoutId`)
- **Right**: Search input placeholder, Log In / Sign Up buttons (or connected wallet)
- **Tab style**: `rounded-full` pill with bg-secondary indicator
- **Mobile**: Hamburger menu → drawer with tabs + wallet

### Key Differences
| Property | Uniswap | Ours |
|----------|---------|------|
| **Height** | ~64px | 56px (`h-14`) |
| **Nav tabs** | 4 tabs (Trade, Explore, Pool, Portfolio) with dropdowns | 2 tabs (Trade, Explore) with pill animation |
| **Tab active style** | Color change only (`$neutral1` vs `$neutral2`) | Animated background pill (`bg-secondary rounded-full`) |
| **Border bottom** | No explicit border | `border-b border-border` |
| **Background** | Opaque (theme background) | Semi-transparent + backdrop blur |
| **Search bar** | Full search component with suggestions | Placeholder div "Search tokens" |
| **Wallet button** | Web3Status component (connects, shows address/ENS) | Custom ConnectButton or Log In/Sign Up |
| **Logo** | Uniswap icon (SVG) | "CASH" text |
| **Right-side extras** | CompanyMenu, PreferenceMenu, Download app CTA | None |
| **Tab dropdowns** | Each tab has dropdown sub-items | No dropdowns |

### What to change:
1. Increase nav height from `h-14` (56px) → ~64px
2. Remove pill animation on tabs — use only color change for active state
3. Remove border-bottom (or make it much more subtle)
4. Remove backdrop-blur; use opaque background
5. Expand search bar to be a real search component (not just placeholder)
6. Consider adding more nav tabs or dropdown functionality

---

## 4. Token Header Comparison

### Uniswap Token Header
- **Component**: `TokenDetailsHeader.tsx`
- **Layout**: Horizontal `Flex` row with:
  - **Token logo** (circular, size varies by compact/mobile state via `getHeaderLogoSize`)
  - **Token name** (large text, using `getHeaderTitleVariant`)
  - **Token symbol** (shown when not compact and not mobile, `$neutral2` color)
  - **Contract address** (shortened, with copy functionality via `CopyHelper`)
  - **Header actions** (share, favorite, report — desktop: inline buttons, mobile: kebab menu)
- **Breadcrumb**: Separate `TDPBreadcrumb` component above header — "Tokens > {token name}"
- **Compact mode**: On scroll, header shrinks (smaller logo, hides symbol, becomes sticky via `DetailsHeaderContainer`)
- **Text styling**:
  - Name: `heading2` variant in Tamagui (`$neutral1`)
  - Symbol: body text, `$neutral2`
  - Address: `body3` variant, `$neutral2`, with copy icon

### Our Token Header
- **Component**: `token-header.tsx`
- **Layout**: Vertical `flex-col`:
  - Row 1: Token icon (green circle with "C") + "CASH" h1 + "$CASH" span
  - Row 2: Price (large monospace) + 24h change percentage
  - Row 3 (optional): OHLC values when hovering candle chart
- **Price display integrated into header** (unlike Uniswap where price is in the chart)
- **Flash animation** on price change (WebSocket)

### Key Differences
| Property | Uniswap | Ours |
|----------|---------|------|
| **Price location** | Inside the chart component (overlaid) | In the token header |
| **Breadcrumb** | Yes ("Tokens > ETH") | No |
| **Compact/sticky** | Yes — shrinks on scroll, becomes sticky header | No compact mode |
| **Token logo** | Fetched from API (actual token logo image) | Hardcoded green circle with "C" |
| **Header actions** | Share, favorite/watchlist, report buttons | None |
| **Address display** | Shortened address with copy | Not in header (separate TokenInfo) |
| **OHLC display** | Not in header | Yes, on candle hover |
| **Price change** | Shown in chart area with colored percentage | Shown in header |

### What to change:
1. Move price display from header into the chart section (Uniswap style)
2. Add breadcrumb navigation ("Tokens > CASH")
3. Implement compact/sticky header on scroll
4. Add header action buttons (share, favorite)
5. Move contract address into the header
6. Remove OHLC from header (or keep as enhancement)

---

## 5. Chart Comparison

### Uniswap Chart
- **Component**: `ChartSection.tsx` + `ChartControls.tsx`
- **Chart library**: Custom `@uniswap/charts` (internal), NOT lightweight-charts. Uses `PriceChart`, `VolumeChart`, `LineChart` components from `~/components/Charts/`
- **Chart height**: `EXPLORE_CHART_HEIGHT_PX = 356px`
- **Chart types**: Price (line/candlestick), Volume (bar), TVL (area) — toggled via `ChartTypeToggle`
- **Time periods**: 1H, 1D, 1W, 1M, 1Y, ALL — via `SegmentedControl` component
- **Advanced toggle**: `AdvancedPriceChartToggle` for switching between line and candlestick on price chart
- **Price display**: Price and percentage change overlaid on chart header area
- **Controls position**: Chart type toggle on left, time period pills on right, advanced toggle above
- **No card wrapper** — chart renders directly in the left panel
- **Skeleton loading**: `LoadingChart` component (from Explore)
- **Data source**: GraphQL queries, not REST API + WebSocket

### Our Chart
- **Component**: `price-chart.tsx`
- **Chart library**: `lightweight-charts` (TradingView) — dynamically imported
- **Chart height**: `h-[220px] sm:h-[300px]`
- **Chart types**: Candle, Line — toggled via custom buttons
- **Time periods**: 1H, 1D, 1W, 1M, 1Y — custom rounded-full buttons
- **Card wrapper**: `rounded-2xl border border-border bg-card p-4`
- **Controls position**: Mode toggle (left), time tabs (right) — inside card
- **Real-time**: WebSocket trades update chart in real-time
- **Loading**: Custom skeleton + empty state

### Key Differences
| Property | Uniswap | Ours |
|----------|---------|------|
| **Chart library** | Internal `@uniswap/charts` | `lightweight-charts` (TradingView) |
| **Chart height** | `356px` | `220px` mobile, `300px` desktop |
| **Chart types** | Price, Volume, TVL | Candle, Line only |
| **Time periods** | 1H, 1D, 1W, 1M, 1Y, ALL | 1H, 1D, 1W, 1M, 1Y |
| **Container** | No card border/bg | Card with border + bg + padding |
| **Time selector** | `SegmentedControl` (Tamagui component) | Custom pill buttons |
| **Chart type toggle** | `ChartTypeToggle` icon buttons | Text buttons (Candle/Line) |
| **Price overlay** | Price + % change overlaid on chart | Price in separate header component |

### What to change:
1. Increase chart height to `356px`
2. Remove card wrapper (border, background, padding)
3. Add Volume and TVL chart types
4. Add "ALL" time period option
5. Style time period selector as segmented control (not pill buttons)
6. Move price display to overlay on chart area
7. Consider chart type toggle with icons instead of text

---

## 6. Stats Section Comparison

### Uniswap Stats
- **Component**: `StatsSection.tsx`
- **Layout**: Wrapped flex row with `StatWrapper` components
- **Stats shown**: Market Cap, FDV, 24H Volume, TVL, 52W High, 52W Low
- **Stat item layout**: Vertical — `title` text above `value` text
- **Title style**: `body2`, `$neutral2` color, with tooltip on hover
- **Value style**: `heading3`, `$neutral1` color
- **Gap**: `$gap20` (20px) between stat items
- **Data source**: GraphQL `useTokenMarketStats` hook with live price override
- **Container**: Horizontal flex wrap, no card/border
- **Section header**: "Stats" heading text

### Our Stats
- **Component**: `token-stats-grid.tsx`
- **Layout**: CSS Grid `grid-cols-2 sm:grid-cols-4`
- **Stats shown**: Market cap, 24H volume, FDV, Total supply
- **Stat item**: Card with `rounded-xl border border-border bg-card p-4`
- **Title style**: `text-xs text-muted-foreground mb-2`
- **Value style**: `font-mono text-sm font-bold text-white`
- **Gap**: `gap-2 sm:gap-4`
- **Data**: REST API `/market` endpoint; most values are `--` placeholder

### Key Differences
| Property | Uniswap | Ours |
|----------|---------|------|
| **Layout** | Flex wrap, no cards | CSS Grid with card borders |
| **Stats count** | 6 (Market Cap, FDV, Volume, TVL, 52W High, 52W Low) | 4 (Market cap, Volume, FDV, Total supply) |
| **Section header** | "Stats" text heading | None |
| **Card styling** | No card wrapper | Each stat in bordered card |
| **Tooltips** | Tooltip on stat title hover | No tooltips |
| **Value formatting** | Localized fiat formatting | Custom compact formatting |
| **Gap** | 20px | 8px (gap-2) to 16px (sm:gap-4) |

### What to change:
1. Remove individual card borders — render stats as flat list
2. Add "Stats" section heading
3. Add TVL, 52W High, 52W Low stats
4. Add tooltips on stat titles
5. Increase gap to 20px
6. Change to flex-wrap layout instead of grid

---

## 7. Swap Widget Comparison

### Uniswap Swap Widget
- **Component**: `TDPSwapComponent.tsx` wraps the main `<Swap>` page component
- **Width**: Fixed `360px` (from `SWAP_COMPONENT_WIDTH`)
- **Position**: Right panel, not explicitly sticky (uses `display` to preserve state)
- **Additional features**: 
  - `TokenWarningCard` below swap
  - Navigates to token detail page when user changes token in swap
  - Pre-fills input/output currencies based on the viewed token
- **Not sticky**: The right panel has `gap: 40px` and is simply in the flow
- **On mobile (`$xl`)**: Swap shows on the left panel (via `MobileBottomBar` actions)

### Our Swap Widget
- **Component**: `swap/swap-widget.tsx`
- **Width**: Full width of right column (35% of container)
- **Position**: `sticky top-[72px]` on desktop
- **Features**:
  - Swap + Limit tabs
  - Token selector modal
  - You Pay / You Receive inputs
  - Direction toggle with rotation animation
  - CTA button with state-aware labels
  - Price details expandable
  - Panora routing for non-CASH/USD1 pairs
  - Limit order form
- **Container**: `rounded-2xl border border-border bg-card p-5`
- **Mobile**: Shown inline in left column

### Key Differences
| Property | Uniswap | Ours |
|----------|---------|------|
| **Width** | Fixed `360px` | Fluid (35% of container) |
| **Sticky** | No (or display-based) | Yes, `sticky top-[72px]` |
| **Container** | Minimal styling (inherits from Swap page) | Card with border + bg + padding |
| **Tabs** | Part of the Swap page (Swap/Limit/Buy/Sell in nav) | Swap/Limit tabs inside widget |
| **Token warning** | Shows `TokenWarningCard` below swap | None |
| **Navigation** | Changes token → navigates to new TDP | No navigation |

### What to change:
1. Set swap widget to fixed `360px` width
2. Consider removing sticky behavior (match Uniswap's non-sticky approach)
3. Adjust container styling to match Uniswap's card style
4. Add token warning card below swap if applicable

---

## 8. Activity/Transactions Table Comparison

### Uniswap Activity Section
- **Component**: `ActivitySection.tsx`
- **Tabs**: "Transactions" and "Pools" (two tabs)
- **Tab style**: `heading3` variant text, `$neutral1` color, clickable
- **Transactions table**: `TransactionsTable` component (separate file)
- **Pools table**: `TokenDetailsPoolsTable` component
- **Data**: GraphQL queries for token transactions
- **No card wrapper** — renders directly in the left panel
- **Inactive tab**: grayed out (`$neutral3` color)

### Our Transactions Table
- **Component**: `transactions-table.tsx`
- **Tabs**: None — single "Transactions" view
- **Table library**: `@tanstack/react-table`
- **Columns**: Time, Type (Buy/Sell), Price, Amount, Address
- **Card wrapper**: `rounded-2xl border border-border bg-card p-4`
- **Header**: "Transactions" text + "Recent activity" subtitle
- **Animation**: Framer Motion row enter animation
- **Sorting**: Sortable columns via click

### Key Differences
| Property | Uniswap | Ours |
|----------|---------|------|
| **Tabs** | Transactions + Pools | Transactions only |
| **Tab style** | Large `heading3` text | Small header text |
| **Card wrapper** | None | Card with border |
| **Table style** | Integrated table component | @tanstack/react-table |
| **Section heading** | Tab labels as heading | "Transactions" header |

### What to change:
1. Add "Pools" tab alongside "Transactions"
2. Remove card wrapper
3. Use large heading text for tab labels
4. Style tabs as Uniswap's heading3 text with clickable behavior

---

## 9. Token Info / Description Comparison

### Uniswap Token Description
- **Component**: `TokenDescription.tsx`
- **Content**:
  - "About" section heading
  - Token description text (truncatable at 300 chars with "Show more")
  - Link pills: Address (with copy), Explorer, Website, Twitter
  - Fee info (buy/sell fees with tooltip)
  - Multichain address dropdown (if token exists on multiple chains)
- **Layout**: Vertical flex with pill-style link buttons
- **Description text**: `body1` variant, `$neutral1`, line-height: 24, max-width: 100%
- **Link pills**: Rounded buttons with icon + label, shadow, clickable
- **No card wrapper**

### Our Token Info
- **Component**: `token-info.tsx`
- **Content**:
  - "Token Info" heading
  - Contract address (truncated) with Copy + Explorer link buttons
- **Layout**: Card with `rounded-2xl border border-border bg-card p-4`
- **Minimal**: No description, no website/twitter links, no fee info

### Key Differences
| Property | Uniswap | Ours |
|----------|---------|------|
| **Section name** | "About" | "Token Info" |
| **Description** | Full text with truncation | None |
| **Social links** | Website, Twitter as pill buttons | None |
| **Explorer link** | Pill button with icon | Text link |
| **Fee info** | Buy/sell fee display | None |
| **Card wrapper** | None | Yes |
| **Multichain** | Dropdown for multiple chains | N/A |

### What to change:
1. Rename "Token Info" → "About"
2. Add token description text (can be hardcoded or from API)
3. Add website and Twitter link pills
4. Style as pill buttons with icons
5. Remove card wrapper
6. Add "Show more" truncation for description

---

## 10. Color Scheme & Theme Comparison

### Uniswap Colors (Dark Mode)
From `theme/colors.ts` — the dark theme uses "Spore" design tokens:
| Token | Value (approx) | Description |
|-------|-----------------|-------------|
| `background` | `#000000` (black) | Page background |
| `neutral1` | `#FFFFFF` (white) | Primary text |
| `neutral2` | ~`#9B9B9B` | Secondary text |
| `neutral3` | ~`#5E5E5E` | Muted text / borders |
| `surface1` | ~`#0D0D0D` or `#131313` | Card/surface background |
| `surface2` | ~`#1B1B1B` | Elevated surface |
| `surface3` | ~`#2F2F2F` (solid) | Higher surface |
| `accent1` | `#FC72FF` (pink/magenta) | Primary accent (Uniswap pink) |
| `accent2` | Derived from accent1 | Secondary accent |
| `success` | `#40B66B` (green300) | Green for positive |
| `critical` | `#FA2B39` (red400) | Red for negative |

### Our Colors
From `globals.css`:
| Token | Value | Description |
|-------|-------|-------------|
| `background` | `#000000` | Page background |
| `foreground` | `#FFFFFF` | Primary text |
| `card` | `#111111` | Card background |
| `primary` | `#00D54B` | Primary accent (green) |
| `destructive` | `#FF3B30` | Red for errors |
| `muted-foreground` | `#888888` | Muted text |
| `border` | `#1A1A1A` | Border color |
| `secondary` | `#1A1A1A` | Secondary background |
| `cash-green` | `#00D54B` | Bid/positive |
| `cash-red` | `#FF3B30` | Ask/negative |
| `surface` | `#111111` | Surface |
| `surface-hover` | `#1A1A1A` | Hover state |
| `text-secondary` | `#888888` | Secondary text |
| `text-muted` | `#555555` | Muted text |

### Key Color Differences
| Property | Uniswap | Ours |
|----------|---------|------|
| **Primary accent** | `#FC72FF` (pink/magenta) | `#00D54B` (green) |
| **Secondary text** | ~`#9B9B9B` (`neutral2`) | `#888888` |
| **Muted text** | ~`#5E5E5E` (`neutral3`) | `#555555` |
| **Card/surface bg** | ~`#0D0D0D` to `#131313` (`surface1`) | `#111111` |
| **Elevated surface** | ~`#1B1B1B` (`surface2`) | `#1A1A1A` |
| **Highest surface** | ~`#2F2F2F` (`surface3`) | `#2A2A2A` |
| **Success/green** | `#40B66B` | `#00D54B` |
| **Error/red** | `#FA2B39` | `#FF3B30` |
| **Border color** | `neutral3` (~`#5E5E5E`) or none | `#1A1A1A` |
| **Card borders** | Rarely used (borderless cards) | Used extensively |

### Critical Difference: Uniswap uses MINIMAL borders
Uniswap's TDP has almost **no visible card borders**. Components flow into the page without explicit border outlines. The visual separation comes from spacing and subtle background color differences. Our design uses `border border-border` on almost every card.

### What to change:
1. **Primary accent**: Keep green (this is our brand), or adapt to match
2. **Remove most card borders** — Uniswap uses borderless design
3. **Adjust surface colors**: Make card bg closer to `#131313`
4. **Muted text**: Adjust to closer to Uniswap's `neutral2` (~`#9B9B9B`)
5. **Green color**: Consider `#40B66B` instead of `#00D54B` for success states

---

## 11. Typography Comparison

### Uniswap Typography
- **Font family**: System/native — Tamagui uses the system font stack (`$body` font family). NOT Geist.
- **Heading variants**: `heading1` through `heading3` (Tamagui)
  - `heading2`: Used for token name — large, weight ~600
  - `heading3`: Used for stat values, activity tabs — medium size
- **Body variants**: `body1`, `body2`, `body3`
  - `body1`: Token description — line-height 24px
  - `body2`: Stat titles
  - `body3`: Smaller text
- **Font weight**: heading ~485-600, body ~400
- **Price display**: Localized formatter (`convertFiatAmountFormatted`) — NOT monospace
- **Numbers**: Use localization context, NOT raw monospace
- **No explicit monospace** for prices/amounts — uses the body font

### Our Typography
- **Font family**: `Geist Sans` (variable, `--font-geist-sans`) + `Geist Mono` (variable, `--font-geist-mono`)
- **Monospace usage**: Extensive — prices, amounts, addresses all use `font-mono`
- **Heading**: `text-xl font-bold` for token name
- **Price**: `text-2xl sm:text-3xl font-bold font-mono`
- **Stats values**: `font-mono text-sm font-bold`
- **Body text**: Various `text-sm`, `text-xs`

### Key Typography Differences
| Property | Uniswap | Ours |
|----------|---------|------|
| **Font family** | System font (Tamagui default) | Geist Sans / Geist Mono |
| **Monospace usage** | Minimal — NOT used for prices | Extensive — prices, amounts, addresses |
| **Price rendering** | Localized formatter, proportional font | Monospace bold |
| **Heading weight** | ~485-600 | 700 (bold) |
| **Line heights** | Explicitly set per variant | Tailwind defaults |

### What to change:
1. Reduce monospace usage — use proportional font for prices (matches Uniswap)
2. Adjust heading weight to ~500-600 (currently 700/bold)
3. Consider using system font stack instead of Geist (or keep Geist as brand identity)
4. Use proportional font for stat values

---

## 12. Summary of Changes Needed

### Priority 1: Layout (Biggest Visual Impact)
- [ ] Change max content width from `1280px` → `1200px`
- [ ] Change right panel from `35%` → fixed `360px`
- [ ] Increase column gap from `24-32px` → `80px`
- [ ] Increase horizontal padding to `40px` desktop / `20px` mobile
- [ ] Add `32px` top margin, `48px` bottom padding
- [ ] Change responsive breakpoint from `md (768px)` → `xl (1280px)` for column→row transition

### Priority 2: Remove Card Borders (Visual Design)
- [ ] Remove `border border-border bg-card` from chart container
- [ ] Remove card borders from stats grid items — use flat layout
- [ ] Remove card border from transactions/activity section
- [ ] Remove card border from token info/about section
- [ ] Overall: adopt Uniswap's "borderless card" design philosophy

### Priority 3: Component Structure Changes
- [ ] Add breadcrumb ("Tokens > CASH") above the header
- [ ] Move price display from header into chart area
- [ ] Add "Pools" tab to activity section
- [ ] Add Volume/TVL chart types
- [ ] Add "Stats" section heading above stats
- [ ] Add 52W High/Low stats
- [ ] Rename "Token Info" → "About" and add description text
- [ ] Add compact/sticky header on scroll
- [ ] Add header action buttons (share, favorite)

### Priority 4: Chart
- [ ] Increase chart height to `356px`
- [ ] Add "ALL" time period
- [ ] Style time selector as segmented control
- [ ] Add chart type selector (Price/Volume/TVL)

### Priority 5: Navbar
- [ ] Consider removing animated pill on active tab (Uniswap uses color only)
- [ ] Consider removing backdrop blur
- [ ] Height: Consider increasing to 64px

### Priority 6: Typography & Colors
- [ ] Reduce monospace font usage for prices
- [ ] Adjust muted text color closer to `#9B9B9B`
- [ ] Keep green primary (brand differentiation)

### Components/Patterns We're Missing Entirely
1. **Breadcrumb navigation** — Uniswap has "Tokens > {name}" breadcrumb
2. **Compact sticky header on scroll** — header shrinks and becomes sticky with smaller logo
3. **Token Carousel** — "Similar tokens" carousel below activity
4. **Balance Summary** — shows user's balance of the token on the page
5. **Bridged Asset Section** — shows if token is bridged
6. **Token Warning Card** — warns about risky tokens below swap
7. **Pools table** — alongside transactions in activity section
8. **Chart type toggle (Price/Volume/TVL)** — we only have Price
9. **Share/Favorite header actions** — action buttons in the header
10. **Advanced Price Chart Toggle** — candlestick vs line in Uniswap's chart

---

## Appendix: Uniswap Breakpoint Reference

Uniswap uses Tamagui breakpoints (from `ui/src/theme`):
| Breakpoint | Approx Width |
|------------|-------------|
| `$sm` | ~640px |
| `$md` | ~768px |
| `$lg` | ~1024px |
| `$xl` | ~1280px |

Their TDP layout switches from two-column to single-column at `$xl` (1280px), which is much larger than our `md` (768px).
