import React from 'react';

import PropTypes from 'prop-types';

import Banner from 'components/Banner';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import DynamicFlash from 'components/DynamicFlash';
import Markdown from 'components/Markdown';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';

interface MarkdownProps {
  loginCallback?: string;
}

const MarkdownPage: React.FC<MarkdownProps> = ({ loginCallback = '/' }) => (
  <MainLayout loginCallback={loginCallback}>
    <Banner />
    <DynamicFlash />
    <Card className="my-3 mx-4">
      <Flexbox direction="col" gap="2">
        <CardHeader>
          <Text semibold lg>
            Markdown Guide
          </Text>
        </CardHeader>
        <CardBody>
          <p>
            CubeCobra supports regular Markdown as well as some extra features specific to our site. If you need any
            help regarding how to use markdown, please <Link href="/contact">contact us</Link>.
          </p>
        </CardBody>
        <CardBody className="border-top">
          <Text semibold md>
            Basic Formatting
          </Text>
          <p>
            Our Markdown syntax is based on the CommonMark specification, which includes all the common Markdown
            constructs you may already be familiar with.{' '}
            <Link href="https://commonmark.org/help/" target="_blank" rel="noopener noreferrer">
              Learn more.
            </Link>
          </p>
        </CardBody>
        <CardBody className="border-top">
          <Text semibold md>
            Linking cards
          </Text>
          <p>
            There are multiple ways to link cards. To link a card with autocard, you can use double square brackets to
            wrap a card name, like so:
          </p>
          <Row xs={12}>
            <Col xs={12} sm={6}>
              <Card>
                <CardHeader>Source</CardHeader>
                <CardBody>
                  <p>
                    <code>[[Ambush Viper]]</code>
                  </p>
                </CardBody>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
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
            <Link href="https://scryfall.com/docs/api/cards/id" target="_blank" rel="noopener noreferrer">
              Scryfall ID
            </Link>
            . These IDs can be found from the URL of card pages, for the version you are looking for. The text displayed
            will be whatever is to the left of the pipe (|).For example:
          </p>
          <Row>
            <Col xs={12} sm={6}>
              <Card>
                <CardHeader>Source</CardHeader>
                <CardBody>
                  <p>
                    <code>[[Old Border Mystic Snake|f098a28c-5f9b-4a2c-b109-c342365eb948]]</code>
                    <br />
                    <code>[[New Border Mystic Snake|38810fe4-dc72-439e-adf7-362af772b8f8]]</code>
                  </p>
                </CardBody>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card>
                <CardHeader>Result</CardHeader>
                <CardBody>
                  <Markdown
                    markdown={
                      '[[Old Border Mystic Snake|f098a28c-5f9b-4a2c-b109-c342365eb948]]\n[[New Border Mystic Snake|38810fe4-dc72-439e-adf7-362af772b8f8]]'
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
            <Col xs={12} sm={6}>
              <Card>
                <CardHeader>Source</CardHeader>
                <CardBody>
                  <p>
                    <code>[[/Delver of Secrets]]</code>
                    <br />
                    <code>[[/Delver of Secrets|28059d09-2c7d-4c61-af55-8942107a7c1f]]</code>
                  </p>
                </CardBody>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
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
            <Col xs={12} sm={6}>
              <Card>
                <CardHeader>Source</CardHeader>
                <CardBody>
                  <code>[[!Hexdrinker]]</code>
                </CardBody>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
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
            <Col xs={12} sm={6}>
              <Card>
                <CardHeader>Source</CardHeader>
                <CardBody>
                  <p>
                    <code>[[!/Delver of Secrets]]</code>
                  </p>
                </CardBody>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card>
                <CardHeader>Result</CardHeader>
                <CardBody>
                  <Markdown markdown="[[!/Delver of Secrets]]" />
                </CardBody>
              </Card>
            </Col>
          </Row>
          <br />
          <p>For DFCs, you can show the back side on the page using an additional /.</p>
          <Row>
            <Col xs={12} sm={6}>
              <Card>
                <CardHeader>Source</CardHeader>
                <CardBody>
                  <p>
                    <code>[[!//Delver of Secrets]]</code>
                  </p>
                </CardBody>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card>
                <CardHeader>Result</CardHeader>
                <CardBody>
                  <Markdown markdown="[[!//Delver of Secrets]]" />
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
            <Col xs={12} sm={6}>
              <Card>
                <CardHeader>Source</CardHeader>
                <CardBody>
                  <p>
                    <code>[[!Hexdrinker]][[!Lotus Cobra]][[!Snake]]</code>
                  </p>
                </CardBody>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
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
            <Col xs={12} sm={6}>
              <Card>
                <CardHeader>Source</CardHeader>
                <CardBody>
                  <p>
                    <code>{'<<[[!Hexdrinker]][[!Lotus Cobra]][[!Snake]]>>'}</code>
                  </p>
                </CardBody>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
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
          <Text semibold md>
            Symbols
          </Text>
          <p>Symbols can be added using curly braces. Most MTG symbols are supported.</p>
          <Row>
            <Col xs={12} sm={6}>
              <Card>
                <CardHeader>Source</CardHeader>
                <CardBody>
                  <p>
                    <code>{'{W}{U}{B}{R}{G}'}</code>
                  </p>
                </CardBody>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card>
                <CardHeader>Result</CardHeader>
                <CardBody>
                  <Markdown markdown="{W}{U}{B}{R}{G}" />
                </CardBody>
              </Card>
            </Col>
          </Row>
          <br />
          <p>Create hybrid symbols by including a slash.</p>
          <Row>
            <Col xs={12} sm={6}>
              <Card>
                <CardHeader>Source</CardHeader>
                <CardBody>
                  <p>
                    <code>{'{W/U}{G/U}{B/R}{R/W}{B/G}'}</code>
                  </p>
                </CardBody>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
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
            <Col xs={12} sm={6}>
              <Card>
                <CardHeader>Source</CardHeader>
                <CardBody>
                  <p>
                    <code>{'{2/W}{2/U}{2/B}{2/R}{2/G}'}</code>
                    <br />
                    <code>{'{W/P}{U/P}{B/P}{R/P}{G/P}'}</code>
                  </p>
                </CardBody>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card>
                <CardHeader>Result</CardHeader>
                <CardBody>
                  <Markdown markdown={'{2/W}{2/U}{2/B}{2/R}{2/G}\n{W/P}{U/P}{B/P}{R/P}{G/P}\n'} />
                </CardBody>
              </Card>
            </Col>
          </Row>
          <br />
          <p>
            There are many more symbols available. Anything you'd see in a text box, we should support. For example:
          </p>
          <Row>
            <Col xs={12} sm={6}>
              <Card>
                <CardHeader>Source</CardHeader>
                <CardBody>
                  <p>
                    <code>{'{e}{T}{q}{s}{m}{c}{X}{Y}{15}'}</code>
                  </p>
                </CardBody>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card>
                <CardHeader>Result</CardHeader>
                <CardBody>
                  <Markdown markdown={'{e}{T}{q}{s}{m}{c}{X}{Y}{15}'} />
                </CardBody>
              </Card>
            </Col>
          </Row>
          <br />
        </CardBody>
        <CardBody className="border-top">
          <Text semibold md>
            Linking Users
          </Text>
          <p>You can link to a user by adding an @ before the username.</p>
          <Row>
            <Col xs={12} sm={6}>
              <Card>
                <CardHeader>Source</CardHeader>
                <CardBody>
                  <p>
                    <code>This suggestion was made by @dekkaru</code>
                  </p>
                </CardBody>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
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
          <Text semibold md>
            LaTeX
          </Text>
          <p>
            You can add LaTeX math expressions using '$' for inline LaTeX, and double '$' on a separate line for block
            LaTeX.
          </p>
          <Row>
            <Col xs={12} sm={6}>
              <Card>
                <CardHeader>Source</CardHeader>
                <CardBody>
                  <p>
                    <code>{'Some inline latex here $\\frac{\\sum_{i=1}^N x_i}{N}$ text after'}</code>
                  </p>
                </CardBody>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
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
            <Col xs={12} sm={6}>
              <Card>
                <CardHeader>Source</CardHeader>
                <CardBody>
                  <p>
                    <code>$$</code>
                    <br />
                    <code>{'frac{\\sum_{i=1}^N x_i}{N}'}</code>
                    <br />
                    <code>$$</code>
                  </p>
                </CardBody>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
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
            <Col xs={12} sm={6}>
              <Card>
                <CardHeader>Source</CardHeader>
                <CardBody>
                  <p>
                    <code>{'> $\\frac{\\sum_{i=1}^N x_i}{N}$'}</code>
                    <br />
                    <code>{'### $\\frac{\\sum_{i=1}^N x_i}{N}$'}</code>
                  </p>
                </CardBody>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
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
          <Text semibold md>
            Strikethrough
          </Text>
          <p>For strikethrough text, wrap the text in double tilde.</p>
          <Row>
            <Col xs={12} sm={6}>
              <Card>
                <CardHeader>Source</CardHeader>
                <CardBody>
                  <p>
                    <code>~~This text is strikethrough~~</code>
                  </p>
                </CardBody>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
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
          <Text semibold md>
            Centering
          </Text>
          <p>You can center elements by wrapping them in triple angle brackets.</p>
          <Row>
            <Col xs={12} sm={6}>
              <Card>
                <CardHeader>Source</CardHeader>
                <CardBody>
                  <p>
                    <code>{`>>> This text is centered <<<`}</code>
                  </p>
                </CardBody>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
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
            You can center card images, titles and multi-line paragraphs as well. All other Markdown tags can be used in
            a centered block.
          </p>
          <Row>
            <Col xs={12} sm={6}>
              <Card>
                <CardHeader>Source</CardHeader>
                <CardBody>
                  <p>
                    <code>{`>>> Centered Card: [[!Hexdrinker]] <<<`}</code>
                  </p>
                </CardBody>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card>
                <CardHeader>Result</CardHeader>
                <CardBody>
                  <Markdown markdown={`>>> Centered Card: [[!Hexdrinker]] <<<`} />
                </CardBody>
              </Card>
            </Col>
          </Row>
          <Row>
            <Col xs={12} sm={6}>
              <Card>
                <CardHeader>Source</CardHeader>
                <CardBody>
                  <p>
                    <code>
                      {`>>>`} <br />
                      ### Centered heading <br />
                      {`<<<`}
                    </code>
                  </p>
                </CardBody>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card>
                <CardHeader>Result</CardHeader>
                <CardBody>
                  <Markdown markdown={`>>>\n#### Centered heading\n<<<`} />
                </CardBody>
              </Card>
            </Col>
          </Row>
          <Row>
            <Col xs={12} sm={6}>
              <Card>
                <CardHeader>Source</CardHeader>
                <CardBody>
                  <p>
                    <code>
                      {`>>>`} <br />
                      Centered paragraph <br />
                      spanning <br />
                      multiple <br />
                      lines <br />
                      {`<<<`} <br />
                    </code>
                  </p>
                </CardBody>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
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
          <Text semibold md>
            Tables
          </Text>
          <p>
            Tables consist of a header row, a delimiter row, and one or more data rows. The separators between columns
            don't have to be vertically aligned, but it helps readability.
          </p>
          <Row>
            <Col xs={12} sm={6}>
              <Card>
                <CardHeader>Source</CardHeader>
                <CardBody>
                  <p>
                    <code>| W | U | B | R | G |</code>
                    <br />
                    <code>|---|---|---|---|---|</code>
                    <br />
                    <code>| 15| 7 | 12| 35| 0 |</code>
                  </p>
                </CardBody>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
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
            <Col xs={12} sm={6}>
              <Card>
                <CardHeader>Source</CardHeader>
                <CardBody>
                  <p>
                    <code>| Left align | Center align | Right align |</code>
                    <br />
                    <code>| :--------- | :----------: | ----------: |</code>
                    <br />
                    <code>| Aligned left | Aligned center | Aligned right |</code>
                    <br />
                    <code>{`| {W}{U}{B}{R} | [[Hexdrinker]] | *emphasized* |`}</code>
                  </p>
                </CardBody>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
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
          <br />
          <p>To use a card link or image with an id inside a table, the pipe must be escaped with a slash.</p>
          <Row>
            <Col xs={12} sm={6}>
              <Card>
                <CardHeader>Source</CardHeader>
                <CardBody>
                  <p>
                    <code>| Column A | Column B |</code>
                    <br />
                    <code>| - | - |</code>
                    <br />
                    <code>| [[!/Delver of Secrets&#92;|28059d09-2c7d-4c61-af55-8942107a7c1f]] | Image |</code>
                    <br />
                    <code>| [[Old Border Mystic Snake&#92;|f098a28c-5f9b-4a2c-b109-c342365eb948]] | Card link |</code>
                    <br />
                    <code>| [[Ambush Viper]] | Card link without id |</code>
                  </p>
                </CardBody>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card>
                <CardHeader>Result</CardHeader>
                <CardBody>
                  <Markdown
                    markdown={
                      '| Column A | Column B |\n| - | - |\n| [[!/Delver of Secrets\\|28059d09-2c7d-4c61-af55-8942107a7c1f]] | Image |\n| [[Old Border Mystic Snake\\|f098a28c-5f9b-4a2c-b109-c342365eb948]] | Card link |\n| [[Ambush Viper]] | Card link without id |'
                    }
                  />
                </CardBody>
              </Card>
            </Col>
          </Row>
        </CardBody>
        <CardBody className="border-top">
          <Text semibold md>
            Task Lists
          </Text>
          <p>Adding brackets to a list turns it into a task list.</p>
          <Row>
            <Col xs={12} sm={6}>
              <Card>
                <CardHeader>Source</CardHeader>
                <CardBody>
                  <p>
                    <code>- [x] Completed item.</code>
                    <br />
                    <code>- [ ] Not completed item.</code>
                    <br />
                    <code>&nbsp;&nbsp;- [x] Task lists can be nested.</code>
                    <br /> <br />
                    <code>1. [x] Numbered task.</code>
                    <br />
                    <code>2. [ ] Unfinished numbered task.</code>
                  </p>
                </CardBody>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card>
                <CardHeader>Result</CardHeader>
                <CardBody>
                  <Markdown
                    markdown={
                      '- [x] Completed item.\n- [ ] Not completed item.\n  - [x] Task lists can be nested.\n\n1. [x] Numbered task.\n2. [ ] Unfinished numbered task.'
                    }
                  />
                </CardBody>
              </Card>
            </Col>
          </Row>
        </CardBody>
        <CardBody className="border-top">
          <Text semibold md>
            Syntax Highlighting
          </Text>
          <p>
            When writing a code block, specifying a language will enable syntax highlighting for that language. You can
            specify{' '}
            <Link
              href="https://github.com/react-syntax-highlighter/react-syntax-highlighter/blob/master/AVAILABLE_LANGUAGES_HLJS.MD"
              target="_blank"
              rel="noopener noreferrer"
            >
              the following languages.
            </Link>
          </p>
          <Row>
            <Col xs={12} sm={6}>
              <Card>
                <CardHeader>Source</CardHeader>
                <CardBody>
                  <p>
                    <code>```javascript</code>
                    <br />
                    <code>{'const x = { a: b+1 };'}</code>
                    <br />
                    <code>console.log(this);</code>
                    <br />
                    <code>```</code>
                  </p>
                </CardBody>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card>
                <CardHeader>Result</CardHeader>
                <CardBody>
                  <Markdown markdown={'```js\nconst x = { a: b+1 };\nconsole.log(this);\n```'} />
                </CardBody>
              </Card>
            </Col>
          </Row>
        </CardBody>
        <CardBody className="border-top">
          <Text semibold md>
            Header linking
          </Text>
          <p>
            Headers in markdown can be linked to within the page by creating anchors with fragment (#) URLs. The content
            of the fragment is the text content of the header in lowercase, with whitespace replaced by "-" (dash) and
            non-letter/numbers characters removed (see examples). Each heading must have unique text (within the page)
            for the linking to work.
          </p>
          <p>Examples:</p>
          <ul>
            <li>A header with text "This is my cube" can be linked from fragment "#this-is-my-cube"</li>
            <li>
              Non-letters such as emoji's or symbols will be removed: "😄 emoji ♥" can be linked from fragment
              "#-emoji-"
            </li>
            <li>Non-ASCII letters work: "The Héroïne" can be linked from fragment "#the-héroïne"</li>
          </ul>
          <br />
          <Row>
            <Col xs={12} sm={6}>
              <Card>
                <CardHeader>Source</CardHeader>
                <CardBody>
                  <p>
                    <code># My cube is awesome!</code>
                    <code>[Read the cube themes](#what-are-the-themes-of-the-cube)</code>
                    <code>[All about the money](#all-cards-must-be-less-than-50-)</code>
                    <br />
                    <code>## What are the themes of the cube?</code>
                    <br />
                    <code>### All cards must be less than 50 ¢</code>
                    <br />
                    <code>[Back to top](#my-cube-is-awesome)</code>
                  </p>
                </CardBody>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card>
                <CardHeader>Result</CardHeader>
                <CardBody>
                  <Markdown
                    markdown={
                      '# My cube is awesome!\n[Read the cube themes](#what-are-the-themes-of-the-cube)\n[All about the money](#all-cards-must-be-less-than-50-)\n## What are the themes of the cube?\n### All cards must be less than 50 ¢\n[Back to top](#my-cube-is-awesome)'
                    }
                  />
                </CardBody>
              </Card>
            </Col>
          </Row>
        </CardBody>
      </Flexbox>
    </Card>
  </MainLayout>
);

MarkdownPage.propTypes = {
  loginCallback: PropTypes.string,
};

export default RenderToRoot(MarkdownPage);
