/**
 * CASH token header — logo, name, symbol, and live price.
 */

import { Flex, Text } from 'ui/src'

interface CashHeaderProps {
  price: number | null
  loading: boolean
}

export function CashHeader({ price, loading }: CashHeaderProps) {
  const formattedPrice = price !== null ? `$${price.toFixed(4)}` : '—'

  return (
    <Flex row alignItems="center" justifyContent="space-between" width="100%">
      <Flex row alignItems="center" gap="$gap12">
        {/* Token logo */}
        <Flex
          width={56}
          height={56}
          borderRadius="$roundedFull"
          backgroundColor="$surface2"
          alignItems="center"
          justifyContent="center"
        >
          <Text fontSize={24} fontWeight="$medium">
            💵
          </Text>
        </Flex>

        <Flex gap="$gap4">
          <Flex row alignItems="flex-end" gap="$gap8">
            <Text tag="h1" variant="heading3">
              CASH
            </Text>
            <Text variant="subheading1" color="$neutral2" textTransform="uppercase">
              CASH
            </Text>
          </Flex>
          <Text variant="heading2" data-testid="cash-price">
            {loading ? '—' : formattedPrice}
          </Text>
        </Flex>
      </Flex>
    </Flex>
  )
}
