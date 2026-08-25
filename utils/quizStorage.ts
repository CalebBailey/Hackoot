import {
  AnswerRecord,
  Choice,
  DiscussionQueueItem,
  LeaderboardEntry,
  Participant,
  Question,
  Quiz,
  QuizType,
  TeamAnswerCluster,
  TeamBuildingQuizSettings,
} from "../types";
import {
  DEFAULT_TEAM_BUILDING_SETTINGS,
  resolveQuizType,
} from "./teamBuilding/defaults";
import {
  buildInterestMatchGraph,
  SharedSubject,
} from "./teamBuilding/interestMatching";

function toChoice(raw: unknown, fallbackIndex: number): Choice {
  const value = raw as Partial<Choice> | undefined;
  return {
    id: value?.id && typeof value.id === "string" ? value.id : `choice-${fallbackIndex + 1}`,
    text: value?.text && typeof value.text === "string" ? value.text : "",
  };
}

function normaliseQuestion(raw: unknown, index: number): Question {
  const value = (raw as Record<string, unknown>) ?? {};
  const type = value.type;
  const base = {
    id: typeof value.id === "string" ? value.id : `question-${index + 1}`,
    text: typeof value.text === "string" ? value.text : "",
    imageUrl: typeof value.imageUrl === "string" ? value.imageUrl : undefined,
    timeLimit: typeof value.timeLimit === "number" ? value.timeLimit : undefined,
  };

  if (type === "this-or-that") {
    const options = Array.isArray(value.options) ? value.options : [];
    return {
      ...base,
      type,
      options: [toChoice(options[0], 0), toChoice(options[1], 1)],
    };
  }

  if (type === "free-text") {
    return {
      ...base,
      type,
      maxAnswersPerPlayer:
        typeof value.maxAnswersPerPlayer === "number" ? value.maxAnswersPerPlayer : undefined,
    };
  }

  if (type === "select-or-text") {
    return {
      ...base,
      type,
      options: Array.isArray(value.options)
        ? value.options.map((choice, choiceIndex) => toChoice(choice, choiceIndex))
        : [],
      allowCustomAnswer:
        typeof value.allowCustomAnswer === "boolean" ? value.allowCustomAnswer : true,
      maxAnswersPerPlayer:
        typeof value.maxAnswersPerPlayer === "number" ? value.maxAnswersPerPlayer : undefined,
    };
  }

  if (type === "discussion") {
    return {
      ...base,
      type,
      maxAnswersPerPlayer:
        typeof value.maxAnswersPerPlayer === "number" ? value.maxAnswersPerPlayer : undefined,
      maxVotesPerPlayer:
        typeof value.maxVotesPerPlayer === "number" ? value.maxVotesPerPlayer : undefined,
    };
  }

  const choices = Array.isArray(value.choices) ? value.choices : [];
  const correctChoiceIds = Array.isArray(value.correctChoiceIds)
    ? value.correctChoiceIds.filter((choiceId): choiceId is string => typeof choiceId === "string")
    : [];

  return {
    ...base,
    type: "mcq",
    choices: choices.map((choice, choiceIndex) => toChoice(choice, choiceIndex)),
    correctChoiceIds,
    doublePoints: typeof value.doublePoints === "boolean" ? value.doublePoints : undefined,
  };
}

function normaliseTeamSettings(
  raw: unknown,
  quizType: QuizType
): TeamBuildingQuizSettings | undefined {
  if (quizType !== "team-building") {
    return undefined;
  }

  const value = (raw as Partial<TeamBuildingQuizSettings>) ?? {};

  return {
    ...DEFAULT_TEAM_BUILDING_SETTINGS,
    ...value,
  };
}

function normaliseQuiz(raw: unknown): Quiz {
  const value = (raw as Record<string, unknown>) ?? {};
  const quizType = resolveQuizType(value.quizType as QuizType | undefined);

  return {
    quizId: typeof value.quizId === "string" ? value.quizId : "",
    title: typeof value.title === "string" ? value.title : "Untitled Quiz",
    description: typeof value.description === "string" ? value.description : undefined,
    createdBy: typeof value.createdBy === "string" ? value.createdBy : undefined,
    createdAt:
      typeof value.createdAt === "string"
        ? value.createdAt
        : new Date().toISOString(),
    version: typeof value.version === "number" ? value.version : 1,
    quizType,
    teamBuildingSettings: normaliseTeamSettings(value.teamBuildingSettings, quizType),
    questions: Array.isArray(value.questions)
      ? value.questions.map((question, index) => normaliseQuestion(question, index))
      : [],
  };
}

const KEY = "hackoot:quizzes";

export interface SessionExportData {
  sessionId: string;
  roomCode: string;
  quizType: QuizType;
  quizTitle?: string;
  participants: Participant[];
  answers: AnswerRecord[];
  leaderboard: LeaderboardEntry[];
  teamClusters?: Record<string, TeamAnswerCluster[]>;
  teamDiscussionQueue?: Record<string, DiscussionQueueItem[]>;
  teamQuestionPrompts?: Record<string, string>;
  endedAt: string;
}

function toStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.filter((value): value is string => typeof value === "string");
}

function parseTeamClusters(
  raw: unknown
): Record<string, TeamAnswerCluster[]> | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const clustersByQuestion: Record<string, TeamAnswerCluster[]> = {};

  for (const [questionId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(value)) {
      continue;
    }

    clustersByQuestion[questionId] = value.map((entry, index) => {
      const cluster = (entry as Record<string, unknown>) ?? {};
      const answerIds = toStringArray(cluster.answerIds);
      const participantIds = toStringArray(cluster.participantIds);
      const canonicalText =
        typeof cluster.canonicalText === "string" ? cluster.canonicalText : "";

      return {
        id:
          typeof cluster.id === "string"
            ? cluster.id
            : `${questionId}-cluster-${index + 1}`,
        canonicalText,
        answerIds,
        participantIds,
        count:
          typeof cluster.count === "number" && Number.isFinite(cluster.count)
            ? cluster.count
            : Math.max(answerIds.length, participantIds.length),
      };
    });
  }

  return clustersByQuestion;
}

