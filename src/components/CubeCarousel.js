import React from 'react';
import CubePreview from 'components/CubePreview';
import InfiniteCarousel from 'react-leaf-carousel';

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

export default CubeCarousel;
