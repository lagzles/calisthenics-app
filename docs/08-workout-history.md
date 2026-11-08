# Calisthenics App — Histórico de Treinos e Calendário Mensal

**Versão:** 1.0
**Status:** Implementado na branch `feature/workout-history`
**Base:** [`docs/03-workout-engine.md`](03-workout-engine.md) e
[`docs/04-workout-mode-implementation.md`](04-workout-mode-implementation.md)

> **Nota sobre a numeração:** o diretório `docs/` já possuía o arquivo
> `07-panda-personal-trainer-implementation.md`. Para não duplicar o número 07,
> este documento foi criado como `08`, preservando a ordem cronológica da
> documentação.

## 1. Objetivo

O Histórico passou a apresentar um **calendário mensal** com os dias em que o
usuário concluiu treinos, além de três indicadores de evolução (total de
treinos, sequência atual e treinos no mês) e dos detalhes de cada sessão do dia
selecionado.

O princípio central é que o histórico representa **fielmente os treinos
realmente concluídos**. Nenhum sistema paralelo de execução ou registro foi
criado: a funcionalidade lê os registros produzidos pelo Workout Engine e
persistidos no IndexedDB.

## 2. Arquitetura

```text
Workout Engine (domain/)
  └─ status = 'completed' + finishedAt
        │
        ├─ workoutService / useWorkoutSession ──► IndexedDB (workoutSessions, schema v1)
        │                                              │
        └──────────────────────────────────────────────┘
                                                       │
                              useHistoryData (somente concluídas)
                                                       │
                              historyCalendar (funções puras)
                                 │
                 ┌───────────────┼────────────────┐
                 ▼               ▼                ▼
          Indicadores      HistoryCalendar   HistoryDaySessions
          (Stat)           (grade mensal)    (sessões do dia)
```

Camadas:

| Camada | Arquivo | Responsabilidade |
| --- | --- | --- |
| Domínio puro | `src/features/workouts/historyCalendar.ts` | Chaves de data local, grade mensal, agrupamento por dia, sequência e contagens. Sem React, DOM ou IndexedDB. |
| Dados | `src/features/workouts/hooks/useHistoryData.ts` | Carrega `listCompletedSessions()` do IndexedDB. |
| Página | `src/pages/History/HistoryPage.tsx` | Estado do mês e do dia selecionado; compõe os indicadores. |
| Apresentação | `HistoryCalendar.tsx` / `HistoryDaySessions.tsx` | Grade do calendário e detalhes das sessões. |

O motor (`domain/workoutEngine.ts`) e o repositório
(`data/workoutRepository.ts`) **não foram modificados**.

## 3. Modelo de dados

Nenhuma estrutura nova foi necessária. O histórico reutiliza o modelo
`WorkoutSession` já publicado e persistido no schema **v1**:

```ts
interface WorkoutSession {
  id: string
  workoutId: string
  workoutName: string
  status: 'active' | 'paused' | 'completed' | 'abandoned'
  startedAt: string            // ISO (UTC)
  finishedAt: string | null    // ISO (UTC) — preenchido na conclusão
  duration: number             // segundos de treino efetivo (sem pausas)
  completedSets: number
  exercisesProgress: ExerciseProgress[]
}

interface ExerciseProgress {
  exerciseId: string
  completedSets: number
  sets: CompletedSet[]         // cada série concluída
  completed: boolean
  completedAt: string | null
  skippedSets?: number
}

interface CompletedSet {
  set: number
  completedAt: string
  workSeconds?: number         // segundos efetivos (modalidade por tempo)
  actualRepetitions?: number   // repetições efetivas (modalidade por reps)
}
```

O que o histórico recupera de cada sessão:

| Informação | Origem |
| --- | --- |
| Identificador único | `session.id` |
| Data do treino | dia local de `finishedAt` |
| Horário de início/fim | `startedAt` / `finishedAt` |
| Duração total | `duration` |
| Treino (A ou B) | `workoutId` + `workoutName` |
| Exercícios realizados | `exercisesProgress[]` |
| Séries concluídas | `exercisesProgress[].completedSets` e `sets[]` |
| Resultados registrados | `sets[].workSeconds` / `sets[].actualRepetitions` |

