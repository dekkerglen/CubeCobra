import { GetColorIdentity } from 'utils/Sort';
import { fromEntries } from 'utils/Util';

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
    const asfan = card.asfan || 15 / cards.length;
    const colorCategory = GetColorIdentity(card.colors);

    TypeByColor.Total[colorCategory].count += 1;
    TypeByColor.Total[colorCategory].asfan += asfan;
    TypeByColor.Total.Total.count += 1;
    TypeByColor.Total.Total.asfan += asfan;

    let type = null;
    if (card.details.type.toLowerCase().includes('creature')) {
      type = TypeByColor.Creatures;
    } else if (card.details.type.toLowerCase().includes('enchantment')) {
      type = TypeByColor.Enchantments;
    } else if (card.details.type.toLowerCase().includes('land')) {
      type = TypeByColor.Lands;
    } else if (card.details.type.toLowerCase().includes('planeswalker')) {
      type = TypeByColor.Planeswalkers;
    } else if (card.details.type.toLowerCase().includes('instant')) {
      type = TypeByColor.Instants;
    } else if (card.details.type.toLowerCase().includes('sorcery')) {
      type = TypeByColor.Sorceries;
    } else if (card.details.type.toLowerCase().includes('artifact')) {
      type = TypeByColor.Artifacts;
    } else {
      console.warn(`Unrecognized type: ${card.details.type} from ${card.details.name}`);
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
