import Content from 'datatypes/Content';

interface Podcast extends Content {
  image?: string;
  title: string;
  url: string;
}

export default Podcast;
