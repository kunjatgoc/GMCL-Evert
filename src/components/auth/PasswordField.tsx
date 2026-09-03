import { forwardRef, useState, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { field } from '../../lib/fieldStyles'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'>

/**
 * A password input with its own show/hide toggle. The toggle sits inside the
 * field's box, so the padding-right keeps typed text from running under it.
 *
 * forwardRef so react-hook-form's register() can own it as well as a plain
 * form can.
 */
export const PasswordField = forwardRef<HTMLInputElement, Props>(
  function PasswordField(props, ref) {
    const [reveal, setReveal] = useState(false)

    return (
      <div className="relative">
        <input
          ref={ref}
          type={reveal ? 'text' : 'password'}
          className={`${field} w-full pr-12`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setReveal((v) => !v)}
          aria-label={reveal ? 'Hide password' : 'Show password'}
          aria-pressed={reveal}
          className="absolute inset-y-0 right-0 grid w-12 cursor-pointer place-items-center text-white/45 transition-colors duration-200 hover:text-white"
        >
          {reveal ? (
            <EyeOff className="size-[18px]" />
          ) : (
            <Eye className="size-[18px]" />
          )}
        </button>
      </div>
    )
  }
)
