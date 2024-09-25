import React from 'react';
import { Col, Container, Row } from 'reactstrap';

import Copyright from 'components/Copyright';

interface FooterLinkProps {
  href: string;
  children: React.ReactNode;
}

const FooterLink: React.FC<FooterLinkProps> = ({ href, children }) => (
  <a className="footer-link" href={href}>
    {children}
  </a>
);

const Footer: React.FC = () => (
  <footer>
    <Container className="pt-3">
      <Row>
        <Col xs="6" sm="3">
          <small>
            <h6 className="footer-header">Content</h6>
            <ul className="footer-ul ps-0">
              <li>
                <FooterLink href="/content/browse">Browse</FooterLink>
              </li>
              <li>
                <FooterLink href="/content/articles">Articles</FooterLink>
              </li>
              <li>
                <FooterLink href="/content/podcasts">Podcasts</FooterLink>
              </li>
              <li>
                <FooterLink href="/content/videos">Videos</FooterLink>
              </li>
            </ul>
          </small>
        </Col>
        <Col xs="6" sm="3">
          <small>
            <h6 className="footer-header">Cube</h6>
            <ul className="footer-ul ps-0">
              <li>
                <FooterLink href="/explore">Explore Cubes</FooterLink>
              </li>
              <li>
                <FooterLink href="/search">Search Cubes</FooterLink>
              </li>
            </ul>
          </small>
        </Col>
        <Col xs="6" sm="3">
          <small>
            <h6 className="footer-header">Cards</h6>
            <ul className="footer-ul ps-0">
              <li>
                <FooterLink href="/tool/topcards">Top Cards</FooterLink>
              </li>
              <li>
                <FooterLink href="/tool/searchcards">Search Cards</FooterLink>
              </li>
              <li>
                <FooterLink href="/packages/browse">Packages</FooterLink>
              </li>
              <li>
                <FooterLink href="/filters">Filter Syntax</FooterLink>
              </li>
            </ul>
          </small>
        </Col>
        <Col xs="6" sm="3">
          <small>
            <h6 className="footer-header">Cube Cobra</h6>
            <ul className="footer-ul ps-0">
              <li>
                <FooterLink href="/dev/blog">Dev Blog</FooterLink>
              </li>
              <li>
                <FooterLink href="/contact">Contact</FooterLink>
              </li>
              <li>
                <FooterLink href="https://www.inkedgaming.com/collections/artists-gwen-dekker?rfsn=4250904.d3f372&utm_source=refersion&utm_medium=affiliate&utm_campaign=4250904.d3f372">
                  Merchandise
                </FooterLink>
              </li>
              <li>
                <FooterLink href="/donate">Donate</FooterLink>
              </li>
              <li>
                <FooterLink href="https://github.com/dekkerglen/CubeCobra">Github</FooterLink>
              </li>
            </ul>
          </small>
        </Col>
      </Row>
      <p className="center footer-text">
        <FooterLink href="/privacy">Privacy Policy</FooterLink>
        {' | '}
        <FooterLink href="/tos">Terms & Conditions</FooterLink>
        {' | '}
        <FooterLink href="/cookies">Cookies</FooterLink>
        <br />
        Magic: The Gathering is © <FooterLink href="https://company.wizards.com/">Wizards of the Coast</FooterLink>
        . Cube Cobra is not affiliated nor produced nor endorsed by Wizards of the Coast.
        <br />
        All card images, mana symbols, expansions and art related to Magic the Gathering is a property of Wizards of the
        Coast/Hasbro.
        <br />
        This site is not affiliated nor endorsed by Scryfall LLC. This site endeavours to adhere to the Scryfall data
        guidelines.
        <br />
        Custom card images displayed in Cube Cobra are subject to the license terms under which they were uploaded to
        their hosts. Cube Cobra is not responsible for the content of custom card images. To report a custom card image
        violation, message the development team on <FooterLink href="https://discord.gg/Hn39bCU">Discord</FooterLink>
        .
        <br />
        <Copyright />
      </p>
    </Container>
  </footer>
);

export default Footer;
