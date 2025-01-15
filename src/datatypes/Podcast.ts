import Content from './Content';

interface Podcast extends Content {
  image?: string;
  title: string;
  url: string;
  description: string;
}

export default Podcast;
