import { motion } from 'motion/react'
import { EASE } from '../lib/motion'

/**
 * The Leaderboard announcement. Two lines, and nothing else.
 *
 * There is no leaderboard yet, and no explanation of one either -- the plate
 * is an unlit board waiting to be filled, which says it. The dates, the prize
 * table and the entry form live on the League screen; repeating any of them
 * here would make two screens argue the same case.
 *
 * The copy sits in the light the board is throwing rather than in the black
 * underneath it: stacked as two blocks, a wide screen put two hundred empty
 * pixels between the picture and the sentence, and the two read as unrelated
 * things that happened to share a page.
 *
 * Nothing here is a still photograph. The lamps breathe, a scan crosses the
 * empty cells, and the two lines arrive one after the other -- a screen whose
 * whole claim is "about to" cannot be motionless, or the claim is the only
 * thing on it that nobody believes.
 *
 * Two separate mechanisms answer a reduced-motion preference, and it is worth
 * knowing which does what: the stylesheet's global rule (index.css) clamps the
 * two CSS animations below, and MotionConfig in PanelShell collapses the
 * transforms on the two spans. Neither covers the other, and the second one is
 * not in this file -- so a screen built by copying this one to somewhere
 * outside the panel keeps the CSS half and quietly loses the rest.
 *
 * Like every plate in this panel it is optional and hides itself if absent;
 * the washes below it are what the screen reads as without it.
 */
export function LeaderboardScreen() {
  return (
    <div className="relative isolate -m-5 flex min-h-[30rem] flex-col justify-center overflow-hidden bg-[#0A100E] px-6 py-16 sm:-m-6 md:min-h-dvh xl:-m-8 xl:px-16">
      {/*
       * The plate and everything positioned against it share one 2:1 stage.
       *
       * The two overlays are placed in percentages of the picture -- the lamp
       * row is at 20% of the plate, not at 20% of the browser window. Those
       * were the same number only while the panel happened to be 2:1 too,
       * which it is at 1920x825 and is not on an ultrawide: at 3440 the slot
       * is 2.22:1, object-cover crops 78px off the top, and a glow pinned to
       * the frame drifts about 48px clear of the lamps it is meant to be
       * coming from.
       *
       * `aspect-[2/1] min-h-full min-w-full`, centred, is exactly what
       * object-cover does to the geometry -- the smallest box of that ratio
       * that still covers the frame -- so a percentage inside this stage lands
       * on the same part of the picture at every viewport.
       */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 aspect-[2/1] min-h-full min-w-full -translate-x-1/2 -translate-y-1/2"
      >
        <img
          src="/img/leaderboard-board.webp"
          alt=""
          loading="eager"
          className="absolute inset-0 size-full object-cover"
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />

        {/* A scan crossing the dead cells, on the slowest cycle here so it is
            noticed second rather than first. Two identical lanes in a strip
            twice the stage's width: shifting the pair by exactly half puts
            lane two where lane one began, so `marquee` loops without a seam.
            The mask is not decoration -- without it the strip's own box draws
            two hard horizontal edges across the wall, which is exactly the
            fault the panel's backdrop plate was replaced for. */}
        <div className="absolute inset-x-0 top-[7%] h-[21%] overflow-hidden [mask-image:radial-gradient(62%_130%_at_50%_50%,#000_45%,transparent_82%)]">
          <div className="h-full w-[200%] [animation:marquee_14s_linear_infinite] [background:repeating-linear-gradient(90deg,transparent_0%,transparent_12%,rgba(62,230,138,0.09)_18%,rgba(125,247,184,0.22)_25%,rgba(62,230,138,0.09)_32%,transparent_38%,transparent_50%)]" />
        </div>

        {/* The lamp row, breathing. Same keyframe the panel's own horizon uses,
            on a shorter cycle: this one is a fixture about to come on, not a
            city at rest. */}
        <div className="absolute inset-x-0 top-[20%] h-[26%] [animation:horizon-glow_6.5s_ease-in-out_infinite] [background:radial-gradient(64%_100%_at_50%_0%,rgba(62,230,138,0.2),transparent_72%)]" />
      </div>

      {/* A pool of near-black under the copy, sized to it rather than to the
          frame. The lamps stay bright above it and the floor stays lit below,
          so the headline sits in shadow inside a room that is still lit --
          which is what makes it read as one picture rather than as type on a
          photograph. This wash and the two below it are pinned to the frame
          rather than to the stage, because they follow the copy, and the copy
          is laid out in the frame. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(58%_42%_at_50%_54%,rgba(10,16,14,0.94)_0%,rgba(10,16,14,0.72)_45%,transparent_100%)]"
      />

      {/* Every edge falls to the panel's own ground, so the plate never ends
          on a visible rectangle. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(90deg,#0A100E_0%,transparent_16%,transparent_84%,#0A100E_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(10,16,14,0.5)_0%,transparent_18%,transparent_76%,rgba(10,16,14,0.45)_93%,#0A100E_100%)]"
      />

      {/* The panel's own film, so the plate sits in the same room as every
          other screen instead of looking like a photograph pasted over one. */}
      <div aria-hidden className="grain pointer-events-none absolute inset-0 -z-10" />

      {/* One heading in two sentences, not a heading and a paragraph -- but
          arriving as two beats, because the second is the one being asked. */}
      <h1 className="relative mx-auto max-w-2xl text-center font-[family-name:var(--font-display)] text-[clamp(1.75rem,3.6vw,2.67rem)] font-bold leading-[1.12] tracking-[-0.03em] text-white">
        <motion.span
          className="block [text-shadow:0_2px_24px_rgba(6,12,10,0.9)]"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          The board is about to light up.
        </motion.span>

        {/* The halo is written out here rather than taken from the `.text-glow`
            utility: that one is hard-coded to the marketing page's #00FF87,
            and a neon halo around #3EE68A type is precisely the two-greens-at-
            once that rules 4 and 5 in panel/palette.ts exist to prevent. */}
        <motion.span
          className="mt-2 block text-[var(--admin-primary)] [text-shadow:0_0_28px_rgba(62,230,138,0.45)]"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.34 }}
        >
          Are you ready?
        </motion.span>
      </h1>
    </div>
  )
}
