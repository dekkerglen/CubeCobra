import User from './User';

export default interface DeckSeat {
  description?: string;
  mainboard: number[][][];
  sideboard: number[][][];
  pickorder: number[];
  bot: any[];
  name?: string;
  owner: string | User;
}
