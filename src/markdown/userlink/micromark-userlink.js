import assert from 'assert';
import { markdownLineEnding, markdownSpace } from 'micromark-util-character';

function tokenizeUserlink(effects, ok, nok) {
  // eslint-disable-next-line @typescript-eslint/no-this-alias
  const self = this;
  return start;

  function start(code) {
    assert(code === 64, 'expected `@`');
    // '@' shouldn't be preceded by an actual character
    if (!self.previous || markdownSpace(self.previous) || markdownLineEnding(self.previous)) {
      effects.enter('userlink');
      effects.enter('userlinkMarker');
      effects.consume(code);
      effects.exit('userlinkMarker');
      return open;
    }

    return nok(code);
  }

  // make sure at least one alphanum. char is after the '@'
  function open(code) {
    if (/[a-zA-Z0-9]/.test(String.fromCharCode(code))) {
      effects.enter('userlinkValue');
      effects.consume(code);
      return more;
    }
    return nok(code);
  }

  function more(code) {
    if (/[a-zA-Z0-9]/.test(String.fromCharCode(code))) {
      effects.consume(code);
      return more;
    }
    effects.exit('userlinkValue');
    effects.exit('userlink');
    return ok(code);
  }
}

const userlink = {
  tokenize: tokenizeUserlink,
};

export default {
  text: {
    64: userlink, // '@'
  },
};
