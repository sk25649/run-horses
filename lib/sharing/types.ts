export interface ChallengeData {
  name: string;
  moves: number;
  difficulty: string;
  mode: string;
  gameId: string;
  timestamp: number;
}

export interface ShareContext {
  gameId: string;
  gameName: string;
  title: string;
  text: string;
  url: string;
}
