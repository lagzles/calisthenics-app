# Calisthenics App

Aplicativo pessoal de calistenia — PWA offline, dark mode e mobile-first.
Treinos sem equipamentos para condicionamento físico e perda de peso.

## Sobre o projeto

O Calisthenics App orienta treinos de calistenia (peso corporal) conduzindo
automaticamente os intervalos de **exercício** e **descanso**. A ideia é que você
não precise tocar no celular a cada transição: o aplicativo controla o
temporizador, avisa por voz e mantém a tela acesa enquanto a sessão está ativa.

É um projeto pessoal, **100% frontend**, hospedado gratuitamente no GitHub Pages
e instalável como PWA. Não existe login, backend nem banco de dados remoto — o
histórico fica no próprio dispositivo.

## Funcionalidades

- **Treinos A e B** — "Corpo inteiro" (A) e "Core e resistência" (B), com 5
  exercícios cada.
- **Exercícios por tempo** — 3 séries de 40 segundos de atividade por exercício.
- **Temporizador automático** — contagem baseada em *timestamps* reais (não
  depende de `setInterval`), com alternância automática entre exercício e
  descanso.
- **Descansos** de 20 ou 30 segundos, com extensão de **+10s** / **+15s** e
  opção de pular.
- **Controles de execução** — Pausar/Retomar, Pular série, Próximo exercício e
  Anterior (sem perder o progresso das séries já concluídas).
- **Avisos sonoros** — mensagens faladas ("Rest!", "Let's go!", "Exercise
  complete!", "Workout complete!") via síntese de voz nativa (offline).
- **Ilustrações** — SVGs locais que demonstram cada movimento (sem imagens
  externas).
- **Panda Personal Trainer** — um mascote vetorial que apresenta cada
  exercício, **demonstra o movimento** do panda (com pausa e repetição),
  orienta postura e respiração, avisa sobre erros comuns e comemora o treino
  concluído.
- **Histórico local** — treinos concluídos, séries por exercício, duração e
  resumo semanal, salvos no IndexedDB do dispositivo.
- **Instalação como PWA** — "Adicionar à tela inicial" abre o app em modo
  `standalone`.
- **Funcionamento offline** — após o primeiro carregamento/instalação, o app
  abre e executa os treinos sem conexão.
- **Tela acesa durante o treino** — Screen Wake Lock (quando suportado).

## Tecnologias

- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/) (build e dev server)
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) (Service Worker e
  manifest)
- [React Router](https://reactrouter.com/) (`HashRouter`, compatível com
  hospedagem estática)
- **IndexedDB** nativo (persistência das sessões, sem bibliotecas externas)
- CSS puro com design tokens (CSS Modules)

## Requisitos

- Node.js >= 20.19

## Como executar localmente

```bash
npm install
npm run dev
```

O aplicativo é servido sob o caminho `/calisthenics-app/`
(compatível com o GitHub Pages):

- Dev: `http://localhost:5173/calisthenics-app/`

Para gerar e inspecionar o build de produção:

```bash
npm run build    # verificação de tipos + build em dist/
npm run preview  # http://localhost:4173/calisthenics-app/
```

> **Nota:** se `npm install` não instalar as ferramentas de desenvolvimento
> (vite, typescript, etc.), use `npm install --include=dev` — em algumas máquinas
> o `npm` está configurado com `omit=dev`.

## Scripts

| Comando              | Descrição                                           |
| -------------------- | --------------------------------------------------- |
| `npm install`        | Instala as dependências.                            |
| `npm run dev`        | Ambiente de desenvolvimento.                        |
| `npm run build`      | Verificação de tipos + build de produção (`dist/`). |
| `npm run preview`    | Serve o build de produção localmente.               |
| `npm run typecheck`  | Verificação de tipos do TypeScript.                 |
| `npm run lint`       | Análise estática com ESLint.                        |
| `npm test`           | Testes automatizados (Vitest).                      |
| `npm run test:watch` | Testes em modo observador.                          |
| `npm run icons`      | Regenera os ícones do PWA em `public/icons`.        |

## Publicação

A publicação é **automática** no GitHub Pages a partir da branch `main`, via
GitHub Actions (`.github/workflows/deploy.yml`). Em cada `push` para `main` (ou
execução manual pelo `workflow_dispatch`), o workflow instala as dependências
(`npm ci`), roda `npm run build` e publica o conteúdo de `dist/`.

O caminho base do app é `/calisthenics-app/`, então o GitHub Pages serve o
projeto em `https://<usuario>.github.io/calisthenics-app/`. Para o deploy, é
necessário configurar, **uma única vez**, em
Settings → Pages → Source = **GitHub Actions**. Os detalhes estão em
[`docs/05-release-preparation.md`](docs/05-release-preparation.md).

## Privacidade e armazenamento

- **Sem login** e **sem backend** — nenhuma conta de usuário é criada.
- O **histórico de treinos é armazenado localmente no IndexedDB** de cada
  navegador/dispositivo.
- **Não existe sincronização remota nem compartilhamento de histórico** entre
  usuários; os dados nunca saem do dispositivo.
- **Limpar os dados do site** ou o armazenamento do navegador **apaga o
  histórico** — não há cópia em outro lugar.
- O código-fonte é público, mas os dados de utilização permanecem locais.

## Limitações

- **Screen Wake Lock** exige um **contexto seguro** (HTTPS ou `localhost`) para
  manter a tela acesa. Em HTTP puro — inclusive pelo IP local da máquina
  (`http://192.168.x.x`) — a API não é exposta pelo navegador e a tela pode
  apagar; o app exibe um aviso e continua o treino normalmente. O suporte também
  varia por navegador/plataforma.
- **Offline** funciona após o primeiro carregamento/instalação; a primeira
  visita ainda precisa de conexão para baixar os arquivos.
- Os **avisos sonoros** usam a síntese de voz do navegador (podem variar por
  dispositivo) e exigem uma interação inicial do usuário.
- As **ilustrações** são representações esquemáticas (não fotos/3D).
- A **demonstração do panda** é um rig 2D em vista de perfil: complementa a
  explicação textual, mas não substitui um vídeo ou um modelo 3D.
- O histórico fica **restrito ao dispositivo** onde o treino foi feito.

## Documentação

A fonte de verdade do projeto está em `docs/`:

- [`docs/00-architecture-decision.md`](docs/00-architecture-decision.md) — decisões de arquitetura.
- [`docs/01-UI-UXi-specification.md`](docs/01-UI-UXi-specification.md) — especificação de UI/UX.
- [`docs/02-initial-implementation.md`](docs/02-initial-implementation.md) — implementação inicial (fundação técnica).
- [`docs/03-workout-engine.md`](docs/03-workout-engine.md) — motor de execução e persistência.
- [`docs/04-workout-mode-implementation.md`](docs/04-workout-mode-implementation.md) — Workout Mode, áudio, Wake Lock e integração Home/Histórico.
- [`docs/05-release-preparation.md`](docs/05-release-preparation.md) — auditoria e preparação do primeiro lançamento.
- [`docs/06-panda-personal-trainer.md`](docs/06-panda-personal-trainer.md) — feature de mascote panda como personal trainer.
- [`docs/07-panda-personal-trainer-implementation.md`](docs/07-panda-personal-trainer-implementation.md) — implementação do Panda Personal Trainer (rig, demonstrações, integração e testes).
