import { Dispatch, SetStateAction } from 'react';

import { NumCols } from '../components/base/Layout';
import useLocalStorage from './useLocalStorage';

const useCardsPerRow = (): [NumCols, Dispatch<SetStateAction<NumCols>>] => useLocalStorage<NumCols>('cardsPerRow', 6);

export default useCardsPerRow;
