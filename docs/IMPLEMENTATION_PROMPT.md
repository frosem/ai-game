# Implementation handoff prompt

Copy everything below the line into a fresh session, from the working directory
`/home/jpcarrasco/ai-game`.

---

You are a senior game developer. Implement a complete, playable browser game in **4 hours**.

## First action

Read `docs/SDD.md` in full before writing any code. It is a 835-line Software Design Document
and it is **the contract**. It contains the entity specs, the exact config object, the tuning
surface, the schedule and the cut list. Everything below is a summary to orient you and to
prevent drift — where this prompt and the SDD disagree, **the SDD wins**, except that SDD
sections 15 and 16 are superseded by section 18 (revision 2).

Every design decision is already locked. Do not re-open them and do not ask clarifying
questions about design. If you hit something genuinely unspecified, pick the option most
consistent with the SDD, implement it, and note it in a short list at the end.

## The game

**"Protect the Child"** — a side-scrolling escort shooter. The player flies Luke Skywalker's
X-wing and must keep the Mandalorian's ship (Razor Crest, Grogu aboard) alive for 120 seconds
while its hyperdrive charges.

The entire design rests on **one hard trade-off: the player cannot shoot and use the Force at
the same time.** Using the Force disarms the player and leaves them fully vulnerable. Every
Force use is a gamble with the player's own hearts.

When the player fails to stop a hit on the convoy, **Grogu saves the ship himself — and it
costs him.** The convoy's 3 hearts *are* Grogu's stamina. That is why losing them is a story
beat rather than a bare game over.

## Tech constraints (non-negotiable)

- **Vanilla JavaScript, native ES modules, Canvas 2D.**
- **Zero dependencies. No framework. No bundler. No build step. No npm install.**
- **All paths relative** (`./src/main.js`, never `/src/main.js`). The game deploys as a plain
  static folder dragged to Netlify Drop, so an absolute path silently breaks the deploy.
- **Virtual resolution 1600 × 900**, letterboxed and scaled to the canvas. Every speed,
  radius and position in config is in virtual units, so a window resize never retunes the game.
- **Object pools** for bolts, asteroids and particles. **Zero allocation in the hot loop.**
- Target **60 fps with ~120 live entities**. No per-frame canvas `shadowBlur` or `filter` —
  they are the usual Canvas 2D framerate killer. Particle cap 400, oldest-first eviction.
- Fixed timestep `dt = 1/60` with an accumulator. **Cap `dt` at 50 ms** so an alt-tab cannot
  tunnel objects through collisions.
- Single seeded PRNG is **not** required (cut for time) — plain `Math.random()` is fine.
- Audio: WebAudio synthesized SFX only. No music files. **Start muted** with an obvious
  unmute button.

## Absolute rule: all numbers live in `src/config.js`

**No magic numbers anywhere else in the codebase.** Every tunable — health, speed, cooldown,
radius, spawn interval, damage, points — is read from `CONFIG`. This is what makes the
final-hour difficulty pass possible at all, and the product owner has explicitly asked twice
for enemy health, asteroid health and fire rate to be parametrized.

Values written `[a, b]` are **interpolated across the match** by
`difficulty = clamp(elapsed / 120, 0, 1)`. Write one `lerp(a, b, difficulty)` helper and use
it everywhere.

Start by typing `src/config.js` essentially verbatim from SDD §9 plus the revision-2
overrides in §17.2 and the enemy/asteroid blocks in §9 as amended. The shape:

