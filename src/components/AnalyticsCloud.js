import { TagCloud } from 'react-tagcloud';
import { Col, Row } from 'reactstrap';

const AnalyticsCloud = ({ data, title }) => {
  const colorOptions = { luminosity: 'dark' };
  return (
    <>
      <Row>
        <Col>
          <h4 className="d-lg-block d-none">{title}</h4>
        </Col>
      </Row>
      <Row>
        <Col>
          <TagCloud minSize={10} maxSize={80} colorOptions={colorOptions} tags={data['words']} />
        </Col>
      </Row>
    </>
  );
};

export default AnalyticsCloud;
