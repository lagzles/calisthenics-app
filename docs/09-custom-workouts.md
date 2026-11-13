# Calisthenics App — Treinos Personalizados

**Versão:** 2.0
**Base:** [`docs/03-workout-engine.md`](03-workout-engine.md),
[`docs/04-workout-mode-implementation.md`](04-workout-mode-implementation.md) e
[`docs/08-workout-history.md`](08-workout-history.md)

> **Versão 2.0:** a configuração passou a ser **por exercício** (modo, alvo,
> séries e descanso independentes), permitindo treinos mistos, e o descanso
> entre exercícios foi adicionado ao motor como opt-in do `Workout`.

## 1. Objetivo

Permitir que o usuário monte seus próprios treinos a partir da biblioteca de
exercícios já existente, configurando **cada exercício** individualmente —
modo de execução (tempo ou repetições), alvo por série, séries e descanso — e
então iniciar, editar ou excluir esse treino.

O princípio central: **nenhum motor de execução paralelo**. Um treino
personalizado é um `Workout` comum, então passa pelo mesmo
`workoutEngine`, pela mesma tela de execução e pela mesma persistência de
histórico dos treinos A e B.

## 2. Decisões de produto

| Decisão | Escolha | Motivo |
| --- | --- | --- |
| Configuração | **Por exercício** (modo, alvo, séries e descanso) | Um treino pode misturar tempo e repetições; mudar um exercício não afeta os outros |
| Descanso entre exercícios | **Implementado** como opt-in do `Workout` | Requisito 2.3; `restBetweenExercises` mantém os presets A/B inalterados |
| Valor inicial de um novo exercício | Herda a configuração do último selecionado | Mantém o fluxo de criação curto |
| Limite de exercícios | Limite máximo, não quantidade exata | O usuário pode salvar com menos exercícios do que o configurado |
| Navegação | Seção "Meus treinos" dentro de `/treinos` | Evita uma 4ª aba no menu inferior |
| Repetição de exercício | Não permitida no mesmo treino | Reaproveita o exercício da biblioteca (ilustração e demo do Panda) e atende ao validador do motor, que rejeita ids duplicados |

## 3. Arquitetura

```text
exerciseLibrary (derivada de workouts.data.ts)
        │
        ▼
customWorkout.ts (domínio puro: rascunho → CustomWorkout)
        │
        ├──► CustomWorkoutEditorPage (UI) ──► workoutService.saveCustomWorkout
        │                                            │
        │                                            ▼
        │                              IndexedDB (customWorkouts, schema v2)
        │                                            │
        │                              workoutService.resolveWorkout
        │                                            │
        └────────────────────────────────────────────┴──► workoutEngine (inalterado)
                                                                  │
                                                                  ▼
                                                    /treino/:workoutId (inalterado)
```

| Camada | Arquivo | Responsabilidade |
| --- | --- | --- |
| Biblioteca | `src/features/workouts/data/exerciseLibrary.ts` | Deriva os exercícios únicos do catálogo existente. Não é um segundo catálogo. |
| Domínio puro | `src/features/workouts/domain/customWorkout.ts` | Rascunho com configuração por exercício, limites, adicionar/remover/reordenar, validação e conversão para `CustomWorkout`. Sem React, DOM ou IndexedDB. |
| Persistência | `src/features/workouts/data/customWorkoutRepository.ts` | CRUD do store `customWorkouts`, reusando a conexão de `workoutRepository`. |
| Serviço | `src/services/workoutService.ts` | `resolveWorkout(id)` enxerga presets e personalizados; CRUD exposto à UI. |
| Hook | `src/features/workouts/hooks/useCustomWorkouts.ts` | Carrega a lista e permite recarregar. |
| Página | `src/pages/Workouts/CustomWorkoutEditorPage.tsx` | Editor (criação e edição) em página única. |
| Seção | `src/pages/Workouts/CustomWorkoutsSection.tsx` | Lista "Meus treinos" em `/treinos`, com iniciar/editar/excluir. |
| Primitivos | `src/components/ui/TextField.tsx`, `NumberStepper.tsx` | Primeiros inputs do app, no padrão visual existente. |

## 4. Modelo de dados

`Workout.id` passou de `WorkoutId` (`'A' | 'B'`) para `string`. É a única
alteração de tipo do catálogo:

- `WorkoutSession.workoutId` já era `string` — sem migração de sessões.
- `LastWorkoutSummary.workoutId`, `recommendation.ts` e
  `sessionSummary.toWorkoutId` continuam restritos a `'A' | 'B'`: treinos
  personalizados **não** entram na recomendação da Home.