function parseDiscussionQueue(
  raw: unknown
): Record<string, DiscussionQueueItem[]> | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const queueByQuestion: Record<string, DiscussionQueueItem[]> = {};

  for (const [questionId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(value)) {
      continue;
    }

    queueByQuestion[questionId] = value.map((entry, index) => {
      const item = (entry as Record<string, unknown>) ?? {};
      const participantIds = toStringArray(item.participantIds);
      const voterParticipantIds = toStringArray(item.voterParticipantIds);

      return {
        id:
          typeof item.id === "string"
            ? item.id
            : `${questionId}-discussion-${index + 1}`,
        text: typeof item.text === "string" ? item.text : "",
        participantIds,
        voterParticipantIds,
        voteCount:
          typeof item.voteCount === "number" && Number.isFinite(item.voteCount)
            ? item.voteCount
            : voterParticipantIds.length,
        voteShare:
          typeof item.voteShare === "number" && Number.isFinite(item.voteShare)
            ? item.voteShare
            : 0,
        hidden: item.hidden === true,
        skipped: item.skipped === true,
        discussed: item.discussed === true,
      };
    });
  }

  return queueByQuestion;
}

function parseQuestionPrompts(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const prompts: Record<string, string> = {};

  for (const [questionId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string") {
      prompts[questionId] = value;
    }
  }

  return prompts;
}

export function normaliseSessionExportData(raw: unknown): SessionExportData | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const value = raw as Record<string, unknown>;

  const participants: Participant[] = Array.isArray(value.participants)
    ? value.participants.map((entry, index) => {
        const participant = (entry as Record<string, unknown>) ?? {};
        return {
          participantId:
            typeof participant.participantId === "string"
              ? participant.participantId
              : `participant-${index + 1}`,
          name:
            typeof participant.name === "string" && participant.name.trim().length > 0
              ? participant.name
              : `Participant ${index + 1}`,
          score:
            typeof participant.score === "number" && Number.isFinite(participant.score)
              ? participant.score
              : 0,
          answeredCurrentQuestion: participant.answeredCurrentQuestion === true,
          disconnected:
            typeof participant.disconnected === "boolean"
              ? participant.disconnected
              : undefined,
        };
      })
    : [];

  const answers: AnswerRecord[] = Array.isArray(value.answers)
    ? value.answers
        .map((entry) => {
          const answer = (entry as Record<string, unknown>) ?? {};
          return {
            participantId:
              typeof answer.participantId === "string" ? answer.participantId : "",
            questionId: typeof answer.questionId === "string" ? answer.questionId : "",
            submittedAt:
              typeof answer.submittedAt === "number" && Number.isFinite(answer.submittedAt)
                ? answer.submittedAt
                : Date.now(),
            choiceId: typeof answer.choiceId === "string" ? answer.choiceId : undefined,
            textAnswers: toStringArray(answer.textAnswers),
            voteAnswerIds: toStringArray(answer.voteAnswerIds),
            correct: typeof answer.correct === "boolean" ? answer.correct : undefined,
            pointsAwarded:
              typeof answer.pointsAwarded === "number" && Number.isFinite(answer.pointsAwarded)
                ? answer.pointsAwarded
                : undefined,
          };
        })
        .filter((answer) => answer.participantId.length > 0 && answer.questionId.length > 0)
    : [];

  const leaderboardFromInput: LeaderboardEntry[] = Array.isArray(value.leaderboard)
    ? value.leaderboard
        .map((entry) => {
          const leaderboardEntry = (entry as Record<string, unknown>) ?? {};
          const participantId =
            typeof leaderboardEntry.participantId === "string"
              ? leaderboardEntry.participantId
              : "";
          if (!participantId) {
            return null;
          }

          const participantName =
            typeof leaderboardEntry.name === "string"
              ? leaderboardEntry.name
              : participants.find(
                  (participant) => participant.participantId === participantId
                )?.name ?? "Participant";

          return {
            participantId,
            name: participantName,
            score:
              typeof leaderboardEntry.score === "number" && Number.isFinite(leaderboardEntry.score)
                ? leaderboardEntry.score
                : 0,
            rank:
              typeof leaderboardEntry.rank === "number" && Number.isFinite(leaderboardEntry.rank)
                ? leaderboardEntry.rank
                : 0,
          };
        })
        .filter((entry): entry is LeaderboardEntry => entry !== null)
    : [];

  const fallbackLeaderboard = [...participants]
    .sort((left, right) => right.score - left.score)
    .map((participant, index) => ({
      participantId: participant.participantId,
      name: participant.name,
      score: participant.score,
      rank: index + 1,
    }));

  const leaderboard = leaderboardFromInput.length > 0
    ? leaderboardFromInput
        .sort((left, right) => {
          if (left.rank > 0 && right.rank > 0) {
            return left.rank - right.rank;
          }
          return right.score - left.score;
        })
        .map((entry, index) => ({
          ...entry,
          rank: index + 1,
        }))
    : fallbackLeaderboard;

  return {
    sessionId:
      typeof value.sessionId === "string" ? value.sessionId : "imported-session",
    roomCode: typeof value.roomCode === "string" ? value.roomCode : "imported",
    quizType: resolveQuizType(value.quizType as QuizType | undefined),
    quizTitle: typeof value.quizTitle === "string" ? value.quizTitle : undefined,
    participants,
    answers,
    leaderboard,
    teamClusters: parseTeamClusters(value.teamClusters),
    teamDiscussionQueue: parseDiscussionQueue(value.teamDiscussionQueue),
    teamQuestionPrompts: parseQuestionPrompts(value.teamQuestionPrompts),
    endedAt:
      typeof value.endedAt === "string" ? value.endedAt : new Date().toISOString(),
  };
}

interface ParticipantExportSummary {
  participantId: string;
  name: string;
  rank: number | null;
  score: number;
  submissions: number;
  answeredQuestions: number;
  correctAnswers: number;
  accuracyPercent: number;
  votesCast: number;
  contributedClusters: number;
  matchedWith: number;
}

