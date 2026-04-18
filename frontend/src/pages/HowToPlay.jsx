import { Link } from 'react-router-dom';
import { Hero } from '../ui/Hero.jsx';
import { Section, SectionHeader } from '../ui/Section.jsx';
import { Card } from '../ui/Card.jsx';
import { Button } from '../ui/Button.jsx';
import './HowToPlay.css';

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
    <div className="htp-page">
      <Hero
        tone="ink"
        showCourt
        eyebrow="HOW TO PLAY"
        title={<>The rules are <em>simple</em>.<br />The strategy is everything.</>}
        lede="Pick one player per round. If they win, you survive. If they lose, you're out. Last one standing takes the pot."
        primaryCta={{ label: 'Find a pool', to: '/' }}
      />

      <Section tone="canvas" size="lg">
        <SectionHeader
          eyebrow="THE GAME"
          title={<>Five steps, one <em>winner</em>.</>}
          lede="It's the oldest survivor format, adapted for tennis. No fantasy points, no weekly line-ups. Just one pick and one question: will they win?"
        />

        <div className="htp-steps">
          {STEPS.map((s) => (
            <Card key={s.num} tone="default" padding="lg" className="htp-step">
              <div className="htp-step-num" aria-hidden="true">{String(s.num).padStart(2, '0')}</div>
              <div className="htp-step-icon" aria-hidden="true">{s.icon}</div>
              <h3 className="htp-step-title">{s.title}</h3>
              <p className="htp-step-body">{s.body}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section tone="sunken" size="lg">
        <SectionHeader
          eyebrow="STRATEGY"
          title={<>A few tips to <em>survive</em> longer.</>}
          lede="You can't control the outcomes, but you can control when you spend your best picks."
        />

        <div className="htp-tips">
          {TIPS.map((t, i) => (
            <Card key={i} tone="surface" padding="lg" className="htp-tip">
              <h4 className="htp-tip-title">{t.title}</h4>
              <p className="htp-tip-body">{t.body}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section tone="primary" size="md">
        <div className="htp-cta">
          <h2 className="htp-cta-title">Ready to <em>play</em>?</h2>
          <p className="htp-cta-sub">Join a pool and make your first pick.</p>
          <Button as={Link} to="/" variant="gold" size="lg">
            Find a pool →
          </Button>
        </div>
      </Section>
    </div>
  );
}
