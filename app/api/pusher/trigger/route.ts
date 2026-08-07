import { NextRequest, NextResponse } from "next/server";
import { pusherServer } from "@/lib/pusher-server";

const CHANNEL_PATTERN = /^private-hackoot-(host|play)-[A-Z0-9]{6}$/;

// Restrict which events each channel type may carry to prevent spoofing
const ALLOWED_EVENTS: Record<string, string[]> = {
  host: ["player-join", "player-answer", "player-choice-answer", "player-text-answers", "player-discussion-votes"],
  play: [
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
  ],
};

export async function POST(req: NextRequest) {
  const { channel, event, data } = await req.json();

  if (!channel || !event) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const match = CHANNEL_PATTERN.exec(channel as string);
  if (!match) {
    return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
  }

  const channelType = match[1] as "host" | "play";
  if (!ALLOWED_EVENTS[channelType].includes(event as string)) {
    return NextResponse.json({ error: "Event not permitted on this channel" }, { status: 400 });
  }

  await pusherServer.trigger(channel as string, event as string, data);
  return NextResponse.json({ ok: true });
}
