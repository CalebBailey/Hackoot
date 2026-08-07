"use client";

import { useEffect, useState } from "react";
import { HomePage } from "./pages/HomePage";
import { CreateQuizPage } from "./pages/CreateQuizPage";
import { EditQuizPage } from "./pages/EditQuizPage";
import { HostLobbyPage } from "./pages/HostLobbyPage";
import { HostQuestionPage } from "./pages/HostQuestionPage";
import { HostResultsPage } from "./pages/HostResultsPage";
import { JoinPage } from "./pages/JoinPage";
import { PlayerLobbyPage } from "./pages/PlayerLobbyPage";
import { PlayerQuestionPage } from "./pages/PlayerQuestionPage";
import { PlayerVotingPage } from "./pages/PlayerVotingPage";
import { PlayerResultPage } from "./pages/PlayerResultPage";
import { FinalLeaderboardPage } from "./pages/FinalLeaderboardPage";
import { useQuizStore } from "@/store/quizStore";

type Route =
  | { name: "home" }
  | { name: "quiz-new" }
  | { name: "quiz-edit"; quizId: string }
  | { name: "host-lobby"; quizId: string }
  | { name: "host-question"; quizId: string }
  | { name: "host-results"; quizId: string }
  | { name: "join"; roomCode?: string }
  | { name: "play-lobby" }
  | { name: "play-question" }
  | { name: "play-voting" }
  | { name: "play-result" }
  | { name: "play-final" };

function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, "") || "";
  
  if (path === "" || path === "/") return { name: "home" };
  if (path === "quiz/new") return { name: "quiz-new" };
  
  const quizEditMatch = path.match(/^quiz\/([^/]+)\/edit$/);
  if (quizEditMatch) return { name: "quiz-edit", quizId: quizEditMatch[1] };
  
  const hostLobbyMatch = path.match(/^host\/([^/]+)$/);
  if (hostLobbyMatch) return { name: "host-lobby", quizId: hostLobbyMatch[1] };
  
  const hostQuestionMatch = path.match(/^host\/([^/]+)\/question$/);
  if (hostQuestionMatch) return { name: "host-question", quizId: hostQuestionMatch[1] };
  
  const hostResultsMatch = path.match(/^host\/([^/]+)\/results$/);
  if (hostResultsMatch) return { name: "host-results", quizId: hostResultsMatch[1] };
  
  const joinWithCodeMatch = path.match(/^join\/([A-Z0-9]+)$/i);
  if (joinWithCodeMatch) return { name: "join", roomCode: joinWithCodeMatch[1].toUpperCase() };
  
  if (path === "join") return { name: "join" };
  if (path === "play/lobby") return { name: "play-lobby" };
  if (path === "play/question") return { name: "play-question" };
  if (path === "play/voting") return { name: "play-voting" };
  if (path === "play/result") return { name: "play-result" };
  if (path === "play/final") return { name: "play-final" };
  
  return { name: "home" };
}

export function navigate(path: string) {
  window.location.hash = path;
}

export function HackootApp() {
  const [route, setRoute] = useState<Route>({ name: "home" });
  const loadFromStorage = useQuizStore((state) => state.loadFromStorage);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(parseHash(window.location.hash));
    };

    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const renderPage = () => {
    switch (route.name) {
      case "home":
        return <HomePage />;
      case "quiz-new":
        return <CreateQuizPage />;
      case "quiz-edit":
        return <EditQuizPage quizId={route.quizId} />;
      case "host-lobby":
        return <HostLobbyPage quizId={route.quizId} />;
      case "host-question":
        return <HostQuestionPage quizId={route.quizId} />;
      case "host-results":
        return <HostResultsPage quizId={route.quizId} />;
      case "join":
        return <JoinPage initialRoomCode={route.roomCode} />;
      case "play-lobby":
        return <PlayerLobbyPage />;
      case "play-question":
        return <PlayerQuestionPage />;
      case "play-voting":
        return <PlayerVotingPage />;
      case "play-result":
        return <PlayerResultPage />;
      case "play-final":
        return <FinalLeaderboardPage />;
      default:
        return <HomePage />;
    }
  };

  return (
    <>
      <div className="app-bg" />
      <main className="min-h-screen relative z-0 overflow-x-hidden">
        <div key={JSON.stringify(route)} className="page-transition">
          {renderPage()}
        </div>
      </main>
    </>
  );
}
