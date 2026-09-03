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
  .email('Enter a valid email address.')

export const realAccountSchema = z.object({ email: emailField })

export type RealAccountRequest = z.infer<typeof realAccountSchema>

const registrationFields = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Please enter your full name.')
    .max(80, 'Name is too long.')
    // Rejects a lone surname or a string of digits without excluding
    // single-word mononyms, which are legitimate in many countries.
    .regex(/^[\p{L}\p{M}][\p{L}\p{M}'’.\- ]*$/u, 'Use letters only.'),

  email: emailField,

  country: z.string().min(2),

  phone: z.string().trim().min(1, 'Please enter your phone number.'),
})

// A number is only valid against a country, so the rule sits on the object
// rather than on either field. Shared by both forms below.
const phoneMatchesCountry = (
  val: { phone: string; country: string },
  ctx: z.RefinementCtx
) => {
  const parsed = parsePhoneNumberFromString(val.phone, val.country as CountryCode)
  if (!parsed?.isValid()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['phone'],
      message: 'This phone number is not valid for the selected country.',
    })
  }
}

export const registrationSchema = registrationFields.superRefine(phoneMatchesCountry)

export type Registration = z.infer<typeof registrationSchema>

// The signup form is the registration form plus a password. Length is the
// whole rule -- composition rules get gamed, and the server hashes whatever
// arrives. Mirrors `Signup` in api/index.py.
export const PASSWORD_MIN = 8

export const signupSchema = registrationFields
  .extend({
    password: z
      .string()
      .min(PASSWORD_MIN, `Password must be at least ${PASSWORD_MIN} characters.`)
      .max(200, 'Password is too long.'),
  })
  .superRefine(phoneMatchesCountry)

export type Signup = z.infer<typeof signupSchema>
