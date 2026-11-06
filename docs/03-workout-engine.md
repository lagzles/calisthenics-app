# Calisthenics App — Workout Engine (Tarefa 02)

**Versão:** 1.0
**Status:** Motor de execução e persistência implementados (Tarefa 02)
**Base:** [`docs/00-architecture-decision.md`](00-architecture-decision.md),
[`docs/01-UI-UXi-specification.md`](01-UI-UXi-specification.md) e
[`docs/02-initial-implementation.md`](02-initial-implementation.md)

Este documento descreve o motor de execução dos treinos: modelo de dados,
estados e transições, funcionamento do temporizador, pausa/retomada, extensão do
descanso, persistência em IndexedDB e recuperação de sessões — além de como
executar os testes e como a futura interface (Workout Mode) deve consumir o
motor.

> Nesta tarefa **não** foi desenvolvida a interface visual definitiva. O foco é
> a lógica de negócio, testável sem UI.

**Decisão de produto (atualização).** *Todos os exercícios disponibilizados no
MVP serão executados por tempo, com 40 segundos de atividade, três séries e
descansos configuráveis de 20 ou 30 segundos. Não haverá exercícios por
repetições nos treinos A e B.* O motor **não foi reescrito** e continua genérico
(suporta `timed` e `reps`); a mudança é de **catálogo** (`workouts.data.ts`) e de
**apresentação**. Para os treinos do MVP, `estimatedMinutes` passa a ser derivado
de `estimateWorkoutMinutes` (40s por série + descanso entre séries, sem descanso
após a última série de cada exercício).

## 1. Arquitetura

O motor é composto por três camadas independentes:

```text
src/features/workouts/
├─ domain/                    # Lógica pura (sem React, sem DOM, sem IndexedDB)
│  ├─ types.ts                # Modelo: catálogo + execução + eventos
│  ├─ workoutValidation.ts    # Validação do catálogo
│  ├─ workoutTransitions.ts   # Transições de fase (baixo nível)
│  ├─ workoutEngine.ts        # Operações do motor (API principal)
│  └─ workoutSelectors.ts     # Leitura/derivação para a interface
├─ data/                      # Dados e persistência
│  ├─ workouts.data.ts        # Catálogo estático (treinos A/B)
│  ├─ homeFixtures.ts         # Dados ilustrativos da Home
│  ├─ workoutFixtures.ts      # Construtores de treino (testes/futuro)
│  └─ workoutRepository.ts    # Persistência em IndexedDB
├─ hooks/
│  └─ useWorkoutSession.ts    # Ponte fina para React
├─ recommendation.ts          # Regra de recomendação do próximo treino
├─ format.ts                  # Formatação de apresentação
└─ index.ts                   # Ponto de entrada público do domínio

src/services/workoutService.ts # Orquestra catálogo + motor + repositório
```

Princípios:

- **Domínio puro.** `domain/` não importa React nem toca em `indexedDB`. Todas as
  operações são funções puras `(session, workout, now) => { session, events }`.
- **Persistência isolada.** `workoutRepository` conhece apenas `WorkoutSession` e
  a API IndexedDB.
- **Uma única ponte.** `workoutService` liga motor e persistência. É o que a
  interface deve consumir para iniciar/recuperar/historiar sessões.
- **Tempo por timestamps.** O tempo nunca depende de `setInterval` como fonte de
  verdade (ver §5).

## 2. Modelo de dados

### 2.1 Catálogo

```ts
type WorkoutId = 'A' | 'B'
type ExecutionType = 'timed' | 'reps'

interface Exercise {
  id: string
  name: string
  description?: string
  illustration: string
  instructions: string
  executionType: ExecutionType
  sets: number
  workDuration?: number      // segundos — obrigatório em 'timed'
  repetitions?: number       // obrigatório em 'reps'
  restDuration: number       // segundos — descanso entre séries
  commonMistakes?: string[]
  adaptations?: string[]
}

interface Workout {
  id: WorkoutId
  name: string
  description: string
  estimatedMinutes: number
  exercises: Exercise[]      // a ordem do array é a ordem de execução
}
```

Sobre a modelagem (ajustes em relação aos "campos sugeridos" da tarefa):

- `executionType` usa os valores `'timed' | 'reps'`.
- A ordem dos exercícios é a **posição no array** — não há campo `order`
  duplicando a informação (evita inconsistência).
- `estimatedMinutes` foi mantido (unidade explícita) no lugar de
  `estimatedDuration`.
- `description` do `Workout` substitui o antigo `goal`.
- `createdAt`/`updatedAt` não existem no catálogo estático (definido em código);
  timestamps são relevantes nas **sessões**, que os registram.

