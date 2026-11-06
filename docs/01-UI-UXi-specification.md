# Calisthenics App — UI/UX Specification

**Versão:** 1.2  
**Status:** Especificação do MVP  
**Plataforma:** PWA mobile-first  
**Tema:** Dark mode  
**Idioma:** Português brasileiro

## 1. Objetivo

Aplicativo pessoal de calistenia para condicionamento físico e perda de peso.

O usuário deverá conseguir selecionar um treino, executar exercícios com orientação e temporizadores automáticos, registrar sua atividade e acompanhar o histórico.

## 2. Decisões de experiência

- Execução híbrida: lista completa e exercício individual.
- Tema escuro.
- Próximo treino sugerido automaticamente, com liberdade de escolha.
- Interface prioritariamente mobile.
- Botões grandes e fáceis de utilizar.
- Poucas interações durante os exercícios.
- Tela do dispositivo mantida acesa durante a execução e os descansos, quando suportado.
- Feedback sonoro com mensagens faladas nas transições dos temporizadores.

### 2.1 Decisão de produto — treinos do MVP por tempo

> **Todos os exercícios disponibilizados no MVP serão executados por tempo, com
> 40 segundos de atividade, três séries e descansos configuráveis de 20 ou 30
> segundos. Não haverá exercícios por repetições nos treinos A e B.**

O aplicativo funciona como um treinador de exercícios intervalados: ele controla
automaticamente os períodos de atividade e descanso. O domínio continua
suportando exercícios por repetições (ver §6.2), mas nenhum treino disponível no
MVP os utiliza.

## 3. Navegação

Três áreas principais:
1. Início.
2. Treinos.
3. Histórico.

O modo de execução será uma interface independente, sem navegação principal.

## 4. Tela inicial

Apresentar:
- Saudação.
- Treino recomendado.
- Botão para iniciar treino.
- Quantidade de treinos realizados na semana.
- Último treino realizado.
- Acesso à lista de treinos.

Regra de recomendação:
- Sem histórico: recomendar A.
- Último treino A: recomendar B.
- Último treino B: recomendar A.

O usuário poderá escolher qualquer outro treino.

## 5. Tela de treinos

Apresentar os treinos cadastrados com:
- Nome.
- Objetivo.
- Duração estimada.
- Quantidade de exercícios.
- Lista resumida de exercícios.
- Séries e tempos.
- Botão para consultar detalhes.
- Botão para iniciar.

Cada exercício terá:
- Nome.
- Ilustração ou demonstração.
- Instruções.
- Modalidade de execução (nos treinos do MVP, sempre "Por tempo").
- Duração de atividade (40s) e quantidade de séries (3).
- Tempo de descanso (20s ou 30s).
- Erros comuns.
- Adaptações disponíveis.

A apresentação **não** exibe quantidade de repetições nem expressões como
"3 × 12 reps" nos treinos A e B. O que se apresenta é: 3 séries, 40 segundos de
atividade e 20 ou 30 segundos de descanso.

## 6. Modelo de exercícios

O sistema deverá suportar duas modalidades.

### 6.1 Exercício por tempo

Configuração oficial dos treinos do MVP:
- 3 séries.
- 40 segundos de atividade.
- 20 ou 30 segundos de descanso, conforme o exercício.
- Sem descanso após a última série de cada exercício.

O aplicativo controla automaticamente os períodos de exercício e descanso, sem
contagem de repetições.

### 6.2 Exercício por repetições

Modalidade **suportada pelo domínio**, mas **não utilizada nos treinos A e B do
MVP**. Exemplo:
- 3 séries.
- 10 repetições.
- 60 segundos de descanso.

O usuário executa as repetições e marca manualmente a conclusão da série. O aplicativo inicia o descanso automaticamente.

## 7. Tela de execução — Workout Mode

### 7.1 Visualização híbrida

**Lista completa:**
- Todos os exercícios.
- Ordem de execução.
- Séries concluídas.
- Estado de cada exercício.
- Acesso individual aos exercícios.

**Visualização individual:**
- Nome do exercício.
- Ilustração ou demonstração.
- Instruções.
- Série atual.
- Total de séries.
- Temporizador ou repetições.
- Progresso.
- Controles de execução.

### 7.2 Estados do exercício

- Pendente.
- Em exercício.
- Em descanso.
- Pausado.
- Concluído.

### 7.3 Temporizador de exercícios por tempo

Ciclo automático:

