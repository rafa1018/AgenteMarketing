import { Fragment } from 'react'
import { useT, type Text } from '@/i18n'

/** Renders text and highlights any "[AGREGAR …]" placeholder so missing data is obvious. */
export function Rich({ text }: { text: Text }) {
  const t = useT()
  const parts = t(text).split(/(\[[^\]]+\])/g)
  return (
    <>
      {parts.map((p, i) =>
        /^\[.*\]$/.test(p) ? (
          <span key={i} className="ph">
            {p}
          </span>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  )
}
