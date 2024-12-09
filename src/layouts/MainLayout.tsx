import React from 'react';

import { Flexbox } from 'components/base/Layout';
import ErrorBoundary from 'components/ErrorBoundary';
import MobileBanner from 'components/MobileBanner';
import SideBanner from 'components/SideBanner';
import useToggle from 'hooks/UseToggle';
import Footer from 'layouts/Footer';
import Navbar from 'components/nav/Navbar';
import ResponsiveDiv from 'components/base/ResponsiveDiv';
import Container from 'components/base/Container';
import VideoBanner from 'components/VideoBanner';

interface MainLayoutProps {
  children: React.ReactNode;
  loginCallback?: string;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children, loginCallback = '/' }) => {
  const [expanded, toggle] = useToggle(false);

  return (
    <Flexbox className="min-h-screen text-text" direction="col">
      <Navbar expanded={expanded} toggle={toggle} loginCallback={loginCallback} />
      <div className="bg-bg flex-grow">
        <Container xxxl>
          <Flexbox className="flex-grow max-w-full" direction="row" gap="4">
            <ResponsiveDiv xl className="pl-2 py-2 min-w-fit">
              <SideBanner placementId="left-rail" />
            </ResponsiveDiv>
            <div className="flex-grow px-2 max-w-full">
              <ErrorBoundary>{children}</ErrorBoundary>
            </div>
            <ResponsiveDiv lg className="pr-2 py-2 min-w-fit">
              <SideBanner placementId="right-rail" />
            </ResponsiveDiv>
            <ResponsiveDiv md>
              <VideoBanner placementId="video" />
            </ResponsiveDiv>
          </Flexbox>
        </Container>
      </div>
      <Footer />
      <ResponsiveDiv baseVisible md>
        <MobileBanner placementId="mobile-banner" />
      </ResponsiveDiv>
    </Flexbox>
  );
};

export default MainLayout;
