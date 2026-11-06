import type { Exercise } from '../../features/workouts/domain/types'
import styles from './ExerciseGuide.module.css'

/**
 * Orientação de execução de um exercício.
 *
 * Reúne "Como executar" (explicação curta + passos), "Dica" (cuidado
 * importante), "Adaptação" (alternativa mais fácil) e "Erros comuns". Usado na
 * consulta do exercício e na tela do treino, mantendo a linguagem consistente.
 */
export function ExerciseGuide({ exercise }: { exercise: Exercise }) {
  return (
    <div className={styles.guide}>
      <div className={styles.section}>
        <span className={styles.label}>Como executar</span>
        <p className={styles.text}>{exercise.instructions}</p>
        {exercise.steps && exercise.steps.length > 0 && (
          <ol className={styles.steps}>
            {exercise.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        )}
      </div>

      {exercise.tip && (
        <div className={styles.note}>
          <span className={styles.noteLabel}>Dica</span>
          <p className={styles.text}>{exercise.tip}</p>
        </div>
      )}

      {exercise.adaptations && exercise.adaptations.length > 0 && (
        <div className={styles.note}>
          <span className={styles.noteLabel}>Adaptação</span>
          <ul className={styles.noteList}>
            {exercise.adaptations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {exercise.commonMistakes && exercise.commonMistakes.length > 0 && (
        <div className={styles.note}>
          <span className={styles.noteLabel}>Erros comuns</span>
          <ul className={styles.noteList}>
            {exercise.commonMistakes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
