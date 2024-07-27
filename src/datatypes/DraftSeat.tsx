export default interface DraftSeat {
  description?: string;
  deck?: number[][][];
  sideboard: number[][][];
  username?: string;
  userid?: string;
  bot?: boolean;
  name?: string;
}