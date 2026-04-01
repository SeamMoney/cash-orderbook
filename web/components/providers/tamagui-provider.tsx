'use client'

import { TamaguiProvider as TamaguiProviderOG } from '@tamagui/core'
import { config } from '@/tamagui.config'

export function TamaguiProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <TamaguiProviderOG config={config} defaultTheme="dark">
      {children}
    </TamaguiProviderOG>
  )
}
