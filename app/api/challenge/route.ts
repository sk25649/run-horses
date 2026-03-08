import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';

const redis = Redis.fromEnv();

export interface ChallengeData {
  name: string;
  moves: number;
  difficulty: string;
  mode: string;
  timestamp: number;
}

// POST /api/challenge — create a challenge, return a short token
export async function POST(req: NextRequest) {
  try {
    const { name, moves, difficulty, mode } = await req.json();

    if (typeof moves !== 'number' || moves < 1 || moves > 1000) {
      return NextResponse.json({ error: 'Invalid moves' }, { status: 400 });
    }

    const token = Math.random().toString(36).slice(2, 9); // 7-char token
    const data: ChallengeData = {
      name: String(name || 'Anonymous').slice(0, 20).trim(),
      moves: Math.floor(moves),
      difficulty: ['easy', 'medium', 'hard', 'impossible'].includes(difficulty) ? difficulty : 'medium',
      mode: mode === 'pvp' ? 'pvp' : 'ai',
      timestamp: Date.now(),
    };

    await redis.set(`c:${token}`, data, { ex: 60 * 60 * 24 * 30 }); // 30-day TTL

    return NextResponse.json({ token });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// GET /api/challenge?t=TOKEN — retrieve challenge data
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('t');
  if (!token) return NextResponse.json({ error: 'No token' }, { status: 400 });

  try {
    const data = await redis.get<ChallengeData>(`c:${token}`);
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
