import DeckSeat from 'datatypes/DeckSeat';
import User from './User';
import Card from './Card';

export default interface Deck {
  id: string;
  cube: string;
  owner: string | User;
  cubeOwner?: string;
  seats: DeckSeat[];
  date: Date;
  comments?: object[];
  basics: number[];
  name?: string;
  cards: Card[];
  type: string;
}
