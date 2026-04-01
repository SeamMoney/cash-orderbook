import { createFont, createTamagui, createTokens } from '@tamagui/core'
import { createMedia } from '@tamagui/react-native-media-driver'

// ---------------------------------------------------------------------------
// 1. Colors — Uniswap Spore dark-mode palette (accent1 swapped to our green)
// ---------------------------------------------------------------------------

const colorTokens = {
  white: '#FFFFFF',
  black: '#000000',
  scrim: 'rgba(0,0,0,0.60)',

  // Accent colours from the Uniswap palette we reference but don't use in theme
  pinkLight: '#FEF4FF',
  pinkBase: '#FC74FE',
  greenVibrant: '#21C95E',
  redBase: '#FF5F52',
}

const sporeDark = {
  none: 'transparent',

  white: colorTokens.white,
  black: colorTokens.black,
  scrim: colorTokens.scrim,

  neutral1: '#FFFFFF',
  neutral1Hovered: 'rgba(255, 255, 255, 0.85)',
  neutral2: 'rgba(255, 255, 255, 0.65)',
  neutral2Hovered: 'rgba(255, 255, 255, 0.85)',
  neutral3: 'rgba(255, 255, 255, 0.38)',
  neutral3Hovered: 'rgba(255, 255, 255, 0.58)',

  surface1: '#131313',
  surface1Hovered: '#1A1A1A',
  surface2: '#1F1F1F',
  surface2Hovered: '#242424',
  surface3: 'rgba(255,255,255,0.12)',
  surface3Solid: '#393939',
  surface3Hovered: 'rgba(255,255,255,0.16)',
  surface4: 'rgba(255,255,255,0.20)',
  surface5: 'rgba(0,0,0,0.04)',
  surface5Hovered: 'rgba(0,0,0,0.06)',

  // Our accent is green (#00D54B), not Uniswap pink
  accent1: '#00D54B',
  accent1Hovered: '#00B840',
  accent2: 'rgba(0, 213, 75, 0.08)',
  accent2Hovered: 'rgba(0, 213, 75, 0.12)',
  accent2Solid: '#0D2618',
  accent3: '#FFFFFF',
  accent3Hovered: '#F5F5F5',

  statusSuccess: '#21C95E',
  statusSuccessHovered: '#15863C',
  statusSuccess2: 'rgba(33, 201, 94, 0.12)',
  statusSuccess2Hovered: '#093A16',
  statusWarning: '#FFBF17',
  statusWarningHovered: '#FFDD0D',
  statusWarning2: 'rgba(255, 191, 23, 0.08)',
  statusWarning2Hovered: 'rgba(255, 191, 23, 0.16)',
  statusCritical: '#FF593C',
  statusCriticalHovered: '#FF401F',
  statusCritical2: 'rgba(255, 89, 60, 0.12)',
  statusCritical2Hovered: 'rgba(255, 89, 60, 0.2)',
}

// ---------------------------------------------------------------------------
// 2. Theme — maps Spore tokens + Tamagui built-in keys
// ---------------------------------------------------------------------------

const { none: _darkTransparent, ...tamaguiColorsDark } = sporeDark

const darkTheme = {
  ...tamaguiColorsDark,
  transparent: sporeDark.none,

  // Tamagui built-in theme keys
  background: sporeDark.surface1,
  backgroundHover: sporeDark.surface2,
  backgroundPress: sporeDark.surface2,
  backgroundFocus: sporeDark.surface2,
  borderColor: sporeDark.none,
  borderColorHover: sporeDark.none,
  borderColorFocus: sporeDark.none,
  outlineColor: sporeDark.none,
  color: sporeDark.neutral1,
  colorHover: sporeDark.accent1,
  colorPress: sporeDark.accent1,
  colorFocus: sporeDark.accent1,
  shadowColor: 'rgba(0,0,0,0.4)',
  shadowColorHover: 'rgba(0,0,0,0.5)',
}

// ---------------------------------------------------------------------------
// 3. Spacing — exact Uniswap values
// ---------------------------------------------------------------------------

const spacing = {
  none: 0,
  spacing1: 1,
  spacing2: 2,
  spacing4: 4,
  spacing6: 6,
  spacing8: 8,
  spacing12: 12,
  spacing16: 16,
  spacing18: 18,
  spacing20: 20,
  spacing24: 24,
  spacing28: 28,
  spacing32: 32,
  spacing36: 36,
  spacing40: 40,
  spacing48: 48,
  spacing60: 60,
  true: 8, // default
}

const padding = {
  padding6: 6,
  padding8: 8,
  padding12: 12,
  padding16: 16,
  padding20: 20,
  padding36: 36,
}

const gap = {
  gap4: 4,
  gap8: 8,
  gap12: 12,
  gap16: 16,
  gap20: 20,
  gap24: 24,
  gap32: 32,
  gap36: 36,
}

const space = { ...spacing, ...padding, ...gap }
const size = space

// ---------------------------------------------------------------------------
// 4. Border Radii — exact Uniswap values
// ---------------------------------------------------------------------------

const borderRadii = {
  none: 0,
  rounded4: 4,
  rounded6: 6,
  rounded8: 8,
  rounded12: 12,
  rounded16: 16,
  rounded20: 20,
  rounded24: 24,
  rounded32: 32,
  roundedFull: 999999,
  true: 0,
}

// ---------------------------------------------------------------------------
// 5. Font scale — matches Uniswap heading/body/button sizes (web: adjustedSize = n+1)
// ---------------------------------------------------------------------------

// On web Uniswap adds +1 to all base sizes (adjustedSize)
const BOOK_WEIGHT = '485' // Geist Sans medium maps to Basel Book 485 on web
const MEDIUM_WEIGHT = '535' // Geist Sans semibold maps to Basel Medium 535 on web

