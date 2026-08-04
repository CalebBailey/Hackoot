# Hackoot Technical Design - Team Building Quiz

## 1. Document Control

| Field | Value |
| --- | --- |
| Feature | Team Building Quiz |
| Application | Hackoot |
| Document type | Technical design and implementation request |
| Status | Updated draft |
| Last updated | 03 August 2026 |
| Owner | Product and Engineering |

## 2. Purpose

This document updates the original feature request into an implementation-ready plan for the current Hackoot codebase.

The key objective is to add a non-competitive Team Building mode while preserving the existing Standard (Kahoot-style MCQ with timed scoring) mode.

## 3. Current Hackoot Baseline (What Exists Today)

The current application is a client-heavy Next.js app with:

- Hash-based routing inside `components/hackoot/HackootApp.tsx`.
- Quiz definitions persisted in localStorage via `utils/quizStorage.ts`.
- In-session runtime state in Zustand via `store/sessionStore.ts`.
- Pusher Channels for host-player transport via `transport/peer.ts`.
- Event validation at API routes `app/api/pusher/auth/route.ts` and `app/api/pusher/trigger/route.ts`.
- Existing question model limited to `type: "mcq"` in `types/index.ts`.
- Existing host and player gameplay screens built around timed MCQ, scoring, reveal, and leaderboard.

Important constraint for this feature:

- There is no persistent server-side quiz/session database in current architecture.
- Team Building data persistence for reuse must therefore be staged:
  - MVP: local session artefacts and export.
  - Later phase: server-side persistence and retrieval.

## 4. Refined Feature Request (Grounded in Current App)

### 4.1 New quiz type

Add `team-building` as a quiz type beside `standard`.

### 4.2 Question capabilities

- This or that (A or B): two-option structured choice question.
- Select and type in question: Select between multiple options or introduce a custom answer.
- Type in answer: free-text question with configurable max answers per player.
- Discussion question: free-text submission phase followed by voting phase.

### 4.3 Session behaviour

- No points, no correctness reveal, no winners podium for Team Building quizzes.
- Host-led flow focused on participation, grouping, and discussion prompts.
- Avatar movement/group visualisation in a lightweight "party quiz" feel.

### 4.4 Data and insight outputs

- Deterministic grouping of similar answers.
- Optional AI-assisted fuzzy grouping.
- Word cloud output from moderated and normalised terms.
- Discussion queue ordered by vote share.
- Optional interest-match graph and breakout suggestions in later phases.

### 4.5 Safety and handling for sensitive prompts

For negative experience questions:

- Host controls for hide/skip.
- Do not use sensitive responses for matching by default.
- Moderation pass before public display where configured.

## 5. Functional Requirements and Defaults

### 5.1 Team Building defaults

- Scoring: disabled.
- Podium/final leaderboard winner framing: disabled.
- Discussion voting: enabled.
- Word cloud: enabled.
- Max answers per player: default 3.
- Max votes per player: default 3.

### 5.2 Proposed defaults for open questions

To unblock implementation now:

1. Own-answer voting: allowed by default.
2. Discussion answers: anonymous to players, visible to host only.
3. Host review before display: off by default for MVP, but configurable.
4. Sensitive/negative question reuse: excluded by default.

## 6. Target Data Model Changes (TypeScript, Not C#)

Current types are MCQ-only. Extend `types/index.ts` with discriminated unions.

```ts
export type QuizType = "standard" | "team-building";

export interface Quiz {
  quizId: string;
  title: string;
  description?: string;
  createdBy?: string;
  createdAt: string;
  version: number;
  quizType?: QuizType; // default to "standard" for backwards compatibility
  teamBuildingSettings?: TeamBuildingQuizSettings;
  questions: Question[];
}

export interface TeamBuildingQuizSettings {
  enableWordCloud: boolean;
  enableFuzzyGrouping: boolean;
  enableDiscussionVoting: boolean;
  saveOutputsForReuse: boolean;
  maxAnswersPerPlayer: number;
  maxVotesPerPlayer: number;
  allowOwnAnswerVoting: boolean;
  anonymousDiscussionVotes: boolean;
}

export type Question =
  | StandardMcqQuestion
  | TeamThisOrThatQuestion
  | TeamFreeTextQuestion
  | TeamDiscussionQuestion;

export interface StandardMcqQuestion {
  id: string;
  type: "mcq";
  text: string;
  imageUrl?: string;
  choices: Choice[];
  correctChoiceIds: string[];
  doublePoints?: boolean;
}

export interface TeamThisOrThatQuestion {
  id: string;
  type: "this-or-that";
  text: string;
  imageUrl?: string;
  options: [Choice, Choice];
}

export interface TeamFreeTextQuestion {
  id: string;
  type: "free-text";
  text: string;
  imageUrl?: string;
  maxAnswersPerPlayer?: number;
}

export interface TeamDiscussionQuestion {
  id: string;
  type: "discussion";
  text: string;
  imageUrl?: string;
  maxAnswersPerPlayer?: number;
  maxVotesPerPlayer?: number;
}
```

