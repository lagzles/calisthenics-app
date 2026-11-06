# Calisthenics App — Preparação do lançamento (Tarefa 05)

**Versão:** 1.0
**Status:** Auditoria de release concluída — **READY WITH MANUAL ACTIONS**
**Base:** [`docs/00-architecture-decision.md`](00-architecture-decision.md),
[`docs/01-UI-UXi-specification.md`](01-UI-UXi-specification.md),
[`docs/02-initial-implementation.md`](02-initial-implementation.md),
[`docs/03-workout-engine.md`](03-workout-engine.md) e
[`docs/04-workout-mode-implementation.md`](04-workout-mode-implementation.md)

> Esta tarefa **não adiciona funcionalidades**. É uma auditoria final de
> configuração e validação para o primeiro lançamento público. Nenhum arquivo de
> código-fonte foi alterado; nenhum commit ou push foi feito.
>
> **Observação de numeração:** o documento `04` já usa os rótulos internos
> "Tarefa 05" e "Tarefa 06" para evoluções do Wake Lock. Este documento é o
> `05` do fluxo de release e não substitui aquelas seções.

## 1. Resumo executivo

O projeto está tecnicamente pronto para publicação. A validação completa passou:
**176 testes**, **typecheck** sem erros, **ESLint** sem erros, **build de
produção** válido (`dist/`) e **`npm audit` sem vulnerabilidades**. A
configuração de PWA, o base path do Vite, o manifest, o Service Worker e o
workflow do GitHub Pages estão coerentes com o subpath `/calisthenics-app/`.

As pendências são **operacionais** (não de código): o repositório ainda **não
tem commits nem remote**, e a publicação exige uma configuração manual única no
GitHub (Settings → Pages → Source = GitHub Actions). Por isso a classificação é
**READY WITH MANUAL ACTIONS**.

O primeiro teste **real** do Screen Wake Lock em Android deverá ocorrer **após a
publicação em HTTPS** no GitHub Pages (§10 e §11) — o teste local não substitui
essa validação, pois a API só é exposta em contexto seguro.

## 2. Estado geral do projeto

- Aplicativo React + TypeScript + Vite, configurado como **PWA** instalável e
  offline, tema **dark mode** e layout mobile-first.
- **Sem login, sem backend, sem banco de dados remoto e sem sincronização.**
- Dois treinos (**A** e **B**), **exclusivamente por tempo**: 3 séries de **40s**
  de atividade, com descanso de **20s ou 30s** conforme o exercício.
- Histórico persistido **localmente** no IndexedDB.
- Hospedagem pretendida: **GitHub Pages** (arquivos estáticos), publicação via
  **GitHub Actions**.

Nenhuma funcionalidade foi adicionada nesta tarefa e a arquitetura não foi
alterada.

## 3. Arquivos criados e modificados

| Arquivo | Tipo | Observação |
| --- | --- | --- |
| `README.md` | modificado | Reescrito para o público: sobre o projeto, funcionalidades, tecnologias, execução local, publicação, privacidade/armazenamento e limitações. |
| `.gitignore` | modificado | Adicionada a exclusão de `.commandcode/` (configuração local de ferramenta). |
| `docs/05-release-preparation.md` | criado | Este documento. |

Nenhum arquivo em `src/` foi alterado. Nenhum teste foi alterado ou removido.

## 4. Auditoria do Git

Estado atual (somente leitura; nenhuma operação destrutiva executada):

