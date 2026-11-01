import React, { useCallback, useContext, useState } from 'react';

import { P1P1Pack } from '@utils/datatypes/P1P1Pack';

import { CSRFContext } from '../../contexts/CSRFContext';
import {
  clampPage,
  fetchIndefiniteMoreData,
  getIndefinitePageCount,
  handleIndefinitePageSelection,
  hasIndefiniteMore,
} from '../../utils/indefinitePagination';
import { Card, CardFooter, CardHeader } from '../base/Card';
import CursorPagination, { willRenderCursorPager } from '../base/CursorPagination';
import { Flexbox } from '../base/Layout';
import Text from '../base/Text';
import P1P1Preview from './P1P1Preview';

type PaginationKey = Record<string, any> | null;

interface PreviousP1P1sCardProps {
  packs: P1P1Pack[];
  packsLastKey: PaginationKey;
  cubeId: string;
  cubeOwner: string;
}

const PAGE_SIZE = 10;

const PreviousP1P1sCard: React.FC<PreviousP1P1sCardProps> = ({ packs, packsLastKey, cubeId, cubeOwner }) => {
  const { callApi } = useContext(CSRFContext);
  const [currentPage, setCurrentPage] = useState(0);
  const [allPacks, setAllPacks] = useState<P1P1Pack[]>(packs);
  const [paginationKey, setPaginationKey] = useState(packsLastKey);
  const [isLoading, setIsLoading] = useState(false);

  const pageCount = getIndefinitePageCount(allPacks, PAGE_SIZE);
  const hasMore = hasIndefiniteMore(paginationKey);
  // Deleting a pack shortens the list under the viewer, so the page they are on can fall off the
  // end. Clamping here keeps the rendered window and the pager's label on the same page, instead
  // of slicing past the end and showing nothing.
  const activePage = clampPage(currentPage, pageCount);

  const fetchMore = useCallback(
    async (targetPage: number) => {
      await fetchIndefiniteMoreData<P1P1Pack>({
        callApi,
        fetchMoreRoute: `/tool/api/getmorep1p1s/${cubeId}`,
        items: allPacks,
        setItems: setAllPacks,
        lastKey: paginationKey,
        setLastKey: setPaginationKey,
        setPage: setCurrentPage,
        pageSize: PAGE_SIZE,
        itemsKey: 'packs',
        setLoading: setIsLoading,
        targetPage,
        body: { cubeId },
      });
    },
    [callApi, cubeId, allPacks, paginationKey],
  );

  const pager = (
    <CursorPagination
      active={activePage}
      loadedPages={pageCount}
      hasMore={hasMore}
      onPageChange={async (newPage) => {
        await handleIndefinitePageSelection({
          newPage,
          pageCount,
          setPage: setCurrentPage,
          fetchMoreData: fetchMore,
        });
      }}
      loading={isLoading}
    />
  );

  // The footer is a bordered strip of its own, so it has to appear on exactly the condition the
  // pager does. Asking the component rather than re-deriving a rule from allPacks.length is what
  // keeps the two from drifting apart.
  const showPager = willRenderCursorPager(pageCount, hasMore);

  const handlePackDeleted = useCallback((deletedPackId: string) => {
    setAllPacks((prevItems) => prevItems.filter((pack) => pack.id !== deletedPackId));
  }, []);

  return (
    <Card>
      <CardHeader>
        <Flexbox direction="row" justify="between" alignItems="center" className="w-full">
          <Text lg semibold>
            P1P1s
          </Text>
          {pager}
        </Flexbox>
      </CardHeader>
      {allPacks.slice(activePage * PAGE_SIZE, (activePage + 1) * PAGE_SIZE).map((pack) => (
        <P1P1Preview key={pack.id} pack={pack} onDeleted={handlePackDeleted} cubeOwner={cubeOwner} />
      ))}
      {showPager && (
        <CardFooter>
          <Flexbox direction="row" justify="end" alignItems="center" className="w-full">
            {pager}
          </Flexbox>
        </CardFooter>
      )}
    </Card>
  );
};

export default PreviousP1P1sCard;
