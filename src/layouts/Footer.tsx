import React, { useEffect } from 'react';
import Copyright from 'components/Copyright';
import Text from 'components/base/Text';

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
        <div className="flex flex-wrap -mx-4">
          <div className="w-full sm:w-1/2 md:w-1/4 px-4 mb-6">
            <Text sm>
              <h6 className="text-lg font-semibold mb-2">Content</h6>
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
          </div>
          <div className="w-full sm:w-1/2 md:w-1/4 px-4 mb-6">
            <Text sm>
              <h6 className="text-lg font-semibold mb-2">Cube</h6>
              <ul className="list-none p-0">
                <li className="mb-2">
                  <FooterLink href="/explore">Explore Cubes</FooterLink>
                </li>
                <li className="mb-2">
                  <FooterLink href="/search">Search Cubes</FooterLink>
                </li>
              </ul>
            </Text>
          </div>
          <div className="w-full sm:w-1/2 md:w-1/4 px-4 mb-6">
            <Text sm>
              <h6 className="text-lg font-semibold mb-2">Cards</h6>
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
              </ul>
            </Text>
          </div>
          <div className="w-full sm:w-1/2 md:w-1/4 px-4 mb-6">
            <Text sm>
              <h6 className="text-lg font-semibold mb-2">Cube Cobra</h6>
              <ul className="list-none p-0">
                <li className="mb-2">
                  <FooterLink href="/dev/blog">Dev Blog</FooterLink>
                </li>
                <li className="mb-2">
                  <FooterLink href="/contact">Contact</FooterLink>
                </li>
                <li className="mb-2">
                  <FooterLink href="https://www.inkedgaming.com/collections/artists-gwen-dekker?rfsn=4250904.d3f372&utm_source=refersion&utm_medium=affiliate&utm_campaign=4250904.d3f372">
                    Merchandise
                  </FooterLink>
                </li>
                <li className="mb-2">
                  <FooterLink href="/donate">Donate</FooterLink>
                </li>
                <li className="mb-2">
                  <FooterLink href="https://github.com/dekkerglen/CubeCobra">Github</FooterLink>
                </li>
              </ul>
            </Text>
          </div>
        </div>
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
          <FooterLink href="https://discord.gg/Hn39bCU">Discord</FooterLink>
          .
          <br />
          <Copyright />
        </p>
      </div>
    </footer>
  );
};

export default Footer;
