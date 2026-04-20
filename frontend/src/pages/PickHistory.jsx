import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../App';
import { API } from '../App';
import { TOURNAMENTS } from '../data/tournaments';
import { Hero } from '../ui/Hero.jsx';
import { Section, SectionHeader } from '../ui/Section.jsx';
import { Button } from '../ui/Button.jsx';
import { Card } from '../ui/Card.jsx';
import { Badge } from '../ui/Badge.jsx';
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
        const t = g?.tournamentId ? TOURNAMENTS.find(t => t.id === g.tournamentId) : null;
        setTournamentStatus(t?.status || null);
      })
      .catch(() => setMember(null));
  }, [groupId, userId]);

  // Upcoming tournament — no picks exist yet
  if (tournamentStatus && tournamentStatus !== 'active' && tournamentStatus !== 'completed') {
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
          <Card
            tone={isAlive ? 'success' : 'muted'}
            padding="md"
            className={`ph-status-card${isAlive ? ' ph-status--alive' : ' ph-status--out'}`}
          >
            <span className="ph-status-icon" aria-hidden="true">{isAlive ? '✅' : '❌'}</span>
            <div className="ph-status-text">
              <span className="ph-status-headline">
                {isAlive ? 'Still in — keep going.' : `Eliminated in ${eliminatedRound}`}
              </span>
              <span className="ph-status-sub">
                {survived} round{survived !== 1 ? 's' : ''} survived
              </span>
            </div>
          </Card>
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
          <div className="ph-list">
            {picks.map((p) => {
              const state = p.survived === null ? 'pending' : p.survived ? 'won' : 'lost';
              return (
                <Card
                  key={p.id}
                  tone="surface"
                  padding="sm"
                  className={`ph-row ph-row--${state}`}
                >
                  <div className="ph-row-left">
                    <span className="ph-round-badge">{p.round}</span>
                    <span className="ph-player">{p.playerName}</span>
                  </div>
                  {state === 'pending' && (
                    <Badge tone="neutral" size="sm">Result pending</Badge>
                  )}
                  {state === 'won' && (
                    <Badge tone="success" size="sm">Advanced ✓</Badge>
                  )}
                  {state === 'lost' && (
                    <Badge tone="danger" size="sm">Eliminated ✗</Badge>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}
