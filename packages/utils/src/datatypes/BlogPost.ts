import { Changes } from './Card';
import { BaseObject } from './BaseObject';
import Commentable from './Commentable';
import User from './User';

//Type related directly to DynamoDB
export interface UnhydratedBlogPost extends BaseObject {
  id?: string;
  body?: string | null;
  owner: string;
  date?: number; // Legacy field - this is dateCreated, kept for backwards compatibility
  cube: string;
  title?: string;
  changelist?: string;
}

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
