import { describe, expect, it } from 'vitest'
import { workouts } from './data/workouts.data'
import {
  EXERCISE_ILLUSTRATION_FILES,
  EXERCISE_ILLUSTRATION_KEYS,
} from './exerciseIllustrationKeys'

/**
 * Verificação dos assets das ilustrações.
 *
 * Lê os SVGs como texto via `import.meta.glob('?raw')` — sem depender do Node
 * (`fs`), mantendo o ambiente de teste e os tipos do Vite. Garante que todo
 * exercício tem um asset local, que a prancha é reutilizada entre os treinos e
 * que nenhuma imagem depende de rede.
 */

const rawSvgs = import.meta.glob('../../assets/exercises/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function rawFor(filename: string): string | undefined {
  const entry = Object.entries(rawSvgs).find(([assetPath]) => assetPath.endsWith(`/${filename}`))
  return entry?.[1]
}

describe('ilustrações dos exercícios', () => {
  const allExercises = workouts.flatMap((workout) => workout.exercises)

  it('todo exercício aponta para uma chave de ilustração conhecida', () => {
    for (const exercise of allExercises) {
      expect(EXERCISE_ILLUSTRATION_KEYS).toContain(exercise.illustration)
    }
  })

  it('existe um arquivo SVG para cada chave declarada', () => {
    for (const key of EXERCISE_ILLUSTRATION_KEYS) {
      const filename = EXERCISE_ILLUSTRATION_FILES[key]
      expect(rawFor(filename), `faltando: ${filename}`).toBeTypeOf('string')
    }
  })

  it('a prancha reutiliza a mesma ilustração nos treinos A e B', () => {
    const plankA = allExercises.find((exercise) => exercise.id === 'a-prancha')
    const plankB = allExercises.find((exercise) => exercise.id === 'b-prancha')

    expect(plankA?.illustration).toBe('plank')
    expect(plankB?.illustration).toBe('plank')
    expect(plankA?.illustration).toBe(plankB?.illustration)
  })

  it('nenhuma ilustração depende de rede', () => {
    for (const key of EXERCISE_ILLUSTRATION_KEYS) {
      const svg = rawFor(EXERCISE_ILLUSTRATION_FILES[key]) ?? ''
      // Remove o namespace SVG (URL padrão, não recurso de rede) e confirma que
      // não restou nenhuma referência externa.
      const withoutNamespace = svg.replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g, '')
      expect(withoutNamespace).not.toMatch(/https?:\/\//)
      expect(svg).not.toContain('<image')
      expect(svg).not.toContain('<script')
    }
  })
})
