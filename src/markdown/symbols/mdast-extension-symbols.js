function enterSymbol(token) {
  this.enter({ type: 'symbol', value: '' }, token);
  this.buffer();
}

function enterSymbolValue(token) {
  this.config.enter.data.call(this, token);
}

function exitSymbolValue(token) {
  this.config.exit.data.call(this, token);
}

function exitSymbol(token) {
  let data = this.resume();
  let node = this.exit(token);
  node.value = data;
}

export const fromMarkdown = {
  enter: { symbol: enterSymbol, symbolValue: enterSymbolValue },
  exit: { symbol: exitSymbol, symbolValue: exitSymbolValue },
};

export default {
  fromMarkdown: fromMarkdown,
};
