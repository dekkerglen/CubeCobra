import User from './User';

export default interface DraftSeat {
  description?: string;
  mainboard: number[][][];
  sideboard: number[][][];
  pickorder?: number[];
  trashorder?: number[];
  // null in case of a bot
  owner?: string | User;
  bot?: boolean;
  name?: string;
  // Display name for external players (e.g. from Draftmancer) who don't have a CubeCobra account
  playerName?: string;
  // grid draft only
  pickedIndices?: number[];
}
