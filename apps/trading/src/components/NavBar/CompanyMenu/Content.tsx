import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ElementName } from 'uniswap/src/features/telemetry/constants'

export interface MenuItem {
  label: string
  href: string
  internal?: boolean
  overflow?: boolean
  closeMenu?: () => void
  icon?: React.ReactNode
  body?: string
  elementName: ElementName
}

export interface MenuSection {
  title: string
  items: MenuItem[]
  closeMenu?: () => void
}

export enum MenuSectionTitle {
  Products = 'Products',
  Protocol = 'Protocol',
  Company = 'Company',
  NeedHelp = 'NeedHelp',
}

export const useMenuContent = (args?: {
  keys?: MenuSectionTitle[]
}): Partial<{ [key in MenuSectionTitle]: MenuSection }> => {
  const { t } = useTranslation()
  const { keys } = args || {}

  return useMemo(() => {
    const menuContent = {
      [MenuSectionTitle.Products]: {
        title: t('common.products'),
        items: [
          {
            label: 'Trade',
            href: '/swap',
            internal: true,
            body: 'Swap tokens on the CASH orderbook',
            elementName: ElementName.NavbarCompanyMenuWallet,
          },
          {
            label: 'Explore',
            href: '/explore',
            internal: true,
            body: 'Explore tokens and pools',
            elementName: ElementName.NavbarCompanyMenuTradingApi,
          },
        ],
      },
      [MenuSectionTitle.NeedHelp]: {
        title: t('common.needHelp'),
        items: [
          {
            label: t('common.helpCenter'),
            href: '#',
            elementName: ElementName.NavbarCompanyMenuHelpCenter,
          },
        ],
      },
    }

    if (keys) {
      const filteredEntries = Object.entries(menuContent).filter(([key]) => keys.includes(key as MenuSectionTitle))
      return Object.fromEntries(filteredEntries) as Partial<{ [key in MenuSectionTitle]: MenuSection }>
    }

    return menuContent
  }, [t, keys])
}
