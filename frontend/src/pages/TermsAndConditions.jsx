import { Link } from 'react-router-dom';
import { Hero } from '../ui/Hero.jsx';
import { Section } from '../ui/Section.jsx';
import { Button } from '../ui/Button.jsx';
import './TermsAndConditions.css';

export function TermsAndConditions() {
  return (
    <div className="tc-page">
      <Hero
        tone="primary"
        compact
        showCourt
        eyebrow="LEGAL"
        title={<>Terms & <em>Conditions</em>.</>}
        lede="The rules of the competition, and a plain-English summary of what you're signing up for."
      />

      <Section tone="canvas" size="lg">
        <div className="tc-top-row">
          <p className="tc-updated">Last updated: April 2026</p>
          <Button as={Link} to="/" variant="ghost" size="sm">
            ← Back to home
          </Button>
        </div>

        <div className="tc-content">

          <section className="tc-section">
            <h2 className="tc-h2">1. Nature of the Competition</h2>
            <p>
              Final Serve-ivor is a strategy and prediction competition based on professional tennis
              tournaments. Participants apply knowledge, skill, and judgement to predict match outcomes
              across multiple rounds. This is a game of skill, not a game of chance, and is not
              gambling or betting of any kind. Participants submit predictions rather than wagers, and
              no outcome is determined by random chance alone.
            </p>
          </section>

          <section className="tc-section">
            <h2 className="tc-h2">2. Eligibility</h2>
            <p>
              Participation is open to individuals aged 18 and over. By entering, you confirm you are
              of legal age and that participation in skill-based prediction competitions is lawful in
              your jurisdiction. Pools may be run on a private, friends-and-family basis or as open
              competitions. The organiser of each pool is responsible for ensuring compliance with
              applicable local laws.
            </p>
          </section>

          <section className="tc-section">
            <h2 className="tc-h2">3. Entry & Prize Pools</h2>
            <p>
              Entry fees vary by pool and are displayed clearly before submission. Some pools are
              free to enter. Where an entry fee applies, it contributes to the prize pool for that
              tournament. Entry fees are non-refundable once the tournament has begun. If a tournament
              is cancelled or abandoned before completion, the organiser will determine a fair
              resolution and communicate it to all participants in writing.
            </p>
          </section>

          <section className="tc-section">
            <h2 className="tc-h2">4. How to Play</h2>
            <p>
              Each round, you must select one tennis player from the remaining draw who you predict
              will win their match. You may not select the same player more than once across the
              tournament. If your chosen player wins, you advance to the next round. If they lose,
              you are eliminated.
            </p>
          </section>

          <section className="tc-section">
            <h2 className="tc-h2">5. Pick Windows</h2>

            <h3 className="tc-h3">5a. Round 1</h3>
            <p>
              Round 1 has a fixed pick deadline, displayed on the pick screen. The deadline is
              typically set to one hour before the first Round 1 match is scheduled to begin. You
              may pick or change your selection at any time before this deadline. After the deadline
              passes, your pick is locked and cannot be changed.
            </p>
            <p>
              If you have not submitted a pick by the deadline, you will be eliminated.
            </p>

            <h3 className="tc-h3">5b. Round 2 onwards</h3>
            <p>
              From Round 2 (Round of 64) onwards, each round has a defined pick window with a fixed
              closing time. The window opens after the previous round's results begin to come in and
              closes before the first match of the current round begins. The exact open and close
              times are displayed on the pick screen. Submissions outside this window are not accepted.
            </p>
            <p>
              It is your responsibility to submit your pick within the window. No exceptions are made
              for technical issues on the participant's end.
            </p>

            <h3 className="tc-h3">5c. Overlapping rounds at Masters 1000 events</h3>
            <p>
              ATP Masters 1000 tournaments use a 96-player draw in which the top 32 seeds receive
              first-round byes. This creates a structural overlap: Round 1 and Round 2 matches may be
              scheduled across overlapping days.
            </p>
            <p>
              Because the Round 2 pick window closes before Round 2 begins, regardless of whether all
              Round 1 matches have been completed, participants may need to submit their Round 2 pick
              before their Round 1 result is known. In this situation, your Round 2 pick will only
              take effect if your Round 1 player wins and you advance. If your Round 1 player loses,
              you are eliminated in Round 1 and your Round 2 pick is disregarded. The pick screen
              will display a warning when this applies.
            </p>
          </section>

          <section className="tc-section">
            <h2 className="tc-h2">6. Player Withdrawals</h2>

            <h3 className="tc-h3">6a. Before the round deadline</h3>
            <p>
              If a player you have selected withdraws from the tournament before the round's pick
              deadline, you will be notified by email. Your pick will be removed and you will be
              able to make a new selection from the remaining available players before the deadline.
            </p>

            <h3 className="tc-h3">6b. After the round deadline (with no time to re-pick)</h3>
            <p>
              If a player you have selected withdraws after the round's pick deadline has passed,
              or too close to the deadline for you to reasonably re-pick, your selection will
              automatically transfer to the replacement player (lucky loser or alternate) who takes
              the withdrawn player's place in the draw. You will be notified by email of this change.
              If no replacement player enters the draw, you will receive a bye for that round and
              continue to the next round.
            </p>

            <h3 className="tc-h3">6c. Mid-match retirement or walkover</h3>
            <p>
              If your selected player retires or is given a walkover after their match has started,
              no replacement pick is available. The match result stands as recorded by the tournament.
              If the withdrawal results in your player being awarded a walkover win, you advance.
              If your player retires or is recorded as the loser, you are eliminated.
            </p>
          </section>

          <section className="tc-section">
            <h2 className="tc-h2">7. Elimination</h2>
            <p>
              You are eliminated if your chosen player loses their match, if you fail to submit a pick
              before all matches in that round have started (Round 1) or before the pick window closes
              (Round 2 onwards), or if your player withdraws after the pick is locked and the result
              counts against you. There is no re-entry once eliminated.
            </p>
          </section>

          <section className="tc-section">
            <h2 className="tc-h2">8. Skill Element</h2>
            <p>
              Successful participation requires knowledge of professional tennis: understanding player
              form, head-to-head records, draw conditions, and round-by-round difficulty. The
              competition rewards informed prediction and strategic thinking over multiple rounds.
              The element of skill is material to the outcome: participants who apply greater
              knowledge and analysis consistently outperform those who do not.
            </p>
          </section>

          <section className="tc-section">
            <h2 className="tc-h2">9. Tiebreaker</h2>
            <p>
              If two or more participants survive to the Final, a tiebreaker will determine the
              winner. Each remaining participant will be asked to predict specific match statistics
              (for example: number of sets, total games, aces). The participant whose combined
              predictions are closest to the actual result wins the prize pool. In the event of an
              exact tie on all tiebreaker answers, the prize pool will be split equally between
              tied participants.
            </p>
          </section>

          <section className="tc-section">
            <h2 className="tc-h2">10. Prize Payment</h2>
            <p>
              The winner will be contacted by the pool organiser within 7 days of the tournament
              Final. Payment will be made via bank transfer or another method agreed between the
              organiser and the winner. No prize can be transferred to a third party.
            </p>
          </section>

          <section className="tc-section">
            <h2 className="tc-h2">11. Notifications</h2>
            <p>
              The competition may send you emails or push notifications relating to pick windows,
              results, withdrawals, and other time-sensitive events. While we make every effort to
              deliver notifications promptly, we do not guarantee delivery times. It remains your
              responsibility to check the pick screen and monitor your selections. Failure to act
              on a notification, or failure to receive one, does not entitle you to an exception
              or extension.
            </p>
          </section>

          <section className="tc-section">
            <h2 className="tc-h2">12. Organiser Decisions</h2>
            <p>
              The pool organiser's decisions on all matters relating to the competition are final,
              including interpretation of the rules, resolution of disputes, and any unforeseen
              circumstances not covered by these terms. The organiser may amend these terms before
              a tournament begins and will notify all participants of any changes.
            </p>
          </section>

          <section className="tc-section">
            <h2 className="tc-h2">13. Data & Privacy</h2>
            <p>
              Final Serve-ivor collects only the information necessary to operate the competition:
              your display name, email address, and picks. This data is not shared with third parties
              and is used solely for the purpose of running the prediction competition and sending
              you relevant notifications.
            </p>
          </section>

        </div>
      </Section>
    </div>
  );
}
