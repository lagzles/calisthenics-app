# Calisthenics App — Panda Personal Trainer

**Versão:** 1.0
**Status:** Feature implementada e validada (mascote + demonstrações instrutivas)
**Base:** [`docs/00-architecture-decision.md`](00-architecture-decision.md),
[`docs/03-workout-engine.md`](03-workout-engine.md),
[`docs/04-workout-mode-implementation.md`](04-workout-mode-implementation.md) e
[`docs/06-panda-personal-trainer.md`](06-panda-personal-trainer.md) (especificação
visual aprovada)

O panda é o personal trainer virtual do aplicativo: apresenta o exercício,
mostra o movimento, orienta postura e respiração, avisa sobre erros comuns,
incentiva durante o treino e comemora a conclusão.

> **Nada do Workout Engine foi reescrito.** O motor, os temporizadores, o
> controle de séries, a progressão, a persistência, o histórico, o áudio e o
> Wake Lock permanecem exatamente como estavam. A feature é **apresentação**:
> o panda lê o estado do motor e se apresenta a partir dele.

**Princípio central:** o panda não apenas acompanha o treino — ele ensina o
usuário a treinar corretamente.

---

## 1. Visão geral

```text
src/features/panda/
├── domain/            lógica pura (sem React, sem DOM)
│   ├── pandaTypes.ts      PandaState, PandaPose, DemoTrack, DemoPhase
│   ├── poseMath.ts        cinemática do rig + enquadramento de câmera
│   ├── timeline.ts        resolveTrack(track, elapsed) → { pose, phase }
│   ├── pandaPoses.ts      poses nomeadas (personalidade + demonstrações)
│   ├── pandaDemos.ts      9 tracks de demonstração
│   ├── pandaState.ts      estado do mascote a partir do snapshot do motor
│   └── pandaCatalog.ts    cobertura do panda sobre o catálogo
├── hooks/
│   └── usePandaDemo.ts    relógio acumulado: play / pause / replay
└── components/
    ├── PandaRig.tsx        O PERSONAGEM (fonte única da identidade visual)
    ├── PandaMascot.tsx     estados de personalidade
    ├── PandaDemoPlayer.tsx player da demonstração (controles + fases)
    └── PandaStaticSteps.tsx alternativa estática (movimento reduzido)
```

### 1.1 Fluxo de dados

```text
Workout Engine (snapshot)
        │
        ├─ fase "work"  ──► PandaDemoPlayer ──► PandaRig (pose do momento)
        ├─ fase "rest"  ──► PandaMascot state="rest"
        ├─ fase "done"  ──► PandaMascot state="encouraging"
        └─ treino fim   ──► PandaMascot state="celebrating"
```

A ligação acontece em **um único lugar** (`domain/pandaState.ts`). O motor não
conhece o panda; o panda não escreve no motor.

---

## 2. Identidade visual e o personagem-base único

