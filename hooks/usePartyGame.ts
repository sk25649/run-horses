"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import PartySocket from "partysocket";
import { createInitialState, getValidMoves } from "@/lib/gameLogic";
import type { GameState, Player } from "@/lib/gameLogic";

export type OnlineStatus = "connecting" | "waiting" | "playing" | "opponent_left";

export interface OnlinePlayer {
  name: string;
  color: Player;
}

export interface UsePartyGameResult {
  gameState: GameState;
  myColor: Player | null;
  status: OnlineStatus;
  players: OnlinePlayer[];
  opponentWantsRematch: boolean;
  sendMove: (fromRow: number, fromCol: number, toRow: number, toCol: number) => void;
  sendRematch: () => void;
}

export function usePartyGame(roomId: string | null): UsePartyGameResult {
  const socketRef = useRef<PartySocket | null>(null);

  const [gameState, setGameState] = useState<GameState>(createInitialState);
  const [myColor, setMyColor] = useState<Player | null>(null);
  const [status, setStatus] = useState<OnlineStatus>("connecting");
  const [players, setPlayers] = useState<OnlinePlayer[]>([]);
  const [opponentWantsRematch, setOpponentWantsRematch] = useState(false);

  useEffect(() => {
    if (!roomId) return;

    setStatus("connecting");
    setMyColor(null);
    setPlayers([]);
    setOpponentWantsRematch(false);
    setGameState(createInitialState());

    const socket = new PartySocket({
      host: process.env.NEXT_PUBLIC_PARTYKIT_HOST || "localhost:1999",
      room: roomId,
    });

    socket.addEventListener("open", () => {
      const name = localStorage.getItem("rh_name") || "Anonymous";
      socket.send(JSON.stringify({ type: "join", name }));
    });

    socket.addEventListener("message", (event: MessageEvent) => {
      const msg = JSON.parse(event.data as string);

      switch (msg.type) {
        case "assigned":
          setMyColor(msg.color as Player);
          break;
        case "waiting":
          setStatus("waiting");
          break;
        case "start":
          setPlayers(msg.players as OnlinePlayer[]);
          setGameState(msg.gameState as GameState);
          setStatus("playing");
          setOpponentWantsRematch(false);
          break;
        case "sync":
          setGameState(msg.gameState as GameState);
          break;
        case "opponent_left":
          setStatus("opponent_left");
          break;
        case "rematch_vote":
          setOpponentWantsRematch(true);
          break;
      }
    });

    socketRef.current = socket;

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [roomId]);

  const sendMove = useCallback(
    (fromRow: number, fromCol: number, toRow: number, toCol: number) => {
      socketRef.current?.send(
        JSON.stringify({ type: "move", fromRow, fromCol, toRow, toCol })
      );
    },
    []
  );

  const sendRematch = useCallback(() => {
    socketRef.current?.send(JSON.stringify({ type: "rematch" }));
  }, []);

  return { gameState, myColor, status, players, opponentWantsRematch, sendMove, sendRematch };
}
