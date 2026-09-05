import { useEffect, useRef, useState } from 'react'
import { Mail } from 'lucide-react'
import { GlowButton } from './GlowButton'
import { SectionReveal } from './SectionReveal'

/**
 * The one address, written once.
 *
 * It appears on the landing page, the League screen and the dashboard, and
 * three copies of a mailto is how one of them ends up pointing at an address
 * nobody reads any more.
 */
export const SUPPORT_EMAIL = 'support@playgml.com'

const HREF = `mailto:${SUPPORT_EMAIL}`

/** How long the button says it worked before going back to offering to. */
const COPIED_MS = 1600

/**
 * Puts the address on the clipboard, and says so for a moment afterwards.
 *
 * Copying rather than opening a mailto, because a mailto opens whatever the
 * machine thinks is a mail client -- which on a shared desktop is nothing, and
 * in a browser signed in to webmail it was never told about is the wrong thing.
 * An address on the clipboard works in all three.
 *
 * navigator.clipboard needs a secure context, so it is absent over plain http
 * on anything but localhost. `supported` says so, and each caller falls back to
 * a mailto rather than offering a button that cannot work.
 */
function useCopyAddress() {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number>()

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL)
      setCopied(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), COPIED_MS)
    } catch {
      // Denied, or no permission. The address is on the screen either way.
    }
  }

  return { copied, copy, supported: Boolean(navigator.clipboard) }
}

/**
 * A band, for the landing page, where the point is that as many stuck people
 * as possible actually write in.
 *
 * A line in the footer was one line of grey among two others, below the last
 * thing anyone reads. This is a row of its own, and the address is the button
 * in it.
 *
 * Wide and short rather than a stacked card: everything here is one sentence
 * and one action, and stacking them turned that into a half-screen block that
 * read like a second offer. Side by side on anything wider than a phone, which
 * is where the sentence and the button both fit on one line.
 *
 * No section of its own. All three screens that carry it place it inside one of
 * theirs -- JoinCta so it stands on the same particle field rather than under
 * the edge of it, and the two panel screens in their own margins. `className`
 * is where the caller says so.
 *
 * `#00FF87` and not the panel's `#3EE68A`: the marketing page has its own,
 * brighter green, and one screen wearing two of them is a screen with none.
 */
export function SupportBand({ className = '' }: { className?: string }) {
  const { copied, copy, supported } = useCopyAddress()

  return (
    <SectionReveal className={`mx-auto max-w-4xl ${className}`}>
      <div className="glass glass-lip relative flex flex-col items-center gap-4 overflow-hidden rounded-2xl px-5 py-4 text-center sm:flex-row sm:justify-between sm:gap-8 sm:px-6 sm:py-5 sm:text-left">
        <div className="min-w-0">
          <h2
            id="support-heading"
            className="text-[clamp(0.97rem,1.7vw,1.15rem)] font-bold leading-tight"
          >
            Stuck anywhere? <span className="text-[#00FF87]">Write to us.</span>
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-[#E4EAE7]/85">
            In case of any query, please contact us. A real person answers.
          </p>
        </div>

        {/* One button, and pressing it copies rather than opening a mailto.
            A second Copy control beside it was asking the reader to choose
            between two ways of doing the same thing, and the mailto is the
            half that fails -- on a shared desktop it opens nothing, and in a
            browser signed in to webmail it was never told about it opens the
            wrong thing. An address on the clipboard works in all three.
            GlowButton's own `done` state is the confirmation: the glyph turns
            into a tick and the label says so.
            Without a clipboard -- plain http anywhere but localhost -- it goes
            back to being a mailto, which is better than a button that cannot
            do the one thing it offers. */}
        <div className="flex w-full shrink-0 sm:w-auto">
          {supported ? (
            <GlowButton
              type="button"
              magnetic={false}
              onClick={copy}
              state={copied ? 'done' : 'idle'}
              doneLabel="Copied"
              icon={<Mail className="size-4" />}
              aria-label={`Copy ${SUPPORT_EMAIL}`}
              className="w-full !px-6 !py-3 !text-[14px] sm:w-auto"
            >
              <span className="whitespace-nowrap">{SUPPORT_EMAIL}</span>
            </GlowButton>
          ) : (
            <GlowButton
              href={HREF}
              magnetic={false}
              icon={<Mail className="size-4" />}
              className="w-full !px-6 !py-3 !text-[14px] sm:w-auto"
            >
              <span className="whitespace-nowrap">{SUPPORT_EMAIL}</span>
            </GlowButton>
          )}
        </div>
      </div>
    </SectionReveal>
  )
}
