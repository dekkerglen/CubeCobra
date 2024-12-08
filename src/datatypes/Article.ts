import Image from 'datatypes/Image';
import Content from 'datatypes/Content';

interface Article extends Content {
  image?: Image;
  imageName?: string;
}

export default Article;
