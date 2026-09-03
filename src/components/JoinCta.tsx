import { ArrowRight, ShieldCheck } from 'lucide-react'
import { GlowButton } from './ui/GlowButton'
import { Eyebrow } from './ui/Eyebrow'
import { SectionReveal } from './ui/SectionReveal'

/**
 * What used to be the registration form. Entry now runs through an account:
 * sign up, sign in, and ask for a MetaID from the dashboard -- so this section
 * is two doors rather than four fields.
 *
 * It keeps the form's id, shell, backdrop and card, because the hero CTA and
 * the nav both aim at #register and because the page should not notice that
 * the thing at the end of it changed shape.
 */
export function JoinCta() {
  return (
    <section
      id="register"
      className="relative scroll-mt-8 overflow-hidden px-6 pb-28 pt-20 sm:pb-36 sm:pt-24"
      aria-labelledby="register-heading"
    >
      {/* `screen` drops the black the generator baked behind the points. The
          mask is INVERTED -- clear through the middle -- so the field
          surrounds the card instead of settling on top of it. */}
      <img
        src="/img/particles.webp"
        alt=""
        aria-hidden
        loading="lazy"
        className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover opacity-30 mix-blend-screen [mask-image:radial-gradient(58%_54%_at_50%_50%,transparent_0%,transparent_42%,#000_88%)]"
        onError={(e) => (e.currentTarget.style.display = 'none')}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[38rem] [background:radial-gradient(70%_60%_at_50%_100%,rgba(0,255,135,0.14),transparent_70%)]"
      />

      {/* Centred. Not `.shell` -- its max-width is declared after Tailwind's
          and would override the measure and stretch the card full-bleed. */}
      <div className="mx-auto max-w-2xl">
        <header className="text-center">
          <Eyebrow>Entries close 6 September</Eyebrow>
          <h2
            id="register-heading"
            className="mt-6 text-[clamp(2.1rem,5.2vw,3.4rem)] font-bold leading-[1.05]"
          >
            Join the League <span className="text-[#00FF87]">Now</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[1.05rem] leading-relaxed text-[#E4EAE7]">
            Create an account to join the league. After logging in, you can
            request a Demo MetaID or a Real MetaID from your dashboard.
          </p>
        </header>

        <SectionReveal className="mt-12">
          <div className="glass glass-lip relative overflow-hidden rounded-3xl p-8 sm:p-11">
            {/* One button. Two of equal weight made the visitor choose before
                they had anything to choose between; signing in is a link for
                the few who already have an account. */}
            <div className="flex justify-center">
              <GlowButton
                href="/signup"
                magnetic={false}
                icon={
                  <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                }
                className="w-full sm:w-auto"
              >
                Sign up
              </GlowButton>
            </div>

            <p className="mt-6 text-center text-[15px] leading-relaxed text-white/85">
              Already have an account?{' '}
              <a
                href="/login"
                className="font-medium text-[#00FF87] underline-offset-4 hover:underline"
              >
                Sign in
              </a>
            </p>

            {/* items-start, because on a phone this wraps to three lines and a
                vertically centred icon then floats beside the middle of them. */}
            <p className="mt-5 flex items-start justify-center gap-2 text-center text-[14.5px] text-[#E4EAE7]">
              <ShieldCheck className="mt-[3px] size-4 shrink-0 text-[#00FF87]" />
              Free to enter. No deposit, no payment details, no risk to your own
              funds.
            </p>
          </div>
        </SectionReveal>
      </div>
    </section>
  )
}
