import React from 'react'
import { FetchMock } from '@react-mock/fetch';
import { render, fireEvent, waitForElement, wait } from '@testing-library/react'
import '@testing-library/jest-dom/extend-expect'

import exampleCardsFull from '../../../fixtures/examplecardsdetails';
import CubeListPage from 'components/CubeListPage';
import { treeCache } from 'components/AutocompleteInput';
import { act } from 'react-dom/test-utils';

const element = () => (
  <FetchMock
    mocks={[
      { matcher: '/cube/api/cardnames', response: { success: 'true' } },
      { matcher: '/cube/api/cubecardnames/1', response: { success: 'true' } },
    ]}
  >
    <CubeListPage cards={exampleCardsFull} cubeID="1" canEdit={true} maybe={exampleCardsFull} defaultTagColors={[]} defaultShowTagColors={true} defaultSorts={['Color Category', 'Types-Multicolor']} />;
  </FetchMock>
);

test('CubeListPage has major functionality', async () => {
  const { findByPlaceholderText, findByText, getAllByText, getByDisplayValue, getByPlaceholderText, getByText } = render(element());

  expect(getByText(exampleCardsFull[0].details.name));

  // TODO: These tests should be in their own files.
  // Test Edit Collapse
  fireEvent.click(getByText('Add/Remove'));
  await findByPlaceholderText('Card to Remove');

  // Avoid act warnings.
  await act(() => Promise.all(Object.values(treeCache)));

  expect(getByPlaceholderText('Card to Remove')).toBeInTheDocument();

  // Test Sort Collapse
  fireEvent.click(getByText('Sort'));
  await findByText('Primary Sort');
  fireEvent.change(getByDisplayValue('Color Category'), { target: { value: 'Color Identity' } });
  fireEvent.change(getByDisplayValue('Types-Multicolor'), { target: { value: 'Unsorted' } });

  for (const card of exampleCardsFull) {
    expect(getAllByText(card.details.name).length).toBeGreaterThan(0);
  }
});