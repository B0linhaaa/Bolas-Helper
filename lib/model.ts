const FACT = [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880];

function poissonP(k: number, lambda: number): number {
  if (k < 0 || k >= FACT.length) return 0;
  return (Math.exp(-lambda) * lambda ** k) / FACT[k];
}

export type PoissonOut = {
  lambdaHome: number;
  lambdaAway: number;
  pHome: number;
  pDraw: number;
  pAway: number;
  pOver25: number;
  pBtts: number;
  pOver: (line: number) => number;
  pHomeCover: (line: number) => number;
};

function shrink(sample: number, prior: number, n: number, strength = 6): number {
  return (n * sample + strength * prior) / (n + strength);
}

export function fitPoisson(
  homeGames: { goalsFor: number; goalsAgainst: number }[],
  awayGames: { goalsFor: number; goalsAgainst: number }[],
  alreadyHome = 0,
  alreadyAway = 0,
  minutesPlayed = 0,
): PoissonOut {
  const hn = Math.max(homeGames.length, 1);
  const an = Math.max(awayGames.length, 1);
  const homeGf = homeGames.reduce((s, g) => s + g.goalsFor, 0) / hn;
  const homeGa = homeGames.reduce((s, g) => s + g.goalsAgainst, 0) / hn;
  const awayGf = awayGames.reduce((s, g) => s + g.goalsFor, 0) / an;
  const awayGa = awayGames.reduce((s, g) => s + g.goalsAgainst, 0) / an;

  let lambdaHome = shrink((homeGf + awayGa) / 2, 1.45, homeGames.length);
  let lambdaAway = shrink((awayGf + homeGa) / 2, 1.1, awayGames.length);
  lambdaHome = Math.min(4.2, Math.max(0.35, lambdaHome));
  lambdaAway = Math.min(3.5, Math.max(0.2, lambdaAway));

  const remaining = minutesPlayed > 0 ? Math.max(0, (90 - minutesPlayed) / 90) : 1;
  lambdaHome *= remaining;
  lambdaAway *= remaining;

  let pHome = 0;
  let pDraw = 0;
  let pAway = 0;
  let pBtts = 0;
  const max = 8;

  for (let i = 0; i <= max; i++) {
    for (let j = 0; j <= max; j++) {
      const p = poissonP(i, lambdaHome) * poissonP(j, lambdaAway);
      const hg = alreadyHome + i;
      const ag = alreadyAway + j;
      if (hg > ag) pHome += p;
      else if (hg === ag) pDraw += p;
      else pAway += p;
      if (hg > 0 && ag > 0) pBtts += p;
    }
  }

  const pOver = (line: number) => {
    let p = 0;
    for (let i = 0; i <= max; i++) {
      for (let j = 0; j <= max; j++) {
        const prob = poissonP(i, lambdaHome) * poissonP(j, lambdaAway);
        if (alreadyHome + i + alreadyAway + j > line) p += prob;
      }
    }
    return p;
  };

  const pHomeCover = (line: number) => {
    let p = 0;
    for (let i = 0; i <= max; i++) {
      for (let j = 0; j <= max; j++) {
        const prob = poissonP(i, lambdaHome) * poissonP(j, lambdaAway);
        if (alreadyHome + i - (alreadyAway + j) > -line) p += prob;
      }
    }
    return p;
  };

  return {
    lambdaHome,
    lambdaAway,
    pHome,
    pDraw,
    pAway,
    pOver25: pOver(2.5),
    pBtts,
    pOver,
    pHomeCover,
  };
}
