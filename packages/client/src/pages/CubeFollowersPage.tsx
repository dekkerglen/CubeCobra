import React, { useCallback, useContext, useState } from 'react';

import Card, { BoardType } from '@utils/datatypes/Card';
import Cube from '@utils/datatypes/Cube';
import User from '@utils/datatypes/User';

import { Card as BaseCard, CardBody, CardHeader } from 'components/base/Card';
import CursorPagination, { willRenderCursorPager } from 'components/base/CursorPagination';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Text from 'components/base/Text';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import UserPreview from 'components/UserPreview';
import { CSRFContext } from 'contexts/CSRFContext';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';
import {
  fetchIndefiniteMoreData,
  getIndefinitePageCount,
  handleIndefinitePageSelection,
  hasIndefiniteMore,
} from 'utils/indefinitePagination';

const PAGE_SIZE = 36;

interface CubeFollowersPageProps {
  cube: Cube;
  cards: Record<BoardType, Card[]>;
  followers: User[];
  lastKey?: any;
}

const CubeFollowersPage: React.FC<CubeFollowersPageProps> = ({
  cube,
  cards,
  followers: initialFollowers,
  lastKey: initialLastKey,
}) => {
  const { callApi } = useContext(CSRFContext);
  const [items, setItems] = useState<User[]>(initialFollowers);
  const [currentLastKey, setLastKey] = useState<any>(initialLastKey);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);

  const pageCount = getIndefinitePageCount(items, PAGE_SIZE);
  const hasMore = hasIndefiniteMore(currentLastKey);

  const fetchMore = useCallback(
    async (targetPage: number) => {
      await fetchIndefiniteMoreData<User>({
        callApi,
        fetchMoreRoute: `/cube/followers/getmore/${cube.id}`,
        items,
        setItems,
        lastKey: currentLastKey,
        setLastKey,
        setPage,
        pageSize: PAGE_SIZE,
        itemsKey: 'followers',
        setLoading,
        targetPage,
      });
    },
    [callApi, cube.id, currentLastKey, items],
  );

  const pager = (
    <CursorPagination
      active={page}
      loadedPages={pageCount}
      hasMore={hasMore}
      onPageChange={async (newPage) => {
        await handleIndefinitePageSelection({
          newPage,
          pageCount,
          setPage,
          fetchMoreData: fetchMore,
        });
      }}
      loading={loading}
    />
  );

  // The divider strip is visible chrome of its own, so it has to appear on exactly the condition
  // the pager does. Asking the component rather than re-deriving a rule from items.length is what
  // keeps the two from drifting apart.
  const showPager = willRenderCursorPager(pageCount, hasMore);
  const totalShown = items.length;
  const headerCount = cube.likeCount ?? totalShown;

  return (
    <MainLayout useContainer={false}>
      <CubeLayout cube={cube} cards={cards} activeLink="followers">
        <DynamicFlash />
        <BaseCard className="my-3">
          <CardHeader>
            <Flexbox direction="row" justify="between" alignItems="center" wrap="wrap" gap="2">
              <Text lg semibold>
                Likes ({headerCount})
              </Text>
              {pager}
            </Flexbox>
          </CardHeader>
          {totalShown > 0 ? (
            <CardBody className="p-0">
              <Row className="g-0">
                {items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((user) => (
                  <Col key={user.id} xs={6} sm={4} md={3} lg={3} xl={2}>
                    <UserPreview user={user} />
                  </Col>
                ))}
              </Row>
            </CardBody>
          ) : (
            <CardBody>
              <Text className="text-text-secondary">No likes yet.</Text>
            </CardBody>
          )}
          {showPager && (
            <CardBody className="border-t border-border">
              <Flexbox direction="row" justify="end" alignItems="center" className="w-full">
                {pager}
              </Flexbox>
            </CardBody>
          )}
        </BaseCard>
      </CubeLayout>
    </MainLayout>
  );
};

export default RenderToRoot(CubeFollowersPage);