```js
export const CONFIG = {
  MATCH_SECONDS: 120,
  VIRTUAL_W: 1600, VIRTUAL_H: 900,

  player: {
    hearts: 3,
    driftX: 40,                // never zero — contest rule "ship never stops moving"
    accel: 1400, maxSpeed: 520, drag: 4.0, aimLerp: 1.0,
    hitRadius: 22,
    FIRE_COOLDOWN_MS: 180,     // primary difficulty knob
    boltSpeed: 1400, boltLife: 1.2,
    invulnSeconds: 1.2,
  },

  force: {
    radius: 130,
    capacity: 100, drainPerSec: 70,     // ~1.43 s maximum continuous hold
    regenPerSec: 10, regenDelay: 0.9,   // ~10 s to refill from empty
    minToActivate: 25, emptyLockout: 2.0,
    disablesWeapons: true,              // the whole design; never flip this
    stopsRedBolts: true, stopsIonBolts: true, stopsAsteroids: true,
  },

  convoy: { hearts: 3, graceSeconds: 1.5 },

  enemy: {
    hpScale: [1.0, 1.0],       // global hp multiplier, lerped over the match
    interceptor: { hp:1, speed:340, hitRadius:26, fireIntervalSeconds:1.8,
                   telegraphSeconds:0.35, boltSpeed:520, points:100, targets:'player' },
    gunship:     { hp:2, speed:120, hitRadius:42, fireIntervalSeconds:2.4,
                   telegraphSeconds:0.8,  boltSpeed:440, points:150, targets:'convoy' },
    lancer:      { hp:3, speed:70,  hitRadius:48, fireIntervalSeconds:4.0,
                   telegraphSeconds:1.6,  boltSpeed:300, points:250, targets:'convoy',
                   boltShootable:false },
    rammingDamage: 1,
  },

  asteroid: {
    INSTAKILL: false,
    damageToPlayer: 1, damageToConvoy: 1,
    speed: [160, 340],
    hpScale: [1.0, 1.0],
    sizes: { small:{r:18,hp:1,points:50}, medium:{r:34,hp:3,points:75},
             large:{r:56,hp:Infinity,points:0} },
    largeDestructible: false,
    sizeWeights: [0.55, 0.30, 0.15],
    intervalSeconds: [6.0, 2.0],
    knockback: 900, shakeOnHit: 18,
  },

  spawn: {
    enemyIntervalSeconds: [2.2, 0.55],
    maxEnemies: [3, 11], maxAsteroids: [2, 7],
    lancerShare: [0.10, 0.40],
    jitter: 0.25,
    minDistanceFromPlayer: 250,
    maxIonBoltsInFlight: 2,
    finalSurgeAtSeconds: 100, finalSurgeFactor: 0.8,
  },

  score: {
    enemyKill: 100, boltShotDown: 25, forceSave: 150, asteroidDeflect: 200,
    survivalPerSec: 10, comboStep: 0.1, comboMax: 5.0,
    victoryBonus: 2000, heartBonus: 500,
  },
};
```

Also create a single `STRINGS` object holding every piece of user-facing text and every
character name, so a rename is a two-minute edit.

## Controls

| Input | Action |
|---|---|
| `WASD` / arrows | Move. **Has momentum** — accel 1400, drag 4.0, plus a constant `driftX: 40` that is never zero |
| Mouse | Aim. **Instantaneous, zero inertia** (`aimLerp: 1.0`) |
| Left mouse, **held** | Auto-fire, gated by `FIRE_COOLDOWN_MS`. Holding fires every 180 ms |
| Right mouse (or `Space`) | **Force.** Guns go offline while held |
| `R` | Instant restart |
| `Esc` / `P` | Pause |

**Movement and aim are decoupled** — this is a twin-stick layout and it was explicitly
clarified with the product owner. The hull's facing has nothing to do with where the cannons
point: the ship can be sliding left from earlier thrust while its guns track a target to the
upper right. Do **not** add inertia to aiming, and do **not** rotate the ship to face the
reticle as a way of aiming. Momentum makes positioning the hard skill; instant aim keeps
shooting fair.

Show the fire cooldown as a thin ring on the reticle so the player can read their own rate of
fire. When the Force is active, the reticle visibly changes to a Force glyph.

## Core mechanics

### The Force

While the Force input is held:

1. **Guns go offline.** Reject all firing.
2. A telekinetic field appears **centered on the reticle**, radius 130.
3. Bolts entering the field are destroyed in a particle burst — **red bolts, ion bolts, all
   of them** (the owner chose universal scope).
4. Asteroids entering the field have their **velocity vector redirected away from the
   convoy** — a deliberate callback to Grogu shoving a ship into an asteroid in the intro.
5. The player stays **fully vulnerable.** No invulnerability, no slowdown of incoming fire.
6. The meter drains at 70/s, giving a ~1.43 s maximum hold, then a 2 s lockout when empty.

Targeting is **area-based, not pixel-precise.** The player positions a field; they do not
snipe individual bolts.

