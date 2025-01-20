import { CubeImage } from './Cube';
import User from './User';

export default interface Comment {
  id: string;
  parent: string;
  type: string;
  owner?: User;
  body: string;
  date: number;
  image?: CubeImage;
}

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

const createTypeGuard = <T extends string>(validValues: readonly T[]) => {
  return (value: unknown): value is T => validValues.includes(value as T);
};

export const isCommentType = createTypeGuard<CommentType>(allCommentTypes);

const notifiableTypes = allCommentTypes.filter((type) => type !== 'card') as NotifiableCommentType[];

export const isNotifiableCommentType = createTypeGuard<NotifiableCommentType>(notifiableTypes);
