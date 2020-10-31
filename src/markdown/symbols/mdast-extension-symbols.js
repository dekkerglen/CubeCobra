export const fromMarkdown = {
    enter: {symbol: enterSymbol, symbolValue: enterSymbolValue},
    exit: {symbol: exitSymbol, symbolValue: exitSymbolValue},
};

export default {
    fromMarkdown: fromMarkdown,
};

function enterSymbol(token) {
    this.enter({type: 'symbol', value: ''}, token);
    this.buffer();
}

function exitSymbol(token) {
    let data = this.resume();
    let node = this.exit(token);
    node.value = data;
}

function enterSymbolValue(token) {
    this.config.enter.data.call(this, token);
}

function exitSymbolValue(token) {
    this.config.exit.data.call(this, token);
}