Backwards compatibility rule:

- Existing saved quizzes without `quizType` are treated as `standard`.

## 7. Runtime State Changes

Extend `store/sessionStore.ts` to support Team Building phases without breaking Standard flow.

### 7.1 Session state expansion

Current:

- `lobby | question | reveal | leaderboard | ended`

Proposed:

- `lobby`
- `question`
- `team-submission`
- `team-voting`
- `team-results`
- `team-discussion`
- `reveal`
- `leaderboard`
- `ended`

### 7.2 New runtime entities

Add state slices for:

- free-text submissions per question
- grouped clusters
- word cloud terms
- discussion candidates
- votes and vote share
- discussion queue state (open, skipped, discussed)

## 8. Real-Time Contract Changes (Pusher)

Current `player-answer` expects a single `choiceId`. Team Building requires variant payloads.

### 8.1 Extend message contract

Update `PeerMessage` in `types/index.ts` and host/player handlers in `transport/peer.ts`:

- `submitChoiceAnswer`
- `submitTextAnswers`
- `submitDiscussionVotes`
- `teamSubmissionClosed`
- `teamVotingOpened`
- `teamVotingClosed`
- `teamResultsPublished`
- `teamDiscussionItemOpened`

### 8.2 Update trigger allow-list

Update `ALLOWED_EVENTS` in `app/api/pusher/trigger/route.ts` so host and player channels allow new events.

Security requirement:

- Keep strict allow-list validation per channel type.

## 9. UI and Flow Changes Mapped to Existing Files

### 9.1 Quiz creation and editing

Files:

- `components/hackoot/pages/CreateQuizPage.tsx`
- `components/hackoot/pages/EditQuizPage.tsx`
- `components/hackoot/QuestionEditor.tsx`
- `components/hackoot/QuizCard.tsx`

Changes:

- Add quiz type selector (Standard or Team Building).
- Show question editor controls based on selected quiz type.
- Add Team Building question templates:
  - this-or-that editor (exactly 2 options)
  - free-text limits
  - Multiple choice and/or input question
  - discussion voting limits
- Show quiz type tag on cards.

### 9.2 Host runtime

Files:

- `components/hackoot/pages/HostLobbyPage.tsx`
- `components/hackoot/pages/HostQuestionPage.tsx`
- `components/hackoot/pages/HostResultsPage.tsx`
- new: `components/hackoot/pages/HostDiscussionPage.tsx`

Changes:

- Branch flow by `quiz.quizType`.
- Standard keeps current reveal/leaderboard flow.
- Team Building uses:
  - submission progress
  - optional live grouping preview
  - voting control for discussion questions
  - discussion queue screen ordered by vote share

### 9.3 Player runtime

Files:

- `components/hackoot/pages/PlayerQuestionPage.tsx`
- `components/hackoot/pages/PlayerResultPage.tsx`
- `components/hackoot/pages/PlayerLobbyPage.tsx`
- new: `components/hackoot/pages/PlayerVotingPage.tsx`

Changes:

- Render input controls by question type.
- For free-text and discussion submission, support multiple answers.
- Add voting screen for discussion phase.
- Replace competitive result framing in Team Building mode with neutral participation feedback.

### 9.4 Visualisation components

New components under `components/hackoot`:

- `WordCloud.tsx`
- `ClusterView.tsx`
- `DiscussionQueue.tsx`
- `InterestMatchGraph.tsx` (post-MVP)

## 10. Grouping and Matching Design

## 10.1 Deterministic normalisation (MVP)

Implement `utils/teamBuilding/normalise.ts`:

- trim and lower-case
- collapse whitespace
- strip leading/trailing punctuation
- synonym map lookup

Implement `utils/teamBuilding/grouping.ts`:

- exact key grouping
- synonym canonicalisation
- cluster frequency and player membership

Self-match prevention rule:

- derive player-to-player edges only from distinct player IDs per cluster.

