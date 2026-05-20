import React, { useContext, useEffect, useState } from 'react';

import { detailsToCard } from '@utils/cardutil';
import CardType from '@utils/datatypes/Card';

import { Card, CardBody } from '../components/base/Card';
import { Flexbox } from '../components/base/Layout';
import Paginate from '../components/base/Pagination';
import ResponsiveDiv from '../components/base/ResponsiveDiv';
import Spinner from '../components/base/Spinner';
import Text from '../components/base/Text';
import CardGrid from '../components/card/CardGrid';
import FilterCollapse from '../components/FilterCollapse';
import AddToCubeModal from '../components/modals/AddToCubeModal';
import { CSRFContext } from '../contexts/CSRFContext';
import CubeContext from '../contexts/CubeContext';
import FilterContext from '../contexts/FilterContext';
import { getCardDetails } from '../utils/cardDetailsCache';

const PAGE_SIZE = 96;

const Suggestions: React.FC = () => {
  const { csrfFetch } = useContext(CSRFContext);
  const { filterInput } = useContext(FilterContext);
  const { cube } = useContext(CubeContext);

  const [pageCards, setPageCards] = useState<CardType[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorState, setErrorState] = useState<'none' | 'ml-unavailable' | 'generic'>('none');
  const [modalCard, setModalCard] = useState<CardType | null>(null);

  // When the filter changes, jump back to page 0. We track this in a separate
  // effect so it doesn't fight with the fetch effect over the page cursor.
  useEffect(() => {
    setPage(0);
  }, [filterInput, cube.id]);

  // Single fetch effect — runs whenever any input that affects the result
  // changes. The server returns scryfall_ids only; we resolve details out of
  // the persistent IndexedDB cache (cardDetailsCache), which coalesces any
  // misses into a single /cube/api/getdetailsforcards call.
  useEffect(() => {
    // Smart Search is filter-driven: with no filter there is nothing to rank,
    // so don't hit the endpoint at all — just clear any prior results.
    if (!filterInput || filterInput.trim().length === 0) {
      setPageCards([]);
      setHasMore(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setErrorState('none');
      const res = await csrfFetch(`/cube/api/adds`, {
        method: 'POST',
        body: JSON.stringify({
          cubeID: cube.id,
          skip: page * PAGE_SIZE,
          limit: PAGE_SIZE,
          filterText: filterInput,
          printingPreference: cube.defaultPrinting,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      if (cancelled) return;
      const json = await res.json();
      if (cancelled) return;

      // The server returns 503 with mlUnavailable: true when the recommender is
      // down. Surface that as a distinct error state instead of falling back to
      // filter order (which is indistinguishable from "the cube wasn't mapped").
      if (!res.ok) {
        setPageCards([]);
        setHasMore(false);
        setErrorState(json?.mlUnavailable ? 'ml-unavailable' : 'generic');
        setLoading(false);
        return;
      }

      const cardIDs: string[] = json.cardIDs || [];
      const detailsById = cardIDs.length > 0 ? await getCardDetails(cardIDs) : {};
      if (cancelled) return;

      const cards = cardIDs
        .map((id) => detailsById[id])
        .filter((d): d is NonNullable<typeof d> => !!d)
        .map((details) => detailsToCard(details));

      setPageCards(cards);
      setHasMore(!!json.hasMoreAdds);
      setLoading(false);
    };
    run().catch(() => {
      if (!cancelled) {
        setPageCards([]);
        setHasMore(false);
        setErrorState('generic');
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [csrfFetch, cube.id, cube.defaultPrinting, filterInput, page]);

  // The recommender returns a fully-ranked list, so the page count is the
  // current page plus one if there are more results to fetch.
  const pageCount = hasMore ? page + 2 : page + 1;

  return (
    <div className="p-2">
      <Flexbox direction="col" gap="2">
        <Text xl semibold>
          Smart Search
        </Text>
        <Text>
          Smart Search is card search with a context-aware sort. It runs your filter against the full card pool and then
          ranks the results by how well each card fits this specific cube — surfacing relevant additions that a plain
          alphabetical search would bury. Enter a search filter to begin.
        </Text>
        <FilterCollapse isOpen buttonLabel="Search" />
      </Flexbox>

      {loading && pageCards.length === 0 ? (
        <div className="centered m-4">
          <Spinner xl />
        </div>
      ) : pageCards.length > 0 ? (
        <Flexbox direction="col" gap="2" className="mt-2">
          <Flexbox direction="row" justify="between" wrap="wrap" alignItems="center">
            <Text lg semibold className="whitespace-nowrap">
              <ResponsiveDiv baseVisible sm>
                {`Page ${page + 1}`}
              </ResponsiveDiv>
              <ResponsiveDiv md>{`Smart-sorted results for the query: ${filterInput}`}</ResponsiveDiv>
            </Text>
            <Paginate count={pageCount} active={page} onClick={setPage} hasMore={hasMore} loading={loading} />
          </Flexbox>
          {loading ? (
            <div className="centered m-4">
              <Spinner xl />
            </div>
          ) : (
            <CardGrid
              cards={pageCards}
              xs={2}
              sm={3}
              md={4}
              lg={5}
              xl={6}
              xxl={8}
              cardProps={{ autocard: true, className: 'clickable' }}
              onClick={(card) => setModalCard(card)}
            />
          )}
          <Flexbox direction="row" justify="end">
            <Paginate count={pageCount} active={page} onClick={setPage} hasMore={hasMore} loading={loading} />
          </Flexbox>
        </Flexbox>
      ) : !filterInput || filterInput.trim().length === 0 ? (
          <CardBody>
            <Flexbox direction="col" gap="3" alignItems="start" justify="start">
            <Text lg semibold>
              Enter a search filter
            </Text>
            <Text sm className="text-text-secondary">
              Smart Search ranks the cards matching your filter by how well they fit this cube. Type a filter above to
              see suggestions.
            </Text>
            </Flexbox>
          </CardBody>
      ) : errorState === 'ml-unavailable' ? (
        <Card className="mt-2">
          <CardBody>
            <Text lg semibold>
              Recommender unavailable
            </Text>
            <Text sm className="text-text-secondary">
              The card recommender is temporarily unavailable, so we can't rank Smart Search results right now. Please
              try again in a moment.
            </Text>
          </CardBody>
        </Card>
      ) : errorState === 'generic' ? (
        <Card className="mt-2">
          <CardBody>
            <Text lg semibold>
              Something went wrong
            </Text>
            <Text sm className="text-text-secondary">
              We couldn't fetch Smart Search results. Please try again.
            </Text>
          </CardBody>
        </Card>
      ) : (
        <Card className="mt-2">
          <CardBody>
            <Text lg semibold>
              No results
            </Text>
            <Text sm className="text-text-secondary">
              No cards match this filter. Try a different one.
            </Text>
          </CardBody>
        </Card>
      )}

      {modalCard && (
        <AddToCubeModal
          card={modalCard}
          isOpen={modalCard !== null}
          setOpen={(open) => {
            if (!open) setModalCard(null);
          }}
          cubeContext={cube.id}
        />
      )}
    </div>
  );
};

export default Suggestions;
