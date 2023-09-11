function enterUserlink(token) {
  this.enter({ type: 'userlink', value: '', data: { hName: 'userlink' } }, token);
  this.buffer();
}

function enterUserlinkValue(token) {
  this.config.enter.data.call(this, token);
}

function exitUserlinkValue(token) {
  this.config.exit.data.call(this, token);
}

function exitUserlink(token) {
  const data = this.resume();
  const node = this.exit(token);
  node.value = data;
  node.data.hProperties = { name: data };
}

export const fromMarkdown = {
  enter: { userlink: enterUserlink, userlinkValue: enterUserlinkValue },
  exit: { userlink: exitUserlink, userlinkValue: exitUserlinkValue },
};

export default { fromMarkdown };