### 2.2 Sessão (execução)

```ts
type WorkoutSessionStatus = 'active' | 'paused' | 'completed' | 'abandoned'
type WorkoutPhase = 'work' | 'rest' | 'completed'

interface CompletedSet {
  set: number
  completedAt: string
  actualRepetitions?: number
  workSeconds?: number
}

interface ExerciseProgress {
  exerciseId: string
  completedSets: number
  sets: CompletedSet[]
  completed: boolean
  completedAt: string | null
}

interface WorkoutSession {
  id: string
  workoutId: string
  workoutName: string
  status: WorkoutSessionStatus
  startedAt: string
  pausedAt: string | null
  finishedAt: string | null
  currentExerciseIndex: number   // 0-based
  currentSet: number             // 1-based
  currentPhase: WorkoutPhase
  remainingTime: number          // segundos (autoritativo quando pausada)
  phaseStartedAt: string | null
  phaseEndsAt: string | null     // null quando a etapa não é por tempo
  totalPausedMs: number          // tempo total em pausa (desconta da duração)
  completedSets: number          // total no treino
  exercisesProgress: ExerciseProgress[]
  duration: number               // segundos de treino efetivo
}
```

`totalPausedMs` e `exercisesProgress[].sets` são acréscimos em relação aos
campos sugeridos: o primeiro garante a duração correta ao excluir pausas; o
segundo registra cada série (histórico + idempotência).

## 3. Estados e transições

### 3.1 Status

| Status      | Significado                             |
| ----------- | --------------------------------------- |
| `active`    | Em execução (andamento normal).         |
| `paused`    | Pausada; tempo congelado.               |
| `completed` | Concluída.                              |
| `abandoned` | Abandonada pelo usuário.                |

### 3.2 Etapas (`currentPhase`)

| Etapa       | Significado                                                        |
| ----------- | ------------------------------------------------------------------ |
| `work`      | Execução da série atual (por tempo ou por repetições).             |
| `rest`      | Descanso entre séries.                                              |
| `completed` | Última série do exercício atual concluída (aguarda avanço, ou fim). |

`currentPhase = 'completed'` com `status = 'active'` significa "exercício
concluído, aguardando o avanço para o próximo". Com `status = 'completed'`, o
treino inteiro terminou.

### 3.3 Fluxo de um exercício por tempo (3 séries · 40s · 30s)

```text
set 1: work[0–40) → rest[40–70) → set 2: work[70–110) → rest[110–140)
      → set 3: work[140–180) → conclui exercício (sem descanso após a última série)
```

> Os treinos A e B do MVP usam **exclusivamente** a modalidade por tempo
> (3 séries · 40s de atividade · 20s ou 30s de descanso). O descanso varia por
> exercício; o exemplo acima usa 30s.

### 3.4 Fluxo de um exercício por repetições (3 séries · 12 reps · 60s)

```text
set 1: work (aguarda) → completeSet() → rest 60s → set 2: work (aguarda)
      → completeSet() → rest 60s → set 3: work → completeSet() → conclui exercício
```

### 3.5 Transições intermediárias

Se a última série terminar e **não** for o último exercício, a sessão fica em
`currentPhase = 'completed'` aguardando `advanceExercise()`. Se for o último
exercício, o treino é concluído automaticamente (`status = 'completed'`).

## 4. Operações do motor

| Operação                                   | Descrição                                             |
| ------------------------------------------ | ----------------------------------------------------- |
| `startWorkout(workout, { now, id })`       | Cria a sessão e inicia a 1ª série.                    |
| `tick(session, workout, now)`              | Reconcilia/avança o estado até `now`.                 |
| `completeSet(session, workout, now, opts)` | Conclui a série atual (reps; também encerra timed).   |
| `pauseWorkout(session, now)`               | Pausa congelando o tempo restante.                    |
| `resumeWorkout(session, now)`              | Retoma com novas referências de tempo.                |
| `skipRest(session, workout, now)`          | Pula o descanso e inicia a próxima série.             |
| `extendRest(session, now, seconds)`        | Estende o descanso atual.                             |
| `advanceExercise(session, workout, now)`   | Avança para o próximo exercício (preserva o progresso).|
| `goToPreviousExercise(session, workout, now)` | Volta ao exercício anterior (preserva o progresso). |
| `restartExercise(session, workout, now)`   | Reinicia o exercício atual (deliberado; zera suas séries). |
| `finishWorkout(session, now)`              | Finaliza o treino.                                    |
| `abandonWorkout(session, now)`             | Abandona o treino.                                    |

