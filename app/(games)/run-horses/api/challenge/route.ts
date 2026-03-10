import { createChallengeHandler } from '@/lib/sharing/challengeHandler';

export const { GET, POST } = createChallengeHandler({
  gameId: 'run-horses',
  validDifficulties: ['easy', 'medium', 'hard', 'impossible'],
});
