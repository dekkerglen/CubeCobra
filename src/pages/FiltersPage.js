import React from 'react';
import PropTypes from 'prop-types';

import { Card, CardHeader } from 'reactstrap';

import DynamicFlash from 'components/DynamicFlash';
import Advertisement from 'components/Advertisement';
import Accordion from 'components/Accordion';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

const ContactPage = ({ user, loginCallback }) => (
  <MainLayout loginCallback={loginCallback} user={user}>
    <Advertisement />
    <DynamicFlash />
    <Card className="my-3 mx-4">
      <CardHeader>
        <h4>Filter Syntax Guide</h4>
      </CardHeader>
      <Accordion title="General" defaultExpand>
        <p>
          You can combine any number of filters together using <code>AND</code> or <code>OR</code>. Operators are
          case-insensitive, as are all filtering conditions (<code>TYPE:instant and o:DESTROY</code> will still work,
          for example).
        </p>
        <p>
          <strong>Examples:</strong>
        </p>
        <table className="table">
          <tr>
            <td>
              <code>t:instant OR t:sorcery</code>
            </td>
            <td>Cards that are either instants or sorceries.</td>
          </tr>
          <tr>
            <td>
              <code>t:instant t:tribal</code>
            </td>
            <td>Cards that are both instants and tribal.</td>
          </tr>
        </table>
        <p>Text without a filtering condition is treated as a name. You can use quotes to require an exact match.</p>
        <p>
          <strong>Examples:</strong>
        </p>
        <table className="table">
          <tr>
            <td>
              <code>goblin blood</code>
            </td>
            <td>Cards whose names contain both &quot;blood&quot; and &quot;goblin&quot;.</td>
          </tr>
          <tr>
            <td>
              <code>&quot;goblin blood&quot;</code>
            </td>
            <td>Cards whose names contain exactly &quot;goblin blood&quot;.</td>
          </tr>
          <tr>
            <td>
              <code>o:destroy o:target o:creature</code>{' '}
            </td>
            <td>
              Cards whose oracle text contains each of &quot;destroy&quot;, &quot;target&quot;, and
              &quot;creature&quot;.
            </td>
          </tr>
          <tr>
            <td>
              <code>o:&quot;destroy target creature&quot;</code>
            </td>
            <td>Cards whose oracle text contains exactly &quot;destroy target creature&quot;.</td>
          </tr>
        </table>
        <p>You can also use parentheses to combine clauses.</p>
        <p>
          <strong>Examples:</strong>
        </p>
        <table className="table">
          <tr>
            <td>
              <code>t:instant OR (t:creature o:flash)</code>
            </td>
            <td>Cards which are instants, or cards which are creatures with flash.</td>
          </tr>
          <tr>
            <td>
              <code>(t:artifact t:creature) OR (-t:creature o:create)</code>
            </td>
            <td>
              Cards which are artifact creatures, or cards that aren't creatures and have &quot;create&quot; in their
              oracle text.
            </td>
          </tr>
        </table>
        <p>
          You can put <code>-</code> before anything to negate it.
        </p>
        <p>
          <strong>Examples:</strong>
        </p>
        <table className="table">
          <tr>
            <td>
              <code>-c:w</code>{' '}
            </td>
            <td>Cards that are not white.</td>
          </tr>
          <tr>
            <td>
              <code>-o:draw</code>{' '}
            </td>
            <td>Cards which do not have draw in their oracle text.</td>
          </tr>
          <tr>
            <td>
              <code>-t:creature</code>{' '}
            </td>
            <td>Cards which are not creatures.</td>
          </tr>
          <tr>
            <td>
              <code>-mox</code>{' '}
            </td>
            <td>Cards whose names do not include &quot;mox&quot;.</td>
          </tr>
        </table>
      </Accordion>
      <Accordion title="Color and Color Identity">
        <p>
          You can find cards that are a certain color by using <code>c:</code> or <code>color:</code>, and cards with a
          certain color identity by using <code>ci:</code>, <code>id:</code> or <code>identity:</code>.
        </p>
        <p>
          Operators supported: <code>:</code>, <code>=</code>, <code>{'<'}</code>, <code>'{'>'}</code>,{' '}
          <code>{'<='}</code>, <code>{'>='}</code>.
        </p>
        <p>
          In addition to <code>w</code>, <code>u</code>, <code>b</code>, <code>r</code>, <code>g</code> and{' '}
          <code>c</code>, you can use color words like <code>white</code>, <code>blue</code>, <code>green</code>, etc.
        </p>
        <p>
          You can also use all shard, wedge, or guild names, like <code>azorius</code>, <code>bant</code>,{' '}
          <code>dimir</code>, etc.
        </p>
        <p>You can also compare by number of colors by using numbers instead of color names.</p>
        <p>
          Color Identity searches will respect any color identity overrides you have set while filtering in your cube.
        </p>
        <p>
          <strong>Examples:</strong>
        </p>
        <table className="table">
          <tr>
            <td>
              <code>c=wubrg</code>{' '}
            </td>
            <td>Cards that are all 5 colors.</td>
          </tr>
          <tr>
            <td>
              <code>{`c<esper`}</code>{' '}
            </td>
            <td>Cards who colors are a subset of Esper (UB, WB, WU, U, B, W, or colorless).</td>
          </tr>
          <tr>
            <td>
              <code>ci:wu</code>{' '}
            </td>
            <td>Cards whose color identities are exactly white blue.</td>
          </tr>
          <tr>
            <td>
              <code>{'ci>azorius'}</code>
            </td>
            <td>Cards whose color identities contain white, blue, and at least one other color.</td>
          </tr>
          <tr>
            <td>
              <code>{'ci>1'}</code>{' '}
            </td>
            <td>Cards with more than 1 color in their identity.</td>
          </tr>
        </table>
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
          <strong>Examples:</strong>
        </p>
        <table className="table">
          <tr>
            <td>
              <code>type=legendary</code>{' '}
            </td>
            <td>Cards that are legendary.</td>
          </tr>
          <tr>
            <td>
              <code>t:legendary t:creature</code>{' '}
            </td>
            <td>Cards that are legendary creatures.</td>
          </tr>
          <tr>
            <td>
              <code>t:sha</code>{' '}
            </td>
            <td>Cards that are shamans, or shapeshifters, spellshapers.</td>
          </tr>
        </table>
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
          This searches the full oracle text, including reminder text. The set code can be either upper or lower case.
        </p>
        <p>
          <strong>Examples:</strong>
        </p>
        <table className="table">
          <tr>
            <td>
              <code>o:&quot;draw a card&quot;</code>{' '}
            </td>
            <td>Cards whose oracle text contains &quot;draw a card&quot;.</td>
          </tr>
          <tr>
            <td>
              <code>o:&quot;:&quot;</code>{' '}
            </td>
            <td>Cards whose oracle text contains &quot;:&quot; (cards with activated abilities).</td>
          </tr>
          <tr>
            <td>
              <code>s:war</code>
            </td>
            <td>Cards from War of the Spark.</td>
          </tr>
        </table>
      </Accordion>
      <Accordion title="Mana Costs">
        <p>
          You can use <code>m:</code> or <code>mana:</code> to search for cards with specific mana costs.
        </p>
        <p>
          Operators Supported: <code>:</code>, <code>=</code>.
        </p>
        <p>You can use plain numbers and letters for the 5 basic colors, snow, colorless, and x, y, and z costs.</p>
        <p>
          For hybrid costs, you can use <code>{'{}'}</code> i.e. <code>{'{2/G}'}</code>, <code>{'{R/G}'}</code>, etc.
        </p>
        <p>
          For phyrexian mana, use <code>{'{W/P}'}</code>.
        </p>
        <p>
          You can also surround mana costs with <code>{}</code> if you prefer, i.e. <code>{'{2}{G}{g}'}</code> instead
          of <code>2GG</code>. Either way is fine.
        </p>
        <p>
          You can search for cards that require two or more colors with <code>is:gold</code>, and cards that contain
          hybrid symbols with <code>is:hybrid</code> or Phyrexian mana symbols with <code>is:phyrexian</code>.
        </p>
        <p>
          <strong>Examples:</strong>
        </p>
        <table className="table">
          <tr>
            <td>
              <code>m:{'{r/g}{r/g}'}</code>{' '}
            </td>
            <td>Cards that cost two hybrid red/green mana, i.e. Burning Tree Emissary.</td>
          </tr>
          <tr>
            <td>
              <code>m:2ww</code>{' '}
            </td>
            <td>Cards that cost 2 generic mana, and 2 white mana.</td>
          </tr>
          <tr>
            <td>
              <code>is:gold</code>
            </td>
            <td>Cards that require two or more colors.</td>
          </tr>
          <tr>
            <td>
              <code>is:hybrid</code>
            </td>
            <td>Cards with one or more hybrid mana symbols.</td>
          </tr>
          <tr>
            <td>
              <code>is:phyrexian</code>
            </td>
            <td>Cards with one or more Phyrexian mana symbols.</td>
          </tr>
        </table>
      </Accordion>
      <Accordion title="Converted Mana Cost">
        <p>
          You can use <code>cmc:</code> to search for specific converted mana costs.
        </p>
        <p>
          Operators supported: <code>:</code>, <code>=</code>, <code>{'<'}</code>, <code>{'>'}</code>,{' '}
          <code>{'<='}</code>, <code>{'>='}</code>.
        </p>
        <p>
          <strong>Examples:</strong>
        </p>
        <table className="table">
          <tr>
            <td>
              {' '}
              <code>{'cmc>5'}</code>{' '}
            </td>
            <td>Cards with converted mana cost greater than 5.</td>
          </tr>
          <tr>
            <td>
              <code>cmc=3</code>{' '}
            </td>
            <td>Cards with converted mana cost of exactly 3.</td>
          </tr>
        </table>
      </Accordion>
      <Accordion title="Power, Toughness, and Loyalty">
        <p>
          You can use <code>pow:</code> or <code>power:</code> to search for cards with certain powers.
        </p>
        <p>
          You can use <code>tou:</code> or <code>toughness:</code> to search for cards with certain toughness.
        </p>
        <p>
          You can use <code>loy:</code> or
          <code>loyalty:</code> to search for cards with certain starting loyalty.
        </p>
        <p>
          Operators supported: <code>:</code>, <code>=</code>, <code>{'<'}</code>, <code>{'>'}</code>,{' '}
          <code>{'<='}</code>, <code>{'>='}</code>.
        </p>
        <p>
          <strong>Examples:</strong>
        </p>
        <table className="table">
          <tr>
            <td>
              <code>{'pow>7'}</code>
            </td>
            <td>Cards with greater than 7 power.</td>
          </tr>
          <tr>
            <td>
              <code>{'pow<5 tou<5'}</code>
            </td>
            <td>Cards with both less than 5 power, and less than 5 toughness.</td>
          </tr>
          <tr>
            <td>
              <code>loy:3 or loy:4</code>
              <td>Cards with a starting loyalty of 3 or 4.</td>
            </td>
          </tr>
        </table>
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
          <strong>Examples:</strong>
        </p>
        <table className="table">
          <tr>
            <td>
              <code>r:common</code>
            </td>
            <td>Common cards.</td>
          </tr>
          <tr>
            <td>
              <code>{'r<=uncommon'}</code>
            </td>
            <td>Common or uncommon cards.</td>
          </tr>
          <tr>
            <td>
              <code>r:common or r:rare</code>
            </td>
            <td>Common or rare cards.</td>
          </tr>
        </table>
      </Accordion>
      <Accordion title="Artist">
        <p>
          You can use <code>a:</code>, <code>art:</code>, or <code>artist:</code> to search for cards illustrated by a
          specific artist.
        </p>
        <p>
          <strong>Examples:</strong>
          <table className="table">
            <tr>
              <td>
                <code>a:&quot;seb mckinnon&quot;</code>
              </td>
              <td>All cards illustrated by Seb Mckinnon.</td>
            </tr>
            <tr>
              <td>
                <code>a:reb</code>
              </td>
              <td>All cards illustrated by artists with &quot;reb&quot; in their name.</td>
            </tr>
          </table>
        </p>
      </Accordion>
      <Accordion title="Devotion">
        <p>
          You can use <code>d:</code>, <code>dev:</code>, or <code>devotion:</code> to search for cards with a given
          mono-color devotion.
        </p>
        <p>
          You can also append a color to the query to use numbers instead like <code>dw:</code> or{' '}
          <code>devotiontow:</code>.
        </p>
        <p>
          <strong>Examples:</strong>
          <table className="table">
            <tr>
              <td>
                <code>d:www</code>
              </td>
              <td>All cards with exactly 3 white devotion</td>
            </tr>
            <tr>
              <td>
                <code>{'devotiontor>2'}</code>
              </td>
              <td>All cards with more than 2 devotion to red.</td>
            </tr>
          </table>
        </p>
      </Accordion>
      <Accordion title="Price">
        <p>
          You can use <code>price:</code>, <code>priceNormal:</code>, <code>priceFoil:</code>, <code>priceEur:</code>,
          or <code>priceTix:</code> to filter cards by price. When filtering in individual cubes, <code>price:</code>{' '}
          uses the printing specified for the cube. <code>priceEur:</code> uses the nonfoil Card Market prices.{' '}
          <code>priceTix:</code> used MTGO TIX prices.
        </p>
        <p>
          <strong>Examples:</strong>
          <table className="table">
            <tr>
              <td>
                <code>{'price>10.5'}</code>
              </td>
              <td>All cards in a cube whose specified printing has a price over $10.50.</td>
            </tr>
            <tr>
              <td>
                <code>{'priceFoil<10 OR priceNormal<10'}</code>
              </td>
              <td>All cards with a price under $10.</td>
            </tr>
          </table>
        </p>
      </Accordion>
      <Accordion title="Tags">
        <p>
          You can use <code>t:</code>, <code>tag:</code>, or <code>tags:</code> to filter cards by tag or tag count when
          in a cube.
        </p>
        <p>
          <strong>Examples:</strong>
          <table className="table">
            <tr>
              <td>
                <code>t:Signed</code>
              </td>
              <td>All cards in a cube who have a tag named Signed, case insensitive.</td>
            </tr>
            <tr>
              <td>
                <code>tags=0</code>
              </td>
              <td>All cards with no tags.</td>
            </tr>
            <tr>
              <td>
                <code>{'tags>0'}</code>
              </td>
              <td>All cards with at least one tag.</td>
            </tr>
          </table>
        </p>
      </Accordion>
      <Accordion title="Legality">
        <p>
          You can use <code>leg:</code>, <code>legal:</code>, or <code>legality:</code> to filter cards by legality.
        </p>
        <p>
          <strong>Examples:</strong>
          <table className="table">
            <tr>
              <td>
                <code>leg:Modern</code>
              </td>
              <td>All cards that are legal in Modern.</td>
            </tr>
            <tr>
              <td>
                <code>-leg:Standard</code>
              </td>
              <td>All cards that are not legal in Standard.</td>
            </tr>
          </table>
        </p>
      </Accordion>
      <Accordion title="Layout">
        <p>
          You can use <code>layout:</code> to filter cards by layout.
        </p>
        <p>
          <strong>Options:</strong>
          <table className="table">
            {[
              ['normal', 'A standard Magic card with one face'],
              ['split', 'A split-faced card'],
              ['flip', 'Cards that invert vertically with the flip keyword'],
              ['transform', 'Double-sided cards that transform'],
              ['modal_dfc', 'Double-sided cards that can be played either-side'],
              ['meld', 'Cards with meld parts printed on the backsc'],
              ['leveler', 'Cards with Level Up'],
              ['saga', 'Saga-type cards'],
              ['adventure', 'Cards with an Adventure spell part'],
              ['planar', 'Plane and Phenomenon-type cards'],
              ['scheme', 'Scheme-type cards'],
              ['vanguard', 'Vanguard-type cards'],
              ['token', 'Token cards'],
              ['double_faced_token', 'Tokens with another token printed on the back'],
              ['emblem', 'Emblem cards'],
              ['augment', 'Cards with Augment'],
              ['host', 'Host-type cards'],
              ['art_series', 'Art Series collectable double-faced cards'],
              ['double_sided', 'A Magic card with two sides that are unrelated'],
            ].map((tuple) => (
              <tr>
                <td>
                  <code>{tuple[0]}</code>
                </td>
                <td>{tuple[1]}</td>
              </tr>
            ))}
          </table>
        </p>
        <p>
          Additionally, you can use <code>is:dfc</code>, <code>is:mdfc</code>, <code>is:meld</code>,{' '}
          <code>is:transform</code>.
        </p>
      </Accordion>
      <Accordion title="Miscellaneous">
        <p>
          You can use <code>elo:</code> to filter cards by their ELO rating.
        </p>
        <p>
          <strong>Filters for individual cubes:</strong>
        </p>
        <p>
          You can use <code>finish:</code> to filter by cards with the given finish. Available options are
          &quot;Non-foil&quot; and &quot;Foil&quot;.
        </p>
        <p>
          You can use <code>status:</code> to filter by cards with the given status. Available options are &quot;Not
          Owned&quot;, &quot;Ordered&quot;, &quot;Owned&quot;, &quot;Premium Owned&quot;, and &quot;Proxied&quot;.
        </p>
        <p>
          <strong>Examples:</strong>
          <table className="table">
            <tr>
              <td>
                <code>{'elo>1500'}</code>
              </td>
              <td>All cards with an ELO rating above 1500.</td>
            </tr>
            <tr>
              <td>
                <code>finish:non-foil</code>
              </td>
              <td>All cards with the non-foil finish selected.</td>
            </tr>
            <tr>
              <td>
                <code>status:&quot;Premium Owned&quot;</code>
              </td>
              <td>All cards marked with the &quot;Premium Owned&quot; status.</td>
            </tr>
          </table>
        </p>
      </Accordion>
    </Card>
  </MainLayout>
);

ContactPage.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    notifications: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  }),
  loginCallback: PropTypes.string,
};

ContactPage.defaultProps = {
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(ContactPage);
