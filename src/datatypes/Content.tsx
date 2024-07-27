export default interface Content {
  id: string;
  date: number;
  status: string;
  owner: string;
  type: string;
  typeStatusComp: string;
  typeOwnerComp: string;
  title?: string;
  body?: string;
  short?: string;
  url?: string;
  image?: string;
  imageName?: string;
  username?: string;
  podcastName?: string;
  podcast?: string;
  podcastGuid?: string;
  podcastLink?: string;
}