### 3.1 Compatibilidade e migração

- O schema continua na **versão 1** (`calisthenics-app` → store
  `workoutSessions`), com os índices `status`, `startedAt` e `finishedAt`.
- **Não houve migração**: todos os campos necessários já existiam. Registros
  anteriores abrem e aparecem no calendário sem transformação.
- Registros antigos sem `finishedAt` (improvável, mas possível) usam
  `startedAt` como fallback do dia de calendário.
- Se uma evolução futura precisar de novos campos, o ponto único
  `upgradeDatabase(database, transaction, oldVersion)` já está preparado:
  incrementar `DB_VERSION` e adicionar o bloco `if (oldVersion < 2) { ... }`,
  sempre preservando os campos existentes.

## 4. Regras de negócio

1. **Somente sessões concluídas contam.** O critério oficial é
   `session.status === 'completed'`, definido pelo motor. Sessões `active`,
   `paused` ou `abandoned` são ignoradas pelo calendário, pelos indicadores e
   pela lista de detalhes.
2. **Treino cancelado/abandonado não é registrado.** Ao abandonar, o motor
   grava `status = 'abandoned'`; a consulta `listCompletedSessions()` já filtra
   apenas as concluídas.
3. **Registro único.** A sessão é gravada com `store.put(session)`, cujo
   `keyPath` é `id`. Salvar a mesma sessão várias vezes (re-renderizações,
   botão "Finalizar e salvar" repetido) **atualiza** o mesmo registro — nunca
   duplica. O motor também só conclui uma sessão uma vez.
4. **Conclusão oficial.** A sessão vira `completed` quando a última série do
   último exercício termina (`completeCurrentExercise` → `completeSession`) ou
   quando o fluxo de finalização é acionado. O estado é reconciliado por
   `tick()` com timestamps reais, inclusive após o app ficar fechado.

## 5. Calendário mensal

### 5.1 Datas locais

Timestamps da sessão são ISO em UTC. O dia do calendário é sempre calculado com
`getFullYear()`, `getMonth()` e `getDate()` (hora local):

```ts
function toLocalDateKey(value: Date | string | number): string | null {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}
```

Assim, um treino concluído às **23h50** pertence ao dia local em que terminou; a
conversão UTC (`toISOString()`) nunca é usada para decidir o dia.

### 5.2 Grade

- Semana começa na **segunda-feira** (`(primeiroDia.getDay() + 6) % 7`), o
  mesmo padrão usado no resumo semanal da Home.
- Dias do mês: `new Date(ano, mês + 1, 0).getDate()` — trata automaticamente
  meses de 28/29/30/31 dias e **anos bissextos**.
- Posições antes do dia 1 e depois do último dia são preenchidas com `null` para
  manter sete colunas alinhadas.
- O mês é um `{ year, month }` (mês 0-based) e a navegação usa
  `new Date(ano, mês + delta, 1)`, atravessando a **virada de ano** sem
  aritmética manual de 12 meses.

### 5.3 Indicadores visuais

| Estado | Aparência |
| --- | --- |
| Dia com ao menos um treino concluído | Fundo/borda verdes (`--color-primary`) e ponto indicador. |
| Dia sem treino | Superfície neutra (`--color-surface-2`), texto esmaecido. |
| Dia atual | Anel de destaque independente do verde, visível também em dias sem treino. |
| Dia selecionado | Borda verde com anel externo. |

A navegação (mês anterior/próximo) é estado local do React — **sem recarregar a
aplicação**. Ao trocar de mês, o dia mais recente com treino daquele mês é
selecionado automaticamente (quando existir).

## 6. Indicadores de evolução

Acima do calendário, três `Stat` derivados exclusivamente das sessões
concluídas:

### 6.1 Total de treinos

