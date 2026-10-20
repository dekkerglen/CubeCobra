import React, { useCallback, useContext, useEffect, useState } from 'react';

import { QuestionIcon } from '@primer/octicons-react';
import { cdnUrl } from '@utils/cdnUrl';
import Cube from '@utils/datatypes/Cube';

import Banner from 'components/Banner';
import Container from 'components/base/Container';
import Input from 'components/base/Input';
import { Flexbox } from 'components/base/Layout';
import Pagination from 'components/base/Pagination';
import ResponsiveDiv from 'components/base/ResponsiveDiv';
import Select from 'components/base/Select';
import Spinner from 'components/base/Spinner';
import Text from 'components/base/Text';
import CubePreview from 'components/cube/CubePreview';
import DynamicFlash from 'components/DynamicFlash';
import LoadingButton from 'components/LoadingButton';
import SearchSyntaxModal from 'components/modals/SearchSyntaxModal';
import RenderToRoot from 'components/RenderToRoot';
import SideBanner from 'components/SideBanner';
import { CSRFContext } from 'contexts/CSRFContext';
import useLatestRequest from 'hooks/useLatestRequest';
import MainLayout from 'layouts/MainLayout';
import Query from 'utils/Query';

interface SearchPageProps {
  cubes: Cube[];
  lastKey?: string;
  parsedQuery?: string[];
  /** The query the server rendered with. The url is the source of truth, so this is unused. */
  query?: string;
}

const PAGE_SIZE = 36;

const DEFAULT_ORDER = 'pop';

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'pop', label: 'Sorted by Popularity' },
  { value: 'alpha', label: 'Sorted Alphabetically' },
  { value: 'cards', label: 'Sorted by Card Count' },
  { value: 'date', label: 'Sorted by Last Updated' },
];

const ASCENDING_OPTIONS: { value: string; label: string }[] = [
  { value: 'true', label: 'Ascending' },
  { value: 'false', label: 'Descending' },
];

// Clamp params the way the server reads them; a <select> with an unknown value shows its first option.
const toOrder = (value: string): string =>
  SORT_OPTIONS.some((option) => option.value === value) ? value : DEFAULT_ORDER;
const toAscending = (value: string): string => (value === 'true' ? 'true' : 'false');

