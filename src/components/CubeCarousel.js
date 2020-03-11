import React from 'react';
import CubePreview from 'components/CubePreview';
import InfiniteCarousel from 'react-leaf-carousel';
import PropTypes from 'prop-types';

const CubeCarousel = ({ cubes }) => {
  return (
    <InfiniteCarousel
      breakpoints={[
        {
          breakpoint: 500,
          settings: {
            slidesToShow: 1,
            slidesToScroll: 1,
          },
        },
        {
          breakpoint: 768,
          settings: {
            slidesToShow: 3,
            slidesToScroll: 3,
          },
        },
      ]}
      showSides
      sidesOpacity={1}
      sideSize={0.4}
      slidesToScroll={4}
      slidesToShow={4}
      slidesSpacing={0}
    >
      {cubes.map((cube) => (
        <CubePreview key={cube._id} cube={cube} />
      ))}
    </InfiniteCarousel>
  );
};

CubeCarousel.propTypes = {
  cubes: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
      shortId: PropTypes.string,
      urlAlias: PropTypes.string,
      name: PropTypes.string.isRequired,
      card_count: PropTypes.number.isRequired,
      type: PropTypes.string.isRequired,
      overrideCategory: PropTypes.bool,
      categoryOverride: PropTypes.string,
      categoryPrefixes: PropTypes.arrayOf(PropTypes.string),
      image_name: PropTypes.string.isRequired,
      image_artist: PropTypes.string.isRequired,
      image_uri: PropTypes.string.isRequired,
      owner: PropTypes.string.isRequired,
      owner_name: PropTypes.string.isRequired,
    }),
  ).isRequired,
};

export default CubeCarousel;
