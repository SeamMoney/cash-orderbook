import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router'
import { useSporeColors } from 'ui/src'
import { CoinConvert } from 'ui/src/components/icons/CoinConvert'
import { ElementName } from 'uniswap/src/features/telemetry/constants'
import { Limit } from '~/components/Icons/Limit'
import { SwapV2 } from '~/components/Icons/SwapV2'
import { MenuItem } from '~/components/NavBar/CompanyMenu/Content'

export type TabsSection = {
  title: string
  href: string
  isActive?: boolean
  items?: TabsItem[]
  closeMenu?: () => void
  icon?: JSX.Element
  elementName: ElementName
}

export type TabsItem = MenuItem & {
  icon?: JSX.Element
}

export const useTabsContent = (): TabsSection[] => {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const colors = useSporeColors()

  return [
    {
      title: t('common.trade'),
      href: '/swap',
      isActive: pathname.startsWith('/swap') || pathname.startsWith('/limit') || pathname === '/cash',
      icon: <CoinConvert color="$accent1" size="$icon.20" />,
      elementName: ElementName.NavbarTradeTab,
      items: [
        {
          label: t('common.swap'),
          icon: <SwapV2 fill={colors.neutral2.val} />,
          href: '/swap',
          internal: true,
          elementName: ElementName.NavbarTradeDropdownSwap,
        },
        {
          label: t('swap.limit'),
          icon: <Limit fill={colors.neutral2.val} />,
          href: '/limit',
          internal: true,
          elementName: ElementName.NavbarTradeDropdownLimit,
        },
      ],
    },
  ]
}
