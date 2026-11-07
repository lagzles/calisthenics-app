import type { SessionSnapshot } from '../../workouts/domain/types'
import type { PandaState } from './pandaTypes'

/**
 * Estado do mascote em função do momento do treino.
 *
 * O Workout Engine não conhece o panda: a ligação acontece só aqui, na
 * camada de apresentação. Durante a execução do exercício o palco é ocupado
 * pela **demonstração**; no descanso e nas transições o panda assume um
 * estado de personalidade.
 */

/**
 * Estado de personalidade para o instantâneo atual.
 *
 * - `work` → o palco mostra a demonstração do exercício (`'idle'`).
 * - `rest` → o panda descansa.
 * - `completed` → o panda incentiva a avançar.
 * - treino concluído → o panda comemora.
 */
export function resolvePandaState(snapshot: SessionSnapshot): PandaState {
  if (snapshot.isWorkoutComplete) return 'celebrating'
  if (snapshot.phase === 'rest') return 'rest'
  if (snapshot.phase === 'completed') return 'encouraging'
  return 'idle'
}

/** O momento do treino pede uma **demonstração** (em vez de um estado)? */
export function showsPandaDemo(snapshot: SessionSnapshot): boolean {
  return snapshot.phase === 'work' && !snapshot.isWorkoutComplete
}
