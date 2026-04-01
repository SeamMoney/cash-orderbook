# Uniswap Token Detail Page — Pixel-Perfect Reference

## Source Material
- **Official screenshots** from Uniswap Help Center (light mode): `uniswap-tdp-top-official.png`, `uniswap-tdp-bottom-official.png`
- **CASH project screenshots** (dark mode, mirrors Uniswap layout): `cash-token-page-full.png`, `cash-token-page-viewport.png`, `cash-annotated-top.png`
- **Existing project screenshots**: `../screenshots/` directory (full-page, swap-widget, navbar, chart-and-stats)
- **Design tokens extracted** from Uniswap interface source code (`github.com/Uniswap/interface`)

---

## Overall Page Layout (1440×900 viewport)

### Structure
- **Two-column layout**: Left column (token info, chart, stats, transactions) + Right sidebar (swap widget)
- **Max content width**: 1200px centered, with 40px horizontal padding
- **Left column**: ~680px wide (flexible)
- **Right sidebar**: 360px fixed width, `flex-shrink-0`, sticky at `top: 72px`
- **Gap between columns**: ~40px
- **Page background**: `#000000` (CASH) / `#131313` (Uniswap dark)

### Vertical Sections (top to bottom, left column)
1. Breadcrumbs
2. Token header (icon + name + ticker)
3. Price display + percentage change
4. Chart type toggle + Time range selectors
5. Chart area
6. Stats section (2×2 grid)
7. Transactions table
8. About/Info section
9. Contract + Links

---

## Navbar / Header

### Dimensions
- **Height**: 72px
- **Full width**: stretches across entire viewport
- **Background**: `rgb(0, 0, 0)` (CASH) / `#131313` (Uniswap dark mode)
- **No visible border-bottom** (or very subtle)

### Elements (left to right)
1. **Logo** ("CASH" text, bold white, ~18px) — left-aligned with ~24px left margin
2. **Nav links** (center area): "Trade", "Explore" — ~14px font, white text, ~16-24px gap between
3. **Search bar** (right area): Rounded pill shape, dark background (`#1F1F1F`), placeholder "Search tokens", search icon (magnifying glass), ~200px wide, ~36px height
4. **"Log In" button**: Ghost/text style, white text, ~14px
5. **"Sign Up" button**: Green accent background (`#00D54B` / `lab(66.9756 -58.27 19.5419)`), white text, fully rounded (pill shape), ~14px font, 600 weight, padding `6px 16px`

### Uniswap Differences
- Uniswap navbar has: Uniswap unicorn logo, "Trade", "Explore", "Pool" tabs
- Pink "Connect" button instead of Log In/Sign Up
- Network selector dropdown
- Hamburger/more menu (...)

---

## Token Header Section

### Breadcrumbs
- Text: "Tokens > CASH" (or "Explore > Tokens > ETH" on Uniswap)
- Font: ~14px, muted color (`rgba(255,255,255,0.65)`)
- Margin-bottom: ~20px (mb-5)

### Token Identity Row
- **Token icon**: 48px circular, green background with "C" letter
- **Token name**: "CASH" — ~24-28px, white, font-weight 400-500
- **Token ticker**: "$CASH" — ~16px, muted gray (`rgba(255,255,255,0.65)`)
- Horizontal layout, ~12px gap between icon and text

### Price Display
- **Price**: "$--" (placeholder) or "$1,788.84" (Uniswap ETH example)
- **Font**: ~36px, white, bold/semibold, monospace-like or heading font
- **Percentage change**: "-1.75%" — ~16px, red/green color
  - Red (negative): `#FF593C` (Uniswap) / `#ef4444` (CASH red-500)
  - Green (positive): `#21C95E` (Uniswap statusSuccess)
- Price and percentage on the same line, ~8px gap

---

## Chart Controls

### Chart Type Toggle (left side)
- Two buttons: "Candle" and "Line"
- **Active button** (Candle): Green background (`rgb(0, 213, 75)`), black text, `12px` font, `border-radius: 8px`, padding `6px 12px`
- **Inactive button** (Line): Transparent background, muted gray text (`rgb(85, 85, 85)`), same sizing
- Grouped together with border/background container

### Time Range Selectors (right side, same row)
- Buttons: 1H, **1D**, 1W, 1M, 1Y, ALL
- **Active** (1D): White text, font-weight 600, `12px` font
- **Inactive**: Muted gray text, normal weight
- No visible borders, transparent backgrounds
- Horizontal row with ~8-12px gaps

