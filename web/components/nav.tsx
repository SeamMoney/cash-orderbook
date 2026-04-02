"use client";

import { useState, useCallback } from "react";
import { styled, Text, useMedia, useTheme } from "@tamagui/core";
import { AnimatePresence, motion } from "framer-motion";
import { Search, Menu, X } from "lucide-react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { ConnectButton } from "@/components/wallet/connect-button";
import { WalletSelector } from "@/components/wallet/wallet-selector";
import { Flex } from "@/components/ui/Flex";

export type NavTab = "trade" | "explore";

interface NavProps {
  activeTab?: NavTab;
  onTabChange?: (tab: NavTab) => void;
}

const NAV_TABS: { id: NavTab; label: string }[] = [
  { id: "trade", label: "Trade" },
  { id: "explore", label: "Explore" },
];

/* ─── Styled Tamagui Components ─────────────────────────────────────────────── */

/** Nav container: 72px height, full viewport width, surface1 bg, horizontal padding */
const NavContainer = styled(Flex, {
  tag: "header",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
  height: 72,
  paddingHorizontal: "$spacing12",
  backgroundColor: "$surface1",
});

/** Nav tab text with active/inactive color states */
const NavTabText = styled(Text, {
  fontFamily: "$body",
  fontSize: 15,
  lineHeight: 19.5,
  cursor: "pointer",
  paddingHorizontal: "$spacing8",
  paddingVertical: "$spacing6",
  color: "$neutral2",

  variants: {
    isActive: {
      true: {
        color: "$neutral1",
        fontWeight: "$medium",
      },
      false: {
        color: "$neutral2",
      },
    },
  } as const,

  defaultVariants: {
    isActive: false,
  },

  hoverStyle: {
    color: "$neutral1",
  },
});

/** Search bar: surface2 bg, 280px width, 40px height, pill shaped */
const SearchBarContainer = styled(Flex, {
  flexDirection: "row",
  alignItems: "center",
  gap: "$spacing8",
  backgroundColor: "$surface2",
  width: 280,
  height: 40,
  borderRadius: "$roundedFull",
  paddingHorizontal: "$spacing16",
  borderWidth: 1,
  borderColor: "transparent",
  cursor: "pointer",

  hoverStyle: {
    borderColor: "$surface3",
  },
});

/** Logo text: ~20px, white, medium weight */
const LogoText = styled(Text, {
  fontFamily: "$body",
  fontSize: 20,
  fontWeight: "$medium",
  color: "$neutral1",
  letterSpacing: -0.5,
});

/** Ghost text button for "Log In" */
const GhostButton = styled(Text, {
  tag: "button",
  fontFamily: "$body",
  fontSize: 15,
  fontWeight: "$medium",
  color: "$neutral2",
  cursor: "pointer",
  paddingHorizontal: "$spacing12",
  paddingVertical: "$spacing6",

  hoverStyle: {
    color: "$neutral1",
  },
});

/** Accent button container for "Sign Up" */
const AccentButton = styled(Flex, {
  tag: "button",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "$accent1",
  borderRadius: "$roundedFull",
  paddingHorizontal: "$spacing16",
  paddingVertical: "$spacing6",
  cursor: "pointer",

  hoverStyle: {
    backgroundColor: "$accent1Hovered",
  },
});

/** Hamburger toggle button */
const HamburgerButton = styled(Flex, {
  tag: "button",
  alignItems: "center",
  justifyContent: "center",
  width: 44,
  height: 44,
  borderRadius: "$rounded12",
  cursor: "pointer",
  backgroundColor: "transparent",

  hoverStyle: {
    backgroundColor: "$surface2",
  },
});

/* ─── Nav Component ─────────────────────────────────────────────────────────── */

/**
 * Nav — sticky top navigation bar using Tamagui primitives.
 * Logo "CASH" left, Trade/Explore tabs center, wallet actions right.
 * Matches Uniswap's NavBar: surface1 bg, 72px height, full width.
 *
 * Responsive behavior:
 * - xl breakpoint (≤1024px): hides tabs + search + wallet, shows hamburger
 * - At ≥1024px: shows full desktop nav with tabs, search bar, and wallet
 */
