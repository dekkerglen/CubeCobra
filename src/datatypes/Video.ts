import Content from './Content';
import Image from './Image';

interface Video extends Content {
  image?: Image;
  imageName?: string;
  url: string;
}

export default Video;
