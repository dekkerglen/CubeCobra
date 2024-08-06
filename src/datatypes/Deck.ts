import DeckSeat from 'datatypes/DeckSeat';

export default interface Deck {
  id?: string;
  cube?: string;
  owner?: string;
  cubeOwner?: string;
  seats?: DeckSeat[];
  date?: Date;
  comments?: object[];
  basics: number[];
}
