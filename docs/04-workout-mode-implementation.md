# Calisthenics App — Workout Mode (Tarefas 03 e 04)

**Versão:** 1.2  
**Status:** Execução do treino implementada (Tarefa 03), refinada (Tarefa 04:
preparação, controles e ilustrações) e com o Wake Lock robustecido (Tarefa 05:
estado observável, aviso na interface e exigência de contexto seguro)  
**Base:** [`docs/00-architecture-decision.md`](00-architecture-decision.md),
[`docs/01-UI-UXi-specification.md`](01-UI-UXi-specification.md),
[`docs/02-initial-implementation.md`](02-initial-implementation.md) e
[`docs/03-workout-engine.md`](03-workout-engine.md)

Esta tarefa conecta a interface à infraestrutura já existente, transformando o
motor de treino em um aplicativo utilizável no celular: Workout Mode, áudio,
Wake Lock e integração da Home e do Histórico com os dados reais.

> **Nada do Workout Engine foi reescrito.** A interface apenas consome
> `useWorkoutSession`, `workoutService` e os seletores do domínio. Nenhuma regra
> de temporizador foi duplicada na camada visual.

**Decisão de produto (atualização).** *Todos os exercícios disponibilizados no
MVP serão executados por tempo, com 40 segundos de atividade, três séries e
descansos configuráveis de 20 ou 30 segundos. Não haverá exercícios por
repetições nos treinos A e B.* A configuração vive em `workouts.data.ts`
(catálogo) e a apresentação foi ajustada para exibir **3 séries · 40s** e o
descanso (20s/30s), sem qualquer referência a repetições. O suporte genérico a
`reps` permanece no motor e nos seletores, mas **não há fluxo de repetições nos
treinos disponíveis no MVP**.

## 1. Visão geral

```text
Home / Treinos ──► /treino/:workoutId  (Workout Mode, fora do AppLayout)
                        │
                        ├─ recoverWorkoutSession() ──► retoma sessão em andamento
                        ├─ startWorkoutSession()   ──► inicia nova sessão
                        │
                        └─ ActiveWorkout (useWorkoutSession)
                              ├─ TimerScreen   (verde = exercício, âmbar = descanso)
                              ├─ ExerciseListView (lista completa + estados)
                              ├─ ExerciseDetailView (consulta, somente leitura)
                              ├─ CompletionScreen (resumo + salvar)
                              └─ AbandonDialog (continuar / manter / descartar)

Áudio  ◄── eventos do motor (onEvents)
Wake Lock ◄── status da sessão (ativo/pausado/concluído)
```

## 2. Estrutura do Workout Mode

### 2.1 Rota dedicada

- Rota: `#/treino/:workoutId` — declarada em `src/App.tsx` **fora** do
  `AppLayout`, portanto sem navegação inferior.
- É uma interface independente: a barra inferior some durante a execução.
- Recupera automaticamente uma sessão em andamento ao ser aberta
  (`recoverWorkoutSession`). Se não houver, inicia o treino da rota.
- A sessão recuperada é reconciliada pelo motor (timestamps reais); **os eventos
  históricos não disparam áudio**.

Arquivos:

| Arquivo | Papel |
| --- | --- |
| `src/pages/WorkoutMode/WorkoutModePage.tsx` | Carrega/recupera a sessão e trata erro/ausência. |
| `src/pages/WorkoutMode/ActiveWorkout.tsx` | Experiência de execução (timer, lista, detalhe, conclusão, abandono). |
| `src/pages/WorkoutMode/WorkoutMode.module.css` | Estilos (dark, mobile-first, verde/âmbar). |

### 2.2 Lista completa de exercícios

Cada item mostra número, nome, séries concluídas/total, o alvo (`3 séries · 40s`)
e o **estado atual** (`Pendente`, `Em execução`, `Em descanso`, `Concluído`). Tocar em
um item abre a **consulta** do exercício (somente leitura) — instruções, erros
comuns e adaptações — sem alterar o progresso. O botão "Continuar treino"
retorna ao exercício atual.

O estado é derivado por `getExerciseListState(session, index)` (função pura,
testada); não há estado paralelo na interface.

### 2.3 Visualização individual

Prioriza leitura rápida durante o exercício:

- Identificação da etapa (`EXERCÍCIO` / `DESCANSO` / `CONCLUÍDO`).
- Nome e número do exercício, ilustração (emoji).
- Contagem regressiva grande (40s de atividade; 20s/30s no descanso).
- `SÉRIE x DE y · EXERCÍCIO n DE m`, barra de progresso do exercício.
- Mensagem contextual (ex.: "Recupere e prepare-se para a série 2.").
- Controles grandes, com poucas distrações.

### 2.4 Controles

| Controle | Ação | Operação do motor |
| --- | --- | --- |
| Pausar / Retomar | congela/retoma o tempo | `pauseWorkout` / `resumeWorkout` |
| +10s / +15s | estende o descanso | `extendRest(10)` / `extendRest(15)` |
| Pular descanso | inicia a próxima série | `skipRest` |
| Pular série | encerra a série atual (por tempo) | `completeSet` |
| Concluir série | registra a série (por repetições; modalidade fora do MVP) | `completeSet` |
| Anterior | consulta/volta ao exercício anterior | `goToPreviousExercise` |
| Próximo | avança para o próximo exercício | `advanceExercise` |
| Sair | abre o diálogo de abandono | — |

