---
name: frontend-trading
description: Frontend patterns for the trading dashboard — orderbook visualization, depth charts, trade ticker, animations, and the design system.
user-invocable: true
---

# Trading Dashboard Frontend

## Design System
- **Colors**: Dark mode. Zinc-900 background, zinc-800 surfaces, zinc-700 borders.
  - Bid/buy: emerald-500 (#10b981)
  - Ask/sell: rose-500 (#f43f5e)
  - Accent: cyan-400
  - Text: zinc-100 primary, zinc-400 secondary, zinc-600 muted
- **Typography**: Geist Sans for UI, Geist Mono for all numbers/prices/amounts/IDs
- **Spacing**: 4px base unit, consistent padding scale
- **Radius**: rounded-lg (8px) for cards, rounded-md (6px) for inputs
- **Shadows**: None — use borders for elevation (dark mode pattern)

## Key Components

### Orderbook Ladder
- Two-column layout: bids left (green), asks right (red)
- Each row: price | size | total, with a depth bar behind
- Depth bars are percentage-width fills showing cumulative depth
- Animate new orders sliding in, filled orders fading out
- Mid-price spread indicator between bid/ask sides
- Click a price to auto-fill the order form

### Depth Chart
- Canvas/SVG area chart showing cumulative bid/ask depth
- Bids curve left-to-right (green gradient), asks right-to-left (red gradient)
- Crosshair on hover showing price/depth at cursor
- Smooth transitions when book updates (lerp between states)
- Use `requestAnimationFrame` for 60fps rendering

### Trade Ticker
- Horizontal or vertical scrolling list of recent trades
- Each trade: price, size, time, direction (green up / red down arrow)
- New trades slide in from top/right with a brief highlight flash
- Timestamp in relative format ("2s ago", "1m ago")

### Order Form
- Tabs: Limit / Market
- Inputs: price (limit only), amount, total (auto-calculated)
- Slider for percentage of available balance (25%, 50%, 75%, 100%)
- Buy (green) and Sell (red) buttons with loading states
- Inline validation: insufficient balance, min order size, price bounds

### Portfolio Panel
- Balances with animated value changes (count up/down on update)
- Open orders table with cancel button per row
- Trade history with expandable details

## Animation Guidelines
- Orderbook row updates: 150ms ease-out for quantity changes
- New orders: slide-in from edge, 200ms spring
- Filled orders: scale to 0 + fade, 300ms
- Trade ticker: slide + fade-in, 250ms
- Price changes: brief color flash (green for up, red for down), 400ms
- Use Framer Motion `AnimatePresence` + `layout` for list animations
- Use CSS `@keyframes` for continuous effects (pulse on connection status)
- Easing: `cubic-bezier(0.32, 0.72, 0, 1)` for responsive spring feel