function toSafeFileNameSegment(value: string): string {
  const segment = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return segment || "hackoot";
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), {
    href: url,
    download: filename,
  });
  link.click();
  URL.revokeObjectURL(url);
}

function buildParticipantSummaries(sessionData: SessionExportData): ParticipantExportSummary[] {
  const participantsById = new Map(
    sessionData.participants.map((participant) => [participant.participantId, participant])
  );
  const leaderboardById = new Map(
    sessionData.leaderboard.map((entry) => [entry.participantId, entry])
  );
  const answersByParticipant = new Map<string, AnswerRecord[]>();
  const contributedClustersByParticipant = new Map<string, Set<string>>();
  const matchedWithByParticipant = new Map<string, Set<string>>();

  for (const answer of sessionData.answers) {
    const currentAnswers = answersByParticipant.get(answer.participantId) ?? [];
    currentAnswers.push(answer);
    answersByParticipant.set(answer.participantId, currentAnswers);
  }

  for (const [questionId, clusters] of Object.entries(sessionData.teamClusters ?? {})) {
    clusters.forEach((cluster) => {
      const uniqueParticipants = Array.from(new Set(cluster.participantIds));
      uniqueParticipants.forEach((participantId) => {
        const clusterSet = contributedClustersByParticipant.get(participantId) ?? new Set<string>();
        clusterSet.add(`${questionId}:${cluster.id}`);
        contributedClustersByParticipant.set(participantId, clusterSet);

        const matchSet = matchedWithByParticipant.get(participantId) ?? new Set<string>();
        uniqueParticipants.forEach((otherParticipantId) => {
          if (otherParticipantId !== participantId) {
            matchSet.add(otherParticipantId);
          }
        });
        matchedWithByParticipant.set(participantId, matchSet);
      });
    });
  }

  const rankedParticipantIds = sessionData.leaderboard.map((entry) => entry.participantId);
  const unrankedParticipantIds = sessionData.participants
    .map((participant) => participant.participantId)
    .filter((participantId) => !rankedParticipantIds.includes(participantId))
    .sort((left, right) => {
      const leftName = participantsById.get(left)?.name ?? "";
      const rightName = participantsById.get(right)?.name ?? "";
      return leftName.localeCompare(rightName);
    });

  const orderedParticipantIds = [...rankedParticipantIds, ...unrankedParticipantIds];

  return orderedParticipantIds.map((participantId) => {
    const participant = participantsById.get(participantId);
    const leaderboardEntry = leaderboardById.get(participantId);
    const participantAnswers = answersByParticipant.get(participantId) ?? [];

    const answeredQuestionIds = new Set<string>();
    let submissions = 0;
    let correctAnswers = 0;
    let votesCast = 0;

    for (const answer of participantAnswers) {
      const textAnswerCount = answer.textAnswers?.length ?? 0;
      const voteCount = answer.voteAnswerIds?.length ?? 0;
      const hasSubmission = Boolean(answer.choiceId) || textAnswerCount > 0;

      if (hasSubmission) {
        answeredQuestionIds.add(answer.questionId);
      }

      submissions += (answer.choiceId ? 1 : 0) + textAnswerCount;
      votesCast += voteCount;

      if (answer.correct === true) {
        correctAnswers += 1;
      }
    }

    const answeredQuestions = answeredQuestionIds.size;
    const accuracyPercent = answeredQuestions > 0
      ? (correctAnswers / answeredQuestions) * 100
      : 0;

    return {
      participantId,
      name: participant?.name ?? leaderboardEntry?.name ?? "Unknown",
      rank: leaderboardEntry?.rank ?? null,
      score: leaderboardEntry?.score ?? participant?.score ?? 0,
      submissions,
      answeredQuestions,
      correctAnswers,
      accuracyPercent,
      votesCast,
      contributedClusters: contributedClustersByParticipant.get(participantId)?.size ?? 0,
      matchedWith: matchedWithByParticipant.get(participantId)?.size ?? 0,
    };
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function truncateLabel(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}...`;
}

function buildSessionReportHtml(sessionData: SessionExportData, quizTitle: string): string {
  const participantSummaries = buildParticipantSummaries(sessionData);
  const generatedAt = new Date().toLocaleString();
  const interestMatchGraph = sessionData.quizType === "team-building"
    ? buildInterestMatchGraph(
        sessionData.participants,
        sessionData.teamClusters,
        sessionData.teamQuestionPrompts
      )
    : null;

  const totalResponses = participantSummaries.reduce(
    (sum, participant) => sum + participant.submissions,
    0
  );
  const totalVotes = participantSummaries.reduce(
    (sum, participant) => sum + participant.votesCast,
    0
  );
  const topScore = participantSummaries.reduce(
    (maxScore, participant) => Math.max(maxScore, participant.score),
    0
  );

  const participantTableHeader = sessionData.quizType === "team-building"
    ? `
      <th>Participant</th>
      <th>Responses</th>
      <th>Votes</th>
      <th>Contributed clusters</th>
      <th>Matched with</th>
    `
    : `
      <th>Rank</th>
      <th>Participant</th>
      <th>Score</th>
      <th>Answered</th>
      <th>Correct</th>
      <th>Accuracy</th>
    `;
  const participantColumnCount = sessionData.quizType === "team-building" ? 5 : 6;

  const participantRows = participantSummaries
    .map((participant) => {
      if (sessionData.quizType === "team-building") {
        return `
          <tr>
            <td>${escapeHtml(participant.name)}</td>
            <td>${participant.submissions}</td>
            <td>${participant.votesCast}</td>
            <td>${participant.contributedClusters}</td>
            <td>${participant.matchedWith}</td>
          </tr>
        `;
      }

      return `
        <tr>
          <td>${participant.rank ?? "-"}</td>
          <td>${escapeHtml(participant.name)}</td>
          <td>${participant.score.toLocaleString()}</td>
          <td>${participant.answeredQuestions}</td>
          <td>${participant.correctAnswers}</td>
          <td>${participant.accuracyPercent.toFixed(1)}%</td>
        </tr>
      `;
    })
    .join("\n");

  const groupedResponses = Object.entries(sessionData.teamClusters ?? {})
    .flatMap(([questionId, clusters]) => {
      const prompt = sessionData.teamQuestionPrompts?.[questionId] ?? questionId;
      return clusters.map((cluster) => ({
        prompt,
        text: cluster.canonicalText,
        count: cluster.count,
        participants: cluster.participantIds.length,
      }));
    })
    .sort((left, right) => right.count - left.count)
    .slice(0, 8);

  const discussionHighlights = Object.entries(sessionData.teamDiscussionQueue ?? {})
    .flatMap(([questionId, queue]) => {
      const prompt = sessionData.teamQuestionPrompts?.[questionId] ?? questionId;
      return queue.map((item) => ({
        prompt,
        text: item.text,
        voteCount: item.voteCount,
      }));
    })
    .sort((left, right) => right.voteCount - left.voteCount)
    .slice(0, 8);

  const groupedResponsesList = groupedResponses.length
    ? groupedResponses
      .map(
        (cluster) =>
          `<li><strong>${escapeHtml(cluster.text)}</strong> - ${cluster.count} responses across ${cluster.participants} participants<br/><span class="muted">${escapeHtml(cluster.prompt)}</span></li>`
      )
      .join("\n")
    : "<li>No grouped responses available for this session.</li>";

  const discussionList = discussionHighlights.length
    ? discussionHighlights
      .map(
        (item) =>
          `<li><strong>${escapeHtml(item.text)}</strong> - ${item.voteCount} votes<br/><span class="muted">${escapeHtml(item.prompt)}</span></li>`
      )
      .join("\n")
    : "<li>No discussion voting data available for this session.</li>";

  const participantNameById = new Map(
    (interestMatchGraph?.participants ?? []).map((participant) => [participant.participantId, participant.name])
  );

  const uniqueMatchEdges = (interestMatchGraph?.participants ?? [])
    .flatMap((participant) =>
      participant.matches
        .filter((match) => participant.participantId < match.participantId)
        .map((match) => ({
          leftParticipantId: participant.participantId,
          rightParticipantId: match.participantId,
          score: match.score,
        }))
    )
    .sort((left, right) => right.score - left.score);

  const matchGraphSvg = (() => {
    if (!interestMatchGraph || interestMatchGraph.participants.length < 2) {
      return '<p class="muted">Not enough participants to draw a match graph.</p>';
    }

    if (uniqueMatchEdges.length === 0) {
      return '<p class="muted">No overlapping answers captured yet, so no match links are available.</p>';
    }

    const width = 700;
    const height = 420;
    const centreX = width / 2;
    const centreY = height / 2;
    const radius = Math.min(width, height) * 0.34;
    const maxScore = Math.max(1, interestMatchGraph.maxScore);

    const positions = interestMatchGraph.participants.map((participant, index) => {
      const angle = (-Math.PI / 2) + (2 * Math.PI * index) / interestMatchGraph.participants.length;
      return {
        participant,
        x: centreX + Math.cos(angle) * radius,
        y: centreY + Math.sin(angle) * radius,
      };
    });

    const positionById = new Map(
      positions.map((position) => [position.participant.participantId, position])
    );

    const edgesSvg = uniqueMatchEdges
      .map((edge) => {
        const left = positionById.get(edge.leftParticipantId);
        const right = positionById.get(edge.rightParticipantId);
        if (!left || !right) {
          return "";
        }

        const strokeWidth = (1.2 + (edge.score / maxScore) * 4).toFixed(2);
        return `
          <line
            x1="${left.x.toFixed(1)}"
            y1="${left.y.toFixed(1)}"
            x2="${right.x.toFixed(1)}"
            y2="${right.y.toFixed(1)}"
            stroke="#f97316"
            stroke-opacity="0.55"
            stroke-width="${strokeWidth}"
            stroke-linecap="round"
          />
        `;
      })
      .join("\n");

    const nodesSvg = positions
      .map((position) => {
        const matchCount = position.participant.matches.length;
        return `
          <g>
            <circle
              cx="${position.x.toFixed(1)}"
              cy="${position.y.toFixed(1)}"
              r="28"
              fill="#0f172a"
              fill-opacity="0.88"
              stroke="#e2e8f0"
              stroke-width="1"
            />
            <text
              x="${position.x.toFixed(1)}"
              y="${(position.y - 4).toFixed(1)}"
              text-anchor="middle"
              fill="#f8fafc"
              font-size="10"
              font-weight="700"
            >${escapeHtml(truncateLabel(position.participant.name, 12))}</text>
            <text
              x="${position.x.toFixed(1)}"
              y="${(position.y + 10).toFixed(1)}"
              text-anchor="middle"
              fill="#cbd5e1"
              font-size="9"
            >${matchCount} link${matchCount === 1 ? "" : "s"}</text>
          </g>
        `;
      })
      .join("\n");

    return `
      <div class="graph-wrapper">
        <svg viewBox="0 0 ${width} ${height}" class="match-graph" role="img" aria-label="Team building match graph">
          ${edgesSvg}
          ${nodesSvg}
        </svg>
        <p class="muted">Link thickness represents shared-point strength between participants.</p>
      </div>
    `;
  })();

  const strongestMatch = uniqueMatchEdges[0];
  const strongestMatchLabel = strongestMatch
    ? `${participantNameById.get(strongestMatch.leftParticipantId) ?? "Participant"} + ${participantNameById.get(strongestMatch.rightParticipantId) ?? "Participant"} (${strongestMatch.score} shared points)`
    : "No strong pair detected yet";

  const matchingDetailsRows = (interestMatchGraph?.participants ?? [])
    .map((participant) => {
      const strongest = participant.matches[0];
      const strongestName = strongest
        ? participantNameById.get(strongest.participantId) ?? "Participant"
        : "No overlap yet";
      const strongestScore = strongest ? strongest.score.toString() : "-";

      const topMatches = participant.matches.slice(0, 3);
      const matchingInfo = topMatches.length
        ? topMatches
          .map((match) => {
            const matchName = participantNameById.get(match.participantId) ?? "Participant";
            const subjects = match.sharedSubjects
              .slice(0, 2)
              .map((subject) => truncateLabel(subject.topic, 28))
              .join(", ");
            return `<span class="match-chip"><strong>${escapeHtml(matchName)}</strong> (${match.score})<br/><span class="muted">${escapeHtml(subjects || "Shared responses")}</span></span>`;
          })
          .join(" ")
        : '<span class="muted">No overlap captured yet.</span>';

      return `
        <tr>
          <td>${escapeHtml(participant.name)}</td>
          <td>${participant.matches.length}</td>
          <td>${escapeHtml(strongestName)}</td>
          <td>${strongestScore}</td>
          <td>${matchingInfo}</td>
        </tr>
      `;
    })
    .join("\n");

  const teamSections = sessionData.quizType === "team-building"
    ? `
      <section>
        <h2>Match Graph</h2>
        <p class="muted">Pairwise connections derived from shared clustered responses.</p>
        ${matchGraphSvg}
      </section>
      <section>
        <h2>Matching Information</h2>
        <div class="match-summary muted">Strongest link: ${escapeHtml(strongestMatchLabel)}</div>
        <table>
          <thead>
            <tr>
              <th>Participant</th>
              <th>Total matches</th>
              <th>Strongest match</th>
              <th>Score</th>
              <th>Top match topics</th>
            </tr>
          </thead>
          <tbody>
            ${matchingDetailsRows || '<tr><td colspan="5">No matching information available.</td></tr>'}
          </tbody>
        </table>
      </section>
      <section>
        <h2>Top Grouped Responses</h2>
        <ul class="highlight-list">
          ${groupedResponsesList}
        </ul>
      </section>
      <section>
        <h2>Top Discussion Items</h2>
        <ul class="highlight-list">
          ${discussionList}
        </ul>
      </section>
    `
    : "";

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(quizTitle)} Session Report</title>
        <style>
          @page {
            size: A4;
            margin: 14mm;
          }

          body {
            font-family: "Segoe UI", Tahoma, Arial, sans-serif;
            color: #1f2937;
            line-height: 1.35;
            margin: 0;
          }

          .report {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }

          .header {
            border-bottom: 2px solid #dbe7f6;
            padding-bottom: 10px;
          }

          .header h1 {
            margin: 0 0 8px;
            font-size: 26px;
            color: #0f172a;
          }

          .meta {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 6px 20px;
            font-size: 12px;
          }

          .summary {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 8px;
          }

          .card {
            border: 1px solid #dbe7f6;
            border-radius: 10px;
            background: #f6f9ff;
            padding: 8px 10px;
          }

          .card .label {
            font-size: 11px;
            color: #4b5563;
          }

          .card .value {
            font-size: 18px;
            font-weight: 700;
            color: #0f172a;
          }

          h2 {
            margin: 0 0 8px;
            font-size: 18px;
            color: #0f172a;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }

          thead th {
            text-align: left;
            background: #e9f0fb;
            border: 1px solid #d3dfef;
            padding: 7px 8px;
          }

          tbody td {
            border: 1px solid #e3e9f4;
            padding: 7px 8px;
            vertical-align: top;
          }

          tbody tr:nth-child(even) {
            background: #f9fbff;
          }

          .highlight-list {
            margin: 0;
            padding-left: 20px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            font-size: 12px;
          }

          .graph-wrapper {
            border: 1px solid #dbe7f6;
            border-radius: 10px;
            background: #f8fbff;
            padding: 10px;
          }

          .match-graph {
            width: 100%;
            height: auto;
            display: block;
            border-radius: 8px;
            background: #f1f6fd;
          }

          .match-summary {
            margin-bottom: 8px;
          }

          .match-chip {
            display: inline-block;
            border: 1px solid #d6e2f2;
            background: #f8fbff;
            border-radius: 8px;
            padding: 4px 6px;
            margin: 2px;
            font-size: 11px;
            line-height: 1.25;
          }

          .muted {
            color: #64748b;
            font-size: 11px;
          }

          .footer {
            border-top: 1px solid #dbe7f6;
            margin-top: 4px;
            padding-top: 8px;
            font-size: 11px;
            color: #64748b;
          }

          @media print {
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <main class="report">
          <section class="header">
            <h1>Hackoot Session Report</h1>
            <div class="meta">
              <div><strong>Quiz:</strong> ${escapeHtml(quizTitle)}</div>
              <div><strong>Mode:</strong> ${sessionData.quizType === "team-building" ? "Team Building" : "Standard"}</div>
              <div><strong>Session ID:</strong> ${escapeHtml(sessionData.sessionId)}</div>
              <div><strong>Room code:</strong> ${escapeHtml(sessionData.roomCode)}</div>
              <div><strong>Generated:</strong> ${escapeHtml(generatedAt)}</div>
              <div><strong>Participants:</strong> ${participantSummaries.length}</div>
            </div>
          </section>

          <section class="summary">
            <article class="card">
              <div class="label">Responses</div>
              <div class="value">${totalResponses}</div>
            </article>
            <article class="card">
              <div class="label">Votes Cast</div>
              <div class="value">${totalVotes}</div>
            </article>
            <article class="card">
              <div class="label">Top Score</div>
              <div class="value">${topScore.toLocaleString()}</div>
            </article>
            <article class="card">
              <div class="label">Session Ended</div>
              <div class="value" style="font-size:12px; font-weight:600;">${escapeHtml(new Date(sessionData.endedAt).toLocaleString())}</div>
            </article>
          </section>

          <section>
            <h2>Participant Overview</h2>
            <table>
              <thead>
                <tr>
                  ${participantTableHeader}
                </tr>
              </thead>
              <tbody>
                ${participantRows || `<tr><td colspan="${participantColumnCount}">No participant data available.</td></tr>`}
              </tbody>
            </table>
          </section>

          ${teamSections}

          <section class="footer">
            Exported from Hackoot. JSON export remains available for app compatibility and data processing.
          </section>
        </main>
      </body>
    </html>
  `;
}

export function saveQuiz(quiz: Quiz): void {
  const all = loadAllQuizzes();
  const i = all.findIndex(q => q.quizId === quiz.quizId);
  if (i >= 0) all[i] = quiz; else all.push(quiz);
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function loadAllQuizzes(): Quiz[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((quiz) => normaliseQuiz(quiz));
  } catch {
    return [];
  }
}

export function deleteQuiz(quizId: string): void {
  localStorage.setItem(KEY, JSON.stringify(loadAllQuizzes().filter(q => q.quizId !== quizId)));
}

export function exportQuiz(quiz: Quiz): void {
  const normalisedQuiz = normaliseQuiz(quiz);
  const blob = new Blob([JSON.stringify(normalisedQuiz, null, 2)], { type: "application/json" });
  triggerDownload(blob, `${toSafeFileNameSegment(quiz.title)}.json`);
}

export function exportSessionResults(sessionData: SessionExportData, quizTitle: string): void {
  const withTitle: SessionExportData = {
    ...sessionData,
    quizTitle: quizTitle.trim() || sessionData.quizTitle,
  };
  const blob = new Blob([JSON.stringify(withTitle, null, 2)], { type: "application/json" });
  triggerDownload(blob, `${toSafeFileNameSegment(quizTitle)}-results.json`);
}

interface PairRelationship {
  leftParticipantId: string;
  rightParticipantId: string;
  leftName: string;
  rightName: string;
  score: number;
  sharedSubjects: SharedSubject[];
}

type JsPdfDocument = {
  internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
  addPage: (format?: string, orientation?: "portrait" | "landscape") => void;
  setFont: (fontName: string, fontStyle?: string) => void;
  setFontSize: (size: number) => void;
  setTextColor: (r: number, g?: number, b?: number) => void;
  setDrawColor: (r: number, g?: number, b?: number) => void;
  setFillColor: (r: number, g?: number, b?: number) => void;
  setLineWidth: (width: number) => void;
  line: (x1: number, y1: number, x2: number, y2: number) => void;
  rect: (x: number, y: number, width: number, height: number, style?: string) => void;
  circle: (x: number, y: number, radius: number, style?: string) => void;
  text: (text: string | string[], x: number, y: number, options?: Record<string, unknown>) => void;
  splitTextToSize: (text: string, maxWidth: number) => string[];
  save: (filename: string) => void;
};

type JsPdfConstructor = new (options?: {
  orientation?: "portrait" | "landscape";
  unit?: string;
  format?: string;
}) => JsPdfDocument;

let jsPdfConstructorPromise: Promise<JsPdfConstructor> | null = null;

function loadJsPdfConstructor(): Promise<JsPdfConstructor> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("PDF export is only available in the browser"));
  }

  const existingConstructor = (window as unknown as {
    jspdf?: { jsPDF?: JsPdfConstructor };
  }).jspdf?.jsPDF;

  if (existingConstructor) {
    return Promise.resolve(existingConstructor);
  }

  if (jsPdfConstructorPromise) {
    return jsPdfConstructorPromise;
  }

  jsPdfConstructorPromise = new Promise<JsPdfConstructor>((resolve, reject) => {
    const scriptId = "hackoot-jspdf-loader";
    const currentScript = document.getElementById(scriptId) as HTMLScriptElement | null;

    const resolveIfAvailable = () => {
      const loadedConstructor = (window as unknown as {
        jspdf?: { jsPDF?: JsPdfConstructor };
      }).jspdf?.jsPDF;

      if (!loadedConstructor) {
        reject(new Error("Unable to load PDF generator"));
        return;
      }

      resolve(loadedConstructor);
    };

    if (currentScript) {
      currentScript.addEventListener("load", resolveIfAvailable, { once: true });
      currentScript.addEventListener(
        "error",
        () => reject(new Error("Unable to load PDF generator")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
    script.async = true;
    script.onload = resolveIfAvailable;
    script.onerror = () => reject(new Error("Unable to load PDF generator"));
    document.head.appendChild(script);
  });

  return jsPdfConstructorPromise;
}

function buildPairRelationships(sessionData: SessionExportData): {
  participantOrder: { participantId: string; name: string }[];
  relationships: PairRelationship[];
  maxScore: number;
} {
  const graph = buildInterestMatchGraph(
    sessionData.participants,
    sessionData.teamClusters,
    sessionData.teamQuestionPrompts
  );

  const participantOrder = graph.participants.map((participant) => ({
    participantId: participant.participantId,
    name: participant.name,
  }));

  const relationships: PairRelationship[] = [];
  const seenPairs = new Set<string>();

  for (const participant of graph.participants) {
    for (const match of participant.matches) {
      const pairKey = [participant.participantId, match.participantId].sort().join("|");
      if (seenPairs.has(pairKey)) {
        continue;
      }

      seenPairs.add(pairKey);

      const rightName =
        graph.participants.find((entry) => entry.participantId === match.participantId)?.name ??
        "Participant";

      relationships.push({
        leftParticipantId: participant.participantId,
        rightParticipantId: match.participantId,
        leftName: participant.name,
        rightName,
        score: match.score,
        sharedSubjects: match.sharedSubjects,
      });
    }
  }

  relationships.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    if (left.leftName === right.leftName) {
      return left.rightName.localeCompare(right.rightName);
    }

    return left.leftName.localeCompare(right.leftName);
  });

  return {
    participantOrder,
    relationships,
    maxScore: Math.max(1, graph.maxScore),
  };
}