```ts
export interface CustomWorkout extends Workout {
  exerciseCount: number   // limite configurado no editor
  createdAt: string
  updatedAt: string
}
```

`ExerciseProgress` ganhou `exerciseName?: string` (opcional, retrocompatível),
preenchido em `startWorkout`. Garante que o Histórico continue legível mesmo
depois de o treino personalizado ser editado ou excluído.

`Workout` ganhou um campo opcional:

```ts
export interface Workout {
  // …
  /** Descansa após a última série de um exercício, antes do próximo. */
  restBetweenExercises?: boolean
}
```

O padrão é `false` (ausente). Os presets A e B **não** o definem, então
continuam indo direto para a etapa `completed` e esperando o avanço manual — o
que preserva as durações 860s/880s e o comportamento da tela de execução.
Treinos personalizados o definem como `true` quando ao menos um exercício tem
descanso após o exercício.

O tipo do descanso **não** é persistido na sessão: é derivado de
`currentSet >= exercise.sets`. Assim o esquema de `workoutSessions` não muda e
sessões já gravadas continuam válidas.

## 5. Regras do editor

Em `src/features/workouts/domain/customWorkout.ts` (todas as funções puras,
nenhuma muta a entrada):

Cada exercício do rascunho é um `DraftExercise` com a configuração completa:

```ts
export interface ExerciseConfig {
  mode: ExecutionType      // 'reps' | 'timed'
  target: number           // repetições ou segundos por série
  sets: number
  restDuration: number
  restAfterExercise: boolean
}
export interface DraftExercise extends ExerciseConfig {
  exerciseId: string
}
```

O rascunho (`CustomWorkoutDraft`) **não** tem mais `mode`, `baseSets`,
`baseTarget` nem `restDuration` globais.

| Função | Regra |
| --- | --- |
| `addExercise` | Ignora exercício repetido ou quando o limite já foi atingido; o novo exercício herda a configuração do último selecionado |
| `setExerciseLimit` | Nunca abaixo da quantidade já selecionada |
| `moveExercise` | Uma posição por vez; ignora as extremidades |
| `setExerciseConfig` | Atualiza **só** o exercício indicado; um `target` explícito sempre vence, e trocar o modo sem alvo volta ao padrão da nova unidade |
| `describeExerciseConfig` | Rótulo curto: `3 × 12 reps` / `3 × 30s` |
| `toCustomWorkout` | Copia apresentação da biblioteca, aplica a configuração de cada exercício e deriva `description` (inclui "misto"), `estimatedMinutes` e `restBetweenExercises` |
| `validateDraft` | Nome, ≥1 exercício, limite, ids existentes, séries e alvo ≥1, descanso ≥0 — por exercício |

`estimateExerciseSeconds` estima exercícios por repetições
(`SECONDS_PER_REPETITION = 3`) e `estimateWorkoutSeconds` soma o descanso entre
exercícios quando `restBetweenExercises` está ligado. Os presets continuam
exatos (A = 14 min / 860s, B = 15 min / 880s).

## 6. Execução

O fluxo continua sendo o existente:

1. `/treinos` → "Iniciar treino" → `navigate('/treino/:workoutId')`.
2. `loadWorkoutMode` → `resolveWorkout` → `prepare`.
3. `startWorkoutSession` → `startWorkout` → grava a sessão no IndexedDB.
4. `ActiveWorkout` → `useWorkoutSession` → contagem, descanso, pausa,
   +10s/+15s, pular série, navegação, áudio, Wake Lock e Panda.

A única mudança estrutural foi `resolveWorkout`, usado por `loadWorkoutMode`,
`startWorkoutSession` e `recoverWorkoutSession`. Sem isso, um treino
personalizado ficaria inacessível pela rota e o cronômetro congelaria ao
recarregar a página (a reconciliação por `tick` não encontraria o treino).

O modo é uma propriedade do **exercício**, então a interface já exibe "12
repetições" + "Concluir série" para `reps` e a contagem regressiva + "Pular
série" para `timed`, alternando naturalmente em treinos mistos.

### Descanso entre exercícios (novo)

Em `workoutTransitions.ts`:

- `startsExerciseRest` → `true` quando o treino tem `restBetweenExercises`, o
  `restDuration` do exercício é `> 0` e **não** é o último exercício.
- Ao concluir (ou pular) a última série nessa condição, o exercício é marcado
  como concluído (`markExerciseCompleted`) e o motor entra na fase `rest`.
- `beginNextSetAfterRest` detecta `isRestBetweenExercises` (`currentSet >=
  sets`) e, ao terminar o descanso, chama `beginExercise` do próximo índice —
  a mesma convenção de `advanceExercise`, preservando o progresso.
