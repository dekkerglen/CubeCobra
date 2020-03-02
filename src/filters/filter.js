import { tokenize } from 'parsing/parsingHelpers';

import FilterParser, { ALL_OPERATORS } from 'filters/filterParser';
import FilterVisitor from 'filters/filterVisitor';

export const operatorsRegex = new RegExp(`(?:${ALL_OPERATORS.join('|')})`);
const hybridMap = new Map([
  ['u-w', 'w-u'],
  ['b-w', 'w-b'],
  ['b-u', 'u-b'],
  ['r-u', 'u-r'],
  ['r-b', 'b-r'],
  ['g-b', 'b-g'],
  ['g-r', 'r-g'],
  ['w-r', 'r-w'],
  ['w-g', 'g-w'],
  ['u-g', 'g-u'],
]);

function parseManaCost(cost) {
  const res = [];
  for (let i = 0; i < cost.length; i++) {
    if (cost[i] === '{') {
      const str = cost.slice(i + 1, i + 4).toLowerCase();
      if (str.search(/[wubrg]\/p/) > -1) {
        res.push(`${cost[i + 1]}-p`);
        i += 4;
      } else if (str.search(/2\/[wubrg]/) > -1) {
        res.push(`2-${cost[i + 3]}`);
        i += 4;
      } else if (str.search(/[wubrg]\/[wubrg]/) > -1) {
        let symbol = `${cost[i + 1]}-${cost[i + 3]}`;
        if (hybridMap.has(symbol)) {
          symbol = hybridMap.get(symbol);
        }
        res.push(symbol);
        i += 4;
      } else if (str.search(/^[wubrgscxyz]}/) > -1) {
        res.push(cost[i + 1]);
        i += 2;
      } else if (str.search(/^[0-9]+}/) > -1) {
        const num = str.match(/[0-9]+/)[0];
        if (num.length <= 2) {
          res.push(num);
        }
        i = i + num.length + 1;
      }
    } else if (cost[i].search(/[wubrgscxyz]/) > -1) {
      res.push(cost[i]);
    } else if (cost[i].search(/[0-9]/) > -1) {
      const num = cost.slice(i).match(/[0-9]+/)[0];
      if (num.length <= 2) {
        res.push(num);
      } else {
        return false;
      }
    } else {
      return false;
    }
  }
  return res;
}

export function filterUses(filters, name) {
  if (Array.isArray(filters)) {
    if (filters.length === 0) {
      return true;
    }
    if (filters.length === 1) {
      return filterUses(filters[0], name);
    }
    return filters.some((f) => filterUses(f, name));
  }
  return filters.category === name;
}

export function filterToString(filters) {
  if (Array.isArray(filters) && Array.isArray(filters[0])) {
    return filterToString(filters[0]);
  }
  const s = [];
  let f;
  let arg;
  let operand;
  for (let i = 0; i < filters.length; i++) {
    f = filters[i];
    if (f.type === 'token') {
      arg = f.arg;
      if (Array.isArray(arg)) {
        arg = arg.join('');
      }
      operand = f.operand;
      if (f.not) {
        operand = `!${operand}`;
      }
      s.push(f.category + operand + arg);
    }
  }

  let sep = ' and ';
  if (filters.type) {
    if (filters.type === 'or') {
      sep = ' or ';
    }
  }

  return s.join(sep);
}

export function makeFilter(filterText) {
  if (!filterText || filterText.trim() === '') {
    return {
      err: false,
      filter: null,
    };
  }

  // This is much simpler than adding it into the grammar since it would require
  // a very large lookahead to not be ambiguous.
  if (!operatorsRegex.test(filterText)) {
    filterText = `n:${filterText.replace(/ /g, ' n:')}`;
  }

  const tokens = tokenize(filterText.trim().toLowerCase());
  FilterParser.input = tokens;
  const parsed = FilterParser.parse();
  if (parsed) {
    const filter = FilterVisitor.parse(parsed);
    return {
      err: !filter,
      filter,
    };
  }

  return {
    err: true,
    filter: null,
  };
}

export default {
  operators: ALL_OPERATORS,
  operatorsRegex,
  filterUses,
  filterToString,
  makeFilter,
};
