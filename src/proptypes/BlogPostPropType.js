import PropTypes from 'prop-types';

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
  username: PropTypes.string.isRequired,
  cubename: PropTypes.string.isRequired,
});

export default BlogPostPropType;
