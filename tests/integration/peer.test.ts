import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PeerMessage } from "@/types";

class Emitter {
  private handlers = new Map<string, Array<(...args: any[]) => void>>();

  on(event: string, handler: (...args: any[]) => void) {
    const list = this.handlers.get(event) ?? [];
    list.push(handler);
    this.handlers.set(event, list);
  }

  emit(event: string, ...args: any[]) {
    const list = this.handlers.get(event) ?? [];
    for (const handler of list) handler(...args);
  }
}

class MockDataConnection extends Emitter {
  open = true;
  sent: PeerMessage[] = [];

  send(message: PeerMessage) {
    this.sent.push(message);
  }

  close() {
    this.open = false;
    this.emit("close");
  }
}

const peerInstances: MockPeer[] = [];

class MockPeer extends Emitter {
  destroyed = false;
  createdConnections: MockDataConnection[] = [];

  constructor(public id?: string) {
    super();
    peerInstances.push(this);
  }

  connect() {
    const conn = new MockDataConnection();
    this.createdConnections.push(conn);
    return conn;
  }

  destroy() {
    this.destroyed = true;
  }
}

vi.mock("peerjs", () => ({
  __esModule: true,
  default: MockPeer,
}));

describe("peer transport", () => {
  beforeEach(() => {
    peerInstances.length = 0;
    vi.resetModules();
    (window as any).RTCPeerConnection = class {};
  });

  it("host accepts join and replies with joinAck", async () => {
    const { HostPeer } = await import("@/transport/peer");
    const host = new HostPeer();
    const onPlayerJoin = vi.fn();
    host.onPlayerJoin = onPlayerJoin;

    const connected = host.connect("ABC123");
    const hostPeer = peerInstances[0];
    hostPeer.emit("open");
    await connected;

    const conn = new MockDataConnection();
    hostPeer.emit("connection", conn);
    conn.emit("open");
    conn.emit("data", { type: "join", participantId: "p1", name: "Alice" });

    expect(onPlayerJoin).toHaveBeenCalledWith("p1", "Alice");
    expect(conn.sent).toContainEqual({ type: "joinAck", participantId: "p1" });
  });

  it("player resolves connection after joinAck", async () => {
    const { PlayerPeer } = await import("@/transport/peer");
    const player = new PlayerPeer();

    const promise = player.connect("ROOM01", "p1", "Alice");
    const playerPeer = peerInstances[0];

    playerPeer.emit("open");
    const conn = playerPeer.createdConnections[0];
    conn.emit("open");
    conn.emit("data", { type: "joinAck", participantId: "p1" });

    await expect(promise).resolves.toBeUndefined();
    expect(conn.sent).toContainEqual({ type: "join", participantId: "p1", name: "Alice" });
  });

  it("host broadcasts only to open connections", async () => {
    const { HostPeer } = await import("@/transport/peer");
    const host = new HostPeer();

    const connected = host.connect("ROOM01");
    const hostPeer = peerInstances[0];
    hostPeer.emit("open");
    await connected;

    const openConn = new MockDataConnection();
    const closedConn = new MockDataConnection();
    closedConn.open = false;

    hostPeer.emit("connection", openConn);
    openConn.emit("open");
    openConn.emit("data", { type: "join", participantId: "p-open", name: "Open" });

    hostPeer.emit("connection", closedConn);
    closedConn.emit("open");
    closedConn.emit("data", { type: "join", participantId: "p-closed", name: "Closed" });

    host.broadcast({ type: "error", message: "test" });

    expect(openConn.sent).toContainEqual({ type: "error", message: "test" });
    expect(closedConn.sent).not.toContainEqual({ type: "error", message: "test" });
  });
});
