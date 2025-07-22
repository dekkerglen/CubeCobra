import React from 'react';

import Banner from 'components/Banner';
import Accordion from 'components/base/Accordion';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Table from 'components/base/Table';
import Text from 'components/base/Text';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';

import { CARD_STATUSES, FINISHES } from '../../datatypes/Card';

interface FiltersPageProps {
  loginCallback: string;
}

const FiltersPage: React.FC<FiltersPageProps> = ({ loginCallback }) => (
  <MainLayout loginCallback={loginCallback}>
    <Flexbox direction="col" gap="2" className="my-2">
      <Banner />
      <DynamicFlash />
      <Card>
        <CardHeader>
          <Text semibold lg>
            Filter Syntax Guide
          </Text>
        </CardHeader>
        <CardBody>
          <Flexbox direction="col" gap="2">
            <Accordion title="General" defaultExpand>
              <p>
                You can combine any number of filters together using <code>AND</code> or <code>OR</code>. Operators are
                case-insensitive, as are all filtering conditions (<code>TYPE:instant and o:DESTROY</code> will still
                work, for example).
              </p>
              <p>
                <Text semibold>Examples:</Text>
              </p>
              <Table
                rows={[
                  {
                    query: <code>t:instant OR t:sorcery</code>,
                    description: 'cards that are either instants or sorceries.',
                  },
                  {
                    query: <code>t:instant t:tribal</code>,
                    description: 'cards that are both instants and tribal.',
                  },
                ]}
              />
              <p>
                Text without a filtering condition is treated as a name. You can use quotes to require an exact match.
              </p>
              <p>
                <Text semibold>Examples:</Text>
              </p>
              <Table
                rows={[
                  {
                    query: <code>goblin blood</code>,
                    description: 'cards whose names contain both "blood" and "goblin".',
                  },
                  {
                    query: <code>&quot;goblin blood&quot;</code>,
                    description: 'cards whose names contain exactly "goblin blood".',
                  },
                  {
                    query: <code>o:destroy o:target o:creature</code>,
                    description: 'cards whose oracle text contains each of "destroy", "target", and "creature".',
                  },
                  {
                    query: <code>o:&quot;destroy target creature&quot;</code>,
                    description: 'cards whose oracle text contains exactly "destroy target creature".',
                  },
                ]}
              />
              <p>You can also use parentheses to combine clauses.</p>
              <p>
                <Text semibold>Examples:</Text>
              </p>
              <Table
                rows={[
                  {
                    query: <code>t:creature o:flash</code>,
                    description: 'cards that are creatures with flash.',
                  },
                  {
                    query: <code>t:creature o:flash OR t:instant</code>,
                    description: 'cards that are creatures with flash, or instants.',
                  },
                ]}
              />
              <p>
                You can put <code>-</code> before anything to negate it.
              </p>
              <p>
                <Text semibold>Examples:</Text>
              </p>
              <Table
                rows={[
                  {
                    query: <code>-c:w</code>,
                    description: 'cards that are not white.',
                  },
                  {
                    query: <code>-o:draw</code>,
                    description: 'cards which do not have draw in their oracle text.',
                  },
                  {
                    query: <code>-t:creature</code>,
                    description: 'cards which are not creatures.',
                  },
                  {
                    query: <code>-mox</code>,
                    description: 'cards whose names do not include "mox".',
                  },
                ]}
              />
            </Accordion>
            <Accordion title="Color and Color Identity">
              <p>
                You can find cards that are a certain color by using <code>c:</code> or <code>color:</code>, and cards
                with a certain color identity by using <code>ci:</code>, <code>id:</code>, or <code>identity:</code> or{' '}
                <code>coloridentity:</code>.
              </p>
              <p>
                Operators supported: <code>:</code>, <code>=</code>, <code>{'<'}</code>, <code>{'>'}</code>,{' '}
                <code>{'<='}</code>, <code>{'>='}</code>, <code>{'<>'}</code>, <code>{'!='}</code>.
              </p>
              <p>
                In addition to <code>w</code>, <code>u</code>, <code>b</code>, <code>r</code>, <code>g</code> and{' '}
                <code>c</code>, you can use color words like <code>white</code>, <code>blue</code>, <code>green</code>,
                etc.
              </p>
              <p>
                You can also use all shard, wedge, or guild names, like <code>azorius</code>, <code>bant</code>,{' '}
                <code>dimir</code>, etc.
              </p>
              <p>You can also compare by number of colors by using numbers instead of color names.</p>
              <p>
                Color Identity searches will respect any color identity overrides you have set while filtering in your
                cube.
              </p>
              <p>
                <Text semibold>Examples:</Text>
              </p>
              <Table
                rows={[
                  {
                    query: <code>c=wubrg</code>,
                    description: 'cards that are all 5 colors.',
                  },
                  {
                    query: <code>{`c<esper`}</code>,
                    description: 'cards who colors are a subset of Esper (UB, WB, WU, U, B, W, or colorless).',
                  },
                  {
                    query: <code>ci:wu</code>,
                    description: 'cards whose color identities are exactly white blue.',
                  },
                  {
                    query: <code>{'ci>azorius'}</code>,
                    description: 'cards whose color identities contain white, blue, and at least one other color.',
                  },
                  {
                    query: <code>{'ci>1'}</code>,
                    description: 'cards with more than 1 color in their identity.',
                  },
                  {
                    query: <code>{'ci<=3'}</code>,
                    description: 'cards with 3 or fewer colors in their identity.',
                  },
                  {
                    query: <code>{'ci:m'}</code>,
                    description: 'cards with more than 1 color in their identity.',
                  },
                  {
                    query: <code>{'ci!=m'}</code>,
                    description: 'cards with 1 or less colors in their identity.',
                  },
                ]}
              />
            </Accordion>
            <Accordion title="Card Types">
              <p>
                You can search for card types with <code>t:</code> or <code>type:</code>.
              </p>
              <p>
                Operators supported: <code>:</code>, <code>=</code>.
              </p>
              <p>
                Search for any part of the typeline, i.e. <code>legendary</code>, or <code>human</code>.
              </p>
              <p>Partial types are allowed.</p>
              <p>
                <Text semibold>Examples:</Text>
              </p>
              <Table
                rows={[
                  {
                    query: <code>type=legendary</code>,
                    description: 'cards that are legendary.',
                  },
                  {
                    query: <code>t:legendary t:creature</code>,
                    description: 'cards that are legendary creatures.',
                  },
                  {
                    query: <code>t:sha</code>,
                    description: 'cards that are shamans, or shapeshifters, spellshapers.',
                  },
                ]}
              />
            </Accordion>
            <Accordion title="Card Text and Set">
              <p>
                You can use <code>o:</code> or <code>oracle:</code> to search oracle text, and <code>s:</code> or{' '}
                <code>set:</code> to search for a specific set code.
              </p>
              <p>
                Operators Supported: <code>:</code>, <code>=</code>.
              </p>
              <p>
                This searches the full oracle text, including reminder text. The set code can be either upper or lower
                case.
              </p>
              <p>
                <Text semibold>Examples:</Text>
              </p>
              <Table
                rows={[
                  {
                    query: <code>o:&quot;draw a card&quot;</code>,
                    description: 'cards whose oracle text contains "draw a card".',
                  },
                  {
                    query: <code>o:&quot;:&quot;</code>,
                    description: 'cards whose oracle text contains ":" (cards with activated abilities).',
                  },
                  {
                    query: <code>s:war</code>,
                    description: 'cards from War of the Spark.',
                  },
                ]}
              />
            </Accordion>
            <Accordion title="Mana Costs">
              <p>
                You can use <code>m:</code> or <code>mana:</code> to search for cards with specific mana costs.
              </p>
              <p>
                Operators Supported: <code>:</code>, <code>=</code>.
              </p>
              <p>
                You can use plain numbers and letters for the 5 basic colors, snow, colorless, and x, y, and z costs.
              </p>
              <p>
                For hybrid costs, you can use <code>{'{}'}</code> i.e. <code>{'{2/G}'}</code>, <code>{'{R/G}'}</code>,
                etc.
              </p>
              <p>
                For phyrexian mana, use <code>{'{W/P}'}</code>.
              </p>
              <p>
                You can also surround mana costs with <code>{}</code> if you prefer, i.e. <code>{'{2}{G}{g}'}</code>{' '}
                instead of <code>2GG</code>. Either way is fine.
              </p>
              <p>
                You can search for cards that require two or more colors with <code>is:gold</code>, and cards that
                contain hybrid symbols with <code>is:hybrid</code> or Phyrexian mana symbols with{' '}
                <code>is:phyrexian</code>.
              </p>
              <p>
                <Text semibold>Examples:</Text>
              </p>
              <Table
                rows={[
                  {
                    query: <code>m:{'{r/g}{r/g}'}</code>,
                    description: 'cards that cost two hybrid red/green mana, i.e. Burning Tree Emissary.',
                  },
                  {
                    query: <code>m:2ww</code>,
                    description: 'cards that cost 2 generic mana, and 2 white mana.',
                  },
                  {
                    query: <code>is:gold</code>,
                    description: 'cards that require two or more colors.',
                  },
                  {
                    query: <code>is:hybrid</code>,
                    description: 'cards with one or more hybrid mana symbols.',
                  },
                  {
                    query: <code>is:phyrexian</code>,
                    description: 'cards with one or more Phyrexian mana symbols.',
                  },
                ]}
              />
            </Accordion>
            <Accordion title="Mana Value">
              <p>
                You can use <code>mv:</code> to search for specific mana values.
              </p>
              <p>
                Operators supported: <code>:</code>, <code>=</code>, <code>{'<'}</code>, <code>{'>'}</code>,{' '}
                <code>{'<='}</code>, <code>{'>='}</code>.
              </p>
              <p>
                <Text semibold>Examples:</Text>
              </p>
              <Table
                rows={[
                  {
                    query: <code>{'mv>5'}</code>,
                    description: 'cards with mana value greater than 5.',
                  },
                  {
                    query: <code>mv=3</code>,
                    description: 'cards with mana value of exactly 3.',
                  },
                ]}
              />
            </Accordion>
            <Accordion title="Power, Toughness, and Loyalty">
              <p>
                You can use <code>pow:</code> or <code>power:</code> to search for cards with certain powers.
              </p>
              <p>
                You can use <code>tou:</code> or <code>toughness:</code> to search for cards with certain toughness.
              </p>
              <p>
                You can use <code>loy:</code> or <code>loyalty:</code> to search for cards with certain starting
                loyalty.
              </p>
              <p>
                Operators supported: <code>:</code>, <code>=</code>, <code>{'<'}</code>, <code>{'>'}</code>,{' '}
                <code>{'<='}</code>, <code>{'>='}</code>, <code>!=</code>, <code>{'<>'}</code>.
              </p>
              <p>
                <Text semibold>Examples:</Text>
              </p>
              <Table
                rows={[
                  {
                    query: <code>{'pow>7'}</code>,
                    description: 'cards with greater than 7 power.',
                  },
                  {
                    query: <code>{'pow<5 tou<5'}</code>,
                    description: 'cards with both less than 5 power, and less than 5 toughness.',
                  },
                  {
                    query: <code>{'pow<5 tou<5'}</code>,
                    description: 'cards with both less than 5 power, and less than 5 toughness.',
                  },
                  {
                    query: <code>{'pow>toughness'}</code>,
                    description: 'cards with power greater than toughness.',
                  },
                  {
                    query: <code>{'tou!=power'}</code>,
                    description: 'cards with toughness not equal to power.',
                  },
                  {
                    query: <code>loy:3 or loy:4</code>,
                    description: 'cards with a starting loyalty of 3 or 4.',
                  },
                ]}
              />
            </Accordion>
            <Accordion title="Rarity">
              <p>
                You can use <code>r:</code> or <code>rarity:</code> to search for cards with a specific rarity.
              </p>
              <p>
                Operators supported: <code>:</code>, <code>=</code>, <code>{'<'}</code>, <code>{'>'}</code>,{' '}
                <code>{'<='}</code>, <code>{'>='}</code>.
              </p>
              <p>
                <Text semibold>Examples:</Text>
              </p>
              <Table
                rows={[
                  {
                    query: <code>r:common</code>,
                    description: 'Common cards.',
                  },
                  {
                    query: <code>{'r<=uncommon'}</code>,
                    description: 'Common or uncommon cards.',
                  },
                  {
                    query: <code>r:common or r:rare</code>,
                    description: 'Common or rare cards.',
                  },
                ]}
              />
            </Accordion>
            <Accordion title="Artist">
              <p>
                You can use <code>a:</code>, <code>art:</code>, or <code>artist:</code> to search for cards illustrated
                by a specific artist.
              </p>
              <Text semibold>Examples:</Text>
              <Table
                rows={[
                  {
                    query: <code>a:&quot;seb mckinnon&quot;</code>,
                    description: 'All cards illustrated by Seb Mckinnon.',
                  },
                  {
                    query: <code>a:reb</code>,
                    description: 'All cards illustrated by artists with "reb" in their name.',
                  },
                ]}
              />
            </Accordion>
            <Accordion title="Devotion">
              <p>
                You can use <code>d:</code>, <code>dev:</code>, or <code>devotion:</code> to search for cards with a
                given mono-color devotion.
              </p>
              <p>
                You can also append a color to the query to use numbers instead like <code>dw:</code> or{' '}
                <code>devotiontow:</code>.
              </p>
              <Text semibold>Examples:</Text>
              <Table
                rows={[
                  {
                    query: <code>d:www</code>,
                    description: 'All cards with exactly 3 white devotion.',
                  },
                  {
                    query: <code>{'devotiontor>2'}</code>,
                    description: 'All cards with more than 2 devotion to red.',
                  },
                ]}
              />
            </Accordion>
            <Accordion title="Price">
              <p>
                You can use <code>price:</code>, <code>priceNormal:</code>, <code>priceFoil:</code>,{' '}
                <code>priceEur:</code>, or <code>priceTix:</code> to filter cards by price. When filtering in individual
                cubes, <code>price:</code> uses the printing specified for the cube. <code>priceEur:</code> uses the
                nonfoil Card Market prices. <code>priceTix:</code> used MTGO TIX prices.
              </p>
              <Text semibold>Examples:</Text>
              <Table
                rows={[
                  {
                    query: <code>{'price>10.5'}</code>,
                    description: 'All cards in a cube whose specified printing has a price over $10.50.',
                  },
                  {
                    query: <code>{'priceFoil<10 OR priceNormal<10'}</code>,
                    description: 'All cards with a price under $10.',
                  },
                ]}
              />
            </Accordion>
            <Accordion title="Tags">
              <p>
                You can use <code>tag:</code> or <code>tags:</code> to filter cards by tag or tag count when in a cube.
              </p>
              <Text semibold>Examples:</Text>
              <Table
                rows={[
                  {
                    query: <code>tag:Signed</code>,
                    description:
                      'All cards in a cube who have a tag which contains Signed, case insensitive. eg Matches tags "Signed", "Unsigned", "Signed by", or "Redesigned"',
                  },
                  {
                    query: <code>tag:Signed Blood</code>,
                    description:
                      'This is a combination filter of tag and name, matching all cards who have a tag containing Signed, and whose name contains Blood',
                  },
                  {
                    query: <code>tag:"Signed"</code>,
                    description: 'All cards in a cube who have a tag that exactly matches Signed, case insensitive.',
                  },
                  {
                    query: <code>tag:'Counter Synergy'</code>,
                    description:
                      'All cards in a cube who have a tag that exactly matches "Counter Synergy", case insensitive.',
                  },
                  {
                    query: <code>tags=0</code>,
                    description: 'All cards with no tags.',
                  },
                  {
                    query: <code>{'tags>0'}</code>,
                    description: 'All cards with at least one tag.',
                  },
                ]}
              />
            </Accordion>
            <Accordion title="Notes">
              <p>
                You can use <code>notes:</code> to filter cards by the contents of their notes.
              </p>
              <Text semibold>Examples:</Text>
              <Table
                rows={[
                  {
                    query: <code>notes:Signpost</code>,
                    description: 'All cards in a cube whose notes contains "Signpost", case insensitive.',
                  },
                  {
                    query: <code>notes:"is fun"</code>,
                    description: 'All cards in a cube whose notes contains "is fun", case insensitive.',
                  },
                  {
                    query: <code>notes="Too powerful"</code>,
                    description: 'All cards in a cube whose notes are exactly "Too powerful", case insensitive.',
                  },
                  {
                    query: <code>notes=""</code>,
                    description: 'All cards with no notes (single or double quotes are equivalent).',
                  },
                  {
                    query: <code>{`notes!=''`}</code>,
                    description: 'All cards with non-empty notes.',
                  },
                ]}
              />
            </Accordion>
            <Accordion title="Legality">
              <p>
                You can use <code>leg:</code>, <code>legal:</code>, or <code>legality:</code> to filter cards by
                legality. Also <code>banned:</code>, <code>ban:</code>, or <code>restricted:</code> to check inversely.
                The format name can also be double-quoted.
              </p>
              <Text semibold>Examples:</Text>
              <Table
                rows={[
                  {
                    query: <code>leg:Modern</code>,
                    description: 'All cards that are legal in Modern.',
                  },
                  {
                    query: <code>-leg:Standard</code>,
                    description: 'All cards that are not legal in Standard.',
                  },
                  {
                    query: <code>banned:Modern</code>,
                    description: 'All cards that are banned in Modern.',
                  },
                  {
                    query: <code>restricted:"Vintage"</code>,
                    description:
                      'All cards that are restricted in Vintage (the only format with restrictions currently).',
                  },
                ]}
              />
            </Accordion>
            <Accordion title="Layout">
              <p>
                You can use <code>layout:</code> to filter cards by layout.
              </p>
              <Text semibold>Options:</Text>
              <Table
                rows={[
                  { query: <code>normal</code>, description: 'A standard Magic card with one face' },
                  { query: <code>split</code>, description: 'A split-faced card' },
                  { query: <code>flip</code>, description: 'cards that invert vertically with the flip keyword' },
                  { query: <code>transform</code>, description: 'Double-sided cards that transform' },
                  { query: <code>modal_dfc</code>, description: 'Double-sided cards that can be played either-side' },
                  { query: <code>meld</code>, description: 'cards with meld parts printed on the back' },
                  { query: <code>leveler</code>, description: 'cards with level Up' },
                  { query: <code>saga</code>, description: 'Saga-type cards' },
                  { query: <code>adventure</code>, description: 'cards with an Adventure spell part' },
                  { query: <code>planar</code>, description: 'Plane and Phenomenon-type cards' },
                  { query: <code>scheme</code>, description: 'Scheme-type cards' },
                  { query: <code>vanguard</code>, description: 'Vanguard-type cards' },
                  { query: <code>token</code>, description: 'Token cards' },
                  {
                    query: <code>double_faced_token</code>,
                    description: 'Tokens with another token printed on the back',
                  },
                  { query: <code>emblem</code>, description: 'Emblem cards' },
                  { query: <code>augment</code>, description: 'cards with Augment' },
                  { query: <code>host</code>, description: 'Host-type cards' },
                  { query: <code>art_series</code>, description: 'Art Series collectable double-faced cards' },
                  { query: <code>double_sided</code>, description: 'A Magic card with two sides that are unrelated' },
                ]}
              />
              <p>
                Additionally, you can use <code>is:dfc</code>, <code>is:mdfc</code>, <code>is:meld</code>,{' '}
                <code>is:transform</code>.
              </p>
            </Accordion>
            <Accordion title="Miscellaneous">
              <p>
                You can use <code>elo:</code> to filter cards by their elo rating.
              </p>
              <p>
                <Text semibold>Filters for individual cubes:</Text>
              </p>
              <p>
                You can use <code>finish:</code> to filter by cards with the given finish. Available options are&nbps;
                {
                  /* Replace the last comma with ", and" for nice English */
                  FINISHES.map((finish) => `"${finish}"`)
                    .join(', ')
                    .replace(/,(?!.*,)/gim, ', and')
                }
                .
              </p>
              <p>
                You can use <code>status:</code> to filter by cards with the given status. Available options are&nbsp;
                {
                  /* Replace the last comma with ", and" for nice English */
                  CARD_STATUSES.map((status) => `"${status}"`)
                    .join(', ')
                    .replace(/,(?!.*,)/gim, ', and')
                }
                .
              </p>
              <Text semibold>Examples:</Text>
              <Table
                rows={[
                  {
                    query: <code>{'elo>1500'}</code>,
                    description: 'All cards with an elo rating above 1500.',
                  },
                  {
                    query: <code>finish:non-foil</code>,
                    description: 'All cards with the non-foil finish selected.',
                  },
                  {
                    query: <code>status:&quot;Premium Owned&quot;</code>,
                    description: 'All cards marked with the "Premium Owned" status.',
                  },
                ]}
              />
            </Accordion>
          </Flexbox>
        </CardBody>
      </Card>
    </Flexbox>
  </MainLayout>
);

export default RenderToRoot(FiltersPage);
