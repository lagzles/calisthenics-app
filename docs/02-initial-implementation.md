# Calisthenics App — Implementação inicial (Fundação técnica)

**Versão:** 1.0
**Status:** Fundação técnica concluída (Tarefa 01)
**Base:** [`docs/00-architecture-decision.md`](00-architecture-decision.md) e
[`docs/01-UI-UXi-specification.md`](01-UI-UXi-specification.md)

Este documento registra a implementação inicial do projeto: tecnologias,
estrutura, decisões, como executar, como testar o PWA, como funciona o deploy e o
que ainda não foi implementado.

## 1. Resumo

Foi preparada a fundação técnica do aplicativo: projeto React + TypeScript com
Vite, configurado como PWA instalável e funcional offline, identidade visual em
dark mode, estrutura de navegação (Início, Treinos, Histórico), primeira versão
da Home e uma tela de apresentação de treino. O build de produção é válido e a
publicação no GitHub Pages está configurada via GitHub Actions.

O mecanismo de execução do treino (temporizadores, áudio, Wake Lock,
persistência) **não** faz parte desta tarefa e será desenvolvido nas próximas
etapas.

## 2. Tecnologias e versões

Resolvidas pelo npm (`package.json`):

**Runtime**

| Pacote             | Versão  |
| ------------------ | ------- |
| react              | 19.3.1  |
| react-dom          | 19.3.1  |
| react-router-dom   | 7.18.5  |

**Desenvolvimento**

| Pacote                        | Versão  |
| ----------------------------- | ------- |
| typescript                    | 6.0.3   |
| vite                          | 8.3.6   |
| @vitejs/plugin-react          | 6.2.1   |
| vite-plugin-pwa               | 2.0.0   |
| eslint                        | 10.14.0 |
| typescript-eslint             | 8.72.1  |
| eslint-plugin-react-hooks     | 7.1.1   |
| eslint-plugin-react-refresh   | 0.5.7   |
| @eslint/js                    | 10.0.1  |
| globals                       | 17.14.0 |
| @types/react                  | 19.3.0  |
| @types/react-dom              | 19.3.0  |

Node.js: `>= 20.19` (desenvolvido com 22.14).

> Observação: esta máquina está com `npm config omit=dev` e `NODE_ENV=production`
> definidos globalmente, o que faz o npm ignorar `devDependencies` em
> `npm install`. Se as ferramentas de desenvolvimento (vite, typescript, etc.)
> não aparecerem, instale com `npm install --include=dev`.

## 3. Estrutura de pastas

```text
calisthenics-app/
├─ .github/
│  └─ workflows/deploy.yml        # Publicação no GitHub Pages
├─ docs/
│  ├─ 00-architecture-decision.md
│  ├─ 01-UI-UXi-specification.md
│  └─ 02-initial-implementation.md
├─ public/
│  └─ icons/                      # Ícones do PWA (PNG) + favicon SVG
├─ scripts/
│  └─ generate-icons.cjs          # Gera os ícones PNG (sem dependências)
├─ src/
│  ├─ components/
│  │  ├─ layout/                  # AppLayout, PageHeader
│  │  ├─ navigation/              # BottomNav
│  │  └─ ui/                      # Badge, Button, Card, EmptyState, Logo,
│  │                              # OfflineBanner, Stat, icons
│  ├─ features/
│  │  └─ workouts/                # Domínio: types, workouts.data,
│  │                              # recommendation, fixtures, format
│  ├─ hooks/
│  │  └─ useOnlineStatus.ts
│  ├─ pages/
│  │  ├─ Home/
│  │  ├─ Workouts/                # Lista + apresentação do treino
│  │  ├─ History/
│  │  └─ NotFound/
│  ├─ services/
│  │  └─ workoutService.ts        # Camada de acesso a dados
│  ├─ styles/                     # tokens.css (variáveis), global.css
│  ├─ utils/                      # cx.ts, format.ts
│  ├─ App.tsx
│  └─ main.tsx
├─ eslint.config.js
├─ index.html
├─ package.json
├─ tsconfig.json
└─ vite.config.ts
```

## 4. Decisões de implementação

### 4.1 Navegação — `react-router-dom` com `HashRouter`

A especificação pede "navegação compatível com hospedagem estática" sem indicar
biblioteca. Foi escolhido `react-router-dom` (padrão do ecossistema) com
**HashRouter**, que dispensa configuração de fallback no servidor, funciona
offline dentro do PWA e é compatível com um futuro empacotamento Android
(Capacitor). Alternativa considerada: um router próprio, descartado por exigir
manutenção futura.

### 4.2 Caminho base (`base`) do Vite

`base` foi fixado em `/calisthenics-app/` **tanto em desenvolvimento quanto em
produção**, para que os caminhos de assets, manifest e Service Worker sejam
idênticos aos do GitHub Pages (`https://usuario.github.io/calisthenics-app/`).
Consequência: em dev/preview a aplicação é servida em
`http://localhost:<porta>/calisthenics-app/`.

### 4.3 Separação entre domínio, dados e UI

- `features/workouts/` concentra o domínio (tipos, catálogo estático, regra pura
  de recomendação e formatação de apresentação).
- `services/workoutService.ts` é a camada de acesso a dados. Hoje retorna dados
  estáticos; será respaldada por IndexedDB (e, futuramente, opcionalmente por uma
  API) sem alterar os componentes visuais. Atende às diretrizes de manter a
  lógica de negócios separada da UI e a persistência isolada em uma camada própria.

