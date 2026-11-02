import { createTypeGuard } from '../typeGuards';
import { BaseObject } from './BaseObject';
import { CubeImage } from './Cube';
import User from './User';

export interface UnhydratedComment extends BaseObject {
  id?: string;
  parent: string;
  type: string;
  owner?: string;
  body: string;
  date: number; // Legacy field - this is dateCreated, kept for backwards compatibility
}

type Comment = Omit<UnhydratedComment, 'id' | 'owner'> & {
  id: string;
  owner?: User;
  image?: CubeImage;
};

/**
 * Upper bound on the reply count returned with a comment. The UI only distinguishes none, an
 * exact number up to ten, and "more than ten" — so the count query stops here rather than
 * scanning a whole reply partition to produce a number nothing displays.
 */
export const REPLY_COUNT_CAP = 11;

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
  'record',
  'p1p1',
] as const;

export type CommentType = (typeof allCommentTypes)[number];
export type NotifiableCommentType = Exclude<CommentType, 'card' | 'p1p1'>;

export const isCommentType = createTypeGuard<CommentType>(allCommentTypes);

const notifiableTypes = allCommentTypes.filter((type) => type !== 'card' && type !== 'p1p1') as NotifiableCommentType[];

export const isNotifiableCommentType = createTypeGuard<NotifiableCommentType>(notifiableTypes);

export default Comment;
