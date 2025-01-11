import Image from './Image';
import Content from './Content';

interface Video extends Content {
  image?: Image;
  imageName?: string;
  url: string;
}

export default Video;
