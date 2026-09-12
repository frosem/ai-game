// Every piece of user-facing text and every character name lives here.
// A rename is a two-minute edit because nothing else hard-codes a name.

export const STRINGS = {
  title: 'PROTECT',
  titleTarget: 'MANDALORIAN & GROGU',
  subtitle: 'KEEP THEM ALIVE // 02:00',
  tagline: 'THE CREST IS THE OBJECTIVE',
  thisIsTheWay: 'SURVIVE THE RUN',
  missionTitle: 'MISSION',
  missionLine1: 'Protect the Razor Crest for 2 minutes.',
  missionLine2: 'Shoot threats. Use the Force to move asteroids and stop incoming fire.',

  startButton: 'START GAME',
  storyButton: 'STORY',
  leaderboardButton: 'LEADERBOARD',
  muteLabel: 'MUTED',
  unmuteLabel: 'SOUND ON',
  pausedTitle: 'PAUSED',
  pausedHint: 'Esc / P resume · M main menu · R restart',

  controls: [
    'WASD / Arrow keys — move',
    'Click — fire',
    'Space — use the Force',
  ],

  hud: {
    score: 'SCORE',
    best: 'BEST',
    combo: 'COMBO',
    force: 'FORCE',
    hyperdrive: 'HYPERDRIVE',
    protect: 'PROTECT MANDALORIAN & GROGU',
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
    { heading: 'PROTECT MANDALORIAN & GROGU' },
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
    rank: 'YOUR RANK',
    submitting: 'SAVING SCORE...',
  },

  countdown: 'PROTECT THEM',
};
