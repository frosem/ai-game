import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
const MAX_NAME_LENGTH = 16;
const MAX_SCORE = 10_000_000;

function cleanName(value) {
  return String(value ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .slice(0, MAX_NAME_LENGTH);
}

function json(res, status, body) {
  res.status(status).setHeader('Cache-Control', 'no-store');
  return res.json(body);
}

export default async function handler(req, res) {
  if (req.method === 'GET') return getScores(req, res);
  if (req.method === 'POST') return postScore(req, res);
  res.setHeader('Allow', 'GET, POST');
  return json(res, 405, { error: 'Method not allowed' });
}

async function getScores(req, res) {
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit || '10', 10) || 10));
  const playerId = String(req.query.playerId || '').slice(0, 80);
  const rows = await sql`
    SELECT player_name, score, created_at,
           RANK() OVER (ORDER BY score DESC, created_at ASC) AS rank
    FROM scores
    ORDER BY score DESC, created_at ASC
    LIMIT ${limit}
  `;
  let player = null;
  if (playerId) {
    const best = await sql`
      SELECT player_name, score,
             RANK() OVER (ORDER BY score DESC, created_at ASC) AS rank
      FROM scores
      WHERE player_id = ${playerId}
      ORDER BY score DESC, created_at ASC
      LIMIT 1
    `;
    player = best[0] || null;
  }
  return json(res, 200, { scores: rows, player });
}

async function postScore(req, res) {
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  const playerName = cleanName(body.playerName);
  const playerId = String(body.playerId || '').slice(0, 80);
  const runId = String(body.runId || '').slice(0, 80);
  const score = Number(body.score);

  if (!playerName || playerName.length < 2) return json(res, 400, { error: 'Enter a valid pilot name.' });
  if (!playerId || !runId) return json(res, 400, { error: 'Missing player or run id.' });
  if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) {
    return json(res, 400, { error: 'Invalid score.' });
  }

  try {
    await sql`
      INSERT INTO scores (player_id, player_name, score, run_id)
      VALUES (${playerId}, ${playerName}, ${score}, ${runId})
      ON CONFLICT (run_id) DO NOTHING
    `;
  } catch (error) {
    console.error('score insert failed', error);
    return json(res, 500, { error: 'Could not save score.' });
  }

  const result = await sql`
    SELECT player_name, score,
           RANK() OVER (ORDER BY score DESC, created_at ASC) AS rank
    FROM scores
    WHERE player_id = ${playerId} AND score = ${score}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return json(res, 201, { score: result[0] || { player_name: playerName, score, rank: null } });
}
