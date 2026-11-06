# Calisthenics App — Architecture Decision Record

**Versão:** 1.0  
**Status:** Arquitetura inicial aprovada para o MVP  
**Objetivo:** Aplicativo pessoal de calistenia para condicionamento físico e perda de peso.

## 1. Visão do produto

Aplicativo pessoal para organizar treinos de calistenia, orientar a execução dos exercícios e acompanhar a evolução física.

### Características
- Usuário único inicialmente.
- Nível iniciante.
- Sem equipamentos, utilizando peso corporal.
- Objetivo: condicionamento físico e perda de peso.
- Interface em português.
- Experiência mobile-first.

## 2. Arquitetura tecnológica

| Camada | Tecnologia |
|---|---|
| Frontend | React |
| Linguagem | TypeScript |
| Build | Vite |
| Estilização | CSS responsivo |
| PWA | vite-plugin-pwa |
| Persistência | IndexedDB |
| Hospedagem | GitHub Pages |
| CI/CD | GitHub Actions |
| Versionamento | Git + GitHub |

## 3. Infraestrutura

### GitHub
- Repositório público.
- Repositório sugerido: `calisthenics-app`.
- Código-fonte versionado com Git.
- Branch principal: `main`.

### GitHub Pages
- Hospedagem gratuita.
- Publicação via GitHub Actions.
- HTTPS habilitado.
- Endereço no formato `https://usuario.github.io/calisthenics-app/`.

### Deploy
O processo de publicação deverá ser automático:

1. Alterações enviadas para a branch `main`.
2. GitHub Actions executa a instalação das dependências.
3. Projeto é compilado com Vite.
4. Conteúdo da pasta `dist` é publicado no GitHub Pages.

## 4. Persistência de dados

Não haverá backend no MVP.

Os dados serão armazenados localmente no dispositivo:

**IndexedDB**
- Histórico de sessões.
- Treinos realizados.
- Exercícios concluídos.
- Séries e repetições.
- Duração dos treinos.

**Armazenamento de configurações**
- Preferências de utilização.
- Configurações simples do aplicativo.

O sistema deverá ser desenvolvido de maneira que a camada de persistência possa futuramente ser substituída ou complementada por uma API.

## 5. Requisitos de funcionamento offline

O aplicativo deverá permitir:

- Abrir sem conexão com a internet após a primeira instalação/carregamento.
- Visualizar os treinos cadastrados.
- Executar os exercícios.
- Utilizar o temporizador.
- Registrar séries concluídas.
- Salvar o histórico localmente.

Os recursos necessários para a execução deverão estar disponíveis localmente.

## 6. Segurança e privacidade

- Não haverá autenticação.
- Não haverá transmissão de dados pessoais para servidores.
- Nenhum dado de treino deverá ser incluído no repositório.
- Não armazenar senhas ou segredos no código-fonte.
- Prever mecanismos de exportação e importação dos dados em uma evolução futura.

O código-fonte será público, mas os dados de utilização permanecerão locais.

## 7. Estrutura funcional do MVP

Quatro telas principais:

1. Início.
2. Treinos.
3. Execução do treino.
4. Histórico.

Funcionalidades:

- Dois treinos iniciais.
- Visualização de exercícios.
- Séries e repetições.
- Temporizador de descanso.
- Registro de execução.
- Finalização de sessão.
- Histórico de atividades.

## 8. Restrições do MVP

Não desenvolver inicialmente:

- Login.
- Backend.
- Banco de dados remoto.
- Inteligência artificial.
- Planos adaptativos.
- Rankings.
- Gamificação.
- Integrações com relógios.
- Aplicativo nativo Android.

## 9. Diretrizes técnicas

- Utilizar o caminho base correto do Vite para GitHub Pages.
- Garantir que os recursos do PWA respeitem o caminho do repositório.
- Configurar o Service Worker para cache e atualização da aplicação.
- Evitar dependências externas necessárias para executar os treinos.
- Utilizar navegação compatível com hospedagem estática.
- Manter a lógica de negócios separada dos componentes visuais.
- Manter a persistência isolada em uma camada própria.
- Desenvolver pensando em futura possibilidade de empacotamento Android com Capacitor.

## 10. Critério de sucesso do MVP

O MVP será considerado funcional quando for possível:

1. Acessar o aplicativo pelo endereço publicado.
2. Instalar o aplicativo no Android.
3. Abrir o aplicativo sem conexão com a internet após a preparação inicial.
4. Selecionar um treino.
5. Executar e registrar todas as séries.
6. Utilizar o temporizador.
7. Finalizar o treino.
8. Consultar o treino no histórico.
9. Fechar e abrir novamente o aplicativo sem perder os registros.

---

**Princípio arquitetural:** simplicidade, baixo custo, funcionamento offline e possibilidade de evolução sem reconstruir o projeto.