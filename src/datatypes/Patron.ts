export type UnhydratedPatron = {
  id?: string; //Don't think exists
  email: string;
  user: string; //If this used or is its owner?
  level: number;
  status: string;
  owner: string;
};

//TODO: Add PatronLevel string, add isPatron (level > 1, eg featureQueue)
type Patron = Omit<UnhydratedPatron, 'id'> & {
  id: string;
};

//Numeric enum to map between number sorted in Dynamo and the Patreon integration
//And typescript is magic enough that accessing Levels with number or string works, giving the other!
export enum PatronLevels {
  'Patron' = 0, //Does this mean patorn but not at a pre-defined level?
  'Cobra Hatchling' = 1,
  'Coiling Oracle' = 2,
  'Lotus Cobra' = 3,
}

export enum PatronStatuses {
  ACTIVE = 'a',
  INACTIVE = 'i',
}

export default Patron;
