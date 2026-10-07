import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { groupDigits, localPart } from '@/lib/phone'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  /** stored value, e.g. "+57 301 648 3958" or "" */
  value: string
  /** receives "+57 301 648 3958" (or "" when empty); partial numbers are passed as typed digits */
  onChange: (value: string) => void
  invalid?: boolean
}

/**
 * Colombian mobile input: fixed "+57" prefix, only the 10 digits are typed and grouped as "301 648 3958".
 * Pasting "+57 301…" or "57301…" also works.
 */
export function PhoneInput({ value, onChange, invalid, className, ...rest }: Props) {
  const digits = localPart(value)
  return (
    <div
      className={cn(
        'flex min-h-[46px] w-full min-w-0 items-stretch overflow-hidden rounded-lg border bg-white transition-[border-color,box-shadow] focus-within:border-royal focus-within:shadow-[0_0_0_4px_rgb(58_54_168/0.12)]',
        invalid ? 'border-berry' : 'border-[#d6d8ec]',
        className,
      )}
    >
      <span className="flex items-center border-r border-line bg-paper px-3 text-[15px] font-semibold text-ink select-none">🇨🇴 +57</span>
      <input
        {...rest}
        type="tel"
        inputMode="numeric"
        autoComplete={rest.autoComplete ?? 'tel-national'}
        className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-[16px] text-text outline-none placeholder:text-muted/70"
        value={groupDigits(digits)}
        placeholder={rest.placeholder ?? '301 648 3958'}
        onChange={(e) => {
          let d = e.target.value.replace(/\D/g, '')
          if (d.length > 10 && d.startsWith('57')) d = d.slice(2) // pasted with the country code
          d = d.slice(0, 10)
          onChange(d.length === 10 ? `+57 ${groupDigits(d)}` : d)
        }}
      />
    </div>
  )
}