export function Nav({
  activeTab = "trade",
  onTabChange,
}: NavProps): React.ReactElement {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const { connected, account } = useWallet();
  const media = useMedia();
  const theme = useTheme();

  // xl = maxWidth 1024px — when true, collapse to hamburger menu
  const isCollapsed = media.xl;

  const handleTabChange = useCallback(
    (tab: NavTab): void => {
      onTabChange?.(tab);
      setMobileMenuOpen(false);
    },
    [onTabChange],
  );

  return (
    <>
      <NavContainer
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        {/* Left: Logo */}
        <Flex row alignItems="center" gap="$spacing12">
          <LogoText>CASH</LogoText>
        </Flex>

        {/* Center: Navigation Tabs — hidden below xl (≤1024px) */}
        {!isCollapsed && (
          <Flex row alignItems="center" gap="$spacing12">
            {NAV_TABS.map((tab) => (
              <NavTabText
                key={tab.id}
                isActive={activeTab === tab.id}
                onPress={() => onTabChange?.(tab.id)}
                // Smooth hover color transition (Tamagui doesn't natively support CSS transitions)
                style={{ transition: "color 125ms ease-in-out" }}
              >
                {tab.label}
              </NavTabText>
            ))}
          </Flex>
        )}

        {/* Right: Search + Wallet */}
        <Flex row alignItems="center" gap="$spacing12">
          {/* Search bar — hidden below xl (≤1024px) */}
          {!isCollapsed && (
            <SearchBarContainer>
              <Search size={14} color={theme.neutral3.val} />
              <Text
                fontFamily="$body"
                fontSize={15}
                color="$neutral3"
              >
                Search tokens
              </Text>
            </SearchBarContainer>
          )}

          {/* Wallet area — hidden below xl (≤1024px) */}
          {!isCollapsed && (
            <Flex row alignItems="center" gap="$spacing8">
              {connected && account ? (
                <ConnectButton />
              ) : (
                <Flex row alignItems="center" gap="$spacing8">
                  <GhostButton onPress={() => setSelectorOpen(true)}>
                    Log In
                  </GhostButton>
                  <AccentButton onPress={() => setSelectorOpen(true)}>
                    <Text
                      fontFamily="$button"
                      fontSize={15}
                      fontWeight="$medium"
                      color="$white"
                    >
                      Sign Up
                    </Text>
                  </AccentButton>
                </Flex>
              )}
            </Flex>
          )}

          {/* Hamburger — visible below xl (≤1024px) */}
          {isCollapsed && (
            <HamburgerButton
              onPress={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? (
                <X size={20} color={theme.neutral2.val} />
              ) : (
                <Menu size={20} color={theme.neutral2.val} />
              )}
            </HamburgerButton>
          )}
        </Flex>
      </NavContainer>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            style={{
              overflow: "hidden",
              position: "sticky",
              top: 72,
              zIndex: 49,
              borderTop: `1px solid ${theme.surface3.val}`,
              background: theme.surface1.val,
            }}
          >
            <Flex padding="$spacing16" gap="$spacing12">
              {/* Navigation tabs */}
              {NAV_TABS.map((tab) => (
                <Flex
                  key={tab.id}
                  row
                  alignItems="center"
                  borderRadius="$rounded12"
                  paddingHorizontal="$spacing16"
                  paddingVertical="$spacing12"
                  backgroundColor={
                    activeTab === tab.id ? "$surface2" : "transparent"
                  }
                  cursor="pointer"
                  hoverStyle={{ backgroundColor: "$surface2" }}
                  onPress={() => handleTabChange(tab.id)}
                >
                  <Text
                    fontFamily="$body"
                    fontSize={15}
                    fontWeight="$medium"
                    color={activeTab === tab.id ? "$neutral1" : "$neutral2"}
                  >
                    {tab.label}
                  </Text>
                </Flex>
              ))}

              {/* Divider */}
              <Flex height={1} backgroundColor="$surface3" width="100%" />

              {/* Wallet actions — mobile */}
              <Flex row alignItems="center">
                {connected && account ? (
                  <ConnectButton />
                ) : (
                  <Flex row alignItems="center" gap="$spacing8">
                    <GhostButton
                      onPress={() => {
                        setSelectorOpen(true);
                        setMobileMenuOpen(false);
                      }}
                    >
                      Log In
                    </GhostButton>
                    <AccentButton
                      onPress={() => {
                        setSelectorOpen(true);
                        setMobileMenuOpen(false);
                      }}
                    >
                      <Text
                        fontFamily="$button"
                        fontSize={15}
                        fontWeight="$medium"
                        color="$white"
                      >
                        Sign Up
                      </Text>
                    </AccentButton>
                  </Flex>
                )}
              </Flex>
            </Flex>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Wallet Selector Modal */}
      <WalletSelector
        isOpen={selectorOpen}
        onClose={() => setSelectorOpen(false)}
      />
    </>
  );
}

export default Nav;
