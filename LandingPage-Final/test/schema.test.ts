import { describe, expect, it } from 'vitest'
import { registrationSchema } from '../src/lib/schema'

const valid = {
  fullName: 'Alex Mercer',
  email: 'alex@example.com',
  country: 'IN',
  phone: '9876543210',
}

describe('registrationSchema', () => {
  it('accepts a valid entry', () => {
    expect(registrationSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects a malformed email', () => {
    const r = registrationSchema.safeParse({ ...valid, email: 'alex@' })
    expect(r.success).toBe(false)
  })

  it('rejects a phone number that is invalid for the chosen country', () => {
    // Valid as an Indian number, impossible as a UK one.
    const r = registrationSchema.safeParse({ ...valid, country: 'GB' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path[0] === 'phone')).toBe(true)
    }
  })

  it('accepts the same number once the country matches', () => {
    const r = registrationSchema.safeParse({
      ...valid,
      country: 'GB',
      phone: '7400123456',
    })
    expect(r.success).toBe(true)
  })


  it('rejects a name made of digits', () => {
    expect(registrationSchema.safeParse({ ...valid, fullName: '12345' }).success).toBe(
      false
    )
  })
})
