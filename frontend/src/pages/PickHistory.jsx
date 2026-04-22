import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../App';
import { API } from '../App';
import { getTournament } from '../data/tournaments';
import { Hero } from '../ui/Hero.jsx';
import { Section, SectionHeader } from '../ui/Section.jsx';
import { Button } from '../ui/Button.jsx';
import { Card } from '../ui/Card.jsx';
import { ROUND_FULL as ROUND_LABELS } from '../data/roundLabels';
import PlayerAvatar from '../ui/PlayerAvatar';
import { avatarColour, initials } from '../utils/playerImage';
import './PickHistory.css';

export function PickHistory() {
  const { groupId } = useParams();
  const { userId, authFetch } = useAuth();
  const [picks, setPicks] = useState([]);
  const [member, setMember] = useState(null);
  const [tournamentStatus, setTournamentStatus] = useState(null);

  useEffect(() => {
    if (!groupId || !userId) return;
    authFetch(`${API}/picks/history?userId=${userId}&groupId=${groupId}`)
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
        const t = g?.tournamentId ? getTournament(g.tournamentId) : null;
        setTournamentStatus(t?.status || null);
      })
      .catch(() => setMember(null));
  }, [groupId, userId]);

  // Upcoming tournament with no picks yet
  if (tournamentStatus && tournamentStatus !== 'active' && tournamentStatus !== 'completed' && picks.length === 0) {
    return (
      <div className="ph-page">
        <Hero
          tone="primary"
          compact
          showCourt
          eyebrow="YOUR PICKS"
          title={<>Picks <em>drop soon</em>.</>}
          lede="Your run through the tournament will appear here as soon as the first round opens."
        />
        <Section tone="canvas" size="md">
          <div className="ph-back-row">
            <Button as={Link} to={`/group/${groupId}`} variant="ghost" size="sm">
              ← Back to pool
            </Button>
          </div>
          <Card tone="muted" padding="lg" className="ph-empty-card">
            <div className="ph-empty-icon" aria-hidden="true">🎾</div>
            <p className="ph-empty-title">No picks yet</p>
            <p className="ph-empty-sub">
              Your pick history will appear here once the tournament starts.
            </p>
          </Card>
        </Section>
      </div>
    );
  }

  const survived = picks.filter((p) => p.survived === true).length;
  const lost = picks.filter((p) => p.survived === false).length;
  const pending = picks.filter((p) => p.survived === null).length;
  const isAlive = member ? member.isAlive : null;
  const eliminatedRound = member ? member.eliminatedRound : null;

  return (
    <div className="ph-page">
      <Hero
        tone="primary"
        compact
        showCourt
        eyebrow="YOUR PICKS"
        title={<>Your <em>run</em>, round by round.</>}
        lede="Every player you've picked, every result. The full story of how far you've survived."
      />

      <Section tone="canvas" size="md">
        <div className="ph-top-row">
          <SectionHeader
            eyebrow="HISTORY"
            title={<>How it's <em>gone</em> so far.</>}
          />
          <Button as={Link} to={`/group/${groupId}`} variant="ghost" size="sm">
            ← Back to pool
          </Button>
        </div>

        {/* Status card */}
        {isAlive !== null && (
          <div className={`ph-status-card${isAlive ? ' ph-status--alive' : ' ph-status--out'}`}>
            <div className="ph-status-left">
              <span className="ph-status-dot-wrap">
                <span className={`ph-status-dot ${isAlive ? 'ph-status-dot--alive' : 'ph-status-dot--out'}`} />
              </span>
              <div className="ph-status-text">
                <span className="ph-status-headline">
                  {isAlive ? 'Still in the game' : `Eliminated in ${ROUND_LABELS[eliminatedRound] || eliminatedRound || '—'}`}
                </span>
                <span className="ph-status-sub">
                  {survived} round{survived !== 1 ? 's' : ''} survived
                </span>
              </div>
            </div>
            <div className="ph-status-stats">
              <div className="ph-status-stat">
                <span className="ph-status-stat-value ph-status-stat--won">{survived}</span>
                <span className="ph-status-stat-label">Won</span>
              </div>
              <div className="ph-status-stat">
                <span className="ph-status-stat-value ph-status-stat--lost">{lost}</span>
                <span className="ph-status-stat-label">Lost</span>
              </div>
              {pending > 0 && (
                <div className="ph-status-stat">
                  <span className="ph-status-stat-value ph-status-stat--pending">{pending}</span>
                  <span className="ph-status-stat-label">Pending</span>
                </div>
              )}
            </div>
          </div>
        )}

        {!userId ? (
          <Card tone="muted" padding="lg" className="ph-empty-card">
            <p className="ph-empty-title">Sign in to view your picks.</p>
          </Card>
        ) : picks.length === 0 ? (
          <Card tone="muted" padding="lg" className="ph-empty-card">
            <div className="ph-empty-icon" aria-hidden="true">🎾</div>
            <p className="ph-empty-title">No picks yet</p>
            <p className="ph-empty-sub">
              Make your first pick from the Pick screen.
            </p>
          </Card>
        ) : (
          <div className="ph-card-list">
            {picks.map((p, idx) => {
              const state = p.survived === null ? 'pending' : p.survived ? 'won' : 'lost';
              const cardClass = [
                'ph-card',
                `ph-card--${state}`,
              ].join(' ');

              return (
                <div key={p.id} className={cardClass}>
                  <span className="ph-card-round">{p.round}</span>
                  <PlayerAvatar playerName={p.playerName} size={40} />
                  <div className="ph-card-info">
                    <div className="ph-card-name">
                      <span className={`ph-card-name-text${state === 'lost' ? ' ph-card-name--lost' : ''}`}>
                        {p.playerName}
                      </span>
                    </div>
                    <div className="ph-card-meta">
                      {ROUND_LABELS[p.round] || p.round}
                    </div>
                  </div>
                  <div className="ph-card-right">
                    <span className={`ph-card-result ph-card-result--${state}`}>
                      {state === 'won' && (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          {' '}Advanced
                        </>
                      )}
                      {state === 'lost' && (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          {' '}Eliminated
                        </>
                      )}
                      {state === 'pending' && 'Pending'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}
