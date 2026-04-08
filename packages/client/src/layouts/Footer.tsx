import React, { useEffect } from 'react';

import { Col, Row } from '../components/base/Layout';
import Text from '../components/base/Text';
import Copyright from '../components/Copyright';

interface FooterLinkProps {
  href: string;
  children: React.ReactNode;
}

const FooterLink: React.FC<FooterLinkProps> = ({ href, children }) => (
  <a className="text-text-secondary-active hover:text-text-secondary" href={href}>
    {children}
  </a>
);

const Footer: React.FC = () => {
  useEffect(() => {
    // @ts-expect-error __cmp is a global variable
    if (window['__cmp']) {
      // @ts-expect-error __cmp is a global variable
      window['__cmp']('addConsentLink');
    }
  });

  return (
    <footer className="bg-bg-secondary text-text-secondary py-6">
      <div className="container mx-auto px-4">
        <Row>
          <Col xs={6} sm={3}>
            <Text sm>
              <Text semibold lg>
                Content
              </Text>
              <ul className="list-none p-0">
                <li className="mb-2">
                  <FooterLink href="/content/browse">Browse</FooterLink>
                </li>
                <li className="mb-2">
                  <FooterLink href="/content/articles">Articles</FooterLink>
                </li>
                <li className="mb-2">
                  <FooterLink href="/content/podcasts">Podcasts</FooterLink>
                </li>
                <li className="mb-2">
                  <FooterLink href="/content/videos">Videos</FooterLink>
                </li>
              </ul>
            </Text>
          </Col>
          <Col xs={6} sm={3}>
            <Text sm>
              <Text semibold lg>
                Cube
              </Text>
              <ul className="list-none p-0">
                <li className="mb-2">
                  <FooterLink href="/explore">Explore Cubes</FooterLink>
                </li>
                <li className="mb-2">
                  <FooterLink href="/search">Search Cubes</FooterLink>
                </li>
              </ul>
            </Text>
          </Col>
          <Col xs={6} sm={3}>
            <Text sm>
              <Text semibold lg>
                Cards
              </Text>
              <ul className="list-none p-0">
                <li className="mb-2">
                  <FooterLink href="/tool/topcards">Top Cards</FooterLink>
                </li>
                <li className="mb-2">
                  <FooterLink href="/tool/searchcards">Search Cards</FooterLink>
                </li>
                <li className="mb-2">
                  <FooterLink href="/packages">Packages</FooterLink>
                </li>
                <li className="mb-2">
                  <FooterLink href="/filters">Filter Syntax</FooterLink>
                </li>
                <li className="mb-2">
                  <FooterLink href="/tool/cardupdates">Card Updates</FooterLink>
                </li>
              </ul>
            </Text>
          </Col>
          <Col xs={6} sm={3}>
            <Text sm>
              <Text semibold lg>
                Cube Cobra
              </Text>
              <ul className="list-none p-0">
                <li className="mb-2">
                  <FooterLink href="/dev/blog">Dev Blog</FooterLink>
                </li>
                <li className="mb-2">
                  <FooterLink href="/contact">Contact</FooterLink>
                </li>
                {/* <li className="mb-2">
                  <FooterLink href="/merchandise">Merchandise</FooterLink>
                </li> */}
                <li className="mb-2">
                  <FooterLink href="/donate">Donate</FooterLink>
                </li>
                <li className="mb-2">
                  <FooterLink href="https://github.com/dekkerglen/CubeCobra">Github</FooterLink>
                </li>
              </ul>
            </Text>
          </Col>
        </Row>
        <div id="ncmp-consent-link"></div>
        <p className="text-center text-sm mt-6">
          <FooterLink href="/privacy">Privacy Policy</FooterLink>
          {' | '}
          <FooterLink href="/tos">Terms & Conditions</FooterLink>
          {' | '}
          <FooterLink href="/cookies">Cookies</FooterLink>
          <br />
          Magic: The Gathering is © <FooterLink href="https://company.wizards.com/">Wizards of the Coast</FooterLink>
          . Cube Cobra is not affiliated nor produced nor endorsed by Wizards of the Coast.
          <br />
          All card images, mana symbols, expansions and art related to Magic the Gathering is a property of Wizards of
          the Coast/Hasbro.
          <br />
          This site is not affiliated nor endorsed by Scryfall LLC. This site endeavours to adhere to the Scryfall data
          guidelines.
          <br />
          Custom card images displayed in Cube Cobra are subject to the license terms under which they were uploaded to
          their hosts. Cube Cobra is not responsible for the content of custom card images. To report a custom card
          image violation, message the development team on{' '}
          <FooterLink href="https://discord.gg/YYF9x65Ane">Discord</FooterLink>
          .
          <br />
          <Copyright />
        </p>
      </div>
    </footer>
  );
};

export default Footer;