## 10.2 AI-assisted fuzzy matching (phase 2)

Add optional API route:

- `app/api/team-building/match/route.ts`

Behaviour:

- deterministic grouping always runs first
- AI called for unresolved tails only
- confidence thresholds:
  - >= 0.85 auto-merge
  - 0.60-0.84 host review flag
  - < 0.60 keep separate

## 11. Word Cloud Design

MVP utility:

- `utils/teamBuilding/wordCloud.ts`

Pipeline:

1. normalise answers
2. tokenise
3. remove stop words
4. synonym merge
5. weight count
6. return top N terms

Output shape:

```ts
export interface WordCloudTerm {
  text: string;
  weight: number;
}
```

## 12. Data Collection and Reuse in Current Architecture

### 12.1 MVP (works with current app)

- Persist Team Building quiz definition in localStorage like existing quizzes.
- Persist session output snapshot in browser memory during session.
- Export outputs as JSON using existing export pattern in `utils/quizStorage.ts`.

### 12.2 Phase 3 (new persistence)

Introduce new JSON export and import option:

- response corpus
- grouped clusters
- vote summaries
- reusable insight records

## 13. Moderation and Privacy Guardrails

MVP guardrails:

- basic profanity filter utility before answers are broadcast in Team Building mode
- host hide/skip controls on discussion items
- optional anonymised display labels (Player A, Player B)

Data policy defaults:

- sensitive question outputs excluded from reuse
- no sensitive attribute inference in matching pipeline

## 14. Animation and Styling Requirements

For Quiplash-style movement while keeping performance and accessibility:

- avatar movement in clusters/options should be CSS transform based
- avoid physics libraries in MVP
- support reduced motion via `prefers-reduced-motion`
- cap rendered avatars per cluster and collapse extra as `+N`

## 15. Implementation Plan (Practical, Incremental)

### Phase 1 - Team Building MVP (no AI, no backend DB)

Deliver:

- `quizType` support with backward compatibility.
- this-or-that, free-text, multiple choice with free-text, discussion question models and editor UI.
- Team Building host/player flow with submission and discussion voting.
- deterministic grouping and word cloud generation.
- no scoring/podium for Team Building sessions.
- exportable Team Building session outputs.

Acceptance checks:

- Standard quiz behaviour unchanged.
- Team Building session can run end-to-end with 20+ players.
- discussion queue ordered correctly by vote count/share.

### Phase 2 - AI-Assisted Matching

Deliver:

- optional fuzzy matcher route and service abstraction.
- confidence tagging and low-confidence review signals.
- improved cluster labelling.

Acceptance checks:

- deterministic fallback works when AI unavailable.
- no self-match edges created.

### Phase 3 - Reuse and Breakout Suggestions

Deliver:

- reusable insight model persistence.
- interest match percentages.
- suggested breakout topics and participant lists.

Acceptance checks:

- host can inspect and export suggestions.
- sensitive data exclusions respected.

## 17. Delivery Risks and Mitigations

- Risk: extending message contracts breaks live sessions.
  - Mitigation: additive event types and strict compatibility guards.
- Risk: Team Building branches create UI complexity.
  - Mitigation: discriminated question components and mode-specific page modules.
- Risk: sensitive responses shown too early.
  - Mitigation: host-controlled publication and moderation checks before broadcast.

## 18. Updated Implementation Checklist

### Core model and state

- Extend `types/index.ts` with quiz type and Team Building question unions.
- Extend `store/sessionStore.ts` with Team Building runtime state.
- Keep Standard flow paths intact.

### Transport and API

- Extend `transport/peer.ts` with Team Building event handling.
- Update `app/api/pusher/trigger/route.ts` allow-list.
- Add optional Team Building matcher route for phase 2.

### UI

- Update create/edit quiz pages for mode and question type editing.
- Add Team Building player submission and voting screens.
- Add host discussion queue and grouped result views.
- Add word cloud and cluster visualisation components.

### Data and governance

- Add Team Building output export shape.
- Add privacy defaults and sensitive-question exclusion flags.
- Add moderation utility for player-visible text.

## 19. Summary

The Team Building feature is feasible within the current Hackoot architecture without a full backend rewrite by delivering an MVP that is client/runtime first: new quiz type, new question types, deterministic grouping, discussion voting, and no-podium flow.

AI-assisted matching, long-term insight reuse, and breakout suggestion automation should be layered in subsequent phases once the baseline interaction model is validated with real sessions.
