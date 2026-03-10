// Shared game type interfaces that all games must satisfy

export interface GameDefinition {
  id: string;
  name: string;
  description: string;
  tagline: string;
  tvShow: string;
  emoji: string;
  thumbnail: string;
  maxPlayers: number;
  modes: ('pvp' | 'ai' | 'online')[];
  subdomain: string;
  themeColor: string;
  accentColor: string;
}
