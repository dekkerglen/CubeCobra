import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';

import BlogPost from 'components/BlogPost';

const BlogPostPage = ({ post, userid, loggedIn, position }) => (
  <BlogPost key={post._id} post={post} canEdit={false} userid={userid} loggedIn={loggedIn} focused={position} />
);

BlogPostPage.propTypes = {
  post: PropTypes.shape({
    _id: PropTypes.string.isRequired,
  }).isRequired,
  userid: PropTypes.string.isRequired,
  loggedIn: PropTypes.bool.isRequired,
  position: PropTypes.arrayOf(PropTypes.number).isRequired,
};

const post = JSON.parse(document.getElementById('blogData').value);
const loggedIn = document.getElementById('userid') != null;
const hasPosition = document.getElementById('positionData') != null;
const userid = loggedIn ? document.getElementById('userid').value : '';
const position = hasPosition ? JSON.parse(document.getElementById('positionData').value) : [];
const wrapper = document.getElementById('react-root');
const element = <BlogPostPage post={post} loggedIn={loggedIn} userid={userid} position={position} />;
if (wrapper) {
  ReactDOM.render(element, wrapper);
}
