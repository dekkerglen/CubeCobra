import React from 'react';
import PropTypes from 'prop-types';

import Markdown from 'components/Markdown';
import CommentsSection from 'components/CommentsSection';
import TimeAgo from 'react-timeago';

import { CardBody, CardHeader } from 'reactstrap';

const Article = ({ article, userid }) => {
  return (
    <>
      <CardHeader>
        <h1>{article.title}</h1>
        <h6>
          By <a href={`/user/view/${article.owner}`}>{article.username}</a>
          {' | '}
          <TimeAgo date={article.date} />
        </h6>
      </CardHeader>
      <CardBody>
        <Markdown markdown={article.body} />
      </CardBody>
      <div className="border-top">
        <CommentsSection parentType="article" parent={article._id} userid={userid} collapse={false} />
      </div>
    </>
  );
};
Article.propTypes = {
  article: PropTypes.shape({
    title: PropTypes.string.isRequired,
    body: PropTypes.string.isRequired,
    _id: PropTypes.string.isRequired,
    date: PropTypes.string.isRequired,
    owner: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
  }).isRequired,
  userid: PropTypes.string,
};

Article.defaultProps = {
  userid: null,
};

export default Article;
