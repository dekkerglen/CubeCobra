import { BaseObject } from './BaseObject';

export type UnhydratedPasswordReset = BaseObject & {
  id?: string;
  owner: string;
  date: number;
  /**
   * The owner's sessionVersion when the link was issued. Any later password or email change
   * bumps the user's version, which retires every link issued before it.
   */
  sessionVersion?: number;
};

type PasswordReset = Omit<UnhydratedPasswordReset, 'id'> & {
  id: string;
};

export default PasswordReset;
