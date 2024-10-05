import User from 'datatypes/User';

interface Episode {
  id: string;
  date: number;
  status: string;
  username?: string;
  owner: User;
  type: string;
  typeStatusComp: string;
  typeOwnerComp: string;
  title?: string;
  body?: string;
  short?: string;
  url?: string;
  image: string;
  imageName?: string;
  podcastName: string;
}

export default Episode;
