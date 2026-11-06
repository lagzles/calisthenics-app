import { createWorkoutAudio, type WorkoutAudio } from '../features/workouts/audio/workoutAudio'

/**
 * Instância única do áudio do treino.
 *
 * Precisa ser compartilhada entre a tela que **inicia** o treino (onde ocorre o
 * gesto do usuário que "desbloqueia" o áudio) e a tela de execução (que reage
 * às transições). Por isso vive em um módulo singleton, criado sob demanda.
 */

let instance: WorkoutAudio | null = null

export function getWorkoutAudio(): WorkoutAudio {
  if (!instance) {
    instance = createWorkoutAudio()
  }
  return instance
}

/**
 * Prepara o áudio. Deve ser chamado dentro do clique em "Iniciar treino" para
 * contornar as restrições de autoplay dos navegadores.
 */
export function prepareWorkoutAudio(): void {
  getWorkoutAudio().prepare()
}
