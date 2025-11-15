import { createTypeGuard } from '../typeGuards';

export const ManaSymbols = ['W', 'U', 'B', 'R', 'G', 'C'] as const;
export type ManaSymbol = (typeof ManaSymbols)[number];
export const isManaSymbol = createTypeGuard<ManaSymbol>(ManaSymbols);

export const HybridManaSymbols = [
  'W-U',
  'U-B',
  'B-R',
  'R-G',
  'G-W',
  'W-B',
  'U-R',
  'B-G',
  'R-W',
  'G-U',
  'C-W',
  'C-U',
  'C-B',
  'C-R',
  'C-G',
] as const;
export type HybridManaSymbol = (typeof HybridManaSymbols)[number];
export const isHybridManaSymbol = createTypeGuard<HybridManaSymbol>(HybridManaSymbols);

export type GenericHybridManaSymbol = `${number}-${ManaSymbol}`;
export const isGenericHybridManaSymbol = (value: unknown): value is GenericHybridManaSymbol => {
  if (typeof value !== 'string') return false;
  return /^[0-9]+-[WUBRGC]$/.test(value);
};

export const PhyrexianManaSymbols = [
  'W-P',
  'U-P',
  'B-P',
  'R-P',
  'G-P',
  'C-P',
  'G-W-P',
  'R-G-P',
  'R-W-P',
  'G-U-P',
] as const;
export type PhyrexianManaSymbol = (typeof PhyrexianManaSymbols)[number];
export const isPhyrexianManaSymbol = createTypeGuard<PhyrexianManaSymbol>(PhyrexianManaSymbols);
