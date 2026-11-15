import type { ChangeEvent, InputHTMLAttributes } from 'react'
import { cx } from '../../utils/cx'
import styles from './TextField.module.css'

interface TextFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  maxLength?: number
  /** Mensagem de erro; também vira o `aria-describedby` do campo. */
  error?: string
  id?: string
  autoFocus?: boolean
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode']
  className?: string
}

/**
 * Campo de texto com rótulo no padrão visual do app.
 *
 * O app não usa formulários HTML: `onChange` recebe o valor já extraído, e o
 * botão de salvar é que faz a validação — o campo apenas comunica o erro.
 */
export function TextField({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  error,
  id,
  autoFocus,
  inputMode,
  className,
}: TextFieldProps) {
  const fieldId = id ?? 'text-field'
  const errorId = `${fieldId}-error`

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)

  return (
    <div className={cx(styles.field, className)}>
      <label className={styles.label} htmlFor={fieldId}>
        {label}
      </label>
      <input
        id={fieldId}
        className={cx(styles.input, error && styles.inputInvalid)}
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        maxLength={maxLength}
        autoFocus={autoFocus}
        inputMode={inputMode}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  )
}
