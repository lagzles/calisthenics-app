/**
 * Ponto de entrada público do domínio de treinos.
 *
 * A interface (Workout Mode, futuro) deve importar daqui em vez de acessar
 * arquivos internos diretamente. Reúne o modelo, o motor, os seletores, a
 * persistência e os utilitários de apresentação.
 */

export * from './domain/types'
export * from './domain/workoutValidation'
export * from './domain/workoutEngine'
export * from './domain/workoutSelectors'
export * from './domain/workoutTransitions'

export * from './data/workouts.data'
export * from './data/workoutFixtures'
export * from './data/workoutRepository'

export * from './hooks/useWorkoutSession'
export * from './hooks/useHomeData'
export * from './hooks/useHistoryData'

export * from './audio'

export * from './recommendation'
export * from './format'
export * from './exerciseIllustrationKeys'
export * from './exerciseIllustrations'
export * from './sessionView'
export * from './sessionSummary'
export * from './historyCalendar'