### 2.5 Abandono

Diálogo com três opções:

- **Continuar treinando** — fecha o diálogo.
- **Sair e manter incompleto** — pausa e persiste a sessão (recuperável); ela
  **não** entra no histórico (somente `completed` conta).
- **Descartar sessão** — remove o registro do IndexedDB (`discardSession`).

### 2.6 Finalização

Quando a última série do último exercício termina, o motor conclui a sessão
automaticamente (`status = 'completed'`). A interface então exibe a tela de
conclusão: mensagem de sucesso, nome do treino, duração total, exercícios
concluídos, séries concluídas e data/hora. O botão **"Finalizar e salvar treino"**
persiste a sessão e leva ao Histórico, com proteção contra toques repetidos
(flag em `useRef` + botão desabilitado durante o salvamento).

## 3. Integração com o Workout Engine

A ponte é o hook `useWorkoutSession` (já existente, não modificado). O Workout
Mode:

- renderiza a partir de `snapshot` (`getSessionSnapshot`);
- usa `canPause`, `canResume`, `canSkipRest`, `canExtendRest`, `canCompleteSet`,
  `canAdvance`, `canGoBack` para habilitar/desabilitar controles;
- persiste por transição real (o hook já evita gravações por segundo).

Uma adição no domínio (pura, sem alterar o motor) foi criada para manter a
interface "burra":

- `src/features/workouts/sessionView.ts` — tom/label da fase, estado visual de
  cada exercício na lista, `formatTimer` e `buildTimerViewModel(snapshot)`.

O intervalo do hook continua sendo **apenas visual**; a fonte de verdade do tempo
é o motor (`tick` sobre timestamps reais).

## 4. Implementação de áudio

Camada isolada e substituível em `src/features/workouts/audio/`:

| Arquivo | Papel |
| --- | --- |
| `cues.ts` | Mapeia transições do motor em avisos (`AudioCue`) + mensagens + regras de reprodução. |
| `speechPlayer.ts` | Interface `AudioPlayer` + implementação com `SpeechSynthesis` (voz em inglês quando disponível) e fallback silencioso. |
| `workoutAudio.ts` | Orquestrador: eventos → avisos → reprodutor. |
| `../../services/audioService.ts` | Instância única (`getWorkoutAudio`) + `prepareWorkoutAudio()`. |

Mensagens:

| Transição | Mensagem |
| --- | --- |
| Fim do exercício (`rest-started`) | "Rest!" |
| Fim do descanso (`rest-ended`) | "Let's go!" |
| Fim da última série (`exercise-completed`) | "Exercise complete!" |
| Fim do treino (`workout-completed`) | "Workout complete!" |

Regras implementadas em `cuesForEvents`:

- **Sem duplicatas** — avisos iguais e consecutivos são fundidos.
- **Sem mensagens atrasadas** — eventos mais antigos que a janela (padrão 2s) são
  descartados; cobre a volta ao primeiro plano após o app ficar em segundo plano.
- **Fim do treino tem prioridade** — quando o treino termina, só "Workout
  complete!" é anunciado (o "Exercise complete!" da última série é suprimido para
  não sobrepor duas falas).
- **Navegação/pausa não geram áudio** — só transições reais de etapa e conclusão.
- **Não atrasa o temporizador** — a reprodução é assíncrona e nunca bloqueia o
  motor.

**Inicialização:** `prepareWorkoutAudio()` é chamado no clique de "Iniciar treino"
(Home, Treinos e Detalhes) — dentro do gesto do usuário — para contornar o
bloqueio de autoplay. Falhas são registradas (`console.warn`) e **não
interrompem o treino**; os indicadores visuais continuam funcionando.

A arquitetura permite trocar `SpeechSynthesis` por arquivos locais no futuro
(basta outra implementação de `AudioPlayer`), sem tocar no motor.

## 5. Implementação do Wake Lock

| Arquivo | Papel |
| --- | --- |
| `src/hooks/wakeLock.ts` | Controlador puro sobre `navigator.wakeLock` (nunca lança; detecta revogação; expõe estado e helpers). |
| `src/hooks/useWakeLock.ts` | Hook: solicita/libera conforme o status, reativa ao voltar ao primeiro plano e observa a revogação. |

- **Solicita** ao iniciar e ao retomar; **mantém** durante exercício, descanso e
  transições.
- **Libera** ao pausar, finalizar, abandonar e ao desmontar a tela.
- **Reativa** em `visibilitychange` quando a sessão está ativa e a página volta a
  ficar visível (`shouldReacquire`).
- **Detecção de revogação**: o controlador escuta o evento `release` do sentinel,
  notifica os assinantes (`subscribe`) e permite nova solicitação.
- **Sem suporte**: o controlador informa `supported = false` e o treino continua
  normalmente, sem bloquear nada.

### 5.1 Estado observável

`useWakeLock(enabled)` devolve `WakeLockState` com `status` e `secureContext`:

