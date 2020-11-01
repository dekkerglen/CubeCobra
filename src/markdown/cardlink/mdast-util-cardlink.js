function enterCardlink(token) {
  this.enter({ type: 'cardlink', value: '' }, token);
  this.buffer();
}

function enterCardlinkValue(token) {
  this.config.enter.data.call(this, token);
}

function exitCardlinkValue(token) {
  this.config.exit.data.call(this, token);
}

function exitCardlink(token) {
  const data = this.resume();
  const node = this.exit(token);
  node.value = data;
}

export const fromMarkdown = {
  enter: { cardlink: enterCardlink, cardlinkValue: enterCardlinkValue },
  exit: { cardlink: exitCardlink, cardlinkValue: exitCardlinkValue },
};

export default {
  fromMarkdown: fromMarkdown,
};
