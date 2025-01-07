import Image from './Image';
import Content from './Content';

interface Article extends Content {
  image?: Image;
  imageName?: string;
}

export default Article;
