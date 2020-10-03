import React from 'react';
import PropTypes from 'prop-types';

import { Card, CardHeader, Row, Col, CardBody } from 'reactstrap';

import DynamicFlash from 'components/DynamicFlash';
import Advertisement from 'components/Advertisement';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';
import MagicMarkdown from 'components/MagicMarkdown';

const MarkdownPage = ({ user, loginCallback }) => (
  <MainLayout loginCallback={loginCallback} user={user}>
    <Advertisement />
    <DynamicFlash />
    <Card className="my-3 mx-4">
      <CardHeader>
        <h4>Markdown Guide</h4>
      </CardHeader>
      <CardBody>
        <p>
          For blog posts, only a subset of this syntax is available. Features not available for blog posts will be
          labeled accordingly. If you need any help regarding how to use markdown, please{' '}
          <a href="/contact">contact us</a>.
        </p>
        <h5>Contents</h5>
        <ol>
          <li>
            <a href="#formatting">Basic Formatting</a>
          </li>
          <li>
            <a href="#cards">Linking Cards</a>
          </li>
          <li>
            <a href="#symbols">Symbols</a>
          </li>
          <li>
            <a href="#quotes">Quotes</a>
          </li>
          <li>
            <a href="#users">Tagging Users</a>
          </li>
          <li>
            <a href="#lists">Lists</a>
          </li>
          <li>
            <a href="#links">Links</a>
          </li>
          <li>
            <a href="#latex">LaTeX</a>
          </li>
          <li>
            <a href="#centering">Centering</a>
          </li>
        </ol>
      </CardBody>
      <CardBody className="border-top">
        <h5 id="formatting">Basic Formatting</h5>
        <p>For italic text, wrap the text in single asterisks or underscores.</p>
        <Row>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Source</CardHeader>
              <CardBody>
                <code>*This text is italicized*</code>
                <br />
                <code>_This text is italicized_</code>
              </CardBody>
            </Card>
          </Col>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Result</CardHeader>
              <CardBody>
                <MagicMarkdown markdown="*This text is italicized*" />
                <br />
                <MagicMarkdown markdown="_This text is italicized_" />
              </CardBody>
            </Card>
          </Col>
        </Row>
        <br />
        <p>For bold text, wrap the text in double asterisks.</p>
        <Row>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Source</CardHeader>
              <CardBody>
                <code>**This text is bold**</code>
              </CardBody>
            </Card>
          </Col>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Result</CardHeader>
              <CardBody>
                <MagicMarkdown markdown="**This text is bold**" />
              </CardBody>
            </Card>
          </Col>
        </Row>
        <br />
        <p>For italic and bold text, wrap the text in triple asterisks.</p>
        <Row>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Source</CardHeader>
              <CardBody>
                <code>***This text is italicized and bold***</code>
              </CardBody>
            </Card>
          </Col>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Result</CardHeader>
              <CardBody>
                <MagicMarkdown markdown="***This text is italicized and bold***" />
              </CardBody>
            </Card>
          </Col>
        </Row>
        <br />
        <p>For underlined text, wrap the text in double underscores.</p>
        <Row>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Source</CardHeader>
              <CardBody>
                <code>__This text is underlined__</code>
              </CardBody>
            </Card>
          </Col>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Result</CardHeader>
              <CardBody>
                <MagicMarkdown markdown="__This text is underlined__" />
              </CardBody>
            </Card>
          </Col>
        </Row>
        <br />
        <p>For underlined and italicized text, wrap the text in triple underscores.</p>
        <Row>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Source</CardHeader>
              <CardBody>
                <code>___This text is underlined and italicized___</code>
              </CardBody>
            </Card>
          </Col>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Result</CardHeader>
              <CardBody>
                <MagicMarkdown markdown="___This text is underlined and italicized___" />
              </CardBody>
            </Card>
          </Col>
        </Row>
        <br />
        <p>For strikethrough text, wrap the text in double tilde.</p>
        <Row>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Source</CardHeader>
              <CardBody>
                <code>~~This text is strikethrough~~</code>
              </CardBody>
            </Card>
          </Col>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Result</CardHeader>
              <CardBody>
                <MagicMarkdown markdown="~~This text is strikethrough~~" />
              </CardBody>
            </Card>
          </Col>
        </Row>
        <br />
        <p>Add headings by adding 1 to 6 #'s to the begginning of a line. Make sure to put a space after the #'s.</p>
        <Row>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Source</CardHeader>
              <CardBody>
                <code># Heading 1</code>
                <br />
                <code>## Heading 2</code>
                <br />
                <code>### Heading 3</code>
                <br />
                <code>#### Heading 4</code>
                <br />
                <code>##### Heading 5</code>
                <br />
                <code>###### Heading 6</code>
                <br />
              </CardBody>
            </Card>
          </Col>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Result</CardHeader>
              <CardBody>
                <h1>Heading 1</h1>
                <h2>Heading 2</h2>
                <h3>Heading 3</h3>
                <h4>Heading 4</h4>
                <h5>Heading 5</h5>
                <h6>Heading 6</h6>
              </CardBody>
            </Card>
          </Col>
        </Row>
        <br />
      </CardBody>
      <CardBody className="border-top">
        <h5 id="cards">Linking Cards</h5>
        <p>
          There are multiple ways to link cards. To link a card with autocard, you can use double square brackets to
          wrap a card name, like so:
        </p>
        <Row>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Source</CardHeader>
              <CardBody>
                <code>[[Ambush Viper]]</code>
              </CardBody>
            </Card>
          </Col>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Result</CardHeader>
              <CardBody>
                <MagicMarkdown markdown="[[Ambush Viper]]" />
              </CardBody>
            </Card>
          </Col>
        </Row>
        <br />
        <p>
          You can put the card in whatever case you want. It will always link to the Cube Cobra card page. If you want
          to link to a specific version, you can supply a{' '}
          <a href="https://scryfall.com/docs/api/cards/id" target="_blank" rel="noopener noreferrer">
            Scryfall ID
          </a>
          . These IDs can be found from the URL of card pages, for the version you are looking for. The text displayed
          will be whatever is to the left of the pipe (|).For example:
        </p>
        <Row>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Source</CardHeader>
              <CardBody>
                <code>[[Old Border Mystic Snake|f098a28c-5f9b-4a2c-b109-c342365eb948]]</code>
                <br />
                <code>[[New Border Mystic Snake|38810fe4-dc72-439e-adf7-362af772b8f8]]</code>
              </CardBody>
            </Card>
          </Col>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Result</CardHeader>
              <CardBody>
                <MagicMarkdown
                  markdown={
                    '[[Old Border Mystic Snake|f098a28c-5f9b-4a2c-b109-c342365eb948]]\n[[New Borer Mystic Snake|38810fe4-dc72-439e-adf7-362af772b8f8]]'
                  }
                />
              </CardBody>
            </Card>
          </Col>
        </Row>
        <br />
        <p>
          To use a double-faced card autocard, add a slash to beginning of the card name. This also works with linking
          specific IDs.
        </p>
        <Row>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Source</CardHeader>
              <CardBody>
                <code>[[/Delver of Secrets]]</code>
                <br />
                <code>[[/Delver of Secrets|28059d09-2c7d-4c61-af55-8942107a7c1f]]</code>
              </CardBody>
            </Card>
          </Col>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Result</CardHeader>
              <CardBody>
                <MagicMarkdown markdown="[[/Delver of Secrets]]" />
                <br />
                <MagicMarkdown markdown="[[/Delver of Secrets|28059d09-2c7d-4c61-af55-8942107a7c1f]]" />
              </CardBody>
            </Card>
          </Col>
        </Row>
        <br />
        <p>
          You can display card images by adding a exclamation point before the card name. These images scale with the
          width of the screen, so try it out on different screen widths to make sure you're happy with it, like so:
        </p>
        <Row>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Source</CardHeader>
              <CardBody>
                <code>[[!Hexdrinker]]</code>
              </CardBody>
            </Card>
          </Col>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Result</CardHeader>
              <CardBody>
                <MagicMarkdown markdown="[[!Hexdrinker]]" />
              </CardBody>
            </Card>
          </Col>
        </Row>
        <br />
        <p>For DFCs, you can similarly add a slash to get the back side in autocard.</p>
        <Row>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Source</CardHeader>
              <CardBody>
                <code>[[!/Delver of Secrets]]</code>
              </CardBody>
            </Card>
          </Col>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Result</CardHeader>
              <CardBody>
                <MagicMarkdown markdown="[[!/Delver of Secrets]]" />
              </CardBody>
            </Card>
          </Col>
        </Row>
        <br />
        <p>
          If you want to display card images alongside each other in a row, you'll need to wrap those card images with
          double angle brackets. This feature is not available for blog posts. Take the following example:
        </p>
        <Row>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Source</CardHeader>
              <CardBody>
                <code>[[!Hexdrinker]][[!Lotus Cobra]][[!Snake]]</code>
              </CardBody>
            </Card>
          </Col>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Result</CardHeader>
              <CardBody>
                <MagicMarkdown markdown="[[!Hexdrinker]][[!Lotus Cobra]][[!Snake]]" />
              </CardBody>
            </Card>
          </Col>
        </Row>
        <br />
        <Row>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Source</CardHeader>
              <CardBody>
                <code>{'<<[[!Hexdrinker]][[!Lotus Cobra]][[!Snake]]>>'}</code>
              </CardBody>
            </Card>
          </Col>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Result</CardHeader>
              <CardBody>
                <Row>
                  <MagicMarkdown markdown="[[!Hexdrinker]]" />
                  <MagicMarkdown markdown="[[!Lotus Cobra]]" />
                  <MagicMarkdown markdown="[[!Snake]]" />
                </Row>
              </CardBody>
            </Card>
          </Col>
        </Row>
        <br />
      </CardBody>
      <CardBody className="border-top">
        <h5 id="symbols">Symbols</h5>
        <p>Symbols can be added using curly braces. Most MTG symbols are supported.</p>
        <Row>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Source</CardHeader>
              <CardBody>
                <code>{'{W}{U}{B}{R}{G}'}</code>
              </CardBody>
            </Card>
          </Col>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Result</CardHeader>
              <CardBody>
                <MagicMarkdown markdown="{W}{U}{B}{R}{G}" />
              </CardBody>
            </Card>
          </Col>
        </Row>
        <br />
        <p>
          Create hybrid symbols by including a slash. If a symbol doesn't load this way, try swapping the order of the
          colors.
        </p>
        <Row>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Source</CardHeader>
              <CardBody>
                <code>{'{W/U}{G/U}{B/R}{R/W}{B/G}'}</code>
              </CardBody>
            </Card>
          </Col>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Result</CardHeader>
              <CardBody>
                <MagicMarkdown markdown="{W/U}{G/U}{B/R}{R/W}{B/G}" />
              </CardBody>
            </Card>
          </Col>
        </Row>
        <br />
        <p>Similarly, we can do hybrid color/2 colorless symbols, and Phrexian mana.</p>
        <Row>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Source</CardHeader>
              <CardBody>
                <code>{'{2/W}{2/U}{2/B}{2/R}{2/G}'}</code>
                <br />
                <code>{'{W/P}{U/P}{B/P}{R/P}{G/P}'}</code>
              </CardBody>
            </Card>
          </Col>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Result</CardHeader>
              <CardBody>
                <MagicMarkdown markdown={'{2/W}{2/U}{2/B}{2/R}{2/G}\n{W/P}{U/P}{B/P}{R/P}{G/P}\n'} />
              </CardBody>
            </Card>
          </Col>
        </Row>
        <br />
        <p>There are many more symbols available. Anything you'd see in a text box, we should support. For example:</p>
        <Row>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Source</CardHeader>
              <CardBody>
                <code>{'{e}{T}{q}{s}{X}{Y}{15}'}</code>
              </CardBody>
            </Card>
          </Col>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Result</CardHeader>
              <CardBody>
                <MagicMarkdown markdown={'{e}{T}{q}{s}{X}{Y}{15}'} />
              </CardBody>
            </Card>
          </Col>
        </Row>
        <br />
      </CardBody>
      <CardBody className="border-top">
        <h5 id="quotes">Quotes</h5>
        <p>
          {
            'You can add a quote block by adding a ">" and a space at the beginning of a line. Consecutive lines will be grouped together in the same quote. This feature is not available for blog posts.'
          }
        </p>
        <Row>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Source</CardHeader>
              <CardBody>
                <code>
                  {'> Mystic Snake - {1}{G}{U}{U}'}
                  <br />
                  {'> Creature - Snake'}
                  <br />
                  {'> Flash'}
                  <br />
                  {'> When Mystic Snake enters the battlefield, counter target spell.'}
                  <br />
                  {'> 2 / 2>'}
                </code>
              </CardBody>
            </Card>
          </Col>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Result</CardHeader>
              <CardBody>
                <Card className="bg-light">
                  <CardBody>
                    <MagicMarkdown
                      markdown={
                        'Mystic Snake - {1}{G}{U}{U}\nCreature - Snake\nFlash\nWhen Mystic Snake enters the battlefield, counter target spell.\n2/2'
                      }
                    />
                  </CardBody>
                </Card>
              </CardBody>
            </Card>
          </Col>
        </Row>
      </CardBody>
      <CardBody className="border-top">
        <h5 id="users">Linking Users</h5>
        <p>You can link to a user by adding an @ before the username.</p>
        <Row>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Source</CardHeader>
              <CardBody>
                <code>This suggestion was made by @dekkaru</code>
              </CardBody>
            </Card>
          </Col>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Result</CardHeader>
              <CardBody>
                <MagicMarkdown markdown="This suggestion was made by @dekkaru" />
              </CardBody>
            </Card>
          </Col>
        </Row>
        <br />
      </CardBody>
      <CardBody className="border-top">
        <h5 id="lists">Lists</h5>
        <p>
          Create an unordered (bulleted) list by adding a '-' followed by a space at the beginning of a line.
          Consecutive lines with this formatting will be joined into a bullet-pointed list.
        </p>
        <Row>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Source</CardHeader>
              <CardBody>
                <code>- item 1</code>
                <br />
                <code>- item 2</code>
                <br />
                <code>- item 3</code>
              </CardBody>
            </Card>
          </Col>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Result</CardHeader>
              <CardBody>
                <ul>
                  <li>item 1</li>
                  <li>item 2</li>
                  <li>item 3</li>
                </ul>
              </CardBody>
            </Card>
          </Col>
        </Row>
        <br />
        <p>
          Similarly, you can add ordered lists by using '1.' and a space at the beginning of the line. Make sure to only
          use '1.', and not any other numbers. The numbering will be added automatically.
        </p>
        <Row>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Source</CardHeader>
              <CardBody>
                <code>1. item 1</code>
                <br />
                <code>1. item 2</code>
                <br />
                <code>1. item 3</code>
              </CardBody>
            </Card>
          </Col>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Result</CardHeader>
              <CardBody>
                <ol>
                  <li>item 1</li>
                  <li>item 2</li>
                  <li>item 3</li>
                </ol>
              </CardBody>
            </Card>
          </Col>
        </Row>
        <br />
      </CardBody>
      <CardBody className="border-top">
        <h5 id="links">Links</h5>
        <p>
          You can add any hyperlink, with any text, by using square brackets around text followed immediately by
          parentheses around the URL. This is the only way to provide a custom link, and will create a warning popup for
          the user. Try out the following link to see the popup.
        </p>
        <Row>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Source</CardHeader>
              <CardBody>
                <code>[outside link](https://scryfall.com)</code>
              </CardBody>
            </Card>
          </Col>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Result</CardHeader>
              <CardBody>
                <MagicMarkdown markdown="[outside link](https://scryfall.com)" />
              </CardBody>
            </Card>
          </Col>
        </Row>
        <br />
      </CardBody>
      <CardBody className="border-top">
        <h5 id="latex">LaTeX</h5>
        <p>You can add latex expressions using double '$' for inline latex, and triple '$' for block latex.</p>
        <Row>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Source</CardHeader>
              <CardBody>
                <code>{`Some inline latex here $$\\frac{\\sum_{i=1}^N x_i}{N}$$ text after`}</code>
              </CardBody>
            </Card>
          </Col>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Result</CardHeader>
              <CardBody>
                <MagicMarkdown markdown={`Some inline latex here $$\\frac{\\sum_{i=1}^N x_i}{N}$$ text after`} />
              </CardBody>
            </Card>
          </Col>
        </Row>
        <br />
        <Row>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Source</CardHeader>
              <CardBody>
                <code>{`$$$\\frac{\\sum_{i=1}^N x_i}{N}$$$`}</code>
              </CardBody>
            </Card>
          </Col>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Result</CardHeader>
              <CardBody>
                <MagicMarkdown markdown={`$$$\\frac{\\sum_{i=1}^N x_i}{N}$$$`} />
              </CardBody>
            </Card>
          </Col>
        </Row>
        <br />
        <p>You can use latex in headers, and in block quotes as well.</p>
        <Row>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Source</CardHeader>
              <CardBody>
                <code>{`> $$$\\frac{\\sum_{i=1}^N x_i}{N}$$$ `}</code>
                <br />
                <code>{`### $$$\\frac{\\sum_{i=1}^N x_i}{N}$$$ `}</code>
              </CardBody>
            </Card>
          </Col>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Result</CardHeader>
              <CardBody>
                <MagicMarkdown markdown={`> $$$\\frac{\\sum_{i=1}^N x_i}{N}$$$ `} />
                <br />
                <MagicMarkdown markdown={`### $$$\\frac{\\sum_{i=1}^N x_i}{N}$$$ `} />
              </CardBody>
            </Card>
          </Col>
        </Row>
      </CardBody>
      <CardBody className="border-top">
        <h5 id="centering">Centering</h5>
        <p>You can center elements by wrapping them in triple angle brackets.</p>
        <Row>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Source</CardHeader>
              <CardBody>
                <code>{`>>> This text is centered <<<`}</code>
              </CardBody>
            </Card>
          </Col>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Result</CardHeader>
              <CardBody>
                <MagicMarkdown markdown={`>>> This text is centered <<<`} />
              </CardBody>
            </Card>
          </Col>
        </Row>
        <br />
        <p>You can center card images, titles and multi-line paragraphs as well.</p>
        <Row>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Source</CardHeader>
              <CardBody>
                <code>{`>>> Centered Card: [[!Hexdrinker]] <<<`}</code>
              </CardBody>
            </Card>
          </Col>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Result</CardHeader>
              <CardBody>
                <MagicMarkdown markdown={`>>> Centered Image: [[!Hexdrinker]] <<<`} />
              </CardBody>
            </Card>
          </Col>
        </Row>
        <Row>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Source</CardHeader>
              <CardBody>
                <code>
                  {`>>>`} <br />
                  ### Centered heading <br />
                  {`<<<`}
                </code>
              </CardBody>
            </Card>
          </Col>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Result</CardHeader>
              <CardBody>
                <MagicMarkdown
                  markdown={`>>> 
                #### Centered heading
                <<<`}
                />
              </CardBody>
            </Card>
          </Col>
        </Row>
        <Row>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Source</CardHeader>
              <CardBody>
                <code>
                  {`>>>`} <br />
                  Centered paragraph <br />
                  spanning <br />
                  multiple <br />
                  lines <br />
                  {`<<<`} <br />
                </code>
              </CardBody>
            </Card>
          </Col>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Result</CardHeader>
              <CardBody>
                <MagicMarkdown
                  markdown={`>>> 
                Centered paragraph 
                spanning 
                multiple
                lines
                <<<`}
                />
              </CardBody>
            </Card>
          </Col>
        </Row>
      </CardBody>
    </Card>
  </MainLayout>
);

MarkdownPage.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    notifications: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  }),
  loginCallback: PropTypes.string,
};

MarkdownPage.defaultProps = {
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(MarkdownPage);
