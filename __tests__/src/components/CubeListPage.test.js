import React from 'react';
import { FetchMock } from '@react-mock/fetch';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import exampleCardsFull from '../../../fixtures/examplecardsdetails';
import CubeListPage from 'components/CubeListPage';
import { treeCache } from 'components/AutocompleteInput';
import { act } from 'react-dom/test-utils';

const element = () => (
  <FetchMock
    mocks={[
      { matcher: '/cube/api/cardnames', response: { success: 'true' } },
      { matcher: '/cube/api/cubecardnames/1', response: { success: 'true' } },
      {
        matcher: '/cube/api/getversions',
        response: {
          success: 'true',
          dict: Object.fromEntries(
            exampleCardsFull.map((card) => [
              card.cardID,
              [
                {
                  id: card.cardID,
                  version: card.details.full_name
                    .toUpperCase()
                    .substring(card.details.full_name.indexOf('[') + 1, card.details.full_name.indexOf(']')),
                  img: card.details.image_normal,
                },
              ],
            ]),
          ),
        },
      },
    ]}
  >
    <CubeListPage
      cards={exampleCardsFull}
      cubeID="1"
      canEdit={true}
      maybe={exampleCardsFull}
      defaultTagColors={[]}
      defaultShowTagColors={true}
      defaultSorts={['Color Category', 'Types-Multicolor']}
    />
    ;
  </FetchMock>
);

test('CubeListPage has major functionality', async () => {
  const {
    findByAltText,
    findByPlaceholderText,
    findByDisplayValue,
    findByText,
    getAllByText,
    getByDisplayValue,
    getByPlaceholderText,
    getByText,
  } = render(element());

  expect(getByText(exampleCardsFull[0].details.name));

  // The tests in this file should be integration tests for the whole CubeListPage thing.
  // Test View
  const viewSelect = await findByDisplayValue('Table View');
  for (const view of ['table', 'list', 'curve']) {
    fireEvent.change(viewSelect, { target: { value: view } });
    expect(await findByText(exampleCardsFull[0].details.name));
  }

  fireEvent.change(viewSelect, { target: { value: 'spoiler' } });
  expect(await findByAltText(exampleCardsFull[0].details.name));

  fireEvent.change(viewSelect, { target: { value: 'table' } });
  await findByText(exampleCardsFull[0].details.name);

  // Test Edit Collapse
  fireEvent.click(getByText('Add/Remove'));
  await findByPlaceholderText('Card to Remove');

  // Avoid act warnings.
  await act(() => Promise.all(Object.values(treeCache)));

  expect(getByPlaceholderText('Card to Remove')).toBeInTheDocument();

  // Test Sort Collapse: can we change the sort?
  fireEvent.click(getByText('Sort'));
  await findByText('Primary Sort');
  fireEvent.change(getByDisplayValue('Color Category'), { target: { value: 'Color Identity' } });
  fireEvent.change(getByDisplayValue('Types-Multicolor'), { target: { value: 'Unsorted' } });

  for (const card of exampleCardsFull) {
    expect(getAllByText(card.details.name).length).toBeGreaterThan(0);
  }
});
