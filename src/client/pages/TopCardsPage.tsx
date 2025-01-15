import React from 'react';

import RenderToRoot from 'components/RenderToRoot';
import TopCardsTable from 'components/TopCardsTable';
import { FilterContextProvider } from 'contexts/FilterContext';
import MainLayout from 'layouts/MainLayout';
interface TopCardsPageProps {
  loginCallback?: string;
}

const TopCardsPage: React.FC<TopCardsPageProps> = ({ loginCallback = '/' }) => (
  <FilterContextProvider>
    <MainLayout loginCallback={loginCallback}>
      <TopCardsTable />
    </MainLayout>
  </FilterContextProvider>
);

export default RenderToRoot(TopCardsPage);
