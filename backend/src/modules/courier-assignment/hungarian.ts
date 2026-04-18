export interface AssignmentResult {
  assignment: number[];
  totalCost: number;
}

const INF = Infinity;

export function hungarian(cost: number[][]): AssignmentResult {
  const n = cost.length;
  if (n === 0) return { assignment: [], totalCost: 0 };
  if (cost[0].length !== n) {
    throw new Error(
      `hungarian() requires a square matrix, got ${n}×${cost[0].length}`,
    );
  }

  const u = new Array<number>(n + 1).fill(0);
  const v = new Array<number>(n + 1).fill(0);
  const p = new Array<number>(n + 1).fill(0);
  const way = new Array<number>(n + 1).fill(0);

  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array<number>(n + 1).fill(INF);
    const used = new Array<boolean>(n + 1).fill(false);

    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = INF;
      let j1 = 0;

      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }

      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }

      j0 = j1;
    } while (p[j0] !== 0);

    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }

  const assignment = new Array<number>(n).fill(-1);
  let totalCost = 0;
  for (let j = 1; j <= n; j++) {
    const row = p[j] - 1;
    if (row >= 0) {
      assignment[row] = j - 1;
      totalCost += cost[row][j - 1];
    }
  }

  return { assignment, totalCost };
}
