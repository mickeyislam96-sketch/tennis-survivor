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
        <h2>1. Nature of the Competition</h2>
        <p>
          Final Serve-ivor is a strategy and prediction competition based on professional tennis
          tournaments. Participants apply knowledge, skill, and judgement to predict match outcomes
          across multiple rounds. This is a game of skill — not a game of chance — and is not
          gambling or betting of any kind. Participants submit predictions rather than wagers, and
          no outcome is determined by random chance alone.
        </p>
      </section>

      <section className="terms-section">
        <h2>2. Eligibility</h2>
        <p>
          Participation is open to individuals aged 18 and over. By entering, you confirm you are
          of legal age and that participation in skill-based prediction competitions is lawful in
          your jurisdiction. Pools may be run on a private, friends-and-family basis or as open
          competitions. The organiser of each pool is responsible for ensuring compliance with
          applicable local laws.
        </p>
      </section>

      <section className="terms-section">
        <h2>3. Entry &amp; Prize Pools</h2>
        <p>
          Entry fees vary by pool and are displayed clearly before submission. Some pools are
          free to enter. Where an entry fee applies, it contributes to the prize pool for that
          tournament. Entry fees are non-refundable once the tournament has begun. If a tournament
          is cancelled or abandoned before completion, the organiser will determine a fair
          resolution and communicate it to all participants in writing.
        </p>
      </section>

      <section className="terms-section">
        <h2>4. How to Play</h2>
        <p>
          Each round, you must select one tennis player from the remaining draw who you predict
          will win their match. Your selection must be submitted within the pick window — the
          time period between the close of the previous round and the start of the next. You may
          not select the same player more than once across the tournament. If your chosen player
          wins, you advance to the next round. If they lose, you are eliminated.
        </p>
      </section>

      <section className="terms-section">
        <h2>5. Pick Windows</h2>
        <p>
          Each round has a defined pick window during which submissions are accepted. The window
          opens after the previous round concludes and closes before the first match of the next
          round begins. The exact open and close times are displayed on the pick screen. Submissions
          outside this window are not accepted. It is your responsibility to submit within the
          window. No exceptions are made for technical issues on the participant's end.
        </p>
      </section>

      <section className="terms-section">
        <h2>6. Skill Element</h2>
        <p>
          Successful participation requires knowledge of professional tennis: understanding player
          form, head-to-head records, draw conditions, and round-by-round difficulty. The
          competition rewards informed prediction and strategic thinking over multiple rounds.
          The element of skill is material to the outcome — participants who apply greater
          knowledge and analysis consistently outperform those who do not.
        </p>
      </section>

      <section className="terms-section">
        <h2>7. Elimination</h2>
        <p>
          You are eliminated if your chosen player loses their match, or if you fail to submit
          a pick within the window. There is no re-entry once eliminated.
        </p>
      </section>

      <section className="terms-section">
        <h2>8. Tiebreaker</h2>
        <p>
          If two or more participants survive to the Final, a tiebreaker will determine the
          winner. Each remaining participant will be asked to predict specific match statistics
          (for example: number of sets, total games, aces). The participant whose combined
          predictions are closest to the actual result wins the prize pool. In the event of an
          exact tie on all tiebreaker answers, the prize pool will be split equally between
          tied participants.
        </p>
      </section>

      <section className="terms-section">
        <h2>9. Prize Payment</h2>
        <p>
          The winner will be contacted by the pool organiser within 7 days of the tournament
          Final. Payment will be made via bank transfer or another method agreed between the
          organiser and the winner. No prize can be transferred to a third party.
        </p>
      </section>

      <section className="terms-section">
        <h2>10. Organiser Decisions</h2>
        <p>
          The pool organiser's decisions on all matters relating to the competition are final,
          including interpretation of the rules, resolution of disputes, and any unforeseen
          circumstances not covered by these terms. The organiser may amend these terms before
          a tournament begins and will notify all participants of any changes.
        </p>
      </section>

      <section className="terms-section">
        <h2>11. Data &amp; Privacy</h2>
        <p>
          Final Serve-ivor collects only the information necessary to operate the competition:
          your display name and picks. This data is not shared with third parties and is used
          solely for the purpose of running the prediction competition.
        </p>
      </section>
    </div>
  );
}
