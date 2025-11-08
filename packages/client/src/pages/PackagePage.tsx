import React from 'react';

import Banner from 'components/Banner';
import CardPackage from 'components/card/CardPackage';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';

import CardPackageType from '@utils/datatypes/CardPackage';

interface PackagePageProps {
  pack: CardPackageType;
}

const PackagePage: React.FC<PackagePageProps> = ({ pack }) => (
  <MainLayout>
    <Banner />
    <DynamicFlash />
    <CardPackage cardPackage={pack} />
  </MainLayout>
);

export default RenderToRoot(PackagePage);
