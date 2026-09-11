# SDD — "Force of the Last Jedi" (working title)

Software Design Document. Status: **PLANNING — REVISION 2**. No implementation code yet.

> **Revision 2 supersedes any conflicting value below.** Budget is **4 hours total**.
> See §17 (decisions delta) and §18 (4-hour execution plan). Sections 15 and 16 of
> revision 1 are superseded by §18.

Owner: JP Carrasco · Art: (teammate) · Target: browser game, public URL, popular-vote contest.

---

## 1. Concept

Side-scrolling escort shooter. Player flies Luke Skywalker's X-wing and must keep the
Mandalorian's ship (Razor Crest + Grogu aboard) alive for 120 seconds while its hyperdrive
charges.

The whole game is built on **one hard trade-off**: the player cannot shoot and use the Force
at the same time. Shooting handles most threats. Some threats can *only* be stopped by the
Force. Using the Force disarms the player and leaves them exposed. Every Force use is a
gamble with the player's own hearts.

When the player fails to stop a hit on the convoy, Grogu saves the ship himself — and that
costs Grogu. Three saves and he's spent. The convoy's health bar *is* Grogu's stamina, which
is why losing it is a story beat and not just a game over.

---

## 2. Requirement traceability

Every contest rule mapped to a concrete feature, so nothing is lost at demo time.

| # | Rule | How it is satisfied | Verify by |
|---|------|---------------------|-----------|
| R1 | Team of 2–3 | JP (code/design) + artist (+1 optional) | Credits screen |
| R2 | Player controls a ship | Luke's X-wing, mouse-aimed | Playable |
| R3 | Ship never stops moving | Constant drift velocity; input nudges only, no zero-velocity state. Enforced in `player.update()` by a floor on speed | Code assertion + visual |
| R4 | Ship can shoot | Click to fire, cooldown-gated | Playable |
| R5 | Must protect another ship/convoy | Convoy ship with 3 hearts; its death = loss | Playable |
| R6 | Scoring system | Points + combo multiplier + end bonus, HUD live, local high score | HUD + results screen |
| R7 | Loss condition | Player hearts 0 **or** convoy hearts 0 | Two distinct game-over screens |
| R8 | Restart quickly | `R` key / click, in-memory reset, no page reload, cinematic auto-skipped | < 500 ms, measured |
| R9 | Match ≤ 2 minutes | Hard 120 s match clock = hyperdrive charge bar. Win at 120 s | Timer visible |
| R10 | Published at accessible URL | Static site, GitHub Pages | Public link |
| R11 | Explain AI usage | AI usage record + a title-screen "How we built this" panel | Document |

Cinematic sits **outside** the 120 s clock (rule R9 covers the match only) and is skippable.

---

## 3. Design decisions (locked)

Confirmed with the product owner:

- **Aiming/shooting**: mouse reticle, click to fire, enforced cooldown between shots. Fire
  rate is a config value, tunable per difficulty. Not a held-down hose.
- **Stage**: side-scrolling escort, left-to-right.
- **Difficulty**: ramps continuously with elapsed match time via spawn-rate interpolation.
- **Spawning**: enemy and asteroid spawn positions are randomized.
- **Asteroids**: move **linearly** from a spawn point `(x1,y1)` to a target point `(x2,y2)`,
  both chosen at spawn time. Constant velocity, no curves, no acceleration.
- **Art**: placeholder procedural art now; teammate's art drops in later behind an asset
  abstraction layer. Behavior is built first and must not depend on final art dimensions.

### 3.1 Open decisions (need an answer before M1)

| ID | Question | Default I will assume if unanswered |
|----|----------|-------------------------------------|
| O1 | Movement keys: `WASD`/arrows nudging a constantly drifting ship? | Yes — WASD nudge + constant drift, mouse for aim only |
| O2 | Force input | Hold right mouse button; `Space` as alternate |
| O3 | Mobile/touch support required? | Desktop-first; touch = virtual stick + 2 buttons, only if time remains |
| O4 | Audio on by default? | Start muted, prominent unmute button (voters play in offices) |
| O5 | Leaderboard | `localStorage` personal best only, no server |
| O6 | Cinematic format | In-engine scripted scene (reuses renderer, no video hosting, skippable, cheap) |

---

## 4. Tech stack

- **Vanilla JS, native ES modules, Canvas 2D.** No framework, no bundler, no build step.
- **Zero runtime dependencies.**
- Static hosting: **GitHub Pages** (`git push` = deploy).
- Audio: WebAudio synthesized SFX + one CC0 music loop.

Rationale: a broken build pipeline the night before a demo is the single most common way a
game jam entry dies. `index.html` + ES modules runs from any static host and from `file://`
with a local server. Nothing to compile, nothing to break.

Hard constraint: **60 fps on a mid laptop with ~120 live entities.** Canvas 2D handles this
comfortably if we avoid per-frame allocation and use object pools for bolts and particles.

---

## 5. Architecture

### 5.1 File layout

