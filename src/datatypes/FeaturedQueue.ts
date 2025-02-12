export enum FeaturedQueueStatus {
  ACTIVE = 'a',
  INACTIVE = 'i',
}

export type NewFeaturedQueueItem = {
  cube: string; //Cube ID
  date: number;
  owner: string; //User id
  featuredOn: number | null; //Null indicates not yet featured
};

export type FeaturedQueueItem = NewFeaturedQueueItem & {
  status: FeaturedQueueStatus;
};
