import React from 'react';
import PropTypes from 'prop-types';

import MagicMarkdown from 'components/MagicMarkdown';
import CommentsSection from 'components/CommentsSection';
import TimeAgo from 'react-timeago';

import { Row, Card, CardBody, CardHeader } from 'reactstrap';

const Article = ({ article, userid }) => {
  const markdownStr = article.body.toString();
  const split = markdownStr.split(/(<<.+>>|(?:> .{0,}\r?\n)+)/gm);

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
        {split.map((section) => {
          if (section.startsWith('<<')) {
            const sub = section.substring(2, section.length - 2);
            return (
              <Row>
                <MagicMarkdown section={sub} />
              </Row>
            );
          }
          if (section.startsWith('> ')) {
            console.log(section);
            const lines = section.split(/(> .+\r?\n)/gm).filter((line) => line.length > 0);
            console.log(lines);
            return (
              <Card className="bg-light">
                <CardBody>
                  {lines.map((line) => (
                    <MagicMarkdown markdown={line.substring(2)} />
                  ))}
                </CardBody>
              </Card>
            );
          }
          return <MagicMarkdown markdown={section} />;
        })}
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