Quantidade de sessões com `status === 'completed'`.

### 6.2 Sequência atual

Dias consecutivos com pelo menos um treino concluído:

```text
1. Monta o conjunto de dias locais das sessões concluídas, ignorando datas > hoje.
2. Cada dia conta uma única vez (duas sessões no mesmo dia não somam dois dias).
3. Se hoje tem treino, começa em hoje; caso contrário, começa em ontem.
4. Se nem hoje nem ontem têm treino, a sequência é 0.
5. Conta para trás enquanto o dia anterior também tiver treino.
```

Consequências:

- treinar ontem mantém a sequência viva durante o dia de hoje;
- um dia sem treino interrompe a contagem;
- dias futuros são ignorados;
- a contagem atravessa meses e anos (inclusive 29 de fevereiro).

### 6.3 Treinos no mês

Número de sessões concluídas cujo dia local pertence ao mês atualmente
selecionado no calendário. Treinos no mesmo dia contam individualmente.

## 7. Detalhes do dia selecionado

`HistoryDaySessions` lista **todas** as sessões concluídas do dia,
individualmente, em ordem cronológica. Cada sessão mostra:

- nome do treino e identificador (A/B);
- horário de início e de conclusão;
- duração total;
- total de séries;
- lista de exercícios com séries concluídas/total;
- cada série com o resultado registrado (`40s`, ou repetições quando houver);
- séries puladas, quando registradas.

Dias sem treino exibem uma mensagem simples, com o Panda em tamanho pequeno
(`sm`) para incentivo — sem ocupar espaço excessivo. Ao navegar para um mês sem
nenhuma sessão, a mensagem é específica do mês.

Os nomes dos exercícios vêm do catálogo atual (`getWorkoutById`); se o catálogo
mudar ou um exercício deixar de existir, o detalhe exibe o `exerciseId`
registrado em vez de inventar dados.

## 8. Interface e identidade visual

- Componentes existentes reutilizados: `PageHeader`, `Card`, `Stat`,
  `PandaMascot` e ícones.
- Design tokens (`tokens.css`), dark mode e tipografia do app.
- Mobile-first: conteúdo com largura máxima de 640px, alvos de toque de 42px,
  sete colunas com espaçamento reduzido em telas estreitas.
- Estados vazios amigáveis e legenda do calendário (treino concluído, sem
  treino, hoje).
- Acessibilidade: dias são botões com `aria-label` completo (data + quantidade
  de treinos), `aria-pressed` para seleção e `aria-current="date"` para hoje;
  o rótulo do mês usa `aria-live="polite"`.

## 9. Persistência e offline

- Leitura via `listCompletedSessions()` (IndexedDB nativo, sem biblioteca
  externa).
- Nenhuma chamada de rede, nenhum backend, nenhuma sincronização.
- O histórico continua disponível após fechar/reabrir o navegador, atualizar a
  página ou reiniciar o dispositivo, porque vive no IndexedDB local.
- O bundle do calendário entra no precache do Service Worker (PWA) e a rota
  `#/historico` continua funcionando offline.
- Limpar os dados do site apaga o histórico — não há cópia remota.

## 10. Testes

### 10.1 Lógica pura — `historyCalendar.test.ts` (31 testes)

| Cenário | Cobertura |
| --- | --- |
| Datas locais | Conclusão às 23h50 e 00h10 em dias diferentes; `toISOString` não decide o dia. |
| Datas inválidas | Chaves malformadas e datas inexistentes (`2026-02-29`). |
| Navegação | Mês anterior/próximo, virada de ano (`dez/2025 ↔ jan/2026`, `+13` meses). |
| Fevereiro bissexto | 2024 com 29 dias; 2026 com 28; alinhamento da segunda-feira. |
| Virada de ano na grade | Dezembro/2026 e janeiro/2027 com 31 dias cada. |
| Sessões por dia | Múltiplas sessões no mesmo dia, ordenadas; abandonadas/ativas/pausadas excluídas. |
| Registros antigos | Sessão concluída sem `finishedAt` usa `startedAt`. |
| Sequência | Hoje, ontem, lacunas, duplicidade no mesmo dia, futuro ignorado, virada de ano e 29/02. |
| Indicadores | Total, mês e sequência combinados, sem sessões incompletas. |

