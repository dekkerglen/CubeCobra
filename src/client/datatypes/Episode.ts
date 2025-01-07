import Content from './Content';

interface Episode extends Content {
  podcastName: string;
  image?: string;
  imageName?: string;
  podcast: string;
}

export default Episode;
