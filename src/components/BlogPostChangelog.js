import React from 'react';
import PropTypes from 'prop-types';
import CardPropType from 'proptypes/CardPropType';
import withAutocard from 'components/WithAutocard';

const CardHtml = withAutocard('a');

const BlogPostChangelog = ({ cards }) => (
  <>
    {cards.map(({ added, removed }) => {
      let className = 'badge ';
      let symbol;
      if (added && removed) {
        symbol = '→';
        className += 'badge-primary';
      } else if (added) {
        symbol = '+';
        className += 'badge-success';
      } else if (removed) {
        symbol = '-';
        className += 'badge-danger';
      }

      return (
        <>
          <span className={className} style={{ fontFamily: "'Lucida Console', 'Monaco', 'monospace'" }}>
            {symbol}
          </span>{' '}
          {added && <CardHtml card={added} />}
          {added && removed && '>'}
          {removed && <CardHtml card={removed} />}
          <br />
        </>
      );
    })}
  </>
);

BlogPostChangelog.propTypes = {
  cards: PropTypes.arrayOf(
    PropTypes.shape({
      added: CardPropType,
      removed: CardPropType,
    }),
  ).isRequired,
};

export default BlogPostChangelog;
