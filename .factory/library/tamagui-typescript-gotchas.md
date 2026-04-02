## Tamagui + TypeScript gotchas in `web/`

- In this repo's current Tamagui setup, sticky positioning has been implemented via a native wrapper element (`<div style={{ position: "sticky", top: 72 }}>`) rather than a Tamagui `Flex` style prop in `web/app/page.tsx`, to keep typecheck passing.
- For responsive behavior in complex components (e.g., navbar), prefer `useMedia()` booleans over inline JSX media props such as `$gtMd`/`$gtLg`, which have produced TypeScript friction in this codebase.
