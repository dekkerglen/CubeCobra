import Content from './Content';

interface Episode extends Content {
  podcastName: string;
  image?: string;
  imageName?: string;
  podcast: string;
  podcastGuid: string;
}

export default Episode;
