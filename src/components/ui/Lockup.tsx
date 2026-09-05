/**
 * The GML mark and the name, at one size wherever they appear.
 *
 * It used to be written out three times -- a 48px mark on the auth screens, a
 * 36px one on the landing nav with the name at 15px, and a grey square on the
 * panel rail -- so the brand changed size and weight as you moved through the
 * product. One component now; only the accent differs, because the panel runs
 * the design system's Signal Green and the marketing surface runs the neon,
 * which palette.ts explains and this does not overrule.
 */
export function Lockup({
  tone = 'neon',
  subtitle,
  compact = false,
}: {
  /** `panel` is Signal Green, for anything on the admin palette. */
  tone?: 'neon' | 'panel'
  /** The line under the name. Only the signed-in rail uses one. */
  subtitle?: string
  /** Drops the wordmark on a narrow screen, for the one bar that also has to
   *  fit two buttons and a marquee. The mark itself never changes size --
   *  that is the part being kept consistent. */
  compact?: boolean
}) {
  const accent =
    tone === 'panel'
      ? 'border-[rgba(62,230,138,0.45)] bg-[rgba(62,230,138,0.1)] text-[#3EE68A] shadow-[0_0_36px_-10px_rgba(62,230,138,0.8),inset_0_1px_0_0_rgba(255,255,255,0.1)]'
      : 'border-[rgba(0,255,135,0.45)] bg-[rgba(0,255,135,0.1)] text-[#00FF87] shadow-[0_0_44px_-8px_rgba(0,255,135,0.9),inset_0_1px_0_0_rgba(255,255,255,0.12)]'

  return (
    <span className="inline-flex items-center gap-3">
      <span
        aria-hidden
        className={`grid size-12 shrink-0 place-items-center rounded-2xl border text-[14px] font-extrabold tracking-tight ${accent}`}
      >
        GML
      </span>
      <span className="min-w-0 text-left leading-none">
        {/* Two lines on the rail, one everywhere else. The rail is 248px and
            the name needs about 200 of them after the mark and the gap, so
            `truncate` there does not shorten the brand -- it cuts it, and
            "Global Market Leag" is worse than a second line. */}
        <span
          className={`${compact ? 'hidden sm:block' : 'block'} font-[family-name:var(--font-display)] font-bold tracking-tight text-white ${
            tone === 'panel'
              ? 'text-[14.5px] leading-[1.15]'
              : 'truncate text-[17.5px]'
          }`}
        >
          Global Market League
        </span>
        {subtitle && (
          <span className="mt-1.5 block truncate text-[13px] uppercase tracking-[0.14em] text-[var(--admin-muted)]">
            {subtitle}
          </span>
        )}
      </span>
    </span>
  )
}
