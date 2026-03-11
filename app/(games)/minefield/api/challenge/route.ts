import { createChallengeHandler } from '@/lib/sharing/challengeHandler';

export const { GET, POST } = createChallengeHandler({
  gameId: 'minefield',
  validDifficulties: ['easy', 'medium', 'hard'],
});
