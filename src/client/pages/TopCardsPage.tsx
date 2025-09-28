import React from 'react';

import RenderToRoot from 'components/RenderToRoot';
import TopCardsTable from 'components/TopCardsTable';
import { FilterContextProvider } from 'contexts/FilterContext';
import MainLayout from 'layouts/MainLayout';

const TopCardsPage: React.FC = () => (
  <FilterContextProvider>
    <MainLayout>
      <TopCardsTable />
    </MainLayout>
  </FilterContextProvider>
);

export default RenderToRoot(TopCardsPage);
