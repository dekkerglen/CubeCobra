import React from 'react'
import { render, fireEvent, waitForElement } from '@testing-library/react'
import '@testing-library/jest-dom/extend-expect'

import exampleCardsFull from '../../../fixtures/examplecardsdetails';
import CubeListPage from 'components/CubeListPage';

const element = () =><CubeListPage cards={exampleCardsFull} cubeID="1" canEdit={true} maybe={exampleCardsFull} defaultTagColors={[]} defaultShowTagColors={true} defaultSorts={['Color Category', 'Types-Multicolor']} />;

describe('CubeListPage', () => {
  test('displays cards', () => {
    const { getByText } = render(element());

    expect(getByText('Ayara, First of Locthwain'));
  });

  test('opens edit collapse', () => {
    const { getByPlaceholderText, getByText } = render(element());

    fireEvent.click(getByText('Add/Remove'));

    expect(getByPlaceholderText('Card to Add'));
  });
});