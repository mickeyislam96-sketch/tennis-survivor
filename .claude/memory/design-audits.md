# Final Serve-ivor — Design Audit Summary

## Audit date: 17 Apr 2026

Two audits conducted comparing live site against peer benchmarks (Stripe, Linear, Vercel) and using a structured design framework.

## Key recommendations (prioritised)
1. **Hero CTA needs stronger visual weight** — gold pill button should dominate the hero section
2. **Wider canvas** — current layout feels narrow compared to modern SaaS benchmarks
3. **Trust signals missing** — no social proof, user count, or testimonial elements
4. **Remove 3D-tilted pick-screen innovation** — identified as unnecessary complexity
5. **Velocity as primary macro bet** — design should prioritise speed and responsiveness over visual flair

## Player images (planned, not yet built)
- Three sourcing paths evaluated:
  - Path A (recommended): API-Tennis with graceful fallback to initials
  - Path B: curated seeded-only images
  - Path C: paid sports data API (expensive)
- Integration points: matchup modal and pick screen
- Fallback: coloured circle with player initials

## What's been actioned
- Micro-interactions CSS deployed (19 Apr): button feedback, card animations, pick pulse, skeleton shimmer, tab crossfade, gold CTA shimmer, arrow nudge
- Email brand alignment completed (19 Apr): three-font system, court background, gold pill CTAs, split-font footer
- Support contact form built (19 Apr): full form with category, subject, message, user context badge, Brevo email delivery
- Gold pill "My Pool" nav link added (19 Apr): fetches pool membership, links to group page, visible only when logged in
- How to Play copy simplified (19 Apr): removed free/paid references, strategy tips, retirement/withdrawal language, prize-splitting detail

## What's NOT yet actioned
- Wider canvas / layout changes
- Trust signals / social proof
- Player images integration
- Hero CTA visual weight improvements
