import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import RotisserieDraftModal from 'components/modals/RotisserieDraftModal';
import { rotoListUrl } from 'utils/rotodraft';

describe('rotoListUrl', () => {
  it('links to the cube list with the sheet URL encoded as rotoURL', () => {
    const sheet = 'https://docs.google.com/spreadsheets/d/e/abc/pub?gid=1&single=true&output=csv';
    const url = rotoListUrl('cube-1', sheet);
    expect(url.startsWith('/cube/list/cube-1?rotoURL=')).toBe(true);
    expect(new URLSearchParams(url.split('?')[1]).get('rotoURL')).toBe(sheet);
  });
});

describe('RotisserieDraftModal', () => {
  it('hands the entered sheet URL to onSubmit and closes', () => {
    const onSubmit = jest.fn();
    const setOpen = jest.fn();
    render(<RotisserieDraftModal isOpen setOpen={setOpen} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Google Sheet CSV URL:'), { target: { value: 'https://sheet.csv' } });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    expect(onSubmit).toHaveBeenCalledWith('https://sheet.csv');
    expect(setOpen).toHaveBeenCalledWith(false);
  });

  it('does not submit an empty URL', () => {
    const onSubmit = jest.fn();
    render(<RotisserieDraftModal isOpen setOpen={jest.fn()} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
