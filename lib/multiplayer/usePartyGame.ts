'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import PartySocket from 'partysocket';
import type { OnlineStatus, OnlinePlayer, LastMove } from './types';

export type { OnlineStatus, OnlinePlayer, LastMove };

export interface UsePartyGameConfig<TState> {
  /** PartyKit host */
  host?: string;
  /** Party name — routes to the correct party server */
  party?: string;
  /** Factory for initial/empty state */
  initialState: () => TState;
  /** localStorage key prefix for storing player name */
  nameKey?: string;
}

export interface UsePartyGameResult<TState> {
  gameState: TState;
  myColor: string | null;
  status: OnlineStatus;
  players: OnlinePlayer[];
  opponentWantsRematch: boolean;
  lastMove: LastMove | null;
  submitJoin: (name: string) => void;
  sendMove: (fromRow: number, fromCol: number, toRow: number, toCol: number) => void;
  sendRematch: () => void;
}

export function usePartyGame<TState>(
  roomId: string | null,
  config: UsePartyGameConfig<TState>,
): UsePartyGameResult<TState> {
  const socketRef = useRef<PartySocket | null>(null);
  const socketReadyRef = useRef(false);
  const pendingJoinRef = useRef<string | null>(null);

  const [gameState, setGameState] = useState<TState>(config.initialState);
  const [myColor, setMyColor] = useState<string | null>(null);
  const [status, setStatus] = useState<OnlineStatus>('connecting');
  const [players, setPlayers] = useState<OnlinePlayer[]>([]);
  const [opponentWantsRematch, setOpponentWantsRematch] = useState(false);
  const [lastMove, setLastMove] = useState<LastMove | null>(null);

  useEffect(() => {
    if (!roomId) return;

    setStatus('connecting');
    setMyColor(null);
    setPlayers([]);
    setOpponentWantsRematch(false);
    setGameState(config.initialState());
    setLastMove(null);
    socketReadyRef.current = false;
    pendingJoinRef.current = null;

    const socket = new PartySocket({
      host: config.host || process.env.NEXT_PUBLIC_PARTYKIT_HOST || 'localhost:1999',
      room: roomId,
      party: config.party,
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
        case 'assigned':
          setMyColor(msg.color);
          break;
        case 'waiting':
          setStatus('waiting');
          break;
        case 'start':
          setPlayers(msg.players as OnlinePlayer[]);
          setGameState(msg.gameState as TState);
          setLastMove(null);
          setStatus('playing');
          setOpponentWantsRematch(false);
          break;
        case 'sync':
          setGameState(msg.gameState as TState);
          if (msg.lastMove) setLastMove(msg.lastMove as LastMove);
          break;
        case 'opponent_left':
          setStatus('opponent_left');
          break;
        case 'room_full':
          setStatus('room_full');
          break;
        case 'opponent_rejoined':
          setStatus('playing');
          break;
        case 'rematch_vote':
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
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitJoin = useCallback((name: string) => {
    const key = config.nameKey || 'rh_name';
    localStorage.setItem(key, name);
    if (socketReadyRef.current && socketRef.current) {
      socketRef.current.send(JSON.stringify({ type: 'join', name }));
    } else {
      pendingJoinRef.current = name;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sendMove = useCallback(
    (fromRow: number, fromCol: number, toRow: number, toCol: number) => {
      socketRef.current?.send(
        JSON.stringify({ type: 'move', fromRow, fromCol, toRow, toCol }),
      );
    },
    [],
  );

  const sendRematch = useCallback(() => {
    socketRef.current?.send(JSON.stringify({ type: 'rematch' }));
  }, []);

  return { gameState, myColor, status, players, opponentWantsRematch, lastMove, submitJoin, sendMove, sendRematch };
}