Todas devolvem `{ session, events }`. Operações inválidas para o estado atual
lançam `WorkoutEngineError` (ex.: `extendRest` fora do descanso,
`advanceExercise` no último exercício). O `index.ts` do domínio exporta tudo.

**Navegar não é reiniciar.** `advanceExercise` e `goToPreviousExercise` apenas
movem o cursor do exercício atual: as séries já concluídas **nunca** são
apagadas pela navegação. Ao voltar a um exercício:

- se ele já foi concluído, ele é exibido como concluído, com suas séries
  intactas;
- caso contrário, a sessão retoma a partir da próxima série não concluída
  (`currentSet = completedSets + 1`).

Reiniciar deliberadamente um exercício (apagando suas séries) é uma operação
**separada** — `restartExercise` — e exige uma ação explícita do usuário.

Serviço (persistência + orquestração): `startWorkoutSession`,
`recoverWorkoutSession`, `persistSession`, `getActiveSession`, `getSessionById`,
`getSessionHistory`.

### 4.1 Eventos

Cada operação devolve os eventos ocorridos (`workout-started`, `set-started`,
`set-completed`, `rest-started`, `rest-ended`, `rest-extended`,
`exercise-completed`, `workout-completed`, `workout-paused`, `workout-resumed`,
`workout-abandoned`). A futura interface reage a eles (áudio, animação).

## 5. Temporizador (timestamps reais)

O motor **não** usa `setInterval` como fonte de verdade. As referências são:

- `phaseStartedAt` e `phaseEndsAt` — limites da etapa atual;
- horário atual (`now`), passado explicitamente a cada operação.

O tempo restante é derivado (`getRemainingTime`): `ceil((phaseEndsAt − now)/1000)`
quando ativa, ou o valor congelado quando pausada.

`tick` percorre as etapas já vencidas **usando o término real de cada uma** como
instante da transição seguinte. Exemplo: fechar o app durante o exercício e
reabrir 50s depois produz `phaseStartedAt` do descanso em t=40 (e não em t=50).

`tick` é **idempotente**: com o mesmo `now` devolve o mesmo estado; sem
transições devolve a **mesma referência** de sessão. Por isso a interface pode
usar um intervalo apenas para atualização visual sem gerar gravações a cada
segundo.

## 6. Pausa e retomada

**Decisão de produto: o tempo é congelado durante a pausa.**

- `pauseWorkout` calcula o tempo restante exato e o guarda em `remainingTime`;
  registra `pausedAt`.
- `tick` sobre uma sessão pausada é no-op.
- `resumeWorkout` acumula `totalPausedMs`, cria novas referências
  (`phaseStartedAt = now`, `phaseEndsAt = now + remainingTime`) e continua do
  mesmo ponto — sem reiniciar a série.

Funciona tanto durante o exercício quanto durante o descanso. Uma série de 30s
pausada com 12s restantes volta com 12s.

## 7. Ajuste do descanso

**Decisão de produto: é permitido estender o descanso.**

- `extendRest(session, now, seconds)` é válido **apenas** na etapa `rest`.
- Acrescenta `seconds` ao `phaseEndsAt` e recalcula `remainingTime`.
- Extensões sucessivas acumulam (ex.: +10 e depois +15).
- Estender durante o exercício lança `WorkoutEngineError`.
- A interface oferece +10s e +15s.

## 8. Persistência (IndexedDB)

`workoutRepository.ts` encapsula IndexedDB (sem bibliotecas externas).

- **Banco:** `calisthenics-app`, versão `1`, store `workoutSessions`
  (`keyPath: 'id'`), índices `status`, `startedAt`, `finishedAt`.
- **Migração:** ponto único `upgradeDatabase(database, transaction, oldVersion)`,
  aplicado conforme a versão anterior — permite evoluir o esquema
  (`if (oldVersion < 2) { ... }`).
- **Operações:** `saveSession`, `getSession`, `listSessions`,
  `listCompletedSessions`, `getActiveSession`, `deleteSession`, `clearSessions`.

Escolha por **não** usar Dexie: evita uma dependência adicional, mantém o bundle
enxuto e o esquema é simples o bastante para a `indexedDB` nativa com um pequeno
wrapper de Promises. A interface (`workoutRepository`) isola o restante do
código dessa escolha.

Quando salvar (via `workoutService`/hook) — nunca a cada segundo:

- ao iniciar, mudar de exercício/série/etapa, pausar, retomar, estender descanso,
  finalizar e abandonar;
- durante o andamento, apenas quando `tick` produz transições reais.

## 9. Recuperação de sessões

`recoverWorkoutSession(now = Date.now())`:

1. Busca a sessão `active`/`paused` mais recente.
2. Aplica `tick` até o horário atual, reconstruindo o progresso transcorrido.
3. Persiste, se algo mudou.

