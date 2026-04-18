export const HELD_KARP_LIMIT = 12;

const EPSILON = 1e-9;

export function greedyNearestNeighbor(
  matrix: number[][],
  start: number,
): number[] {
  const n = matrix.length;
  const visited = new Array<boolean>(n).fill(false);
  const route: number[] = [start];
  visited[start] = true;

  let current = start;
  for (let step = 1; step < n; step++) {
    let best = -1;
    let bestDist = Infinity;
    for (let v = 0; v < n; v++) {
      if (visited[v]) continue;
      if (matrix[current][v] < bestDist) {
        bestDist = matrix[current][v];
        best = v;
      }
    }
    if (best === -1) break;
    route.push(best);
    visited[best] = true;
    current = best;
  }

  return route;
}

export function twoOptRefine(route: number[], matrix: number[][]): number[] {
  const n = route.length;
  if (n < 4) return route.slice();

  const result = route.slice();
  let improved = true;

  while (improved) {
    improved = false;
    for (let i = 0; i < n - 2; i++) {
      for (let j = i + 2; j < n - 1; j++) {
        const a = result[i];
        const b = result[i + 1];
        const c = result[j];
        const d = result[j + 1];

        const delta = matrix[a][c] + matrix[b][d] - matrix[a][b] - matrix[c][d];

        if (delta < -EPSILON) {
          reverseInPlace(result, i + 1, j);
          improved = true;
        }
      }
    }
  }

  return result;
}

function reverseInPlace(arr: number[], from: number, to: number): void {
  while (from < to) {
    [arr[from], arr[to]] = [arr[to], arr[from]];
    from++;
    to--;
  }
}

export function heldKarpExact(matrix: number[][], start: number): number[] {
  const n = matrix.length;
  if (n === 1) return [start];

  const FULL = (1 << n) - 1;
  const size = 1 << n;

  const dp = new Float64Array(size * n).fill(Infinity);
  const parent = new Int16Array(size * n).fill(-1);
  const idx = (mask: number, i: number) => mask * n + i;
  const bit = (i: number) => 1 << i;

  const startMask = bit(start);
  dp[idx(startMask, start)] = 0;

  for (let mask = 0; mask < size; mask++) {
    if (!(mask & bit(start))) continue;
    for (let last = 0; last < n; last++) {
      if (!(mask & bit(last))) continue;
      const base = dp[idx(mask, last)];
      if (!Number.isFinite(base)) continue;

      for (let next = 0; next < n; next++) {
        if (mask & bit(next)) continue;
        const newMask = mask | bit(next);
        const cand = base + matrix[last][next];
        if (cand < dp[idx(newMask, next)]) {
          dp[idx(newMask, next)] = cand;
          parent[idx(newMask, next)] = last;
        }
      }
    }
  }

  let bestEnd = -1;
  let bestCost = Infinity;
  for (let i = 0; i < n; i++) {
    if (i === start) continue;
    if (dp[idx(FULL, i)] < bestCost) {
      bestCost = dp[idx(FULL, i)];
      bestEnd = i;
    }
  }
  if (bestEnd === -1) return [start];

  const path: number[] = [];
  let mask = FULL;
  let curr: number = bestEnd;
  while (curr !== -1) {
    path.push(curr);
    const prev = parent[idx(mask, curr)];
    mask ^= bit(curr);
    curr = prev;
  }
  path.reverse();
  return path;
}

export interface TspResult {
  route: number[];
  totalDistance: number;
  solver: 'held-karp' | 'greedy+2opt' | 'greedy';
  greedyDistance?: number;
}

function routeLength(route: number[], matrix: number[][]): number {
  let sum = 0;
  for (let i = 0; i < route.length - 1; i++) {
    sum += matrix[route[i]][route[i + 1]];
  }
  return sum;
}

export function solveTSP(matrix: number[][], start: number): TspResult {
  const n = matrix.length;
  if (n <= 1) {
    return { route: [start], totalDistance: 0, solver: 'greedy' };
  }

  if (n <= HELD_KARP_LIMIT) {
    const route = heldKarpExact(matrix, start);
    return {
      route,
      totalDistance: routeLength(route, matrix),
      solver: 'held-karp',
    };
  }

  const greedy = greedyNearestNeighbor(matrix, start);
  const greedyDistance = routeLength(greedy, matrix);
  const refined = twoOptRefine(greedy, matrix);
  return {
    route: refined,
    totalDistance: routeLength(refined, matrix),
    solver: 'greedy+2opt',
    greedyDistance,
  };
}
