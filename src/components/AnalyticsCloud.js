import { TagCloud } from 'react-tagcloud';
import { Col, Row } from 'reactstrap';

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
const AnalyticsCloud = ({ data, title }) => {
  const colorOptions = { luminosity: 'dark' };
  return (
    <Row>
      <Col>
        <TagCloud minSize={10} maxSize={80} colorOptions={colorOptions} tags={data['words']} />
      </Col>
    </Row>
  );
};

export default AnalyticsCloud;
