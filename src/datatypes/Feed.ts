import BlogPost from './BlogPost';

export enum FeedTypes {
  BLOG = 'b',
}

export type UnhydratedFeed = {
  id: string; //The feed is === BlogPost id
  to: string;
  date: number;
  type: FeedTypes;
};

export type Feed = {
  type: FeedTypes;
  document: BlogPost;
};
