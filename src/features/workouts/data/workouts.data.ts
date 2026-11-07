import type { Exercise, Workout } from '../domain/types'
import { estimateWorkoutMinutes } from '../domain/workoutSelectors'

/**
 * Catálogo estático dos dois treinos do MVP.
 *
 * Decisão de produto: todos os exercícios disponíveis no MVP são executados por
 * tempo — 40 segundos de atividade e 3 séries — com descanso de 20 ou 30
 * segundos conforme o exercício. Não há exercícios por repetições nos treinos A
 * e B; o domínio continua suportando `executionType: 'reps'` para evoluções
 * futuras.
 *
 * `illustration` é a **chave** de um asset SVG local (ver
 * `exerciseIllustrations.ts`). A prancha aparece em A e B com a mesma chave,
 * reutilizando a mesma ilustração. `steps` e `tip` complementam `instructions`
 * com os passos de execução ("Como executar") e a dica de segurança.
 *
 * `estimatedMinutes` é **derivado** de `estimateWorkoutMinutes` (40s por série +
 * descanso entre séries, sem descanso após a última série de cada exercício),
 * evitando que a duração exibida divirja da configuração.
 *
 * A ordem dos exercícios no array define a ordem de execução (não há campo
 * `order`). Será eventualmente substituído/reforçado por dados persistidos
 * (IndexedDB).
 */

/** Completa a duração estimada a partir da configuração dos exercícios. */
function withEstimatedMinutes(workout: Omit<Workout, 'estimatedMinutes'>): Workout {
  const full: Workout = { ...workout, estimatedMinutes: 0 }
  return { ...full, estimatedMinutes: estimateWorkoutMinutes(full) }
}

