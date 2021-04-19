function enterCardrow(token) {
  this.enter({ type: 'cardrow', children: [] }, token);
}

function exitCardrow(token) {
  this.exit(token);
}

export const fromMarkdown = {
  enter: { cardrow: enterCardrow },
  exit: { cardrow: exitCardrow },
};

export default { fromMarkdown };