```
index.html
styles.css
src/
  main.js            boot, RAF loop, fixed-timestep accumulator, state machine
  config.js          ALL tunables in one exported object (single source of truth)
  input.js           keyboard + mouse, reticle position in world space
  assets.js          asset manifest + loader + procedural placeholder fallbacks
  render.js          camera, layers, starfield parallax, draw order
  audio.js           WebAudio SFX + music, master mute
  ui.js              HUD (hearts, force meter, score, hyperdrive bar), screens
  cinematic.js       scripted intro scene, skippable
  entities/
    player.js  convoy.js  enemy.js  bolt.js  asteroid.js  particle.js
  systems/
    spawn.js         difficulty director
    collision.js     broad phase + resolution
    force.js         Force field activation, targeting, deflection
    score.js         points, combo, high score persistence
    dialog.js        Grogu/Mando bark queue
assets/              teammate's art lands here (see §11)
docs/
  SDD.md  AI usage record
```

### 5.2 Game state machine

`BOOT → TITLE → CINEMATIC → PLAYING → (PAUSED) → GAMEOVER_PLAYER | GAMEOVER_CONVOY | VICTORY → PLAYING`

- `CINEMATIC` is entered only on the first play of a session, or explicitly from a title
  screen "Story" button. `SKIP` is available on frame 1.
- Restart from any game-over state jumps **straight to `PLAYING`**, never through the
  cinematic. This is rule R8.

### 5.3 Loop

Fixed timestep `dt = 1/60` with an accumulator, render interpolation off (not needed at this
scale). Update order per tick:

```
input → player → convoy → enemies → bolts → asteroids → force field
      → collisions → score/combo → spawn director → dialog → particles → hud
```

Determinism note: a single seeded PRNG (`mulberry32`) drives all spawn randomness. A seed is
stored per run, so any bug report ("enemy spawned inside the convoy") is reproducible.

### 5.4 Coordinate system

Virtual resolution **1600 × 900**, letterboxed and scaled to the canvas. All config values,
speeds and hitboxes are in virtual units, so art swaps and window resizes never retune the
game.

---

## 6. Entities

### 6.1 Player — Luke's X-wing

| Property | Value (initial) |
|---|---|
| Hearts | 3 |
| Drift | constant `+40 u/s` on X, never zero (rule R3) |
| Nudge accel | `1400 u/s²`, max speed `520 u/s`, drag `4.0/s` |
| Hitbox | circle, r = 22 |
| Fire cooldown | `FIRE_COOLDOWN_MS = 180` (**parametrized**, see §9) |
| Projectile | speed `1400 u/s`, damage 1, lifetime 1.2 s |
| Invulnerability after hit | 1.2 s, blinking |

Aim: reticle follows the mouse; the ship's cannons rotate toward it; click fires one shot if
the cooldown has elapsed. Cooldown is shown as a thin ring on the reticle so the player can
read their own rate of fire.

### 6.2 Convoy — the Razor Crest (Mando + Grogu)

- Hearts: 3. **These are Grogu's Force saves, not hull plating.**
- Not player-controlled. Flies a gentle scripted sine path across the mid-left of the screen.
- Any incoming damage that reaches it consumes one heart, triggers a green Force-bubble
  effect, a Grogu vocalisation and a Mando bark (§8).
- Hearts 0 → `GAMEOVER_CONVOY`, the emotional loss screen.
- 1.5 s grace window after each save, so one dense volley cannot delete all three hearts.

### 6.3 Enemies

Three archetypes, all spawning at randomized positions on the right edge and the top/bottom
bands:

| Type | Behavior | Fires | Threat |
|---|---|---|---|
| **Interceptor** | Fast strafing run, dives at the player | Red bolts, quick, low telegraph | Pressures the player |
| **Gunship** | Slow, parks at range, locks onto the **convoy** | Red bolts at the convoy | Shootable if the player is on time |
| **Ion Lancer** | Very slow, long 1.6 s telegraph, visible charging aim line to the convoy | **Purple ion bolt — indestructible by gunfire** | **Force-only.** This is the enemy that creates the game |

Telegraph is mandatory and generous: a growing charge glow plus a dotted aim line from the
lancer to its target. That line is the player's cue to stop shooting and commit to the Force.

**Enemy health is fully parametrized** (`CONFIG.enemy`, §9). Defaults: Interceptor 1,
Gunship 2, Ion Lancer 3 — so ignoring a Lancer for too long is not recoverable by a single
panic shot. Every per-type stat (hp, speed, fire interval, telegraph duration, point value)
is a config value, and a global `hpScale` multiplier can make the late match tankier without
touching per-type numbers. See §19 for the full knob list.

### 6.4 Bolts

Pooled. Two classes, deliberately colour-coded and never mixed:

- `RED` — destructible. Player fire destroys it. Awards points.
- `PURPLE / ION` — immune to gunfire. Only the Force stops it. Visibly crackling, slower,
  larger, distinct sound on spawn.

Colour-coding is a hard rule: if a player ever has to guess whether a bolt is shootable, the
core mechanic is broken.

### 6.5 Asteroids — linear trajectory spec

Per the locked decision, asteroids travel in a straight line between two points fixed at
spawn:

