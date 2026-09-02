// Shared input skin. Two forms wear it now (registration, login), so it lives
// here rather than being copied into each one.
//
// No width on purpose. These inputs sit in both block and flex contexts, and a
// baked-in `w-full` makes two flex siblings each claim the full row,
// overflowing the card.
export const field =
  'rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-[16px] text-white ' +
  'placeholder:text-white/30 outline-none transition-all duration-300 ' +
  'focus:border-[rgba(0,255,135,0.55)] focus:bg-white/[0.05] ' +
  'focus:shadow-[0_0_0_4px_rgba(0,255,135,0.12)]'

export const label =
  'mb-2 block text-[12px] font-semibold uppercase tracking-[0.16em] text-[#E4EAE7]'
