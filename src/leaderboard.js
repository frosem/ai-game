const PLAYER_ID_KEY = 'protect-mando-player-id';
const PLAYER_NAME_KEY = 'protect-mando-player-name';

export class Leaderboard {
  constructor() {
    this.playerId = localStorage.getItem(PLAYER_ID_KEY) || crypto.randomUUID();
    localStorage.setItem(PLAYER_ID_KEY, this.playerId);
    this.lastResult = null;
    this.modal = document.getElementById('leaderboard-modal');
    this.title = document.getElementById('leaderboard-title');
    this.body = document.getElementById('leaderboard-body');
    this.nameForm = document.getElementById('pilot-name-form');
    this.nameInput = document.getElementById('pilot-name');
    this.closeButton = document.getElementById('leaderboard-close');
    this.namePrompt = null;
    this.nameForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const name = this.nameInput.value.trim().replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, 16);
      if (name.length < 2) return;
      localStorage.setItem(PLAYER_NAME_KEY, name);
      this.hide();
      const callback = this.namePrompt;
      this.namePrompt = null;
      if (callback) callback(name);
    });
    this.closeButton.addEventListener('click', () => this.hide());
  }

  getName() {
    return localStorage.getItem(PLAYER_NAME_KEY) || '';
  }

  requestName(callback) {
    const name = this.getName();
    if (name) {
      callback(name);
      return;
    }
    this.namePrompt = callback;
    this.title.textContent = 'ENTER PILOT NAME';
    this.body.innerHTML = '<p class="leaderboard-hint">Choose a name for the leaderboard.</p>';
    this.nameInput.value = '';
    this.nameInput.hidden = false;
    this.nameForm.querySelector('button').textContent = 'CONTINUE';
    this.closeButton.hidden = true;
    this.modal.hidden = false;
    this.nameInput.focus();
  }

  async showBoard() {
    this.namePrompt = null;
    this.title.textContent = 'LEADERBOARD';
    this.nameInput.value = this.getName();
    this.nameInput.hidden = false;
    this.nameForm.querySelector('button').textContent = 'SAVE NAME';
    this.closeButton.hidden = false;
    this.body.innerHTML = '<p class="leaderboard-hint">Loading scores...</p>';
    this.modal.hidden = false;
    try {
      const response = await fetch(`/api/scores?limit=10&playerId=${encodeURIComponent(this.playerId)}&playerName=${encodeURIComponent(this.getName())}`);
      if (!response.ok) throw new Error('leaderboard request failed');
      const data = await response.json();
      this.renderRows(data.scores, data.player);
    } catch {
      this.body.innerHTML = '<p class="leaderboard-hint">Leaderboard unavailable. Try again later.</p>';
    }
  }

  async submitScore(score) {
    const playerName = this.getName();
    if (!playerName) return;
    const runId = crypto.randomUUID();
    try {
      const response = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: this.playerId, playerName, score, runId }),
      });
      if (!response.ok) throw new Error('score submission failed');
      const data = await response.json();
      this.lastResult = data.score;
    } catch {
      this.lastResult = null;
    }
  }

  renderRows(rows, player) {
    const lines = rows.map((row) => `
      <div class="leaderboard-row">
        <span>#${row.rank}</span><strong>${escapeHtml(row.player_name)}</strong><b>${row.score}</b>
      </div>`).join('');
    const rank = player ? `<p class="leaderboard-rank">YOUR BEST: #${player.rank} · ${player.score}</p>` : '';
    this.body.innerHTML = `${rank}<div class="leaderboard-table">${lines || '<p class="leaderboard-hint">No scores yet.</p>'}</div>`;
  }

  hide() {
    this.modal.hidden = true;
    this.nameInput.hidden = true;
    this.closeButton.hidden = false;
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}
