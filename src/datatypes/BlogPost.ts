import { Changes } from './Card';
import Commentable from './Commentable';
import User from './User';

//Type related directly to DynamoDB
export type UnhydratedBlogPost = {
  id?: string;
  body?: string | null;
  owner: string;
  date?: number;
  cube: string;
  title?: string;
  changelist?: string;
};

/* "extend" the UnhydratedBlogPost with replacements for properties, such as where the prop is always present or
 * by Hydrating it is no longer a simple type
 */
type BlogPost = Commentable &
  Omit<UnhydratedBlogPost, 'id' | 'owner' | 'body' | 'date' | 'changelist'> & {
    id: string;
    body: string | null;
    owner: User;
    date: number;
    cubeName: string;
    Changelog?: Partial<Changes>;
  };

export default BlogPost;