```js
// spawn-time computation, then never recomputed
const start = randomPointOnSpawnBand();          // (x1, y1)
const end   = randomPointOnOppositeBand();       // (x2, y2)
const dx = end.x - start.x, dy = end.y - start.y;
const len = Math.hypot(dx, dy);
asteroid.vx = (dx / len) * speed;                // constant velocity
asteroid.vy = (dy / len) * speed;                // no acceleration, no steering
asteroid.spin = rand(-1.2, 1.2);                 // visual only
```

Because start and end are independently randomized, trajectories cross the playfield at
varied angles instead of only right-to-left — this is what makes them read as hazards rather
than as enemies.

- Speed: `lerp(160, 340, difficulty)` u/s.
- Sizes and health are parametrized per size class: small (r 18, hp 1), medium (r 34, hp 3),
  large (r 56, **not destructible by gunfire — Force or dodge only**, via
  `largeDestructible: false`). Flip that flag and set a finite hp to make large asteroids
  shootable. A global `hpScale` multiplier covers all size classes at once.
- Damage to player: **1 heart** plus strong knockback and screen shake, *not* an instant
  kill. Rationale below.
- Damage to convoy: 1 heart (Grogu save).
- Despawn once fully outside the playfield bounds + margin.

**On instant death:** the original pitch had asteroids one-shotting the player. I recommend
against it and have specced 1 heart. A player who is told "you have 3 hearts" and then dies
in one frame reads it as a bug, not as difficulty — and in a popular-vote contest a confused
player is a lost vote. The intensity comes back through knockback, shake and the fact that
large asteroids cannot be shot at all. If you still want the instakill, it is a one-line
config flag (`ASTEROID_INSTAKILL: false`) and we can A/B it on playtesters.

### 6.6 Force field (the mechanic)

While the Force input is held:

1. **Guns go offline.** Firing is rejected. The reticle visibly changes to a Force glyph.
2. A telekinetic field appears, centered on the reticle, radius `FORCE_RADIUS = 150`.
3. Any ion bolt entering the field is **destroyed** (deflected into a particle burst).
4. Any asteroid entering the field has its velocity vector **redirected away** from the
   convoy — a direct callback to Grogu shoving the ship into the asteroid in the cinematic.
5. The player remains **fully vulnerable**. No invulnerability, no slowdown of incoming fire.
6. The Force meter drains.

| Property | Value |
|---|---|
| Meter capacity | 100 |
| Drain | `45 / s` while held |
| Regen | `14 / s`, after a `0.6 s` delay from release |
| Minimum to activate | 18 |
| Empty lockout | `1.5 s`, meter flashes red |

Targeting: **area, not pixel-precise aim.** The player positions a field, they do not snipe
individual bolts. The skill is in reading telegraphs, choosing when to disarm, and body
positioning — not in mouse precision. This also keeps a touch port viable.

---

## 7. Spawn director & difficulty

`difficulty = clamp(elapsed / MATCH_SECONDS, 0, 1)`, driving continuous interpolation. No
discrete wave table to author and balance.

| Parameter | t = 0 s | t = 120 s |
|---|---|---|
| Enemy spawn interval | 2.2 s | 0.55 s |
| Asteroid spawn interval | 6.0 s | 2.0 s |
| Max concurrent enemies | 3 | 11 |
| Max concurrent asteroids | 2 | 7 |
| Ion Lancer share of spawns | 10 % | 40 % |
| Asteroid speed | 160 u/s | 340 u/s |
| Large-asteroid chance | 5 % | 25 % |

Spawn intervals carry ±25 % jitter so the rhythm never becomes metronomic.

**Final surge:** at `t = 100 s` the music shifts, the hyperdrive bar pulses, and spawn
intervals take an extra 20 % cut. The last 20 seconds should feel barely survivable — that is
the clip people share.

**Anti-frustration guarantees**, enforced by the director:
- Never more than 2 ion bolts in flight at once (the Force cannot be in two places).
- No spawn within 250 u of the player's current position.
- 0.8 s minimum spacing between ion-bolt firings from different lancers.

---

## 8. Dialog system

A non-blocking bark queue. Bubbles render above the speaking ship, ~1.3 s, large readable
font, paired with audio. **No modal boxes during gameplay** — nobody reads text while dodging.

Grogu's save barks, in order, tied to the convoy's remaining hearts:

| Save # | Grogu | Mando | Presentation |
|---|---|---|---|
| 1 | *"Patu!"* (coo) | **"That was amazing!"** | Bark bubble, green bubble flash |
| 2 | *(strained whimper)* | **"No! You're getting tired!"** | Bark bubble, screen edges tint red, music filter |
| 3 | *(silence)* | **"Sorry, Grogu…"** | **Slow-motion 1.5 s**, everything else freezes, then the explosion → `GAMEOVER_CONVOY` |

The third one is the only place the game stops the action, and it earns it — it *is* the loss
screen. Beat 2 must also change the HUD, not only speak: Grogu's portrait visibly droops.

---

## 9. Configuration — single source of truth

