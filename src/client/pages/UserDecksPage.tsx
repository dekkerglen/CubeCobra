import React, { useCallback, useContext, useState } from 'react';

import { Card, CardBody, CardFooter, CardHeader } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Pagination from 'components/base/Pagination';
import Text from 'components/base/Text';
import DeckPreview from 'components/DeckPreview';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import { CSRFContext } from 'contexts/CSRFContext';
import Draft from 'datatypes/Draft';
import User from 'datatypes/User';
import MainLayout from 'layouts/MainLayout';
import UserLayout from 'layouts/UserLayout';

interface UserDecksPageProps {
  owner: User;
  followers: User[];
  following: boolean;
  decks: Draft[];
  loginCallback?: string;
  lastKey?: any;
}

const PAGE_SIZE = 20;

const UserDecksPage: React.FC<UserDecksPageProps> = ({
  followers,
  following,
  decks,
  owner,
  loginCallback = '/',
  lastKey,
}) => {
  const { csrfFetch } = useContext(CSRFContext);
  const [items, setItems] = useState<Draft[]>(decks);
  const [currentLastKey, setLastKey] = useState(lastKey);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = React.useState(0);

  const pageCount = Math.ceil(items.length / PAGE_SIZE);
  const hasMore = !!currentLastKey;

  const fetchMoreData = useCallback(async () => {
    setLoading(true);

    const response = await csrfFetch(`/user/getmoredecks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lastKey: currentLastKey,
      }),
    });

    if (response.ok) {
      const json = await response.json();
      if (json.success === 'true') {
        setItems([...items, ...json.decks]);
        setPage(page + 1);
        setLastKey(json.lastKey);
      }

      setLoading(false);
    }
  }, [owner.id, currentLastKey, items, page]);

  const pager = (
    <Pagination
      count={pageCount}
      active={page}
      hasMore={hasMore}
      onClick={async (newPage) => {
        console.log(newPage, pageCount);
        if (newPage >= pageCount) {
          await fetchMoreData();
        } else {
          setPage(newPage);
        }
      }}
      loading={loading}
    />
  );

  return (
    <MainLayout loginCallback={loginCallback}>
      <UserLayout user={owner} followers={followers} following={following} activeLink="decks">
        <DynamicFlash />

        <Card className="my-3">
          {items.length > 0 ? (
            <>
              <CardHeader>
                <Flexbox direction="row" justify="between" alignItems="center" className="w-full">
                  <Text lg semibold>
                    Decks ({items.length}
                    {hasMore ? '+' : ''})
                  </Text>
                  {pager}
                </Flexbox>
              </CardHeader>
              {items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((deck) => (
                <DeckPreview key={deck.id} deck={deck} />
              ))}
              <CardFooter>
                <Flexbox direction="row" justify="end" alignItems="center" className="w-full">
                  {pager}
                </Flexbox>
              </CardFooter>
            </>
          ) : (
            <>
              <CardHeader>
                <Flexbox direction="row" justify="between" alignItems="center" className="w-full">
                  <Text lg semibold>
                    {'Decks (0)'}
                  </Text>
                </Flexbox>
              </CardHeader>
              <CardBody>
                <p className="my-3">This user has not drafted any decks!</p>
              </CardBody>
            </>
          )}
        </Card>
      </UserLayout>
    </MainLayout>
  );
};

export default RenderToRoot(UserDecksPage);
