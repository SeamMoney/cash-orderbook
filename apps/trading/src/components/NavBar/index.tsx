import { Flex, styled, Nav as TamaguiNav, useMedia } from 'ui/src'
import { breakpoints, INTERFACE_NAV_HEIGHT, zIndexes } from 'ui/src/theme'
import { useConnectionStatus } from 'uniswap/src/features/accounts/store/hooks'
import { useEnabledChains } from 'uniswap/src/features/chains/hooks/useEnabledChains'
import Row from '~/components/deprecated/Row'
import { CompanyMenu } from '~/components/NavBar/CompanyMenu'
import { PreferenceMenu } from '~/components/NavBar/PreferencesMenu'
import { useTabsVisible } from '~/components/NavBar/ScreenSizes'
import { SearchBar } from '~/components/NavBar/SearchBar'
import { useIsSearchBarVisible } from '~/components/NavBar/SearchBar/useIsSearchBarVisible'
import { Tabs } from '~/components/NavBar/Tabs/Tabs'
import TestnetModeTooltip from '~/components/NavBar/TestnetMode/TestnetModeTooltip'
import Web3Status from '~/components/Web3Status'
import { css, deprecatedStyled } from '~/lib/deprecated-styled'

// Flex is position relative by default, we must unset the position on every Flex
// between the body and search component
const UnpositionedFlex = styled(Flex, {
  position: 'unset',
})
const Nav = styled(TamaguiNav, {
  position: 'unset',
  px: '$padding12',
  width: '100%',
  height: INTERFACE_NAV_HEIGHT,
  zIndex: zIndexes.sticky,
  justifyContent: 'center',
})
const NavItems = css`
  gap: 12px;
  @media screen and (max-width: ${breakpoints.md}px) {
    gap: 4px;
  }
`
const Left = deprecatedStyled(Row)`
  display: flex;
  align-items: center;
  wrap: nowrap;
  ${NavItems}
`
const Right = deprecatedStyled(Row)`
  justify-content: flex-end;
  ${NavItems}
`

export default function Navbar() {
  const media = useMedia()
  const areTabsVisible = useTabsVisible()
  const isSearchBarVisible = useIsSearchBarVisible()
  const { isConnected } = useConnectionStatus()

  const { isTestnetModeEnabled } = useEnabledChains()

  return (
    <Nav>
      <UnpositionedFlex row centered width="100%">
        <Left>
          <CompanyMenu />
          {areTabsVisible && <Tabs />}
        </Left>

        {isSearchBarVisible && <SearchBar />}

        <Right>
          {!isSearchBarVisible && <SearchBar />}
          {!isConnected && <PreferenceMenu />}
          {isTestnetModeEnabled && <TestnetModeTooltip />}
          <Web3Status />
        </Right>
      </UnpositionedFlex>
    </Nav>
  )
}
