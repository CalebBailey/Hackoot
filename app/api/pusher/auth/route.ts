import { NextRequest, NextResponse } from "next/server";
import { pusherServer } from "@/lib/pusher-server";

// Only allow subscription to hackoot game channels
const CHANNEL_PATTERN = /^private-hackoot-(host|play)-[A-Z0-9]{6}$/;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const params = new URLSearchParams(body);
  const socketId = params.get("socket_id");
  const channelName = params.get("channel_name");

  if (!socketId || !channelName) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!CHANNEL_PATTERN.test(channelName)) {
    return NextResponse.json({ error: "Unauthorised channel" }, { status: 403 });
  }

  const authData = pusherServer.authorizeChannel(socketId, channelName);
  return NextResponse.json(authData);
}
