export default interface DraftSeat {
  description?: string;
  mainboard: number[][][];
  sideboard: number[][][];
  pickorder?: number[];
  trashorder?: number[];
  username?: string;
  userid?: string;
  bot?: boolean;
  name?: string;
}
