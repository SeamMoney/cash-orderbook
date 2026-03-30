---
name: frontend-trading
description: Frontend design system and component patterns from the sol2move app. Covers the exact color palette, typography, animations, shadcn config, Framer Motion patterns, and trading-specific UI components.
user-invocable: true
---

# Trading Dashboard Frontend

Design system extracted from sol2move-app. All values are from the actual codebase.

## Design Tokens (from sol2move globals.css)

### Colors — Dark Mode First
```css
/* Backgrounds */
--background: #212121;           /* Main app background */
#1A1A1A                          /* Secondary/card background */
#0D0D0D                          /* Code block background */
#141414                          /* Code block headers */

/* Surfaces & Borders */
#2A2A2A                          /* Borders, hover states, dividers */
oklch(1 0 0 / 10%)              /* Subtle transparent white borders */
oklch(1 0 0 / 15%)              /* Input borders */
rgba(42, 42, 42, 0.6)           /* Semi-transparent overlays */

/* Text */
#FFFFFF                          /* Primary text */
#888888                          /* Secondary text */
#666666                          /* Tertiary/muted text */
#555555                          /* Very muted text */
oklch(0.556 0 0)                /* Muted foreground (shadcn) */

/* Semantic */
#22C55E                          /* Success / green (bid/buy) */
#EF4444                          /* Error / red (ask/sell) */
#F59E0B                          /* Warning / amber */
oklch(0.577 0.245 27.325)       /* Destructive action */

/* Trading-specific */
emerald-500 (#10b981)           /* Bid/buy depth bars, positive PnL */
rose-500 (#f43f5e)              /* Ask/sell depth bars, negative PnL */
cyan-400                         /* Accent, highlights, active state */
```

### Radius Scale
```css
--radius: 0.625rem;              /* 10px base */
--radius-sm: calc(var(--radius) - 4px);   /* 6px */
--radius-md: calc(var(--radius) - 2px);   /* 8px */
--radius-lg: var(--radius);               /* 10px */
--radius-xl: calc(var(--radius) + 4px);   /* 14px */
```

### Typography
```tsx
// From sol2move layout.tsx
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// Apply to body
<body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
```

**Rules:**
- Geist Sans → all UI text, labels, buttons, navigation
- Geist Mono → prices, amounts, order IDs, timestamps, transaction hashes, code blocks
- Font weights: 400 (body), 500 (labels), 600 (headings), 700 (emphasis)

## Shadcn Configuration (from sol2move components.json)

```json
{
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

Use `new-york` style, `neutral` base color, Lucide icons, `cn()` utility from `clsx` + `tailwind-merge`.

## Framer Motion Patterns (from sol2move components)

### Tab/Mode Switching (SourceInputForm pattern)
```tsx
<AnimatePresence mode="wait">
  <motion.div
    key={activeTab}
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -6 }}
    transition={{ duration: 0.2, ease: 'easeOut' }}
  >
    {content}
  </motion.div>
</AnimatePresence>
```

### Modal Entrance (OptionsPanel pattern)
```tsx
<motion.div
  initial={{ opacity: 0, scale: 0.9 }}
  animate={{ opacity: 1, scale: 1 }}
  exit={{ opacity: 0, scale: 0.9 }}
  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
>
  {modalContent}
</motion.div>
```

### Staggered Children (section reveal)
```tsx
{sections.map((section, i) => (
  <motion.div
    key={section.id}
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: i * 0.03, type: 'spring', stiffness: 500, damping: 35 }}
  >
    {section.content}
  </motion.div>
))}
```

### Layout Animation (nav indicator)
```tsx
<motion.div
  layoutId="nav-indicator"
  style={{ background: 'linear-gradient(to bottom, #555555, #333333)' }}
  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
/>
```

### Shimmer Keyframe (from globals.css)
```css
@keyframes shimmer {
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
}
/* Usage: animation: shimmer 2s ease-in-out infinite */
```

## Trading-Specific Components

### Orderbook Ladder
```tsx
// Structure
<div className="grid grid-cols-2 gap-0">
  {/* Bids (left, green) — sorted descending by price */}
  <div className="flex flex-col">
    {bids.map(level => (
      <div key={level.price} className="relative flex items-center px-2 py-0.5 cursor-pointer hover:bg-emerald-500/10"
           onClick={() => setOrderPrice(level.price)}>
        {/* Depth bar behind */}
        <div className="absolute inset-0 bg-emerald-500/15"
             style={{ width: `${(level.total / maxDepth) * 100}%` }} />
        {/* Price | Size | Total */}
        <span className="font-mono text-emerald-400 z-10">{formatPrice(level.price)}</span>
        <span className="font-mono text-zinc-300 z-10">{formatQty(level.quantity)}</span>
      </div>
    ))}
  </div>
  {/* Asks (right, red) — sorted ascending by price */}
  {/* Same structure, rose-500 colors */}
</div>

