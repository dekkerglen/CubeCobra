import React from 'react';

import CardSearch from 'components/card/CardSearch';
import CubeTray from 'components/cubetray/CubeTray';
import RenderToRoot from 'components/RenderToRoot';
import { CubeTrayProvider } from 'contexts/CubeTrayContext';
import { FilterContextProvider } from 'contexts/FilterContext';
import MainLayout from 'layouts/MainLayout';

const CardSearchPage: React.FC = () => {
  return (
    <FilterContextProvider>
      <CubeTrayProvider>
        <MainLayout useContainer={false} transparentNav>
          <CardSearch />
        </MainLayout>
        <CubeTray />
      </CubeTrayProvider>
    </FilterContextProvider>
  );
};

export default RenderToRoot(CardSearchPage);
