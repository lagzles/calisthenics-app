import type { Exercise } from '../../features/workouts/domain/types'
import { getExerciseIllustration } from '../../features/workouts/exerciseIllustrations'
import { cx } from '../../utils/cx'
import styles from './ExerciseIllustration.module.css'

type IllustrationSize = 'sm' | 'md' | 'lg' | 'stage'

interface ExerciseIllustrationProps {
  exercise: Exercise
  size?: IllustrationSize
  className?: string
  /** Texto alternativo. Padrão vazio (a ilustração é decorativa; o nome acompanha). */
  alt?: string
}

/**
 * Ilustração do movimento de um exercício.
 *
 * Renderiza o SVG local resolvido a partir da chave do exercício. O aspecto é
 * sempre preservado (`height: auto` + `object-fit: contain`), sem distorção em
 * telas estreitas.
 */
export function ExerciseIllustration({
  exercise,
  size = 'md',
  className,
  alt = '',
}: ExerciseIllustrationProps) {
  return (
    <img
      className={cx(styles.illustration, styles[size], className)}
      src={getExerciseIllustration(exercise)}
      alt={alt}
      width={200}
      height={140}
      loading="lazy"
      decoding="async"
    />
  )
}
