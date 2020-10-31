export const fromMarkdown = {
  enter: { userlink: enterUserlink, userlinkValue: enterUserlinkValue },
  exit: { userlink: exitUserlink, userlinkValue: exitUserlinkValue },
};

export default {
  fromMarkdown: fromMarkdown,
};

function enterUserlink(token) {
  this.enter({ type: 'userlink', value: '' }, token);
  this.buffer();
}

function exitUserlink(token) {
  var data = this.resume();
  var node = this.exit(token);
  node.value = data;
}

function enterUserlinkValue(token) {
  this.config.enter.data.call(this, token);
}

function exitUserlinkValue(token) {
  this.config.exit.data.call(this, token);
}
