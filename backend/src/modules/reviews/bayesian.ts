export function bayesianAverage(
  sum: number,
  n: number,
  m: number,
  C: number,
): number {
  return (C * m + sum) / (C + n);
}

export const BAYESIAN_PRIOR_WEIGHT = 5;