function ensurePageSpace(
  doc: JsPdfDocument,
  y: number,
  neededHeight: number,
  margin: number,
  pageHeight: number
): number {
  if (y + neededHeight <= pageHeight - margin) {
    return y;
  }

  doc.addPage();
  return margin;
}

interface DrawSimpleTableOptions {
  headerFontSize?: number;
  bodyFontSize?: number;
  minimumRowHeight?: number;
}

function drawSimpleTable(
  doc: JsPdfDocument,
  headers: string[],
  rows: string[][],
  columnWeights: number[],
  startY: number,
  margin: number,
  pageWidth: number,
  pageHeight: number,
  options?: DrawSimpleTableOptions
): number {
  if (headers.length === 0 || columnWeights.length !== headers.length) {
    return startY;
  }

  const contentWidth = pageWidth - margin * 2;
  const totalWeight = columnWeights.reduce((sum, weight) => sum + weight, 0);
  const widths = columnWeights.map((weight) => (weight / totalWeight) * contentWidth);
  const cellPadding = 5;
  const columnCount = headers.length;
  const headerFontSize =
    options?.headerFontSize ?? (columnCount >= 10 ? 7 : columnCount >= 7 ? 8 : 9);
  const bodyFontSize =
    options?.bodyFontSize ?? (columnCount >= 10 ? 7 : columnCount >= 7 ? 8 : 9);
  const headerLineHeight = Math.max(8, headerFontSize + 2);
  const bodyLineHeight = Math.max(8, bodyFontSize + 2);
  const minimumRowHeight = options?.minimumRowHeight ?? Math.max(16, bodyLineHeight + 6);

  let y = startY;

  const drawHeader = () => {
    const wrappedHeaders = headers.map((header, index) =>
      doc.splitTextToSize(String(header ?? ""), Math.max(8, widths[index] - cellPadding * 2))
    );
    const headerHeight = Math.max(
      18,
      ...wrappedHeaders.map((lines) => lines.length * headerLineHeight + 6)
    );

    let x = margin;
    doc.setDrawColor(205, 218, 236);
    doc.setLineWidth(0.45);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(headerFontSize);
    doc.setTextColor(15, 29, 49);

    wrappedHeaders.forEach((lines, index) => {
      doc.rect(x, y, widths[index], headerHeight, "S");
      doc.text(lines, x + cellPadding, y + headerFontSize + 4);
      x += widths[index];
    });

    y += headerHeight;
  };

  drawHeader();

  rows.forEach((row, rowIndex) => {
    const wrapped = headers.map((_, index) =>
      doc.splitTextToSize(
        String(row[index] ?? ""),
        Math.max(8, widths[index] - cellPadding * 2)
      )
    );
    const rowHeight = Math.max(
      minimumRowHeight,
      ...wrapped.map((lines) => lines.length * bodyLineHeight + 6)
    );

    y = ensurePageSpace(doc, y, rowHeight, margin, pageHeight);
    if (y === margin) {
      drawHeader();
    }

    let x = margin;
    doc.setDrawColor(223, 232, 243);
    doc.setLineWidth(0.3);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(bodyFontSize);
    doc.setTextColor(22, 34, 52);

    wrapped.forEach((lines, index) => {
      doc.rect(x, y, widths[index], rowHeight, "S");
      doc.text(lines, x + cellPadding, y + bodyFontSize + 3);
      x += widths[index];
    });

    y += rowHeight;
  });

  return y;
}

