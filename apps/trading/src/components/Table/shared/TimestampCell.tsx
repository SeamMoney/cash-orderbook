import { Anchor, Flex, styled, Text } from 'ui/src'
import { useCurrentLocale } from 'uniswap/src/features/language/hooks'
import { MouseoverTooltip, TooltipSize } from '~/components/Tooltip'
import { ClickableTamaguiStyle } from '~/theme/components/styles'

const StyledExternalLink = styled(Anchor, {
  textDecorationLine: 'none',
  ...ClickableTamaguiStyle,
  color: '$neutral1',
  target: '_blank',
  rel: 'noopener noreferrer',
})

const StyledTimestampRow = styled(StyledExternalLink, {
  group: true,
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  gap: '$gap8',
  width: '100%',
  whiteSpace: 'nowrap',
  hoverStyle: {
    opacity: 1,
  },
})

/**
 * Renders the timestamp on two lines: "Mon D" and "HH:MM" (e.g. "Apr 30" /
 * "8:32 PM"). Hover shows the full date with year. Click opens the explorer.
 * @param timestamp: unix timestamp in SECONDS
 */
export const TimestampCell = ({ timestamp, link }: { timestamp: number; link: string }) => {
  const locale = useCurrentLocale()
  const date = new Date(timestamp * 1000)

  const day = date.toLocaleString(locale, { month: 'short', day: 'numeric' })
  const time = date.toLocaleString(locale, { hour: 'numeric', minute: '2-digit' })

  const fullDate = date.toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  return (
    <StyledTimestampRow href={link}>
      <MouseoverTooltip text={fullDate} placement="top" size={TooltipSize.Max}>
        <Flex>
          <Text variant="body3" color="$neutral1">
            {day}
          </Text>
          <Text variant="body4" color="$neutral2">
            {time}
          </Text>
        </Flex>
      </MouseoverTooltip>
    </StyledTimestampRow>
  )
}
