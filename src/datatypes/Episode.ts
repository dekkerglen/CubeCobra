import Content from 'datatypes/Content';

interface Episode extends Content {
  podcastName: string;
  image?: string;
  imageName?: string;
}

export default Episode;