| `status` | Significado | Aviso na interface |
| --- | --- | --- |
| `active` | Bloqueio concedido e em vigor. | — |
| `inactive` | Suportado, mas não retido (treino pausado ou etapa sem bloqueio). | — |
| `unsupported` | API ausente — inclui **contexto não seguro** (HTTP por IP). | sim |
| `error` | A solicitação foi recusada (`request` rejeitou). | sim |

Nunca apresentamos sucesso quando o bloqueio não foi concedido: o estado só é
`active` após a Promise de `request()` resolver com o sentinel.

### 5.2 Exigência de contexto seguro (HTTPS)

A **Screen Wake Lock API só é exposta em contexto seguro** (`window.isSecureContext`).
Em HTTP puro — inclusive pelo **IP local da máquina** (`http://192.168.x.x:4173`) —
o navegador **não define `navigator.wakeLock`**, então `getWakeLockApi()` devolve
`null` e o estado é `unsupported`. Isso é comportamento do navegador, não um bug
da implementação. Para o bloqueio funcionar, sirva o app por **HTTPS** ou por
**localhost**. Quando o contexto não é seguro, o aviso orienta a abrir o app por
um endereço seguro (`wakeLockWarning`).

## 6. Integração da Home e do Histórico

### 6.1 Dados

- `src/features/workouts/sessionSummary.ts` (puro): `buildHomeSummary`,
  `buildHistorySummary`, `toSessionListItem(s)`, `isSameWeek`,
  `startOfWeekMonday`, `findLastCompletedSession`.
- `src/features/workouts/hooks/useHomeData.ts` e `useHistoryData.ts`: carregam as
  sessões concluídas do IndexedDB e derivam os números.
- **Só sessões concluídas contam.** Sessões ativas, pausadas ou abandonadas nunca
  entram nos indicadores nem no histórico.

### 6.2 Home

Último treino realmente concluído, quantidade na semana, duração do último
treino, treino recomendado e quantidade real de treinos disponíveis. A regra de
recomendação foi preservada (`getRecommendedWorkoutId`): sem histórico → A;
último A → B; último B → A.

### 6.3 Histórico

Total de treinos concluídos, treinos na semana, tempo acumulado e lista de
sessões. Cada sessão mostra data, treino, duração, exercícios concluídos e
séries; ao expandir, exibe as séries exercício a exercício.

### 6.4 Mudança no código de base

- `src/features/workouts/data/homeFixtures.ts` foi **removido** (dados
  ilustrativos não são mais usados). `getHomeSummary()` e `getRecommendedWorkout()`
  (síncronos, baseados no fixture) foram removidos de `workoutService`.
- `workoutService` ganhou `discardSession(sessionId)`.
- Os botões "Iniciar treino" (Home, Treinos e Detalhes) foram habilitados e
  preparam o áudio antes de navegar.

## 7. Comportamento offline

- Nenhuma dependência de rede durante o treino: o áudio é **síntese de voz
  nativa** (sem assets remotos) e o Wake Lock é uma API do navegador.
- A nova rota entra no precache do Service Worker (workbox pré-cacheia HTML, CSS,
  JS, ícones e manifest; `navigateFallback` cobre as rotas do HashRouter).
- O IndexedDB continua acessível offline.

## 8. Testes executados

- **57 testes anteriores** preservados.
- **64 novos testes** (total **121**), em Vitest (ambiente `node`, sem navegador):

| Área | Arquivo | Cobertura |
| --- | --- | --- |
| Catálogo (treinos A/B) | `data/workouts.data.test.ts` | Todos os exercícios por tempo, 3 séries, 40s de atividade, descanso de 20s/30s conforme a tabela, ausência de repetições na interface, transição exercício↔descanso, ausência de descanso após a última série e duração real igual à estimada. |
| Áudio (mapeamento) | `audio/cues.test.ts` | Mensagens corretas, sem duplicatas, eventos atrasados ignorados, prioridade do fim do treino. |
| Áudio (orquestração) | `audio/workoutAudio.test.ts` | `prepare`, mensagens por transição, indisponibilidade tratada. |
| Áudio (reprodutor) | `audio/speechPlayer.test.ts` | Sem suporte, reprodução via síntese, falhas não propagam. |
| Wake Lock | `hooks/wakeLock.test.ts` | Solicitar ao iniciar, liberar ao pausar, solicitar ao retomar, reativação após revogação, ausência de suporte. |
| Apresentação/temporizador | `sessionView.test.ts` | Tom/label da fase, estados da lista, formatação do tempo, exercício/descanso/repetições/conclusão/pausa. |
| Home/Histórico | `sessionSummary.test.ts` | Sessões reais, exclusão de incompletas, recomendação após conclusão, totais e lista. |

```bash
npm test          # 121 testes
```

### Verificação funcional em navegador (390×844, Chrome headless)

Além dos testes automatizados, o fluxo foi exercitado em um navegador real com
o **build de produção** e o Service Worker ativo:

