import type { TurnDirection, TurnInstruction } from '@/types/navigation';

function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6_371_000;
  const dLat = (bLat - aLat) * (Math.PI / 180);
  const dLng = (bLng - aLng) * (Math.PI / 180);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/** Bearing in degrees (0–360, CW from north) from point a to point b. */
function bearingDeg(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLng = (bLng - aLng) * Math.PI / 180;
  const lat1 = aLat * Math.PI / 180;
  const lat2 = bLat * Math.PI / 180;
  const x = Math.sin(dLng) * Math.cos(lat2);
  const y = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(x, y) * 180 / Math.PI + 360) % 360;
}

/** Signed turn angle in (-180, +180]. Positive = right, negative = left. */
function signedTurn(fromBearing: number, toBearing: number): number {
  let diff = toBearing - fromBearing;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff;
}

function classifyTurn(deg: number): TurnDirection {
  const a = Math.abs(deg);
  if (a < 20) return 'straight';
  if (deg < 0) {
    if (a < 45) return 'slight_left';
    if (a < 120) return 'left';
    return 'sharp_left';
  } else {
    if (a < 45) return 'slight_right';
    if (a < 120) return 'right';
    return 'sharp_right';
  }
}

function directionLabel(dir: TurnDirection): string {
  switch (dir) {
    case 'straight':     return 'Continue straight';
    case 'slight_left':  return 'Keep left';
    case 'left':         return 'Turn left';
    case 'sharp_left':   return 'Sharp left';
    case 'slight_right': return 'Keep right';
    case 'right':        return 'Turn right';
    case 'sharp_right':  return 'Sharp right';
    case 'arrive':       return 'Arrive at destination';
  }
}

/**
 * Derives turn-by-turn instructions from a decoded polyline.
 * @param coords  Array of [lat, lng] from polyline-codec decode()
 * @param minTurnDeg  Minimum bearing change to emit an instruction (default 20°)
 * @param minSegmentM  Merge consecutive turn points closer than this (default 15 m)
 */
export function extractTurns(
  coords: [number, number][],
  minTurnDeg = 20,
  minSegmentM = 15,
): TurnInstruction[] {
  if (coords.length < 2) return [];

  // Accumulate distances
  const cumDist: number[] = [0];
  for (let i = 1; i < coords.length; i++) {
    cumDist.push(cumDist[i - 1] + haversineM(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]));
  }

  const instructions: TurnInstruction[] = [];

  for (let i = 1; i < coords.length - 1; i++) {
    const inBearing  = bearingDeg(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
    const outBearing = bearingDeg(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]);
    const turn = signedTurn(inBearing, outBearing);
    const dir = classifyTurn(turn);

    if (dir === 'straight') continue;
    if (Math.abs(turn) < minTurnDeg) continue;

    const dist = cumDist[i];

    // Merge with the previous instruction if they are very close together
    const prev = instructions[instructions.length - 1];
    if (prev && dist - prev.distanceFromStart < minSegmentM) {
      // Keep the sharper turn
      if (Math.abs(turn) > Math.abs(signedTurn(
        bearingDeg(coords[prev.pointIndex - 1][0], coords[prev.pointIndex - 1][1], coords[prev.pointIndex][0], coords[prev.pointIndex][1]),
        bearingDeg(coords[prev.pointIndex][0], coords[prev.pointIndex][1], coords[prev.pointIndex + 1][0], coords[prev.pointIndex + 1][1]),
      ))) {
        instructions[instructions.length - 1] = { pointIndex: i, distanceFromStart: dist, direction: dir, label: directionLabel(dir) };
      }
      continue;
    }

    instructions.push({ pointIndex: i, distanceFromStart: dist, direction: dir, label: directionLabel(dir) });
  }

  // Arrival at the last point
  instructions.push({
    pointIndex: coords.length - 1,
    distanceFromStart: cumDist[coords.length - 1],
    direction: 'arrive',
    label: directionLabel('arrive'),
  });

  return instructions;
}
