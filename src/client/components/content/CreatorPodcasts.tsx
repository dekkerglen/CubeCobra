import React, { useCallback, useContext, useState } from 'react';

import Button from 'components/base/Button';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Spinner from 'components/base/Spinner';
import PodcastPreview from 'components/content/PodcastPreview';
import ContentDeleteModal from 'components/modals/ContentDeleteModal';
import withModal from 'components/WithModal';
import { CSRFContext } from 'contexts/CSRFContext';
import { ContentStatus, ContentType } from 'datatypes/Content';
import Podcast from 'datatypes/Podcast';

const DeleteModalButton = withModal(Button, ContentDeleteModal);

interface CreatorPodcastsProps {
  podcasts: Podcast[];
  lastKey: any; // Adjust the type as needed
}

const CreatorPodcasts: React.FC<CreatorPodcastsProps> = ({ podcasts, lastKey }) => {
  const { csrfFetch } = useContext(CSRFContext);
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
        type: ContentType.PODCAST,
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

  const handleDelete = useCallback(
    (id: string) => {
      setItems(items.filter((item) => item.id !== id));
    },
    [items],
  );

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
            <Flexbox direction="col" gap="1">
              <PodcastPreview podcast={podcast} />
              {podcast.status !== ContentStatus.PUBLISHED && (
                <DeleteModalButton
                  color="danger"
                  outline
                  block
                  modalprops={{ content: podcast, onDelete: handleDelete }}
                >
                  Delete
                </DeleteModalButton>
              )}
            </Flexbox>
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