Two structural counterweights stop the Force from dominating, and both must be implemented:
**enemy ships are immune to the Force** (ramming stays a pure positioning problem), and 130 u
of radius cannot cover a screen full of red bolts.

### Grogu's saves and the three barks

Any damage reaching the convoy consumes one of its 3 hearts and triggers a save. Barks are a
**non-blocking queue** — a bubble above the speaking ship, ~1.3 s, large readable font, plus
audio. **No modal dialogs during gameplay**; nobody reads text while dodging.

| Save | Grogu | Mando | Presentation |
|---|---|---|---|
| 1 | *"Patu!"* (coo) | **"That was amazing!"** | Bark bubble, green Force-bubble flash |
| 2 | *(strained whimper)* | **"No! You're getting tired!"** | Bark bubble, screen edges tint red, Grogu's HUD portrait visibly droops |
| 3 | *(silence)* | **"Sorry, Grogu…"** | **Slow motion for 1.5 s, everything else freezes**, then the explosion → `GAMEOVER_CONVOY` |

The third beat is the only place the game stops the action, and it earns it — it *is* the loss
screen. Beat 2 must change the HUD, not only speak.

Give the convoy a **1.5 s grace window** after each save so one dense volley cannot delete all
three hearts.

### Bolts — colour coding is a hard rule

- `RED` — destructible by gunfire. Awards 25 × combo when shot down.
- `PURPLE / ION` — `boltShootable: false`, immune to gunfire, Force-only. Visibly crackling,
  slower, larger, distinct spawn sound.

If a player ever has to guess whether a bolt is shootable, the core mechanic is broken.

### Asteroids — linear trajectory, computed once at spawn

Both endpoints are randomized at spawn and the velocity is then never recomputed. No curves,
no acceleration, no steering.

```js
const start = randomPointOnSpawnBand();     // (x1, y1)
const end   = randomPointOnOppositeBand();  // (x2, y2)
const dx = end.x - start.x, dy = end.y - start.y;
const len = Math.hypot(dx, dy);
asteroid.vx = (dx / len) * speed;
asteroid.vy = (dy / len) * speed;
asteroid.spin = rand(-1.2, 1.2);            // visual only
```

Independently randomized endpoints are what make trajectories cross the playfield at varied
angles, so rocks read as hazards rather than as enemies. Large asteroids are **not
destructible by gunfire** — Force or dodge only. Asteroid hits cost the player **1 heart**, not
an instant kill; intensity comes from heavy knockback (900) and screen shake (18).

### Enemies

Three types, spawning at randomized positions on the right edge and the top/bottom bands:

- **Interceptor** — fast, strafes and dives at the **player**, short telegraph, red bolts.
- **Gunship** — slow, parks at range, shoots the **convoy** with red bolts the player can
  shoot down.
- **Ion Lancer** — very slow, **1.6 s telegraph** with a growing charge glow and a dotted aim
  line to the convoy, fires an unshootable ion bolt.

Telegraphs are mandatory and generous. The lancer's aim line is the player's cue to stop
shooting and commit to the Force. `lancer.telegraphSeconds` is the single most sensitive value
in the game — it *is* the Force window.

### Spawn director

Pure interpolation on elapsed time, no hand-authored wave table. Spawn intervals carry ±25%
jitter so the rhythm never becomes metronomic. At `t = 100 s` a **final surge** fires: music
filter shift, hyperdrive bar pulses, spawn intervals cut a further 20%. The last 20 seconds
should feel barely survivable — that is the clip people share.

Three **anti-frustration guarantees must be enforced by the director**:

1. Never more than 2 ion bolts in flight (the Force cannot be in two places).
2. No spawn within 250 u of the player's current position.
3. Minimum 0.8 s spacing between ion-bolt firings from different lancers.

### Scoring

Enemy destroyed 100 × combo · red bolt shot down 25 × combo · ion bolt stopped with the Force
150 × combo · asteroid deflected with the Force 200 × combo · survival 10/s · victory 2000 +
500 per surviving heart across both ships.

**Combo** starts at 1.0, +0.1 per enemy destroyed, caps at 5.0, and **resets to 1.0 whenever
any heart is lost — the player's or the convoy's.** That single rule makes the score a measure
of protection rather than of aggression, and puts the player's interests on the same side as
Grogu's.

