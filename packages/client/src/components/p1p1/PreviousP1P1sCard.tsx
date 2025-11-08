import React, { useCallback, useContext, useState } from 'react';

import { P1P1Pack } from '@utils/datatypes/P1P1Pack';
import { CSRFContext } from '../../contexts/CSRFContext';
import { Card, CardFooter, CardHeader } from '../base/Card';
import { Flexbox } from '../base/Layout';
import Pagination from '../base/Pagination';
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
  const { csrfFetch } = useContext(CSRFContext);
  const [currentPage, setCurrentPage] = useState(0);
  const [allPacks, setAllPacks] = useState<P1P1Pack[]>(packs);
  const [paginationKey, setPaginationKey] = useState(packsLastKey);
  const [isLoading, setIsLoading] = useState(false);

  const pageCount = Math.ceil(allPacks.length / PAGE_SIZE);
  const hasMore = !!paginationKey;

  const fetchMore = useCallback(async () => {
    setIsLoading(true);
    const response = await csrfFetch(`/tool/api/getmorep1p1s/${cubeId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cubeId,
        lastKey: paginationKey,
      }),
    });

    if (response.ok) {
      const json = await response.json();

      setPaginationKey(json.lastKey);
      setAllPacks([...allPacks, ...json.packs]);
      setCurrentPage(currentPage + 1);
      setIsLoading(false);
    }
  }, [csrfFetch, cubeId, allPacks, paginationKey, currentPage]);

  const pager = (
    <Pagination
      count={pageCount}
      active={currentPage}
      hasMore={hasMore}
      onClick={async (newPage) => {
        if (newPage >= pageCount) {
          await fetchMore();
        } else {
          setCurrentPage(newPage);
        }
      }}
      loading={isLoading}
    />
  );

  const handlePackDeleted = useCallback((deletedPackId: string) => {
    setAllPacks((prevItems) => prevItems.filter((pack) => pack.id !== deletedPackId));
  }, []);

  return (
    <Card>
      <CardHeader>
        <Flexbox direction="row" justify="between" alignItems="center" className="w-full">
          <Text lg semibold>
            P1P1s ({allPacks.length}
            {hasMore ? '+' : ''})
          </Text>
          {pager}
        </Flexbox>
      </CardHeader>
      {allPacks.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map((pack) => (
        <P1P1Preview key={pack.id} pack={pack} onDeleted={handlePackDeleted} cubeOwner={cubeOwner} />
      ))}
      <CardFooter>
        <Flexbox direction="row" justify="end" alignItems="center" className="w-full">
          {pager}
        </Flexbox>
      </CardFooter>
    </Card>
  );
};

export default PreviousP1P1sCard;
