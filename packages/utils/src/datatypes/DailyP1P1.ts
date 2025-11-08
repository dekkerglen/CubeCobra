export interface DailyP1P1 {
  id: string;
  type: string; // Constant 'HISTORY' for GSI querying
  packId: string;
  cubeId: string;
  date: number; // Date when this became daily P1P1
  isActive: boolean; // Whether this is currently the active daily P1P1
}

export type NewDailyP1P1 = Omit<DailyP1P1, 'id' | 'type'>;