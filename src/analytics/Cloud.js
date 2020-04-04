import React from 'react';
import { TagCloud } from 'react-tagcloud';
import { Col } from 'reactstrap';
import PropTypes from 'prop-types';

const Cloud = ({ cards }) => {
  const tags = {};
  cards.forEach((card) =>
    card.tags.forEach((tag) => {
      if (tags[tag]) {
        tags[tag] += card.asfan;
      } else {
        tags[tag] = card.asfan;
      }
    }),
  );
  const words = Object.keys(tags).map((key) => ({ value: key, count: tags[key] }));

  const colorOptions = { luminosity: 'dark' };
  return (
    <>
      <h4>Tag Cloud</h4>
      <p>
        Tags in your cube with random colors weighted by the expected number of cards with that tag a player will open
        on average.
      </p>
      <TagCloud minSize={10} maxSize={80} colorOptions={colorOptions} tags={words} />
    </>
  );
};
Cloud.propTypes = {
  cards: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
};

export default Cloud;
