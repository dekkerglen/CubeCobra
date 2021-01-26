import React from 'react';

import { Row, Col, Container } from 'reactstrap';

import Copyright from 'components/Copyright';

const Footer = () => (
  <footer>
    <Container className="pt-3">
      <Row>
        <Col xs="6" sm="3">
          <small>
            <h6 className="footer-header">Content</h6>
            <ul className="footer-ul pl-0">
              <li>
                <a className="footer-link" href="/content/browse">
                  Browse
                </a>
              </li>
              <li>
                <a className="footer-link" href="/content/articles">
                  Articles
                </a>
              </li>
              <li>
                <a className="footer-link" href="/content/podcasts">
                  Podcasts
                </a>
              </li>
              <li>
                <a className="footer-link" href="/content/videos">
                  Videos
                </a>
              </li>
            </ul>
          </small>
        </Col>
        <Col xs="6" sm="3">
          <small>
            <h6 className="footer-header">Cube</h6>
            <ul className="footer-ul pl-0">
              <li>
                <a className="footer-link" href="/explore">
                  Explore Cubes
                </a>
              </li>
              <li>
                <a className="footer-link" href="/search">
                  Search Cubes
                </a>
              </li>
              <li>
                <a className="footer-link" href="/random">
                  Random Cube
                </a>
              </li>
            </ul>
          </small>
        </Col>
        <Col xs="6" sm="3">
          <small>
            <h6 className="footer-header">Cards</h6>
            <ul className="footer-ul pl-0">
              <li>
                <a className="footer-link" href="/tool/topcards">
                  Top Cards
                </a>
              </li>
              <li>
                <a className="footer-link" href="/tool/searchcards">
                  Search Cards
                </a>
              </li>
              <li>
                <a className="footer-link" href="/tool/randomcard">
                  Random Card
                </a>
              </li>
              <li>
                <a className="footer-link" href="/filters">
                  Filter Syntax
                </a>
              </li>
            </ul>
          </small>
        </Col>
        <Col xs="6" sm="3">
          <small>
            <h6 className="footer-header">Cube Cobra</h6>
            <ul className="footer-ul pl-0">
              <li>
                <a className="footer-link" href="/dev/blog">
                  Dev Blog
                </a>
              </li>
              <li>
                <a className="footer-link" href="/contact">
                  Contact
                </a>
              </li>
              <li>
                <a
                  className="footer-link"
                  href="https://www.inkedgaming.com/collections/artists/gwen-dekker?rfsn=4250904.d3f372&utm_source=refersion&utm_medium=affiliate&utm_campaign=4250904.d3f372"
                >
                  Merchandise
                </a>
              </li>
              <li>
                <a className="footer-link" href="/ourstory">
                  Our Story
                </a>
              </li>
              <li>
                <a className="footer-link" href="/faq">
                  FAQ
                </a>
              </li>
              <li>
                <a className="footer-link" href="/donate">
                  Donate
                </a>
              </li>
              <li>
                <a className="footer-link" href="https://github.com/dekkerglen/CubeCobra">
                  Github
                </a>
              </li>
            </ul>
          </small>
        </Col>
      </Row>
      <p className="center footer-text">
        <a className="footer-link" href="/privacy">
          Privacy Policy
        </a>
        {' | '}
        <a className="footer-link" href="/tos">
          Terms & Conditions
        </a>
        {' | '}
        <a className="footer-link" href="/cookies">
          Cookies
        </a>
        <br />
        Magic: The Gathering is ©{' '}
        <a className="footer-link" href="https://company.wizards.com/">
          Wizards of the Coast
        </a>
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
        violation, message the development team on{' '}
        <a className="footer-link" href="https://discord.gg/Hn39bCU">
          Discord
        </a>
        .
        <br />
        <Copyright />
      </p>
    </Container>
  </footer>
);

export default Footer;
