import React, { useCallback, useState } from 'react';

import PodcastPreview from 'components/content/PodcastPreview';
import { csrfFetch } from 'utils/CSRF';
import Spinner from 'components/base/Spinner';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Podcast from 'datatypes/Podcast';
import Button from 'components/base/Button';

interface CreatorPodcastsProps {
  podcasts: Podcast[];
  lastKey: any; // Adjust the type as needed
}

const CreatorPodcasts: React.FC<CreatorPodcastsProps> = ({ podcasts, lastKey }) => {
  const [items, setItems] = useState<Podcast[]>(podcasts);
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
        type: 'a',
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
  }, [items, currentLastKey]);

  const loader = (
    <div className="centered py-3 my-4">
      <Spinner className="position-absolute" />
    </div>
  );

  return (
    <Flexbox direction="col" gap="2" className="mb-2">
      <Flexbox direction="row" justify="between">
        <Button color="primary" href="/content/newpodcast" type="link">
          Create New Podcast
        </Button>
      </Flexbox>
      <Row className="mx-0">
        {items.map((podcast) => (
          <Col key={podcast.id} xs={6} sm={4} md={3} lg={2}>
            <PodcastPreview podcast={podcast} />
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

export default CreatorPodcasts;
