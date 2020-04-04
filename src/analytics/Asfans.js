import React, { useState } from 'react';
import PropTypes from 'prop-types';

import { Col, Row, Table, InputGroup, InputGroupAddon, InputGroupText, CustomInput, NavLink } from 'reactstrap';

import { getDraftFormat, matchingCards } from 'utils/draftutil';
import { sortIntoGroups, getSorts } from 'utils/Sort';
import ErrorBoundary from 'components/ErrorBoundary';

const useSortableData = (items, config = null) => {
  const [sortConfig, setSortConfig] = useState(config);

  const sortedItems = React.useMemo(() => {
    const sortableItems = [...items];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] - b[sortConfig.key] < 0) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (a[sortConfig.key] - b[sortConfig.key] > 0) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [items, sortConfig]);

  const requestSort = (key) => {
    let direction = 'descending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'descending') {
      direction = 'ascending';
    }
    setSortConfig({ key, direction });
  };

  return { items: sortedItems, requestSort, sortConfig };
};

const HeaderCell = ({ label, fieldName, sortConfig, requestSort }) => {
  let icon = '/content/nosort.png';

  if (sortConfig && sortConfig.key === fieldName) {
    if (sortConfig.direction === 'descending') {
      icon = '/content/ascending.png';
    } else {
      icon = '/content/descending.png';
    }
  }

  return (
    <th scope="col">
      <NavLink href="#" onClick={() => requestSort(fieldName)}>
        {label} <img src={icon} className="sortIcon" alt="" />
      </NavLink>
    </th>
  );
};

HeaderCell.propTypes = {
  label: PropTypes.string.isRequired,
  fieldName: PropTypes.string.isRequired,
  sortConfig: PropTypes.shape({
    key: PropTypes.string.isRequired,
    direction: PropTypes.string.isRequired,
  }).isRequired,
  requestSort: PropTypes.string.isRequired,
};

const Asfans = ({ cards, cube }) => {
  const sorts = getSorts();

  const [sort, setSort] = useState('Color');
  const [formatId, setFormatId] = useState(-1);

  const draftFormats = cube.draft_formats;

  const calculateAsfans = () => {
    return [
      {
        label: '',
        data: Object.entries(sortIntoGroups(cards, sort)).map((tuple) => {
          return {
            label: tuple[0],
            asfan: (tuple[1].length / cube.cards.length) * 15, // 15 cards a pack
          };
        }),
      },
    ];
  };

  const calculateCustomAsfans = (draftFormat) => {
    const matchesDict = {};
    return draftFormat.map((pack, index) => {
      const asfanDict = {};
      for (const card of cards) {
        let total = 0;
        for (const slot of pack) {
          let sum = 0;
          for (const filter of slot) {
            if (!matchesDict[JSON.stringify(filter)]) {
              matchesDict[JSON.stringify(filter)] = matchingCards(cube.cards, filter);
            }
            const matches = matchesDict[JSON.stringify(filter)];
            if (matches.includes(card)) {
              sum += 1 / matches.length;
            }
          }
          total += sum / slot.length;
        }
        asfanDict[card.cardID] = total;
      }
      console.log(matchesDict);

      return {
        label: `Pack ${index + 1}`,
        data: Object.entries(sortIntoGroups(cards, sort)).map((tuple) => {
          return {
            label: tuple[0],
            asfan: tuple[1].reduce((acc, c) => acc + asfanDict[c.cardID], 0),
          };
        }),
      };
    });
  };

  const asfans = formatId >= 0 ? calculateCustomAsfans(getDraftFormat({ id: formatId }, cube)) : calculateAsfans();

  const { items, requestSort, sortConfig } = useSortableData(asfans);

  return (
    <>
      <Row>
        <Col>
          <h4 className="d-lg-block d-none">Asfans</h4>
          <p>View the expected number of cards per pack, per draft format. Standard Draft assumes 15 card packs.</p>
          <p>
            'Asfan' means expected cards per pack opened. So if red creatures have an Asfan of 2, on average I will see
            2 red creatures in each pack I open.
          </p>
          <InputGroup className="mb-3">
            <InputGroupAddon addonType="prepend">
              <InputGroupText>Draft Format: </InputGroupText>
            </InputGroupAddon>
            <CustomInput
              type="select"
              value={formatId}
              onChange={(event) => setFormatId(parseInt(event.target.value, 10))}
            >
              <option value={-1}>Standard Draft</option>
              {draftFormats.map((format, index) => (
                <option key={format._id} value={index}>
                  {format.title}
                </option>
              ))}
            </CustomInput>
          </InputGroup>
          <InputGroup className="mb-3">
            <InputGroupAddon addonType="prepend">
              <InputGroupText>Order By: </InputGroupText>
            </InputGroupAddon>
            <CustomInput type="select" value={sort} onChange={(event) => setSort(event.target.value)}>
              {sorts.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </CustomInput>
          </InputGroup>
        </Col>
      </Row>
      <ErrorBoundary>
        {items.map((table) => (
          <>
            <h5>{table.label}</h5>
            <Table bordered responsive className="mt-lg-3">
              <thead>
                <tr>
                  <th scope="col">{sort}</th>
                  <HeaderCell label="Asfan" fieldName="mean" sortConfig={sortConfig} requestSort={requestSort} />
                </tr>
              </thead>
              <tbody className="breakdown">
                {table.data.map((row) => (
                  <tr key={row.label}>
                    <th scope="col">{row.label}</th>
                    <td>{row.asfan.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </>
        ))}
      </ErrorBoundary>
    </>
  );
};

Asfans.propTypes = {
  cube: PropTypes.shape({
    cards: PropTypes.arrayOf(PropTypes.shape({})),
    draft_formats: PropTypes.arrayOf(PropTypes.shape({})),
  }).isRequired,
  cards: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
};

export default Asfans;