### Uniswap Differences
- Uniswap has line/candlestick toggle icons (not text buttons)
- Chart type dropdown: "Price" with options for Volume, TVL
- Same time range selectors: 1H, 1D, 1W, 1M, 1Y

---

## Chart Area

### Container
- **Height**: ~356px
- **Background**: `rgb(0, 0, 0)` (same as page)
- **Border**: `1px dashed rgb(26, 26, 26)` — dashed border style
- **Border-radius**: `10px`
- When no data: Shows chart icon + "Unable to load chart data" + "Check that the API is running"

### Uniswap Chart
- Pink/magenta line chart (`#FF37C7` accent color)
- Filled area below the line with gradient to transparent
- Y-axis: Price labels on the right
- X-axis: Date labels at bottom
- Hover tooltip shows exact price and date
- Chart background is same as page (transparent/surface1)

---

## Stats Section

### Heading
- "Stats" — `25px` font, font-weight 500, white

### Layout
- **2×2 grid** layout
- Each stat has: Label (left) + Value (right), separated by dashes/space
- Thin horizontal separator lines between rows (`1px solid rgba(255,255,255,0.12)`)

### Stats Items
| Label | Position |
|-------|----------|
| Market cap | Top-left |
| 24H volume | Top-right |
| FDV | Bottom-left |
| Total supply | Bottom-right |

### Typography
- **Label**: ~14-16px, muted white (`rgba(255,255,255,0.65)`)
- **Value**: ~14-16px, white, right-aligned

### Uniswap Stats
- TVL, Market cap, FDV, 1 day volume
- Similar 2×2 grid layout

---

## Swap Widget (Right Sidebar)

### Container
- **Width**: 360px (including container), actual inner card ~342px
- **Background**: `rgb(19, 19, 19)` / `#131313`
- **Border**: `1px solid rgb(26, 26, 26)` / `#1A1A1A`
- **Border-radius**: `16px`
- **Padding**: `8px`
- **Position**: Sticky, `top: 72px`

### Tab Bar (Swap / Limit)
- Two tabs: "Swap" (active), "Limit"
- **Active tab**: Subtle background highlight, white text
- **Inactive tab**: No background, muted text
- Full-width segmented control style
- Background behind tabs creates the tab-bar container

### "You pay" Input Section
- **Background**: `rgb(31, 31, 31)` / `#1F1F1F`
- **Border-radius**: `16px`
- **Padding**: `16px`
- **Height**: ~102px
- **Label**: "You pay" — small, muted text (~12-14px)
- **Input**: Large "0" placeholder — ~28-32px, white, left-aligned
- **Token selector button**: Right-aligned, pill shape (`border-radius: 9999px`), dark bg (`#1F1F1F`), token icon (round) + name + chevron, padding `8px 12px`, 16px font

### Swap Direction Arrow
- Centered between "You pay" and "You receive"
- Small circular button with up/down arrows icon (⇅)
- ~32px diameter
- Subtle border, dark background

### "You receive" Input Section
- Same styling as "You pay" section
- Label: "You receive"
- Token selector: Shows selected token (e.g., "CASH" with green icon)

### Connect Wallet Button
- **Background**: `rgb(0, 213, 75)` — bright green
- **Text**: "Connect Wallet" — black, `16px`, font-weight 600
- **Border-radius**: `20px`
- **Padding**: `14px 0` (tall, full-width)
- **Height**: ~52px
- Full width within the card

### Uniswap Differences
- Uniswap has Swap/Limit/Send/Buy tabs (4 tabs)
- Pink accent button for "Get started" or "Connect"
- Price details dropdown below the button
- "Your balance" section showing token balances

### Price Details
- Collapsed accordion below button
- "Enter an amount to see price details" text with chevron
- Muted text, full-width

---

## Transactions Section

### Heading
- "Transactions" — same size as "Stats" heading

### Table Headers
- Columns: Time, Type, Price, Amount, Address
- Sort arrows (↑↓) on each column
- Header text: ~12-14px, muted color

### Empty State
- "No recent transactions"
- "Trades will appear here in real-time"
- Muted/gray text, centered

---

## About / Info Section

### Heading
- "About" — same heading style

### Description
- Paragraph text, ~14px body text, muted/light gray

