import Pusher, { Channel } from "pusher-js";
import { PeerMessage, PublicQuestion, Question } from "../types";
import { sanitizeQuestionTimeLimit } from "@/utils/scoring";

// No longer needed - Pusher works in all modern browsers without WebRTC
export function isWebRTCSupported(): boolean {
  return true;
}

function createPusherClient(): Pusher {
  return new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    channelAuthorization: {
      endpoint: "/api/pusher/auth",
      transport: "ajax",
    },
  });
}

async function triggerEvent(channel: string, event: string, data: unknown): Promise<void> {
  const res = await fetch("/api/pusher/trigger", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channel, event, data }),
  });
  if (!res.ok) {
    throw new Error(`Trigger failed: ${res.status}`);
  }
}

export class HostPeer {
  private pusher: Pusher | null = null;
  private channel: Channel | null = null;
  private roomCode = "";

  public onPlayerJoin: ((participantId: string, name: string) => void) | null = null;
  public onAnswerReceived: ((participantId: string, questionId: string, choiceId: string, submittedAt: number) => void) | null = null;
  public onChoiceAnswerReceived: ((participantId: string, questionId: string, choiceId: string, submittedAt: number) => void) | null = null;
  public onTextAnswersReceived: ((participantId: string, questionId: string, answers: string[], submittedAt: number) => void) | null = null;
  public onDiscussionVotesReceived: ((participantId: string, questionId: string, answerIds: string[], submittedAt: number) => void) | null = null;
  public onError: ((error: string) => void) | null = null;
  public onPlayerDisconnect: ((participantId: string) => void) | null = null;

  async connect(roomCode: string): Promise<void> {
    this.roomCode = roomCode;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Connection timeout - please check your network and try again"));
      }, 15000);

      this.pusher = createPusherClient();
      this.channel = this.pusher.subscribe(`private-hackoot-host-${roomCode}`);

      this.channel.bind("pusher:subscription_succeeded", () => {
        clearTimeout(timeout);
        resolve();
      });

      this.channel.bind("pusher:subscription_error", (data: unknown) => {
        clearTimeout(timeout);
        const status = (data as { status?: number })?.status ?? data;
        reject(new Error(status === 403 ? "Failed to create room - please try again" : `Room setup error (${status})`));
      });

      this.channel.bind("player-join", (data: { participantId: string; name: string }) => {
        this.onPlayerJoin?.(data.participantId, data.name);
      });

      this.channel.bind("player-answer", (data: { participantId: string; questionId: string; choiceId: string; submittedAt: number }) => {
        this.onAnswerReceived?.(data.participantId, data.questionId, data.choiceId, data.submittedAt);
      });

      this.channel.bind("player-choice-answer", (data: { participantId: string; questionId: string; choiceId: string; submittedAt: number }) => {
        this.onChoiceAnswerReceived?.(data.participantId, data.questionId, data.choiceId, data.submittedAt);
      });

      this.channel.bind("player-text-answers", (data: { participantId: string; questionId: string; answers: string[]; submittedAt: number }) => {
        this.onTextAnswersReceived?.(data.participantId, data.questionId, data.answers, data.submittedAt);
      });

      this.channel.bind("player-discussion-votes", (data: { participantId: string; questionId: string; answerIds: string[]; submittedAt: number }) => {
        this.onDiscussionVotesReceived?.(data.participantId, data.questionId, data.answerIds, data.submittedAt);
      });

      this.pusher.connection.bind("error", (err: unknown) => {
        const msg = (err as { error?: { data?: { message?: string } } })?.error?.data?.message ?? "Unknown connection error";
        this.onError?.(`Connection error: ${msg}`);
      });
    });
  }

  broadcast(message: PeerMessage): void {
    triggerEvent(`private-hackoot-play-${this.roomCode}`, message.type, message).catch(() => {
      this.onError?.("Failed to broadcast message - check your network connection");
    });
  }

  private toPublicQuestion(question: Question): PublicQuestion {
    if (question.type === "mcq") {
      const { correctChoiceIds, ...safeQuestion } = question;
      return safeQuestion;
    }
    return question;
  }

  broadcastQuestion(question: Question, questionIndex: number, totalQuestions: number): void {
    this.broadcast({
      type: "questionStarted",
      question: this.toPublicQuestion(question),
      questionIndex,
      totalQuestions,
      startedAt: Date.now(),
      doublePoints: question.type === "mcq" ? (question.doublePoints ?? false) : false,
      questionDuration: sanitizeQuestionTimeLimit(question.timeLimit),
    });
  }

  disconnect(): void {
    if (this.roomCode) {
      this.pusher?.unsubscribe(`private-hackoot-host-${this.roomCode}`);
    }
    this.pusher?.disconnect();
    this.pusher = null;
    this.channel = null;
  }
}