export async function exportSessionResultsPdf(
  sessionData: SessionExportData,
  quizTitle: string
): Promise<void> {
  const JsPdf = await loadJsPdfConstructor();
  const doc = new JsPdf({ orientation: "portrait", unit: "pt", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  const generatedAt = new Date().toLocaleString();
  const participantSummaries = buildParticipantSummaries(sessionData);

  const totalResponses = participantSummaries.reduce((sum, participant) => sum + participant.submissions, 0);
  const totalVotes = participantSummaries.reduce((sum, participant) => sum + participant.votesCast, 0);
  const topScore = participantSummaries.reduce((maxScore, participant) => Math.max(maxScore, participant.score), 0);

  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(21);
  doc.setTextColor(18, 30, 49);
  doc.text("Hackoot Session Report", margin, y);
  y += 26;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60, 75, 101);
  doc.text(`Quiz: ${quizTitle}`, margin, y);
  y += 14;
  doc.text(`Mode: ${sessionData.quizType === "team-building" ? "Team Building" : "Standard"}`, margin, y);
  y += 14;
  doc.text(`Session ID: ${sessionData.sessionId} | Room: ${sessionData.roomCode}`, margin, y);
  y += 14;
  doc.text(`Generated: ${generatedAt}`, margin, y);
  y += 18;

  doc.setDrawColor(214, 224, 239);
  doc.line(margin, y, pageWidth - margin, y);
  y += 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(20, 33, 54);
  doc.text("Session Highlights", margin, y);
  y += 14;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(45, 59, 83);
  doc.text(`Participants: ${participantSummaries.length}`, margin, y);
  y += 13;
  doc.text(`Responses submitted: ${totalResponses}`, margin, y);
  y += 13;
  doc.text(`Votes cast: ${totalVotes}`, margin, y);
  y += 13;
  doc.text(`Top score: ${topScore.toLocaleString()}`, margin, y);
  y += 20;

  y = ensurePageSpace(doc, y, 26, margin, pageHeight);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(20, 33, 54);
  doc.text("Participant Overview", margin, y);
  y += 10;

  if (sessionData.quizType === "team-building") {
    const headers = ["Participant", "Responses", "Votes", "Contributed clusters", "Matched with"];
    const rows = participantSummaries.map((participant) => [
      participant.name,
      participant.submissions.toString(),
      participant.votesCast.toString(),
      participant.contributedClusters.toString(),
      participant.matchedWith.toString(),
    ]);
    y = drawSimpleTable(doc, headers, rows, [2.2, 1, 1, 1.4, 1.2], y, margin, pageWidth, pageHeight);
  } else {
    const headers = ["Rank", "Participant", "Score", "Answered", "Correct", "Accuracy"];
    const rows = participantSummaries.map((participant) => [
      participant.rank?.toString() ?? "-",
      participant.name,
      participant.score.toLocaleString(),
      participant.answeredQuestions.toString(),
      participant.correctAnswers.toString(),
      `${participant.accuracyPercent.toFixed(1)}%`,
    ]);
    y = drawSimpleTable(doc, headers, rows, [0.8, 2.3, 1, 1, 1, 1], y, margin, pageWidth, pageHeight);
  }

  if (sessionData.quizType === "team-building") {
    const { participantOrder, relationships, maxScore } = buildPairRelationships(sessionData);
    const pairScoreByKey = new Map<string, number>();

    relationships.forEach((relationship) => {
      const key = [relationship.leftParticipantId, relationship.rightParticipantId]
        .sort()
        .join("|");
      pairScoreByKey.set(key, relationship.score);
    });

    doc.addPage();
    y = margin;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(20, 33, 54);
    doc.text("Relationship Graph", margin, y);
    y += 14;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(66, 83, 112);
    doc.text("The graph below includes all participants and their shared-point connections.", margin, y);
    y += 14;

    const graphHeight = 290;
    const graphTop = y;
    const graphBottom = graphTop + graphHeight;
    const centreX = margin + contentWidth / 2;
    const centreY = graphTop + graphHeight / 2;
    const radius = Math.max(80, Math.min(contentWidth, graphHeight) * 0.34);

    doc.setFillColor(245, 249, 255);
    doc.setDrawColor(215, 225, 238);
    doc.rect(margin, graphTop, contentWidth, graphHeight, "FD");

    const positions = participantOrder.map((participant, index) => {
      const angle = (-Math.PI / 2) + (2 * Math.PI * index) / Math.max(1, participantOrder.length);
      return {
        participant,
        x: centreX + Math.cos(angle) * radius,
        y: centreY + Math.sin(angle) * radius,
      };
    });

    const positionById = new Map(
      positions.map((position) => [position.participant.participantId, position])
    );

    relationships.forEach((relationship) => {
      const left = positionById.get(relationship.leftParticipantId);
      const right = positionById.get(relationship.rightParticipantId);
      if (!left || !right) {
        return;
      }

      const width = 0.9 + (relationship.score / maxScore) * 3.8;
      doc.setDrawColor(249, 115, 22);
      doc.setLineWidth(width);
      doc.line(left.x, left.y, right.x, right.y);
    });

    positions.forEach((position) => {
      doc.setFillColor(15, 23, 42);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(1);
      doc.circle(position.x, position.y, 17, "FD");

      doc.setTextColor(248, 250, 252);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text(truncateLabel(position.participant.name, 10), position.x, position.y + 2.5, {
        align: "center",
      });
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(66, 83, 112);
    doc.text("Thicker links indicate stronger shared-response relationships.", margin, graphBottom + 14);

    // Keep matrix and graph on separate pages to avoid any visual overlap.
    doc.addPage();
    y = margin;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(20, 33, 54);
    doc.text("Relationship Matrix (All Participants)", margin, y);
    y += 13;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(66, 83, 112);
    doc.text("Matrix uses participant names. Each value is the shared-point count.", margin, y);
    y += 16;

    const allParticipants = participantOrder;
    const chunkSize = 6;

    for (let chunkStart = 0; chunkStart < allParticipants.length; chunkStart += chunkSize) {
      const chunk = allParticipants.slice(chunkStart, chunkStart + chunkSize);
      const headers = [
        "Participant",
        ...chunk.map((participant) => truncateLabel(participant.name, 16)),
      ];
      const rows = allParticipants.map((rowParticipant) => [
        truncateLabel(rowParticipant.name, 24),
        ...chunk.map((columnParticipant) => {
          if (rowParticipant.participantId === columnParticipant.participantId) {
            return "-";
          }

          const key = [rowParticipant.participantId, columnParticipant.participantId].sort().join("|");
          const score = pairScoreByKey.get(key) ?? 0;
          return score.toString();
        }),
      ]);

      if (chunkStart > 0) {
        doc.addPage();
        y = margin;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(20, 33, 54);
        doc.text("Relationship Matrix (All Participants)", margin, y);
        y += 13;
      }

      const chunkLabel = `${chunkStart + 1}-${chunkStart + chunk.length} of ${allParticipants.length}`;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(26, 39, 60);
      doc.text(`Matrix columns: ${chunkLabel}`, margin, y);
      y += 14;

      const weights = [2.7, ...chunk.map(() => 1)];
      y = drawSimpleTable(doc, headers, rows, weights, y, margin, pageWidth, pageHeight, {
        headerFontSize: 8,
        bodyFontSize: 8,
        minimumRowHeight: 16,
      });

      y += 6;
    }

    // Use a fresh page for pair-level details so matrix rows never clash with long text blocks.
    doc.addPage();
    y = margin;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(20, 33, 54);
    doc.text("All Pair Relationship Details", margin, y);
    y += 14;

    if (!relationships.length) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(75, 91, 118);
      doc.text("No overlapping clustered responses were found between participants.", margin, y);
    } else {
      relationships.forEach((relationship) => {
        const heading = `${relationship.leftName} <-> ${relationship.rightName} (${relationship.score} shared point${relationship.score === 1 ? "" : "s"})`;
        const headingLines = doc.splitTextToSize(heading, contentWidth);
        const subjects = relationship.sharedSubjects.length
          ? relationship.sharedSubjects
          : [];

        const subjectLineCount = subjects.reduce((count, subject) => {
          const line = `- ${subject.topic} (${subject.questionText})`;
          const wrapped = doc.splitTextToSize(line, contentWidth - 14);
          return count + wrapped.length;
        }, 0);

        const requiredHeight =
          headingLines.length * 11 +
          Math.max(1, subjects.length) * 3 +
          (subjects.length ? subjectLineCount * 10 : 12) +
          10;

        y = ensurePageSpace(doc, y, requiredHeight, margin, pageHeight);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(28, 40, 64);
        doc.text(headingLines, margin, y);
        y += headingLines.length * 11;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(62, 79, 107);

        if (!relationship.sharedSubjects.length) {
          doc.text("- No shared topics recorded for this pair.", margin + 10, y);
          y += 12;
          return;
        }

        relationship.sharedSubjects.forEach((subject) => {
          const line = `- ${subject.topic} (${subject.questionText})`;
          const wrapped = doc.splitTextToSize(line, contentWidth - 14);
          y = ensurePageSpace(doc, y, wrapped.length * 10 + 4, margin, pageHeight);
          doc.text(wrapped, margin + 10, y);
          y += wrapped.length * 10 + 2;
        });

        y += 4;
      });
    }
  }

  const safeTitle = toSafeFileNameSegment(quizTitle || sessionData.quizTitle || "hackoot-results");
  doc.save(`${safeTitle}-session-report.pdf`);
}
