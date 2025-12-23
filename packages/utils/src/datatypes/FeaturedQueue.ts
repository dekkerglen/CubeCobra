import { BaseObject } from './BaseObject';

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

export interface FeaturedQueueItem extends BaseObject {
  cube: string; //Cube ID
  date: number;
  owner: string; //User id
  featuredOn: number | null; //Null indicates not yet featured
  status: FeaturedQueueStatus;
}