### 10.2 Integração com motor + IndexedDB — `historyPersistence.test.ts` (8 testes)

| Cenário | Cobertura |
| --- | --- |
| Registro real | Treino executado pelo motor até `completed` é salvo e aparece no dia correto. |
| Cancelamento | Treino abandonado **não** aparece no histórico. |
| Apenas iniciado/pausado | Sessões `active`/`paused` não são contabilizadas. |
| Sem duplicidade | Salvar a mesma sessão três vezes mantém um único registro. |
| Múltiplos no mesmo dia | Duas sessões no mesmo dia e uma no seguinte, agrupadas corretamente. |
| Meia-noite | Treinos a 23h59 e 00h01 caem em dias diferentes; sequência = 2. |
| Reinício | `closeDatabase()` e nova leitura recuperam o histórico (fake-indexeddb). |
| Compatibilidade | Registro no formato v1 já publicado é lido e contabilizado. |

### 10.3 Regressão e build

| Verificação | Comando | Resultado |
| --- | --- | --- |
| Suíte completa | `npm test` | **261 aprovados** (25 arquivos) |
| Tipos | `npm run typecheck` | sem erros |
| Lint | `npm run lint` | sem erros |
| Build | `npm run build` | sucesso (PWA precache: 15 entradas) |

O Workout Engine, os seletores, o áudio, o Wake Lock e o Panda não sofreram
alterações; os testes existentes continuam passando.

### 10.4 Verificação visual

Build de produção servido por `npm run preview` e inspecionado com
`agent-browser` (390×844 e 1280×900), com 5 sessões concluídas semeadas no
IndexedDB:

| Verificação | Resultado |
| --- | --- |
| Indicadores | 5 treinos no total · sequência de 3 dias · 5 treinos em novembro |
| Calendário | Dias 2, 5, 6 e 7 verdes; dia 7 selecionado; dia 7 com anel de "hoje" |
| Múltiplas sessões no dia | Dia 7 exibe "Corpo inteiro 07:10–07:35" e "Core e resistência 18:05–18:32", individualmente |
| Detalhes | 5 exercícios por sessão, 3/3 séries e resultados "40s" por série |
| Dia sem treino | Dia 4 exibe "Nenhum treino concluído neste dia" com incentivo do Panda |
| Navegação | Outubro/2026 (0 no mês), Dezembro/2026, Janeiro/2027 — sem recarregar |
| Virada de ano | Novembro/2026 → Dezembro/2026 → Janeiro/2027 |
| Mês vazio | "Nenhum treino em Janeiro de 2027" |
| Responsivo | Três indicadores lado a lado em 390px; conteúdo centralizado em 1280px |
| Runtime | Nenhum erro de console ou de página |

## 11. Decisões técnicas

1. **Reutilizar o schema v1.** Todos os dados exigidos já eram registrados
   (`startedAt`, `finishedAt`, `duration`, `exercisesProgress[].sets[]`). Criar
   outra store ou duplicar registros violaria o princípio de fonte única.
2. **`finishedAt` define o dia do calendário.** É o instante oficial de
   conclusão. Um treino que atravessa a meia-noite aparece no dia em que
   terminou; o fallback para `startedAt` cobre registros antigos.
3. **Agrupamento no cliente.** O histórico é pessoal e pequeno; carregar as
   sessões concluídas e agrupar por dia local em memória é simples e evita
   índices adicionais no IndexedDB.
4. **Funções puras no domínio.** `historyCalendar.ts` não conhece React nem
   IndexedDB, o que permite testar todos os casos de data/sequência sem
   navegador e sem esperas.
5. **Sem sistema paralelo de registro.** A página apenas lê
   `status === 'completed'`; não cria, finaliza ou contabiliza treinos por conta
   própria.
