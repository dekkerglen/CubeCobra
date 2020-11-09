import React from 'react';
import PropTypes from 'prop-types';

import { Card, CardHeader, Row, Col, CardBody } from 'reactstrap';

import DynamicFlash from 'components/DynamicFlash';
import Advertisement from 'components/Advertisement';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';
import Markdown from 'components/Markdown';

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
          CubeCobra supports regular Markdown as well as some extra features specific to our site. If you need any help
          regarding how to use markdown, please <a href="/contact">contact us</a>.
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
            <a href="#users">Tagging Users</a>
          </li>
          <li>
            <a href="#latex">LaTeX</a>
          </li>
          <li>
            <a href="#strikethrough">Strikethrough</a>
          </li>
          <li>
            <a href="#centering">Centering</a>
          </li>
          <li>
            <a href="#tables">Tables</a>
          </li>
          <li>
            <a href="#tasklists">Task Lists</a>
          </li>
          <li>
            <a href="#syntax">Syntax Highlighting</a>
          </li>
        </ol>
      </CardBody>
      <CardBody className="border-top">
        <h5 id="formatting">Basic Formatting</h5>
        <p>
          Our Markdown syntax is based on the CommonMark specification, which includes all the common Markdown
          constructs you may already be familiar with. <a href="https://commonmark.org/help/">Learn more.</a>
        </p>
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
                <Markdown markdown="[[Ambush Viper]]" />
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
                <Markdown
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
                <Markdown
                  markdown={'[[/Delver of Secrets]]\n[[/Delver of Secrets|28059d09-2c7d-4c61-af55-8942107a7c1f]]'}
                />
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
                <Markdown markdown="[[!Hexdrinker]]" />
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
                <Markdown markdown="[[!/Delver of Secrets]]" />
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
                <Markdown markdown="[[!Hexdrinker]][[!Lotus Cobra]][[!Snake]]" />
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
                <Markdown markdown="<<[[!Hexdrinker]][[!Lotus Cobra]][[!Snake]]>>" />
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
                <Markdown markdown="{W}{U}{B}{R}{G}" />
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
                <Markdown markdown="{W/U}{G/U}{B/R}{R/W}{B/G}" />
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
                <Markdown markdown={'{2/W}{2/U}{2/B}{2/R}{2/G}\n{W/P}{U/P}{B/P}{R/P}{G/P}\n'} />
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
                <Markdown markdown={'{e}{T}{q}{s}{X}{Y}{15}'} />
              </CardBody>
            </Card>
          </Col>
        </Row>
        <br />
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
                <Markdown markdown="This suggestion was made by @dekkaru" />
              </CardBody>
            </Card>
          </Col>
        </Row>
        <br />
      </CardBody>
      <CardBody className="border-top">
        <h5 id="latex">LaTeX</h5>
        <p>
          You can add LaTeX math expressions using '$' for inline LaTeX, and double '$' on a separate line for block
          LaTeX.
        </p>
        <Row>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Source</CardHeader>
              <CardBody>
                <code>{'Some inline latex here $\\frac{\\sum_{i=1}^N x_i}{N}$ text after'}</code>
              </CardBody>
            </Card>
          </Col>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Result</CardHeader>
              <CardBody>
                <Markdown markdown={'Some inline latex here $\\frac{\\sum_{i=1}^N x_i}{N}$ text after'} />
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
                <code>$$</code>
                <br />
                <code>{'frac{\\sum_{i=1}^N x_i}{N}'}</code>
                <br />
                <code>$$</code>
              </CardBody>
            </Card>
          </Col>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Result</CardHeader>
              <CardBody>
                <Markdown markdown={'$$\n\\frac{\\sum_{i=1}^N x_i}{N}\n$$'} />
              </CardBody>
            </Card>
          </Col>
        </Row>
        <br />
        <p>You can use LaTeX in headers, and in block quotes as well.</p>
        <Row>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Source</CardHeader>
              <CardBody>
                <code>{'> $\\frac{\\sum_{i=1}^N x_i}{N}$'}</code>
                <br />
                <code>{'### $\\frac{\\sum_{i=1}^N x_i}{N}$'}</code>
              </CardBody>
            </Card>
          </Col>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Result</CardHeader>
              <CardBody>
                <Markdown markdown={'> $\\frac{\\sum_{i=1}^N x_i}{N}$'} />
                <br />
                <Markdown markdown={'### $\\frac{\\sum_{i=1}^N x_i}{N}$'} />
              </CardBody>
            </Card>
          </Col>
        </Row>
      </CardBody>
      <CardBody className="border-top">
        <h5 id="strikethrough">Strikethrough</h5>
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
                <Markdown markdown="~~This text is strikethrough~~" />
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
                <Markdown markdown={`>>> This text is centered <<<`} />
              </CardBody>
            </Card>
          </Col>
        </Row>
        <br />
        <p>
          You can center card images, titles and multi-line paragraphs as well. All other Markdown tags can be used in a
          centered block.
        </p>
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
                <Markdown markdown={`>>> Centered Card: [[!Hexdrinker]] <<<`} />
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
                <Markdown markdown={`>>>\n#### Centered heading\n<<<`} />
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
                <Markdown markdown={`>>>\nCentered paragraph\nspanning\nmultiple\nlines\n<<<`} />
              </CardBody>
            </Card>
          </Col>
        </Row>
      </CardBody>
      <CardBody className="border-top">
        <h5 id="tables">Tables</h5>
        <p>
          Tables consist of a header row, a delimiter row, and one or more data rows. The separators between columns
          don't have to be vertically aligned, but it helps readability.
        </p>
        <Row>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Source</CardHeader>
              <CardBody>
                <code>| W | U | B | R | G |</code>
                <br />
                <code>|---|---|---|---|---|</code>
                <br />
                <code>| 15| 7 | 12| 35| 0 |</code>
              </CardBody>
            </Card>
          </Col>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Result</CardHeader>
              <CardBody>
                <Markdown markdown={'| W | U | B | R | G |\n|---|---|---|---|---|\n| 15| 7 | 12| 35| 0 |'} />
              </CardBody>
            </Card>
          </Col>
        </Row>
        <br />
        <p>
          The delimiter row can optionally contain semicolons indicating right, center, or left alignment. Table cells
          also support basic formatting.
        </p>
        <Row>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Source</CardHeader>
              <CardBody>
                <code>| Left align | Center align | Right align |</code>
                <br />
                <code>| :--------- | :----------: | ----------: |</code>
                <br />
                <code>| Aligned left | Aligned center | Aligned right |</code>
                <br />
                <code>{`| {W}{U}{B}{R} | [[Hexdrinker]] | *emphasized* |`}</code>
              </CardBody>
            </Card>
          </Col>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Result</CardHeader>
              <CardBody>
                <Markdown
                  markdown={
                    '| Left align | Center align | Right align |\n| :--------- | :----------: | ----------: |\n|Aligned left|Aligned center|Aligned right|\n|{W}{U}{B}{R}|[[Hexdrinker]]| *emphasized*|'
                  }
                />
              </CardBody>
            </Card>
          </Col>
        </Row>
      </CardBody>
      <CardBody className="border-top">
        <h5 id="tasklists">Task Lists</h5>
        <p>Adding brackets to a list turns it into a task list.</p>
        <Row>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Source</CardHeader>
              <CardBody>
                <code>- [x] Completed item.</code>
                <br />
                <code>- [ ] Not completed item.</code>
                <br />
                <code>&nbsp;&nbsp;- [x] Task lists can be nested.</code>
              </CardBody>
            </Card>
          </Col>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Result</CardHeader>
              <CardBody>
                <Markdown
                  markdown={'- [x] Completed item.\n- [ ] Not completed item.\n  - [x] Task lists can be nested.'}
                />
              </CardBody>
            </Card>
          </Col>
        </Row>
      </CardBody>
      <CardBody className="border-top">
        <h5 id="syntax">Syntax Highlighting</h5>
        <p>
          When writing a code block, specifying a language will enable syntax highlighting for that language. You can
          specify{' '}
          <a href="https://github.com/react-syntax-highlighter/react-syntax-highlighter/blob/master/AVAILABLE_LANGUAGES_HLJS.MD">
            the following languages.
          </a>
        </p>
        <Row>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Source</CardHeader>
              <CardBody>
                <code>```js</code>
                <br />
                <code>{'const x = { a: b+1 };'}</code>
                <br />
                <code>console.log(this);</code>
                <br />
                <code>```</code>
              </CardBody>
            </Card>
          </Col>
          <Col xs="12" sm="6">
            <Card>
              <CardHeader>Source</CardHeader>
              <CardBody>
                <Markdown markdown={'```js\nconst x = { a: b+1 };\nconsole.log(this);\n```'} />
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
