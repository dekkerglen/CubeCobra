import User from './User';

export enum ContentType {
  VIDEO = 'v',
  ARTICLE = 'a',
  EPISODE = 'e',
  PODCAST = 'p',
}

export enum ContentStatus {
  IN_REVIEW = 'r',
  DRAFT = 'd',
  PUBLISHED = 'p',
}

export const ContentStatusEnglish = {
  [ContentStatus.DRAFT]: 'Draft',
  [ContentStatus.IN_REVIEW]: 'In Review',
  [ContentStatus.PUBLISHED]: 'Published',
};
export interface UnhydratedContent {
  id: string;
  type: string;
  typeStatusComp: string;
  typeOwnerComp: string;
  date: number;
  status: ContentStatus;
  owner: string;
  title?: string;
  body?: string;
  short?: string;
  url?: string;
  username?: string;
  imageName?: string;
}

export interface Content extends Omit<UnhydratedContent, 'owner' | 'image'> {
  owner: User;
}

export default Content;
