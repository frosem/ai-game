// Every piece of user-facing text and every character name lives here.
// A rename is a two-minute edit because nothing else hard-codes a name.

export const STRINGS = {
  title: 'PROTECT THE FOUNDLING',
  subtitle: 'A Star Wars fan story',
  tagline: 'Shoot what you can. Feel the rest. Hold the line.',
  thisIsTheWay: 'This is the Way.',

  startButton: 'FLY',
  storyButton: 'STORY',
  muteLabel: 'MUTED',
  unmuteLabel: 'SOUND ON',
  pausedTitle: 'PAUSED',
  pausedHint: 'Esc or P to resume · R to restart',

  controls: [
    'WASD / Arrows — fly the X-wing (it never stops moving)',
    'Mouse — aim · Left mouse (hold) — fire',
    'Right mouse / Space — the Force (guns go offline)',
    'R — restart · Esc / P — pause',
  ],

  hud: {
    score: 'SCORE',
    best: 'BEST',
    combo: 'COMBO',
    force: 'FORCE',
    hyperdrive: 'HYPERDRIVE',
    protect: 'PROTECT THE FOUNDLING',
  },

  characters: {
    luke: 'Luke Skywalker',
    mando: 'The Mandalorian',
    grogu: 'Grogu',
    groguAlias: 'Baby Yoda',
    razorCrest: 'Razor Crest',
    xwing: 'X-wing',
    interceptor: 'TIE Interceptor',
    gunship: 'Imperial Gunship',
    lancer: 'Ion Lancer',
  },

  // Luke barks, fired in order as the player loses hearts. Only two entries:
  // the fatal hit is skipped (see collision.js onPlayerHit) since the
  // game-over overlay covers the dialogue panel immediately anyway.
  playerHits: ['Still with you!', "I'm hit, but I'm still flying!"],

  // Save barks, fired in order as the convoy loses hearts.
  saves: [
    { grogu: 'Patu!', mando: 'That was amazing!' },
    { grogu: '(strained whimper)', mando: "No! You're getting tired!" },
    { grogu: '…', mando: 'Sorry, Grogu…' },
  ],

  // Scripted intro captions, shown in order as the dogfight plays out.
  cinematic: [
    { heading: 'THE RAZOR CREST FLEES', line: "They're on our tail — hang on back there!" },
    { heading: 'THE MANDALORIAN FIGHTS BACK', line: 'Four of them. Stay down, kid.' },
    { heading: 'GUNS GO DARK', line: 'Guns are dead — that hit fried them!' },
    { heading: 'IT COSTS HIM', line: "Then we do this the hard way." },
    { heading: 'PROTECT THE FOUNDLING' },
  ],
  skip: 'SKIP',
  cinematicHint: 'Space / click to skip',

  gameover: {
    playerTitle: 'LUKE IS DOWN',
    playerBody: 'The Razor Crest is defenseless.',
    convoyTitle: 'GROGU IS SPENT',
    convoyBody: 'The foundling gave everything. The Razor Crest is lost.',
    victoryTitle: 'HYPERSPACE JUMP',
    victoryBody: 'The hyperdrive is charged. They made it out.',
    pressR: 'PRESS R TO FLY AGAIN',
    pressRClick: 'Press R or click to fly again',
    score: 'SCORE',
    best: 'BEST SCORE',
    newBest: 'NEW BEST',
  },

  countdown: 'PROTECT THEM',
  builtWith: 'Built with AI pair-programming · see docs/AI_USAGE.md',
};