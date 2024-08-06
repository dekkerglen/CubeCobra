import Card from 'datatypes/Card';
import DraftSeat from 'datatypes/DraftSeat';

export default interface Draft {
  seats: DraftSeat[];
  cards: Card[];
  cube: string;
  initial_state: Array<Array<Record<string, unknown>>>;
  basics: number[];
  id: string;
}
