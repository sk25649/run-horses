'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import PartySocket from 'partysocket';
import type { OnlineStatus, OnlinePlayer, LastMove } from '@/lib/multiplayer/types';
import type { GameState } from './gameLogic';

export type { OnlineStatus, OnlinePlayer };

export interface UseMinesPartyGameResult {
  gameState: GameState;
  myColor: string | null;
  status: OnlineStatus;
  players: OnlinePlayer[];
  opponentWantsRematch: boolean;
  lastTo: [number, number] | null; // last destination cell (for board highlight)
  submitJoin: (name: string) => void;
  sendMove: (fromRow: number, fromCol: number, toRow: number, toCol: number) => void;
  sendPlaceMines: (positions: [number, number][]) => void;
  sendRematch: () => void;
}

export function useMinesPartyGame(
  roomId: string | null,
  initialState: () => GameState,
  nameKey = 'mo_name',
): UseMinesPartyGameResult {
  const socketRef = useRef<PartySocket | null>(null);
  const socketReadyRef = useRef(false);
  const pendingJoinRef = useRef<string | null>(null);

  const [gameState, setGameState] = useState<GameState>(initialState);
  const [myColor, setMyColor] = useState<string | null>(null);
  const [status, setStatus] = useState<OnlineStatus>('connecting');
  const [players, setPlayers] = useState<OnlinePlayer[]>([]);
  const [opponentWantsRematch, setOpponentWantsRematch] = useState(false);
  const [lastTo, setLastTo] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (!roomId) return;

    setStatus('connecting');
    setMyColor(null);
    setPlayers([]);
    setOpponentWantsRematch(false);
    setGameState(initialState());
    setLastTo(null);
    socketReadyRef.current = false;
    pendingJoinRef.current = null;

    const socket = new PartySocket({
      host: process.env.NEXT_PUBLIC_PARTYKIT_HOST || 'localhost:1999',
      room: roomId,
      party: 'minefield',
    });

    socket.addEventListener('open', () => {
      socketReadyRef.current = true;
      if (pendingJoinRef.current !== null) {
        socket.send(JSON.stringify({ type: 'join', name: pendingJoinRef.current }));
        pendingJoinRef.current = null;
      } else {
        setStatus('name_required');
      }
    });

    socket.addEventListener('message', (event: MessageEvent) => {
      const msg = JSON.parse(event.data as string);
      switch (msg.type) {
        case 'assigned': setMyColor(msg.color); break;
        case 'waiting': setStatus('waiting'); break;
        case 'start':
          setPlayers(msg.players as OnlinePlayer[]);
          setGameState(msg.gameState as GameState);
          setLastTo(null);
          setStatus('playing');
          setOpponentWantsRematch(false);
          break;
        case 'sync':
          setGameState(msg.gameState as GameState);
          if (msg.lastTo) setLastTo(msg.lastTo as [number, number]);
          break;
        case 'opponent_left': setStatus('opponent_left'); break;
        case 'room_full': setStatus('room_full'); break;
        case 'opponent_rejoined': setStatus('playing'); break;
        case 'rematch_vote': setOpponentWantsRematch(true); break;
      }
    });

    socketRef.current = socket;
    return () => {
      socket.close();
      socketRef.current = null;
      socketReadyRef.current = false;
    };
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitJoin = useCallback((name: string) => {
    localStorage.setItem(nameKey, name);
    if (socketReadyRef.current && socketRef.current) {
      socketRef.current.send(JSON.stringify({ type: 'join', name }));
    } else {
      pendingJoinRef.current = name;
    }
  }, [nameKey]);

  const sendMove = useCallback((fromRow: number, fromCol: number, toRow: number, toCol: number) => {
    socketRef.current?.send(JSON.stringify({ type: 'move', fromRow, fromCol, toRow, toCol }));
  }, []);

  const sendPlaceMines = useCallback((positions: [number, number][]) => {
    socketRef.current?.send(JSON.stringify({ type: 'place_mines', positions }));
  }, []);

  const sendRematch = useCallback(() => {
    socketRef.current?.send(JSON.stringify({ type: 'rematch' }));
  }, []);

  return { gameState, myColor, status, players, opponentWantsRematch, lastTo, submitJoin, sendMove, sendPlaceMines, sendRematch };
}
