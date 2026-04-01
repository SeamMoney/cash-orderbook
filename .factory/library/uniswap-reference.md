# Uniswap TDP Reference

Reference repo at `/Users/maxmohammadi/uniswap-frontend/` (running on localhost:3000).

## Design System: Spore (Dark Mode)

### Colors
| Token | Value | Usage |
|-------|-------|-------|
| surface1 | #131313 | Page background, card bg |
| surface1Hovered | #1A1A1A | Hover on page bg |
| surface2 | #1F1F1F | Input/panel bg |
| surface2Hovered | #242424 | Hover on inputs |
| surface3 | rgba(255,255,255,0.12) | Borders, dividers |
| surface3Solid | #393939 | Solid border variant |
| neutral1 | #FFFFFF | Primary text |
| neutral2 | rgba(255,255,255,0.65) | Secondary text, labels |
| neutral3 | rgba(255,255,255,0.38) | Muted text, placeholders |
| accent1 | #FF37C7 | Uniswap pink (we use #00D54B green) |
| statusSuccess | #21C95E | Positive/green |
| statusCritical | #FF593C | Negative/red |
| scrim | rgba(0,0,0,0.60) | Modal overlay |

### Typography (font sizes are `n+1` from base)
| Token | Size | Line Height | Weight |
|-------|------|-------------|--------|
| heading1 | 53px | 50.88px | 400 |
| heading2 | 37px | 40px | 400 |
| heading3 | 25px | 30px | 400 |
| subheading1 | 19px | 24px | 400 |
| subheading2 | 17px | 20px | 400 |
| body1 | 19px | 24.7px | 400 |
| body2 | 17px | 22.1px | 400 |
| body3 | 15px | 19.5px | 400 |
| body4 | 13px | 16px | 400 |
| buttonLabel1 | 19px | 21.85px | 500 |
| buttonLabel2 | 17px | 19.55px | 500 |
| buttonLabel3 | 15px | 17.25px | 500 |
| buttonLabel4 | 13px | 14.95px | 500 |

Font: Basel Grotesk → we use Geist Sans (weight 485→font-medium, 535→font-semibold)

### Spacing Tokens (px)
4, 8, 12, 16, 20, 24, 32, 40, 48, 60

### Border Radius Tokens (px)
| Token | Value |
|-------|-------|
| rounded4 | 4 |
| rounded8 | 8 |
| rounded12 | 12 |
| rounded16 | 16 |
| rounded20 | 20 |
| rounded24 | 24 |
| rounded32 | 32 |
| roundedFull | 999999 |

### Breakpoints (width)
| Name | Value |
|------|-------|
| sm | 450px |
| md | 640px |
| lg | 768px |
| xl | 1024px |
| xxl | 1280px |

## TDP Layout Dimensions
- Max content width: 1200px
- Left panel: flex-grow
- Right panel: 360px fixed
- Gap: 80px
- Horizontal padding: 40px (20px on mobile)
- Top margin: 32px
- Bottom padding: 48px
- Stacks to single column at ≤1024px

## Navbar
- Height: 72px
- Full viewport width
- Background: surface1 (#131313)

## Token Header
- Logo: 56px (icon56)
- Name: heading3 (25px)
- Symbol: body2 (17px), neutral2 color
- Breadcrumb: body3 (15px), chevron SVG separator

## Chart
- Height: 356px (EXPLORE_CHART_HEIGHT_PX)
- Price display: heading2 (37px)
- Controls below chart

## Stats Section
- Heading: heading3 (25px)
- Layout: flex-row, flex-wrap, gap 20px
- Each stat: 50% width (calc(50% - 20px))
- Labels: body3 (15px), neutral2
- Values: heading3 (25px), neutral1
- Borders: 0.5px solid surface3

## Swap Widget (on TDP)
- Width: 360px
- Container: surface1 bg, 1px surface3 border, rounded16, 8px padding
- Input sections: surface2 bg, 120px height, rounded16, 16px padding
- Input border: invisible default (same as bg), surface2Hovered on hover, surface3 on focus
- Arrow: 40x40, rounded12, surface2 bg, 4px surface1 border, -18px overlap
- CTA: buttonLabel2 (17px), rounded20, 56px height
- Tab bar: SegmentedControl
- Token selector: roundedFull pill

## Key Source Files in Uniswap Repo
- TDP layout: apps/web/src/pages/TokenDetails/components/skeleton/Skeleton.tsx
- Stats: apps/web/src/pages/TokenDetails/components/info/StatsSection.tsx
- Description: apps/web/src/pages/TokenDetails/components/info/TokenDescription.tsx
- Chart: apps/web/src/pages/TokenDetails/components/chart/ChartSection.tsx
- Swap on TDP: apps/web/src/pages/TokenDetails/components/swap/TDPSwapComponent.tsx
- Swap skeleton: apps/web/src/components/swap/SwapSkeleton.tsx
- Header: apps/web/src/pages/TokenDetails/components/header/TokenDetailsHeader.tsx
- Theme colors: packages/ui/src/theme/color/colors.ts
- Theme tokens: packages/ui/src/theme/tokens.ts
- Theme config: packages/ui/src/theme/config.ts