// Animations
// - New orders: slide in from edge, 200ms spring
// - Quantity changes: 150ms ease-out on width transition
// - Filled orders: scale(0) + fade, 300ms
// - Use AnimatePresence + layout for smooth list transitions
```

### Depth Chart (Canvas)
```tsx
// Canvas-based area chart (from AsciiBackground pattern in sol2move)
useEffect(() => {
  const ctx = canvasRef.current?.getContext('2d');
  if (!ctx) return;

  function draw() {
    ctx.clearRect(0, 0, width, height);

    // Bid curve (green gradient, left to right)
    ctx.fillStyle = 'rgba(16, 185, 129, 0.15)'; // emerald-500/15
    ctx.beginPath();
    ctx.moveTo(midX, baseY);
    bids.forEach((level, i) => ctx.lineTo(midX - i * stepX, baseY - level.cumDepth * scaleY));
    ctx.fill();

    // Ask curve (red gradient, right)
    ctx.fillStyle = 'rgba(244, 63, 94, 0.15)'; // rose-500/15
    // ...

    animFrameRef.current = requestAnimationFrame(draw);
  }
  draw();
  return () => cancelAnimationFrame(animFrameRef.current);
}, [bids, asks]);
```

### Trade Ticker
```tsx
// Vertical scrolling list with AnimatePresence
<div className="overflow-hidden max-h-64">
  <AnimatePresence initial={false}>
    {trades.map(trade => (
      <motion.div
        key={trade.id}
        initial={{ opacity: 0, height: 0, x: 20 }}
        animate={{ opacity: 1, height: 'auto', x: 0 }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="flex items-center gap-3 px-3 py-1 font-mono text-sm"
      >
        <span className={trade.isBuy ? 'text-emerald-400' : 'text-rose-400'}>
          {formatPrice(trade.price)}
        </span>
        <span className="text-zinc-400">{formatQty(trade.quantity)}</span>
        <span className="text-zinc-600 text-xs">{timeAgo(trade.timestamp)}</span>
      </motion.div>
    ))}
  </AnimatePresence>
</div>
```

### Order Form
```tsx
// From OptionsPanel Toggle pattern (custom animated toggle)
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="relative w-10 h-5 rounded-full transition-colors"
      style={{ backgroundColor: value ? '#22C55E' : '#2A2A2A' }}
    >
      <motion.div
        className="absolute top-0.5 w-4 h-4 rounded-full bg-white"
        animate={{ left: value ? '22px' : '2px' }}
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
      />
    </button>
  );
}

// Buy/Sell tabs with animated indicator
<div className="relative flex">
  {['Buy', 'Sell'].map(side => (
    <button key={side} onClick={() => setSide(side)}
      className={`flex-1 py-2 text-sm font-medium z-10 ${activeSide === side ? 'text-white' : 'text-zinc-500'}`}>
      {side}
    </button>
  ))}
  <motion.div
    layoutId="order-side"
    className="absolute inset-y-0 w-1/2 rounded-md"
    style={{ backgroundColor: activeSide === 'Buy' ? '#10b981' : '#f43f5e' }}
    animate={{ x: activeSide === 'Buy' ? 0 : '100%' }}
    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
  />
</div>
```

### Price Flash Animation
```tsx
// Brief color flash on price change (400ms)
const [flash, setFlash] = useState<'up' | 'down' | null>(null);
useEffect(() => {
  if (newPrice > prevPrice) setFlash('up');
  else if (newPrice < prevPrice) setFlash('down');
  const t = setTimeout(() => setFlash(null), 400);
  return () => clearTimeout(t);
}, [newPrice]);

<span className={cn(
  'font-mono transition-colors duration-400',
  flash === 'up' && 'text-emerald-400',
  flash === 'down' && 'text-rose-400',
  !flash && 'text-zinc-100'
)}>
  {formatPrice(price)}
</span>
```

### Code Display (from MoveCodeBlock pattern)
```tsx
// Line-numbered code block with copy button
<div className="rounded-lg overflow-hidden" style={{ backgroundColor: '#0D0D0D' }}>
  <div className="flex items-center justify-between px-4 py-2" style={{ backgroundColor: '#141414' }}>
    <span className="text-xs text-zinc-500">{language}</span>
    <button onClick={copy} className="text-xs text-zinc-500 hover:text-zinc-300">Copy</button>
  </div>
  <pre className="p-4 overflow-x-auto font-mono text-sm leading-5" style={{ color: '#D4D4D4' }}>
    {lines.map((line, i) => (
      <div key={i} className="flex">
        <span className="w-8 text-right mr-4 select-none" style={{ color: '#444444' }}>{i + 1}</span>
        <span>{line}</span>
      </div>
    ))}
  </pre>
</div>
```

## Navigation (from NavDock pattern)

```tsx
// Fixed header with pill-shaped container
<nav className="fixed top-0 inset-x-0 z-50 flex justify-center pt-3">
  <div className="flex items-center gap-1 px-2 py-1.5 rounded-full"
       style={{ backgroundColor: 'rgba(33, 33, 33, 0.85)', backdropFilter: 'blur(12px)', border: '1px solid #2A2A2A' }}>
    {items.map(item => (
      <LayoutGroup key={item.id}>
        <button className={cn('relative px-3 py-1.5 text-sm rounded-full', active ? 'text-white' : 'text-zinc-500')}>
          {active && (
            <motion.div layoutId="nav-indicator" className="absolute inset-0 rounded-full"
              style={{ background: 'linear-gradient(to bottom, #555555, #333333)' }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
          )}
          <span className="relative z-10">{item.label}</span>
        </button>
      </LayoutGroup>
    ))}
  </div>
</nav>
```

## Responsive Strategy

- Desktop-primary for trading (1024px+ optimal)
- Stacked layout on mobile (grid-cols-1)
- Nav dock collapses to icon-only on small screens
- Orderbook switches to single-column (bids OR asks)
- Canvas charts resize with container (DPR-aware from AsciiBackground pattern)

## Tailwind v4 Setup

```css
/* globals.css */
@import "tailwindcss";
@import "tw-animate-css";
@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: #212121;
  --color-foreground: oklch(0.985 0 0);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  --radius: 0.625rem;
  /* ... full token set */
}
```

PostCSS: only `@tailwindcss/postcss` plugin.
