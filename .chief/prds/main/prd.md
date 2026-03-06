# PRD: Attention Span Test

## Introduction

A static web app that presents users with a battery of scientifically-grounded cognitive tests measuring attention, impulse control, and focus duration. Results are compared against pre-social-media-era baselines from published research, presented as a fun "Brain Age"-style score, and expandable into detailed scientific breakdowns. The app targets teenagers (13-20) and their parents, is mobile-first (iPhone/iPad), and generates shareable links by encoding results in the URL.

The app is motivated by growing research showing that short-form video platforms (TikTok, Instagram Reels) are associated with measurable declines in sustained attention, executive control, and focus duration in young people.

## Goals

- Provide 5-6 interactive cognitive tests adapted from validated scientific instruments (SART, Stroop, PVT, Focus Duration, Delay Discounting, Go/No-Go)
- Compare user results against published pre-digital-era baselines with specific citations
- Present results as an engaging "Brain Age" style score that teens will want to share
- Generate shareable URLs that encode full test results in a compact URL parameter (no backend needed)
- Persist test progress in sessionStorage so browser refresh doesn't lose progress
- Deploy as a static site to Vercel with no backend or database
- Be fully usable on iPhone/iPad (mobile-first responsive design)

## User Stories

### US-001: App Shell and Navigation
**Priority:** 1
**Description:** As a user, I want a mobile-first app shell with smooth navigation between screens so that the experience feels native on my phone.

**Acceptance Criteria:**
- [ ] Landing page with app title, brief tagline, and "Start Test" CTA button
- [ ] Navigation flow: Landing -> Test sequence -> Results
- [ ] Mobile-first responsive layout that works on iPhone SE (375px) through iPad (1024px)
- [ ] Progress indicator showing which test you're on (e.g., "Test 2 of 6")
- [ ] Uses shadcn components for UI elements
- [ ] Built with Bun.serve() and HTML imports, React frontend
- [ ] Deploys to Vercel as a static site

### US-002: Sustained Attention to Response Task (SART)
**Priority:** 2
**Description:** As a user, I want to take a sustained attention test where I tap for every digit except one, so that my ability to maintain focus and inhibit impulses is measured.

**Acceptance Criteria:**
- [ ] Digits 1-9 appear one at a time in the center of the screen at a fixed interval (~1150ms per stimulus, matching the original Robertson et al. 1997 protocol)
- [ ] User must tap/click for every digit EXCEPT the target digit (3)
- [ ] 225 trials total (25 cycles of digits 1-9 in random order), taking ~4-5 minutes
- [ ] Records: commission errors (tapping on 3), omission errors (missing a non-3 digit), mean reaction time (ms), reaction time variability (coefficient of variation = SD/mean)
- [ ] Brief instruction screen before the test explaining what to do, with a practice round of 9 trials
- [ ] Baseline comparison: healthy adult commission error rate of 8-11%, mean RT of 332-375ms
- [ ] Results stored in sessionStorage upon completion

### US-003: Focus Duration Test
**Priority:** 2
**Description:** As a user, I want to test how long I can sustain focus on a single piece of content before feeling the urge to skip, so I can see how my focus compares to pre-digital norms.

**Acceptance Criteria:**
- [ ] Presents a mildly engaging but not thrilling stimulus (e.g., a passage of text that slowly reveals, a slowly changing visual pattern, or a calm narrated story)
- [ ] User presses a "I want to skip" button whenever they feel the urge to move on
- [ ] Timer runs visibly only after test completes (not during, to avoid anchoring)
- [ ] Records: time until first skip urge, and whether they chose to continue or stop
- [ ] Baseline comparison: Gloria Mark's research - 2.5 minutes (2004) vs. 40 seconds (2020s median)
- [ ] Results stored in sessionStorage upon completion

### US-004: Stroop Color-Word Test
**Priority:** 2
**Description:** As a user, I want to take a Stroop test that measures my ability to suppress automatic responses, so that my executive control is assessed.

