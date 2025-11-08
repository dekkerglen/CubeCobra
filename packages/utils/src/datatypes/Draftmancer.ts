export interface Pick {
  booster: string[]; // oracle id
  picks: number[]; // Indices into booster
  burn: number[];
}

export interface Decklist {
  main: string[]; // oracle id
  side: string[]; // oracle id
  lands: {
    W: number;
    U: number;
    B: number;
    R: number;
    G: number;
  };
}

export interface Player {
  userName: string;
  isBot: boolean;
  picks: Pick[];
  decklist: Decklist;
}

export interface PublishDraftBody {
  cubeID: string;
  sessionID: string;
  timestamp: number;
  players: Player[];
  apiKey: string;
}
