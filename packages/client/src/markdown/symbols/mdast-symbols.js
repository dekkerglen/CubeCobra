function enterSymbol(token) {
  this.enter({ type: 'symbol', value: '', data: { hName: 'symbol' } }, token);
  this.buffer();
}

function enterSymbolValue(token) {
  this.config.enter.data.call(this, token);
}

function exitSymbolValue(token) {
  this.config.exit.data.call(this, token);
}

function exitSymbol(token) {
  const data = this.resume();
  const node = this.stack[this.stack.length - 1];
  this.exit(token);

  node.value = data;
  node.data.hProperties = { value: data };
}

export const fromMarkdown = {
  enter: { symbol: enterSymbol, symbolValue: enterSymbolValue },
  exit: { symbol: exitSymbol, symbolValue: exitSymbolValue },
};

export default { fromMarkdown };
