# How we built this — AI usage

Contest rule R11 asks each team to explain how it used AI. This is that record.

## Summary

**Protect the Foundling** is a 4-hour browser game built with an AI coding agent
(Claude Code / opencode running a large language model) working from a locked
design document. A human wrote the design, made every product and design
decision, ran the browser, played the game and judged the feel. The AI wrote the
code, the tuning scaffolding and this document.

## What the human did

- Wrote `docs/SDD.md`, the 835-line design document: concept, entity specs, the
  exact config object, the tuning surface, the anti-frustration guarantees, the
  schedule and the explicit cut list.
- Locked every design decision up front and forbade re-opening them mid-build.
- Specified the hard trade-off at the centre of the game (the player cannot shoot
  and use the Force at once), the Grogu-save story beat, and the colour-coding
  rule for bolts.
- Chose the tech constraints: vanilla ES modules, Canvas 2D, zero dependencies,
  no build step, all paths relative, virtual 1600x900 resolution, object pools,
  fixed timestep.
- Reviewed each milestone in a real browser and decided whether the build was
  playable. Deployment was gated on that judgement.
- Owned the final call on fun, difficulty and whether to ship.

## What the AI did

- Implemented the whole codebase from the SDD: 20 ES modules under `src/`
  (config, strings, input, assets, render, audio, ui, cinematic, six entities,
  five systems, main loop) plus `index.html`, `styles.css` and `serve.sh`.
- Wrote `src/config.js` as the single source of truth for every tunable, and
  kept gameplay numbers out of the other modules.
- Built the object pools, the fixed-timestep accumulator, the procedural art
  placeholders, the WebAudio synthesised SFX and the state machine.
- Drove the browser through Playwright to verify each milestone: screenshots,
  console-error checks and scripted gameplay probes (Force on/off, convoy saves,
  slow-motion, victory, restart, frame time).
- Wrote this document.

## Process, specifically

1. The human handed over two documents — the brief and the SDD — and said the
   SDD wins on any conflict except where §18 supersedes §15/16.
2. The AI read both in full, then built in the SDD's schedule slots: skeleton,
   combat core, Force + asteroids, full match, polish.
3. After each slot the AI loaded the game at `http://localhost:8080` in a real
   browser, checked the console for errors, took screenshots and ran scripted
   probes against `window.game` (the live game object) to confirm behaviour that
   is hard to see in a still image — e.g. that the guns are rejected while the
   Force is held, that ion bolts survive gunfire, and that the convoy's third
   heart triggers slow motion before the loss screen.
4. The AI did not deploy anything and did not create a repository. Deployment was
   left to the human, gated on playing the local build.

## What AI was used for, and what it was not

- **Used for:** boilerplate, canvas drawing code, entity update loops, pooled
  data structures, the spawn director maths, and the repetitive verification
  loop.
- **Not used for:** the design. All gameplay decisions, the fiction and the
  emotional beat ("Grogu saves the ship and it costs him") came from the human.
  Balance was treated as a human judgement: the AI exposed the knobs and
  instrumented the build, but the human decided how it should feel.

## Provenance of assets

The character and ship art is hand-made pixel art supplied by the human as two
sprite sheets (`image (1).png`, `image (2).png`). The AI sliced, de-rotated and
palette-tinted them into the individual files under `assets/` (`player_xwing`,
`convoy_ship`, `enemy_interceptor`/`_gunship`/`_lancer`, the four character
portraits and the Force variant), downscaling each to its true pixel grid and
drawing everything with `imageSmoothingEnabled = false` plus CSS
`image-rendering: pixelated` so it stays crisp at any window size. Asteroids have
no supplied art and are generated as deterministic blocky pixel rocks in
`src/assets.js` to match. Every sound is generated with the WebAudio API at
runtime, and every name and line of text lives in `src/strings.js`. Real art
still drops in behind `drawSprite(key, ctx, x, y, angle, scale)` and is picked up
automatically when it is larger than the 1x1 sentinel.

## Honest limitations

- The character/ship art is final; the asteroid rocks and the background/bolts
  are procedurally generated to match it, not hand-drawn.
- Difficulty was tuned by the human against the tuning surface in `src/config.js`
  (see SDD §19); there was no broad external playtest inside the build window.
- The AI's verification was automated and browser-based; the human's playtest is
  the authority on feel.