const treinoAExercises: Exercise[] = [
  {
    id: 'a-agachamento',
    name: 'Agachamento livre',
    description: 'Fortalece pernas, glúteos e core.',
    illustration: 'squat',
    instructions:
      'Pés na largura dos ombros. Desça como se fosse sentar em uma cadeira, mantendo o tronco ereto, e suba empurrando o chão com os pés.',
    steps: [
      'Fique de pé com os pés na largura dos ombros.',
      'Desça o quadril como se fosse sentar em uma cadeira.',
      'Mantenha o tronco ereto e os joelhos alinhados com os pés.',
      'Suba empurrando o chão até voltar à posição inicial.',
    ],
    tip: 'Mantenha o peso nos calcanhares e o peito aberto durante toda a descida.',
    startPosition:
      'De pé, com os pés na largura dos ombros e as pontas levemente abertas para fora, com o peso distribuído em todo o pé.',
    breathing:
      'Inspire ao subir e expire ao descer; continue respirando normalmente e não prenda o ar.',
    posture: [
      'Tronco ereto, com o peito aberto e as costelas para baixo.',
      'Joelhos apontando na mesma direção das pontas dos pés, sem cruzar para dentro.',
      'Quadril descendo entre as pernas, com o peso apoiado nos calcanhares.',
    ],
    executionType: 'timed',
    sets: 3,
    workDuration: 40,
    restDuration: 30,
    commonMistakes: ['Joelhos apontando para dentro', 'Coluna curvada para frente'],
    adaptations: ['Apoie as mãos em uma cadeira', 'Reduza a amplitude do movimento'],
  },
  {
    id: 'a-flexao',
    name: 'Flexão com apoio',
    description: 'Trabalha peito, ombros e tríceps.',
    illustration: 'incline-push-up',
    instructions:
      'Mãos um pouco mais largas que os ombros, corpo em linha reta. Desça o peito até perto do apoio e empurre de volta.',
    steps: [
      'Apoie as mãos em uma superfície firme, um pouco mais largas que os ombros.',
      'Mantenha o corpo em linha reta da cabeça aos pés.',
      'Desça o peito em direção ao apoio com os cotovelos a 45°.',
      'Empurre o apoio e volte à posição inicial.',
    ],
    tip: 'Contraia o abdômen para não deixar o quadril cair.',
    startPosition:
      'De frente para o apoio, com as mãos um pouco mais largas que os ombros e o corpo em linha reta da cabeça aos calcanhares.',
    breathing:
      'Inspire na descida e expire ao empurrar o apoio de volta, sem prender a respiração.',
    posture: [
      'Corpo em linha reta: cabeça, quadril e calcanhares alinhados.',
      'Cotovelos apontando para trás, a cerca de 45° do tronco.',
      'Abdômen contraído, com o quadril nivelado e o pescoço em linha com a coluna.',
    ],
    executionType: 'timed',
    sets: 3,
    workDuration: 40,
    restDuration: 30,
    commonMistakes: ['Quadril caindo', 'Cabeça projetada à frente'],
    adaptations: ['Apoie as mãos em uma parede', 'Faça com os joelhos apoiados'],
  },
  {
    id: 'a-ponte',
    name: 'Elevação de pelve',
    description: 'Ativa glúteos e posterior de coxa.',
    illustration: 'glute-bridge',
    instructions:
      'Deitado de costas, joelhos flexionados e pés no chão. Eleve o quadril contraindo os glúteos e desça controladamente.',
    steps: [
      'Deite de costas com os joelhos flexionados e os pés no chão.',
      'Apoie os braços ao lado do corpo.',
      'Contraia os glúteos e eleve o quadril.',
      'Desça controladamente, sem relaxar totalmente.',
    ],
    tip: 'Suba pelo glúteo, evitando arquear a lombar.',
    startPosition:
      'Deitado de costas, com os joelhos flexionados, os pés apoiados no chão na largura do quadril e os braços ao lado do corpo.',
    breathing:
      'Expire ao elevar o quadril e inspire ao descer; mantenha a respiração durante a subida.',
    posture: [
      'Eleve contraindo os glúteos, sem arquear a lombar.',
      'Pés firmes no chão e joelhos paralelos entre si.',
      'Na posição alta, o quadril fica alinhado com o ombro e o joelho.',
    ],
    executionType: 'timed',
    sets: 3,
    workDuration: 40,
    restDuration: 20,
    commonMistakes: ['Empurrar com a lombar', 'Pés muito distantes do corpo'],
  },
  {
    id: 'a-prancha',
    name: 'Prancha',
    description: 'Isometria para o core.',
    illustration: 'plank',
    instructions:
      'Apoie os antebraços e as pontas dos pés, mantendo o corpo reto. Contraia abdômen e glúteos e respire normalmente.',
    steps: [
      'Apoie os antebraços no chão, alinhados abaixo dos ombros.',
      'Estenda as pernas e apoie as pontas dos pés.',
      'Alinhe cabeça, quadril e calcanhares em uma linha reta.',
      'Contraia abdômen e glúteos e respire normalmente.',
    ],
    tip: 'Mantenha o quadril neutro — nem alto demais, nem caído.',
    startPosition:
      'De joelhos, apoie os antebraços no chão alinhados abaixo dos ombros e estenda as pernas para trás.',
    breathing:
      'Respire normalmente e de forma contínua, sem prender o ar nem fazer apneias.',
    posture: [
      'Cabeça, quadril e calcanhares em uma linha reta.',
      'Abdômen e glúteos contraídos, com o quadril neutro.',
      'Cotovelos sob os ombros, sem pressionar o pescoço.',
    ],
    executionType: 'timed',
    sets: 3,
    workDuration: 40,
    restDuration: 30,
    commonMistakes: ['Quadril elevado demais', 'Quadril caído'],
    adaptations: ['Apoie os joelhos no chão'],
  },
  {
    id: 'a-polichinelo',
    name: 'Polichinelo',
    description: 'Eleva a frequência cardíaca.',
    illustration: 'jumping-jacks',
    instructions:
      'Salte abrindo as pernas e levantando os braços acima da cabeça, depois retorne. Mantenha um ritmo constante.',
    steps: [
      'Fique de pé com os pés juntos e os braços ao lado do corpo.',
      'Salte abrindo as pernas e levantando os braços acima da cabeça.',
      'Salte novamente para voltar à posição inicial.',
      'Mantenha um ritmo constante durante todo o tempo.',
    ],
    tip: 'Aterrisse com os joelhos levemente flexionados para absorver o impacto.',
    startPosition:
      'De pé, com os pés juntos e os braços ao lado do corpo.',
    breathing:
      'Inspire ao fechar as pernas e expire ao abri-las, mantendo um ritmo constante.',
    posture: [
      'Aterrisse com o peso na ponta dos pés e os joelhos levemente flexionados.',
      'Braços acompanhando as pernas, sem ultrapassar a altura da cabeça.',
      'Coluna ereta durante todo o movimento.',
    ],
    executionType: 'timed',
    sets: 3,
    workDuration: 40,
    restDuration: 20,
    commonMistakes: ['Aterrissagem rígida', 'Amplitude muito curta'],
    adaptations: ['Faça sem salto, alternando os pés'],
  },
]