Everything tunable lives in `src/config.js`. No magic numbers anywhere else. This is what
makes the difficulty-tuning pass on the last day possible at all, and it is what the
"parametrized fire rate" request needs.

```js
export const CONFIG = {
  MATCH_SECONDS: 120,
  VIRTUAL_W: 1600, VIRTUAL_H: 900,

  player: {
    hearts: 3,
    driftX: 40,              // rule R3: never zero
    accel: 1400, maxSpeed: 520, drag: 4.0,
    hitRadius: 22,
    FIRE_COOLDOWN_MS: 180,   // <- primary difficulty knob
    boltSpeed: 1400, boltLife: 1.2,
    invulnSeconds: 1.2,
  },

  force: {
    radius: 150,
    capacity: 100, drainPerSec: 45, regenPerSec: 14,
    regenDelay: 0.6, minToActivate: 18, emptyLockout: 1.5,
    disablesWeapons: true,   // the whole design; do not flip casually
  },

  convoy: { hearts: 3, graceSeconds: 1.5 },

  // ---- ENEMY HEALTH & STATS: all parametrized for difficulty tuning ----
  enemy: {
    hpScale: [1.0, 1.0],     // global hp multiplier, lerped over the match.
                             // e.g. [1.0, 2.0] = enemies twice as tanky by 120s
    interceptor: {
      hp: 1, speed: 340, hitRadius: 26,
      fireIntervalSeconds: 1.8, telegraphSeconds: 0.35,
      boltSpeed: 520, points: 100, targets: 'player',
    },
    gunship: {
      hp: 2, speed: 120, hitRadius: 42,
      fireIntervalSeconds: 2.4, telegraphSeconds: 0.8,
      boltSpeed: 440, points: 150, targets: 'convoy',
    },
    lancer: {
      hp: 3, speed: 70, hitRadius: 48,
      fireIntervalSeconds: 4.0, telegraphSeconds: 1.6,   // long tell = the Force window
      boltSpeed: 300, points: 250, targets: 'convoy',
      boltShootable: false,   // ion bolt ignores gunfire
    },
    rammingDamage: 1,        // hearts lost when an enemy ship hits the player
  },

  // ---- ASTEROID HEALTH & MOTION: all parametrized ----
  asteroid: {
    INSTAKILL: false,        // see SDD 6.5
    damageToPlayer: 1, damageToConvoy: 1,
    speed: [160, 340],       // lerped by difficulty
    hpScale: [1.0, 1.0],     // global hp multiplier across all size classes
    sizes: {
      small:  { r: 18, hp: 1,        points: 50  },
      medium: { r: 34, hp: 3,        points: 75  },
      large:  { r: 56, hp: Infinity, points: 0   },  // see largeDestructible
    },
    largeDestructible: false,  // true + a finite large.hp = large rocks become shootable
    sizeWeights: [0.55, 0.30, 0.15],  // small / medium / large draw weights
    largeChance: [0.05, 0.25],
    intervalSeconds: [6.0, 2.0],
    knockback: 900, shakeOnHit: 18,
  },

  spawn: {
    enemyIntervalSeconds: [2.2, 0.55],
    maxEnemies: [3, 11],
    lancerShare: [0.10, 0.40],
    jitter: 0.25,
    minDistanceFromPlayer: 250,
    maxIonBoltsInFlight: 2,
    finalSurgeAtSeconds: 100, finalSurgeFactor: 0.8,
  },

  score: {
    enemyKill: 100, boltShotDown: 25, forceSave: 150,
    asteroidDeflect: 200, survivalPerSec: 10,
    comboStep: 0.1, comboMax: 5.0,
    victoryBonus: 2000, heartBonus: 500,
  },

  difficultyPresets: { easy: 1.35, normal: 1.0, hard: 0.75 }, // scales intervals
};
```

A `?debug=1` URL flag will expose a live tuning panel over these values plus hitbox overlays
and an FPS counter. That panel is how balance gets done in minutes instead of hours.

---

## 10. Scoring (R6)

| Event | Points |
|---|---|
| Enemy destroyed | 100 × combo |
| Red bolt shot down | 25 × combo |
| Ion bolt stopped with the Force | 150 × combo |
| Asteroid deflected with the Force | 200 × combo |
| Survival | 10 / s |
| Victory | 2000 + 500 per surviving heart (player + convoy) |

**Combo multiplier**: starts at 1.0, +0.1 per enemy destroyed, caps at 5.0, **resets to 1.0
whenever any heart is lost — the player's or the convoy's.** This is the line that makes the
score a measure of protection rather than of aggression, and it puts the player's interests
and Grogu's on the same side.

HUD shows score, combo (with a shrinking decay bar), 3 player hearts, 3 Grogu hearts, the
Force meter, and the hyperdrive charge bar. Personal best persists in `localStorage`.

---

## 11. Art pipeline — parallel track for the artist

Behavior is built against procedural placeholders. `assets.js` exposes:

```js
drawSprite(key, ctx, x, y, angle, scale)
```

