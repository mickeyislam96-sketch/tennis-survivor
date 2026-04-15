import { Link } from 'react-router-dom';

const STEPS = [
  {
    num: 1,
    icon: '🏆',
    title: 'Join a pool',
    body: 'Find an open tournament pool or use an invite code from a friend. Some pools are free, others have an entry fee that goes straight into the prize pot.',
  },
  {
    num: 2,
    icon: '🎾',
    title: 'Pick one player per round',
    body: 'Before each round, choose one tennis player you think will win their match. You can pick any player in the draw, but you can never pick the same player twice in a tournament. Save your strongest picks for the later rounds when the field gets tougher.',
  },
  {
    num: 3,
    icon: '⏰',
    title: 'Beat the deadline',
    body: "Each round has a pick window that closes before the first match starts. If you don't submit a pick in time, you're automatically eliminated. The countdown timer on the pick screen shows exactly how long you have.",
  },
  {
    num: 4,
    icon: '✅',
    title: 'Your player wins? You survive.',
    body: "If your chosen player wins their match, you advance to the next round. If they lose, retire, or withdraw mid-match, you're out. Simple as that.",
  },
  {
    num: 5,
    icon: '👑',
    title: 'Last one standing wins',
    body: "The game continues round by round until one person is left. That survivor takes the entire prize pool. If multiple people make it to the end, the prize is split equally.",
  },
];

const TIPS = [
  {
    title: "Don't waste your best picks early",
    body: "Djokovic might be a safe R1 pick, but you'll wish you had him for the Quarter-finals. Use lower-ranked players in the early rounds when match-ups are more predictable.",
  },
  {
    title: 'Watch for surface specialists',
    body: "A clay-court specialist on clay is a safer bet than a higher-ranked player who struggles on the surface. Check recent form and surface records.",
  },
  {
    title: 'Check the draw before you pick',
    body: "Use the Draw page to see the full bracket. If your player has a tough next-round opponent, think twice before using them now.",
  },
  {
    title: 'Monitor withdrawals',
    body: "If your picked player withdraws after the deadline closes, we'll email you with a chance to re-pick before their match starts. Keep an eye on your inbox during the tournament.",
  },
];

export function HowToPlay() {
  return (
    <div className="page how-to-play">
      <div className="htp-header">
        <div>
          <h1>How to Play</h1>
          <p className="htp-subtitle">The rules are simple. The strategy is everything.</p>
        </div>
        <Link to="/" className="back-link">&larr; Back to home</Link>
      </div>

      <div className="htp-steps">
        {STEPS.map((s) => (
          <div key={s.num} className="htp-step">
            <div className="htp-step-icon">{s.icon}</div>
            <div className="htp-step-num">{s.num}</div>
            <h3 className="htp-step-title">{s.title}</h3>
            <p className="htp-step-body">{s.body}</p>
          </div>
        ))}
      </div>

      <div className="htp-tips-section">
        <h2 className="htp-tips-heading">Strategy Tips</h2>
        <div className="htp-tips">
          {TIPS.map((t, i) => (
            <div key={i} className="htp-tip">
              <h4 className="htp-tip-title">{t.title}</h4>
              <p className="htp-tip-body">{t.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="htp-cta-section">
        <h2>Ready to play?</h2>
        <p>Join a pool and make your first pick.</p>
        <Link to="/" className="btn primary">Find a pool &rarr;</Link>
      </div>
    </div>
  );
}
