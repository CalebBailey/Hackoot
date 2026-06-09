import { NextRequest, NextResponse } from "next/server";

const GIPHY_SEARCH_URL = "https://api.giphy.com/v1/gifs/search";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();

  if (!q) {
    return NextResponse.json({ data: [] });
  }

  if (q.length > 50) {
    return NextResponse.json({ error: "Query too long" }, { status: 400 });
  }

  const apiKey = process.env.GIPHY_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Giphy API not configured" }, { status: 500 });
  }

  const url = new URL(GIPHY_SEARCH_URL);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "12");
  url.searchParams.set("rating", "g");
  url.searchParams.set("fields", "id,title,images.fixed_height_small,images.fixed_height");

  try {
    const response = await fetch(url.toString(), { cache: "no-store" });

    if (!response.ok) {
      return NextResponse.json({ error: "Giphy API error" }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to fetch GIFs" }, { status: 500 });
  }
}
