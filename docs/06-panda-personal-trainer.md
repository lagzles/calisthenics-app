# Especificação Visual e Funcional — Panda Personal Trainer

**Projeto:** App de Calistenia  
**Versão:** 2.0  
**Status:** Nova direção aprovada conceitualmente

## 1. Conceito

O panda será o Personal Trainer Virtual do aplicativo.

Sua função principal será ensinar, demonstrar e orientar a execução correta dos exercícios de calistenia, além de incentivar o usuário durante sua jornada.

Não será apenas um elemento decorativo.

## 2. Identidade visual

- Estilo minimalista e vetorial.
- Aparência amigável, mas não infantil.
- Expressividade facial discreta.
- Formas arredondadas e simples.
- Corpo predominantemente branco.
- Orelhas e manchas pretas.
- Pulseira esportiva verde.
- Fundo transparente.

## 3. Consistência do personagem

Todas as ilustrações e animações deverão utilizar o mesmo personagem-base.

Preservar:
- Formato do rosto.
- Proporções corporais.
- Posição e formato das manchas.
- Olhos e focinho.
- Paleta de cores.
- Acessórios.

A identidade não poderá mudar entre exercícios ou telas.

## 4. Personalidade e responsabilidades

O panda deverá:
- Ensinar como executar os exercícios.
- Demonstrar movimentos.
- Explicar posições iniciais e finais.
- Orientar postura e alinhamento corporal.
- Apresentar dicas de execução.
- Alertar sobre erros comuns.
- Incentivar durante o treino.
- Comemorar conquistas.

Tom de comunicação: amigável, didático, paciente e motivador.

## 5. Modelo híbrido de animações

### 5.1 Animações de personalidade

Utilizadas em momentos de interação:

- Welcome.
- Ready.
- Rest.
- Encouraging.
- Celebrating.
- Streak.
- Idle.

### 5.2 Animações instrutivas

Cada exercício deverá possuir uma demonstração específica, respeitando sua biomecânica.

Quando aplicável, apresentar:
- Posição inicial.
- Fase de execução.
- Posição final.
- Retorno à posição inicial.

As demonstrações devem ser repetíveis e pausáveis.

Não utilizar uma animação genérica para representar exercícios biomecanicamente diferentes.

## 6. Orientações por exercício

Cada exercício deverá ter informações estruturadas:

- Nome.
- Objetivo.
- Posição inicial.
- Instruções de execução.
- Respiração.
- Dicas de postura.
- Erros comuns.
- Animação demonstrativa.

As instruções devem ser tecnicamente revisadas.

## 7. Tecnologias e implementação

- Preferência por SVG e animações vetoriais leves.
- Avaliar tecnologia adequada para movimentos complexos.
- Assets locais.
- Funcionamento offline obrigatório.
- Componente React reutilizável.
- Separação entre apresentação visual e lógica dos exercícios.
- Suporte a dispositivos móveis.
- Respeitar prefers-reduced-motion.

## 8. Relação com stick figures

O panda será o protagonista das demonstrações e orientações.

Os stick figures poderão permanecer como apoio visual complementar, desde que não dupliquem ou prejudiquem a experiência instrutiva.

## 9. Critérios de aceitação

- Personagem visualmente consistente.
- Demonstrações específicas por exercício.
- Movimentos coerentes com a execução real.
- Instruções sincronizadas com as demonstrações, quando aplicável.
- Assets funcionam offline.
- Performance adequada em dispositivos móveis.
- Alternativa estática acessível.
- Conteúdo técnico validado.
- Separação entre lógica de treino e apresentação do mascote.

**Princípio central:** o panda não apenas acompanha o treino. Ele ensina o usuário a treinar corretamente.