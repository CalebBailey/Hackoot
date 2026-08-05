"use client";

import { useEffect, useState } from "react";
import { useQuizStore } from "@/store/quizStore";
import { useSessionStore } from "@/store/sessionStore";
import { Button } from "../Button";
import { AnswerGrid } from "../AnswerGrid";
import { Leaderboard } from "../Leaderboard";
import { ClusterView } from "../ClusterView";
import { WordCloud } from "../WordCloud";
import { DiscussionQueue } from "../DiscussionQueue";
import { DiscussionResultsPanel } from "../DiscussionResultsPanel";
import { navigate } from "../HackootApp";
import { ArrowRight, Trophy, Vote } from "lucide-react";
import { HostPeer } from "@/transport/peer";
import {
  AnswerRecord,
  DiscussionVoteCandidate,
  Question,
  TeamAnswerCluster,
  WordCloudTerm,
} from "@/types";
import {
  buildDiscussionQueue,
  buildWordCloud,
  getSelectableChoices,
  groupAnswersByNormalisedText,
  normaliseAnswer,
  resolveQuizType,
} from "@/utils/teamBuilding";

interface HostResultsPageProps {
  quizId: string;
}

interface TeamResultSnapshot {
  groupedAnswers: TeamAnswerCluster[];
  wordCloud: WordCloudTerm[];
}

function buildRawAnswers(question: Question, answers: AnswerRecord[]) {
  const selectableChoices = getSelectableChoices(question);
  const choicesById = new Map(selectableChoices.map((choice) => [choice.id, choice.text]));

  const raw = answers
    .filter((answer) => answer.questionId === question.id)
    .flatMap((answer) => {
      const values: Array<{ answerId: string; participantId: string; text: string }> = [];

      if (answer.choiceId) {
        const choiceText = choicesById.get(answer.choiceId);
        if (choiceText) {
          values.push({
            answerId: `${answer.participantId}-${answer.submittedAt}-choice`,
            participantId: answer.participantId,
            text: choiceText,
          });
        }
      }

      if (answer.textAnswers?.length) {
        answer.textAnswers.forEach((text, index) => {
          values.push({
            answerId: `${answer.participantId}-${answer.submittedAt}-${index}`,
            participantId: answer.participantId,
            text,
          });
        });
      }

      return values;
    })
    .filter((entry) => entry.text.trim().length > 0);

  return raw;
}

function buildTeamResults(question: Question, answers: AnswerRecord[]): TeamResultSnapshot {
  const rawAnswers = buildRawAnswers(question, answers);
  const groupedAnswers = groupAnswersByNormalisedText(rawAnswers).clusters;
  const wordCloud = buildWordCloud(rawAnswers.map((answer) => answer.text));

  return {
    groupedAnswers,
    wordCloud,
  };
}

function buildDiscussionCandidates(
  rawAnswers: Array<{ answerId: string; participantId: string; text: string }>
): DiscussionVoteCandidate[] {
  const candidatesByKey = new Map<string, DiscussionVoteCandidate>();

  for (const answer of rawAnswers) {
    const trimmedText = answer.text.trim();
    if (!trimmedText) {
      continue;
    }

    const key = normaliseAnswer(trimmedText) || trimmedText.toLowerCase();
    const existing = candidatesByKey.get(key);

    if (existing) {
      const participantIds = existing.participantIds ?? [existing.participantId];
      if (!participantIds.includes(answer.participantId)) {
        participantIds.push(answer.participantId);
      }
      existing.participantIds = participantIds;
      continue;
    }

    candidatesByKey.set(key, {
      id: answer.answerId,
      text: trimmedText,
      participantId: answer.participantId,
      participantIds: [answer.participantId],
    });
  }

  return Array.from(candidatesByKey.values());
}

