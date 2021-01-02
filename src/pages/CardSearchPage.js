import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import UserPropType from 'proptypes/UserPropType';

import {
  Card,
  CardHeader,
  CardFooter,
  CardBody,
  Spinner,
  Row,
  Col,
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  CustomInput,
} from 'reactstrap';

import Query from 'utils/Query';
import Paginate from 'components/Paginate';
import DynamicFlash from 'components/DynamicFlash';
import ButtonLink from 'components/ButtonLink';
import CardGrid from 'components/CardGrid';
import CardImage from 'components/CardImage';
import FilterCollapse from 'components/FilterCollapse';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

const CardSearchPage = ({ user, loginCallback }) => {
  const [page, setPage] = useState(parseInt(Query.get('p'), 0) || 0);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState(Query.get('f') || '');
  const [count, setCount] = useState(Query.get('m') || '');
  const [distinct, setDistinct] = useState(Query.get('di') || 'names');
  const [sort, setSort] = useState(Query.get('s') || 'elo');
  const [direction, setDirection] = useState(Query.get('d') || 'descending');

  useEffect(() => {
    const fetchData = async () => {
      const params = new URLSearchParams([
        ['p', page],
        ['f', filter],
        ['s', sort],
        ['d', direction],
        ['di', distinct],
      ]);
      const response = await fetch(`/tool/api/searchcards/?${params.toString()}`);
      if (!response.ok) {
        console.log(response);
      }

      Query.set('f', filter);
      Query.set('p', page);
      Query.set('s', sort);
      Query.set('d', direction);
      Query.set('di', distinct);

      const json = await response.json();

      setCards(json.data);
      setCount(json.numResults);
      setLoading(false);
    };
    if (filter && filter !== '') {
      fetchData();
    } else {
      setLoading(false);
      setCards([]);
    }
  }, [page, filter, direction, distinct, sort]);

  const updateFilter = (_, filterInput) => {
    setLoading(true);
    setPage(0);
    setCount(0);
    setFilter(filterInput);
  };

  const updatePage = (index) => {
    setLoading(true);
    setPage(index);
  };
  const updateSort = (index) => {
    setLoading(true);
    setSort(index);
  };
  const updateDirection = (index) => {
    setLoading(true);
    setDirection(index);
  };
  const updateDistinct = (index) => {
    setLoading(true);
    setDistinct(index);
  };

  return (
    <MainLayout loginCallback={loginCallback} user={user}>
      <div className="usercontrols pt-3">
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
        <Row className="px-3">
          <Col xs={12} sm={4}>
            <InputGroup className="mb-3">
              <InputGroupAddon addonType="prepend">
                <InputGroupText>Sort: </InputGroupText>
              </InputGroupAddon>
              <CustomInput type="select" value={sort} onChange={(event) => updateSort(event.target.value)}>
                <option value="elo">Elo</option>
                <option value="date">Release Date</option>
                <option value="price">Price</option>
                <option value="alphabetical">Alphabetical</option>
              </CustomInput>
            </InputGroup>
          </Col>
          <Col xs={12} sm={4}>
            <InputGroup className="mb-3">
              <InputGroupAddon addonType="prepend">
                <InputGroupText>Direction: </InputGroupText>
              </InputGroupAddon>
              <CustomInput type="select" value={direction} onChange={(event) => updateDirection(event.target.value)}>
                <option value="ascending">Ascending</option>
                <option value="descending">Descending</option>
              </CustomInput>
            </InputGroup>
          </Col>
          <Col xs={12} sm={4}>
            <InputGroup className="mb-3">
              <InputGroupAddon addonType="prepend">
                <InputGroupText>Distinct: </InputGroupText>
              </InputGroupAddon>
              <CustomInput type="select" value={distinct} onChange={(event) => updateDistinct(event.target.value)}>
                <option value="names">Names</option>
                <option value="printings">Printings</option>
              </CustomInput>
            </InputGroup>
          </Col>
        </Row>
      </div>
      <br />
      <DynamicFlash />
      {(cards && cards.length) > 0 ? (
        <Card className="mb-3">
          {count / 96 > 1 && (
            <CardHeader>
              <Paginate count={Math.floor(count / 96)} active={page} onClick={(i) => updatePage(i)} />
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
              cardList={cards.map((card) => ({ details: card }))}
              Tag={CardImage}
              colProps={{ xs: 4, sm: 3, md: 2 }}
              cardProps={{ autocard: true, 'data-in-modal': true, className: 'clickable' }}
              linkDetails
            />
          )}
          {count / 100 > 1 && (
            <CardFooter>
              <Paginate count={Math.floor(count / 96)} active={page} onClick={(i) => updatePage(i)} />
            </CardFooter>
          )}
        </Card>
      ) : (
        <h4>No Results</h4>
      )}
    </MainLayout>
  );
};

CardSearchPage.propTypes = {
  user: UserPropType,
  loginCallback: PropTypes.string,
};

CardSearchPage.defaultProps = {
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(CardSearchPage);