**Acceptance Criteria:**
- [ ] Three conditions presented in sequence: (1) read color words in black ink, (2) name ink colors of colored rectangles, (3) name the ink color of incongruent color words (e.g., "RED" displayed in blue)
- [ ] Each condition: 20 stimuli, user selects from 4 color buttons (Red, Blue, Green, Yellow)
- [ ] Records: accuracy and mean RT per condition, interference score (condition 3 RT minus condition 2 RT)
- [ ] Brief instructions with 3 practice trials before the incongruent condition
- [ ] Baseline comparison: interference effect norms stratified by age group
- [ ] Results stored in sessionStorage upon completion

### US-005: Psychomotor Vigilance Task (PVT)
**Priority:** 2
**Description:** As a user, I want to test my reaction time vigilance by responding to stimuli appearing at unpredictable intervals, measuring lapses in my attention.

**Acceptance Criteria:**
- [ ] A stimulus (e.g., a red circle or counter) appears at random intervals between 2-10 seconds
- [ ] User taps as fast as possible when the stimulus appears
- [ ] 30 trials, taking approximately 2-3 minutes
- [ ] Records: median RT, number of lapses (RT > 500ms), number of false starts (tapping before stimulus)
- [ ] Baseline comparison: healthy adult median RT of ~250ms, lapse rate < 5%
- [ ] Results stored in sessionStorage upon completion

### US-006: Delay Discounting Task
**Priority:** 3
**Description:** As a user, I want to make choices between smaller immediate rewards and larger delayed rewards, so that my impulse control and preference for instant gratification is measured.

**Acceptance Criteria:**
- [ ] Series of 20-27 binary choices: e.g., "$50 now" vs "$100 in 30 days"
- [ ] Amounts and delays adjust based on previous choices (staircase procedure) to find the indifference point
- [ ] Choices presented as large tappable cards, mobile-friendly
- [ ] Records: discount rate (k parameter from hyperbolic model), indifference points at multiple delays
- [ ] Baseline comparison: normative k values for adolescents from published literature
- [ ] Results stored in sessionStorage upon completion

### US-007: Go/No-Go Task
**Priority:** 3
**Description:** As a user, I want to take a simple Go/No-Go test measuring my ability to withhold automatic responses, providing a quick measure of impulsivity.

**Acceptance Criteria:**
- [ ] "Go" stimuli (e.g., green circles) appear frequently (80% of trials); "No-Go" stimuli (e.g., red circles) appear infrequently (20%)
- [ ] 100 trials total, stimulus duration ~500ms, ISI ~1000ms, taking ~2.5 minutes
- [ ] User taps for Go stimuli, withholds for No-Go stimuli
- [ ] Records: commission error rate (tapping on No-Go), omission error rate, mean RT, RT coefficient of variation
- [ ] Baseline comparison: healthy adolescent commission error rate norms (decreases with age through ~16)
- [ ] Results stored in sessionStorage upon completion

### US-008: Brain Age Results Score
**Priority:** 4
**Description:** As a user, I want to see my overall results as an engaging "Brain Age" style score so I can quickly understand how my attention compares to pre-digital norms.

**Acceptance Criteria:**
- [ ] Composite score calculated from all completed tests, weighted by how far each metric deviates from baseline
- [ ] Presented as a "Your Digital Attention Profile" with a primary label, e.g., "Your attention profile matches a typical 2024 heavy-social-media user" or "Your attention is in the pre-digital healthy range"
- [ ] Visual score indicator (e.g., a gauge, spectrum bar, or animated number)
- [ ] Color-coded: green (healthy baseline range), yellow (moderate deviation), red (significant deviation)
- [ ] Brief 1-2 sentence summary of what the score means
- [ ] "See detailed results" expandable section (see US-009)
- [ ] Playful, non-clinical tone in the summary

### US-009: Detailed Scientific Results
**Priority:** 4
**Description:** As a user, I want to expand my results to see detailed per-test breakdowns with scientific context, so I can understand exactly what was measured and how I compare.

**Acceptance Criteria:**
- [ ] Each test has an expandable/collapsible section
- [ ] Per-test section shows: user's score, baseline norm, percentile or deviation indicator, and a chart/visual comparison
- [ ] Each section has a "Learn more" expandable that explains: what the test measures, why it matters, which study the baseline comes from (with citation)
- [ ] Citations link to actual papers (DOIs or URLs)
- [ ] All data comes from the sessionStorage results, no network calls needed

