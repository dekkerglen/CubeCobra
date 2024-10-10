import Image from 'datatypes/Image';
import Content from 'datatypes/Content';

interface Video extends Content {
  image?: Image;
  imageName?: string;
}

export default Video;
