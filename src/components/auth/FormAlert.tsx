import type { ReactNode } from 'react'
import { AlertCircle, MailCheck } from 'lucide-react'

/**
 * The two messages a form can carry: something went well (a code was sent)
 * and something did not. Same box, different colour, so the eye learns one
 * place to look.
 */
export function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-[rgba(0,255,135,0.3)] bg-[rgba(0,255,135,0.08)] px-4 py-3 text-[14px] text-[#9dffcf]">
      <MailCheck className="mt-0.5 size-4 shrink-0" />
      {children}
    </p>
  )
}

export function ErrorAlert({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-[#ff6b6b]/30 bg-[#ff6b6b]/10 px-4 py-3 text-[14px] text-[#ff9a9a]"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      {children}
    </p>
  )
}
