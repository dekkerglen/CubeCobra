import React, { useState } from 'react';
import PropTypes from 'prop-types';

import { Col, Row, Table, InputGroup, InputGroupAddon, InputGroupText, CustomInput } from 'reactstrap';

import { getDraftFormat, calculateCustomAsfans, calculateAsfans } from 'utils/draftutil';
import { getSorts } from 'utils/Sort';
import ErrorBoundary from 'components/ErrorBoundary';
import useSortableData from 'hooks/UseSortableData';
import HeaderCell from 'components/HeaderCell';

const Asfans = ({ cards, cube }) => {
  const sorts = getSorts();

  const [sort, setSort] = useState('Color');
  const [formatId, setFormatId] = useState(-1);

  const asfans =
    formatId >= 0
      ? calculateCustomAsfans(cards, cube, sort, getDraftFormat({ id: formatId }, cube))
      : calculateAsfans(cards, cube, sort);

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
              {cube.draft_formats.map((format, index) => (
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
