# Hackoot

An interactive, real-time quiz platform supporting up to 50 simultaneous players. Hosts create and manage quizzes, share a room code (or QR code), and run live sessions directly in the browser.

## Features

- **Quiz Management** - Create, edit, delete, and import quizzes with multiple-choice questions
- **Question Media** - Attach an image to any question via URL or by searching Giphy directly in the editor
- **Team Building Mode** - Run non-competitive sessions with this-or-that, free-text, select-or-text, and discussion question types
- **Team Building Select plus Text** - For select-or-text questions, answer limits apply across both selected options and typed responses
- **Phrase-Based Matching** - Manual multi-word responses are grouped using token overlap, stop-word filtering, and light stemming to improve matching quality
- **Match-Centred Results** - Team Building results focus on grouped answers and discussion queues, including who selected or introduced each matched cluster
- **Live Sessions** - Host a quiz session and share a room code or QR code for players to join
- **Up to 50 Players** - Supports up to 50 concurrent participants per session
- **Time-Based Scoring** - 20-second timer per question; faster correct answers earn more points (up to 1,000 per question)
- **Live Leaderboard** - Rankings are shown after every question and at the end of the session
- **Cross-Network Multiplayer** - Uses Pusher Channels over WebSockets for reliable real-time communication across mobile and home networks

> **Team Building outputs** - Word cloud output is intentionally not included. The mode is designed to show response clusters and participant matching signals only.

## Tech Stack

| Technology | Purpose |
|---|---|
| [Next.js 16](https://nextjs.org/) | React framework |
| [TypeScript](https://www.typescriptlang.org/) | Type safety |
| [Tailwind CSS v4](https://tailwindcss.com/) | Styling |
| [Radix UI](https://www.radix-ui.com/) | Accessible UI primitives |
| [Zustand](https://zustand-demo.pmnd.rs/) | Client state management |
| [Pusher Channels](https://pusher.com/channels) | Real-time messaging transport |
| [Giphy API](https://developers.giphy.com/) | GIF search in the question editor |
| [qrcode.react](https://github.com/zpao/qrcode.react) | QR code generation |

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A [Pusher Channels](https://pusher.com/channels) app (free tier is sufficient for development)
- A [Giphy API key](https://developers.giphy.com/dashboard/) (free beta key is sufficient)

## Environment Variables

Create a local `.env.local` file (you can copy from `.env.local.example`) and set the following values:

```bash
# Server-side
PUSHER_APP_ID=your_app_id
PUSHER_KEY=your_key
PUSHER_SECRET=your_secret
PUSHER_CLUSTER=eu

# Client-side
NEXT_PUBLIC_PUSHER_KEY=your_key
NEXT_PUBLIC_PUSHER_CLUSTER=eu

# Giphy (server-side only - never exposed to the browser)
GIPHY_API_KEY=your_giphy_api_key
```

> **Rate limits** - the free Giphy beta key allows 100 API calls per hour. Searches are debounced and cached in memory during a session, so normal quiz creation usage stays well within this limit. Once a GIF is saved to a quiz, players load it directly from Giphy's CDN during gameplay - no API calls are made during a live session regardless of player count.

For Vercel deployments, add the same variables in your project environment settings.

## Getting Started

```bash
# Install dependencies
pnpm install

# Start the development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Testing

```bash
# Unit + integration
pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage

# Integration only
pnpm test:integration

# Multiplayer session stress simulation (25 participants)
pnpm test:multiplayer

# Install Playwright browser (run once)
pnpm exec playwright install chromium

# End-to-end tests
pnpm test:e2e
```

## Usage

### Hosting a Quiz

1. Open the app and create a quiz from the **Create Quiz** page
2. Choose the quiz type (**Standard** or **Team Building**)
3. Add your questions and choices, marking the correct answer for each Standard MCQ
4. For Team Building, configure answer/vote limits and use select-or-text, free-text, or discussion prompts as needed
5. Optionally attach an image to a question - paste a URL into the image field or click **GIF** to search Giphy
6. From the home page, select your quiz and click **Host**
7. Share the room code or QR code displayed on screen with your players
8. Start the session once players have joined - advance through questions and review the leaderboard after each one

### Team Building Session Notes

- Team Building is participation-first: no points-based winner framing and no podium emphasis.
- Matching is based on grouped answers, including phrase similarity for manual text entries.
- Discussion questions include a voting phase and a host-led discussion queue.

### Joining a Session

1. Open the app on any device with a supported browser
2. Enter the room code provided by the host
3. Enter your name and wait in the lobby until the host starts

## Browser Requirements

The following modern browsers are fully supported:

- Google Chrome (recommended)
- Mozilla Firefox
- Apple Safari

## Scale and Limits

- **Players per room** - The app is designed for up to 50 players per room (plus 1 host).
- **Questions per session** - There is no strict app-level question limit, but longer sessions increase message usage and can reduce player engagement.
- **Concurrent sessions** - Total capacity depends on your Pusher Channels and Vercel plan limits (concurrent connections, message volume, and serverless request quotas).
- **Development vs production** - Free tiers are suitable for development and small tests; production usage should use a paid plan sized to your expected concurrent rooms.

## Deployment Notes

- The app is designed to deploy cleanly on Vercel.
- Real-time messaging is provided by Pusher Channels via serverless API routes.
- No dedicated long-running websocket server is required in your own infrastructure.

## Licence

[MIT](LICENSE)