If `assets/<key>.png` has loaded, it is drawn. If not, a procedural vector placeholder is
drawn instead. **The game is fully playable and shippable with zero art files present.** Art
arriving late cannot block the build, and a missing file degrades to a placeholder instead of
crashing.

### Asset spec sheet (hand this to the artist now)

Transparent PNG, facing **right**, pivot at the image center, 2× the listed size for retina.

| Key | Subject | Size (virtual u) |
|---|---|---|
| `player_xwing` | Luke's X-wing | 96 × 72 |
| `convoy_ship` | Razor Crest | 220 × 120 |
| `enemy_interceptor` | Fast TIE-like fighter | 72 × 64 |
| `enemy_gunship` | Heavier gunboat | 120 × 96 |
| `enemy_lancer` | Ion Lancer, needs a readable charge state | 140 × 110 |
| `asteroid_s/m/l` | 3 rock variants | 48 / 88 / 132 square |
| `portrait_grogu` | HUD portrait, normal + tired + spent | 96 × 96 each |
| `portrait_mando` | HUD portrait | 96 × 96 |
| `bolt_red`, `bolt_ion` | Projectiles, clearly distinct | 32 × 12 |
| `bg_stars_far/mid/near` | Parallax layers, horizontally tileable | 1600 × 900 |

Bolts, explosions, engine trails and the Force field stay **procedural** (particles and
gradients) — they need to animate at arbitrary rates and they are the cheapest way to make
the game look expensive.

**Legal note, so it is on the record:** the characters are Disney/Lucasfilm property. Original
art and synthesized/CC0 audio only — no ripped sprites, no ripped soundtrack, no official
logos or fonts. That keeps this in normal tolerated fan-work territory on a public URL. If
you want zero takedown surface, the fallback is filing the serial numbers off (green child /
helmeted hunter / farm-boy Jedi), and that decision only costs renaming string constants —
but make it before the artist starts final passes.

---

## 12. Cinematic (outside the 120 s)

In-engine scripted scene, ~35 s, using the same renderer. No video file, no hosting, no
codec problems, and it doubles as a renderer smoke test.

1. Razor Crest runs, 5 pursuers behind it.
2. Mando guns down 4 — quick, satisfying, establishes that *shooting solves problems*.
3. The 5th lands an ion hit: the Crest's guns die. Establishes helplessness.
4. Grogu strains and shoves the 5th ship into an asteroid. Establishes the Force, and
   establishes that **it costs him**.
5. More pursuers close in. Beat of despair.
6. Luke's X-wing drops in. Cut to `PLAYING`. "**PROTECT THEM.**"

Requirements: `SKIP` visible from the first frame; auto-skipped on every restart; replayable
from a title-screen "Story" button. Storytelling must never stand between a voter and the
game.

---

## 13. Loss, victory, restart

- **`GAMEOVER_PLAYER`** — player hearts hit 0. "Luke is down. The convoy is defenseless."
- **`GAMEOVER_CONVOY`** — Grogu is spent. The "Sorry, Grogu…" beat, then the explosion. The
  one that should actually land emotionally.
- **`VICTORY`** — hyperdrive reaches 100 % at 120 s. Hyperspace jump, score breakdown,
  surviving-heart bonuses.

All three screens show: score, best score, a one-line stat readout (Force saves, accuracy,
enemies destroyed) and **"Press R to fly again"**. Restart resets pooled state in place — no
page reload, no asset reload, no cinematic. Target under 500 ms, and it will be measured.

---

## 14. Performance budget

- 60 fps with ~120 live entities.
- Object pools for bolts, asteroids, particles. **Zero allocation in the hot loop.**
- Single canvas, batched draws, no per-frame shadow or filter effects (they are the usual
  Canvas 2D framerate killer).
- Particle cap of 400 with oldest-first eviction.
- Cap `dt` at 50 ms so an alt-tab cannot tunnel objects through collisions.

---

## 15. Milestones

| ID | Deliverable | Exit criteria |
|----|-------------|---------------|
| **M0** | Skeleton | `index.html` loads, loop runs, state machine switches, FPS counter |
| **M1** | Player + shooting | Drifting ship, mouse aim, cooldown-gated fire, placeholder art |
| **M2** | Convoy + enemies + bolts | Gunships shoot the convoy, player can shoot bolts down, hearts drain |
| **M3** | **The Force** | Ion lancers, indestructible bolts, Force field, guns-offline trade-off, Grogu saves + barks |
| **M4** | Asteroids | Linear `(x1,y1)→(x2,y2)` trajectories, sizes, Force deflection |
| **M5** | Full match | Spawn director, 120 s clock, scoring/combo, all 3 end states, instant restart |
| **M6** | Polish + ship | Cinematic, audio, HUD juice, `?debug=1` tuning panel, GitHub Pages deploy, AI usage record |

M0–M5 is the whole game and is where the effort belongs. M6 is what wins votes. **The build
must be playable end-to-end and deployed by the end of M5** — from then on every change is
optional, and there is no scenario where a missing feature means no entry.

---

## 16. Risks

