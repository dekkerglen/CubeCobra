import React, { useContext, useEffect, useState } from 'react';
import {
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Col,
  Input,
  InputGroup,
  InputGroupText,
  Row,
  Spinner,
} from 'reactstrap';

import Button from 'components/base/Button';
import CardGrid from 'components/CardGrid';
import DynamicFlash from 'components/DynamicFlash';
import FilterCollapse from 'components/FilterCollapse';
import Paginate from 'components/base/Pagination';
import CubeContext from 'contexts/CubeContext';
import CardDetails from 'datatypes/CardDetails';
import Query from 'utils/Query';
import { ORDERED_SORTS } from 'utils/Sort';
import { detailsToCard } from 'utils/Card';

const CardSearch: React.FC = () => {
  const filterInput = useContext(CubeContext)?.filterInput ?? '';
  const [page, setPage] = useState(parseInt(Query.get('p', '0'), 0));
  const [cards, setCards] = useState<CardDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(Query.get('m', ''));
  const [distinct, setDistinct] = useState(Query.get('di', 'names'));
  const [sort, setSort] = useState(Query.get('s', 'Elo'));
  const [direction, setDirection] = useState(Query.get('d', 'descending'));

  useEffect(() => {
    const fetchData = async () => {
      const params = new URLSearchParams([
        ['p', page.toString()],
        ['f', filterInput],
        ['s', sort],
        ['d', direction],
        ['di', distinct],
      ]);
      const response = await fetch(`/tool/api/searchcards/?${params.toString()}`);
      if (!response.ok) {
        console.error(response);
      }

      Query.set('f', filterInput);
      Query.set('p', page.toString());
      Query.set('s', sort);
      Query.set('d', direction);
      Query.set('di', distinct);

      const json = await response.json();

      setCards(json.data);
      setCount(json.numResults.toString());
      setLoading(false);
    };
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

  return (
    <>
      <div className="usercontrols pt-3">
        <Row className="pb-3 me-1">
          <Col xs="6">
            <h3 className="mx-3">Search cards</h3>
          </Col>
          <Col xs="6">
            <div className="text-end">
              <Button outline color="primary" href="/tool/topcards">
                View Top cards
              </Button>{' '}
              <Button outline color="primary" href="/packages">
                View Card Packages
              </Button>
            </div>
          </Col>
        </Row>
        <FilterCollapse hideDescription isOpen />
        <Row className="px-3">
          <Col xs={12} sm={4}>
            <InputGroup className="mb-3">
              <InputGroupText>Sort: </InputGroupText>
              <Input
                id="card-sort-input"
                type="select"
                value={sort}
                onChange={(event) => updateSort(event.target.value)}
              >
                {ORDERED_SORTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Input>
            </InputGroup>
          </Col>
          <Col xs={12} sm={4}>
            <InputGroup className="mb-3">
              <InputGroupText>Direction: </InputGroupText>
              <Input
                id="card-direction-input"
                type="select"
                value={direction}
                onChange={(event) => updateDirection(event.target.value)}
              >
                <option value="ascending">Ascending</option>
                <option value="descending">Descending</option>
              </Input>
            </InputGroup>
          </Col>
          <Col xs={12} sm={4}>
            <InputGroup className="mb-3">
              <InputGroupText>Distinct: </InputGroupText>
              <Input
                id="card-distinct-input"
                type="select"
                value={distinct}
                onChange={(event) => updateDistinct(event.target.value)}
              >
                <option value="names">Names</option>
                <option value="printings">Printings</option>
              </Input>
            </InputGroup>
          </Col>
        </Row>
      </div>
      <br />
      <DynamicFlash />
      {(cards && cards.length) > 0 ? (
        <Card className="mb-3">
          {parseInt(count, 10) / 96 > 1 && (
            <CardHeader>
              <Paginate
                count={Math.ceil(parseInt(count, 10) / 96)}
                active={page}
                onClick={(i: number) => updatePage(i)}
              />
            </CardHeader>
          )}

          {loading && (
            <CardBody>
              <div className="centered py-3">
                <Spinner className="position-absolute" />
              </div>
            </CardBody>
          )}
          {!loading && (
            <CardGrid
              cards={cards.map(detailsToCard)}
              xs={3}
              md={4}
              xl={6}
              cardProps={{ autocard: true, className: 'clickable' }}
            />
          )}
          {parseInt(count, 10) / 100 > 1 && (
            <CardFooter>
              <Paginate
                count={Math.ceil(parseInt(count, 10) / 96)}
                active={page}
                onClick={(i: number) => updatePage(i)}
              />
            </CardFooter>
          )}
        </Card>
      ) : (
        <h4>No Results</h4>
      )}
    </>
  );
};

export default CardSearch;