const treinoBExercises: Exercise[] = [
  {
    id: 'b-corrida',
    name: 'Corrida estacionária',
    description: 'Ativa a circulação e o aquecimento.',
    illustration: 'running-in-place',
    instructions:
      'Corra parado no lugar, elevando os joelhos na altura do quadril. Mantenha o tronco ereto e a respiração constante.',
    steps: [
      'Fique de pé com o tronco ereto.',
      'Corra parado no lugar, elevando um joelho de cada vez.',
      'Eleve os joelhos na altura do quadril.',
      'Mantenha os braços em movimento e a respiração constante.',
    ],
    tip: 'Apoie o pé inteiro no chão; evite bater os calcanhares.',
    startPosition:
      'De pé, com o tronco ereto e os braços ao lado do corpo.',
    breathing:
      'Respire de forma ritmada, sem prender o ar, mantendo o ritmo da passada.',
    posture: [
      'Apoie o pé inteiro no chão, sem bater os calcanhares.',
      'Tronco ereto e olhar para a frente, sem inclinar o pescoço.',
      'Braços dobrados acompanhando o ritmo das pernas.',
    ],
    executionType: 'timed',
    sets: 3,
    workDuration: 40,
    restDuration: 20,
    commonMistakes: ['Apoiar todo o peso nos calcanhares', 'Curvar as costas'],
    adaptations: ['Reduza o ritmo', 'Eleve menos os joelhos'],
  },
  {
    id: 'b-wall-sit',
    name: 'Agachamento isométrico na parede',
    description: 'Resistência de pernas sem impacto.',
    illustration: 'wall-sit',
    instructions:
      'Encoste as costas na parede e deslize até os joelhos ficarem a 90°. Mantenha a posição pelo tempo indicado.',
    steps: [
      'Encoste as costas em uma parede firme.',
      'Deslize para baixo até os joelhos ficarem a 90°.',
      'Mantenha os pés afastados na largura do quadril.',
      'Segure a posição pelo tempo indicado, respirando normalmente.',
    ],
    tip: 'Mantenha os joelhos alinhados com os pés, sem passar das pontas.',
    startPosition:
      'De pé, de costas para a parede, com os pés um pouco à frente e afastados na largura do quadril.',
    breathing:
      'Mantenha a respiração contínua durante todo o tempo; nunca prenda o ar.',
    posture: [
      'Costas e cabeça apoiadas na parede.',
      'Joelhos a 90°, na mesma linha dos pés e sem passar da ponta dos pés.',
      'Peso distribuído entre os calcanhares e a ponta dos pés.',
    ],
    executionType: 'timed',
    sets: 3,
    workDuration: 40,
    restDuration: 30,
    commonMistakes: ['Joelhos além da ponta dos pés', 'Prender a respiração'],
    adaptations: ['Reduza o ângulo dos joelhos', 'Aumente a distância dos pés'],
  },
  {
    id: 'b-abdominal',
    name: 'Abdominal remador',
    description: 'Core com flexão de tronco.',
    illustration: 'abdominal-rower',
    instructions:
      'Sentado, pernas flexionadas e mãos apoiadas à frente. Suba o tronco aproximando o peito dos joelhos e retorne devagar.',
    steps: [
      'Sente-se com as pernas flexionadas e os pés apoiados.',
      'Estenda os braços à frente, na altura do peito.',
      'Suba o tronco aproximando o peito dos joelhos.',
      'Desça devagar, sem deitar totalmente.',
    ],
    tip: 'Expire ao subir e evite forçar o pescoço.',
    startPosition:
      'Sentado, com os pés apoiados no chão, as pernas flexionadas e os braços estendidos à frente.',
    breathing:
      'Expire ao subir o tronco e inspire ao descer, sem forçar o pescoço.',
    posture: [
      'Suba aproximando o peito dos joelhos, sem descer totalmente.',
      'Coluna neutra, sem arredondar as costas.',
      'Braços estendidos, sem se impulsionar para trás.',
    ],
    executionType: 'timed',
    sets: 3,
    workDuration: 40,
    restDuration: 30,
    commonMistakes: ['Travar o pescoço', 'Impulsionar com os braços'],
    adaptations: ['Faça com menor amplitude', 'Apoie os pés no chão'],
  },
  {
    id: 'b-pernas',
    name: 'Elevação de pernas deitado',
    description: 'Core inferior e abdômen.',
    illustration: 'lying-leg-raise',
    instructions:
      'Deitado de costas, mãos ao lado do corpo. Eleve as pernas estendidas até a vertical e desça sem tocar o chão.',
    steps: [
      'Deite de costas com as mãos ao lado do corpo.',
      'Mantenha as pernas estendidas e a lombar apoiada.',
      'Eleve as pernas até ficarem perpendiculares ao chão.',
      'Desça devagar sem tocar o chão.',
    ],
    tip: 'Use o abdômen para mover as pernas, sem arquear a lombar.',
    startPosition:
      'Deitado de costas, com as mãos ao lado do corpo e as pernas estendidas no chão.',
    breathing:
      'Expire ao elevar as pernas e inspire ao descer; não retenha a respiração.',
    posture: [
      'Lombar apoiada no chão, sem arquear.',
      'Pernas estendidas, com os joelhos levemente flexionados se houver tensão na lombar.',
      'O movimento vem do abdômen, sem embalo.',
    ],
    executionType: 'timed',
    sets: 3,
    workDuration: 40,
    restDuration: 30,
    commonMistakes: ['Arquear a lombar', 'Usar embalo'],
    adaptations: ['Flexione os joelhos', 'Eleve uma perna por vez'],
  },
  {
    id: 'b-prancha',
    name: 'Prancha',
    description: 'Isometria de core com maior tempo.',
    illustration: 'plank',
    instructions:
      'Apoie antebraços e pontas dos pés com o corpo alinhado. Contraia o abdômen e mantenha o quadril neutro.',
    steps: [
      'Apoie os antebraços no chão, alinhados abaixo dos ombros.',
      'Estenda as pernas e apoie as pontas dos pés.',
      'Alinhe cabeça, quadril e calcanhares em uma linha reta.',
      'Contraia abdômen e glúteos e respire normalmente.',
    ],
    tip: 'Mantenha o quadril neutro — nem alto demais, nem caído.',
    startPosition:
      'De joelhos, com os antebraços no chão alinhados abaixo dos ombros e as pernas estendidas para trás.',
    breathing:
      'Respire de forma contínua e regular, sem prender o ar durante a isometria.',
    posture: [
      'Cabeça, quadril e calcanhares em uma linha reta.',
      'Abdômen e glúteos contraídos, sem elevar nem baixar o quadril.',
      'Olhar para o chão, com o pescoço em linha com a coluna.',
    ],
    executionType: 'timed',
    sets: 3,
    workDuration: 40,
    restDuration: 30,
    commonMistakes: ['Quadril alto', 'Olhar para cima forçando o pescoço'],
    adaptations: ['Apoie os joelhos no chão'],
  },
]

export const workouts: Workout[] = [
  withEstimatedMinutes({
    id: 'A',
    name: 'Corpo inteiro',
    description: 'Condicionamento geral · iniciante',
    exercises: treinoAExercises,
  }),
  withEstimatedMinutes({
    id: 'B',
    name: 'Core e resistência',
    description: 'Fortalecimento do core · iniciante',
    exercises: treinoBExercises,
  }),
]