| Risk | Mitigation |
|---|---|
| Force mechanic reads as an annoyance, not a thrill | Heavy telegraphs, area targeting, generous meter. Playtest by M3 — if it isn't fun there, the design changes while it's still cheap |
| Art arrives late or never | Procedural placeholders ship a complete game with no art files. Hard requirement, not a nice-to-have |
| IP takedown | Original art + synthesized audio only; rename fallback documented in §11 |
| Difficulty mistuned for voters | `?debug=1` live tuning panel + difficulty presets; tune on real humans, not on the developer who has played it 400 times |
| Scope creep (bosses, powerups, multiplayer) | Anything not in §15 is out until M5 ships and is deployed |
| Voters bounce before playing | Cinematic skippable from frame 1, auto-skipped on restart, zero-click start |

---

## 17. Revision 2 — decisions delta

Confirmed by the product owner. These override revision 1 wherever they conflict.

### 17.1 Movement (O1 — RESOLVED)

**WASD nudge with momentum, mouse aims independently.** Twin-stick layout: movement carries
inertia, aim does not. The hull's facing and the cannons' facing are decoupled, so the ship
can slide left while shooting right.

```js
player: { driftX: 40, accel: 1400, maxSpeed: 520, drag: 4.0, aimLerp: 1.0 }
```

`drag` is the single feel knob — 4.0 settles a slide in ~0.5 s; lower is floatier and
scarier. `aimLerp: 1.0` means instantaneous aim: aim inertia on top of movement inertia
makes the game fight the player instead of challenging them.

### 17.2 Force scope (RESOLVED — expanded)

The Force now stops **red bolts, ion bolts and asteroids**. Universal defense.

To stop it from dominating shooting, it becomes a short emergency burst rather than a held
shield:

```js
force: {
  radius: 130,
  capacity: 100, drainPerSec: 70,      // 1.43 s maximum continuous hold
  regenPerSec: 10, regenDelay: 0.9,    // ~10 s to refill from empty
  minToActivate: 25, emptyLockout: 2.0,
  disablesWeapons: true,
  stopsRedBolts: true, stopsIonBolts: true, stopsAsteroids: true,
}
```

Two structural counterweights keep the trade-off real:

1. **Enemy ships are immune to the Force.** Ramming remains a positioning problem only.
2. **130 u of radius cannot cover a screen of red bolts.** It saves the player from one
   volley, never from bad positioning.

Balance watch item: if playtesting shows a player can hold Force through the final surge,
raise `drainPerSec` before touching anything else.

Consequence for enemy design: with the Force universal, the **Ion Lancer's distinctness
drops** — its bolt is no longer the only Force-answerable threat. It stays in as the
long-telegraph heavy hitter (its bolt still cannot be shot down), so the "stop shooting and
commit" moment survives, but it is no longer the sole reason the Force exists.

### 17.3 Other resolutions

| ID | Question | Resolution |
|----|----------|-----------|
| O2 | Force input | Hold **right mouse button**; `Space` as alternate |
| O3 | Mobile/touch | **Desktop-first.** Input layer stays abstracted; touch only if time remains (it will not) |
| O7 | Hosting | **Netlify Drop.** No repo, no public source. See §18.5 |
| O8 | Fire mode | **Hold to auto-fire, gated by `FIRE_COOLDOWN_MS`.** Holding the button fires every 180 ms; the cooldown remains the difficulty knob |
| O9 | UI language | **English**, including Mando's three barks verbatim as written |
| O10 | Naming | **Full Star Wars names** in all strings, 100% procedural original art. All names live in one `STRINGS` object so a rename is a 2-minute edit |
| O4 | Audio | Start muted, obvious unmute button |
| O5 | Leaderboard | `localStorage` personal best only |
| O6 | Cinematic | **Cut to 4 static vector slides**, ~15 s, skippable from frame 1 (see §18 cut list) |
| — | Asteroid instakill | `false` — costs 1 heart, per §6.5 |
| — | Difficulty presets | Single difficulty. Presets stay in config but are not surfaced in the UI |

---

## 18. 4-hour execution plan

Supersedes §15 and §16. Hard budget: **4 hours**.

**Governing rule: everything runs locally first. Deploy only on the owner's approval.**
The build is validated at `http://localhost:8080` throughout; no deploy happens until the
owner has played it and said yes. Because Netlify Drop serves a plain static folder, "works
locally over HTTP" and "works deployed" are the same condition, provided the code obeys the
relative-path rule in §18.5. So gating the deploy on approval costs nothing in risk.

### 18.1 Schedule

