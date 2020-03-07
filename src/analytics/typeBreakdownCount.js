import { GetColorIdentity } from 'utils/Sort';
import { fromEntries } from 'utils/Util';
import { propertyForCard } from 'utils/Card';

async function typeBreakdownCount(cards) {
  const TypeByColor = fromEntries(
    ['Creatures', 'Enchantments', 'Lands', 'Planeswalkers', 'Instants', 'Sorceries', 'Artifacts', 'Total'].map(
      (header) => [
        header,
        {
          label: header,
          ...fromEntries(
            ['White', 'Blue', 'Black', 'Red', 'Green', 'Colorless', 'Multicolored', 'Total'].map((color) => [
              color,
              { asfan: 0, count: 0 },
            ]),
          ),
        },
      ],
    ),
  );
  for (const card of cards) {
    const { asfan } = card;
    const colorCategory = GetColorIdentity(propertyForCard(card, 'color_identity'));

    TypeByColor.Total[colorCategory].count += 1;
    TypeByColor.Total[colorCategory].asfan += asfan;
    TypeByColor.Total.Total.count += 1;
    TypeByColor.Total.Total.asfan += asfan;

    let type = null;
    const typeLine = propertyForCard(card, 'type_line').toLowerCase();
    if (typeLine.includes('creature')) {
      type = TypeByColor.Creatures;
    } else if (typeLine.includes('enchantment')) {
      type = TypeByColor.Enchantments;
    } else if (typeLine.includes('land')) {
      type = TypeByColor.Lands;
    } else if (typeLine.includes('planeswalker')) {
      type = TypeByColor.Planeswalkers;
    } else if (typeLine.includes('instant')) {
      type = TypeByColor.Instants;
    } else if (typeLine.includes('sorcery')) {
      type = TypeByColor.Sorceries;
    } else if (typeLine.includes('artifact')) {
      type = TypeByColor.Artifacts;
    } else {
      console.warn(`Unrecognized type: ${typeLine} from ${propertyForCard(card, 'name')}`);
    }
    if (type) {
      type[colorCategory].count += 1;
      type[colorCategory].asfan += asfan;
      type.Total.count += 1;
      type.Total.asfan += asfan;
    }
  }

  for (const type of Object.keys(TypeByColor)) {
    const typed = TypeByColor[type];
    for (const color of Object.keys(typed)) {
      if (color !== 'label') {
        const totalCount = TypeByColor.Total[color].count;
        const { count } = TypeByColor[type][color];
        const countText = String(count);
        let countPercentageStr = '';
        if (totalCount > 0 && type !== 'Total') {
          const countPercentage = Math.round((100.0 * count) / totalCount);
          countPercentageStr = ` %%${countPercentage}%%`;
        }
        TypeByColor[type][color] = `${countText}${countPercentageStr}`;
      }
    }
  }

  return {
    type: 'table',
    description: 'The count of cards in that type and color, percentages are relative to the bottom row of totals.',
    tables: [
      {
        columns: [
          { header: '', key: 'label', rowHeader: true },
          { header: '{w}', key: 'White' },
          { header: '{u}', key: 'Blue' },
          { header: '{b}', key: 'Black' },
          { header: '{r}', key: 'Red' },
          { header: '{g}', key: 'Green' },
          { header: '{c}', key: 'Colorless' },
          { header: '{m}', key: 'Multicolored' },
          { header: 'Total', key: 'Total' },
        ],
        rows: [
          TypeByColor.Creatures,
          TypeByColor.Instants,
          TypeByColor.Sorceries,
          TypeByColor.Enchantments,
          TypeByColor.Artifacts,
          TypeByColor.Planeswalkers,
          TypeByColor.Lands,
          TypeByColor.Total,
        ],
      },
    ],
  };
}

export default typeBreakdownCount;
