import { cx } from '../../utils/cx'
import { ChevronDownIcon, ChevronUpIcon } from './icons'
import styles from './NumberStepper.module.css'

interface NumberStepperProps {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  /** Unidade exibida ao lado do valor (ex.: "s", "reps"). */
  unit?: string
  /** Texto abaixo do valor (ex.: herança da configuração padrão). */
  hint?: string
  id?: string
  disabled?: boolean
}

/**
 * Seletor numérico com botões de incremento.
 *
 * Evita teclado numérico no mobile (que o app não usa em nenhum outro lugar) e
 * garante que o valor fique sempre dentro dos limites: os botões encapsulam o
 * `min`/`max` e o valor nunca é digitado livremente.
 */
export function NumberStepper({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  hint,
  id,
  disabled = false,
}: NumberStepperProps) {
  const controlId = id ?? `stepper-${label}`.replace(/\s+/g, '-').toLowerCase()
  const canDecrease = !disabled && value - step >= min
  const canIncrease = !disabled && value + step <= max

  return (
    <div className={cx(styles.stepper, disabled && styles.disabled)}>
      <span className={styles.label} id={`${controlId}-label`}>
        {label}
      </span>

      <div className={styles.control} role="group" aria-labelledby={`${controlId}-label`}>
        <button
          type="button"
          className={styles.button}
          onClick={() => onChange(Math.max(min, value - step))}
          disabled={!canDecrease}
          aria-label={`Diminuir ${label.toLowerCase()}`}
        >
          <ChevronDownIcon size={18} />
        </button>

        <span className={styles.value} aria-live="polite">
          {value}
          {unit && <span className={styles.unit}>{unit}</span>}
        </span>

        <button
          type="button"
          className={styles.button}
          onClick={() => onChange(Math.min(max, value + step))}
          disabled={!canIncrease}
          aria-label={`Aumentar ${label.toLowerCase()}`}
        >
          <ChevronUpIcon size={18} />
        </button>
      </div>

      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  )
}
