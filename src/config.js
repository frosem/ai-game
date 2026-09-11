// Single source of truth for every tunable value in the game.
// If a number affects gameplay, feel or balance, it belongs here and nowhere else.
// Values written [a, b] are interpolated across the match by difficulty = elapsed / MATCH_SECONDS.

export const CONFIG = {
  MATCH_SECONDS: 120,
  VIRTUAL_W: 1600,
  VIRTUAL_H: 900,

  player: {
    hearts: 3,
    driftX: 40,
    accel: 1400,
    maxSpeed: 520,
    drag: 4.0,
    aimLerp: 1.0,
    hitRadius: 22,
    FIRE_COOLDOWN_MS: 180,
    boltSpeed: 1400,
    boltLife: 1.2,
    boltDamage: 1,
    invulnSeconds: 1.2,
    muzzleOffset: 30,
    bankFactor: 0.0006,
  },

  force: {
    radius: 130,
    capacity: 100,
    drainPerSec: 70,
    regenPerSec: 10,
    regenDelay: 0.9,
    minToActivate: 25,
    emptyLockout: 2.0,
    disablesWeapons: true,
    stopsRedBolts: true,
    stopsIonBolts: true,
    stopsAsteroids: true,
  },

  convoy: {
    hearts: 3,
    graceSeconds: 1.5,
    baseX: 360,
    baseY: 450,
    sineAmpY: 130,
    sineSpeedY: 0.7,
    sineAmpX: 45,
    sineSpeedX: 0.45,
    hitRadius: 60,
  },

  enemy: {
    hpScale: [1.0, 1.0],
    ramKnockback: 500,
    fireJitter: [0.9, 1.1],
    telegraphChargeDelay: 0.2,
    arriveDistance: { interceptor: 40, standoff: 120 },
    spawnBandRightChance: 0.6,
    spawnBandTopChance: 0.2,
    spawnEdgeOffset: 60,
    clampY: 40,
    interceptor: {
      hp: 1, speed: 340, hitRadius: 26,
      fireIntervalSeconds: 1.8, telegraphSeconds: 0.35,
      boltSpeed: 520, points: 100, targets: 'player',
      boltShootable: true, standoff: 240,
    },
    gunship: {
      hp: 2, speed: 120, hitRadius: 42,
      fireIntervalSeconds: 2.4, telegraphSeconds: 0.8,
      boltSpeed: 440, points: 150, targets: 'convoy',
      boltShootable: true, standoff: 640,
    },
    lancer: {
      hp: 3, speed: 70, hitRadius: 48,
      fireIntervalSeconds: 4.0, telegraphSeconds: 1.6,
      boltSpeed: 300, points: 250, targets: 'convoy',
      boltShootable: false, standoff: 820,
    },
    rammingDamage: 1,
    despawnMargin: 300,
  },

  asteroid: {
    INSTAKILL: false,
    damageToPlayer: 1,
    damageToConvoy: 1,
    speed: [160, 340],
    hpScale: [1.0, 1.0],
    sizes: {
      small: { r: 18, hp: 1, points: 50 },
      medium: { r: 34, hp: 3, points: 75 },
      large: { r: 56, hp: Infinity, points: 0 },
    },
    largeDestructible: false,
    sizeWeights: [0.55, 0.30, 0.15],
    largeChance: [0.05, 0.25],
    intervalSeconds: [6.0, 2.0],
    knockback: 900,
    shakeOnHit: 18,
    despawnMargin: 200,
    spawnOffset: 90,
    speedJitter: [0.9, 1.1],
  },

  bolt: {
    redR: 6,
    ionR: 11,
    playerR: 5,
    enemyRedLife: 2.0,
    enemyIonLife: 4.0,
  },

  spawn: {
    enemyIntervalSeconds: [2.2, 0.55],
    maxEnemies: [3, 11],
    maxAsteroids: [2, 7],
    lancerShare: [0.10, 0.40],
    jitter: 0.25,
    minDistanceFromPlayer: 250,
    maxIonBoltsInFlight: 2,
    ionSpacingSeconds: 0.8,
    finalSurgeAtSeconds: 100,
    finalSurgeFactor: 0.8,
    retryInterval: 0.25,
    initialEnemyTimer: 1.0,
    initialAsteroidTimer: 2.5,
  },

  score: {
    enemyKill: 100,
    boltShotDown: 25,
    forceSave: 150,
    asteroidDeflect: 200,
    survivalPerSec: 10,
    comboStep: 0.1,
    comboMax: 5.0,
    comboLingerSeconds: 3.0,
    comboLingerDrainPerSec: 0.35,
    victoryBonus: 2000,
    heartBonus: 500,
  },

  fx: {
    particleCap: 400,
    shakeDecay: 6.0,
    muzzleFlashSeconds: 0.06,
    forcePulseSpeed: 6.0,
  },

  cinematic: {
    // In-engine scripted dogfight. Times are seconds into the scene.
    totalSeconds: 17.5,
    fadeSeconds: 0.4,
    crestEnterSeconds: 2.4,
    killsAtSeconds: [3.0, 4.1, 5.2, 6.3],
    ionFireSeconds: 8.0,
    ionHitSeconds: 9.2,
    forceSeconds: 10.4,
    shoveSeconds: 13.0,
    lukeSeconds: 13.8,
    captionTimes: [0, 2.4, 7.3, 9.8, 13.4],
  },

  slowmo: {
    convoySave3Seconds: 1.5,
  },

  audio: {
    masterVolume: 0.6,
  },
};

// ---------------------------------------------------------------------------
// Math helpers. Kept here so no gameplay magic numbers leak into other files.
// ---------------------------------------------------------------------------

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function randRange(a, b) {
  return a + Math.random() * (b - a);
}

export function randInt(a, b) {
  return Math.floor(randRange(a, b + 1));
}

export function chance(p) {
  return Math.random() < p;
}

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function lerpPair(pair, t) {
  return lerp(pair[0], pair[1], t);
}

export function difficultyAt(elapsed, matchSeconds = CONFIG.MATCH_SECONDS) {
  return clamp(elapsed / matchSeconds, 0, 1);
}