### US-010: Shareable Results Link
**Priority:** 5
**Description:** As a user, I want to get a shareable link that encodes my results so I can send it to my parents or friends and they can see my scores without taking the test themselves.

**Acceptance Criteria:**
- [ ] "Share Results" button on the results page
- [ ] All test results encoded into a compact string (e.g., base64-encoded JSON or a custom compact format) appended as a URL parameter or hash fragment
- [ ] When someone opens the shared URL, the app detects the encoded results and renders the results page directly (skipping tests)
- [ ] Shared results page shows a banner: "These are [name/anonymous]'s results" with a CTA "Take the test yourself"
- [ ] Copy-to-clipboard functionality with visual confirmation
- [ ] URL stays reasonably short (under ~2000 characters to be safe across browsers and messaging apps)
- [ ] Works when shared via iMessage, WhatsApp, Instagram DM

### US-011: Session Progress Persistence
**Priority:** 3
**Description:** As a user, I want my test progress saved so that if I accidentally close my browser or refresh, I don't lose completed tests.

**Acceptance Criteria:**
- [ ] After each test completes, results are saved to sessionStorage
- [ ] On app load, check sessionStorage for existing progress
- [ ] If progress exists, show option to "Continue where you left off" or "Start over"
- [ ] Starting over clears sessionStorage
- [ ] Progress includes: which tests are completed, raw results for each completed test

### US-012: Pre-test Self-Report Questionnaire
**Priority:** 5
**Description:** As a user, I want to answer a brief questionnaire about my social media usage before the tests, so my results can be contextualized.

**Acceptance Criteria:**
- [ ] 4-6 quick questions: estimated daily TikTok/Reels/Shorts usage, age, how often they feel restless watching long videos, self-rated attention (1-5 scale)
- [ ] Questions presented as large tappable options, mobile-friendly
- [ ] Responses stored in sessionStorage and included in shareable link
- [ ] Results page references self-reported usage when presenting findings (e.g., "You report 3+ hours daily on TikTok. Your sustained attention score is...")

## Functional Requirements

- FR-1: The app must be a fully static single-page application (React + TypeScript) with no backend, API calls, or database
- FR-2: The app must use Bun for building and development, with HTML imports and Bun.serve()
- FR-3: The app must deploy to Vercel as a static site
- FR-4: The app must use shadcn components for UI elements
- FR-5: All test timing must use `performance.now()` for millisecond-accurate reaction time measurement
- FR-6: The app must be mobile-first, fully functional on iPhone SE (375px width) and up, with touch-friendly tap targets (minimum 44x44px per Apple HIG)
- FR-7: Each test must show clear instructions and a practice round before the real test begins
- FR-8: Test progress must be persisted in sessionStorage, surviving page refreshes within the same browser tab
- FR-9: The results page must compute a composite "Digital Attention Profile" score from all test results
- FR-10: The results page must allow expanding each test to see detailed scientific comparison against published baselines
- FR-11: The app must generate a shareable URL encoding all results in a URL-safe compact format (base64 or similar), kept under 2000 characters total
- FR-12: When opened with a results parameter in the URL, the app must decode and display those results directly
- FR-13: The app must not collect, transmit, or store any user data beyond the browser's sessionStorage
- FR-14: Scientific baselines must be sourced from published peer-reviewed research and cited with paper title, authors, and year

## Non-Goals

- No user accounts, authentication, or server-side persistence
- No backend API or database
- No collection or transmission of user data to any server
- No real clinical diagnosis -- the app is educational and for self-awareness only
- No adaptive difficulty or personalized test parameters (use standard protocols)
- No integration with social media APIs or screen time data
- No monetization, ads, or premium features in the initial version
- No support for browsers below iOS Safari 15 / Chrome 90
- No accessibility beyond basic mobile usability (screen reader support is a future goal, not initial scope)
- No internationalization / localization (English only for now)

