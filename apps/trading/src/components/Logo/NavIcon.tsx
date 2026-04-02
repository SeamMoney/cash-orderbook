import { SVGProps } from 'react'
import { Flex, styled, useSporeColors } from 'ui/src'

function CashLogo({ color, onClick }: { color: string; onClick?: () => void }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      onClick={onClick}
      cursor="pointer"
    >
      {/* Dollar sign icon */}
      <path
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-1.5c-1.5-.27-2.82-1.13-3.28-2.59l1.63-.65c.36 1.13 1.38 1.64 2.65 1.64 1.33 0 2.14-.55 2.14-1.46 0-.82-.58-1.27-2.14-1.72-1.88-.54-3.35-1.19-3.35-3.04 0-1.63 1.28-2.72 3.35-3.02V6h2v1.65c1.31.29 2.22 1.1 2.58 2.35l-1.63.65c-.28-.89-1.02-1.5-2.14-1.5-1.22 0-1.93.58-1.93 1.37 0 .74.59 1.13 2.14 1.58 2.08.58 3.35 1.29 3.35 3.18 0 1.73-1.34 2.82-3.37 3.12V17z"
        fill={color}
      />
    </svg>
  )
}

const Container = styled(Flex, {
  position: 'relative',
  justifyContent: 'center',
  alignItems: 'center',
  cursor: 'auto',
  variants: {
    clickable: {
      true: { cursor: 'pointer' },
    },
  },
})

type NavIconProps = SVGProps<SVGSVGElement> & {
  clickable?: boolean
  onClick?: () => void
}

export const NavIcon = ({ clickable, onClick }: NavIconProps) => {
  const colors = useSporeColors()

  return (
    <Container clickable={clickable}>
      <CashLogo color={colors.accent1.val} onClick={onClick} />
    </Container>
  )
}