| Slot | Time | Deliverable | Must be true at the end |
|------|------|-------------|-------------------------|
| **H0** | 0:00–0:20 | Skeleton, running locally | `./serve.sh` starts a local server. Runnable stub at `localhost:8080`: RAF loop, state machine, virtual-resolution canvas, `config.js`. **No deploy.** |
| **H1** | 0:20–1:20 | Combat core | Player with momentum + mouse aim + cooldown fire. Convoy on its path. Interceptors + gunships. Bolts pooled. Collisions. Hearts drain on both ships |
| **H2** | 1:20–2:20 | The Force + asteroids | Force field (universal scope, harsh meter, guns offline). Ion Lancers with telegraphs. Grogu saves + 3 barks. Asteroids on linear `(x1,y1)→(x2,y2)` paths |
| **H3** | 2:20–3:20 | A real match | Spawn director ramping on elapsed time. 120 s hyperdrive clock. Score + combo. All 3 end states. `R` to restart instantly. Full HUD |
| **H4** | 3:20–4:00 | Polish, then owner review | Intro slides, WebAudio SFX, screen shake, particles, **tuning pass on real feel**, AI usage record. Ends with the owner playing the local build and deciding whether to deploy |
| **DEPLOY** | on approval | Netlify drop | Only after the owner approves the local build. §18.5 |

**End of H3 is the checkpoint that matters.** At 3:20 the game must be complete, deployed and
satisfy all 11 contest rules. Everything in H4 is optional polish. If H3 slips, H4 gets eaten
rather than the requirements.

### 18.2 Cut list (explicit, from revision 1)

Cut, and not to be re-litigated during the build:

- Full in-engine cinematic → **4 static vector slides + text**, ~15 s
- Custom art pipeline → **procedural placeholders only**. `assets.js` fallback stays, so the
  artist's files still drop in later, but nothing in the 4 hours waits on art
- Touch/mobile controls
- `?debug=1` tuning panel → reduced to an FPS counter and a hitbox toggle
- Difficulty presets in the UI
- Parallax starfield layers → **one procedural scrolling star layer**
- Boss encounter, powerups, upgrades
- Music → SFX only
- Accuracy/stat readout on the end screens → score and best score only
- Seeded PRNG reproducibility → plain `Math.random()`

### 18.3 Kept, because each maps to a contest rule or to the core design

Player momentum + mouse aim + fire cooldown · convoy with 3 hearts · Force with guns offline ·
Grogu's 3 barks including the "Sorry, Grogu…" slow-motion beat · linear asteroids ·
time-ramped spawning · score with combo · 3 end states · instant `R` restart · 120 s clock ·
skippable intro · public URL · `AI_USAGE.md`.

### 18.4 Risks specific to a 4-hour build

| Risk | Mitigation |
|---|---|
| Deploy breaks despite working locally | Only two causes exist for a static folder: absolute paths and missing relative assets. Both are forbidden by §18.5 and checked before the drop |
| Netlify Drop URL churn | Claim the site on first drop (§18.5), otherwise every re-drop yields a different random URL and unclaimed sites are temporary |
| Game is unfun but there is no time to fix it | Force + hearts playable by 2:20, leaving a full hour of feel-tuning before the H3 checkpoint |
| Scope creep mid-build | §18.2 is a contract |
| One module breaks everything late | No build step; a broken module fails loudly in the console on load, not silently at runtime |

### 18.5 Deploy procedure — Netlify Drop

No repository, no git, no public source. The deliverable is a folder.

**Constraints this imposes on the code:**

- **All asset and module paths must be relative** (`./src/main.js`, not `/src/main.js`).
- **No build step**, which the stack already guarantees. Netlify serves `.js` with the
  correct MIME type, so native ES modules work as-is.
- **Local development needs a real HTTP server** — ES modules are blocked over `file://` by
  CORS. Use `python3 -m http.server 8080` and open `http://localhost:8080`.
- Include a minimal `netlify.toml` only if a redirect is ever needed; for a single-page
  canvas game it is not.

**Deploy is gated on the owner's approval.** Nothing is published until the local build has
been played and accepted. Steps, once approved:

1. Verify no absolute paths: `grep -rn 'src="/\|href="/\|from "/' index.html src/` must
   return nothing.
2. Drag the project folder onto <https://app.netlify.com/drop>.
3. **Claim the site** with a Netlify account on that first drop. This matters: unclaimed Drop
   sites are temporary, and claiming lets later drops update the *same* URL instead of
   minting a new random one each time.
4. Rename the site to something typeable (`protect-the-child.netlify.app`) — a readable URL
   is worth real votes when people read it off a screen share.
5. Open the URL in a fresh browser, hard-reload, play 10 seconds. Then submit it.

**Trade-off accepted:** no continuous deploy and no public source. In exchange, zero repo
setup, no public-visibility decision, and no GitHub Pages propagation delay. For a 4-hour
build that is the right trade.

---

## 19. Tuning surface — every difficulty knob in one place

All of these live in `src/config.js` and nowhere else. Values written `[a, b]` are
interpolated from match start to match end by `difficulty = elapsed / 120`, so a single pair
controls both the opening minute and the final surge.

### 19.1 Player

| Knob | Default | Effect of raising it |
|---|---|---|
| `player.hearts` | 3 | More forgiving |
| `player.FIRE_COOLDOWN_MS` | 180 | **Primary difficulty knob.** Higher = fewer shots = harder |
| `player.maxSpeed` / `accel` | 520 / 1400 | Easier dodging |
| `player.drag` | 4.0 | Higher = snappier and easier; lower = floatier and scarier |
| `player.invulnSeconds` | 1.2 | Longer safety window after a hit |

