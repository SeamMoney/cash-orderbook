/**
 * CASH chart section — renders candle data from our REST API
 * using the existing PriceChart component from Uniswap fork.
 */

import { UTCTimestamp } from 'lightweight-charts'
import { useMemo, useState } from 'react'
import { Flex, Text } from 'ui/src'
import { PriceChart, type PriceChartData } from '~/components/Charts/PriceChart'
import { PriceChartType } from '~/components/Charts/utils'
import { EXPLORE_CHART_HEIGHT_PX } from '~/components/Explore/constants'
import { useCashPriceHistory } from '~/data/hooks'

const TIME_PERIODS = ['1H', '1D', '1W', '1M', '1Y', 'ALL'] as const
type TimePeriodLabel = (typeof TIME_PERIODS)[number]

/** Map period labels to lightweight-charts HistoryDuration-like values for the PriceChart */
function periodToHistoryDuration(period: TimePeriodLabel): string {
  switch (period) {
    case '1H':
      return 'HOUR'
    case '1D':
      return 'DAY'
    case '1W':
      return 'WEEK'
    case '1M':
      return 'MONTH'
    case '1Y':
      return 'YEAR'
    case 'ALL':
      return 'MAX'
    default:
      return 'DAY'
  }
}

export function CashChartSection() {
  const [period, setPeriod] = useState<TimePeriodLabel>('1D')
  const { candles, loading } = useCashPriceHistory(period)

  /** Convert CASH candles to PriceChartData (lightweight-charts format) */
  const chartData: PriceChartData[] = useMemo(() => {
    if (!candles.length) return []
    return candles.map((c) => ({
      time: (c.timestamp / 1000) as UTCTimestamp,
      value: c.close,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }))
  }, [candles])

  /** Price change for the displayed period */
  const pricePercentChange = useMemo(() => {
    if (chartData.length < 2) return undefined
    const first = chartData[0].close
    const last = chartData[chartData.length - 1].close
    if (!first || first === 0) return undefined
    return ((last - first) / first) * 100
  }, [chartData])

  if (loading && chartData.length === 0) {
    return (
      <Flex height={EXPLORE_CHART_HEIGHT_PX} alignItems="center" justifyContent="center">
        <Text color="$neutral3">Loading chart…</Text>
      </Flex>
    )
  }

  if (!loading && chartData.length === 0) {
    return (
      <Flex height={EXPLORE_CHART_HEIGHT_PX} alignItems="center" justifyContent="center">
        <Text color="$neutral3">No chart data available</Text>
      </Flex>
    )
  }

  return (
    <Flex data-testid="cash-chart-container">
      <PriceChart
        data={chartData}
        height={EXPLORE_CHART_HEIGHT_PX}
        type={PriceChartType.LINE}
        stale={false}
        timePeriod={periodToHistoryDuration(period) as any}
        pricePercentChange={pricePercentChange}
        overrideColor="#00D54B"
      />

      {/* Time period controls */}
      <Flex row gap="$gap8" pt="$spacing12" flexWrap="wrap">
        {TIME_PERIODS.map((p) => (
          <Flex
            key={p}
            px="$spacing12"
            py="$spacing4"
            borderRadius="$roundedFull"
            backgroundColor={period === p ? '$surface3' : 'transparent'}
            cursor="pointer"
            hoverStyle={{ backgroundColor: '$surface2' }}
            onPress={() => setPeriod(p)}
          >
            <Text
              variant="buttonLabel3"
              color={period === p ? '$neutral1' : '$neutral2'}
              data-testid={`cash-chart-period-${p}`}
            >
              {p}
            </Text>
          </Flex>
        ))}
      </Flex>
    </Flex>
  )
}
