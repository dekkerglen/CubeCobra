import Content from './Content';
import Image from './Image';

interface Article extends Content {
  image?: Image;
  imageName?: string;
}

export default Article;
