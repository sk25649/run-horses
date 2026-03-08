"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import PartySocket from "partysocket";
import { createInitialState } from "@/lib/gameLogic";
import type { GameState, Player } from "@/lib/gameLogic";

export type OnlineStatus = "connecting" | "name_required" | "waiting" | "playing" | "opponent_left" | "room_full";

export interface OnlinePlayer {
  name: string;
  color: Player;
}

export interface LastMove {
  fromRow: number; fromCol: number; toRow: number; toCol: number;
}

export interface UsePartyGameResult {
  gameState: GameState;
  myColor: Player | null;
  status: OnlineStatus;
  players: OnlinePlayer[];
  opponentWantsRematch: boolean;
  lastMove: LastMove | null;
  submitJoin: (name: string) => void;
  sendMove: (fromRow: number, fromCol: number, toRow: number, toCol: number) => void;
  sendRematch: () => void;
}

export function usePartyGame(roomId: string | null): UsePartyGameResult {
  const socketRef = useRef<PartySocket | null>(null);
  const socketReadyRef = useRef(false);
  const pendingJoinRef = useRef<string | null>(null);

  const [gameState, setGameState] = useState<GameState>(createInitialState);
  const [myColor, setMyColor] = useState<Player | null>(null);
  const [status, setStatus] = useState<OnlineStatus>("connecting");
  const [players, setPlayers] = useState<OnlinePlayer[]>([]);
  const [opponentWantsRematch, setOpponentWantsRematch] = useState(false);
  const [lastMove, setLastMove] = useState<LastMove | null>(null);

  useEffect(() => {
    if (!roomId) return;

    setStatus("connecting");
    setMyColor(null);
    setPlayers([]);
    setOpponentWantsRematch(false);
    setGameState(createInitialState());
    setLastMove(null);
    socketReadyRef.current = false;
    pendingJoinRef.current = null;

    const socket = new PartySocket({
      host: process.env.NEXT_PUBLIC_PARTYKIT_HOST || "localhost:1999",
      room: roomId,
    });

    socket.addEventListener("open", () => {
      socketReadyRef.current = true;
      // If submitJoin was called before the socket opened, flush it now
      if (pendingJoinRef.current !== null) {
        socket.send(JSON.stringify({ type: "join", name: pendingJoinRef.current }));
        pendingJoinRef.current = null;
      } else {
        // Socket is ready — wait for user to enter their name
        setStatus("name_required");
      }
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
          setLastMove(null);
          setStatus("playing");
          setOpponentWantsRematch(false);
          break;
        case "sync":
          setGameState(msg.gameState as GameState);
          if (msg.lastMove) setLastMove(msg.lastMove as LastMove);
          break;
        case "opponent_left":
          setStatus("opponent_left");
          break;
        case "room_full":
          setStatus("room_full");
          break;
        case "opponent_rejoined":
          setStatus("playing");
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
      socketReadyRef.current = false;
    };
  }, [roomId]);

  const submitJoin = useCallback((name: string) => {
    localStorage.setItem("rh_name", name);
    if (socketReadyRef.current && socketRef.current) {
      socketRef.current.send(JSON.stringify({ type: "join", name }));
    } else {
      // Socket not open yet — queue it
      pendingJoinRef.current = name;
    }
  }, []);

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

  return { gameState, myColor, status, players, opponentWantsRematch, lastMove, submitJoin, sendMove, sendRematch };
}