- Sem descanso após a última série do **último** exercício: o treino conclui
  como antes.
- `restDuration: 0` com `restBetweenExercises` ligado encadeia direto no
  próximo exercício (`shouldChainNextExercise`), sem etapa `completed`
  intermediária.

Pausa, retomada, +10s/+15s, pular descanso e navegação continuam os mesmos —
o descanso entre exercícios é o mesmo `rest` que já existia. `sessionView`
mostra "Exercício concluído. Descanse antes do próximo." nessa transição.

Para exercícios por repetições, a interface exibe o alvo ("12 repetições") e o
botão "Concluir série".

## 7. Persistência (schema v2)

`DB_VERSION` passou de 1 para 2, com um novo store:

```ts
if (oldVersion < 2) {
  const store = database.createObjectStore('customWorkouts', { keyPath: 'id' })
  store.createIndex('updatedAt', 'updatedAt', { unique: false })
}
```

O bloco `oldVersion < 1` não foi alterado. Bancos existentes recebem o store na
próxima abertura, sem tocar em `workoutSessions`.

`withStore` passou a receber o nome do store (antes era fixo em
`workoutSessions`) e os utilitários de transação foram exportados, para que os
dois repositórios compartilhem **uma** conexão — abrir o banco em dois lugares
faria uma futura migração bloquear.

## 8. Interface

Rotas novas, dentro de `AppLayout`:

- `treinos/personalizados/novo`
- `treinos/personalizados/:id/editar`

São mais específicas que `treinos/:workoutId`, então não há conflito. A
execução continua em `/treino/:workoutId`.

O editor é uma página única com rolagem (o app não usa assistente em etapas):
nome → limite → biblioteca → **cartão por exercício** (modo, alvo, séries,
descanso, ↑/↓, remover) → revisão e salvar. Valores inválidos aparecem em
`--color-danger`, no mesmo padrão de erro da tela de preparação.

O cartão de cada exercício concentra as quatro configurações e o seletor de modo
(`Repetições` / `Tempo`), deixando explícito que a escolha é do exercício e não
do treino. O resumo final mostra "Misto" quando há modalidades diferentes.

Como o app não tinha nenhum campo de formulário, foram criados `TextField` e
`NumberStepper`, seguindo os tokens e os alvos de toque (≥44px) existentes.

A seção "Meus treinos" mostra o rótulo do modo (`Misto`, `Por tempo`, `Por
repetições`) e, por exercício, o alvo (`3 × 12 reps` / `3 × 30s`).

## 9. Testes

| Arquivo | Cobertura |
| --- | --- |
| `domain/customWorkout.test.ts` | Biblioteca, criar/adicionar/remover/reordenar, limite, **modo/alvo/séries/descanso por exercício**, treino misto completo, isolamento entre exercícios, conversão e validação (37 testes) |
| `data/customWorkoutRepository.test.ts` | CRUD, ordenação, reabertura, isolamento entre stores e migração v1 → v2 (9) |
| `customWorkoutExecution.test.ts` | Execução: reps, tempo, séries diferentes, descanso entre séries e **entre exercícios**, sem descanso após o último, pausa/retomada no exercício e no descanso, pular/próximo/anterior, `exerciseName`, histórico e reconciliação (14) |
| `services/customWorkoutService.test.ts` | `resolveWorkout`, CRUD, iniciar, preparar e presets (8) |
| `pages/Workouts/CustomWorkoutEditorPage.test.tsx` | Editor em jsdom: nome, selecionar/remover, limite, reordenar, **modo por exercício**, séries/descanso independentes e salvar treino misto (8) |

Suíte completa: **337 testes**, incluindo os 25 arquivos pré-existentes
(`workouts.data.test.ts` continua garantindo A = 860s/14 min e B = 880s/15 min,
que é a prova de que os presets não descansam entre exercícios).

## 10. Limitações

- **Cada exercício aparece no máximo uma vez** no treino personalizado.
- **Treinos personalizados não entram na recomendação A/B** nem no cartão
  "Último treino" da Home.
- **Excluir um treino com sessão ativa** deixa essa sessão sem reconciliação
  (comportamento atual do `recoverWorkoutSession` quando o treino não existe).
  O histórico já concluído permanece intacto porque `workoutName` e
  `exerciseName` são cópias no momento da execução.
- **Descanso entre exercícios é opt-in por treino** (`restBetweenExercises`).
  Desligá-lo num treino personalizado faz a transição voltar a ser manual, como
  nos presets — o editor sempre o liga quando há descanso configurado.
