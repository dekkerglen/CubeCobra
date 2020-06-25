import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

import { Spinner, Table } from 'reactstrap';

import Query from 'utils/Query';
import { encodeName } from 'utils/Card';
import withAutocard from 'components/WithAutocard';
import Paginate from 'components/Paginate';
import HeaderCell from 'components/HeaderCell';

const AutocardA = withAutocard('a');

const TopCardsTable = ({ filter, setCount, count, cards }) => {
  const [page, setPage] = useState(parseInt(Query.get('p'), 10) || 0);
  const [data, setData] = useState(cards);
  const [loading, setLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState({
    key: Query.get('s') || 'elo',
    direction: Query.get('d') || 'descending',
  });

  useEffect(() => {
    const fetchData = async () => {
      const params = new URLSearchParams([
        ['f', filter],
        ['s', sortConfig.key],
        ['p', page],
        ['d', sortConfig.direction],
      ]);
      const response = await fetch(`/tool/api/topcards/?${params.toString()}`);
      if (!response.ok) {
        console.log(response);
      }

      Query.set('f', filter);
      Query.set('p', page);
      Query.set('s', sortConfig.key);

      const json = await response.json();

      setData(json.data);
      setCount(json.numResults);
      setLoading(false);
    };
    fetchData();
  }, [page, filter, setCount, sortConfig]);

  const updatePage = (index) => {
    setLoading(true);
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

  if (loading) {
    return (
      <>
        {count > 0 && <Paginate count={Math.floor(count / 100)} active={page} onClick={(i) => updatePage(i)} />}
        <div className="centered py-3">
          <Spinner className="position-absolute" />
        </div>
      </>
    );
  }

  console.log(data);
  console.log(count);

  return (
    <>
      <Paginate count={Math.floor(count / 100)} active={page} onClick={(i) => updatePage(i)} />
      <Table responsive className="mt-lg-3">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <HeaderCell label="Elo" fieldName="elo" sortConfig={sortConfig} requestSort={updateSort} />
            <HeaderCell label="Total Picks" fieldName="picks" sortConfig={sortConfig} requestSort={updateSort} />
            <HeaderCell label="Cubes" fieldName="cubes" sortConfig={sortConfig} requestSort={updateSort} />
          </tr>
        </thead>

        <tbody>
          {data.map((row) => (
            <tr key={row[0]}>
              <td>
                <AutocardA front={row[1]} back={row[2] || undefined} href={`/tool/card/${encodeName(row[0])}`}>
                  {row[0]}
                </AutocardA>
              </td>
              <td>{row[4] === null ? '' : row[4].toFixed(0)}</td>
              <td>{row[3] === null ? '' : row[3]}</td>
              <td>{row[5] === null ? '' : row[5]}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
};

/*

<tbody className="breakdown">
  {secondaryLabels.map((label) => (
  ))}
</tbody>

*/

TopCardsTable.propTypes = {
  cards: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.any)).isRequired,
  filter: PropTypes.string,
  setCount: PropTypes.func.isRequired,
  count: PropTypes.number.isRequired,
};

TopCardsTable.defaultProps = {
  filter: '',
};

export default TopCardsTable;