1. Iniciar período de exercício.
2. Contar o tempo configurado.
3. Ao terminar, iniciar o descanso.
4. Contar o descanso.
5. Ao terminar, iniciar a próxima série.
6. Repetir até concluir todas as séries.
7. Marcar o exercício como concluído.
8. Permitir avançar para o próximo exercício.

Não haverá descanso automático após a última série, salvo configuração específica.

### 7.4 Diferenciação visual

**Exercício:**
- Cor principal verde.
- Identificação "EXERCÍCIO".
- Contagem regressiva em destaque.

**Descanso:**
- Cor principal âmbar ou laranja.
- Identificação "DESCANSO".
- Contagem regressiva em destaque.
- Mensagem para recuperar e se preparar.

As transições deverão ser claramente identificáveis.

### 7.5 Controles do temporizador

Disponibilizar:
- Pausar.
- Continuar.
- Pular etapa.
- Voltar à lista de exercícios.
- Ajustar descanso, quando necessário.

A contagem deverá utilizar timestamps reais, não depender exclusivamente de `setInterval`.

> **Atualização (Tarefa 04).** O início passou a ter uma **tela de preparação**:
> selecionar um treino mostra nome, descrição, exercícios, séries, duração
> estimada e a ilustração/instruções do primeiro exercício. O cronômetro só
> começa após um toque explícito em **"Iniciar treino"**. Durante o exercício há
> três controles — **Anterior** (consulta, preserva o progresso), **Pular
> série** (encerra a série sem contá-la; inicia o descanso ou finaliza o
> exercício) e **Próximo exercício** (encerra o exercício atual e avança,
> preservando as séries concluídas, com confirmação). Durante o **descanso**
> existem somente **+10s**, **+15s** e **Pular descanso**. Emojis foram
> substituídos por **ilustrações SVG locais** (ver
> [`04-workout-mode-implementation.md`](04-workout-mode-implementation.md) §14).

### 7.6 Pausar treino

Ao pausar:
- Interromper a contagem.
- Preservar exercício atual.
- Preservar série atual.
- Preservar progresso.
- Preservar estado anterior do temporizador.
- Liberar o bloqueio de tela.

Ao retomar, restaurar o estado e solicitar novamente o bloqueio de tela.

### 7.7 Finalização do exercício

Ao concluir todas as séries:
- Marcar exercício como concluído.
- Atualizar progresso geral.
- Reproduzir aviso sonoro de conclusão.
- Permitir avançar ao próximo exercício.

### 7.8 Finalização do treino

Ao concluir todos os exercícios:
- Exibir resumo.
- Informar duração total.
- Informar exercícios concluídos.
- Informar séries realizadas.
- Solicitar confirmação para salvar a sessão.
- Reproduzir aviso sonoro de conclusão do treino.

## 8. Feedback sonoro

**Requisito funcional do MVP.**

O aplicativo deverá reproduzir mensagens sonoras para informar as transições entre exercício, descanso e conclusão.

A intenção é permitir que o usuário acompanhe o treino sem precisar olhar constantemente para o celular.

### 8.1 Mensagens padrão

| Evento | Mensagem falada |
|---|---|
| Fim do período de exercício | "Rest!" |
| Fim do período de descanso | "Let's go!" |
| Fim do último período de exercício | "Exercise complete!" |
| Fim do treino inteiro | "Workout complete!" |

### 8.2 Regras de reprodução

- O aviso deverá ser reproduzido automaticamente na transição.
- O áudio de exercício e o de descanso deverão ser diferentes.
- O aviso de conclusão do exercício deverá ser diferente dos avisos intermediários.
- O aviso de conclusão do treino deverá ser distinto dos demais.
- Não reproduzir avisos duplicados.
- Não reproduzir "Let's go!" depois da última série.
- Os avisos não poderão atrasar o início da próxima etapa.
- O volume deverá ser confortável e não excessivamente alto.

### 8.3 Arquivos de áudio

Preferência técnica: arquivos de áudio curtos, incorporados aos recursos do aplicativo.

Benefícios:
- Pronúncia consistente entre dispositivos.
- Funcionamento offline.
- Controle sobre duração e qualidade.
- Não depender de serviços externos de voz.

Os arquivos deverão ser pré-carregados ou preparados antes da execução do treino.

### 8.4 Inicialização do áudio

O navegador pode bloquear a reprodução automática antes de uma interação do usuário.

Portanto:
- Inicializar o sistema de áudio no primeiro toque em "Iniciar treino".
- Verificar se a reprodução está disponível.
- Não depender de carregamento externo durante a sessão.
- Se houver falha de áudio, manter o treino funcionando normalmente.
- Disponibilizar uma configuração para ativar ou desativar os avisos sonoros futuramente.