const SearchPage: React.FC<SearchPageProps> = ({ cubes, lastKey, parsedQuery }) => {
  const [items, setItems] = useState<Cube[]>(cubes);
  const [currentLastKey, setCurrentLastKey] = useState(lastKey);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(0);
  const { csrfFetch } = useContext(CSRFContext);
  const [currentParsedQuery, setCurrentParsedQuery] = useState(parsedQuery || []);
  const [showSyntaxModal, setShowSyntaxModal] = useState(false);
  const { begin } = useLatestRequest();

  // Plain state rather than useQueryParam, so go() can write all three params as one history entry.
  const [currentQuery, setCurrentQuery] = useState(() => Query.get('q', ''));
  const [currentOrder, setCurrentOrder] = useState(() => toOrder(Query.get('order', DEFAULT_ORDER)));
  const [currentAscending, setCurrentAscending] = useState(() => toAscending(Query.get('ascending', 'false')));

  const [queryText, setQueryText] = useState(currentQuery);
  const [orderText, setOrderText] = useState(currentOrder);
  const [ascendingText, setAscendingText] = useState(currentAscending);

  useEffect(() => {
    setQueryText(currentQuery);
    setOrderText(currentOrder);
    setAscendingText(currentAscending);
  }, [currentQuery, currentOrder, currentAscending]);

  const pageCount = Math.ceil(items.length / PAGE_SIZE);
  const hasMore = !!currentLastKey;

  // Doesn't touch the url: Search writes it first via go(), and back/forward has already restored it.
  const runSearch = useCallback(
    async (q: string, order: string, ascending: string) => {
      setCurrentQuery(q);
      setCurrentParsedQuery([]);
      setCurrentOrder(order);
      setCurrentAscending(ascending);
      setFailed(false);
      setLoading(true);
      setItems([]);
      setPage(0);

      const request = begin();
      try {
        const response = await csrfFetch(`/search/getmoresearchitems`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q, order, ascending, lastKey: null }),
          signal: request.signal,
        });
        const json = response.ok ? await response.json() : null;

        if (!request.isCurrent()) {
          return;
        }

        if (json && json.success === 'true') {
          setItems(json.cubes);
          setCurrentLastKey(json.lastKey);
          setCurrentParsedQuery(json.parsedQuery);
        } else {
          // A stale lastKey would page through results no longer on screen.
          setCurrentLastKey(undefined);
          setFailed(true);
        }
      } catch {
        if (request.isCurrent()) {
          setCurrentLastKey(undefined);
          setFailed(true);
        }
      } finally {
        if (request.isCurrent()) {
          setLoading(false);
        }
      }
    },
    [begin, csrfFetch],
  );

  const go = useCallback(
    (q: string, order: string, ascending: string) => {
      const safeOrder = toOrder(order);
      const safeAscending = toAscending(ascending);

      // One history entry per search; defaults are dropped to keep links short.
      Query.setMany(
        {
          q: q === '' ? null : q,
          order: safeOrder === DEFAULT_ORDER ? null : safeOrder,
          ascending: safeAscending === 'false' ? null : safeAscending,
        },
        true,
      );

      return runSearch(q, safeOrder, safeAscending);
    },
    [runSearch],
  );

  const fetchMoreData = useCallback(async () => {
    setLoading(true);
    setFailed(false);

    const request = begin();
    try {
      const response = await csrfFetch(`/search/getmoresearchitems`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lastKey: currentLastKey,
          query: currentQuery,
          order: currentOrder,
          ascending: currentAscending,
        }),
        signal: request.signal,
      });
      const json = response.ok ? await response.json() : null;

      if (!request.isCurrent()) {
        return;
      }

      if (json && json.success === 'true') {
        const newItems = [...items, ...json.cubes];
        setItems(newItems);
        setCurrentParsedQuery(json.parsedQuery);

        const numItemsShowOnLastPage = items.length % PAGE_SIZE;
        if (numItemsShowOnLastPage === 0 && json.cubes.length > 0) {
          setPage(page + 1);
        }
        setCurrentLastKey(json.lastKey);
      } else {
        setCurrentLastKey(undefined);
        setFailed(true);
      }
    } catch {
      if (request.isCurrent()) {
        setCurrentLastKey(undefined);
        setFailed(true);
      }
    } finally {
      if (request.isCurrent()) {
        setLoading(false);
      }
    }
  }, [begin, csrfFetch, currentAscending, currentLastKey, currentOrder, currentQuery, items, page]);

  // Back/forward restores the url; re-run the search so the cubes match it.
  useEffect(() => {
    const onPopState = () => {
      runSearch(
        Query.get('q', ''),
        toOrder(Query.get('order', DEFAULT_ORDER)),
        toAscending(Query.get('ascending', 'false')),
      );
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [runSearch]);

  const renderPager = (inverted: boolean) => (
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
      inverted={inverted}
    />
  );

  return (
    <MainLayout useContainer={false} transparentNav>
      <div className="relative min-h-screen">
        {/* Image backdrop: screen-height, matching landing / dashboard / resources.
            Cubes flow in normal page flow on top and continue past the bottom of this. */}
        <div className="absolute inset-x-0 top-0 h-screen overflow-hidden bg-bg-secondary pointer-events-none z-0">
          <img
            src={cdnUrl('/content/retrocobra.webp')}
            alt=""
            aria-hidden
            draggable={false}
            className="absolute inset-0 w-full h-full object-cover object-top select-none"
          />
          <div className="absolute inset-0 bg-bg-secondary/80" />

          {/* Soft taper at the very bottom of the image so the border into bg isn't harsh */}
          {items.length > 0 && (
            <div className="absolute inset-x-0 bottom-0 h-[25vh] bg-gradient-to-b from-transparent to-bg pointer-events-none" />
          )}
        </div>

        <a
          href="https://bsky.app/profile/firosart.bsky.social"
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-20 right-3 text-xs text-button-text/70 hover:text-button-text underline-offset-2 hover:underline z-[15]"
        >
          Art by Santiago Rosas
        </a>

        {/* Page content layered on top of the backdrop */}
        <div className="relative z-10">
          {/* Hero content: search bar + result count + parsed query */}
          <div className="px-4 pt-28 pb-10 md:pt-36 md:pb-12">
            <div className="w-full max-w-xl mx-auto flex flex-col items-center text-center gap-5">
              <div>
                <Text xxxxl bold className="!text-button-text block">
                  Cube Search
                </Text>
                <p className="mt-1 text-sm text-button-text/80">
                  Find cubes by name, category, owner, or anything else.
                </p>
              </div>

              <div className="w-full flex flex-col gap-2">
                <form
                  action="#"
                  onSubmit={(e) => {
                    e.preventDefault();
                    go(queryText, orderText, ascendingText);
                  }}
                >
                  <Flexbox direction="row" alignItems="center" gap="2" className="w-full">
                    <button
                      type="button"
                      onClick={() => setShowSyntaxModal(true)}
                      aria-label="Search syntax"
                      className="text-button-text/80 hover:text-button-text cursor-pointer p-1 inline-flex items-center"
                    >
                      <QuestionIcon size={20} />
                    </button>
                    <Input
                      placeholder="Search cubes..."
                      value={queryText}
                      onChange={(event) => setQueryText(event.target.value)}
                      className="!bg-white !text-gray-800 !placeholder-gray-500 !border-gray-300"
                      otherInputProps={{ enterKeyHint: 'search', name: 'q' }}
                    />
                    {/* Hidden submit so Enter and mobile keyboards' "Go" key submit the form. */}
                    <button type="submit" aria-hidden="true" tabIndex={-1} className="hidden" />
                    <div className="hidden md:block">
                      <LoadingButton color="primary" onClick={() => go(queryText, orderText, ascendingText)}>
                        <span className="px-3">Search</span>
                      </LoadingButton>
                    </div>
                  </Flexbox>
                </form>

                <Flexbox direction="row" alignItems="center" justify="center" gap="2" wrap="wrap">
                  <div className="w-52">
                    <Select dense options={SORT_OPTIONS} value={orderText} setValue={(value) => setOrderText(value)} />
                  </div>
                  <div className="w-36">
                    <Select
                      dense
                      options={ASCENDING_OPTIONS}
                      value={ascendingText}
                      setValue={(value) => setAscendingText(toAscending(value))}
                    />
                  </div>
                </Flexbox>
              </div>
            </div>
          </div>

          <SearchSyntaxModal isOpen={showSyntaxModal} setOpen={setShowSyntaxModal} />

          {/* Cube grid — starts on the image backdrop and continues past the taper */}
          <Container xxxl className="pb-6">
            <Flexbox direction="row" gap="4">
              <ResponsiveDiv xxl className="pl-2 py-2 min-w-fit">
                <SideBanner placementId="left-rail" />
              </ResponsiveDiv>
              <div className="flex-grow px-2 max-w-full min-w-0">
                <Flexbox direction="col" gap="3" className="pt-3 md:pt-4 pb-3">
                  <Flexbox direction="row" alignItems="center" justify="between" gap="3" wrap="wrap" className="w-full">
                    <Flexbox direction="col" gap="1" alignItems="start" className="text-left min-w-0">
                      <Text lg semibold className="!text-button-text">
                        {loading
                          ? 'Searching…'
                          : failed
                            ? 'Search failed'
                            : `${items.length.toLocaleString()}${hasMore ? '+' : ''} cubes found`}
                      </Text>
                      {(currentParsedQuery || []).length > 0 && (
                        <Text sm semibold italic className="!text-button-text/80 break-all">
                          {(currentParsedQuery || []).join(', ')}
                        </Text>
                      )}
                    </Flexbox>
                    {items.length > 0 && renderPager(true)}
                  </Flexbox>
                </Flexbox>
                <DynamicFlash />
                <Banner />
                <Flexbox direction="col" gap="3" className="mt-3">
                  {items.length > 0 ? (
                    <Flexbox direction="col" gap="2">
                      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5">
                        {items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((cube) => (
                          <div key={cube.id} className="opacity-90 hover:opacity-100 transition-opacity duration-200">
                            <CubePreview cube={cube} />
                          </div>
                        ))}
                      </div>
                      <Flexbox direction="row" justify="center" alignItems="center" className="w-full px-2">
                        {renderPager(false)}
                      </Flexbox>
                    </Flexbox>
                  ) : (
                    <Flexbox direction="row" justify="center" alignItems="center" className="w-full px-2 py-12">
                      {loading ? (
                        <Spinner xl />
                      ) : (
                        <Text semibold lg className="!text-button-text">
                          {failed ? 'Something went wrong. Please try again.' : 'No Results'}
                        </Text>
                      )}
                    </Flexbox>
                  )}
                </Flexbox>
              </div>
              <ResponsiveDiv lg className="pr-2 py-2 min-w-fit">
                <SideBanner placementId="right-rail" />
              </ResponsiveDiv>
            </Flexbox>
          </Container>
        </div>
      </div>
    </MainLayout>
  );
};

export default RenderToRoot(SearchPage);