export class PlayerPeer {
  private pusher: Pusher | null = null;
  private channel: Channel | null = null;
  private roomCode = "";
  private participantId = "";

  public onMessage: ((message: PeerMessage) => void) | null = null;
  public onError: ((error: string) => void) | null = null;
  public onDisconnect: (() => void) | null = null;

  async connect(roomCode: string, participantId: string, name: string): Promise<void> {
    this.roomCode = roomCode;
    this.participantId = participantId;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Connection timeout - please check your network and room code"));
      }, 15000);

      this.pusher = createPusherClient();
      this.channel = this.pusher.subscribe(`private-hackoot-play-${roomCode}`);

      this.channel.bind("pusher:subscription_succeeded", async () => {
        try {
          await triggerEvent(`private-hackoot-host-${roomCode}`, "player-join", {
            participantId,
            name,
          });
          clearTimeout(timeout);
          resolve();
        } catch {
          clearTimeout(timeout);
          reject(new Error("Room not found - please check the room code"));
        }
      });

      this.channel.bind("pusher:subscription_error", (data: unknown) => {
        clearTimeout(timeout);
        const status = (data as { status?: number })?.status ?? data;
        reject(new Error(status === 403 ? "Room not found - please check the room code" : `Join error (${status})`));
      });

      const hostEvents: Array<PeerMessage["type"]> = [
        "lobbyUpdate",
        "questionStarted",
        "answerRevealed",
        "teamSubmissionClosed",
        "teamVotingOpened",
        "teamVotingClosed",
        "teamResultsPublished",
        "teamDiscussionItemOpened",
        "sessionEnded",
        "error",
        "rejoinAck",
      ];

      for (const event of hostEvents) {
        this.channel.bind(event, (data: PeerMessage) => {
          this.onMessage?.(data);
        });
      }

      this.pusher.connection.bind("disconnected", () => {
        this.onDisconnect?.();
      });

      this.pusher.connection.bind("error", (err: unknown) => {
        const msg = (err as { error?: { data?: { message?: string } } })?.error?.data?.message ?? "Unknown connection error";
        this.onError?.(`Connection error: ${msg}`);
      });
    });
  }

  send(message: PeerMessage): void {
    if (message.type === "submitAnswer") {
      triggerEvent(`private-hackoot-host-${this.roomCode}`, "player-answer", {
        participantId: message.participantId,
        questionId: message.questionId,
        choiceId: message.choiceId,
        submittedAt: message.submittedAt,
      }).catch(() => {
        this.onError?.("Failed to submit answer - check your network connection");
      });
      return;
    }

    if (message.type === "submitChoiceAnswer") {
      triggerEvent(`private-hackoot-host-${this.roomCode}`, "player-choice-answer", {
        participantId: message.participantId,
        questionId: message.questionId,
        choiceId: message.choiceId,
        submittedAt: message.submittedAt,
      }).catch(() => {
        this.onError?.("Failed to submit answer - check your network connection");
      });
      return;
    }

    if (message.type === "submitTextAnswers") {
      triggerEvent(`private-hackoot-host-${this.roomCode}`, "player-text-answers", {
        participantId: message.participantId,
        questionId: message.questionId,
        answers: message.answers,
        submittedAt: message.submittedAt,
      }).catch(() => {
        this.onError?.("Failed to submit response - check your network connection");
      });
      return;
    }

    if (message.type === "submitDiscussionVotes") {
      triggerEvent(`private-hackoot-host-${this.roomCode}`, "player-discussion-votes", {
        participantId: message.participantId,
        questionId: message.questionId,
        answerIds: message.answerIds,
        submittedAt: message.submittedAt,
      }).catch(() => {
        this.onError?.("Failed to submit votes - check your network connection");
      });
    }
  }

  disconnect(): void {
    if (this.roomCode) {
      this.pusher?.unsubscribe(`private-hackoot-play-${this.roomCode}`);
    }
    this.pusher?.disconnect();
    this.pusher = null;
    this.channel = null;
  }
}