### 19.2 Enemy health and stats (per type)

| Knob | Interceptor | Gunship | Lancer |
|---|---|---|---|
| `hp` | 1 | 2 | 3 |
| `speed` | 340 | 120 | 70 |
| `fireIntervalSeconds` | 1.8 | 2.4 | 4.0 |
| `telegraphSeconds` | 0.35 | 0.8 | **1.6** |
| `boltSpeed` | 520 | 440 | 300 |
| `points` | 100 | 150 | 250 |
| `targets` | player | convoy | convoy |

Plus `enemy.hpScale: [1.0, 1.0]` — a global multiplier over all types, interpolated across
the match. Set it to `[1.0, 2.0]` and enemies become twice as tanky by the 120 s mark without
touching a single per-type value. `enemy.rammingDamage: 1` controls collision damage.

`lancer.telegraphSeconds` is the most sensitive value in the game: it *is* the Force window.
Shorten it and the Force becomes a reflex test; lengthen it and threats stop feeling urgent.
Tune it last, and tune it on a human who has not played the game 400 times.

### 19.3 Asteroid health and motion

| Knob | Default | Notes |
|---|---|---|
| `asteroid.sizes.small.hp` | 1 | |
| `asteroid.sizes.medium.hp` | 3 | |
| `asteroid.sizes.large.hp` | `Infinity` | Gated by `largeDestructible: false` |
| `asteroid.largeDestructible` | `false` | Set `true` + a finite `large.hp` to make them shootable |
| `asteroid.hpScale` | `[1.0, 1.0]` | Global multiplier over all size classes |
| `asteroid.speed` | `[160, 340]` | Faster = less reaction time |
| `asteroid.sizeWeights` | `[0.55, 0.30, 0.15]` | small / medium / large draw weights |
| `asteroid.intervalSeconds` | `[6.0, 2.0]` | Spawn cadence |
| `asteroid.INSTAKILL` | `false` | See §6.5 before flipping this |
| `asteroid.damageToPlayer` / `damageToConvoy` | 1 / 1 | |
| `asteroid.knockback` / `shakeOnHit` | 900 / 18 | Pure feel; free intensity with no added unfairness |

### 19.4 Force, spawning, scoring

Force: `radius 130`, `drainPerSec 70`, `regenPerSec 10`, `regenDelay 0.9`,
`minToActivate 25`, `emptyLockout 2.0`. Raise `drainPerSec` first if the Force ever feels
dominant.

Spawning: `enemyIntervalSeconds [2.2, 0.55]`, `maxEnemies [3, 11]`,
`lancerShare [0.10, 0.40]`, `jitter 0.25`, `minDistanceFromPlayer 250`,
`maxIonBoltsInFlight 2`, `finalSurgeAtSeconds 100`, `finalSurgeFactor 0.8`.

Scoring: §10. `comboMax 5.0` is the main lever on score spread between a mediocre run and a
great one.

### 19.5 Recommended tuning order

Tune in this order, changing **one value at a time** and replaying:

1. `player.FIRE_COOLDOWN_MS` — sets how much the player can even respond to
2. `spawn.enemyIntervalSeconds` — sets raw pressure
3. `enemy.hpScale` — sets whether late-match kills feel worth attempting
4. `force.drainPerSec` — sets how often the panic button is available
5. `lancer.telegraphSeconds` — sets whether the core moment reads as fair
6. `asteroid.*` — hazard density, tuned last because it interacts with everything above

---

## 20. Running locally

No install, no dependencies, no build. The only requirement is a static HTTP server, because
native ES modules are blocked over `file://` by CORS.

```bash
./serve.sh              # wraps: python3 -m http.server 8080
# then open http://localhost:8080
```

`serve.sh` is committed so there is one canonical way to run it:

```bash
#!/usr/bin/env bash
# Serve the game locally. ES modules require HTTP, file:// will not work.
set -euo pipefail
PORT="${1:-8080}"
echo "http://localhost:$PORT"
exec python3 -m http.server "$PORT"
```

**Development loop:** edit a file, hard-reload the browser (`Ctrl+Shift+R`). No watcher and
no rebuild, because there is nothing to build. A syntax error surfaces immediately in the
console on load rather than failing silently at runtime.

**Local dev conveniences** (all cut from the shipped experience, kept behind URL flags):

| Flag | Effect |
|---|---|
| `?skipintro=1` | Straight into `PLAYING` |
| `?hitbox=1` | Draw all collision circles |
| `?fps=1` | Frame time counter |
| `?t=90` | Start the match clock at 90 s, to test the final surge without playing 90 seconds |
| `?god=1` | Player takes no damage, for testing the convoy and Grogu barks in isolation |

`?t=` and `?god=1` are the two that make the 4-hour budget survivable — without them, every
test of the endgame costs a full match.

**Deploy is a separate, later decision.** Because Netlify Drop serves exactly this folder
as-is, "runs at `localhost:8080`" and "runs deployed" are the same condition, provided §18.5's
relative-path rule holds. So there is no risk in deferring the deploy until after the owner
has played it.
