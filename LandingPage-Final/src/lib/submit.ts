import type { Registration } from './schema'

export type SubmitResult = { ok: true } | { ok: false; error: string }

// Same-origin by default, which the dev proxy in vite.config.ts satisfies.
// Set VITE_REGISTER_URL when the API is deployed somewhere else.
const ENDPOINT = import.meta.env.VITE_REGISTER_URL ?? '/api/register'

/** The single seam between the form and the API. */
export async function submitRegistration(
  data: Registration
): Promise<SubmitResult> {
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (res.ok) return { ok: true }
    if (res.status === 409)
      return { ok: false, error: 'You have already applied for the demo. Sit back and relax — you will get an email from our side.' }

    return { ok: false, error: 'Registration failed. Please try again.' }
  } catch {
    // Offline, DNS, CORS, server down. Worth distinguishing from a rejection:
    // one is worth retrying immediately, the other is not.
    return {
      ok: false,
      error: 'Could not reach the server. Check your connection and try again.',
    }
  }
}
