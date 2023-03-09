function enterCentering(token) {
  this.enter({ type: 'element', tagName: 'centering', children: [] }, token);
}

function exitCentering(token) {
  this.exit(token);
}

export const fromMarkdown = {
  enter: { centering: enterCentering },
  exit: { centering: exitCentering },
};

export default { fromMarkdown };
