import React, { useCallback, useContext, useState } from 'react';

import Cube from '@utils/datatypes/Cube';
import User from '@utils/datatypes/User';

import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Pagination from 'components/base/Pagination';
import Text from 'components/base/Text';
import CubePreview from 'components/cube/CubePreview';
import DynamicFlash from 'components/DynamicFlash';
import { SafeMarkdown } from 'components/Markdown';
import MtgImage from 'components/MtgImage';
import RenderToRoot from 'components/RenderToRoot';
import { CSRFContext } from 'contexts/CSRFContext';
import UserContext from 'contexts/UserContext';
import MainLayout from 'layouts/MainLayout';
import UserLayout from 'layouts/UserLayout';

interface UserCubePageProps {
  owner: User;
  followersCount: number;
  following: boolean;
  cubes: Cube[];
  lastKey?: any;
}

const PAGE_SIZE = 36;

const UserCubePage: React.FC<UserCubePageProps> = ({
  owner,
  followersCount,
  following,
  cubes: initialCubes,
  lastKey: initialLastKey,
}) => {
  const user = useContext(UserContext);
  const { csrfFetch } = useContext(CSRFContext);
  const [items, setItems] = useState<Cube[]>(initialCubes);
  const [currentLastKey, setLastKey] = useState(initialLastKey);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);

  const pageCount = Math.ceil(items.length / PAGE_SIZE);
  const hasMore = !!currentLastKey;

  const fetchMoreData = useCallback(async () => {
    setLoading(true);

    const response = await csrfFetch(`/user/getmorecubes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        owner: owner.id,
        lastKey: currentLastKey,
      }),
    });

    if (response.ok) {
      const json = await response.json();
      if (json.success === 'true') {
        setItems([...items, ...json.cubes]);
        setPage(page + 1);
        setLastKey(json.lastKey);
      }

      setLoading(false);
    }
  }, [csrfFetch, owner.id, currentLastKey, items, page]);
  return (
    <MainLayout>
      <UserLayout user={owner} followersCount={followersCount} following={following} activeLink="view">
        <DynamicFlash />
        <Flexbox direction="col" className="my-3" gap="2">
          <Card>
            <CardHeader>
              <Text semibold lg>
                About
              </Text>
            </CardHeader>
            <CardBody>
              <Row className="mb-3">
                {owner.image && (
                  <Col xs={4} lg={3}>
                    <MtgImage image={owner.image} showArtist />
                  </Col>
                )}
                <Col xs={owner.image ? 8 : 12} lg={owner.image ? 9 : 12}>
                  <SafeMarkdown markdown={owner.about || '_This user has not yet filled out their about section._'} />
                </Col>
              </Row>
              {user && user.id === owner.id && (
                <Button type="link" color="accent" block href="/user/account">
                  Update
                </Button>
              )}
            </CardBody>
          </Card>
          {items.length > 0 && (
            <Flexbox direction="row" justify="between" alignItems="center" className="w-full">
              <Text lg semibold>
                Cubes ({items.length}
                {hasMore ? '+' : ''})
              </Text>
              <Pagination
                count={pageCount}
                active={page}
                hasMore={hasMore}
                onClick={async (newPage) => {
                  if (newPage >= pageCount) {
                    await fetchMoreData();
                  } else {
                    setPage(newPage);
                  }
                }}
                loading={loading}
              />
            </Flexbox>
          )}
          <Row>
            {items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((cube) => (
              <Col key={cube.id} className="mt-3" xs={6} sm={4} md={3} xl={2}>
                <CubePreview cube={cube} />
              </Col>
            ))}
          </Row>
          {items.length > 0 && (
            <Flexbox direction="row" justify="end" alignItems="center" className="w-full mt-3">
              <Pagination
                count={pageCount}
                active={page}
                hasMore={hasMore}
                onClick={async (newPage) => {
                  if (newPage >= pageCount) {
                    await fetchMoreData();
                  } else {
                    setPage(newPage);
                  }
                }}
                loading={loading}
              />
            </Flexbox>
          )}
        </Flexbox>
      </UserLayout>
    </MainLayout>
  );
};

export default RenderToRoot(UserCubePage);
