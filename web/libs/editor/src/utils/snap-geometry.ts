export type Point = { x: number; y: number };
export type Region = { vertices: Point[]; closed: boolean };
export type SnapModes = { vertex?: boolean; edge?: boolean; pixel?: boolean };

const KNOWN_MODES = new Set(["vertex", "edge", "pixel"]);

export function parseSnapModes(value: string): SnapModes {
  const modes: SnapModes = {};
  if (!value) return modes;
  for (const raw of value.split(",")) {
    const token = raw.trim().toLowerCase();
    if (KNOWN_MODES.has(token)) {
      (modes as Record<string, boolean>)[token] = true;
    }
  }
  return modes;
}

export function nearestVertex(point: Point, regions: Region[], threshold: number): Point | null {
  let best: Point | null = null;
  let bestDist = threshold;
  for (const region of regions) {
    for (const v of region.vertices) {
      const dx = v.x - point.x;
      const dy = v.y - point.y;
      const d = Math.hypot(dx, dy);
      if (d <= bestDist) {
        bestDist = d;
        best = { x: v.x, y: v.y };
      }
    }
  }
  return best;
}

export function nearestEdgeProjection(
  point: Point,
  regions: Region[],
  threshold: number,
): Point | null {
  let best: Point | null = null;
  let bestDist = threshold;
  for (const region of regions) {
    const vs = region.vertices;
    const n = vs.length;
    if (n < 2) continue;
    const limit = region.closed ? n : n - 1;
    for (let i = 0; i < limit; i++) {
      const a = vs[i];
      const b = vs[(i + 1) % n];
      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const len2 = abx * abx + aby * aby;
      if (len2 === 0) continue;
      const t = ((point.x - a.x) * abx + (point.y - a.y) * aby) / len2;
      if (t < 0 || t > 1) continue;
      const fx = a.x + t * abx;
      const fy = a.y + t * aby;
      const d = Math.hypot(point.x - fx, point.y - fy);
      if (d <= bestDist) {
        bestDist = d;
        best = { x: fx, y: fy };
      }
    }
  }
  return best;
}

export function findSnapTarget(
  point: Point,
  regions: Region[],
  threshold: number,
  modes: SnapModes,
): Point | null {
  if (modes.vertex) {
    const v = nearestVertex(point, regions, threshold);
    if (v) return v;
  }
  if (modes.edge) {
    return nearestEdgeProjection(point, regions, threshold);
  }
  return null;
}
