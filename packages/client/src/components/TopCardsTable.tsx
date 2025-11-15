import React, { useCallback, useContext, useEffect, useState } from 'react';

import { cardElo, detailsToCard } from '@utils/cardutil';
import { CardDetails } from '@utils/datatypes/Card';
import { ORDERED_SORTS } from '@utils/sorting/Sort';

import FilterContext from '../contexts/FilterContext';
import Query from '../utils/Query';
import Banner from './Banner';
import Controls from './base/Controls';
import { Col, Flexbox, Row } from './base/Layout';
import Link from './base/Link';
import Paginate from './base/Pagination';
import ResponsiveDiv from './base/ResponsiveDiv';
import Select from './base/Select';
import Spinner from './base/Spinner';
import Table from './base/Table';
import Text from './base/Text';
import DynamicFlash from './DynamicFlash';
import FilterCollapse from './FilterCollapse';
import withAutocard from './WithAutocard';

const AutocardA = withAutocard(Link);

const TopCardsTable = () => {
  const { filterInput } = useContext(FilterContext);
  const [cards, setCards] = useState<CardDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(parseInt(Query.get('p', '0'), 0));
  const [count, setCount] = useState(Query.get('m', ''));
  const [sort, setSort] = useState(Query.get('s', 'Elo'));
  const [direction, setDirection] = useState(Query.get('d', 'descending'));

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams([
      ['p', page.toString()],
      ['f', filterInput || ''],
      ['s', sort],
      ['d', direction],
    ]);

    const response = await fetch(`/tool/api/topcards/?${params.toString()}`);
    if (!response.ok) {
      console.error(response);
    }

    Query.set('f', filterInput || '');
    Query.set('p', page.toString());
    Query.set('s', sort);
    Query.set('d', direction);

    const json = await response.json();

    setCards(json.data);
    setCount(json.numResults.toString());
    setLoading(false);
  }, [page, filterInput, sort, direction]);

  useEffect(() => {
    fetchData();
  }, [page, direction, sort, filterInput, fetchData]);

  const updatePage = (index: number) => {
    setLoading(true);
    setPage(index);
  };
  const updateSort = (index: string) => {
    setLoading(true);
    setSort(index);
  };
  const updateDirection = (index: string) => {
    setLoading(true);
    setDirection(index);
  };
  useEffect(() => {
    setLoading(true);
    setPage(0);
  }, [filterInput]);

  const headers = ['Name', 'Elo', 'Total Picks', 'Cube Count'];
  const rows = cards.map((card) => ({
    Name: (
      <AutocardA href={`/tool/card/${card.scryfall_id}`} card={detailsToCard(card)}>
        {card.name}
      </AutocardA>
    ),
    Elo: card.elo === null ? '' : cardElo(detailsToCard(card)).toFixed(0),
    'Total Picks': card.pickCount === null ? '' : card.pickCount,
    'Cube Count': card.cubeCount === null ? '' : card.cubeCount,
  }));

  return (
    <>
      <Controls className="p-2">
        <Flexbox direction="col" gap="2">
          <Banner />
          <Flexbox direction="row" justify="between">
            <Text xl semibold>
              Search cards
            </Text>
            <ResponsiveDiv sm>
              <Flexbox direction="row" gap="4">
                <Link href="/tool/topcards">View Top cards</Link>
                <Link href="/tool/searchcards">Search Cards</Link>
              </Flexbox>
            </ResponsiveDiv>
          </Flexbox>
          <FilterCollapse isOpen buttonLabel="Search" />
          <Row>
            <Col xs={12} sm={6}>
              <Select
                label="Sort"
                value={sort}
                setValue={(value) => updateSort(value)}
                options={ORDERED_SORTS.map((s) => ({ value: s, label: s }))}
              />
            </Col>
            <Col xs={12} sm={6}>
              <Select
                label="Direction"
                value={direction}
                setValue={(value) => updateDirection(value)}
                options={[
                  { value: 'ascending', label: 'Ascending' },
                  { value: 'descending', label: 'Descending' },
                ]}
              />
            </Col>
          </Row>
        </Flexbox>
      </Controls>
      <DynamicFlash />
      {(cards && cards.length) > 0 ? (
        <Flexbox direction="col" gap="2" className="my-2">
          <Flexbox direction="row" justify="between" wrap="wrap" alignItems="center">
            <Text lg semibold className="whitespace-nowrap">
              <ResponsiveDiv baseVisible sm>
                {`${count} results`}
              </ResponsiveDiv>
              <ResponsiveDiv md>{`Found ${count} results for the query: ${filterInput}`}</ResponsiveDiv>
            </Text>
            <Paginate
              count={Math.ceil(parseInt(count, 10) / 96)}
              active={page}
              onClick={(i: number) => updatePage(i)}
            />
          </Flexbox>
          {loading && (
            <div className="centered m-4">
              <Spinner xl />
            </div>
          )}
          {!loading && <Table headers={headers} rows={rows} />}
          <Flexbox direction="row" justify="end">
            <Paginate
              count={Math.ceil(parseInt(count, 10) / 96)}
              active={page}
              onClick={(i: number) => updatePage(i)}
            />
          </Flexbox>
        </Flexbox>
      ) : (
        <Text lg semibold className="mt-2">
          No cards found
        </Text>
      )}
    </>
  );
};

export default TopCardsTable;
