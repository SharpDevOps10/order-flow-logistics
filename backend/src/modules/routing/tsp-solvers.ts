/**
 * TSP solvers that operate on a precomputed N×N distance matrix.
 * All solvers handle the OPEN variant (no return to start) and keep the
 * start vertex at position 0 of the result.
 */

/** Switch to Held-Karp below this size; greedy+2-opt above. */
export const HELD_KARP_LIMIT = 12;

/** Numerical tolerance for accepting improving swaps in 2-opt. */
const EPSILON = 1e-9;

// ─── Greedy nearest-neighbour ────────────────────────────────────────────────

/**
 * Starting at `start`, repeatedly jumps to the closest unvisited vertex.
 * O(n²) on a precomputed matrix.
 */
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
    if (best === -1) break; // unreachable — stop early
    route.push(best);
    visited[best] = true;
    current = best;
  }

  return route;
}

// ─── 2-opt local search ──────────────────────────────────────────────────────

/**
 * Iteratively removes edge crossings by reversing sub-paths.
 * The start vertex at position 0 is preserved (we never touch it).
 *
 * Each pass is O(n²); typically converges in 2–5 passes.
 */
export function twoOptRefine(route: number[], matrix: number[][]): number[] {
  const n = route.length;
  if (n < 4) return route.slice(); // no non-adjacent pairs to swap

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

        // Cost change if we replace edges (a,b) + (c,d) with (a,c) + (b,d)
        // which reverses the segment result[i+1..j].
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

// ─── Held-Karp exact DP (bitmask) ────────────────────────────────────────────

/**
 * Exact TSP for small instances via bitmask dynamic programming.
 *
 *   dp[mask][i] = minimum cost of a path that starts at `start`, visits
 *                 exactly the vertices in `mask`, and ends at vertex `i`.
 *
 * For OPEN TSP we take the minimum over all final vertices ≠ start
 * (no return-to-start term).
 *
 * Complexity: O(n² · 2ⁿ) time, O(n · 2ⁿ) memory.
 * Feasible up to ~12–15 vertices.
 */
export function heldKarpExact(matrix: number[][], start: number): number[] {
  const n = matrix.length;
  if (n === 1) return [start];

  const FULL = (1 << n) - 1;
  const size = 1 << n;

  // dp and parent as flat typed arrays for speed.
  const dp = new Float64Array(size * n).fill(Infinity);
  const parent = new Int16Array(size * n).fill(-1);
  const idx = (mask: number, i: number) => mask * n + i;

  dp[idx(1 << start, start)] = 0;

  for (let mask = 0; mask < size; mask++) {
    if (!(mask & (1 << start))) continue;
    for (let last = 0; last < n; last++) {
      if (!(mask & (1 << last))) continue;
      const base = dp[idx(mask, last)];
      if (!Number.isFinite(base)) continue;

      // Try extending the path by one unvisited vertex.
      for (let next = 0; next < n; next++) {
        if (mask & (1 << next)) continue;
        const newMask = mask | (1 << next);
        const cand = base + matrix[last][next];
        if (cand < dp[idx(newMask, next)]) {
          dp[idx(newMask, next)] = cand;
          parent[idx(newMask, next)] = last;
        }
      }
    }
  }

  // Open-TSP: pick the best ending vertex (any except start).
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

  // Reconstruct path by walking parent pointers backwards.
  const path: number[] = [];
  let mask = FULL;
  let curr: number = bestEnd;
  while (curr !== -1) {
    path.push(curr);
    const prev = parent[idx(mask, curr)];
    mask ^= 1 << curr;
    curr = prev;
  }
  path.reverse();
  return path;
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────

export interface TspResult {
  /** Final ordered vertex indices (starts with `start`). */
  route: number[];
  /** Total route length based on the distance matrix. */
  totalDistance: number;
  /** Which algorithm was used. */
  solver: 'held-karp' | 'greedy+2opt' | 'greedy';
  /** For 'greedy+2opt': distance before 2-opt refinement (for logging/benchmarks). */
  greedyDistance?: number;
}

/** Total length of a route on the given matrix. */
function routeLength(route: number[], matrix: number[][]): number {
  let sum = 0;
  for (let i = 0; i < route.length - 1; i++) {
    sum += matrix[route[i]][route[i + 1]];
  }
  return sum;
}

/**
 * Chooses the right TSP algorithm for the problem size:
 *  - n ≤ HELD_KARP_LIMIT → exact optimum via Held-Karp
 *  - n >  HELD_KARP_LIMIT → greedy NN + 2-opt refinement
 */
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
