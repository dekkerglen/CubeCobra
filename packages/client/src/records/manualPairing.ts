import { Match } from '@utils/datatypes/Record';
import { BYE } from '@utils/records/pairings';

// Editing a round by hand on the table. Each change takes the players it touches out of
// whatever match they were in, so nobody is ever paired twice; their old opponents are left
// unpaired for the organiser to place.

const without = (matches: Match[], names: string[]): Match[] =>
  matches.filter((match) => !names.includes(match.p1) && !names.includes(match.p2));

export const pairTogether = (matches: Match[], a: string, b: string): Match[] => [
  ...without(matches, [a, b]),
  { p1: a, p2: b, results: [0, 0, 0] },
];

// A bye is a 2-0 win, the same as the pairings give one.
export const giveBye = (matches: Match[], player: string): Match[] => [
  ...without(matches, [player]),
  { p1: player, p2: BYE, results: [2, 0, 0] },
];

export const unpair = (matches: Match[], player: string): Match[] => without(matches, [player]);

export const isPaired = (matches: Match[], player: string): boolean =>
  matches.some((match) => match.p1 === player || match.p2 === player);
