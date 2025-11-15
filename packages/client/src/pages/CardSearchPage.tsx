import React from 'react';

import CardSearch from 'components/card/CardSearch';
import RenderToRoot from 'components/RenderToRoot';
import { FilterContextProvider } from 'contexts/FilterContext';
import MainLayout from 'layouts/MainLayout';

const CardSearchPage: React.FC = () => {
  return (
    <FilterContextProvider>
      <MainLayout>
        <CardSearch />
      </MainLayout>
    </FilterContextProvider>
  );
};

export default RenderToRoot(CardSearchPage);
