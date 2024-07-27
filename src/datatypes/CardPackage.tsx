import { ReactNode } from 'react';

export default interface Card {
  scryfall_id: string;
  title: string;
  date: string;
  userid: string;
  username: string;
  approved: boolean;
  cards: string[];
  votes: number;
  voters: string[];
}