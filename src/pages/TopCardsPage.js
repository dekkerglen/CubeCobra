import React, { useState } from 'react';
import PropTypes from 'prop-types';
import UserPropType from 'proptypes/UserPropType';

import DynamicFlash from 'components/DynamicFlash';
import FilterCollapse from 'components/FilterCollapse';
import TopCardsTable from 'components/TopCardsTable';
import { Row, Col } from 'reactstrap';
import ButtonLink from 'components/ButtonLink';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';
import useQueryParam from 'hooks/useQueryParam';

const TopCardsPage = ({ user, data, numResults, loginCallback }) => {
  const [filter, setFilter] = useQueryParam('f', '');
  const [count, setCount] = useState(numResults);

  const updateFilter = (_, filterInput) => {
    setFilter(filterInput);
  };

  return (
    <MainLayout loginCallback={loginCallback} user={user}>
      <div className="usercontrols pt-3 mb-3">
        <Row className="pb-3 mr-1">
          <Col xs="6">
            <h3 className="mx-3">Top Cards</h3>
          </Col>
          <Col xs="6">
            <div className="text-right">
              <ButtonLink outline color="success" href="/tool/searchcards">
                Search All Cards
              </ButtonLink>{' '}
              <ButtonLink outline color="success" href="/packages/browse">
                View Card Packages
              </ButtonLink>
            </div>
          </Col>
        </Row>
        <FilterCollapse
          isOpen
          defaultFilterText=""
          filter={filter}
          setFilter={updateFilter}
          numCards={count}
          numShown={Math.min(count, 100)}
        />
      </div>
      <DynamicFlash />
      <TopCardsTable filter={filter} setCount={setCount} count={count} cards={data} />
    </MainLayout>
  );
};

TopCardsPage.propTypes = {
  data: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.any)).isRequired,
  numResults: PropTypes.number.isRequired,
  user: UserPropType,
  loginCallback: PropTypes.string,
};

TopCardsPage.defaultProps = {
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(TopCardsPage);
