import { CardDetails } from './Card';
import User from './User';

export enum CardPackageStatus {
  APPROVED = 'a',
  SUBMITTED = 's',
}

export type UnhydratedCardPackage = {
  id?: string;
  title: string;
  date: number;
  owner: string;
  status: CardPackageStatus;
  cards: string[]; //List of card ids
  keywords: string[];
  voters: string[]; //List of user ids
  votecount: number;
};

type CardPackage = Omit<UnhydratedCardPackage, 'id' | 'owner' | 'cards'> & {
  id: string;
  owner: User;
  cards: CardDetails[];
};

export default CardPackage;
