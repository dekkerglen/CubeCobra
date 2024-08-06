import User from 'datatypes/User';

interface Image {
  uri: string;
  artist: string;
  id: string;
  imageName: string;
}

interface Article {
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
  image?: Image;
  imageName?: string;
}

export default Article;