## Design Considerations

- **Mobile-first**: Design for 375px width (iPhone SE) as the primary viewport, scale up to iPad and desktop
- **Tone**: Playful and engaging during tests (gamified feel), transitioning to informative and science-backed on results. Never preachy or condescending -- teens will bounce if it feels like a lecture
- **Typography**: Large, readable fonts for test stimuli. Minimum 16px body text for mobile
- **Colors**: Use a modern, clean palette. Test stimuli need high contrast. Results use green/yellow/red spectrum
- **Animations**: Smooth transitions between screens. Subtle animations on results reveal. Nothing flashy during tests (avoid distracting from measurement)
- **The irony**: The app should subtly acknowledge that it's being shared on the very platforms it's testing against, without being heavy-handed about it
- **shadcn components**: Use Button, Card, Progress, Collapsible, Dialog, Tabs, and Badge components from shadcn where appropriate

## Technical Considerations

- **Timing precision**: Browser-based timing with `performance.now()` is accurate to ~5ms, which is sufficient for these tests (effects measured are in the 50-200ms range). Use `requestAnimationFrame` for stimulus presentation timing
- **Touch latency**: Mobile touch events add ~50-100ms latency. This is consistent across users so it doesn't affect relative comparisons, but absolute RT baselines should be adjusted upward by ~70ms for mobile or noted in results
- **URL encoding**: Use a compact encoding scheme for shareable links. Consider: abbreviate test names to 2-char codes, round metrics to reduce digits, use base64url encoding. Target: all 6 tests' results in under 500 characters of URL parameter
- **sessionStorage vs localStorage**: sessionStorage is intentional -- results are ephemeral per-session. The shareable link is the persistence mechanism
- **Vercel deployment**: Static export, no server-side rendering needed. Configure as SPA with fallback to index.html for client-side routing
- **Bundle size**: Keep the app lightweight for fast mobile loading. Target < 200KB gzipped
- **No external API calls**: All baselines and normative data are bundled in the app code as constants

## Success Metrics

- Users complete the full test battery (all 6 tests) in under 20 minutes
- The shareable link is under 2000 characters and renders correctly when opened
- App loads in under 2 seconds on a 4G mobile connection
- Test instructions are clear enough that users make fewer than 10% errors in practice rounds
- Results page clearly communicates deviation from baseline without requiring scientific literacy
- The app is fully functional on iOS Safari (iPhone and iPad)

## Open Questions

- Should we add a brief disclaimer that this is not a clinical diagnostic tool? (Likely yes, for liability)
- What specific text passage or visual stimulus should the Focus Duration test use? It needs to be engaging enough that stopping isn't simply boredom with bad content, but not so engaging that it doesn't test attention
- Should the composite "Brain Age" score weight all tests equally, or weight sustained attention (SART) more heavily since that's the primary concern?
- Should we adjust baseline RT norms for mobile touch input latency, or present raw comparisons with a note about the platform difference?
- Should the pre-test questionnaire be optional or required?
- Do we need parental consent / age gate UI for users under 13, or is that unnecessary since we collect no data?

## References

1. Robertson et al. (1997) - Original SART development. Baseline commission error rate: 8-11%
2. Gloria Mark, UC Irvine - Focus duration: 2.5 min (2004) to 40 sec (2020s). Book: *Attention Span* (2023)
3. Frontiers in Human Neuroscience (2024) - "Mobile phone short video use negatively impacts attention functions: an EEG study." DOI: 10.3389/fnhum.2024.1383913. Frontal theta correlation r = -0.395
4. Cherng et al., CHI 2024 - "Understanding the Effects of Short-Form Videos on Sustained Attention." SART commission errors higher in heavy users
5. Fan, McCandliss, Sommer, Raz, & Posner (2002) - ANT development. Executive network cost: 84-109ms
6. Conners CPT-3 - Normative data for commission/omission errors across age groups
7. Hsieh et al. (2005) - "Norms of performance of sustained attention among a community sample." Psychiatry and Clinical Neurosciences
8. Rubinstein, Meyer, & Evans (2001) - Task-switching costs: 100-200ms per switch