### 8.5 Última série

Quando terminar a última série de um exercício:
- Não iniciar o descanso seguinte.
- Reproduzir "Exercise complete!".
- Atualizar o estado do exercício.
- Disponibilizar o próximo exercício.

### 8.6 Configurações futuras

Futuramente poderemos permitir:
- Ativar ou desativar áudio.
- Ajustar volume.
- Escolher voz.
- Personalizar frases.
- Configurar avisos adicionais.

Essas personalizações não são necessárias no MVP.

## 9. Manter a tela do celular acesa

**Requisito funcional do MVP.**

Utilizar Screen Wake Lock API (`navigator.wakeLock`).

Regras:
- Solicitar bloqueio ao iniciar o treino.
- Manter durante exercício e descanso.
- Liberar ao pausar.
- Liberar ao finalizar.
- Liberar ao abandonar.
- Tentar reativar quando o aplicativo voltar ao primeiro plano.

Se não houver suporte, o treino deverá continuar normalmente.

## 10. Persistência da sessão

Salvar localmente durante a execução:
- Treino selecionado.
- Exercício atual.
- Série atual.
- Estado atual.
- Duração configurada.
- Tempo restante.
- Horário de início da etapa.
- Horário previsto para término.
- Séries concluídas.

Se o aplicativo for fechado, deverá ser possível recuperar a sessão.

A recuperação deverá utilizar timestamps reais para determinar o estado correto do temporizador.

## 11. Tela de histórico

Apresentar:
- Total de treinos concluídos.
- Quantidade semanal.
- Tempo total de atividade.
- Lista de sessões anteriores.

Cada sessão deverá armazenar:
- Data.
- Treino.
- Duração.
- Exercícios realizados.
- Séries concluídas.

## 12. Identidade visual

Dark mode inicial.

Diretrizes:
- Fundo escuro.
- Texto claro.
- Verde para exercício.
- Âmbar para descanso.
- Contraste adequado.
- Botões grandes.
- Interface mobile-first.

## 13. Comportamentos globais

| Situação | Comportamento |
|---|---|
| Iniciar treino | Criar sessão, inicializar áudio e solicitar Wake Lock |
| Iniciar exercício | Começar temporizador |
| Terminar exercício | Reproduzir "Rest!" e iniciar descanso |
| Terminar descanso | Reproduzir "Let's go!" e iniciar próxima série |
| Terminar última série | Reproduzir "Exercise complete!" |
| Concluir treino | Reproduzir "Workout complete!" |
| Pausar | Salvar estado e liberar Wake Lock |
| Retomar | Restaurar estado e solicitar Wake Lock |
| Voltar ao primeiro plano | Recuperar estado e tentar reativar Wake Lock |
| Sem internet | Permitir execução offline |

## 14. Fora do escopo do MVP

- Login.
- Backend.
- Rankings.
- Gamificação.
- Dieta.
- Contador de calorias.
- Inteligência artificial.
- Planos adaptativos.
- Integrações com relógios.
- Aplicativo Android nativo.

## 15. Critérios de aceitação

O MVP deverá permitir:

1. Iniciar um treino.
2. Consultar todos os exercícios.
3. Executar exercícios individuais.
4. Executar exercícios por tempo.
5. ~~Executar exercícios por repetições.~~ **Não aplicável aos treinos do MVP**
   (modalidade mantida no domínio para evoluções futuras).
6. Alternar automaticamente exercício e descanso.
7. Diferenciar visualmente os dois estados.
8. Reproduzir "Rest!" no fim do exercício.
9. Reproduzir "Let's go!" no fim do descanso.
10. Reproduzir um aviso distinto no fim da última série.
11. Reproduzir aviso de conclusão do treino.
12. Pausar e retomar temporizadores.
13. Pular etapas.
14. Manter a tela acesa durante a execução, quando suportado.
15. Recuperar sessão interrompida.
16. Finalizar e salvar um treino.
17. Consultar o histórico.
18. Utilizar o aplicativo offline.

## 16. Princípio final

O usuário deverá conseguir executar o treino sem precisar controlar manualmente cada etapa.

O aplicativo será responsável por conduzir os intervalos, informar as transições por sinais visuais e sonoros, preservar o progresso e minimizar a necessidade de interação com o celular.

**Objetivo: deixar o usuário concentrado no exercício, enquanto o aplicativo controla o treino.**