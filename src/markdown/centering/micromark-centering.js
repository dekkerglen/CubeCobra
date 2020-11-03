import assert from 'assert';
import markdownSpace from 'micromark/dist/character/markdown-space';
import markdownLineEnding from 'micromark/dist/character/markdown-line-ending';
import spaceFactory from 'micromark/dist/tokenize/factory-space';
import types from 'micromark/dist/constant/types';
import codes from 'micromark/dist/character/codes';
import { shallowEqual } from 'markdown/utils';

function tokenizeCentering(effects, ok, nok) {
  let size = 0;
  return start;

  function start(code) {
    assert(code === 62, 'expected `>`');
    effects.enter('centering', { _container: true });
    effects.enter('centeringPrefix');
    return sequence(code);
  }

  function sequence(code) {
    if (code === 62) {
      size += 1;
      effects.consume(code);
      return sequence;
    }
    effects.exit('centeringPrefix');
    return after(code);
  }

  function after(code) {
    if (markdownSpace(code)) {
      return spaceFactory(effects, after, types.whitespace)(code);
    }
    return size >= 3 ? ok(code) : nok(code);
  }
}

function tokenizeCenteringEnd(effects, ok, nok) {
  let size = 0;
  return start;

  function start(code) {
    effects.enter('centeringSuffix');
    return sequence(code);
  }

  function sequence(code) {
    if (code === 60) {
      size += 1;
      effects.consume(code);
      return sequence;
    }

    effects.exit('centeringSuffix');
    return after(code);
  }

  function after(code) {
    if (markdownSpace(code)) {
      return spaceFactory(effects, after, types.whitespace)(code);
    }

    if (code === codes.eof || markdownLineEnding(code)) {
      return size === 3 ? ok(code) : nok(code);
    }

    return nok(code);
  }
}

function centering() {
  let shouldEnd = false;
  let endMark;
  const endingConstruct = { tokenize: tokenizeCenteringEnd };

  function tokenizeCenteringContinuation(effects, ok, nok) {
    const now = this.now();
    // the tokenization can be callled twice on the same input, so we have to check where we are as well
    // otherwise the second invocation on the closing fence would return nok, which we don't want
    if (shouldEnd && !shallowEqual(now, endMark)) return nok;
    return spaceFactory(effects, effects.attempt(endingConstruct, markEnd, ok), types.linePrefix, 4);

    function markEnd(code) {
      // we want to include the closing fence in the block, but exit on the next line
      shouldEnd = true;
      // marking the point before the fence so that it can be checked in parent function.
      endMark = now;
      return ok(code);
    }
  }

  function exit(effects) {
    effects.exit('centering');
    shouldEnd = false;
    endMark = undefined;
  }

  return {
    tokenize: tokenizeCentering,
    continuation: { tokenize: tokenizeCenteringContinuation },
    exit,
  };
}

export default {
  document: {
    62: centering(), // '>'
  },
};
