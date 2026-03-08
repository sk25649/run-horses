'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import PartySocket from 'partysocket';
import { GameState, Player } from './gameLogic';

interface PartyRoom {
  gameState: GameState | null;
  myColor: Player | null;
  opponentConnected: boolean;
  error: string | null;
  sendMove: (fromRow: number, fromCol: number, toRow: number, toCol: number) => void;
  sendReset: () => void;
}

export function usePartyRoom(roomId: string | null): PartyRoom {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myColor, setMyColor] = useState<Player | null>(null);
  const [opponentConnected, setOpponentConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<PartySocket | null>(null);

  useEffect(() => {
    if (!roomId) {
      socketRef.current = null;
      setGameState(null);
      setMyColor(null);
      setOpponentConnected(false);
      setError(null);
      return;
    }

    const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST;
    if (!host) {
      setError('NEXT_PUBLIC_PARTYKIT_HOST not configured');
      return;
    }

    const ws = new PartySocket({ host, room: roomId });
    socketRef.current = ws;

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        switch (msg.type) {
          case 'assigned':
            setMyColor(msg.color);
            break;
          case 'state':
            setGameState(msg.gameState);
            setOpponentConnected(msg.white && msg.black);
            break;
          case 'opponent-connected':
            setOpponentConnected(true);
            break;
          case 'opponent-disconnected':
            setOpponentConnected(false);
            break;
          case 'error':
            setError(msg.message);
            break;
        }
      } catch { /* ignore malformed messages */ }
    };

    ws.onerror = () => setError('Connection error');

    return () => {
      ws.close();
      socketRef.current = null;
    };
  }, [roomId]);

  const sendMove = useCallback(
    (fromRow: number, fromCol: number, toRow: number, toCol: number) => {
      socketRef.current?.send(JSON.stringify({ type: 'move', fromRow, fromCol, toRow, toCol }));
    },
    [],
  );

  const sendReset = useCallback(() => {
    socketRef.current?.send(JSON.stringify({ type: 'reset' }));
  }, []);

  return { gameState, myColor, opponentConnected, error, sendMove, sendReset };
}
