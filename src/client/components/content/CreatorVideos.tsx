import React, { useCallback, useContext, useState } from 'react';

import Button from 'components/base/Button';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Spinner from 'components/base/Spinner';
import VideoPreview from 'components/content/VideoPreview';
import { CSRFContext } from 'contexts/CSRFContext';
import { ContentType } from 'datatypes/Content';
import Video from 'datatypes/Video';

interface CreatorVideosProps {
  videos: Video[];
  lastKey: any; // Adjust the type as needed
}

const CreatorVideos: React.FC<CreatorVideosProps> = ({ videos, lastKey }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const [items, setItems] = useState<Video[]>(videos);
  const [currentLastKey, setLastKey] = useState<any>(lastKey);
  const [loading, setLoading] = useState(false);

  const fetchMoreData = useCallback(async () => {
    setLoading(true);

    const response = await csrfFetch(`/content/getcreatorcontent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lastKey: currentLastKey,
        //TODO: Video?
        type: ContentType.ARTICLE,
      }),
    });

    if (response.ok) {
      const json = await response.json();
      if (json.success === 'true') {
        setItems([...items, ...json.content]);
        setLastKey(json.lastKey);
        setLoading(false);
      }
    }
  }, [csrfFetch, currentLastKey, items]);

  const loader = (
    <div className="centered py-3 my-4">
      <Spinner className="position-absolute" />
    </div>
  );

  return (
    <Flexbox direction="col" gap="2" className="mb-2">
      <Flexbox direction="row" justify="between">
        <Button color="primary" href="/content/newvideo" type="link">
          Create New Video
        </Button>
      </Flexbox>
      <Row className="mx-0">
        {items.map((video) => (
          <Col key={video.id} xs={6} sm={4} md={3} lg={2}>
            <VideoPreview video={video} />
          </Col>
        ))}
      </Row>
      {currentLastKey && !loading && (
        <Button outline color="primary" onClick={fetchMoreData} block>
          Load More
        </Button>
      )}
      {loading && loader}
    </Flexbox>
  );
};

export default CreatorVideos;