O requisito de consistência ("não criar diferentes versões do panda para cada
exercício") foi resolvido **estruturalmente**, e não por disciplina manual:

- Existe **um único componente** que desenha o personagem: `PandaRig.tsx`.
- Estados de personalidade e demonstrações instrutivas **passam por ele**.
- As proporções vêm de **comprimentos de segmento constantes**
  (`PANDA_SEGMENTS`); interpolar duas poses nunca estica o personagem.
- A paleta e os acessórios são **constantes no código**: corpo branco
  (`#f4f7f5`), manchas e orelhas pretas (`#1b211f`), pulseira esportiva verde
  (`#2fe06b`), contorno claro nos membros pretos (`#5d6e67`) para separá-los do
  fundo escuro.
- O teste `PandaMascot.test.tsx` verifica, para **cada um dos 7 estados**, que
  as orelhas, as manchas dos olhos, o focinho e a pulseira existem — ou seja, a
  consistência é testada, não apenas prometida.

Detalhe de leitura: os membros pretos ganham um **contorno claro** em duas
passadas de desenho. Sem ele, braço e perna (ambos verticais e pretos) fundiam-se
numa mancha única e o aluno não enxergava o joelho — justamente a articulação que
a demonstração precisa mostrar.

---

## 3. Arquitetura do rig

### 3.1 Cinemática direta

O personagem é reconstruído a partir de uma pose por cinemática direta: o
quadril define o tronco e cada segmento é posicionado pelo seu **ângulo
absoluto**.

```
pelvis ──> pescoço ──> cabeça
  │           │
  │          ombro ──> cotovelo ──> mão
  ├─> joelho ──> tornozelo ──> pé
  └─> joelho ──> tornozelo ──> pé
```

**Convenção de ângulos** (única, usada em toda a feature):

| Ângulo | Direção |
| --- | --- |
| `0°` | para baixo (+y) |
| `90°` | para a direita (+x) |
| `180°` | para cima (−y) |

O vetor de direção é `(sin a, cos a)`. Com uma convenção só, a interpolação
entre poses é coerente e o código de autoria fica legível.

### 3.2 Pose

```ts
export interface PandaPose {
  pelvisX: number; pelvisY: number
  torso: number; headTilt: number
  shoulderFront: number; elbowFront: number
  shoulderBack: number; elbowBack: number
  hipFront: number; kneeFront: number
  hipBack: number; kneeBack: number
}
```

`Front` é o lado próximo do observador (desenhado por cima, em tom mais
escuro), `Back` é o distante (desenhado por baixo, com deslocamento de
profundidade).

### 3.3 Cinemática inversa do braço

Os apoios que **não podem deslizar** — as mãos no banco da flexão com apoio,
os antebraços na prancha — são descritos pela **posição final da mão**, e o
cotovelo é resolvido (`solveArmIK`). Com isso, o apoio permanece exatamente no
lugar entre a posição alta e a posição baixa, como na execução real.

O ramo escolhido é o "cotovelo baixo" (o cotovelo mais afastado da linha
ombro→mão), que é a postura natural em flexões e apoios.

### 3.4 Enquadramento (câmera)

`computeViewBox()` calcula a câmera sobre **todos os keyframes** de uma
demonstração, e não sobre a pose atual. Assim o personagem não "dá zoom"
durante o movimento, e cada exercício preenche o palco do mesmo jeito. O
estado de personalidade usa o mesmo mecanismo com a sua única pose.

---

## 4. Tecnologia das animações — e por que rig em JS

A feature tem duas categorias de animação, conforme a especificação.

### 4.1 Animações de personalidade

São curtas, decorativas e ligadas a um **estado** (`PandaState`). Cada estado
muda a pose e recebe uma transição leve em CSS (`@keyframes` no módulo do
panda): respiração, impulso curto, balanço de saudação e salto de comemoração.
O `global.css` já zera animações em `prefers-reduced-motion`.

### 4.2 Animações instrutivas

Cada movimento tem uma **track**: uma sequência de keyframes (pose + instante)
e uma sequência de **fases** nomeadas. A fase exibida acompanha a pose — é
isso que transforma a animação em ensino.

**Por que rig em JS, e não CSS `@keyframes` ou SMIL:**

| Alternativa | Por que não |
| --- | --- |
| CSS `@keyframes` | A pausa/retomada e a sincronia entre fase e pose ficam frágeis; cada pose exigiria `transform-origin` exato e o "pausar" não é uma operação confiável entre navegadores. |
| SMIL `<animate>` | `pauseAnimations()`/`beginElement()` têm suporte desigual em navegadores móveis, e o controle de tempo (replay, salto) é limitado. |
| **Rig em JS (escolhido)** | O tempo é um **relógio acumulado**: pausar congela a pose exatamente onde parou, retomar continua, repetir volta ao início. A fase é derivada do mesmo relógio, então nunca "descola" da pose. O motor é **puro** (`resolveTrack`), testável sem DOM. |

**Sem dependências de runtime.** O rig usa apenas `requestAnimationFrame` e
SVG inline. Nenhum arquivo de imagem, nenhuma fonte, nenhuma requisição de
rede — o panda entra no bundle do app e funciona offline por construção.

**Custo de renderização.** A reprodução é limitada a ~30 quadros por segundo
(os movimentos duram meio segundo ou mais), o que reduz pela metade o trabalho
de renderização em aparelhos móveis.

---

## 5. Mapeamento exercício → demonstração

Nove tracks — uma por movimento. A prancha aparece em A e B e **compartilha a
mesma track**, coerente com a reutilização já adotada para as ilustrações.

| Movimento | Exercícios | Fases da demonstração | Duração |
| --- | --- | --- | --- |
| `squat` | `a-agachamento` | Posição inicial → Descida → Posição baixa → Subida e retorno | 2,4 s |
| `incline-push-up` | `a-flexao` | Posição inicial → Descida → Posição baixa → Empurro e retorno | 2,6 s |
| `glute-bridge` | `a-ponte` | Posição inicial → Elevação do quadril → Posição alta → Descida controlada | 2,6 s |
| `plank` | `a-prancha`, `b-prancha` | Posição inicial → Alinhamento do corpo → Isometria com respiração → Manutenção | 2,4 s |
| `jumping-jacks` | `a-polichinelo` | Posição inicial → Abertura → Pés juntos → Abertura → Pés juntos | 2,2 s |
| `running-in-place` | `b-corrida` | Posição inicial → Passada (pé direito) → Passada (pé esquerdo) → Ritmo constante | 1,6 s |
| `wall-sit` | `b-wall-sit` | Posição inicial → Deslize pela parede → Isometria na parede → Subida | 2,6 s |
| `abdominal-rower` | `b-abdominal` | Posição inicial → Flexão do tronco → Posição alta → Descida controlada | 2,6 s |
| `lying-leg-raise` | `b-pernas` | Posição inicial → Elevação das pernas → Posição alta → Descida controlada | 2,4 s |

### 5.1 Decisões biomecânicas

- **Agachamento** — o quadril desce e recua, o tronco inclina à frente, os
  braços estendem à frente e a planta dos pés permanece no chão.
- **Flexão com apoio** — o corpo é uma **linha reta** (tronco e perna
  compartilham o mesmo ângulo) e as **mãos permanecem fixas no banco**,
  resolvidas por cinemática inversa; o cotovelo flexiona na posição baixa.
- **Elevação de pelve** — a linha ombro–joelho se mantém na posição alta
  (extensão de quadril, sem hiperarquer a lombar) e os pés não deslizam.
- **Prancha** — é um movimento **isométrico**: a track **não simula uma
  flexão**. Ela mostra o alinhamento do corpo com uma microvariação de poucos
  pixels correspondente à **respiração** — que é o que realmente acontece
  durante a isometria.
- **Polichinelo** — braços erguidos em diagonal (para não sumirem atrás da
  cabeça na vista de perfil) e pernas abrindo e fechando.
- **Corrida** — passadas alternadas com o joelho elevado e os braços em
  contrafase.
- **Agachamento na parede** — o panda desce com as costas na parede, joelhos a
  90° e os pés à frente; o cenário (parede) é desenhado pelo rig.
- **Abdominal remador** — o tronco recua e flexiona aproximando o peito dos
  joelhos, com os braços estendidos à frente.
- **Elevação de pernas** — as pernas partem estendidas no chão e sobem até a
  vertical, com a lombar apoiada.

### 5.2 Regra anti-engano

Nenhum exercício fica **sem demonstração silenciosamente**. O campo
`Exercise.demoUnavailableReason` existe para o caso de um movimento não poder
ser representado com fidelidade por um rig 2D: nesse caso a interface exibe a
**alternativa estática** e informa o motivo ao usuário.

A regra é verificada por teste (`pandaCatalog.test.ts`): um exercício sem
demonstração **precisa** registrar a limitação, e um exercício **com**
demonstração não pode registrar limitação. No catálogo atual (A e B) **nenhum
exercício fica sem demonstração** — a lista de limitações está vazia.

---

## 6. Orientações estruturadas por exercício

Quatro campos novos e **opcionais** em `Exercise` (`domain/types.ts`):

| Campo | Papel |
| --- | --- |
| `startPosition` | Posição inicial — onde o corpo está antes de começar |
| `breathing` | Orientação de respiração |
| `posture` | Dicas de postura e alinhamento (2–3 itens) |
| `demoUnavailableReason` | Limitação da demonstração visual, quando houver |

O **objetivo** já era coberto por `description`; a execução, por `instructions`
+ `steps`; a dica de segurança, por `tip`; os erros comuns, por
`commonMistakes`. Nenhum campo existente foi removido ou renomeado — por isso
`workoutValidation.ts` e os testes anteriores continuam válidos.

O `ExerciseGuide` passou a exibir, nesta ordem: **Como executar → Posição
inicial → Respiração → Dicas de postura → Dica → Adaptação → Erros comuns**, e
ganhou a variante `compact` (sem o bloco em prosa), usada no temporizador.

### 6.1 Base técnica do conteúdo

As orientações são **padrão consolidado** de treinamento calistênico, sem
números biomecânicos inventados. Os pontos usados:

- **Respiração** — inspirar na fase de retorno (excêntrica) e expirar na fase
  de esforço (concêntrica); em isometrias, respiração contínua e sem apneia.
  Essa é a recomendação padrão para treino de resistência em cargas moderadas
  (a manobra de Valsalva fica reservada a cargas muito altas, o que não se
  aplica a estes exercícios).
- **Postura** — coluna neutra, escapulopélvica ativa, joelhos na direção das
  pontas dos pés, quadril nivelado, peso nos calcanhares no agachamento,
  apoio do pé inteiro (sem calcanhar) na corrida, joelhos a 90° e sem passar
  da ponta dos pés no agachamento na parede.
- **Erros comuns** — mantidos os que já existiam no aplicativo, sem
  acrescentar afirmações controvérsias (a discussions sobre os joelhos
  passarem da ponta dos pés em agachamento com peso corporal não foi levada ao
  texto, porque depende de contexto).

Fontes consultadas para conferência: material público de treinamento de
resistência (Sharecare, Healthline, The Workout Mag) e guias de técnica de
agachamento, flexão, prancha e ponte de glúteos (Keplerfit, Calisthenics Hub,
Collaborate for Healthy Weight).

---

## 7. Integração nas telas

| Tela | O que mudou | O que **não** mudou |
| --- | --- | --- |
| **Home** | O "Olá!" passa a ter o panda ao lado (`welcome`, ou `streak` quando a meta semanal é batida) com uma frase contextual. | A lógica de dados (`useHomeData`), o resumo da semana e a recomendação. |
| **Preparação** (`PreparationScreen`) | O primeiro exercício passa a ser apresentado pelo panda, com **demonstração** (botões Iniciar / Pausar / Retomar / Repetir) e o rótulo da fase. | O aviso de que o cronômetro só começa no toque em "Iniciar treino" e a criação da sessão. |
| **Temporizador** (`TimerScreen`) | O **palco é o panda**: durante o exercício ele demonstra o movimento; no descanso assume o estado `rest`; ao concluir o exercício, `encouraging`. O stick figure vira **miniatura** ao lado do nome. Um painel expansível **"Orientações do panda"** mantém posição inicial, respiração, postura, dica e erros acessíveis **durante** o treino. | Cronômetro, séries, descanso, extensões, "Pular série", "Próximo exercício", "Anterior", a barra de progresso do exercício e toda a lógica do motor. |
| **Consulta do exercício** (`ExerciseDetailView`) | Entra a demonstração do panda acima do guia completo. | Os badges de modalidade, alvo e descanso. |
| **Conclusão** (`CompletionScreen`) | O panda entra comemorando (`celebrating`). | Resumo, salvamento e navegação para o histórico. |
| **Detalhe do treino** (`WorkoutDetailsPage`) | O guia passa a exibir as seções novas. | A listagem e os demais blocos. |

Os stick figures foram **mantidos** como apoio complementar (miniatura no
temporizador e esquema na consulta), sem competir visualmente com o panda.

---

## 8. Acessibilidade e movimento reduzido

- `usePrefersReducedMotion` (`src/hooks/`) detecta a preferência do sistema.
- Com movimento reduzido, a demo **não anima**: o player mostra o personagem
  estático e a **alternativa estática por fases** — uma figura do panda por
  fase, com o mesmo rótulo (`PandaStaticSteps`). O aluno entende o movimento
  sem que nada se mova.
- O botão de demonstrá-la é escrito por extenso, os controles do player têm
  `aria-label` explícito ("Iniciar demonstração", "Pausar demonstração",
  "Retomar demonstração", "Repetir demonstração desde o início") e o rótulo da
  fase usa `role="status"`.
- O painel "Orientações do panda" usa `aria-expanded`, e as seções do guia
  mantêm a hierarquia de títulos já existente.

---

## 9. Testes executados e resultados

| Verificação | Comando | Resultado |
| --- | --- | --- |
| Testes | `npm test` | **222 aprovados** (176 anteriores + 46 novos) |
| Tipos | `npm run typecheck` | sem erros |
| Lint | `npm run lint` | sem erros |
| Build | `npm run build` | sucesso (precache: 15 entradas, 400 KiB) |

### 9.1 Testes novos

| Área | Arquivo | Cobertura |
| --- | --- | --- |
| Rig (puro) | `features/panda/domain/poseMath.test.ts` | Convenção de ângulos, interpolação, comprimento dos segmentos constante (o panda nunca estica), juntas dentro do palco, IK do braço (alcance e ramo do cotovelo). |
| Timeline (puro) | `features/panda/domain/timeline.test.ts` | Normalização do ciclo, fase em cada intervalo, interpolação entre keyframes, `resolveTrack` nas 9 tracks reais. |
| Demonstrações (puro) | `features/panda/domain/pandaDemos.test.ts` | Uma track por movimento do catálogo, keyframes ordenados, fases contíguas cobrindo o ciclo, nome "Posição inicial" na primeira fase, personagem dentro do palco. |
| Cobertura (puro) | `features/panda/domain/pandaCatalog.test.ts` | Todo exercício de A e B tem demo e orientação estruturada; a prancha compartilha a demo; nenhum asset externo. |
| Estado (puro) | `features/panda/domain/pandaState.test.ts` | `work → demo`, `rest → rest`, `completed → encouraging`, treino concluído → `celebrating`, usando o motor real. |
| Player (jsdom) | `features/panda/components/PandaDemoPlayer.test.tsx` | Renderização, iniciar/pausar/retomar, repetir, `hideControls` e o fallback de movimento reduzido. |
| Mascote (jsdom) | `features/panda/components/PandaMascot.test.tsx` | Os 7 estados renderizam, rótulo acessível e **o mesmo personagem em todos os estados**. |
| Personagem (jsdom) | `features/panda/components/PandaRig.test.tsx` | Orelhas, manchas, focinho e pulseira; ausência de recursos externos; enquadramento de câmera. |

**Ambiente de teste.** Os testes de componente declaram
`// @vitest-environment jsdom` no próprio arquivo — os 176 testes existentes
continuam em Node puro, sem alteração. `vitest.config.ts` passou a aceitar
`*.test.tsx` e a fixar `NODE_ENV=test` (necessário em máquinas com
`NODE_ENV=production` no ambiente, onde o build de produção do React não
expõe `React.act`).

**Dependências adicionadas:** `jsdom` e `@testing-library/react`, ambas como
`devDependencies` — não entram no bundle do aplicativo.

---

## 10. Verificação visual

Build de produção servido por `npm run preview`, percorrido em Chrome headless
com viewport de celular (390×844):

| Verificação | Resultado |
| --- | --- |
| Home | Panda ao lado do "Olá!", braço erguido e pulseira visível; ao bater a meta semanal, o estado muda para `streak`. |
| Preparação | Panda demonstrando o 1º exercício, rótulo "POSIÇÃO INICIAL", controles "Iniciar" e "Repetir", instrução e passos do exercício. |
| Execução | Palco com o panda demonstrando; rótulo da fase mudando com o movimento ("DESCIDA", "SUBIDA E RETORNO"); miniatura do stick figure ao lado do nome; temporizador, série e barra de progresso intactos. |
| Orientações | Painel "Orientações do panda" abre com Posição inicial, Respiração, Dicas de postura, Dica e Erros comuns — sem sair do treino. |
| Descanso | Identidade âmbar, panda no estado `rest` (sentado, olhos fechados), extensões e "Pular descanso" intactos. |
| Conclusão | Panda comemorando acima do resumo de duração, exercícios e séries. |
| Movimento reduzido | Demonstração substituída pela alternativa estática: uma figura por fase, com os rótulos. |
| Erros de runtime | Nenhum (`console` e `page errors` vazios). |

---

## 11. Limitações conhecidas

- **Rig 2D.** O personagem é visto de perfil e representa o plano sagital.
  Detalhes de rotação externa (abertura de quadril, rotação do braço no
  polichinelo) são simplificados. A demo **complementa** a explicação textual;
  não substitui um vídeo ou um modelo 3D.
- **A prancha é isométrica.** A demo mostra alinhamento e respiração — não
  existe "movimento" a demonstrar. É o comportamento biomecânico correto, mas
  vale saber que a animação é quase estática por opção, não por falha.
- **Calibração visual.** As poses foram calibradas visualmente em viewport de
  celular; um ajuste fino de ângulo pode ser necessário se o design evolves.
- **Sem captura de vídeo.** O app não analisa a execução do usuário (fora de
  escopo).
- **Sem áudio do panda.** Não há narração nem música (fora de escopo).
- **Sem demonstração para isometrias puras.** Movimentos sem tradução clara
  para um rig 2D devem receber `demoUnavailableReason` e a alternativa
  estática — o mecanismo existe, mas o catálogo atual não precisa dele.

---

## 12. Como adicionar um novo exercício e sua demonstração

1. **Defina o exercício** em `src/features/workouts/data/workouts.data.ts`,
   com `illustration` (uma chave já existente ou uma nova) e as orientações
   estruturadas: `startPosition`, `breathing` e `posture`.
2. **Escreva as poses** em `src/features/panda/domain/pandaPoses.ts`, usando
   `makePose`:

   ```ts
   export const MEU_EXERCICIO_START = makePose({
     pelvis: { x: 100, y: 108 },
     torso: 180,
     armFront: [20, 28],
     legFront: [3, -1],
   })
   ```

   Use ângulos absolutos (0 = baixo, 90 = direita, 180 = cima). Para apoios
   fixos, use `armFront: { hand: { x, y } }` — a cinemática inversa resolve o
   cotovelo.
3. **Monte a track** em `src/features/panda/domain/pandaDemos.ts`:

   ```ts
   const MINHA_TRACK: DemoTrack = {
     key: 'meu-exercicio',
     label: 'Meu exercício',
     duration: 2400,
     loop: true,
     keyframes: [
       { t: 0, pose: MEU_EXERCICIO_START },
       { t: 900, pose: MEU_EXERCICIO_FIM },
       { t: 2300, pose: MEU_EXERCICIO_START },
     ],
     phases: [
       { id: 'inicio', label: 'Posição inicial', from: 0, to: 500 },
       { id: 'execucao', label: 'Execução', from: 500, to: 1500 },
       { id: 'final', label: 'Posição final', from: 1500, to: 2000 },
       { id: 'retorno', label: 'Retorno', from: 2000, to: 2400 },
     ],
   }
   ```

   Registre a track em `PANDA_DEMOS` (a chave precisa existir em
   `ExerciseIllustrationKey`).
4. **Verifique**: `npm test` — os testes de `pandaDemos` e `pandaCatalog`
   cobrem a integridade das tracks e exigem que todo exercício do catálogo
   tenha demo **ou** limitação documentada.
5. **Calibre visualmente**: a demo aparece automaticamente na preparação, no
   temporizador e na consulta do exercício.

Se o movimento **não** puder ser representado com fidelidade, prefira
`demoUnavailableReason` a uma animação enganosa: a interface passa a mostrar a
alternativa estática e explica o motivo ao usuário.

---

## 13. Fora do escopo

Música durante o treino, calendário de treinos, novas estatísticas, backend,
login, sincronização em nuvem, reformulação da identidade visual do aplicativo
e substituição do Workout Engine continuam fora do escopo — nenhuma linha do
motor, da persistência ou do histórico foi alterada.