| Verificação | Resultado |
| --- | --- |
| Home (sem histórico) | recomenda A · "2 treinos disponíveis" · "0 de 4" |
| Iniciar treino pelo botão | abre `/treino/A` (sem navegação inferior) |
| Exercício por repetições | mostra alvo (12 repetições) e "Concluir série" |
| Exercício por tempo | contagem regressiva (0:29) com controles de série |
| Descanso | identidade âmbar + "+10s" e "+15s" |
| Extensão do descanso | 0:51 → +15s → 1:06 → +10s → 1:15 (acumula) |
| Pausa | "Pausado" + tempo congelado (1:06 → 1:06) |
| Retomada | continua do ponto exato (1:14 → 1:14) |
| Lista completa | estados Pendente / Em execução / Em descanso / Concluído |
| Diálogo de abandono | Continuar treinando / Sair e manter incompleto / Descartar sessão |
| Descarte | sessão removida; **não** aparece no histórico |
| Conclusão | "Treino concluído!" · duração · 5/5 exercícios · 15 séries · data/hora |
| Histórico | 1 concluído · 1 na semana · detalhe 3/3 séries por exercício |
| Home após concluir | último treino A · "1 de 4" · recomendação **B** |
| Cores do temporizador | exercício `rgb(47, 224, 107)`; descanso `rgb(255, 176, 32)` |
| Erros de runtime | nenhum (`console` e `page errors` vazios) |

> **Bug encontrado e corrigido nesta verificação:** o `completeSet` aceita
> `actualRepetitions?: number` e estava ligado diretamente ao `onClick` do botão
> "Concluir série". O React repassava o **evento de clique** como repetições,
> gravando um `PointerEvent` na sessão — o que tornava a sessão não clonável
> (`JSON.stringify` no `tick`) e não persistível (`DataCloneError` no
> IndexedDB), travando o temporizador no descanso. Correção: todos os handlers
> são invocados por wrappers (`() => handler()`) e o hook `useWorkoutSession`
> passou a aceitar apenas `number` em `actualRepetitions`. Esse defeito não
> aparecia nos testes unitários porque lá os argumentos são explícitos.

### Re-verificação após a padronização por tempo

Após tornar os treinos A e B **exclusivamente temporizados**, as telas foram
novamente conferidas no build de produção (390×844):

| Verificação | Resultado |
| --- | --- |
| Treino A — consulta | "14 min" · 5 exercícios · 15 séries · cada exercício "POR TEMPO · 3 SÉRIES · 40S" · descanso 30S/20S — **sem repetições** |
| Treino B — consulta | "15 min" · 5 exercícios · 15 séries · cada exercício "POR TEMPO · 3 SÉRIES · 40S" · descanso 20S/30S — **sem repetições** |
| Home / Treinos | duração estimada recalculada (A: 14 min · B: 15 min); sem repetições |
| Workout Mode — exercício | "EXERCÍCIO" (verde) · contagem de 40s (0:31) · "SÉRIE 1 DE 3" · sem alvo de repetições |
| Workout Mode — descanso | transição automática para "DESCANSO" (âmbar) · 0:24 · "+10s" / "+15s" |
| Lista completa (na execução) | cada exercício mostra "3 séries · 40s" e o estado atual |
| Histórico | tela carrega normalmente (estado vazio sem sessões) |
| Erros de runtime | nenhum (`console` vazio) |

> A tabela acima (verificação original da Tarefa 03) reflete o estado em que o
> treino A ainda tinha exercícios por repetições. A configuração **atual** —
> exclusivamente por tempo — é a registrada nesta re-verificação.


## 9. Limitações dos navegadores

- **Síntese de voz (`SpeechSynthesis`)**: qualidade e vozes variam por
  dispositivo. Se não houver voz em inglês, é usada a voz padrão. Requer um gesto
  do usuário para ser "desbloqueada" (tratado no clique de iniciar).
- **Screen Wake Lock**: suportada no Chrome/Edge/Android **apenas em contexto
  seguro** (HTTPS ou `localhost`). Em HTTP puro — inclusive pelo IP local da
  máquina — a API não é exposta e a tela **não** é mantida acesa. No iOS/Safari há
  suporte parcial e o bloqueio pode ser revogado com a tela apagada. Se não
  houver suporte (ou o contexto não for seguro), o treino continua e a tela pode
  apagar; a interface exibe um aviso discreto (§5.1).
- **Segundo plano**: navegadores podem pausar timers. Como o motor usa
  timestamps reais, o estado é reconciliado corretamente ao voltar; os avisos
  atrasados não são reproduzidos.
- **Autoplay**: o áudio só toca após a interação inicial.

## 10. Testes executados e resultados

| Verificação | Comando | Resultado |
| --- | --- | --- |
| Testes | `npm test` | 121 aprovados (57 + 64) |
| Tipos | `npm run typecheck` | sem erros |
| Lint | `npm run lint` | sem erros |
| Build | `npm run build` | sucesso (PWA precache: 15 entradas) |

## 11. Verificação visual

