import React from 'react';
import PropTypes from 'prop-types';

import MagicMarkdown from 'components/MagicMarkdown';
import CommentsSection from 'components/CommentsSection';
import TimeAgo from 'react-timeago';

import { Row, Card, CardBody, CardHeader } from 'reactstrap';

const Article = ({ article, userid }) => {
  const markdownStr = article.body.toString();
  const split = markdownStr.split(/(<<.+>>|#{1,6} .+\r?\n|(?:1\. .+\r?\n)+|(?:- .+\r?\n)+|(?:> .{0,}\r?\n)+)/gm);

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
        {split.map((markdown) => {
          if (markdown.startsWith('1. ')) {
            const lines = markdown.split(/(1\. .+\r?\n)/gm).filter((line) => line.length > 0);
            return (
              <ol>
                {lines.map((line) => (
                  <li>
                    <MagicMarkdown markdown={line.substring(3)} />
                  </li>
                ))}
              </ol>
            );
          }
          if (markdown.startsWith('- ')) {
            const lines = markdown.split(/(- .+\r?\n)/gm).filter((line) => line.length > 0);
            return (
              <ul>
                {lines.map((line) => (
                  <li>
                    <MagicMarkdown markdown={line.substring(2)} />
                  </li>
                ))}
              </ul>
            );
          }
          if (markdown.startsWith('> ')) {
            console.log(markdown);
            const lines = markdown.split(/(> .+\r?\n)/gm).filter((line) => line.length > 0);
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
          if (markdown.startsWith('# ')) {
            return <h1>{markdown.substring(2)}</h1>;
          }
          if (markdown.startsWith('## ')) {
            return <h2>{markdown.substring(3)}</h2>;
          }
          if (markdown.startsWith('### ')) {
            return <h3>{markdown.substring(4)}</h3>;
          }
          if (markdown.startsWith('#### ')) {
            return <h4>{markdown.substring(5)}</h4>;
          }
          if (markdown.startsWith('##### ')) {
            return <h5>{markdown.substring(6)}</h5>;
          }
          if (markdown.startsWith('###### ')) {
            return <h6>{markdown.substring(7)}</h6>;
          }
          if (markdown.startsWith('<<')) {
            const sub = markdown.substring(2, markdown.length - 2);
            return (
              <Row>
                <MagicMarkdown markdown={sub} />
              </Row>
            );
          }
          return <MagicMarkdown markdown={markdown} />;
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
