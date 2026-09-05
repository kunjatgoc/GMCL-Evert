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
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
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

          {/* The second way in, beside the first, because the people who will
              not write an email will send a message.

              No `icon` prop: GlowButton's glyph ride ends in a same-tab
              location.assign, which would take the reader off the page. The
              glyph goes in the label instead, and the anchor keeps its
              target. */}
          <GlowButton
            href={WHATSAPP_HREF}
            variant="ghost"
            magnetic={false}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full !px-6 !py-3 !text-[14px] sm:w-auto"
          >
            <WhatsAppIcon className="size-4 text-[#25D366]" />
            <span className="whitespace-nowrap">WhatsApp</span>
          </GlowButton>
        </div>
      </div>
    </SectionReveal>
  )
}

/**
 * The one number, written once, for the same reason as the address above.
 *
 * Digits only in the link -- wa.me rejects spaces, plus signs and dashes -- and
 * the spaced form is what the reader sees.
 */
export const SUPPORT_WHATSAPP = '+91 93802 18855'

const WHATSAPP_DIGITS = SUPPORT_WHATSAPP.replace(/\D/g, '')

/** Prefilled so the first message says which site it came from. */
const WHATSAPP_TEXT = encodeURIComponent(
  'Hi, I need help with Global Market League.'
)

export const WHATSAPP_HREF = `https://wa.me/${WHATSAPP_DIGITS}?text=${WHATSAPP_TEXT}`

/**
 * WhatsApp's glyph, inline.
 *
 * lucide dropped its brand icons, and one path is cheaper than a second icon
 * package for the only brand mark on the site.
 */
export function WhatsAppIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0 0 20.464 3.488" />
    </svg>
  )
}

/**
 * The floating WhatsApp button, bottom right, on every entrant-facing screen.
 *
 * Bottom right because that is where every reader already looks for a chat
 * button, and nothing else on any screen here occupies the corner.
 *
 * A link and not a button, so it middle-clicks, opens in a new tab and reads as
 * a link. `target="_blank"` because wa.me hands off to the app or to WhatsApp
 * Web, and neither should cost the reader the page they were on.
 *
 * The label is hidden on a phone, where the circle is the whole control and the
 * screen is narrow; from `sm` up it slides open on hover and focus. Reversed
 * row order, so the circle stays pinned to the corner and the label grows
 * inward rather than pushing the glyph off the edge.
 *
 * Brand green (#25D366) rather than the site's, because a WhatsApp button that
 * is not WhatsApp-coloured is a button nobody recognises at a glance.
 */
export function WhatsAppFab() {
  return (
    <a
      href={WHATSAPP_HREF}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Chat with us on WhatsApp at ${SUPPORT_WHATSAPP}`}
      className="group fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-50 inline-flex flex-row-reverse items-center gap-0 rounded-full bg-[#25D366] text-white shadow-[0_10px_30px_-6px_rgba(37,211,102,0.55)] outline-none transition-[transform,box-shadow,gap] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.04] hover:shadow-[0_14px_38px_-6px_rgba(37,211,102,0.7)] focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] active:scale-[0.97] motion-reduce:transition-none motion-reduce:hover:scale-100 sm:group-hover:gap-2"
    >
      <span className="grid size-14 shrink-0 place-items-center">
        <WhatsAppIcon className="size-7" />
      </span>

      {/* Collapsed to nothing until hover or keyboard focus, so the resting
          state is one circle and never a bar across the corner. A grid whose
          column goes 0fr to 1fr animates a width the text decides for itself;
          a fixed max-width would be a number to keep in step with the label. */}
      <span className="hidden grid-cols-[0fr] overflow-hidden transition-[grid-template-columns] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:grid-cols-[1fr] group-focus-visible:grid-cols-[1fr] motion-reduce:transition-none sm:grid">
        <span className="min-w-0 overflow-hidden whitespace-nowrap text-[13px] font-semibold tracking-tight">
          <span className="block pl-4">{SUPPORT_WHATSAPP}</span>
        </span>
      </span>
    </a>
  )
}
