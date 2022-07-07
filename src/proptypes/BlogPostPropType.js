import PropTypes from 'prop-types';
import CardPropType from 'proptypes/CardPropType';

const BlogPostPropType = PropTypes.shape({
  _id: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  owner: PropTypes.string.isRequired,
  date: PropTypes.instanceOf(Date).isRequired,
  cube: PropTypes.string.isRequired,
  html: PropTypes.string,
  markdown: PropTypes.string,
  dev: PropTypes.string.isRequired,
  date_formatted: PropTypes.string.isRequired,
  changelist: PropTypes.string,
  changed_cards: PropTypes.arrayOf(
    PropTypes.shape({
      added: CardPropType,
      removed: CardPropType,
    }),
  ),
  username: PropTypes.string.isRequired,
  cubename: PropTypes.string.isRequired,
});

export default BlogPostPropType;