| Item | Resultado |
| --- | --- |
| Branch atual | `main` |
| Commits | **nenhum** (`No commits yet`) |
| Remote | **nenhum** configurado (`git remote -v` vazio) |
| Working tree | limpo em termos de arquivos rastreados; **todos os arquivos ainda não rastreados** (repositório sem primeiro commit) |
| Arquivos modificados | nenhum rastreado (nada commitado ainda) |
| Arquivos não rastreados | `.github/`, `docs/`, `public/`, `scripts/`, `src/`, `README.md`, `index.html`, `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `eslint.config.js`, `.gitignore` |
| Stash | vazio |
| Branch principal esperada | `main` (confirmada; é a única branch) |

Não foi executado `reset`, `clean`, `checkout` forçado, commit ou push. Não há
referências a `master` no projeto.

## 5. Auditoria de segurança (repositório público)

Verificações realizadas:

| Verificação | Resultado |
| --- | --- |
| Senhas / tokens / API keys privadas | **Nenhum** encontrado. |
| Chaves privadas (PEM/PKCS, `AKIA…`, `ghp_…`, `Bearer …`) | **Nenhum** encontrado. |
| Informações pessoais no código/config | **Nenhuma** identificada. |
| Arquivos `.env` / `.env.*` | **Nenhum** no repositório. |
| Arquivos temporários / logs / `.tmp` / `.bak` / `.swp` | **Nenhum** encontrado. |
| Screenshots de testes indevidos | **Nenhum** encontrado. |
| Arquivos de configuração locais | `.commandcode/` (configuração local de ferramenta) — **agora ignorado** pelo `.gitignore`. |
| Segredos no build (`dist/`) | Apenas a **string de aviso** do Wake Lock menciona `localhost`; as demais ocorrências vêm do `react-router`. **Nenhum segredo.** |
| `node_modules/` e `dist/` no Git | **Ignorados** (não rastreados). |

Inspeção do `.gitignore`: cobre `node_modules`, `dist`, `dist-ssr`, `dev-dist`,
`*.tsbuildinfo`, `.vscode/*` (exceto `extensions.json`), `.idea`, arquivos de SO,
logs, `*.local` e `.env*`. Adicionado `.commandcode/`.

Nenhum valor de possível segredo é impresso neste relatório (não houve
ocorrências). Nenhuma credencial foi adicionada ao projeto.

## 6. Auditoria do GitHub Pages

**Arquivo:** `.github/workflows/deploy.yml`

| Requisito | Situação |
| --- | --- |
| Publicação via GitHub Actions | ✅ `configure-pages` + `upload-pages-artifact` + `deploy-pages`. |
| Publicado a partir da branch `main` | ✅ `on: push: branches: [main]`. |
| Execução em push e manual | ✅ `push` + `workflow_dispatch`. |
| Diretório publicado | ✅ `path: dist`. |
| Permissões corretas | ✅ `contents: read`, `pages: write`, `id-token: write`. |
| Concorrência controlada | ✅ `group: pages` + `cancel-in-progress: true`. |
| Node | ✅ `actions/setup-node@v4`, `node-version: 22`, cache npm. |
| Instalação determinística | ✅ `npm ci` (há `package-lock.json`, v3, 501 entradas, com devDependencies). |

**Base path (`vite.config.ts`):**

| Requisito | Situação |
| --- | --- |
| `base` corresponde ao nome do repositório | ✅ `base = '/calisthenics-app/'` (repositório esperado: `calisthenics-app`). |
| Assets sob o subpath | ✅ `dist/index.html` referencia `/calisthenics-app/assets/…`, `/calisthenics-app/manifest.webmanifest`, `/calisthenics-app/registerSW.js`. |
| Rotas funcionam no subpath | ✅ `HashRouter` — a navegação é feita por hash, sem depender do servidor. |
| Caminhos absolutos incorretos | ✅ Nenhum: todos usam o `base`. |
| Service Worker no escopo correto | ✅ `registerSW.js` registra `/calisthenics-app/sw.js` com `scope: '/calisthenics-app/'`. |

**Configuração manual necessária (uma vez):** definir em
**Settings → Pages → Source = GitHub Actions**. Sem isso, o workflow publica o
artefato, mas o Pages não serve o site. O endereço final é
`https://<usuario>.github.io/calisthenics-app/` — o `<usuario>` será o
proprietário real do remote, que **ainda não está configurado** (não foi
inventado aqui).

> Não foi adicionado `.nojekyll`: com a publicação via Actions, o GitHub Pages
> não processa o artefato com Jekyll e os assets do Vite não usam prefixo `_`.

## 7. Auditoria do PWA

**Manifest gerado** (`dist/manifest.webmanifest`):

| Campo | Valor |
| --- | --- |
| `name` / `short_name` | `Calisthenics App` / `Calisthenics` |
| `start_url` | `/calisthenics-app/` |
| `scope` | `/calisthenics-app/` |
| `display` | `standalone` |
| `orientation` | `portrait` |
| `theme_color` / `background_color` | `#0a0f0d` / `#0a0f0d` |
| `lang` / `dir` | `pt-BR` / `ltr` |
| Ícones | `pwa-192x192.png`, `pwa-512x512.png` e `pwa-maskable-512x512.png` (`purpose: maskable`) |

Outros itens:

| Requisito | Situação |
| --- | --- |
| Apple touch icon | ✅ `public/icons/apple-touch-icon.png` (180×180), referenciado no `index.html`; `apple-mobile-web-app-*` definidos. |
| Favicon | ✅ SVG local (`icons/favicon.svg`). |
| Service Worker | ✅ `generateSW`, `registerType: 'autoUpdate'`, `skipWaiting` + `clientsClaim`. |
| Precaching | ✅ 15 entradas (HTML, JS, CSS, ícones, manifest). |
| Fallback de navegação | ✅ `navigateFallback: '/calisthenics-app/index.html'`. |
| Cache/atualização de versão | ✅ `cleanupOutdatedCaches: true`; cada build gera novo hash de assets e a revisão do precache é atualizada. |
| Ilustrações locais | ✅ 9 SVGs em `src/assets/exercises/`, importados como módulos e precacheados. |
| Dependência de imagens externas | ✅ Nenhuma. |
| Offline após primeiro load/instalação | ✅ HTML/JS/CSS/ícones/manifest no precache; IndexedDB acessível offline. |
| Referências a `localhost` em produção | ✅ Nenhuma no código do app (apenas a string de aviso do Wake Lock e internals do `react-router`). |

**Atualização do Service Worker:** com `registerType: 'autoUpdate'` e
`skipWaiting`/`clientsClaim`, uma nova versão publicada assume o controle assim
que o SW é atualizado; caches antigos são limpos (`cleanupOutdatedCaches`).

## 8. Auditoria do armazenamento local (IndexedDB)

**Camada:** `src/features/workouts/data/workoutRepository.ts` (IndexedDB nativo,
sem bibliotecas).

| Item | Valor |
| --- | --- |
| Banco | `calisthenics-app` |
| Versão | `1` |
| Store | `workoutSessions` (`keyPath: 'id'`) |
| Índices | `status`, `startedAt`, `finishedAt` |
| Migração | Ponto único `upgradeDatabase(db, tx, oldVersion)`, aplicado por versão anterior (permite evoluir o esquema). |
| Tratamento de erros | `onerror`/`onblocked` na abertura; `onerror`/`onabort` nas transações; Promises rejeitam com erro descritivo. |
| Operações | `saveSession`, `getSession`, `listSessions`, `listCompletedSessions`, `getActiveSession`, `deleteSession`, `clearSessions`. |

**Recuperação de sessões:** `recoverWorkoutSession(now)` busca a sessão
`active`/`paused` mais recente, aplica `tick` até o horário atual (timestamps
reais), persiste se houve mudança e é **idempotente**. O aplicativo fechado
durante o exercício/descanso é reconciliado corretamente ao reabrir.

**Persistência após fechar/reabrir:** os dados ficam no IndexedDB do navegador e
permanecem até que o usuário limpe os dados do site/navegador — não há cópia em
outro lugar.

### Aviso de privacidade e armazenamento (texto oficial)

> **O histórico de treinos é armazenado localmente no IndexedDB de cada
> navegador/dispositivo. Não existe conta de usuário, sincronização remota ou
> compartilhamento de histórico entre usuários.**

**Limpar os dados do site ou o armazenamento do navegador pode apagar o
histórico.** Não foi implementada exportação/importação nesta tarefa e a
estrutura do banco não foi modificada.

## 9. Auditoria funcional e testes

Regressão verificada a partir dos testes automatizados e da estrutura de código
(nenhuma funcionalidade foi alterada nesta tarefa):

| Funcionalidade | Cobertura |
| --- | --- |
| Home / recomendação do próximo treino | ✅ `sessionSummary.test.ts`, `useHomeData`. |
| Lista de treinos e detalhes dos exercícios | ✅ catálogo em `workouts.data.ts` (+ `workouts.data.test.ts`) e páginas `Workouts/*`. |
| Tela de preparação (sem iniciar cronômetro) | ✅ `workoutService.test.ts` (`prepare` não cria sessão). |
| Início manual do treino | ✅ `startWorkoutSession` / `PreparationScreen`. |
| Temporizador (exercício, descanso, próxima série) | ✅ `workoutEngine.test.ts` (timestamps reais, idempotente). |
| Descanso e extensão (+10s / +15s) | ✅ `workoutEngine.test.ts`, `sessionView.test.ts`. |
| Pular série / Próximo exercício / Anterior | ✅ `workoutControls.test.ts` (preserva séries concluídas). |
| Pausa e retomada | ✅ `workoutEngine.test.ts` (tempo congelado). |
| Avisos sonoros | ✅ `cues.test.ts`, `workoutAudio.test.ts`, `speechPlayer.test.ts`. |
| Wake Lock | ✅ `wakeLock.test.ts`, `wakeLockSession.test.ts`. |
| Conclusão do treino e histórico | ✅ `sessionSummary.test.ts`, `sessionRepository.test.ts`. |
| Persistência das sessões | ✅ `workoutRepository.test.ts` (fake-indexeddb). |

**Treinos A e B permanecem temporizados**, com **40s de atividade** e **3
séries** por exercício — confirmado por `workouts.data.test.ts` (nenhuma
repetição na interface; descanso de 20s/30s conforme o exercício).

### Screen Wake Lock (Tarefa 04)

| Verificação | Situação |
| --- | --- |
| Mantido entre exercício e descanso | ✅ Regra de sessão: `shouldHoldWakeLock(status) === (status === 'active')`; não depende da fase. |
| Não liberado nas transições | ✅ Só é liberado ao pausar, concluir, abandonar ou desmontar. |
| Liberado ao pausar/concluir/abandonar | ✅ `useWakeLock(false)` e desmontagem. |
| Recuperado quando necessário | ✅ Re-solicitação automática (`autoRecover`) e no retorno ao primeiro plano. |

**A Screen Wake Lock API depende de contexto seguro (HTTPS ou `localhost`) e do
suporte do navegador.** O teste local não substitui a validação em Android
(§10).

**Saúde do Open Graph/ícones/SW:** verificados no build de produção (§7).

## 10. Segurança e dependências

`npm audit` (produção + desenvolvimento): **0 vulnerabilidades**.

| Item | Resultado |
| --- | --- |
| Dependências de produção | `react`, `react-dom`, `react-router-dom` (mínimas). |
| Dependências de desenvolvimento | vite, typescript, eslint + plugins, vitest, vite-plugin-pwa, fake-indexeddb, @types/*. |
| Dependências desnecessárias | Nenhuma identificada. Nenhuma biblioteca foi adicionada. |
| Atualizações automáticas | Nenhuma executada. |
| Breaking changes | Nenhum introduzido. |

> Aviso local (não afeta o CI): esta máquina tem `npm config omit=dev` e
> `NODE_ENV=production`, o que faz o `npm install` ignorar `devDependencies`.
> Se as ferramentas não aparecerem, use `npm install --include=dev`. O
> `package-lock.json` **inclui** as devDependencies, então o `npm ci` do GitHub
> Actions instala tudo normalmente.

## 11. Resultados da validação técnica

| Verificação | Comando | Resultado |
| --- | --- | --- |
| Testes | `npm test` | ✅ **176 aprovados** (15 arquivos) |
| TypeScript | `npm run typecheck` | ✅ sem erros |
| ESLint | `npm run lint` | ✅ sem erros |
| Build | `npm run build` | ✅ sucesso — PWA precache **15 entradas** (367,83 KiB) |
| Auditoria de deps | `npm audit` | ✅ **0 vulnerabilidades** |

Detalhe dos testes por arquivo:

```text
✓ data/workoutRepository.test.ts        (8)
✓ data/workouts.data.test.ts            (22)
✓ hooks/wakeLock.test.ts                (30)
✓ sessionView.test.ts                   (12)
✓ services/workoutService.test.ts       (10)
✓ domain/workoutEngine.test.ts          (27)
✓ hooks/wakeLockSession.test.ts         (13)
✓ sessionSummary.test.ts                (11)
✓ domain/workoutControls.test.ts        (5)
✓ audio/speechPlayer.test.ts            (4)
✓ audio/cues.test.ts                    (9)
✓ domain/workoutValidation.test.ts      (8)
✓ domain/workoutSelectors.test.ts       (8)
✓ audio/workoutAudio.test.ts            (5)
✓ exerciseIllustrations.test.ts         (4)
Total: 176 testes · 15 arquivos
```

Saída do build:

```text
dist/registerSW.js                0.16 kB
dist/manifest.webmanifest         0.63 kB
dist/index.html                   1.26 kB │ gzip:   0.54 kB
dist/assets/index-*.css          29.85 kB │ gzip:   5.60 kB
dist/assets/index-*.js          339.02 kB │ gzip: 103.14 kB
PWA v2.0.0 · generateSW · precache 15 entradas (367,83 KiB)
```

## 12. Problemas encontrados

Nenhum defeito de código foi encontrado — testes, tipos, lint, build e auditoria
de dependências passaram sem erros.

Ajuste de configuração realizado (preparação de release):

1. **`.commandcode/` publicável.** O diretório de configuração local da
   ferramenta de desenvolvimento estava fora do `.gitignore` e apareceria no
   repositório público. **Corrigido**: adicionado `.commandcode/` ao
   `.gitignore`.

Documentação:

2. **`README.md` incompleto para o público.** Faltavam seções exigidas (sobre o
   projeto, funcionalidades, privacidade/armazenamento, limitações). **Corrigido**:
   README reescrito.

## 13. Pendências que dependem de intervenção manual

1. **Criar o primeiro commit** na branch `main` (o repositório ainda não tem
   commits).
2. **Configurar o remote** `origin` para o repositório `calisthenics-app` do
   GitHub e fazer o push inicial da branch `main`.
3. **Definir** Settings → Pages → Source = **GitHub Actions** (única
   configuração manual no GitHub; sem ela o site não é servido).
4. **Confirmar o nome do repositório** como `calisthenics-app` (é o valor do
   `base` do Vite). Se o repositório tiver outro nome, ajustar `BASE` em
   `vite.config.ts` e os campos `start_url`/`scope` do manifest.
5. **Teste real do Wake Lock em Android**, **após** a publicação HTTPS (§11 do
   `docs/04`). Em contexto não seguro (HTTP por IP) a API não é exposta — o
   comportamento é do navegador, não um bug.

## 14. Limitações conhecidas

- O histórico é **local ao dispositivo**; limpar os dados do navegador apaga o
  histórico (não há exportação/importação nesta versão).
- **Wake Lock** depende de contexto seguro (HTTPS/`localhost`) e de suporte do
  navegador; em iOS/Safari o suporte é parcial.
- **Offline** requer um primeiro carregamento/instalação com conexão.
- **Áudio** (`SpeechSynthesis`) varia por dispositivo; na retomada de uma sessão
  recuperada a preparação é pulada, então o áudio é *best-effort*.
- As **ilustrações** são esquemáticas (stick figures), não fotos/3D.
- Sem `@testing-library`/jsdom: os fluxos de UI são cobertos por lógica pura
  (service/seletores) e por verificação visual no build de produção.

## 15. Passos manuais para publicação

Sequência exata para o primeiro deploy (não executada nesta tarefa):

```bash
# 1. (no diretório do projeto) criar o primeiro commit na branch main
git add .
git commit -m "chore: primeiro lançamento do Calisthenics App"

# 2. configurar o remote e enviar a branch main
git remote add origin https://github.com/<usuario>/calisthenics-app.git
git push -u origin main
```

3. No GitHub: **Settings → Pages → Source = GitHub Actions**.
4. (Opcional) Em **Actions**, conferir/rodar o workflow **Deploy to GitHub
   Pages** manualmente (`workflow_dispatch`).
5. Aguardar o workflow concluir e abrir
   `https://<usuario>.github.io/calisthenics-app/`.

## 16. Checklist de validação pós-deploy

- [ ] A URL `https://<usuario>.github.io/calisthenics-app/` abre o app.
- [ ] `window.isSecureContext === true` (HTTPS).
- [ ] **Application → Manifest**: nome, `start_url` e `scope` = `/calisthenics-app/`; ícones 192/512 e maskable presentes.
- [ ] **Application → Service Workers**: `sw.js` ativo com escopo `/calisthenics-app/`.
- [ ] **Application → Cache Storage**: 15 entradas precacheadas.
- [ ] **Offline** (DevTools): recarregar sem rede mantém o app abrindo.
- [ ] Instalar como PWA (Android: "Adicionar à tela inicial") e abrir em `standalone`.
- [ ] Iniciar o treino A pela **preparação** (o cronômetro só começa no toque).
- [ ] Exercício em verde (40s) → descanso em âmbar; "+10s"/"+15s" acumulam.
- [ ] Pausar/Retomar mantém o tempo exato.
- [ ] **Wake Lock**: com a tela configurada para apagar em 30s, um exercício de 40s **não** apaga a tela; alternar de aba e voltar reativa o bloqueio.
- [ ] Avisos sonoros "Rest!", "Let's go!", "Exercise complete!" e "Workout complete!".
- [ ] Concluir e **Finalizar e salvar treino** → Histórico registra a sessão.
- [ ] Fechar e reabrir o app: o histórico permanece.
- [ ] Home passa a recomendar o outro treino e atualiza o resumo da semana.

> **Teste definitivo do Wake Lock em Android:** executar **após** a publicação
> HTTPS do GitHub Pages, com a tela configurada para apagar em 30s durante um
> exercício de 40s. O teste local (HTTP por IP) **não** substitui essa validação.

## 17. Classificação

**READY WITH MANUAL ACTIONS** — o projeto está tecnicamente pronto (build,
testes, tipos, lint e auditoria limpos), mas o lançamento depende de ações
manuais: criar o primeiro commit, configurar o remote/push e definir o
Source do Pages como GitHub Actions. Nenhum commit ou push foi realizado.

---

**Sem commit. Sem push. Aguardando autorização explícita do proprietário para
publicar.**
