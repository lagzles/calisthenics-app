import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { prepareWorkoutAudio } from '../../services/audioService'
import { loadWorkoutMode, startWorkoutSession, type WorkoutModeLoad } from '../../services/workoutService'
import { ActiveWorkout } from './ActiveWorkout'
import { PreparationScreen } from './PreparationScreen'
import styles from './WorkoutMode.module.css'

type LoadResult = WorkoutModeLoad | { status: 'error' }

/**
 * Prepara a tela de execução (Workout Mode).
 *
 * 1. Tenta recuperar uma sessão em andamento — se houver, retoma a execução
 *    (sem passar pela preparação).
 * 2. Caso não exista, exibe a **preparação** do treino da rota. Nenhuma sessão é
 *    criada aqui: o usuário inicia explicitamente em "Iniciar treino".
 *
 * O áudio é preparado no clique de início — dentro do gesto do usuário — e o
 * Wake Lock é solicitado quando a sessão fica ativa (em `ActiveWorkout`).
 */
export function WorkoutModePage() {
  const { workoutId } = useParams()
  return <WorkoutModeLoader key={workoutId ?? 'none'} workoutId={workoutId} />
}

function WorkoutModeLoader({ workoutId }: { workoutId: string | undefined }) {
  const navigate = useNavigate()
  const [result, setResult] = useState<LoadResult | null>(null)
  const [starting, setStarting] = useState(false)
  const loadRef = useRef<Promise<LoadResult> | null>(null)

  useEffect(() => {
    let active = true
    // Promise compartilhada: sobrevive ao duplo efeito do StrictMode sem carregar
    // duas vezes.
    const promise =
      loadRef.current ??
      loadWorkoutMode(workoutId).catch(() => ({ status: 'error' }) as LoadResult)
    loadRef.current = promise
    void promise.then((value) => {
      if (active) setResult(value)
    })
    return () => {
      active = false
    }
  }, [workoutId])

  const startWorkout = useCallback(async () => {
    if (starting || !result || result.status !== 'prepare') return
    setStarting(true)
    // Áudio preparado dentro do gesto do usuário que inicia o treino.
    prepareWorkoutAudio()
    try {
      const started = await startWorkoutSession(result.workout.id)
      setResult({ status: 'ready', workout: result.workout, session: started.session })
    } finally {
      setStarting(false)
    }
  }, [starting, result])

  if (!result) {
    return (
      <div className={styles.mode}>
        <div className={styles.message}>
          <p className={styles.messageText}>Preparando seu treino…</p>
        </div>
      </div>
    )
  }

  if (result.status === 'error') {
    return (
      <div className={styles.mode}>
        <div className={styles.message}>
          <EmptyState
            title="Não foi possível iniciar"
            description="Tente novamente a partir da tela de treinos."
            action={<Button onClick={() => navigate('/treinos')}>Ver treinos</Button>}
          />
        </div>
      </div>
    )
  }

  if (result.status === 'missing') {
    return (
      <div className={styles.mode}>
        <div className={styles.message}>
          <EmptyState
            title="Treino não encontrado"
            description="O treino solicitado não existe."
            action={<Button onClick={() => navigate('/treinos')}>Ver treinos</Button>}
          />
        </div>
      </div>
    )
  }

  if (result.status === 'prepare') {
    return (
      <PreparationScreen
        workout={result.workout}
        onStart={startWorkout}
        onBack={() => navigate('/treinos')}
      />
    )
  }

  return (
    <ActiveWorkout key={result.session.id} workout={result.workout} initialSession={result.session} />
  )
}
