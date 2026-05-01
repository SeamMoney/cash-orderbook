import { Flex, type FlexProps, styled } from 'ui/src'
import { validColor } from 'ui/src/theme'
import { ItemData, ItemPoint } from 'uniswap/src/components/IconCloud/IconCloud'
import { randomChoice } from 'uniswap/src/components/IconCloud/utils'

function TokenIconPositioner({
  size,
  delay: _delay,
  ...rest
}: FlexProps & {
  size: number
  delay: number
}): JSX.Element | null {
  // Render immediately. The original implementation staggered orbs by `delay`
  // seconds based on distance-from-center, which made hover unreliable for ~1s
  // after page load (orbs were still animating in when the user reached for them).
  return <Flex pointerEvents="auto" width={size} height={size} {...rest} />
}

const FloatContainer = styled(Flex, {
  '$platform-web': {
    position: 'absolute',
    transformOrigin: 'center center',
    animationName: 'cloud-float-animation',
    animationIterationCount: 'infinite',
    animationTimingFunction: 'linear',
  },

  variants: {
    duration: {
      ':number': (val = 0) => ({
        '$platform-web': {
          animationDuration: `${1000 * val}ms`,
        },
      }),
    },
    paused: {
      true: {
        '$platform-web': {
          animationPlayState: 'paused',
        },
      },
    },
  } as const,
})

const RotateContainer = styled(Flex, {
  '$platform-web': {
    position: 'absolute',
    transformOrigin: 'center center',
    animationFillMode: 'forwards',
    animationName: 'token-rotate-animation',
    animationIterationCount: 'infinite',
    animationTimingFunction: 'ease-in-out',
    animationDirection: 'alternate-reverse',
  },

  variants: {
    duration: {
      ':number': (val = 0) => ({
        '$platform-web': {
          animationDuration: `${1000 * val}ms`,
        },
      }),
    },
    paused: {
      true: {
        '$platform-web': {
          animationPlayState: 'paused',
        },
      },
    },
  } as const,
})

const TokenIconRing = styled(Flex, {
  borderWidth: 1,
  borderColor: '$color',
  transformOrigin: 'center center',
  position: 'absolute',

  variants: {
    size: {
      ':number': (val) => ({
        width: val,
        height: val,
      }),
    },

    rounded: {
      true: {
        '$platform-web': {
          borderRadius: '50%',
        },
      },
    },
  } as const,
})

const ItemContainer = styled(Flex, {
  backgroundSize: 'cover',
  backgroundPosition: 'center center',
  transition: 'filter 0.15s ease-in-out',
  transformOrigin: 'center center',

  variants: {
    logoUrl: {
      ':string': (val) => ({
        backgroundImage: `url(${val})`,
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
      }),
    },

    blur: {
      ':number': (val) => ({
        filter: `blur(${val}px)`,
      }),
    },

    size: {
      ':number': (val) => ({
        width: val,
        height: val,
      }),
    },

    rounded: {
      true: {
        '$platform-web': {
          borderRadius: '50%',
        },
      },
    },
  } as const,
})

export function CloudItem<T extends ItemData>({
  point,
  renderOuterElement,
  getElementRounded,
  onPress,
  isPaused = false,
}: {
  point: ItemPoint<T>
  renderOuterElement?: (point: ItemPoint<T>) => JSX.Element
  getElementRounded?: (point: ItemPoint<T>) => boolean
  onPress?: (point: ItemPoint<T>) => void
  isPaused?: boolean
}): JSX.Element {
  const { x, y, blur, size, rotation, opacity, delay, floatDuration, color } = point

  const borderRadius = size / 8
  const duration = 200 / (22 - rotation)

  return (
    <Flex position="absolute" group="item" top={y} left={x} width={size} height={size} transformOrigin="center center">
      <Flex>
        <TokenIconPositioner
          delay={delay}
          opacity={1}
          scale={1}
          size={size}
        >
          <FloatContainer duration={floatDuration} paused={isPaused}>
            {renderOuterElement && renderOuterElement(point)}
            <RotateContainer duration={duration} paused={isPaused}>
              <ItemContainer
                size={size}
                animation="fast"
                blur={blur}
                backgroundColor={validColor(color)}
                rounded={getElementRounded?.(point)}
                logoUrl={point.itemData.logoUrl}
                opacity={opacity}
                borderRadius={borderRadius}
                $group-item-hover={{
                  opacity: 1,
                  scale: 1.2,
                  rotate: `${randomChoice([0 - rotation, 0 - rotation])}deg`,
                  filter: 'blur(0)',
                  cursor: onPress ? 'pointer' : undefined,
                }}
                onPress={onPress ? (): void => onPress(point) : undefined}
              >
                {getElementRounded && (
                  <>
                    <TokenIconRing
                      opacity={0}
                      animation="bouncy"
                      $group-item-hover={{
                        opacity: 0.3,
                        scale: 1.2,
                      }}
                      size={size}
                      rounded={getElementRounded(point)}
                      borderColor={validColor(color)}
                      borderRadius={borderRadius * 1.3}
                    />
                    <TokenIconRing
                      opacity={0}
                      animation="bouncy"
                      $group-item-hover={{
                        opacity: 0.1,
                        scale: 1.4,
                      }}
                      size={size}
                      rounded={getElementRounded(point)}
                      borderColor={validColor(color)}
                      borderRadius={borderRadius * 1.6}
                    />
                  </>
                )}
              </ItemContainer>
            </RotateContainer>
          </FloatContainer>
        </TokenIconPositioner>
      </Flex>
    </Flex>
  )
}
