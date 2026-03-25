import { Link } from 'react-router-dom';

export function TermsAndConditions() {
  return (
    <div className="page terms-page">
      <div className="terms-header">
        <div>
          <h1>Terms &amp; Conditions</h1>
          <p className="terms-updated">Last updated: 25 March 2026</p>
        </div>
        <Link to="/" className="back-link">← Back to home</Link>
      </div>

      <section className="terms-section">
        <h2>1. Nature of the Competition</h2>
        <p>
          Final Serve-ivor is a strategy and prediction competition based on professional ATP tennis
          tournaments. Participants apply knowledge, skill, and judgement to predict match outcomes
          across multiple rounds. This is a game of skill, not a game of chance, and does not
          constitute gambling or betting. Participants submit predictions rather than wagers, and
          no outcome is determined by random chance alone.
        </p>
      </section>

      <section className="terms-section">
        <h2>2. Eligibility</h2>
        <p>
          Participation is open to individuals aged 18 and over. By entering, you confirm that you
          are at least 18 years of age and that participation in skill-based prediction competitions
          is lawful in your jurisdiction. It is your responsibility to verify your local laws before
          entering. The operator accepts no liability where a participant enters from a jurisdiction
          in which such participation is restricted.
        </p>
      </section>

      <section className="terms-section">
        <h2>3. Accounts</h2>
        <p>
          You must register an account to participate. You may hold more than one account, but
          each account entered into a pool requires its own entry fee and is treated as a
          separate participant. You are responsible for maintaining the security of your account
          credentials. The operator is not liable for any loss arising from unauthorised access
          to your account.
        </p>
      </section>

      <section className="terms-section">
        <h2>4. Entry &amp; Prize Pools</h2>
        <p>
          Entry fees vary by pool and are displayed clearly before you join. Some pools are free to
          enter. Where an entry fee applies, 100% of the collected entry fees form the prize pool
          for that tournament unless stated otherwise on the pool page. Entry fees are
          non-refundable once the first match of the tournament has begun.
        </p>
        <p>
          If you join a pool before the tournament starts and the tournament is subsequently
          cancelled before any matches are played, your entry fee will be refunded in full. If a
          tournament is abandoned or significantly disrupted after play has begun, the operator will
          determine a fair resolution (which may include a partial refund, an equal split of the
          prize pool among surviving participants, or another arrangement) and will communicate it
          to all participants in writing within 14 days.
        </p>
      </section>

      <section className="terms-section">
        <h2>5. How to Play</h2>
        <p>
          Each round, you must select one tennis player from the available draw whom you predict
          will win their match in that round. Your selection must be submitted within the pick
          window for that round. You may not select the same player more than once across the
          entire tournament. If your chosen player wins their match, you advance to the next round.
          If your chosen player loses, you are eliminated from the pool.
        </p>
      </section>

      <section className="terms-section">
        <h2>6. Pick Windows</h2>
        <p>
          Each round has a defined pick window during which selections are accepted. The window
          opens after the previous round concludes (or, for the first round, when the draw is
          released) and closes before the first match of that round begins. The exact open and
          close times are displayed on the pick screen and are final.
        </p>
        <p>
          Submissions outside the pick window are not accepted under any circumstances. It is your
          sole responsibility to submit your pick before the window closes. No extensions or
          exceptions will be granted for late submissions, whether caused by technical issues on
          your device, internet connectivity problems, time zone misunderstanding, or any other
          reason.
        </p>
        <p>
          If you fail to submit a pick within the window, you are automatically eliminated.
        </p>
      </section>

      <section className="terms-section">
        <h2>6a. Overlapping Rounds</h2>
        <p>
          ATP tournaments vary in draw size and structure. In some formats, top-seeded players
          receive byes and enter the draw at a later stage. This can create a structural overlap
          where the pick window for a subsequent round opens and closes while matches from the
          previous round are still in progress.
        </p>
        <p>
          In this situation, you may need to submit your next-round pick before your current-round
          result is known. This is an inherent feature of the tournament format, not an error in
          the competition. The pick screen will display a warning when this applies.
        </p>
        <p>
          If you submit a pick for the next round while your current-round match is still pending,
          that pick will only take effect if you advance. If your current-round player loses, you
          are eliminated in the current round and your next-round pick is disregarded.
        </p>
        <p>
          It is your sole responsibility to monitor the pick screen, note any warnings, and submit
          your pick within the open window regardless of whether previous-round results are
          confirmed.
        </p>
      </section>

      <section className="terms-section">
        <h2>7. Walkovers, Retirements &amp; Disqualifications</h2>
        <p>
          If a match is decided by walkover (where one player does not take to the court),
          retirement (where a player withdraws during the match), or disqualification, the
          player who retires, withdraws, or is disqualified is treated as having lost the match.
          If your chosen player is the one who retires, walks over, or is disqualified, your
          pick counts as a loss and you are eliminated.
        </p>
        <p>
          If your chosen player's opponent retires, walks over, or is disqualified, your chosen
          player advances and your pick counts as correct.
        </p>
        <p>
          If both players are unable to complete the match and the ATP removes the match from
          the draw entirely or assigns a replacement, the operator will determine how affected
          picks are handled and will communicate the decision to all participants.
        </p>
      </section>

      <section className="terms-section">
        <h2>8. Elimination</h2>
        <p>
          You are eliminated from a pool if any of the following occur: (a) your chosen player
          loses their match, retires, withdraws, or is disqualified; (b) you fail to submit a pick
          before the pick window closes; or (c) you are disqualified by the operator for a breach
          of these terms. There is no re-entry once eliminated.
        </p>
      </section>

      <section className="terms-section">
        <h2>9. Winning &amp; Prize Distribution</h2>
        <p>
          The competition continues until either one participant remains or the tournament ends.
          If a single participant outlasts all others, that participant wins the entire prize pool.
          If two or more participants survive to the end of the tournament (i.e. multiple
          participants correctly predict the winner of the Final), the prize pool is split equally
          among all surviving participants.
        </p>
        <p>
          If all remaining participants are eliminated in the same round (for example, every
          survivor picks incorrectly in the same round), the prize pool is split equally among
          those participants.
        </p>
        <p>
          The winner(s) will be contacted by the operator within 7 days of the tournament Final.
          Payment will be made via bank transfer or another method agreed between the operator
          and the recipient. If a winner cannot be reached after reasonable attempts over 30 days,
          the operator reserves the right to forfeit the unclaimed portion. No prize may be
          transferred to a third party.
        </p>
      </section>

      <section className="terms-section">
        <h2>10. Skill Element</h2>
        <p>
          Successful participation requires knowledge of professional tennis, including player form,
          surface preferences, head-to-head records, draw conditions, and round-by-round difficulty.
          The competition rewards informed prediction and strategic resource management over multiple
          rounds. The element of skill is material to the outcome: participants who apply greater
          knowledge and analysis consistently outperform those who do not.
        </p>
      </section>

      <section className="terms-section">
        <h2>11. Prohibited Conduct &amp; Disqualification</h2>
        <p>
          The following conduct is prohibited and may result in immediate disqualification without
          refund: colluding with other participants to coordinate picks; using automated tools or
          bots to submit picks; attempting to exploit bugs or vulnerabilities in the platform; or
          any behaviour that the operator, in its sole discretion, considers to undermine the
          fairness or integrity of the competition.
        </p>
      </section>

      <section className="terms-section">
        <h2>12. Operator Decisions</h2>
        <p>
          The operator's decisions on all matters relating to the competition are final, including
          the interpretation of these terms, the resolution of disputes, and any unforeseen
          circumstances not covered herein. The operator may amend these terms before a tournament
          begins and will notify all registered participants of material changes via email or
          on-site notice. No changes will be made to these terms after the first match of a
          tournament has begun, except where required to correct an obvious error or to comply
          with applicable law.
        </p>
      </section>

      <section className="terms-section">
        <h2>13. Platform Availability</h2>
        <p>
          The operator will use reasonable efforts to keep the platform available and functioning
          correctly. However, the operator does not guarantee uninterrupted access and accepts no
          liability for any loss, elimination, or missed pick window caused by platform downtime,
          server errors, third-party data feed failures, or any event beyond the operator's
          reasonable control. It is your responsibility to submit your picks with sufficient time
          before the window closes to account for potential technical issues.
        </p>
      </section>

      <section className="terms-section">
        <h2>14. Data &amp; Privacy</h2>
        <p>
          To operate the competition, we collect your email address, display name, and password
          (stored as a secure hash). We also store your pick history and group membership. This
          data is used solely for the purpose of running the competition and communicating with
          you about tournaments you have entered.
        </p>
        <p>
          We do not sell, rent, or share your personal data with third parties. We may send you
          transactional emails related to your account and pools you have joined (such as
          confirmation of entry, pick reminders, and results). You may request deletion of your
          account and associated data at any time by contacting the operator.
        </p>
      </section>

      <section className="terms-section">
        <h2>15. Limitation of Liability</h2>
        <p>
          To the fullest extent permitted by law, the operator's total liability in connection
          with the competition is limited to the entry fee you paid for the relevant pool. The
          operator is not liable for any indirect, incidental, or consequential loss, including
          lost winnings arising from platform unavailability, data errors, or incorrect match
          results from third-party data providers.
        </p>
      </section>

      <section className="terms-section">
        <h2>16. Governing Law</h2>
        <p>
          These terms are governed by and construed in accordance with the laws of England and
          Wales. Any dispute arising from or in connection with these terms or the competition
          shall be subject to the exclusive jurisdiction of the courts of England and Wales.
        </p>
      </section>

      <section className="terms-section">
        <h2>17. Contact</h2>
        <p>
          For questions about these terms or the competition, contact the operator at{' '}
          <a href="mailto:finalservivor@gmail.com">finalservivor@gmail.com</a>.
        </p>
      </section>
    </div>
  );
}
