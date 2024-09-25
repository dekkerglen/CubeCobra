import CardDetails from 'datatypes/CardDetails';

export const APPROVED = 'a' as const;
export const SUBMITTED = 's' as const;

export default interface CardPackage {
  id: string;
  title: string;
  date: string;
  owner: string;
  status: 'a' | 's';
  cards: CardDetails[];
  voters: string[];
  keywords: string[];
  voteCount: number;
}