As telas foram construídas para viewports de smartphone (largura máxima de
conteúdo 640px, botões grandes, alvos ≥ 42px, `safe-area-inset`). A conferência
foi executada em Chrome headless com viewport 390×844, com capturas de tela e
leitura dos textos/cores de cada estado — resultados na seção
[§8](#verificação-funcional-em-navegador-390844-chrome-headless). Recomenda-se
uma última conferência no DevTools (modo dispositivo) e no aparelho, conforme
§12.

## 12. Como testar no Android

> **HTTPS é obrigatório para o Wake Lock.** O Chrome só expõe
> `navigator.wakeLock` em **contexto seguro**. Abrir o app pelo **endereço IP
> local em HTTP** (`http://192.168.x.x:4173`) **não** mantém a tela acesa — o
> navegador esconde a API e o estado fica `unsupported`. Use HTTPS (ou
> `localhost`, apenas no desktop).

1. Gere o build e sirva-o: `npm run build` e `npm run preview`.
2. Acesse `http://localhost:4173/calisthenics-app/` no Chrome do desktop para
   validar (localhost é contexto seguro); para o celular, publique em **HTTPS**
   (ver docs/02).
3. No Android, abra o endereço **HTTPS** publicado no Chrome e use **"Adicionar
   à tela inicial"** (o app abre em modo `standalone`).
4. Roteiro sugerido:
   - Iniciar o treino A → conferir a contagem regressiva em verde e os avisos
     "Rest!" / "Let's go!".
   - No descanso, tocar **+10s** e **+15s** e verificar a contagem.
   - **Pausar** e **Retomar** (o tempo deve continuar exatamente de onde parou).
   - Deixar a tela ligada (Wake Lock) e trocar de aba e voltar (o bloqueio é
     reativado).
   - Configurar a tela do celular para apagar em 30s e executar um exercício de
     40s: a tela **não** deve apagar. Se apagar, conferir na barra de endereço se
     o app está em **HTTPS** e se não há o aviso "Não foi possível manter a tela
     ativa".
   - Sair pelo diálogo com **"Sair e manter incompleto"** e reabrir o treino
     (deve retomar do ponto exato).
   - Concluir o treino, conferir a tela de conclusão e **Finalizar e salvar
     treino**; verificar a Home (último treino, semana, recomendação) e o
     Histórico (totais e detalhes).
   - Ativar o modo avião após o primeiro carregamento e confirmar que o app
     continua funcionando.

## 13. Fora do escopo desta tarefa

Login, backend, sincronização, dietas/calorias, gamificação, rankings, novos
planos de treino e aplicativo Android nativo continuam fora do escopo.

---

## 14. Tarefa 04 — Refinamento: preparação, controles e ilustrações

Tarefa de UX que **não reescreveu** o Workout Engine. Temporizador, máquina de
estados, IndexedDB, persistência, áudio e Wake Lock foram preservados; a
interface passou a consumir o motor (e uma nova operação `skipSet`) sem
duplicar regras de tempo.

### 14.1 Novo fluxo de início (tela de preparação)

Antes, abrir `/treino/:workoutId` iniciava o cronômetro imediatamente. Agora:

1. `loadWorkoutMode(workoutId)` (`workoutService`) tenta **recuperar** uma
   sessão em andamento. Se houver, retoma a execução (como antes).
2. Caso não exista, retorna o estado **`prepare`** — **sem criar sessão**.
3. A interface exibe `PreparationScreen` com: nome, descrição, quantidade de
   exercícios, total de séries, duração estimada e a **ilustração + instruções
   do primeiro exercício**.
4. Somente ao tocar em **"Iniciar treino"** (gesto do usuário) é que:
   - a sessão é criada (`startWorkoutSession`);
   - o áudio é preparado (`prepareWorkoutAudio()`, dentro do gesto);
   - o Wake Lock é solicitado (quando a sessão fica ativa, em `ActiveWorkout`);
   - a execução do primeiro exercício abre com a contagem de 40 segundos.

`WorkoutModeLoad` = `ready` (retomar) · `prepare` (mostrar preparação) ·
`missing` (treino inexistente). Os botões "Iniciar treino" da Home, da lista e
dos detalhes apenas navegam para a preparação; o áudio deixou de ser preparado
nesses pontos.

### 14.2 Controles durante o exercício

Três controles, com nomes e comportamentos distintos:

| Botão | Comportamento | Operação do motor |
| --- | --- | --- |
| **Anterior** | Volta ao exercício anterior para consulta. **Não** apaga séries concluídas nem reinicia o progresso. | `goToPreviousExercise` |
| **Pular série** | Encerra a série atual **sem contá-la como concluída**. Havendo séries pendentes, inicia o descanso; na última, finaliza o exercício sem descanso. A série é registrada como *pulada*. | `skipSet` (nova) |
| **Próximo exercício** | Encerra o exercício atual e avança. Preserva as séries concluídas, **não** registra as incompletas, não inicia descanso e **não** avança além do último exercício. Pede confirmação simples antes de abandonar o restante. | `advanceExercise` |

**Pular série ≠ concluir série.** `completeSet` (usado por "Concluir série", na
modalidade por repetições) **registra** a série; `skipSet` apenas contabiliza a
série pulada (`ExerciseProgress.skippedSets`) e emite o evento `set-skipped`.
A série pulada nunca incrementa `completedSets`.

### 14.3 Controles durante o descanso

Somente: **+10s**, **+15s** e **Pular descanso**. Não há "Próximo exercício"
nem "Anterior" no descanso — não se avança para outro exercício a partir dele.

Fluxo ao terminar o descanso: havendo outra série, a próxima série inicia
automaticamente; concluídas todas as séries, o exercício finaliza e a opção
"Próximo exercício" aparece. O temporizador e as extensões de descanso
(`extendRest`) seguem inalterados.

A decisão de quais controles aparecem é pura e testável
(`sessionView.getStageControlIds`); `REST_CONTROLS` fixa os três do descanso.

### 14.4 Ilustrações dos exercícios

Os emojis foram substituídos por **SVGs locais** que demonstram o movimento.

**Organização (assets):**

```text
src/assets/exercises/
├── squat.svg               # Agachamento livre
├── incline-push-up.svg     # Flexão com apoio
├── glute-bridge.svg        # Elevação de pelve
├── plank.svg               # Prancha (reutilizada em A e B)
├── jumping-jacks.svg       # Polichinelo
├── running-in-place.svg    # Corrida estacionária
├── wall-sit.svg            # Agachamento isométrico na parede
├── abdominal-rower.svg     # Abdominal remador
└── lying-leg-raise.svg     # Elevação de pernas deitado
```

- **Chave, não emoji.** `Exercise.illustration` passou a ser uma
  `ExerciseIllustrationKey` (`domain/types.ts`). A resolução chave → URL vive em
  `features/workouts/exerciseIllustrations.ts` (importa os SVGs) e o registro de
  arquivos em `exerciseIllustrationKeys.ts` (sem importar assets).
- **Reutilização.** A prancha aparece em A e B com a mesma chave (`plank`) e,
  portanto, a mesma ilustração.
- **Offline.** Os SVGs são importados como módulos (Vite), entram no bundle e no
  precache do Service Worker — sem URLs externas e sem dependência de rede.

**Padrão visual:** estilo vetorial, fundo transparente/integrado ao tema escuro,
figura humana simplificada com proporções coerentes, traço claro e **verde para
o movimento** (setas/indicação), legível em telas pequenas. Sempre que possível,
duas posições (inicial e final) com seta; exercícios estáticos (prancha,
agachamento na parede) mostram a postura e o alinhamento (linha-guia verde).

**Apresentação na interface:** lista de exercícios (miniatura), tela de
preparação (destaque + instruções do 1º exercício), tela de execução (tamanho
`stage`, sem prejudicar o temporizador) e consulta: detalhe do exercício e
detalhes do treino.

### 14.5 Instruções dos exercícios

Cada exercício passou a ter, além de `instructions`, os campos `steps`
("Como executar" — passos simples) e `tip` ("Dica" — cuidado importante).
`adaptations` ("Adaptação") já existia. O componente `ExerciseGuide`
(`components/ui/ExerciseGuide.tsx`) renderiza **Como executar · Dica ·
Adaptação · Erros comuns** de forma consistente na consulta e nos detalhes do
treino.

### 14.6 Arquivos criados/modificados (Tarefa 04)

- **Novos:** `src/assets/exercises/*.svg` (9), `exerciseIllustrationKeys.ts`,
  `exerciseIllustrations.ts`, `components/ui/ExerciseIllustration.tsx` (+ CSS),
  `components/ui/ExerciseGuide.tsx` (+ CSS),
  `pages/WorkoutMode/PreparationScreen.tsx` (+ CSS),
  `domain/workoutControls.test.ts`, `exerciseIllustrations.test.ts`.
- **Modificados:** `domain/types.ts`, `domain/workoutTransitions.ts`,
  `domain/workoutEngine.ts`, `domain/workoutSelectors.ts`,
  `data/workouts.data.ts`, `data/workoutFixtures.ts`, `hooks/useWorkoutSession.ts`,
  `sessionView.ts` (+ teste), `services/workoutService.ts` (+ teste),
  `pages/WorkoutMode/WorkoutModePage.tsx`, `pages/WorkoutMode/ActiveWorkout.tsx`,
  `pages/WorkoutMode/WorkoutMode.module.css`, `pages/Workouts/*` (páginas + CSS),
  `pages/Home/HomePage.tsx`, `index.ts`.

### 14.7 Testes (Tarefa 04)

| Área | Arquivo | Cobertura |
| --- | --- | --- |
| Início | `services/workoutService.test.ts` | Sem sessão ativa → `prepare` **sem criar sessão**; `missing`; recuperação; início explícito com contagem de 40s. |
| Controles | `domain/workoutControls.test.ts` | `skipSet` inicia descanso/não conta a série; pula última série e finaliza; `skipSet` fora da etapa lança erro; `advanceExercise` preserva concluídas e não registra incompletas; não inicia descanso. |
| Descanso | `sessionView.test.ts` | `getStageControlIds` no descanso = `[+10s, +15s, pular descanso]`, sem "próximo/anterior"; exercício timed = `[anterior, pular série, próximo]`; reps usa "concluir série"; confirmação de avanço. |
| Ilustrações | `exerciseIllustrations.test.ts` | Todo exercício tem chave conhecida e asset; prancha reutilizada em A e B; nenhuma imagem depende de rede (`import.meta.glob('?raw')`). |
| Orientações | `data/workouts.data.test.ts` | Todo exercício tem instruções, `steps` (≥3) e `tip`. |

```bash
npm test          # 140 testes (121 anteriores + 19 novos)
```

### 14.8 Verificação visual (Chrome headless, 390×844)

Build de produção servido por `npm run preview`, percorrido com captura de tela:

| Verificação | Resultado |
| --- | --- |
| Home → "Iniciar treino A" | Abre a **preparação** (não inicia o cronômetro) |
| Preparação | Nome, descrição, 14 min · 5 exercícios · 15 séries; ilustração + "Como executar" (4 passos) do 1º exercício; aviso "O cronômetro só começa quando você tocar em Iniciar treino"; botão **Iniciar treino** |
| Iniciar treino | Cria a sessão e abre o 1º exercício com **0:40** (verde) |
| Execução | Badge EXERCÍCIO · "SÉRIE 1 DE 3 · EXERCÍCIO 1 DE 5" · botões **Próximo exercício** (largura total) + **Anterior** / **Pular série** |
| Pular série | Vai ao **DESCANSO** (âmbar) com **+10s** e **+15s** e **Pular descanso** — **sem** próximo/anterior |
| Pular série não conta | Lista mostra "0/3 séries" para o exercício |
| Próximo exercício | Abre diálogo "Avançar para o próximo exercício?" ("...não serão registradas") com Avançar / Continuar treino |
| Consulta do exercício | Ilustração + POR TEMPO / 3 SÉRIES · 40S / DESCANSO 30S + COMO EXECUTAR + DICA + ADAPTAÇÃO + ERROS COMUNS |
| Detalhes do treino (A) | 5 exercícios, cada um com ilustração própria e as seções do guia; botão Iniciar treino |
| Lista de treinos | Miniaturas das ilustrações ao lado de cada exercício |
| Erros de runtime | Nenhum (`console` e `page errors` vazios) |

### 14.9 Verificação final

| Verificação | Comando | Resultado |
| --- | --- | --- |
| Testes | `npm test` | 140 aprovados (121 + 19) |
| Tipos | `npm run typecheck` | sem erros |
| Lint | `npm run lint` | sem erros |
| Build | `npm run build` | sucesso (PWA precache: 15 entradas) |

### 14.10 Limitações

- Áudio (`SpeechSynthesis`) na **retomada** de uma sessão recuperada não passa
  por um gesto novo (a preparação é pulada) — é best-effort, como antes.
- As ilustrações são representações esquemáticas (stick figures), não
  fotos/3D; priorizam clareza e offline.
- Sem `@testing-library`/jsdom no projeto, os fluxos de UI são verificados por
  lógica pura (service/seletores) + verificação visual em navegador; não há
  testes de renderização de componentes.

---

## 15. Tarefa 05 — Robustez do Wake Lock (tela apagando no Android)

### 15.1 Causa identificada

Durante o teste real no Android a tela apagava em 30s, mesmo com exercícios de
40s. **A causa é o ambiente de teste, não a lógica do código:**

- O teste foi feito pelo **endereço IP local da máquina em HTTP**
  (`http://192.168.x.x:4173`).
- A **Screen Wake Lock API só é exposta em contexto seguro**
  (`window.isSecureContext`). Em HTTP por IP, `navigator.wakeLock` é
  **`undefined`**.
- O controlador já tratava isso corretamente (`supported = false`, `request()`
  → `false`, sem lançar), mas **não havia nenhum aviso na interface** — por isso
  a falha era silenciosa e parecia um bug de implementação.

O que a auditoria confirmou:

| Verificação | Resultado |
| --- | --- |
| `navigator.wakeLock` disponível? | Sim em HTTPS/localhost; **não** em HTTP por IP. |
| `isSecureContext` verdadeiro? | Só em HTTPS/localhost (a causa raiz no teste). |
| Solicitação concedida tratada? | Sim — `request()` devolve o resultado real. |
| Tratamento de erros? | Sim — recusa vira `false` + `console.warn`, nunca lança. |
| Sentinel permanece ativo? | Sim — guardado enquanto `!released`. |
| Liberação prematura? | Não — libera só ao pausar/finalizar/desmontar. |
| Reativação em `visibilitychange`? | Sim — re-solicita ao voltar visível. |
| Momento da solicitação? | Correto — ao a sessão ficar `active` (em `ActiveWorkout`). |

**Conclusão:** o código estava funcional para contexto seguro; as lacunas eram
**de produto** (sem estado observável nem aviso ao usuário) e **de ambiente**
(HTTP por IP). Não foram usadas soluções artificiais — continua-se usando a
Screen Wake Lock API corretamente.

### 15.2 Melhorias implementadas

- **Estado observável** (`useWakeLock`): `active` · `inactive` · `unsupported` ·
  `error` (+ `secureContext`), conforme §5.1.
- **Aviso discreto** na execução (`ActiveWorkout`): `role="status"`, mostrado
  quando `status` é `unsupported` ou `error` (`wakeLockWarning`). Nunca apresenta
  sucesso quando o bloqueio não foi concedido.
- **Detecção de revogação**: `subscribe` no controlador (evento `release`) mantém
  o estado fiel ao navegador.
- **Solicitar/liberar/reativar** nos momentos exigidos (§5), sem alterar o motor.

### 15.3 Arquivos modificados

| Arquivo | Mudança |
| --- | --- |
| `src/hooks/wakeLock.ts` | `subscribe`, `WakeLockStatus`/`WakeLockState`, `hasSecureContext`, `shouldReacquire`, `wakeLockWarning`. |
| `src/hooks/useWakeLock.ts` | Devolve o estado observável, observa revogação e reativa no primeiro plano. |
| `src/pages/WorkoutMode/ActiveWorkout.tsx` | Renderiza o aviso quando o bloqueio não está ativo. |
| `src/pages/WorkoutMode/WorkoutMode.module.css` | Estilo `.wakeWarning`. |
| `src/components/ui/icons.tsx` | Ícone `AlertIcon`. |
| `src/hooks/wakeLock.test.ts` | Testes dos cenários abaixo. |

### 15.4 Testes (novos cenários cobertos)

| Cenário | Como é verificado |
| --- | --- |
| API indisponível | `createWakeLockController(null)` → `unsupported`, `request()` `false`. |
| Contexto não seguro | `navigator` sem `wakeLock` → `getWakeLockApi()` `null`; `hasSecureContext()`; aviso com "HTTPS". |
| Solicitação concedida | `request()` → `true`, `isActive()` `true`. |
| Solicitação recusada | `request()` rejeita → `false`, sem lançar. |
| Liberação ao pausar | `release()` desativa o sentinel. |
| Reativação ao retomar | `request()` após `release()` → nova solicitação. |
| Revogação pelo navegador | evento `release` → `subscribe` notifica `false`. |
| Reativação ao primeiro plano | `shouldReacquire(enabled, supported, 'visible')` + re-solicitação após revogação. |

### 15.5 Verificação final

| Verificação | Comando | Resultado |
| --- | --- | --- |
| Testes | `npm test` | 155 aprovados (140 + 15) |
| Tipos | `npm run typecheck` | sem erros |
| Lint | `npm run lint` | sem erros |
| Build | `npm run build` | sucesso (PWA precache: 15 entradas) |

### 15.6 Como validar no Chrome Android

1. Sirva o app por **HTTPS** (ou `localhost` no desktop) — **não** por HTTP pelo
   IP da máquina; a API não existe nesse contexto (§12).
2. Abra no Chrome Android e execute um exercício de 40s com a tela configurada
   para apagar em 30s: **a tela deve permanecer acesa**.
3. Abra o DevTools remoto (`chrome://inspect`) e, no Console, rode
   `navigator.wakeLock` — deve estar definido; `window.isSecureContext` deve ser
   `true`.
4. Troque de aba e volte: o bloqueio é reativado.
5. Em contexto **não seguro**, o app deve mostrar o aviso e continuar o treino
   normalmente (sem travar).

---

## 16. Tarefa 06 — Wake Lock por sessão (tela apagando nas transições)

### 16.1 Causa raiz

O bloqueio **não** era liberado pelas transições de fase — isso foi verificado no
build de produção (com um `navigator.wakeLock` instrumentado): de exercício para
descanso e de volta, havia **uma única solicitação e nenhuma liberação**.

O problema real estava na **recuperação**: o controlador tratava qualquer
`release` disparado pelo navegador como definitivo. A reaquisição só ocorria em
`visibilitychange` → `visible`. Quando o Chrome revogava o bloqueio no meio da
sessão sem esse evento de visibilidade, a tela ficava **sem proteção pelo resto
do treino** — exatamente o observado ("funciona no começo e depois apaga").

### 16.2 Correção

- **Regra explícita:** `shouldHoldWakeLock(status) === (status === 'active')`.
  O bloqueio depende do estado geral da sessão, nunca de `currentPhase`,
  exercício, série ou tempo restante.
- **Auto-recuperação:** quando o navegador revoga o bloqueio e a sessão ainda o
  deseja com a página visível, o controlador **re-solicita** (`autoRecover`).
- **Referência única ao sentinel** + `pending` (sem requisições duplicadas).
- **Liberação só** ao pausar, concluir, abandonar ou desmontar (com motivo).
- **Instrumentação** (somente em `import.meta.env.DEV`): solicitar, conceder,
  recusar, liberar (+ motivo), revogar, recuperar e mudança de visibilidade.

### 16.3 Arquivos

| Arquivo | Mudança |
| --- | --- |
| `src/hooks/wakeLock.ts` | `shouldHoldWakeLock`, `isDocumentVisible`, `autoRecover`/`isVisible`/`log`, motivos de liberação e eventos de diagnóstico. |
| `src/hooks/useWakeLock.ts` | Cria o controlador com auto-recuperação e registra os eventos em dev. |
| `src/pages/WorkoutMode/ActiveWorkout.tsx` | Usa `shouldHoldWakeLock(snapshot.status)`. |
| `src/hooks/wakeLock.test.ts` | Regra de sessão, visibilidade, auto-recuperação e diagnóstico. |
| `src/hooks/wakeLockSession.test.ts` | Integração com o Workout Engine real (transições de exercício/descanso/série). |

### 16.4 Verificação

| Verificação | Comando | Resultado |
| --- | --- | --- |
| Testes | `npm test` | 176 aprovados |
| Tipos | `npm run typecheck` | sem erros |
| Lint | `npm run lint` | sem erros |
| Build | `npm run build` | sucesso |

Teste real no build de produção (Chromium, `navigator.wakeLock` instrumentado):
o bloqueio permanece ativo na transição exercício → descanso e uma revogação do
navegador com a página visível é recuperada imediatamente.
