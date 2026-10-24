export type UnhydratedPatron = {
  email: string;
  level: number;
  status: string;
  owner: string;
  /** Patreon's id for the linked Patreon user. Unlike the email, it never changes. Absent on records linked before it was stored. */
  patreonUserId?: string;
  dateCreated: number;
  dateLastUpdated: number;
};

//TODO: Patron is not hydrated, but we could add PatronLevel string and more
type Patron = UnhydratedPatron;

//Numeric enum to map between number sorted in Dynamo and the Patreon integration
//And typescript is magic enough that accessing Levels with number or string works, giving the other!
export enum PatronLevels {
  Patron = 0, //Does this mean patorn but not at a pre-defined level?
  'Cobra Hatchling' = 1,
  'Coiling Oracle' = 2,
  'Lotus Cobra' = 3,
}

export enum PatronStatuses {
  ACTIVE = 'a',
  INACTIVE = 'i',
}

export default Patron;
