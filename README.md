# Hackoot

An interactive, real-time quiz platform supporting up to 50 simultaneous players. Hosts create and manage quizzes, share a room code (or QR code), and run live sessions directly in the browser.

## Features

- **Quiz Management** - Create, edit, delete, and import quizzes with multiple-choice questions
- **Live Sessions** - Host a quiz session and share a room code or QR code for players to join
- **Up to 50 Players** - Supports up to 50 concurrent participants per session
- **Time-Based Scoring** - 20-second timer per question; faster correct answers earn more points (up to 1,000 per question)
- **Live Leaderboard** - Rankings are shown after every question and at the end of the session
- **Cross-Network Multiplayer** - Uses Pusher Channels over WebSockets for reliable real-time communication across mobile and home networks

## Tech Stack

| Technology | Purpose |
|---|---|
| [Next.js 16](https://nextjs.org/) | React framework |
| [TypeScript](https://www.typescriptlang.org/) | Type safety |
| [Tailwind CSS v4](https://tailwindcss.com/) | Styling |
| [Radix UI](https://www.radix-ui.com/) | Accessible UI primitives |
| [Zustand](https://zustand-demo.pmnd.rs/) | Client state management |
| [Pusher Channels](https://pusher.com/channels) | Real-time messaging transport |
| [qrcode.react](https://github.com/zpao/qrcode.react) | QR code generation |

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A [Pusher Channels](https://pusher.com/channels) app (free tier is sufficient for development)

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
```

For Vercel deployments, add the same variables in your project environment settings.

## Getting Started

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Hosting a Quiz

1. Open the app and create a quiz from the **Create Quiz** page
2. Add your questions and choices, marking the correct answer for each
3. From the home page, select your quiz and click **Host**
4. Share the room code or QR code displayed on screen with your players
5. Start the session once players have joined - advance through questions and review the leaderboard after each one

### Joining a Session

1. Open the app on any device with a supported browser
2. Enter the room code provided by the host
3. Enter your name and wait in the lobby until the host starts

## Browser Requirements

The following modern browsers are fully supported:

- Google Chrome (recommended)
- Mozilla Firefox
- Apple Safari

## Deployment Notes

- The app is designed to deploy cleanly on Vercel.
- Real-time messaging is provided by Pusher Channels via serverless API routes.
- No dedicated long-running websocket server is required in your own infrastructure.

## Licence

[MIT](LICENSE)
