import React from 'react'
import { render, fireEvent, waitForElement } from '@testing-library/react'
import '@testing-library/jest-dom/extend-expect'

import exampleCardsFull from '../../../fixtures/examplecardsdetails';
import CubeListPage from 'components/CubeListPage';

describe('CubeListPage', () => {
  test('displays cards', () => {
    const { getByText } = render(<CubeListPage cards={exampleCardsFull} cubeID="1" canEdit={true} maybe={exampleCardsFull} defaultTagColors={[]} defaultShowTagColors={true} defaultSorts={['Color Category', 'Types-Multicolor']} />);

    expect(getByText('Ayara, First of Locthwain'));
  });
});