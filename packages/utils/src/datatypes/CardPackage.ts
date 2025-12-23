import { BaseObject } from './BaseObject';
import { CardDetails } from './Card';
import User from './User';

export type UnhydratedCardPackage = BaseObject & {
  id?: string;
  title: string;
  date: number;
  owner: string;
  cards: string[]; //List of card ids
  keywords: string[];
  voters: string[]; //List of user ids
  voteCount: number;
};

type CardPackage = Omit<UnhydratedCardPackage, 'id' | 'owner' | 'cards'> & {
  id: string;
  owner: User;
  cards: CardDetails[];
};

export default CardPackage;
