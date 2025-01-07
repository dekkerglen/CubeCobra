import React, { useCallback, useContext, useEffect, useState } from 'react';

import CardGrid from './CardGrid';
import DynamicFlash from '../DynamicFlash';
import FilterCollapse from '../FilterCollapse';
import Paginate from '../base/Pagination';
import CardDetails from '../../datatypes/CardDetails';
import Query from 'utils/Query';
import { ORDERED_SORTS } from 'utils/Sort';
import { cardId, detailsToCard } from 'utils/Card';
import FilterContext from '../../contexts/FilterContext';
import { Row, Col, Flexbox } from '../base/Layout';
import Spinner from '../base/Spinner';
import Select from '../base/Select';
import Controls from '../base/Controls';
import Text from '../base/Text';
import ResponsiveDiv from '../base/ResponsiveDiv';
import Banner from '../Banner';
import Link from '../base/Link';

const CardSearch: React.FC = () => {
  const { filterInput } = useContext(FilterContext);
  const [cards, setCards] = useState<CardDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(parseInt(Query.get('p', '0'), 0));
  const [count, setCount] = useState(Query.get('m', ''));
  const [distinct, setDistinct] = useState(Query.get('di', 'names'));
  const [sort, setSort] = useState(Query.get('s', 'Elo'));
  const [direction, setDirection] = useState(Query.get('d', 'descending'));

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams([
      ['p', page.toString()],
      ['f', filterInput || ''],
      ['s', sort],
      ['d', direction],
      ['di', distinct],
    ]);

    const response = await fetch(`/tool/api/searchcards/?${params.toString()}`);
    if (!response.ok) {
      console.error(response);
    }

    Query.set('f', filterInput || '');
    Query.set('p', page.toString());
    Query.set('s', sort);
    Query.set('d', direction);
    Query.set('di', distinct);

    const json = await response.json();

    setCards(json.data);
    setCount(json.numResults.toString());
    setLoading(false);
  }, [page, filterInput, sort, direction, distinct]);

  useEffect(() => {
    if (filterInput && filterInput !== '') {
      fetchData();
    } else {
      setLoading(false);
      setCards([]);
    }
  }, [page, direction, distinct, sort, filterInput]);

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
  const updateDistinct = (index: string) => {
    setLoading(true);
    setDistinct(index);
  };

  useEffect(() => {
    setLoading(true);
    setPage(0);
  }, [filterInput]);

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
                <Link href="/packages">View Card Packages</Link>
              </Flexbox>
            </ResponsiveDiv>
          </Flexbox>
          <FilterCollapse isOpen buttonLabel="Search" />
          <Row>
            <Col xs={12} sm={4}>
              <Select
                label="Sort"
                value={sort}
                setValue={(value) => updateSort(value)}
                options={ORDERED_SORTS.map((s) => ({ value: s, label: s }))}
              />
            </Col>
            <Col xs={12} sm={4}>
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
            <Col xs={12} sm={4}>
              <Select
                label="Distinct"
                value={distinct}
                setValue={(value) => updateDistinct(value)}
                options={[
                  { value: 'names', label: 'Names' },
                  { value: 'printings', label: 'Printings' },
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
          {!loading && (
            <CardGrid
              cards={cards.map(detailsToCard)}
              xs={2}
              sm={3}
              md={4}
              lg={5}
              xl={6}
              xxl={8}
              cardProps={{ autocard: true, className: 'clickable' }}
              hrefFn={(card) => `/tool/card/${cardId(card)}`}
            />
          )}
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

export default CardSearch;
