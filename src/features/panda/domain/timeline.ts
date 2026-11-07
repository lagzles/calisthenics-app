import type { DemoPhase, DemoTrack, PandaPose, ResolvedTrack } from './pandaTypes'
import { easeInOutCubic, lerpPose } from './poseMath'

/**
 * Resolução temporal das demonstrações.
 *
 * Funções puras: recebem a track e um instante, devolvem a pose e a fase
 * correspondientes. Nenhuma dependência de DOM ou de React — o mesmo código
 * serve ao player (que anima com `requestAnimationFrame`) e ao fallback
 * estático usado quando o usuário prefere movimento reduzido.
 */

/** Normaliza o instante dentro do ciclo da track (considerando `loop`). */
export function normalizeElapsed(track: DemoTrack, elapsedMs: number): number {
  if (track.duration <= 0) return 0
  if (!track.loop) return Math.min(Math.max(elapsedMs, 0), track.duration)
  return ((elapsedMs % track.duration) + track.duration) % track.duration
}

/** Encontra o keyframe imediatamente anterior (e o seguinte) de um instante. */
function findSegment(track: DemoTrack, elapsed: number) {
  const frames = track.keyframes
  if (frames.length === 0) return null
  if (frames.length === 1) return { from: frames[0], to: frames[0] }

  let index = 0
  for (let i = 0; i < frames.length; i += 1) {
    if (frames[i].t <= elapsed) index = i
    else break
  }

  const from = frames[index]
  const to = frames[index + 1] ?? frames[index]
  return { from, to }
}

/** Pose interpolada em um instante da track. */
export function poseAt(track: DemoTrack, elapsedMs: number): PandaPose {
  const elapsed = normalizeElapsed(track, elapsedMs)
  const segment = findSegment(track, elapsed)
  if (!segment) return track.keyframes[0].pose

  const span = segment.to.t - segment.from.t
  if (span <= 0) return segment.from.pose

  const raw = (elapsed - segment.from.t) / span
  const eased = easeInOutCubic(Math.min(Math.max(raw, 0), 1))
  return lerpPose(segment.from.pose, segment.to.pose, eased)
}

/** Fase que contém o instante informado. */
export function phaseAt(track: DemoTrack, elapsedMs: number): DemoPhase {
  const elapsed = normalizeElapsed(track, elapsedMs)
  const phases = track.phases
  if (phases.length === 0) {
    return { id: 'none', label: '', from: 0, to: track.duration }
  }

  const found = phases.find((phase) => elapsed >= phase.from && elapsed < phase.to)
  if (found) return found

  // Instante exatamente no fim do ciclo: última fase.
  return phases[phases.length - 1]
}

/** Resolve a track completa (pose + fase + progresso) em um instante. */
export function resolveTrack(track: DemoTrack, elapsedMs: number): ResolvedTrack {
  const elapsed = normalizeElapsed(track, elapsedMs)
  return {
    pose: poseAt(track, elapsed),
    phase: phaseAt(track, elapsed),
    progress: track.duration > 0 ? elapsed / track.duration : 0,
  }
}

/**
 * Pose estática de uma fase — usada pela alternativa textual quando o
 * usuário prefere movimento reduzido.
 */
export function poseOfPhase(track: DemoTrack, phase: DemoPhase): PandaPose {
  return poseAt(track, phase.from)
}
