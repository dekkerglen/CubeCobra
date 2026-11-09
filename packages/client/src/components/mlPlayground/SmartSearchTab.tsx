import React, { useCallback, useState } from 'react';

import Checkbox from 'components/base/Checkbox';
import { Flexbox } from 'components/base/Layout';
import Pagination from 'components/base/Pagination';
import Spinner from 'components/base/Spinner';
import { Tabs } from 'components/base/Tabs';
import LoadingButton from 'components/LoadingButton';
import useLocalStorage from 'hooks/useLocalStorage';

import { ACTION_BUTTON_CLASS, CardListInput, FilterField, isFilterUsable, PlaygroundForm } from './ListInputs';
import ListReport, { ErrorNotice } from './ListReport';
import RankedCards, { listText, ResultsHeader } from './ResultsView';
import { ListSummary, RatedCard, RecommendResponse } from './types';
import usePlaygroundRequest from './usePlaygroundRequest';

const PAGE_SIZE = 96;

interface Query {
  cards: string;
  filterText: string;
  substitute: boolean;
}

/**
 * Smart Search with a pasted list standing in for the cube: the cube_decoder ranks every card
 * matching the filter by fit (adds), and the list's own cards worst fit first (cuts).
 */
const SmartSearchTab: React.FC = () => {
  const [cards, setCards] = useLocalStorage('mlPlayground.search.cards', '');
  const [filter, setFilter] = useLocalStorage('mlPlayground.search.filter', '');
  const [substitute, setSubstitute] = useLocalStorage('mlPlayground.search.substitute', false);

  const { data, error, loading, run } = usePlaygroundRequest<RecommendResponse>('recommend');
  const [query, setQuery] = useState<Query | null>(null);
  // The list and its cuts come with the first page; later pages only carry adds.
  const [listResult, setListResult] = useState<{ list: ListSummary; cuts: RatedCard[] } | null>(null);
  const [page, setPage] = useState(0);
  const [cutsPage, setCutsPage] = useState(0);
  const [view, setView] = useState<'adds' | 'cuts'>('adds');

  const canSearch = isFilterUsable(filter) && (cards.trim().length > 0 || filter.trim().length > 0);

  const search = useCallback(async () => {
    if (!canSearch) return;
    const next: Query = { cards, filterText: filter, substitute };
    setQuery(next);
    setPage(0);
    setCutsPage(0);
    setListResult(null);
    const result = await run({ ...next, skip: 0, limit: PAGE_SIZE });
    if (result?.list) {
      setListResult({ list: result.list, cuts: result.cuts ?? [] });
    }
  }, [canSearch, cards, filter, run, substitute]);

  const goToPage = useCallback(
    async (index: number) => {
      if (!query) return;
      setPage(index);
      await run({ ...query, skip: index * PAGE_SIZE, limit: PAGE_SIZE, brief: true });
    },
    [query, run],
  );

  const adds = data?.adds ?? [];
  const totalAdds = data?.totalAdds ?? 0;
  const cuts = listResult?.cuts ?? [];
  const cutsPageCount = Math.ceil(cuts.length / PAGE_SIZE);
  const cutsSlice = cuts.slice(cutsPage * PAGE_SIZE, (cutsPage + 1) * PAGE_SIZE);

  return (
    <Flexbox direction="col" gap="3">
      <PlaygroundForm
        options={<Checkbox label="Substitute unknown cards" checked={substitute} setChecked={setSubstitute} />}
        actions={
          <LoadingButton
            color="primary"
            className={ACTION_BUTTON_CLASS}
            loading={loading}
            onClick={search}
            disabled={!canSearch}
          >
            Search
          </LoadingButton>
        }
      >
        <CardListInput id="mlPlaygroundSearchCards" label="Cards" value={cards} setValue={setCards} />
        <FilterField id="mlPlaygroundSearchFilter" value={filter} setValue={setFilter} onEnter={search} />
      </PlaygroundForm>

      {listResult && listResult.list.cards.length + listResult.list.missing.length > 0 && (
        <ListReport summary={listResult.list} />
      )}

      {error && <ErrorNotice error={error} />}

      {loading && !listResult && (
        <div className="centered m-4">
          <Spinner xl />
        </div>
      )}

      {query && listResult && (
        <Flexbox direction="col" gap="2">
          <Tabs
            className="border-b border-border"
            activeTab={view === 'adds' ? 0 : 1}
            tabs={[
              { label: `Adds · ${totalAdds.toLocaleString()}`, onClick: () => setView('adds') },
              { label: `Cuts · ${cuts.length.toLocaleString()}`, onClick: () => setView('cuts') },
            ]}
          />
          {view === 'adds' ? (
            <>
              <ResultsHeader title={query.filterText.trim() || 'All cards'} copyText={() => listText(adds)}>
                <Pagination
                  count={Math.ceil(totalAdds / PAGE_SIZE)}
                  active={page}
                  onClick={goToPage}
                  loading={loading}
                />
              </ResultsHeader>
              <RankedCards items={adds} startRank={page * PAGE_SIZE + 1} />
            </>
          ) : (
            <>
              <ResultsHeader title="Worst fit first" copyText={() => listText(cuts)}>
                {cutsPageCount > 1 && <Pagination count={cutsPageCount} active={cutsPage} onClick={setCutsPage} />}
              </ResultsHeader>
              <RankedCards items={cutsSlice} startRank={cutsPage * PAGE_SIZE + 1} />
            </>
          )}
        </Flexbox>
      )}
    </Flexbox>
  );
};

export default SmartSearchTab;
