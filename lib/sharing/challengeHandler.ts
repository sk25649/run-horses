import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';
import type { ChallengeData } from './types';

/**
 * Factory for creating challenge API route handlers scoped to a specific game.
 * Usage in a route.ts:
 *   export const { GET, POST } = createChallengeHandler({ gameId: 'run-horses' });
 */
export function createChallengeHandler(config: { gameId: string; validDifficulties?: string[] }) {
  const redis = Redis.fromEnv();
  const validDifficulties = config.validDifficulties || ['easy', 'medium', 'hard', 'impossible'];

  async function POST(req: NextRequest) {
    try {
      const { name, moves, difficulty, mode } = await req.json();

      if (typeof moves !== 'number' || moves < 1 || moves > 1000) {
        return NextResponse.json({ error: 'Invalid moves' }, { status: 400 });
      }

      const token = Math.random().toString(36).slice(2, 9); // 7-char token
      const data: ChallengeData = {
        name: String(name || 'Anonymous').slice(0, 20).trim(),
        moves: Math.floor(moves),
        difficulty: validDifficulties.includes(difficulty) ? difficulty : validDifficulties[0],
        mode: mode === 'pvp' ? 'pvp' : 'ai',
        gameId: config.gameId,
        timestamp: Date.now(),
      };

      await redis.set(`c:${config.gameId}:${token}`, data, { ex: 60 * 60 * 24 * 30 }); // 30-day TTL

      return NextResponse.json({ token });
    } catch {
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
  }

  async function GET(req: NextRequest) {
    const token = req.nextUrl.searchParams.get('t');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 400 });

    try {
      const data = await redis.get<ChallengeData>(`c:${config.gameId}:${token}`);
      if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json(data);
    } catch {
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
  }

  return { GET, POST };
}