### Links
- Row of pill-shaped buttons:
  - Contract address button (copy icon + truncated address)
  - "Explorer" link (external link icon)
  - "Website" link (globe icon)
- Each: Small pill, border, transparent background, ~12-14px, icon + text

---

## Uniswap Design Tokens (from source code)

### Dark Mode Colors
```
surface1:     #131313   (main background, card bg)
surface1Hov:  #1A1A1A   (hover state)
surface2:     #1F1F1F   (secondary/input background)
surface2Hov:  #242424   (hover state)
surface3:     rgba(255,255,255,0.12)  (borders, dividers)
surface3Solid: #393939
neutral1:     #FFFFFF   (primary text)
neutral2:     rgba(255,255,255,0.65)  (secondary text)
neutral3:     rgba(255,255,255,0.38)  (tertiary/muted text)
accent1:      #FF37C7   (primary accent — pink/magenta)
statusSuccess: #21C95E  (positive/green)
statusCritical: #FF593C (negative/red)
statusWarning: #FFBF17  (warning/yellow)
```

### Light Mode Colors
```
surface1:     #FFFFFF
surface2:     #F9F9F9
neutral1:     #131313
neutral2:     rgba(19,19,19,0.63)
accent1:      #FF37C7
statusSuccess: #0C8911
statusCritical: #E10F0F
```

### Font
- **Primary**: "Basel Grotesk" (proprietary, Uniswap custom font)
- **Web fallback**: `-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
- **Monospace**: `ui-monospace, SFMono-Regular, SF Mono, Menlo, Monaco, "Cascadia Mono", monospace`
- **Book weight (web)**: 485
- **Medium weight (web)**: 535

### Font Sizes
```
heading1: 53px (52+1), lineHeight ~50px
heading2: 37px, lineHeight 40px
heading3: 25px, lineHeight 30px
subheading1: 19px, lineHeight 24px
subheading2: 17px, lineHeight 20px
body1: 19px, lineHeight ~25px
body2: 17px, lineHeight ~22px
body3: 15px, lineHeight ~20px
body4: 13px, lineHeight 16px
buttonLabel1: 19px (medium weight)
buttonLabel2: 17px (medium weight)
buttonLabel3: 15px (medium weight)
buttonLabel4: 13px (medium weight)
```

### Border Radii
```
none: 0
rounded4: 4px
rounded6: 6px
rounded8: 8px
rounded12: 12px
rounded16: 16px
rounded20: 20px
rounded24: 24px
rounded32: 32px
roundedFull: 999999px
```

---

## CASH App Computed Styles (localhost:3102)

### Body
- Background: `rgb(0, 0, 0)` (pure black — differs from Uniswap's #131313)
- Color: `rgb(255, 255, 255)`
- Font: `GeistSans, "GeistSans Fallback", system-ui, sans-serif`

### Swap Widget
- Background: `rgb(19, 19, 19)` / #131313
- Border: `1px solid rgb(26, 26, 26)` / #1A1A1A
- Border-radius: 16px
- Padding: 8px

### Input Sections
- Background: `rgb(31, 31, 31)` / #1F1F1F
- Border-radius: 16px
- Padding: 16px
- Height: ~102px

### Connect Wallet Button
- Background: `rgb(0, 213, 75)` — CASH green accent
- Color: black
- Font-size: 16px
- Font-weight: 600
- Border-radius: 20px

### Active Chart Button
- Background: `rgb(0, 213, 75)` green
- Color: black
- Font-size: 12px
- Border-radius: 8px

### Stats Heading
- Font-size: 25px
- Font-weight: 500

### Chart Area
- Border: 1px dashed #1A1A1A
- Border-radius: 10px
- Height: 356px

### Main Content
- Max-width: 1200px
- Padding: 0 40px 48px

---

## Key Differences: CASH vs Uniswap

| Feature | Uniswap | CASH |
|---------|---------|------|
| Background | #131313 | #000000 (pure black) |
| Font | Basel Grotesk | Geist Sans |
| Accent color | #FF37C7 (pink) | #00D54B (green) |
| Nav tabs | Trade, Explore, Pool | Trade, Explore |
| Auth | "Connect" (wallet) | Log In / Sign Up |
| Swap tabs | Swap/Limit/Send/Buy | Swap/Limit |
| Chart line | Pink/magenta | Green (when data) |
| Stats items | TVL, Market cap, FDV, 1D vol | Market cap, 24H vol, FDV, Total supply |
