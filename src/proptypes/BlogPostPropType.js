import PropTypes from 'prop-types';

const BlogPostPropType = PropTypes.shape({
  id: PropTypes.string.isRequired,
  body: PropTypes.string.isRequired,
  owner: PropTypes.string.isRequired,
  date: PropTypes.number.isRequired,
  title: PropTypes.string,
  cube: PropTypes.string.isRequired,
  changelist: PropTypes.string,
});

export default BlogPostPropType;
