import Peer, { DataConnection } from "peerjs";
import { PeerMessage, Question } from "../types";

// Check if WebRTC is available in the browser
export function isWebRTCSupported(): boolean {
  return !!(
    typeof window !== "undefined" &&
    (window.RTCPeerConnection || (window as any).webkitRTCPeerConnection || (window as any).mozRTCPeerConnection)
  );
}

export class HostPeer {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  public onPlayerJoin: ((participantId: string, name: string) => void) | null = null;
  public onAnswerReceived: ((participantId: string, questionId: string, choiceId: string, submittedAt: number) => void) | null = null;
  public onError: ((error: string) => void) | null = null;
  public onPlayerDisconnect: ((participantId: string) => void) | null = null;

  async connect(roomCode: string): Promise<void> {
    // Check WebRTC support first
    if (!isWebRTCSupported()) {
      const error = "WebRTC is not supported in this browser. Please use a modern browser like Chrome, Firefox, or Safari.";
      this.onError?.(error);
      throw new Error(error);
    }

    return new Promise((resolve, reject) => {
      const peerId = `hackoot-${roomCode}`;
      
      try {
        this.peer = new Peer(peerId);
      } catch (err) {
        const error = "Failed to initialize peer connection. WebRTC may not be available.";
        this.onError?.(error);
        reject(new Error(error));
        return;
      }

      const timeout = setTimeout(() => {
        const error = "Connection timeout - please check your network and try again";
        this.onError?.(error);
        reject(new Error(error));
      }, 15000);

      this.peer.on("open", () => {
        clearTimeout(timeout);
        resolve();
      });

      this.peer.on("error", (err) => {
        clearTimeout(timeout);
        let errorMessage: string;
        
        if (err.type === "unavailable-id") {
          errorMessage = "Room code already in use - please try again";
        } else if (err.type === "browser-incompatible") {
          errorMessage = "Your browser does not support WebRTC. Please use Chrome, Firefox, or Safari.";
        } else if (err.type === "disconnected") {
          errorMessage = "Lost connection to the server. Please check your network.";
        } else if (err.type === "network") {
          errorMessage = "Network error - please check your internet connection.";
        } else if (err.type === "server-error") {
          errorMessage = "Server connection failed. Please try again later.";
        } else {
          errorMessage = `Connection error: ${err.message || err.type}`;
        }
        
        this.onError?.(errorMessage);
        reject(new Error(errorMessage));
      });

      this.peer.on("connection", (conn) => {
        conn.on("open", () => {
          conn.on("data", (data) => {
            const message = data as PeerMessage;
            if (message.type === "join") {
              this.connections.set(message.participantId, conn);
              this.onPlayerJoin?.(message.participantId, message.name);
              conn.send({ type: "joinAck", participantId: message.participantId });
            } else if (message.type === "submitAnswer") {
              this.onAnswerReceived?.(
                message.participantId,
                message.questionId,
                message.choiceId,
                message.submittedAt
              );
            }
          });

          conn.on("close", () => {
            for (const [participantId, c] of this.connections.entries()) {
              if (c === conn) {
                this.connections.delete(participantId);
                this.onPlayerDisconnect?.(participantId);
                break;
              }
            }
          });
        });
      });
    });
  }

  broadcast(message: PeerMessage): void {
    this.connections.forEach((conn) => {
      if (conn.open) {
        conn.send(message);
      }
    });
  }

  broadcastQuestion(question: Question, questionIndex: number, totalQuestions: number): void {
    // Strip correctChoiceIds for security
    const { correctChoiceIds, ...safeQuestion } = question;
    const message: PeerMessage = {
      type: "questionStarted",
      question: safeQuestion,
      questionIndex,
      totalQuestions,
      startedAt: Date.now(),
    };
    this.broadcast(message);
  }

  disconnect(): void {
    this.connections.forEach((conn) => conn.close());
    this.connections.clear();
    this.peer?.destroy();
    this.peer = null;
  }
}

export class PlayerPeer {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  public onMessage: ((message: PeerMessage) => void) | null = null;
  public onError: ((error: string) => void) | null = null;
  public onDisconnect: (() => void) | null = null;

  async connect(roomCode: string, participantId: string, name: string): Promise<void> {
    // Check WebRTC support first
    if (!isWebRTCSupported()) {
      const error = "WebRTC is not supported in this browser. Please use a modern browser like Chrome, Firefox, or Safari.";
      this.onError?.(error);
      throw new Error(error);
    }

    return new Promise((resolve, reject) => {
      try {
        this.peer = new Peer();
      } catch (err) {
        const error = "Failed to initialize peer connection. WebRTC may not be available.";
        this.onError?.(error);
        reject(new Error(error));
        return;
      }

      const timeout = setTimeout(() => {
        const error = "Connection timeout - please check your network and room code";
        this.onError?.(error);
        reject(new Error(error));
      }, 15000);

      this.peer.on("open", () => {
        const hostPeerId = `hackoot-${roomCode}`;
        this.connection = this.peer!.connect(hostPeerId, { reliable: true });

        this.connection.on("open", () => {
          clearTimeout(timeout);
          // Send join message
          this.connection!.send({
            type: "join",
            participantId,
            name,
          } as PeerMessage);
        });

        this.connection.on("data", (data) => {
          const message = data as PeerMessage;
          if (message.type === "joinAck") {
            resolve();
          }
          this.onMessage?.(message);
        });

        this.connection.on("close", () => {
          this.onDisconnect?.();
        });

        this.connection.on("error", (err) => {
          clearTimeout(timeout);
          const error = `Connection error: ${err.message || "Unknown error"}`;
          this.onError?.(error);
          reject(new Error(error));
        });
      });

      this.peer.on("error", (err) => {
        clearTimeout(timeout);
        let errorMessage: string;
        
        if (err.type === "peer-unavailable") {
          errorMessage = "Room not found - please check the room code";
        } else if (err.type === "browser-incompatible") {
          errorMessage = "Your browser does not support WebRTC. Please use Chrome, Firefox, or Safari.";
        } else if (err.type === "disconnected") {
          errorMessage = "Lost connection to the server. Please check your network.";
        } else if (err.type === "network") {
          errorMessage = "Network error - please check your internet connection.";
        } else {
          errorMessage = `Connection error: ${err.message || err.type}`;
        }
        
        this.onError?.(errorMessage);
        reject(new Error(errorMessage));
      });
    });
  }

  send(message: PeerMessage): void {
    if (this.connection?.open) {
      this.connection.send(message);
    }
  }

  disconnect(): void {
    this.connection?.close();
    this.peer?.destroy();
    this.connection = null;
    this.peer = null;
  }
}
