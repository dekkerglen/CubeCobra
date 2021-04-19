const fs = require('fs');

const averagePickPositions = JSON.parse(fs.readFileSync('jobs/export/averagePickPositions.json'));
const mainboardPercents = JSON.parse(fs.readFileSync('jobs/export/mainboardPercent.json'));

const flexibilities = Object.fromEntries(
  Object.entries(averagePickPositions)
    .filter(([name, value]) => value > 0 && (mainboardPercents[name] || mainboardPercents[name] === 0))
    .map(([name, pickPosition]) => [name, (15 * mainboardPercents[name]) / (15 - pickPosition)]),
);

fs.writeFileSync('jobs/export/flexibilities.json', JSON.stringify(flexibilities), 'utf8');

const pickCounts = JSON.parse(fs.readFileSync('jobs/export/pickCounts.json'));
const padToLength = (value, fixedAmount, length) => {
  const valueFixed = value.toFixed(fixedAmount);
  const valueSpacing = new Array(length - valueFixed.length).fill(' ').join('');
  return `${valueSpacing}${valueFixed}`;
};
const outputLine = (name, value, numerator, denominator) =>
  `${name}:${new Array(27 - name.length).fill(' ').join('')} ${padToLength(value, 3, 5)} = ${padToLength(
    numerator,
    3,
    5,
  )} / ${padToLength(denominator, 3, 5)}`;

const sortedPositions = Object.entries(flexibilities)
  .filter(([name]) => mainboardPercents[name] > 0 && mainboardPercents[name] < 1 && pickCounts[name] > 99)
  .sort(([, position], [, position2]) => position2 - position);
console.log('Most Flexible Cards:');
console.log(
  sortedPositions
    .slice(0, 25)
    .map(([name, value]) => outputLine(name, value, mainboardPercents[name], 1 - averagePickPositions[name] / 15))
    .join('\n'),
);
console.log('\nLeast Flexible Cards:');
console.log(
  sortedPositions
    .slice(sortedPositions.length - 25, sortedPositions.length)
    .map(([name, value]) => outputLine(name, value, mainboardPercents[name], 1 - averagePickPositions[name] / 15))
    .join('\n'),
);