HUD: score, combo with a decay bar, 3 player hearts, 3 Grogu hearts, the Force meter, and the
hyperdrive charge bar. Personal best in `localStorage`.

## States and end conditions

`BOOT → TITLE → CINEMATIC → PLAYING → (PAUSED) → GAMEOVER_PLAYER | GAMEOVER_CONVOY | VICTORY → PLAYING`

- **`GAMEOVER_PLAYER`** — player hearts hit 0. "Luke is down. The convoy is defenseless."
- **`GAMEOVER_CONVOY`** — Grogu is spent. The "Sorry, Grogu…" slow-motion beat, then the
  explosion. This is the one that should land emotionally.
- **`VICTORY`** — the hyperdrive reaches 100% at 120 s. Hyperspace jump, score breakdown,
  surviving-heart bonuses.

All three screens show score, best score and **"Press R to fly again"**. Restart resets pooled
state in place — **no page reload, no asset reload, and never back through the intro.** Target
under 500 ms.

## Intro (outside the 120 s)

Cut down for time to **4 static vector slides with text, ~15 s total**, skippable from frame 1:

1. The Razor Crest runs, 5 pursuers behind it.
2. Mando guns down 4 — establishes that *shooting solves problems*.
3. The 5th lands an ion hit; the Crest's guns die — establishes helplessness. Grogu strains
   and shoves the attacker into an asteroid — establishes the Force, and that **it costs him**.
4. More pursuers close in. Luke's X-wing drops in. Cut to `PLAYING`: "**PROTECT THEM.**"

`SKIP` must be visible on the first frame, auto-skipped on every restart, and replayable from a
title-screen "Story" button. Storytelling must never stand between a voter and the game.

## Art

**100% procedural.** Draw everything with canvas primitives, gradients and particles. No image
files, no ripped sprites, no ripped audio, no official logos or fonts — the characters are
Disney/Lucasfilm property and this ships on a public URL.

Still route every draw through one indirection so a teammate's art can drop in later:

```js
drawSprite(key, ctx, x, y, angle, scale)
```

If `assets/<key>.png` has loaded, draw it; otherwise draw the procedural placeholder. **The
game must be fully playable and shippable with zero art files present** — a missing file
degrades to a placeholder, never to a crash. Asset keys and sizes are in SDD §11.

Bolts, explosions, engine trails and the Force field stay procedural permanently — they
animate at arbitrary rates and are the cheapest way to make the game look expensive.

## File layout

```
index.html
styles.css
serve.sh
src/
  main.js            boot, RAF loop, fixed-timestep accumulator, state machine
  config.js          ALL tunables — single source of truth
  strings.js         ALL user-facing text and character names
  input.js           keyboard + mouse, reticle in world space
  assets.js          manifest + loader + procedural placeholder fallbacks
  render.js          camera, layers, scrolling starfield, draw order
  audio.js           WebAudio SFX, master mute
  ui.js              HUD + screens
  cinematic.js       4 slides, skippable
  entities/          player.js convoy.js enemy.js bolt.js asteroid.js particle.js
  systems/           spawn.js collision.js force.js score.js dialog.js
assets/              empty; teammate's art lands here later
docs/                SDD.md  AI usage record
```

Per-tick update order:

```
input → player → convoy → enemies → bolts → asteroids → force field
      → collisions → score/combo → spawn director → dialog → particles → hud
```

## Running and verifying

No install, no build. ES modules are CORS-blocked over `file://`, so a real HTTP server is
required. Create `serve.sh`:

```bash
#!/usr/bin/env bash
# Serve the game locally. ES modules require HTTP; file:// will not work.
set -euo pipefail
PORT="${1:-8080}"
echo "http://localhost:$PORT"
exec python3 -m http.server "$PORT"
```

Development loop: edit, hard-reload the browser. A syntax error surfaces in the console on
load rather than failing silently at runtime.

Implement these dev URL flags **early in H0** — the last two are what make the 4-hour budget
survivable, since without them every endgame test costs a full 2-minute match:

| Flag | Effect |
|---|---|
| `?skipintro=1` | Straight into `PLAYING` |
| `?hitbox=1` | Draw all collision circles |
| `?fps=1` | Frame time counter |
| `?t=90` | Start the match clock at 90 s, to test the final surge instantly |
| `?god=1` | Player takes no damage, to test the convoy and Grogu's barks in isolation |

If a browser automation tool is available in your session, use it to load
`http://localhost:8080/?skipintro=1&fps=1`, screenshot, and check the console for errors after
each milestone. Do not declare a milestone complete on the basis of the code alone — **it must
have been observed running.**

## Schedule — 4 hours

| Slot | Time | Must be true at the end |
|---|---|---|
| **H0** | 0:00–0:20 | `./serve.sh` works. Stub runs at `localhost:8080`: RAF loop, state machine, virtual-resolution canvas, `config.js`, `strings.js`, dev flags |
| **H1** | 0:20–1:20 | Player with momentum + mouse aim + held auto-fire. Convoy on its scripted sine path. Interceptors + gunships. Pooled bolts. Collisions. Hearts drain on both ships |
| **H2** | 1:20–2:20 | Force field (universal scope, harsh meter, guns offline). Ion Lancers with telegraphs. Grogu's saves + all 3 barks including the slow-motion third. Asteroids on linear paths |
| **H3** | 2:20–3:20 | Spawn director ramping on elapsed time. 120 s hyperdrive clock. Score + combo. All 3 end states. `R` restart. Full HUD |
| **H4** | 3:20–4:00 | Intro slides, WebAudio SFX, screen shake, particles, **tuning pass on real feel**, AI usage record |

**3:20 is the real deadline.** At that point the game must be complete, running locally and
satisfying all 11 contest requirements. H4 is expendable polish; the requirements are not. If
H3 slips, eat into H4 rather than dropping a requirement.

## Cut list — a contract, not a suggestion

Do **not** build any of these, and do not re-open the question mid-build:

full in-engine cinematic (4 static slides only) · custom art files · touch/mobile controls ·
a `?debug=1` live tuning panel (the URL flags above replace it) · difficulty presets in the
UI · parallax starfield layers (one procedural scrolling star layer) · boss encounters ·
powerups or upgrades · music · accuracy/stat readouts on the end screens · seeded-PRNG
reproducibility · any server, backend, account system or online leaderboard · any npm
package.

## Deploy — do not

Deployment is **gated on the product owner's approval** after they have played the local
build. Do not deploy, do not create a git repository, do not push anything anywhere, and do
not sign up for any service. Just make it run at `localhost:8080` and report.

When approval eventually comes, the target is Netlify Drop (drag the folder to
app.netlify.com/drop), which is why the relative-path rule above is not optional. Before any
drop, this must return nothing:

```bash
grep -rn 'src="/\|href="/\|from "/' index.html src/
```

## Acceptance checklist

The game is not done until every line is true and has been **observed in the browser**:

- [ ] Player controls a ship, and that ship's speed is **never zero** at any moment
- [ ] Player can shoot; the fire rate is governed solely by `CONFIG.player.FIRE_COOLDOWN_MS`
- [ ] A convoy ship exists, has 3 hearts, and its death ends the run
- [ ] Score with a combo multiplier, live on the HUD, personal best persisted
- [ ] Two distinct loss conditions, each with its own screen
- [ ] `R` restarts in under 500 ms with no page reload and no intro replay
- [ ] A match lasts at most 120 s, with the remaining time always visible
- [ ] Force disables the guns while held and leaves the player vulnerable
- [ ] Ion bolts cannot be shot down; red bolts can
- [ ] Asteroids travel in straight lines between two spawn-time endpoints
- [ ] All three Grogu barks fire in order, the third in slow motion
- [ ] Enemy health, asteroid health and all fire rates are config values, with zero magic
      numbers outside `config.js`
- [ ] 60 fps with a full late-match screen of entities
- [ ] Zero console errors
- [ ] AI usage record written — the contest requires each team to explain its AI usage

## Working style

Work autonomously through the whole schedule; do not stop to ask for design direction. Report
at the end of each slot with one line on what now runs. If you fall behind, say so plainly and
cut from H4, never from the acceptance checklist. When something is genuinely unspecified,
choose, implement, and list your choices at the end.
