# Muse — Marketing and Positioning

This documents the value proposition, competitive landscape, and pricing
rationale behind the scope in [SCOPE.md](SCOPE.md). Findings below marked
"verified" were checked against the live product/site at the time of
writing; treat everything else as informed judgment, not confirmed fact —
revisit before making spend decisions.

## Positioning statement

> **For readers who process life through story, Muse is the daily companion
> that writes to you in the voice of what you love — personalized to your
> favorite books, films, and poetry, and gently attuned to your cycle —
> instead of generic affirmations everyone else gets.**

Short pitch (App Store / landing page): **"Your daily story, written for
you."**

Positioning deliberately leads with **taste-personalization**, not with
"period app" or "AI wellness companion" — both of those framings drop Muse
into crowded categories with entrenched incumbents and weak differentiation.

## Target audience (v1)

Women, roughly 20–38, who already identify as readers/story-lovers — active
on Goodreads/StoryGraph/Bookstagram/BookTok, or already journaling — and who
already pay for at least one wellness or self-improvement subscription.

Explicitly not targeted in v1: general "anyone stressed," men, B2B/enterprise
wellness, or a mass-market "everyone" audience — those are exactly the
segments Calm/Headspace/Flo already own on brand budget alone.

## Competitive landscape (verified against live products)

| Product | What they own | What they don't do | Muse's angle |
|---|---|---|---|
| **Flo** (flo.health) | Massive cycle-tracking scale (100M+ users), fertility/pregnancy data, clinical framing | Generic educational content; no literary/narrative layer; no taste personalization | Muse never competes on tracking/clinical trust — cycle is a tone input, not the product |
| **Clue** (helloclue.com) | EU-based cycle tracking, privacy-forward brand | Same as Flo — data-first, no creative writing layer | Same as above |
| **Stoic** (getstoic.com) | Daily philosophy quote + journaling, personalized — closest structural comparable | Fixed canon (Stoic philosophers only); no cycle awareness; no tone selector; no taste input | Muse personalizes the *canon itself* to the user's taste, not just the delivery |
| **Chani** (chani.com) | Astrology-based daily personalized insight, strong subscriber base, mission-driven brand | Personalizes by birth chart, not by the user's own literary/film taste; no cycle link | Muse personalizes by what the user actually reads/watches, not a birth chart |
| **Co-Star** | Astrology one-liners, huge download numbers | Generic per-sign content; not deeply personalized; no citations | Same as above |
| **Goodreads / StoryGraph / Letterboxd** | Reviews, shelving, mood-tagging (StoryGraph specifically already does mood-based book recommendations), huge network-effect data moats | No daily emotional/narrative content; no cycle awareness; recommendation-first, not companionship-first | Muse never competes on discovery breadth — recommendations are a small emotionally-framed coda, not a browse feature |
| **Finch** (finchcare.com) | Self-care companion pet app, daily check-ins, streaks | Different name, near-identical daily-companion mechanic, but generic content, no literary personalization | Muse's taste-personalization and citation layer is the wedge Finch doesn't have |
| **`choosemuse.com`** (InteraXon) | Established meditation/sleep EEG wellness hardware brand | N/A — flagged as a **naming conflict**, not a product competitor | Confirms "Muse" needs to be renamed before launch |
| **`muse.ai`** | An existing AI companion/assistant product using this exact name | N/A — flagged as a **direct naming conflict** | Same — highest-priority rename trigger |

## The verified regulatory precedent that shapes trust positioning

The FTC brought a real 2021 enforcement action against **Flo Health**
specifically for sharing sensitive menstrual-cycle data with third-party
analytics and ad platforms (Facebook, Google, Flurry/AppsFlyer) without
adequate disclosure. This is directly usable as a **trust differentiator**:
Muse can credibly market "we never share your cycle data with advertisers,"
backed by the binding engineering constraint already written into
[SCOPE.md](SCOPE.md), in a category where the largest player has already been
publicly sanctioned for the opposite.

## Why this is a real gap, not wishful thinking

Nobody in the table above personalizes daily content by the user's own
literary/film/poetry taste. Flo/Clue personalize by biological data.
Chani/Co-Star personalize by birth chart. Stoic personalizes by mood/goal but
draws from a fixed philosophical canon. Goodreads/StoryGraph/Letterboxd
personalize recommendations, not daily emotional companionship. "Write me
something in the spirit of what *I* love" is not a mechanic any of these
products offer today.

## Realistic size expectations

- This is a **Stoic-scale opportunity, not a Flo-scale one.** Flo/Chani-scale
  outcomes come from owning a universal-need utility (health tracking) or a
  mass cultural hook (astrology); Muse's taste-personalization niche is
  narrower by design.
- Products in this bracket (curated daily content + personalization,
  non-clinical) typically monetize in the **$5–15/month or $40–90/year**
  range industry-wide, with free-to-paid conversion in the low single digits
  to roughly 10%.
- The category has real casualties (e.g., Woebot's consumer app shut down in
  2023) usually from weak retention after novelty fades, not from lack of
  initial interest — which is exactly why the retention mechanics below
  matter as much as the initial hook.

## Pricing (v1)

Ship **Free + one paid tier only** — a 3-tier ladder is a v2 optimization
once real retention data exists.

| Tier | Price (typical range for this category) | Includes |
|---|---|---|
| **Free** | $0 | Daily text message, tone selector, one voice archetype, no audio |
| **Paid** | ~$6–8/mo or ~$45–60/yr | + rituals, + audio narration, + cycle-aware tone, + literary citations, + Commonplace Book |

Later, once validated: split the paid tier into Plus/Premium per
[SCOPE.md](SCOPE.md#business-model-summary), and add the printed-keepsake
one-time purchase and recommendation affiliate revenue as secondary streams.

## Retention mechanics (why this keeps customers, not just acquires them)

Consumption-only content plateaus fast. The mechanics below convert
consumption into **ownership**, which is what actually extends lifetime
value:

1. **Commonplace Book** — saved messages + personal reflections become a
   growing personal artifact with real loss-aversion (leaving means losing
   the collection, not just unsubscribing from a feed).
2. **Annual recap ("Muse Wrapped")** — a proven mechanic (Spotify Wrapped) for
   driving reactivation and organic sharing even among lapsed users.
3. **Printed keepsake** — verified real business model: **StoryWorth**
   (welcome.storyworth.com) turns accumulated daily/weekly prompts into a
   purchased printed book. Direct proof that "small daily content, compiled
   over time" converts into real willingness to pay beyond a subscription.
4. **Serialized narrative arcs** — the long-term moat. A competitor can copy
   one day's LLM output; they cannot copy a 21-day authored arc with
   continuity and payoff without doing the same authoring work. This also
   gives the future creator marketplace an actual reason to exist.

Deliberately avoided: hard streak-shaming mechanics (guilt dynamics sit
awkwardly next to a wellness-positioned product) and any social-network
features (different, harder business; dilutes the intimate positioning).

## Go-to-market (v1, low-budget)

Skip paid ads initially — CAC in wellness/self-improvement is expensive and
punishes small budgets. Instead:

- Seed through BookTok/Bookstagram and journaling-community micro-creators
  (gifting/organic, not paid placement).
- Prioritize the **Shareable Cards** feature early — it is the organic-growth
  engine for this audience, not a nice-to-have.
- Lead marketing copy with **"personalized to your bookshelf,"** not "AI
  wellness companion" — the former is a hook that spreads by curiosity; the
  latter is invisible in an already-saturated category.
