import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { riseIn, viewportOnce } from '../../lib/motion'

type Props = {
  children: ReactNode
  className?: string
  delay?: number
  as?: 'div' | 'section' | 'li' | 'header'
}

export function SectionReveal({ children, className = '', delay = 0 }: Props) {
  return (
    <motion.div
      className={className}
      variants={riseIn}
      custom={delay}
      initial="hidden"
      whileInView="show"
      viewport={viewportOnce}
    >
      {children}
    </motion.div>
  )
}
