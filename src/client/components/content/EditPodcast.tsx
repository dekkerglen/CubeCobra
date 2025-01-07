import Input from 'components/base/Input';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Text from 'components/base/Text';
import { CONVERT_STATUS } from 'datatypes/Content';
import PodcastType from 'datatypes/Podcast';
import React from 'react';
import PodcastPreview from './PodcastPreview';

interface EditPodcastProps {
  podcast: PodcastType;
  url: string;
  setUrl: (url: string) => void;
}
const EditPodcast: React.FC<EditPodcastProps> = ({ podcast, url, setUrl }) => {
  return (
    <Flexbox direction="col" gap="2" className="m-2">
      <Row>
        <Col xs={12} md={6} lg={4} xxl={3}>
          <PodcastPreview
            podcast={{
              ...podcast,
            }}
          />
        </Col>
        <Col xs={12} md={6} lg={8} xxl={9}>
          <Flexbox direction="col" gap="2" className="m-2">
            <Text semibold md>
              {`Status: ${CONVERT_STATUS[podcast.status]}`}
            </Text>
            <Input label="RSS Link" maxLength={200} value={url} onChange={(e) => setUrl(e.target.value)} />
          </Flexbox>
        </Col>
      </Row>
    </Flexbox>
  );
};

export default EditPodcast;