### 4.4 Estilização

CSS puro com variáveis de design (`src/styles/tokens.css`) e CSS Modules por
componente/página. Sem bibliotecas de UI ou de CSS. Tema escuro, verde
(`--color-primary`) para exercício e âmbar (`--color-rest`) para descanso,
conforme a identidade visual.

### 4.5 PWA

`vite-plugin-pwa` em modo `generateSW`, com `registerType: 'autoUpdate'` e
`injectRegister: 'auto'`. O Service Worker pré-cacheia os arquivos da aplicação
(HTML, CSS, JS, ícones, manifest), permitindo abrir offline após o primeiro
carregamento, e está preparado para atualizações automáticas.

### 4.6 Ícones

Gerados a partir de um script próprio (`scripts/generate-icons.cjs`, sem
dependências) — quadrado escuro com halter verde. Permite regenerar os ícones
(`npm run icons`) caso a identidade visual mude. `favicon.svg` é inline.

## 5. Como executar localmente

```bash
npm install --include=dev
npm run dev
```

Acesse: `http://localhost:5173/calisthenics-app/`

## 6. Como gerar o build

```bash
npm run build
```

Executa a verificação de tipos (`tsc --noEmit`) e o build de produção em `dist/`.
Para inspecionar o resultado localmente:

```bash
npm run preview   # http://localhost:4173/calisthenics-app/
```

## 7. Como testar o PWA

O Service Worker não é registrado no servidor de desenvolvimento. Para testar o
comportamento de PWA/offline:

1. Gere o build: `npm run build`.
2. Sirva o build: `npm run preview`.
3. Abra `http://localhost:4173/calisthenics-app/` no navegador.
4. No DevTools → **Application**:
   - **Manifest**: verifique nome, ícones e `start_url`/`scope`
     (`/calisthenics-app/`).
   - **Service Workers**: confirme `sw.js` ativo com escopo `/calisthenics-app/`.
   - **Cache Storage**: confirme os arquivos pré-cacheados.
5. Marque **Offline** no DevTools e recarregue: a aplicação deve continuar abrindo.
6. Em um Android: abrir o endereço publicado e usar "Adicionar à tela inicial"
   (o app abrirá em modo `standalone`).

## 8. Como funciona o deploy

**Configuração definitiva de publicação (branch `main`):**

- Branch principal do projeto: **`main`** (branch única — não existe `master`).
- Disparo: `push` para `main`, além de `workflow_dispatch` (execução manual).
- Publicação: **GitHub Pages via GitHub Actions** (não por branch `gh-pages`).
- Endereço esperado: `https://<usuario>.github.io/calisthenics-app/`.

O workflow `.github/workflows/deploy.yml` executa:

1. Checkout do código.
2. `npm ci` (instalação determinística, a partir de `package-lock.json`).
3. `npm run build` (gera `dist/`).
4. `actions/configure-pages` → `upload-pages-artifact` (publica `dist/`).
5. `actions/deploy-pages` publica no GitHub Pages.

No repositório é necessário, **uma única vez**, definir
Settings → Pages → Source = **GitHub Actions**.

## 9. Limitações conhecidas

- **Sem execução de treino** (foco desta tarefa): não há temporizadores, áudio
  nem Wake Lock.
- **Sem persistência**: `IndexedDB` não foi implementado. Os dados exibidos na
  Home são **estáticos/ilustrativos** (`features/workouts/fixtures.ts`) e o
  Histórico está vazio.
- O botão **"Iniciar treino"** da Home leva à tela de apresentação do treino; o
  botão de início dessa tela está desabilitado, com aviso de que a execução chega
  na próxima etapa.
- **Ilustrações** dos exercícios são emojis (placeholder) até existirem assets
  próprios.
- As ações de `commonMistakes`/`adaptations` existem nos dados, mas ainda não há
  imagens/demonstrações.

## 10. Pendências para as próximas etapas

- Execução do treino (Workout Mode): lista completa + visão individual, estados
  (pendente/em exercício/em descanso/pausado/concluído).
- Temporizador baseado em *timestamps reais* (não apenas `setInterval`).
- Feedback sonoro (arquivos curtos embutidos) e inicialização no primeiro toque.
- Wake Lock API (com liberação ao pausar/finalizar e reativação ao voltar ao
  primeiro plano).
- Camada de persistência com IndexedDB (sessão em andamento + histórico).
- Tela de execução sem navegação principal (interface independente).
- Exportação/importação de dados (evolução futura).

## 11. Observações sobre os documentos 00 e 01

Nenhuma alteração foi feita nos documentos 00 e 01. Dois pontos merecem atenção
(registrados aqui, sem alterar a arquitetura):

1. **Branch de publicação (resolvido):** os documentos definem `main` como branch
   principal. O repositório havia sido inicializado como `master` (pelo
   `init.defaultBranch` global do Git), ainda sem commits. A branch local foi
   renomeada para `main` (`git branch -m main`), mantendo **uma única** branch
   principal — sem criar uma segunda branch. Workflow, README e docs referenciam
   `main`; não restam referências a `master` no projeto.
2. **Ilustrações dos exercícios:** a especificação prevê "ilustração ou
   demonstração" por exercício. Como não devemos depender de recursos externos,
   usamos emojis como placeholder nesta etapa, até definirmos assets próprios.
