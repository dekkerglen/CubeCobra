import React from 'react';

import BlogPostType from '@utils/datatypes/BlogPost';
import Cube, { CubeCards } from '@utils/datatypes/Cube';

import { Card, CardBody } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import DynamicFlash from 'components/DynamicFlash';
import { SafeMarkdown } from 'components/Markdown';
import RenderToRoot from 'components/RenderToRoot';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';

interface CubeOverviewProps {
  post: BlogPostType;
  priceOwned: number;
  pricePurchase: number;
  cube: Cube;
  cards: CubeCards;
  followed: boolean;
  followersCount: number;
}

const CubeOverview: React.FC<CubeOverviewProps> = ({ cards, cube }) => {
  return (
    <MainLayout useContainer={false}>
      <CubeLayout cards={cards} cube={cube} activeLink="primer">
        <Flexbox direction="col" gap="2" className="mb-2">
          <DynamicFlash />
          {cube.description && (
            <Card>
              <CardBody>
                <SafeMarkdown markdown={cube.description} />
              </CardBody>
            </Card>
          )}
        </Flexbox>
      </CubeLayout>
    </MainLayout>
  );
};

export default RenderToRoot(CubeOverview);
