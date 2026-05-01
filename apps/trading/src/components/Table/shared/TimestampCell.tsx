import { Anchor, styled } from 'ui/src'
import { useCurrentLocale } from 'uniswap/src/features/language/hooks'
import { TableText } from '~/components/Table/shared/TableText'
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
 * Renders the timestamp as "Mon D, HH:MM" (e.g. "Apr 30, 8:32 PM"). Hovering
 * shows the full date including year. Clicking opens the explorer link.
 * @param timestamp: unix timestamp in SECONDS
 */
export const TimestampCell = ({ timestamp, link }: { timestamp: number; link: string }) => {
  const locale = useCurrentLocale()
  const date = new Date(timestamp * 1000)

  const cellLabel = date.toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

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
        <TableText>{cellLabel}</TableText>
      </MouseoverTooltip>
    </StyledTimestampRow>
  )
}
