// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { CustomWorkoutEditorPage } from './CustomWorkoutEditorPage'
import { EXERCISE_LIBRARY } from '../../features/workouts/data/exerciseLibrary'
import {
  clearCustomWorkouts,
  listCustomWorkouts,
} from '../../features/workouts/data/customWorkoutRepository'
import { clearSessions } from '../../features/workouts/data/workoutRepository'

beforeEach(async () => {
  await clearSessions()
  await clearCustomWorkouts()
})

afterEach(() => {
  cleanup()
})

function renderEditor() {
  return render(
    <MemoryRouter initialEntries={['/treinos/personalizados/novo']}>
      <Routes>
        <Route path="treinos/personalizados/novo" element={<CustomWorkoutEditorPage />} />
        <Route path="treinos" element={<p>Lista de treinos</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

function exerciseButton(name: string) {
  return screen.getByRole('button', { name: new RegExp(`^${name}`) })
}

/** Card de configuração do exercício, localizado pelo grupo de modo. */
function configCard(name: string): HTMLElement {
  const group = screen.getByRole('group', { name: `Modo de ${name}` })
  const card = group.closest('li')
  if (!card) throw new Error(`Card de configuração não encontrado para ${name}`)
  return card as HTMLElement
}

function setStepper(name: string, label: string, direction: 'mais' | 'menos', times = 1) {
  const card = configCard(name)
  const verb = direction === 'mais' ? 'Aumentar' : 'Diminuir'
  for (let i = 0; i < times; i += 1) {
    fireEvent.click(within(card).getByRole('button', { name: `${verb} ${label.toLowerCase()}` }))
  }
}

describe('CustomWorkoutEditorPage', () => {
  it('começa vazio, sem exercícios selecionados', () => {
    renderEditor()

    expect(screen.getByText('0 de 3 selecionados')).toBeDefined()
    expect(screen.queryByRole('heading', { name: 'Configuração dos exercícios' })).toBeNull()
  })

  it('adiciona e remove um exercício da biblioteca', () => {
    renderEditor()
    const name = EXERCISE_LIBRARY[0].name

    fireEvent.click(exerciseButton(name))
    expect(screen.getByText('1 de 3 selecionados')).toBeDefined()
    expect(screen.getByRole('group', { name: `Modo de ${name}` })).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: `Remover ${name}` }))
    expect(screen.getByText('0 de 3 selecionados')).toBeDefined()
  })

  it('impede ultrapassar o limite configurado', () => {
    renderEditor()
    const [first, second, third, fourth] = EXERCISE_LIBRARY

    fireEvent.click(screen.getByRole('button', { name: 'Diminuir limite de exercícios' }))
    fireEvent.click(screen.getByRole('button', { name: 'Diminuir limite de exercícios' }))
    expect(screen.getByText('0 de 1 selecionados')).toBeDefined()

    fireEvent.click(exerciseButton(first.name))
    expect(screen.getByText('1 de 1 selecionados')).toBeDefined()

    expect((exerciseButton(second.name) as HTMLButtonElement).disabled).toBe(true)
    expect((exerciseButton(third.name) as HTMLButtonElement).disabled).toBe(true)
    expect((exerciseButton(fourth.name) as HTMLButtonElement).disabled).toBe(true)
  })

  it('reordena os exercícios selecionados', () => {
    const { container } = renderEditor()
    const [first, second] = EXERCISE_LIBRARY

    fireEvent.click(exerciseButton(first.name))
    fireEvent.click(exerciseButton(second.name))

    const selectedNames = () =>
      Array.from(container.querySelectorAll('ol > li')).map(
        (item) => item.querySelector('span[class*="exerciseName"]')?.textContent ?? '',
      )

    expect(selectedNames()).toEqual([first.name, second.name])

    fireEvent.click(screen.getByRole('button', { name: `Mover ${second.name} para cima` }))

    expect(selectedNames()).toEqual([second.name, first.name])
  })

  it('configura o modo de cada exercício individualmente', () => {
    renderEditor()
    const [first, second] = EXERCISE_LIBRARY

    fireEvent.click(exerciseButton(first.name))
    fireEvent.click(exerciseButton(second.name))

    const cardFirst = configCard(first.name)
    const cardSecond = configCard(second.name)

    fireEvent.click(within(cardFirst).getByRole('button', { name: 'Repetições' }))

    expect(
      within(cardFirst).getByRole('button', { name: 'Repetições' }).getAttribute('aria-pressed'),
    ).toBe('true')
    // O segundo exercício permanece no modo padrão (tempo).
    expect(
      within(cardSecond).getByRole('button', { name: 'Tempo' }).getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('configura séries, alvo e descanso por exercício', () => {
    renderEditor()
    const [first, second] = EXERCISE_LIBRARY

    fireEvent.click(exerciseButton(first.name))
    fireEvent.click(exerciseButton(second.name))

    setStepper(first.name, 'séries', 'mais')
    setStepper(second.name, 'séries', 'menos')
    setStepper(first.name, 'descanso', 'mais')

    // Apenas o primeiro exercício mudou: 4 séries; o segundo foi para 2.
    expect(within(configCard(first.name)).getByText('4 × 30s')).toBeDefined()
    expect(within(configCard(second.name)).getByText('2 × 30s')).toBeDefined()

    // O descanso do primeiro foi para 25s e o do segundo permanece 20s.
    const restValue = (name: string) =>
      within(configCard(name))
        .getByRole('group', { name: 'Descanso' })
        .textContent?.replace(/\s|s/g, '')
    expect(restValue(first.name)).toBe('25')
    expect(restValue(second.name)).toBe('20')
  })

  it('mostra erros e não salva sem nome', async () => {
    renderEditor()
    fireEvent.click(exerciseButton(EXERCISE_LIBRARY[0].name))

    fireEvent.click(screen.getByRole('button', { name: 'Salvar treino' }))

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('Informe um nome para o treino.')).toBeDefined()
    expect(await listCustomWorkouts()).toEqual([])
  })

  it('salva um treino misto com a configuração de cada exercício', async () => {
    renderEditor()
    const [first, second] = EXERCISE_LIBRARY

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Treino misto' } })
    fireEvent.click(exerciseButton(first.name))
    fireEvent.click(exerciseButton(second.name))

    // Primeiro por repetições, 4 séries; segundo permanece por tempo.
    fireEvent.click(
      within(configCard(first.name)).getByRole('button', { name: 'Repetições' }),
    )
    setStepper(first.name, 'séries', 'mais')

    fireEvent.click(screen.getByRole('button', { name: 'Salvar treino' }))

    await waitFor(async () => {
      expect(await listCustomWorkouts()).toHaveLength(1)
    })

    const [saved] = await listCustomWorkouts()
    expect(saved.name).toBe('Treino misto')
    expect(saved.restBetweenExercises).toBe(true)
    expect(saved.exercises.map((exercise) => exercise.executionType)).toEqual(['reps', 'timed'])
    expect(saved.exercises[0].sets).toBe(4)
    expect(saved.exercises[0].repetitions).toBe(12)
    expect(saved.exercises[1].workDuration).toBe(30)
  })
})
