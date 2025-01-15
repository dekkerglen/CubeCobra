import React from 'react';

import CardSearch from 'components/card/CardSearch';
import RenderToRoot from 'components/RenderToRoot';
import { FilterContextProvider } from 'contexts/FilterContext';
import MainLayout from 'layouts/MainLayout';

interface CardSearchPageProps {
  loginCallback?: string;
}

const CardSearchPage: React.FC<CardSearchPageProps> = ({ loginCallback = '/' }) => {
  return (
    <FilterContextProvider>
      <MainLayout loginCallback={loginCallback}>
        <CardSearch />
      </MainLayout>
    </FilterContextProvider>
  );
};

export default RenderToRoot(CardSearchPage);