const geistSans =
  'var(--font-geist-sans), -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const geistMono =
  'var(--font-geist-mono), ui-monospace, SFMono-Regular, SF Mono, Menlo, Monaco, monospace'

// Font size definitions matching Uniswap's web values (adjustedSize = base + 1)
const fontSizes = {
  heading1: 53,
  heading2: 37,
  heading3: 25,
  subheading1: 19,
  subheading2: 17,
  body1: 19,
  body2: 17,
  body3: 15,
  body4: 13,
  buttonLabel1: 19,
  buttonLabel2: 17,
  buttonLabel3: 15,
  buttonLabel4: 13,
  monospace: 13,
  true: 17,
}

const headingFont = createFont({
  family: geistSans,
  size: {
    small: fontSizes.heading3,
    medium: fontSizes.heading2,
    true: fontSizes.heading2,
    large: fontSizes.heading1,
  },
  weight: {
    book: BOOK_WEIGHT,
    true: BOOK_WEIGHT,
    medium: MEDIUM_WEIGHT,
  },
  lineHeight: {
    small: 30,
    medium: 40,
    true: 40,
    large: 50.88,
  },
})

const subHeadingFont = createFont({
  family: geistSans,
  size: {
    small: fontSizes.subheading2,
    large: fontSizes.subheading1,
    true: fontSizes.subheading1,
  },
  weight: {
    book: BOOK_WEIGHT,
    true: BOOK_WEIGHT,
    medium: MEDIUM_WEIGHT,
  },
  lineHeight: {
    small: 20,
    large: 24,
    true: 24,
  },
})

const bodyFont = createFont({
  family: geistSans,
  size: {
    micro: fontSizes.body4,
    small: fontSizes.body3,
    medium: fontSizes.body2,
    true: fontSizes.body2,
    large: fontSizes.body1,
  },
  weight: {
    book: BOOK_WEIGHT,
    true: BOOK_WEIGHT,
    medium: MEDIUM_WEIGHT,
  },
  lineHeight: {
    micro: 16,
    small: 19.5,
    medium: 22.1,
    true: 22.1,
    large: 24.7,
  },
})

const buttonFont = createFont({
  family: geistSans,
  size: {
    micro: fontSizes.buttonLabel4,
    small: fontSizes.buttonLabel3,
    medium: fontSizes.buttonLabel2,
    large: fontSizes.buttonLabel1,
    true: fontSizes.buttonLabel2,
  },
  weight: {
    book: BOOK_WEIGHT,
    true: MEDIUM_WEIGHT,
    medium: MEDIUM_WEIGHT,
  },
  lineHeight: {
    micro: 14.95,
    small: 17.25,
    medium: 19.55,
    large: 21.85,
    true: 19.55,
  },
})

const monospaceFont = createFont({
  family: geistMono,
  size: {
    micro: fontSizes.body4,
    small: fontSizes.body3,
    medium: fontSizes.body2,
    large: fontSizes.body1,
    true: fontSizes.body4,
  },
  weight: {
    book: BOOK_WEIGHT,
    true: BOOK_WEIGHT,
    medium: MEDIUM_WEIGHT,
  },
  lineHeight: {
    micro: 16,
    small: 19.5,
    medium: 22.1,
    large: 24.7,
    true: 16,
  },
})

// ---------------------------------------------------------------------------
// 6. Tokens
// ---------------------------------------------------------------------------

const tokens = createTokens({
  color: colorTokens,
  space,
  size,
  font: fontSizes,
  radius: borderRadii,
  zIndex: {
    default: 0,
    sticky: 100,
    fixed: 200,
    overlay: 300,
    modal: 400,
    popover: 500,
    tooltip: 600,
    true: 0,
  },
})

// ---------------------------------------------------------------------------
// 7. Media / breakpoints — exact Uniswap values
// ---------------------------------------------------------------------------

const media = createMedia({
  xxxl: { maxWidth: 1536 },
  xxl: { maxWidth: 1280 },
  xl: { maxWidth: 1024 },
  lg: { maxWidth: 768 },
  md: { maxWidth: 640 },
  sm: { maxWidth: 450 },
  xs: { maxWidth: 380 },
  xxs: { maxWidth: 360 },
  short: { maxHeight: 736 },
})

// ---------------------------------------------------------------------------
// 8. Shorthands — same as Uniswap
// ---------------------------------------------------------------------------

const shorthands = {
  m: 'margin',
  mb: 'marginBottom',
  ml: 'marginLeft',
  mr: 'marginRight',
  mt: 'marginTop',
  mx: 'marginHorizontal',
  my: 'marginVertical',
  p: 'padding',
  pb: 'paddingBottom',
  pl: 'paddingLeft',
  pr: 'paddingRight',
  pt: 'paddingTop',
  px: 'paddingHorizontal',
  py: 'paddingVertical',
} as const

// ---------------------------------------------------------------------------
// 9. Create config
// ---------------------------------------------------------------------------

export const config = createTamagui({
  tokens,
  themes: {
    dark: darkTheme,
  },
  fonts: {
    heading: headingFont,
    subHeading: subHeadingFont,
    body: bodyFont,
    button: buttonFont,
    monospace: monospaceFont,
  },
  media,
  shorthands,
  settings: {
    disableSSR: true,
    autocompleteSpecificTokens: 'except-special',
  },
})

export default config

// Type augmentation so Tamagui knows about our custom config
type Conf = typeof config

declare module '@tamagui/core' {
  interface TamaguiCustomConfig extends Conf {
    // Intentionally extends Conf — required by Tamagui for type inference
    readonly __brand?: 'TamaguiCustomConfig'
  }
}
