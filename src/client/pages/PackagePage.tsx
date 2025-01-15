import React from 'react';

import Banner from 'components/Banner';
import CardPackage from 'components/card/CardPackage';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import CardPackageType from 'datatypes/CardPackage';
import MainLayout from 'layouts/MainLayout';

interface PackagePageProps {
  pack: CardPackageType;
  loginCallback?: string;
}

const PackagePage: React.FC<PackagePageProps> = ({ pack, loginCallback = '/' }) => (
  <MainLayout loginCallback={loginCallback}>
    <Banner />
    <DynamicFlash />
    <CardPackage cardPackage={pack} />
  </MainLayout>
);

export default RenderToRoot(PackagePage);