6. **`put` por `id` como garantia de idempotência.** Re-renderizações e o
   duplo salvamento da tela de conclusão não geram duplicidade.

## 12. Como consultar e evoluir

### 12.1 Consultar no código

```ts
import {
  buildHistoryIndicators,
  countSessionsInMonth,
  groupSessionsByDate,
  sessionDateKey,
  toLocalDateKey,
} from '../features/workouts/historyCalendar'

const sessions = await listCompletedSessions()
const todayKey = toLocalDateKey(new Date()) as string
const byDay = groupSessionsByDate(sessions)

byDay.get(todayKey)                       // sessões concluídas de hoje
countSessionsInMonth(sessions, { year: 2026, month: 10 })
buildHistoryIndicators(sessions, { year: 2026, month: 10 }, todayKey)
```

### 12.2 Evoluir o modelo de dados

1. Incrementar `DB_VERSION` em `workoutRepository.ts`.
2. Adicionar o bloco `if (oldVersion < 2)` em `upgradeDatabase`, criando índices
   ou preenchendo campos **sem remover/renomear** os existentes.
3. Adicionar o novo campo como **opcional** em `WorkoutSession` (ou derivável),
   para que registros antigos continuem válidos.
4. Estender os testes de `historyPersistence.test.ts` com um registro no formato
   anterior e outro no novo.
5. Manter a regra `status === 'completed'` como única porta de entrada do
   histórico.

### 12.3 Possíveis evoluções

- Guardar um snapshot de `exerciseName` na sessão para preservar os nomes mesmo
  se o catálogo mudar (hoje o fallback é o `exerciseId`).
- Exportar/importar o histórico manualmente (arquivo local).
- Filtro por treino A/B ou por período, mantendo as mesmas funções puras.
- Meta semanal/sequência recorde como indicadores adicionais.

## 13. Limitações

- O histórico é **local ao dispositivo**; limpar os dados do site apaga os
  registros.
- O dia do treino é o dia local de conclusão; sessões que atravessam a
  meia-noite aparecem no dia de término.
- Os nomes dos exercícios vêm do catálogo atual; exercícios removidos do
  catálogo aparecem pelo identificador.
- Todas as sessões concluídas são carregadas de uma vez — adequado ao uso
  pessoal, mas não pensado para históricos enormes.
- O hero/indicadores são recalculados ao montar a tela; não há atualização em
  tempo real enquanto a página permanece aberta durante um treino (o fluxo
  normal navega para o Histórico após a conclusão).

## 14. Arquivos criados e modificados

**Criados**

| Arquivo | Papel |
| --- | --- |
| `src/features/workouts/historyCalendar.ts` | Datas locais, grade, agrupamento, sequência e indicadores (puro). |
| `src/features/workouts/historyCalendar.test.ts` | 31 testes de calendário, datas e sequência. |
| `src/features/workouts/historyPersistence.test.ts` | 8 testes de integração com motor e IndexedDB. |
| `src/pages/History/HistoryCalendar.tsx` (+ `.module.css`) | Calendário mensal, navegação e legenda. |
| `src/pages/History/HistoryDaySessions.tsx` (+ `.module.css`) | Detalhes do dia e das sessões. |
| `docs/08-workout-history.md` | Esta documentação. |

**Modificados**

| Arquivo | Mudança |
| --- | --- |
| `src/pages/History/HistoryPage.tsx` (+ `.module.css`) | Nova composição: indicadores, calendário e detalhes. |
| `src/features/workouts/hooks/useHistoryData.ts` | Expõe as sessões concluídas carregadas do IndexedDB. |
| `src/features/workouts/index.ts` | Exporta `historyCalendar`. |
| `src/utils/format.ts` | Adiciona `formatTime` (horário local). |
| `README.md` | Funcionalidade e link para esta documentação. |

**Não modificados:** Workout Engine, transições, seletores, repositório,
schema do IndexedDB, áudio, Wake Lock e Panda.
