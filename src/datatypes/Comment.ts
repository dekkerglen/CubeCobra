import { createTypeGuard } from '../util/typeGuards';
import { CubeImage } from './Cube';
import User from './User';

export type UnhydratedComment = {
  id?: string;
  parent: string;
  type: string;
  owner?: string;
  body: string;
  date: number;
};

type Comment = Omit<UnhydratedComment, 'id' | 'owner'> & {
  id: string;
  owner: User;
  image?: CubeImage;
};

const allCommentTypes = [
  'comment',
  'blog',
  'deck',
  'card',
  'article',
  'podcast',
  'video',
  'episode',
  'package',
] as const;

export type CommentType = (typeof allCommentTypes)[number];
export type NotifiableCommentType = Exclude<CommentType, 'card'>;

export const isCommentType = createTypeGuard<CommentType>(allCommentTypes);

const notifiableTypes = allCommentTypes.filter((type) => type !== 'card') as NotifiableCommentType[];

export const isNotifiableCommentType = createTypeGuard<NotifiableCommentType>(notifiableTypes);

export default Comment;
