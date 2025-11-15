export type UnhydratedPasswordReset = {
  id?: string;
  owner: string;
  date: number;
};

type PasswordReset = Omit<UnhydratedPasswordReset, 'id'> & {
  id: string;
};

export default PasswordReset;
