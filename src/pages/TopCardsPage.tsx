import React from 'react';
import TopCardsTable from 'components/TopCardsTable';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';
import { FilterContextProvider } from 'contexts/FilterContext';
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
