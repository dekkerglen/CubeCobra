import React, { useState, useEffect } from 'react';

import { Card, CardHeader, CardFooter, CardBody, Spinner, Row, Col } from 'reactstrap';

import Query from 'utils/Query';
import Paginate from 'components/Paginate';
import DynamicFlash from 'components/DynamicFlash';
import ButtonLink from 'components/ButtonLink';
import CardGrid from 'components/CardGrid';
import CardImage from 'components/CardImage';
import FilterCollapse from 'components/FilterCollapse';

const CardSearchPage = () => {
  const [page, setPage] = useState(parseInt(Query.get('p'), 0) || 0);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState(Query.get('f') || '');
  const [count, setCount] = useState(Query.get('m') || '');
  const [sortConfig, setSortConfig] = useState({
    key: Query.get('s') || 'elo',
    direction: Query.get('d') || 'descending',
  });

  useEffect(() => {
    const fetchData = async () => {
      const params = new URLSearchParams([
        ['p', page],
        ['f', filter],
        ['s', sortConfig.key],
        ['d', sortConfig.direction],
      ]);
      const response = await fetch(`/tool/api/searchcards/?${params.toString()}`);
      if (!response.ok) {
        console.log(response);
      }

      Query.set('f', filter);
      Query.set('p', page);
      Query.set('s', sortConfig.key);

      const json = await response.json();

      console.log(json);

      setCards(json.data);
      setCount(json.numResults);
      setLoading(false);
    };
    if (filter && filter !== '') {
      fetchData();
    }
  }, [page, filter, sortConfig]);

  const updateFilter = (_, filterInput) => {
    setLoading(true);
    setFilter(filterInput);
  };

  const updatePage = (index) => {
    setLoading(true);
    setPage(0);
    setPage(index);
  };

  const updateSort = (key) => {
    setLoading(true);
    let direction = 'descending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'descending') {
      direction = 'ascending';
    }
    setSortConfig({ key, direction });
  };

  return (
    <>
      <div className="usercontrols pt-3 mb-3">
        <Row className="pb-3 mr-1">
          <Col xs="6">
            <h3 className="mx-3">Search Cards</h3>
          </Col>
          <Col xs="6">
            <div className="text-right">
              <ButtonLink outline color="success" href="/tool/topcards">
                View Top Cards
              </ButtonLink>
            </div>
          </Col>
        </Row>
        <FilterCollapse
          defaultFilterText={filter.length > 0 ? filter : null}
          filter={filter}
          setFilter={updateFilter}
          numCards={count}
          isOpen
        />
      </div>
      <br />
      <DynamicFlash />
      {loading && (
        <CardBody>
          <div className="centered py-3">
            <Spinner className="position-absolute" />
          </div>
        </CardBody>
      )}
      {!loading && (
        <>
          {(cards && cards.length) > 0 ? (
            <Card>
              {count / 100 > 0 && (
                <CardHeader>
                  <Paginate count={Math.floor(count / 96)} active={page} onClick={(i) => updatePage(i)} />
                </CardHeader>
              )}
              <CardGrid
                cardList={cards.map((card) => ({ details: card }))}
                Tag={CardImage}
                colProps={{ xs: 4, sm: 3, md: 2 }}
                cardProps={{ autocard: true, 'data-in-modal': true, className: 'clickable' }}
                linkDetails
              />
              {count / 100 > 0 && (
                <CardFooter>
                  <Paginate count={Math.floor(count / 96)} active={page} onClick={(i) => updatePage(i)} />
                </CardFooter>
              )}
            </Card>
          ) : (
            <h4>No Results</h4>
          )}
        </>
      )}
    </>
  );
};

export default CardSearchPage;