- **Pausada:** devolvida exatamente como salva, com o tempo congelado.
- **Ativa:** o tempo decorrido é recalculado; múltiplas etapas são reconciliadas
  até a etapa atual ou até a conclusão do exercício.
- **Treino inteiro terminado durante a ausência:** a última série conclui o
  treino e a sessão é marcada como `completed`.
- **Idempotente:** repetir a recuperação não duplica séries nem transições.

> A interface **não** deve reproduzir avisos sonoros para os eventos devolvidos
> pela recuperação: são históricos ("não reproduzir avisos atrasados").

## 10. Como a futura interface deve consumir

Iniciar:

```ts
import { startWorkoutSession, recoverWorkoutSession } from '../../services/workoutService'

// Ao abrir a tela de execução:
const recovered = await recoverWorkoutSession()
const { session } = recovered ?? (await startWorkoutSession('A'))

// Reagir a uma sessão recuperada sem tocar áudio:
if (recovered) console.info('Progresso reconciliado', recovered.session.currentPhase)
```

Renderizar e interagir (hook):

```ts
import { useWorkoutSession } from '../../features/workouts'

const {
  snapshot,        // exercício/serie/etapa/tempo/progresso/flags (canPause, ...)
  pause, resume, skipRest, extendRest,
  completeSet, advanceExercise, goToPreviousExercise, restartExercise,
  finishWorkout, abandonWorkout,
} = useWorkoutSession({
  workout,
  initialSession: session,
  onEvents: (events) => playAudioFor(events), // áudio fica na UI
})
```

O `snapshot` (de `getSessionSnapshot`) entrega: exercício atual, série atual,
total de séries, etapa, tempo restante, progresso do exercício e do treino,
próximo exercício e as permissões (`canPause`, `canResume`, `canSkipRest`,
`canExtendRest`, `canCompleteSet`, `canAdvance`, `canGoBack`).

Áudio e Wake Lock **não** fazem parte do motor: pertencem à camada de
apresentação, reagindo aos eventos.

## 11. Testes automatizados

```bash
npm test          # executa uma vez
npm run test:watch
```

Cobertura (121 testes, Vitest com relógio simulado — sem esperas reais):

- **Temporizador:** início/fim de exercício, início/fim de descanso, próxima
  série, conclusão da última série, ausência de descanso após a última série.
- **Catálogo (treinos A/B):** todos os exercícios por tempo (3 séries · 40s ·
  descanso de 20s ou 30s), ausência de repetições, execução dos treinos reais
  ponta a ponta e duração real igual à estimada.
- **Pausa:** durante exercício e descanso, congelamento do tempo, retomada com o
  mesmo tempo restante.
- **Descanso:** +10s, +15s, extensões sucessivas, bloqueio durante o exercício.
- **Repetições:** registrar série, iniciar descanso, avançar de série, finalizar.
- **Navegação:** avançar/voltar exercício preservando as séries concluídas,
  retorno ao exercício em andamento, consistência do estado após navegações e
  reinício explícito (`restartExercise`) do exercício atual.
- **Finalizar/abandonar.**
- **Persistência:** salvar, recuperar ativa/pausada, histórico, remoção.
- **Interrupções:** app fechado durante exercício e descanso, passagem por
  múltiplas etapas, reconciliação idempotente.

A persistência é testada em Node com `fake-indexeddb` (dependência de
desenvolvimento); o motor não precisa de navegador.

## 12. Limitações conhecidas

> Evolução: a interface de execução (Workout Mode), o áudio, o Wake Lock e a
> integração da Home/Histórico com o IndexedDB foram implementados na Tarefa 03 —
> ver [`docs/04-workout-mode-implementation.md`](04-workout-mode-implementation.md).
> As limitações abaixo refletem o estado ao final da Tarefa 02.

- Sem interface visual de execução (Workout Mode) — tarefa seguinte.
- Sem áudio, `SpeechSynthesis`, Wake Lock ou notificações.
- Sem exportação/importação de dados.
- A Home ainda usa dados ilustrativos; o Histórico ainda não está ligado às
  sessões persistidas (o serviço já expõe `getSessionHistory`).
- `getActiveSession` assume uma sessão em andamento por vez (suficiente para uso
  pessoal).
- A navegação preserva as séries concluídas; reiniciar um exercício exige a ação
  explícita `restartExercise`.

## 13. Execução

```bash
npm install --include=dev
npm run dev        # http://localhost:5173/calisthenics-app/
npm test           # testes do motor
npm run typecheck  # tipos
npm run lint
npm run build      # build de produção
```
