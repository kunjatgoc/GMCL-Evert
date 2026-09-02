import { z } from 'zod'
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'

// Re-exported so existing imports keep working; the list itself lives in
// countries.ts so it can be imported without this file's metadata.
export { COUNTRIES, type Country } from './countries'


// One definition, two forms: the league entry above and the real-account
// request below it must agree on what an address is.
const emailField = z
  .string()
  .trim()
  .min(1, 'Please enter your email address.')
  .email('That does not look like a valid email address.')

export const realAccountSchema = z.object({ email: emailField })

export type RealAccountRequest = z.infer<typeof realAccountSchema>

export const registrationSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, 'Please enter your full name.')
      .max(80, 'That name is too long.')
      // Rejects a lone surname or a string of digits without excluding
      // single-word mononyms, which are legitimate in many countries.
      .regex(/^[\p{L}\p{M}][\p{L}\p{M}'’.\- ]*$/u, 'Use letters only.'),

    email: emailField,

    country: z.string().min(2),

    phone: z.string().trim().min(1, 'Please enter your phone number.'),
  })
  .superRefine((val, ctx) => {
    const parsed = parsePhoneNumberFromString(val.phone, val.country as CountryCode)
    if (!parsed?.isValid()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['phone'],
        message: 'That phone number is not valid for the selected country.',
      })
    }
  })

export type Registration = z.infer<typeof registrationSchema>
