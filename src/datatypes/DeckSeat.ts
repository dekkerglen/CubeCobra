export default interface DeckSeat {
  description?: string;
  deck?: number[][][];
  sideboard: number[][][];
  username?: string;
  userid?: string;
  bot: any[];
  name?: string;
}