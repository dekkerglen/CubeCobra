import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';

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

// Display page size — how many cards a user sees per page.
const PAGE_SIZE = 96;
// How many results to request from the server per fetch. Larger than PAGE_SIZE
// so a single fetch usually fills a page even when some results don't resolve
// to displayable cards (keeps the number of round trips down).
const FETCH_LIMIT = PAGE_SIZE * 2;
// Safety cap on fetches per fill, against a pathological filter that returns
// results the client can't resolve. Far more than enough to fill one page.
const MAX_BATCHES_PER_FILL = 25;

type ErrorState = 'none' | 'ml-unavailable' | 'generic';

const Suggestions: React.FC = () => {
  const { csrfFetch } = useContext(CSRFContext);
  const { filterInput } = useContext(FilterContext);
  const { cube } = useContext(CubeContext);

  // All results fetched so far, in rank order. A "page" is just a slice of
  // this — navigating to an already-loaded page is instant, no fetch.
  const [allCards, setAllCards] = useState<CardType[]>([]);
  const [page, setPage] = useState(0);
  // True only while actively fetching more to fill a not-yet-loaded page.
  const [loadingMore, setLoadingMore] = useState(false);
  // The server has no more results past what we've fetched.
  const [exhausted, setExhausted] = useState(false);
  const [errorState, setErrorState] = useState<ErrorState>('none');
  const [modalCard, setModalCard] = useState<CardType | null>(null);

  // Mutable state for the fill routine. Refs (not state) so the routine sees
  // live values and stays a stable callback that doesn't churn effects.
  const generationRef = useRef(0); // bumps on every new search; cancels stale fetches
  const skipRef = useRef(0); // next `skip` offset to request from the server
  const cardsRef = useRef<CardType[]>([]); // mirror of allCards for the loop
  const exhaustedRef = useRef(false);
  const loadingRef = useRef(false); // a fill loop is currently running
  const targetPageRef = useRef(0); // highest page the running loop should fill to

  // Latest request params, read by the (otherwise stable) fill routine.
  const paramsRef = useRef({
    cubeId: cube.id,
    filterText: filterInput,
    printingPreference: cube.defaultPrinting,
  });
  paramsRef.current = {
    cubeId: cube.id,
    filterText: filterInput,
    printingPreference: cube.defaultPrinting,
  };

  // Fetch successive server windows until `allCards` holds enough cards to fill
  // the requested display page, or the server runs out. Pages already in the
  // buffer need no fetch — this returns immediately. If a fill is already
  // running, the running loop picks up the raised target instead.
  const loadThroughPage = useCallback(
    async (targetPage: number): Promise<void> => {
      targetPageRef.current = Math.max(targetPageRef.current, targetPage);

      // A fill is already in flight — it re-reads targetPageRef each iteration,
      // so it will keep going to the new target on its own.
      if (loadingRef.current) return;
      // Already buffered enough, or nothing more to fetch.
      if (cardsRef.current.length >= (targetPageRef.current + 1) * PAGE_SIZE || exhaustedRef.current) {
        return;
      }

      const generation = generationRef.current;
      loadingRef.current = true;
      setLoadingMore(true);

      try {
        let batches = 0;
        while (
          generationRef.current === generation &&
          cardsRef.current.length < (targetPageRef.current + 1) * PAGE_SIZE &&
          !exhaustedRef.current &&
          batches < MAX_BATCHES_PER_FILL
        ) {
          batches += 1;
          const { cubeId, filterText, printingPreference } = paramsRef.current;

          const res = await csrfFetch('/cube/api/adds', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cubeID: cubeId,
              skip: skipRef.current,
              limit: FETCH_LIMIT,
              filterText,
              printingPreference,
            }),
          });
          const json = await res.json().catch(() => ({}));
          if (generationRef.current !== generation) return; // a new search started

          if (!res.ok) {
            // 503 with mlUnavailable means the recommender is down; anything
            // else is a generic failure. Stop paginating either way.
            exhaustedRef.current = true;
            if (json?.mlUnavailable) setErrorState('ml-unavailable');
            else setErrorState('generic');
            break;
          }

          const cardIDs: string[] = json.cardIDs || [];
          // Advance by the requested limit: the server's skip is positional in
          // the ranked list, so the next window starts past this whole window
          // regardless of how many cards resolved.
          skipRef.current += FETCH_LIMIT;

          const detailsById = cardIDs.length > 0 ? await getCardDetails(cardIDs) : {};
          if (generationRef.current !== generation) return;

          const newCards = cardIDs
            .map((id) => detailsById[id])
            .filter((d): d is NonNullable<typeof d> => !!d)
            .map((details) => detailsToCard(details));

          cardsRef.current = cardsRef.current.concat(newCards);
          if (!json.hasMoreAdds) exhaustedRef.current = true;
        }

        // Bailed on the batch cap without filling the page — treat as exhausted
        // so the UI shows what we have instead of spinning forever.
        if (
          generationRef.current === generation &&
          !exhaustedRef.current &&
          cardsRef.current.length < (targetPageRef.current + 1) * PAGE_SIZE
        ) {
          exhaustedRef.current = true;
        }
      } catch {
        if (generationRef.current === generation) {
          exhaustedRef.current = true;
          if (cardsRef.current.length === 0) setErrorState('generic');
        }
      } finally {
        // Commit results once, after the loop — never mid-fill, so the user
        // never sees a half-filled page flash before it's complete. Only the
        // loop owning the current generation commits; a stale loop leaves
        // state for the new generation (reset in the effect above).
        if (generationRef.current === generation) {
          setAllCards(cardsRef.current);
          setExhausted(exhaustedRef.current);
          loadingRef.current = false;
          setLoadingMore(false);
        }
      }
    },
    [csrfFetch],
  );

  // New search: reset everything and load the first page. Bumping the
  // generation cancels any in-flight fill from the previous search.
  useEffect(() => {
    generationRef.current += 1;
    skipRef.current = 0;
    cardsRef.current = [];
    exhaustedRef.current = false;
    loadingRef.current = false;
    targetPageRef.current = 0;

    setAllCards([]);
    setExhausted(false);
    setErrorState('none');
    setLoadingMore(false);
    setPage(0);

    if (filterInput && filterInput.trim().length > 0) {
      loadThroughPage(0);
    }
  }, [filterInput, cube.id, cube.defaultPrinting, loadThroughPage]);

  const goToPage = useCallback(
    (newPage: number) => {
      setPage(newPage);
      // Fetches more only if this page isn't already buffered.
      loadThroughPage(newPage);
    },
    [loadThroughPage],
  );

  const noFilter = !filterInput || filterInput.trim().length === 0;
  const pageCards = allCards.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const loadedPages = Math.max(1, Math.ceil(allCards.length / PAGE_SIZE));
  // One extra page is reachable while the server still has results.
  const pageCount = exhausted ? loadedPages : loadedPages + 1;
  const hasMore = !exhausted || page + 1 < loadedPages;
  // Spinner shows while we're actively filling the page being viewed. Already
  // loaded pages render instantly (loadingMore stays false for them).
  const showSpinner = loadingMore && pageCards.length === 0;

  let body: React.ReactNode;
  if (noFilter) {
    body = (
      <CardBody>
        <Flexbox direction="col" gap="3" alignItems="start" justify="start">
          <Text lg semibold>
            Enter a search filter
          </Text>
          <Text sm className="text-text-secondary">
            Smart Search ranks the cards matching your filter by how well they fit this cube. Type a filter above to see
            suggestions.
          </Text>
        </Flexbox>
      </CardBody>
    );
  } else if (showSpinner) {
    body = (
      <div className="centered m-4">
        <Spinner xl />
      </div>
    );
  } else if (pageCards.length > 0) {
    body = (
      <Flexbox direction="col" gap="2" className="mt-2">
        <Flexbox direction="row" justify="between" wrap="wrap" alignItems="center">
          <Text lg semibold className="whitespace-nowrap">
            <ResponsiveDiv baseVisible sm>
              {`Page ${page + 1}`}
            </ResponsiveDiv>
            <ResponsiveDiv md>{`Smart-sorted results for the query: ${filterInput}`}</ResponsiveDiv>
          </Text>
          <Paginate count={pageCount} active={page} onClick={goToPage} hasMore={hasMore} loading={loadingMore} />
        </Flexbox>
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
        <Flexbox direction="row" justify="end">
          <Paginate count={pageCount} active={page} onClick={goToPage} hasMore={hasMore} loading={loadingMore} />
        </Flexbox>
      </Flexbox>
    );
  } else if (errorState === 'ml-unavailable') {
    body = (
      <Card className="mt-2">
        <CardBody>
          <Flexbox direction="col" gap="3" alignItems="start" justify="start">
            <Text lg semibold>
              Recommender unavailable
            </Text>
            <Text sm className="text-text-secondary">
              The card recommender is temporarily unavailable, so we can't rank Smart Search results right now. Please
              try again in a moment.
            </Text>
          </Flexbox>
        </CardBody>
      </Card>
    );
  } else if (errorState === 'generic') {
    body = (
      <Card className="mt-2">
        <CardBody>
          <Flexbox direction="col" gap="3" alignItems="start" justify="start">
            <Text lg semibold>
              Something went wrong
            </Text>
            <Text sm className="text-text-secondary">
              We couldn't fetch Smart Search results. Please try again.
            </Text>
          </Flexbox>
        </CardBody>
      </Card>
    );
  } else {
    body = (
      <Card className="mt-2">
        <CardBody>
          <Flexbox direction="col" gap="3" alignItems="start" justify="start">
            <Text lg semibold>
              No results
            </Text>
            <Text sm className="text-text-secondary">
              No cards match this filter. Try a different one.
            </Text>
          </Flexbox>
        </CardBody>
      </Card>
    );
  }

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

      {body}

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
