import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../App';
import { API } from '../App';
import { TOURNAMENTS } from '../data/tournaments';

export function PickHistory() {
  const { groupId } = useParams();
  const { userId } = useAuth();
  const [picks, setPicks] = useState([]);
  const [member, setMember] = useState(null);
  const [tournamentStatus, setTournamentStatus] = useState(null);

  useEffect(() => {
    if (!groupId || !userId) return;
    fetch(`${API}/picks/history?userId=${userId}&groupId=${groupId}`)
      .then((r) => r.json())
      .then(setPicks)
      .catch(() => setPicks([]));
  }, [groupId, userId]);

  useEffect(() => {
    if (!groupId) return;
    fetch(`${API}/groups/${groupId}`)
      .then((r) => r.json())
      .then((g) => {
        const me = g?.members?.find((m) => m.userId === userId);
        setMember(me || null);
        const t = g?.tournamentId ? TOURNAMENTS.find(t => t.id === g.tournamentId) : null;
        setTournamentStatus(t?.status || null);
      })
      .catch(() => setMember(null));
  }, [groupId, userId]);

  // Upcoming tournament — no picks exist yet
  if (tournamentStatus && tournamentStatus !== 'active' && tournamentStatus !== 'completed') {
    return (
      <div className="page pick-history">
        <div className="pick-header">
          <h1>Your picks</h1>
          <Link to={`/group/${groupId}`} className="back-link">← Back to group</Link>
        </div>
        <div className="draw-empty-state">
          <div className="draw-empty-icon">🎾</div>
          <p className="draw-empty-title">No picks yet</p>
          <p className="draw-empty-sub">Your pick history will appear here once the tournament starts.</p>
        </div>
      </div>
    );
  }

  const survived = picks.filter((p) => p.survived === true).length;
  const isAlive = member ? member.isAlive : null;
  const eliminatedRound = member ? member.eliminatedRound : null;

  return (
    <div className="page pick-history">
      <div className="pick-header">
        <h1>Your picks</h1>
        <Link to={`/group/${groupId}`} className="back-link">← Back to group</Link>
      </div>

      {/* Status card */}
      {isAlive !== null && (
        <div className={`ph-status-card ${isAlive ? 'ph-status-alive' : 'ph-status-out'}`}>
          <span className="ph-status-icon">{isAlive ? '✅' : '❌'}</span>
          <div className="ph-status-text">
            <span className="ph-status-headline">
              {isAlive ? 'Still in — keep going!' : `Eliminated in ${eliminatedRound}`}
            </span>
            <span className="ph-status-sub">
              {survived} round{survived !== 1 ? 's' : ''} survived
            </span>
          </div>
        </div>
      )}

      {!userId ? (
        <div className="auth-prompt">
          <p className="auth-prompt-text">Sign in to view your picks.</p>
        </div>
      ) : picks.length === 0 ? (
        <p className="text-muted">No picks yet. Make your first pick from the Pick screen.</p>
      ) : (
        <div className="history-list">
          {picks.map((p) => (
            <div key={p.id} className={`history-row survived-${p.survived}`}>
              <div className="history-row-left">
                <span className="history-round-badge">{p.round}</span>
                <span className="history-player">{p.playerName}</span>
              </div>
              <span className={`history-status-pill ${p.survived === null ? 'pending' : p.survived ? 'won' : 'lost'}`}>
                {p.survived === null ? 'Pending' : p.survived ? 'Survived ✓' : 'Eliminated ✗'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
