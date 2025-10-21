import React, { useCallback, useContext, useState } from 'react';

import Button from 'components/base/Button';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Spinner from 'components/base/Spinner';
import ArticlePreview from 'components/content/ArticlePreview';
import ContentDeleteModal from 'components/modals/ContentDeleteModal';
import withModal from 'components/WithModal';
import { CSRFContext } from 'contexts/CSRFContext';
import Article from 'datatypes/Article';
import { ContentStatus, ContentType } from 'datatypes/Content';

const DeleteModalButton = withModal(Button, ContentDeleteModal);

interface CreatorArticlesProps {
  articles: Article[];
  lastKey: any; // Adjust the type as needed
}

const CreatorArticles: React.FC<CreatorArticlesProps> = ({ articles, lastKey }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const [items, setItems] = useState<Article[]>(articles);
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
        <Button color="primary" href="/content/newarticle" type="link">
          Create New Article
        </Button>
      </Flexbox>
      <Row>
        {items.map((article) => (
          <Col key={article.id} xs={6} sm={4} md={3} lg={2}>
            <Flexbox direction="col" gap="1">
              <ArticlePreview article={article} showStatus />
              {article.status !== ContentStatus.PUBLISHED && (
                <DeleteModalButton
                  color="danger"
                  outline
                  block
                  modalprops={{ content: article, onDelete: handleDelete }}
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

export default CreatorArticles;
