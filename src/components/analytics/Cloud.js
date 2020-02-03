import React from 'react';
import { TagCloud } from 'react-tagcloud';
import { Col, Row } from 'reactstrap';
import PropTypes from 'prop-types';

// Data should be:
// {
//   type: 'cloud',
//   description: str,
//   colorOptions: {}, see https://github.com/davidmerfield/randomColor#options
//   words: [
//     {
//       value: str,
//       count: float,
//       key: str, defaults to value
//       color: str, defaults to random
//     }
//   ],
// }
// See https://www.npmjs.com/package/react-tagcloud for more information.
const AnalyticsCloud = ({ data }) => {
  const colorOptions = { luminosity: 'dark' };
  return (
    <Row>
      <Col>
        <TagCloud minSize={10} maxSize={80} colorOptions={colorOptions} tags={data.words} />
      </Col>
    </Row>
  );
};

AnalyticsCloud.propTypes = {
  data: PropTypes.shape({
    words: PropTypes.arrayOf(
      PropTypes.shape({
        value: PropTypes.string.isRequired,
        count: PropTypes.number.isRequired,
        key: PropTypes.string,
        color: PropTypes.string,
      }),
    ).isRequired,
  }).isRequired,
};

export default AnalyticsCloud;