export function HostResultsPage({ quizId }: HostResultsPageProps) {
  const getQuizById = useQuizStore((state) => state.getQuizById);
  const quiz = getQuizById(quizId);

  const session = useSessionStore((state) => state.session);
  const getLeaderboard = useSessionStore((state) => state.getLeaderboard);
  const startQuestion = useSessionStore((state) => state.startQuestion);
  const revealAnswer = useSessionStore((state) => state.revealAnswer);
  const recordTeamVotes = useSessionStore((state) => state.recordTeamVotes);
  const setSessionState = useSessionStore((state) => state.setSessionState);
  const setTeamVoteContext = useSessionStore((state) => state.setTeamVoteContext);
  const setTeamResultsSnapshot = useSessionStore((state) => state.setTeamResultsSnapshot);

  const [revealed, setRevealed] = useState(false);
  const [votingOpen, setVotingOpen] = useState(false);
  const [discussionCandidates, setDiscussionCandidates] = useState<DiscussionVoteCandidate[]>([]);
  const [teamResults, setTeamResults] = useState<TeamResultSnapshot | null>(null);

  const hostPeer = (window as any).__hackootHostPeer as HostPeer | undefined;

  const currentQuestionIndex = session?.currentQuestionIndex ?? 0;
  const currentQuestion = quiz?.questions[currentQuestionIndex];
  const isLastQuestion = quiz ? currentQuestionIndex >= quiz.questions.length - 1 : true;
  const quizType = resolveQuizType(quiz?.quizType);
  const isTeamBuilding = quizType === "team-building";
  const selectableChoices = currentQuestion ? getSelectableChoices(currentQuestion) : [];

  useEffect(() => {
    if (!quiz || !session || !hostPeer || !currentQuestion || revealed) {
      return;
    }

    if (isTeamBuilding) {
      if (currentQuestion.type === "discussion") {
        if (votingOpen) {
          return;
        }

        const rawAnswers = buildRawAnswers(currentQuestion, session.answers);
        const candidates = buildDiscussionCandidates(rawAnswers);
        const maxVotesPerPlayer =
          currentQuestion.maxVotesPerPlayer ??
          quiz.teamBuildingSettings?.maxVotesPerPlayer ??
          3;
        const allowOwnAnswerVoting = quiz.teamBuildingSettings?.allowOwnAnswerVoting ?? true;

        setDiscussionCandidates(candidates);
        setTeamVoteContext({
          questionId: currentQuestion.id,
          candidates,
          maxVotesPerPlayer,
          allowOwnAnswerVoting,
        });
        setSessionState("team-voting");
        hostPeer.broadcast({
          type: "teamVotingOpened",
          questionId: currentQuestion.id,
          candidates,
          maxVotesPerPlayer,
          allowOwnAnswerVoting,
        });
        setVotingOpen(true);
        return;
      }

      const resultSnapshot = buildTeamResults(currentQuestion, session.answers);
      setTeamResults(resultSnapshot);
      setTeamResultsSnapshot({
        questionId: currentQuestion.id,
        groupedAnswers: resultSnapshot.groupedAnswers,
        wordCloud: resultSnapshot.wordCloud,
        discussionQueue: [],
      }, "team-results");
      hostPeer.broadcast({
        type: "teamResultsPublished",
        questionId: currentQuestion.id,
        groupedAnswers: resultSnapshot.groupedAnswers,
        wordCloud: resultSnapshot.wordCloud,
        sessionState: "team-results",
      });
      setSessionState("team-results");
      setRevealed(true);
      return;
    }

    // Broadcast answer reveal to players with each player's individual points
    const leaderboard = getLeaderboard();
    const playerPoints: Record<string, number> = {};
    session.answers
      .filter((a) => a.questionId === currentQuestion.id)
      .forEach((a) => {
        playerPoints[a.participantId] = a.pointsAwarded ?? 0;
      });

    if (currentQuestion.type !== "mcq") {
      return;
    }

    hostPeer.broadcast({
      type: "answerRevealed",
      correctChoiceIds: currentQuestion.correctChoiceIds,
      leaderboard,
      playerPoints,
    });

    revealAnswer();
    setRevealed(true);
  }, [
    quiz,
    session,
    currentQuestion,
    hostPeer,
    getLeaderboard,
    revealed,
    revealAnswer,
    isTeamBuilding,
    setSessionState,
    setTeamResultsSnapshot,
    setTeamVoteContext,
    votingOpen,
  ]);

  useEffect(() => {
    if (!hostPeer || !currentQuestion || !isTeamBuilding || !votingOpen) {
      return;
    }

    hostPeer.onDiscussionVotesReceived = (participantId, questionId, answerIds, submittedAt) => {
      if (questionId !== currentQuestion.id) return;
      recordTeamVotes(participantId, questionId, answerIds, submittedAt);
    };
  }, [hostPeer, currentQuestion, isTeamBuilding, votingOpen, recordTeamVotes]);

  const closeDiscussionVoting = () => {
    if (!hostPeer || !session || !currentQuestion || currentQuestion.type !== "discussion") {
      return;
    }

    const votes = session.answers
      .filter((answer) => answer.questionId === currentQuestion.id && (answer.voteAnswerIds?.length ?? 0) > 0)
      .map((answer) => ({
        participantId: answer.participantId,
        answerIds: answer.voteAnswerIds ?? [],
      }));

    const discussionQueue = buildDiscussionQueue(discussionCandidates, votes);
    const resultSnapshot = buildTeamResults(currentQuestion, session.answers);

    setTeamResults(resultSnapshot);
    setTeamResultsSnapshot({
      questionId: currentQuestion.id,
      groupedAnswers: resultSnapshot.groupedAnswers,
      wordCloud: resultSnapshot.wordCloud,
      discussionQueue,
    }, "team-discussion");

    hostPeer.broadcast({
      type: "teamVotingClosed",
      questionId: currentQuestion.id,
    });
    hostPeer.broadcast({
      type: "teamResultsPublished",
      questionId: currentQuestion.id,
      groupedAnswers: resultSnapshot.groupedAnswers,
      wordCloud: resultSnapshot.wordCloud,
      discussionQueue,
      sessionState: "team-discussion",
    });

    setVotingOpen(false);
    setSessionState("team-discussion");
    setRevealed(true);
  };

  const handleNext = () => {
    if (!quiz || !session || !hostPeer) return;

    if (isTeamBuilding && currentQuestion?.type === "discussion" && votingOpen) {
      closeDiscussionVoting();
      return;
    }

    if (isLastQuestion) {
      // End session - broadcast to players then navigate host to final leaderboard
      const finalLeaderboard = getLeaderboard();
      hostPeer.broadcast({
        type: "sessionEnded",
        finalLeaderboard,
      });
      // Host also goes to the final leaderboard view
      navigate("/play/final");
    } else {
      // Update question index in session first, then navigate
      const nextIndex = currentQuestionIndex + 1;
      const nextQuestion = quiz.questions[nextIndex];
      startQuestion(nextIndex, nextQuestion);
      navigate(`/host/${quizId}/question`);
    }
  };

  if (!quiz || !session || !currentQuestion) {
    return null;
  }

  const leaderboard = getLeaderboard();

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Header */}
      <div className="text-center mb-6">
        <p className="text-sm text-[var(--text-secondary)] mb-1">
          Question {currentQuestionIndex + 1} of {quiz.questions.length}
        </p>
        <h2 className="text-xl sm:text-2xl font-heading font-bold text-[var(--text-primary)]">
          {currentQuestion.text}
        </h2>
      </div>

      {isTeamBuilding ? (
        <div className="space-y-4 mb-8">
          {selectableChoices.length > 0 && (
            <div className="flex justify-center">
              <AnswerGrid choices={selectableChoices} locked={true} />
            </div>
          )}

          {votingOpen && currentQuestion.type === "discussion" && (
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Vote className="w-5 h-5 text-[var(--color-action)]" />
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">Discussion voting in progress</h3>
              </div>
              {discussionCandidates.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">No submissions received for this discussion question.</p>
              ) : (
                <ol className="space-y-2">
                  {discussionCandidates.map((candidate) => (
                    <li key={candidate.id} className="text-sm text-[var(--text-primary)] bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2">
                      {candidate.text}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {revealed && teamResults && (
            <>
              {currentQuestion.type === "discussion" ? (
                <DiscussionResultsPanel
                  items={session.teamDiscussionQueue?.[currentQuestion.id] ?? []}
                  title="Discussion round - no timer"
                />
              ) : null}
              <ClusterView clusters={teamResults.groupedAnswers} />
              <WordCloud terms={teamResults.wordCloud} />
              {currentQuestion.type !== "discussion" && session.teamDiscussionQueue?.[currentQuestion.id]?.length ? (
                <DiscussionQueue items={session.teamDiscussionQueue[currentQuestion.id]} />
              ) : null}
            </>
          )}
        </div>
      ) : (
        <>
          <div className="flex justify-center mb-8">
            <AnswerGrid
              choices={currentQuestion.type === "mcq" ? currentQuestion.choices : []}
              locked={true}
              revealedCorrectIds={
                currentQuestion.type === "mcq" && revealed ? currentQuestion.correctChoiceIds : undefined
              }
            />
          </div>

          <div className="flex justify-center mb-8">
            <Leaderboard entries={leaderboard} maxEntries={5} />
          </div>
        </>
      )}

      {/* Next Button */}
      <Button
        variant="primary"
        size="lg"
        fullWidth
        onClick={handleNext}
      >
        {isTeamBuilding && currentQuestion.type === "discussion" && votingOpen ? (
          <>
            <Vote className="w-5 h-5 mr-2" />
            Close Voting
          </>
        ) : isLastQuestion ? (
          <>
            <Trophy className="w-5 h-5 mr-2" />
            End Session
          </>
        ) : (
          <>
            <ArrowRight className="w-5 h-5 mr-2" />
            Next Question
          </>
        )}
      </Button>
    </div>
  );
}
