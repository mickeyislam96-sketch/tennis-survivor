import { Link } from 'react-router-dom';

export function TermsAndConditions() {
  return (
    <div className="page terms-page">
      <div className="terms-header">
        <div>
          <h1>Terms &amp; Conditions</h1>
          <p className="terms-updated">Last updated: March 2026</p>
        </div>
        <Link to="/" className="back-link">← Back to home</Link>
      </div>

      <section className="terms-section">
        <h2>1. The Game</h2>
        <p>
          Tennis Last Man Standing is a private prediction game based on Grand Slam tennis
          tournaments. Each participant pays a £20 entry fee to join a group. Entry fees are pooled
          to form the prize fund. The last surviving participant wins the prize pool.
        </p>
      </section>

      <section className="terms-section">
        <h2>2. Eligibility</h2>
        <p>
          Participation is open to individuals aged 18 and over. By entering, you confirm you are
          of legal age and that participation in prize competitions is lawful in your jurisdiction.
          This game is run on a private, friends-and-family basis and is not open to the general
          public.
        </p>
      </section>

      <section className="terms-section">
        <h2>3. Entry Fee &amp; Prize Pool</h2>
        <p>
          The entry fee is £20 per person per tournament. The prize pool is the total of all entry
          fees collected for that tournament. Entry fees are non-refundable once a tournament has
          begun. If a tournament is cancelled or abandoned before completion, the organiser will
          determine a fair resolution and communicate this to all participants.
        </p>
      </section>

      <section className="terms-section">
        <h2>4. How to Play</h2>
        <p>
          Each round, you must select one tennis player from the remaining draw who you believe will
          win their match. Your pick must be submitted before the round deadline (30 minutes before
          the first match of that round). If your chosen player wins, you advance to the next round.
          If they lose, you are eliminated. You may not pick the same player twice across the
          tournament.
        </p>
      </section>

      <section className="terms-section">
        <h2>5. Pick Deadlines</h2>
        <p>
          Picks lock automatically at the deadline shown on the pick screen. Late picks are not
          accepted under any circumstances. It is your responsibility to submit your pick in time.
          No exceptions will be made for technical issues on the participant's end.
        </p>
      </section>

      <section className="terms-section">
        <h2>6. Elimination</h2>
        <p>
          You are eliminated if your chosen player loses their match, or if all players you have
          not yet picked have already been knocked out of the tournament. There is no re-entry once
          eliminated.
        </p>
      </section>

      <section className="terms-section">
        <h2>7. Tiebreaker</h2>
        <p>
          If two or more participants survive to the Final, a tiebreaker will be used. Each
          remaining participant will be asked to predict specific match statistics (e.g. number of
          sets, total games, aces). The participant whose combined predictions are closest to the
          actual result wins the prize pool. In the event of an exact tie on tiebreaker answers,
          the prize pool will be split equally.
        </p>
      </section>

      <section className="terms-section">
        <h2>8. Prize Payment</h2>
        <p>
          The winner will be contacted by the group organiser within 7 days of the tournament
          Final. Payment will be made via bank transfer or another method agreed between the
          organiser and the winner. No prize can be transferred to a third party.
        </p>
      </section>

      <section className="terms-section">
        <h2>9. Organiser Decisions</h2>
        <p>
          The group organiser's decisions on all matters relating to the game are final, including
          but not limited to: interpretation of the rules, resolution of disputes, and any
          unforeseen circumstances not covered by these terms. The organiser may amend these terms
          at any time before a tournament begins.
        </p>
      </section>

      <section className="terms-section">
        <h2>10. Responsible Play</h2>
        <p>
          This game involves a financial stake. Please only enter if you can afford to lose your
          entry fee. If you have concerns about gambling, visit{' '}
          <a href="https://www.begambleaware.org" target="_blank" rel="noreferrer">
            begambleaware.org
          </a>
          .
        </p>
      </section>
    </div>
  );
}
