/* eslint-disable react/prop-types */
/* eslint-disable react/no-array-index-key */
/* eslint-disable no-use-before-define */
import React, { forwardRef, useCallback, useEffect, useMemo, useState, useContext } from 'react';

import { Input } from 'reactstrap';
import withAutocard from 'components/WithAutocard';
import AutocardContext from 'contexts/AutocardContext';

const AutocardLi = withAutocard('li');

// Deepmerge utility
function isMergeableObject(val) {
  const nonNullObject = val && typeof val === 'object';

  return (
    nonNullObject &&
    Object.prototype.toString.call(val) !== '[object RegExp]' &&
    Object.prototype.toString.call(val) !== '[object date]'
  );
}

function emptyTarget(val) {
  return Array.isArray(val) ? [] : {};
}

function cloneIfNecessary(value, optionsArgument) {
  const clone = optionsArgument && optionsArgument.clone === true;
  return clone && isMergeableObject(value) ? deepmerge(emptyTarget(value), value, optionsArgument) : value;
}

function mergeObject(target, source, optionsArgument) {
  const destination = {};
  if (isMergeableObject(target)) {
    Object.keys(target).forEach((key) => {
      destination[key] = cloneIfNecessary(target[key], optionsArgument);
    });
  }
  Object.keys(source).forEach((key) => {
    if (!isMergeableObject(source[key]) || !target[key]) {
      destination[key] = cloneIfNecessary(source[key], optionsArgument);
    } else {
      destination[key] = deepmerge(target[key], source[key], optionsArgument);
    }
  });
  return destination;
}

function deepmerge(target, source, optionsArgument) {
  const array = Array.isArray(source);
  const options = optionsArgument || {
    arrayMerge: defaultArrayMerge,
  };
  const arrayMerge = options.arrayMerge || defaultArrayMerge;

  if (array) {
    return Array.isArray(target)
      ? arrayMerge(target, source, optionsArgument)
      : cloneIfNecessary(source, optionsArgument);
  }
  return mergeObject(target, source, optionsArgument);
}

function defaultArrayMerge(target, source, optionsArgument) {
  const destination = target.slice();
  source.forEach((e, i) => {
    if (typeof destination[i] === 'undefined') {
      destination[i] = cloneIfNecessary(e, optionsArgument);
    } else if (isMergeableObject(e)) {
      destination[i] = deepmerge(target[i], e, optionsArgument);
    } else if (target.indexOf(e) === -1) {
      destination.push(cloneIfNecessary(e, optionsArgument));
    }
  });
  return destination;
}

function getPosts(names, current) {
  if (current === '') {
    return names;
  }
  const character = current.charAt(0);
  const sub = current.substr(1, current.length);

  // please don't try to understand why this works
  if (
    character.toUpperCase() !== character.toLowerCase() &&
    names[character.toUpperCase()] &&
    names[character.toLowerCase()]
  ) {
    if (names[character.toUpperCase()][sub.charAt(0)]) {
      const upper = getPosts(names[character.toUpperCase()], sub);
      if (names[character.toLowerCase()]) {
        const lower = getPosts(names[character.toLowerCase()], sub);
        const res = deepmerge(upper, lower);
        return res;
      }
      return upper;
    }
    const lower = getPosts(names[character.toLowerCase()], sub);
    if (names[character.toUpperCase()]) {
      const upper = getPosts(names[character.toUpperCase()], sub);
      const res = deepmerge(upper, lower);
      return res;
    }
    return lower;
  }
  if (names[character.toUpperCase()]) {
    return getPosts(names[character.toUpperCase()], sub);
  }
  if (names[character.toLowerCase()]) {
    return getPosts(names[character.toLowerCase()], sub);
  }
  return {};
}

function getAllMatches(names, current) {
  const posts = getPosts(names, current);
  const words = treeToWords(posts, 10).slice(0, 10);

  for (let i = 0; i < words.length; i++) {
    words[i] = current + words[i];
    words[i] = words[i].substr(0, words[i].length - 1);
  }
  return words;
}

function treeToWords(tree, max) {
  if (isEmpty(tree)) {
    return [];
  }
  const words = [];
  // eslint-disable-next-line guard-for-in
  for (const prop in tree) {
    // eslint-disable-next-line no-prototype-builtins
    if (tree.hasOwnProperty(prop)) {
      if (isEmpty(tree[prop])) {
        words.push(prop);
      }
      const wordlets = treeToWords(tree[prop], max);
      for (let i = 0; i < wordlets.length; i++) {
        words.push(prop + wordlets[i]);
      }
    }
    if (words.length > max) {
      return words;
    }
  }
  return words;
}

function isEmpty(obj) {
  for (const prop in obj) {
    // eslint-disable-next-line no-prototype-builtins
    if (obj.hasOwnProperty(prop)) {
      return false;
    }
  }
  return true;
}

deepmerge.all = function deepmergeAll(array, optionsArgument) {
  if (!Array.isArray(array) || array.length < 2) {
    throw new Error('first argument should be an array with at least two elements');
  }

  // we are sure there are at least 2 values, so it is safe to have no initial value
  return array.reduce((prev, next) => deepmerge(prev, next, optionsArgument));
};

// Map URL => Promise returning tree
export const treeCache = {};

const fetchTree = async (treeUrl, treePath) => {
  const response = await fetch(treeUrl);
  if (!response.ok) {
    console.error(`Failed to fetch autocomplete tree: ${response.statusCode}`);
    return null;
  }
  const json = await response.json();
  if (json.success !== 'true') {
    console.error('Error getting autocomplete tree.');
    return null;
  }

  return json[treePath];
};

const AutocompleteInput = forwardRef(
  (
    { treeUrl, treePath, defaultValue, value, setValue, onSubmit, wrapperClassName, cubeId, noMargin, ...props },
    ref,
  ) => {
    const [tree, setTree] = useState({});
    const [position, setPosition] = useState(-1);
    const [visible, setVisible] = useState(false);
    const { hideCard } = useContext(AutocardContext);

    useEffect(() => {
      const wrapper = async () => {
        try {
          if (!treeCache[treeUrl]) {
            treeCache[treeUrl] = fetchTree(treeUrl, treePath);
          }
          setTree(await treeCache[treeUrl]);
        } catch (e) {
          console.error('Error getting autocomplete tree.', e);
        }
      };
      wrapper();
    }, [treePath, treeUrl]);

    const handleChange = useCallback(
      (event) => {
        setValue(event.target.value);
        setVisible(true);
        hideCard();
      },
      [hideCard, setValue],
    );

    const acceptSuggestion = useCallback(
      (newValue) => {
        setValue(newValue);
        setVisible(false);
        hideCard();
        setPosition(-1);
      },
      [hideCard, setValue],
    );

    const handleClickSuggestion = useCallback(
      (event) => {
        event.preventDefault();
        acceptSuggestion(event.target.textContent);
      },
      [acceptSuggestion],
    );

    // Replace curly quotes with straight quotes. Needed for iOS.
    const normalizedValue = (value || '')
      .replace(/[\u2018\u2019\u201C\u201D]/g, (c) => '\'\'""'.substr('\u2018\u2019\u201C\u201D'.indexOf(c), 1))
      .trim()
      .normalize('NFD') // convert to consistent unicode format
      .replace(/[\u0300-\u036f]/g, '') // remove unicode
      .toLowerCase();

    const matches = useMemo(() => getAllMatches(tree, normalizedValue), [tree, normalizedValue]);
    const showMatches = visible && value && matches.length > 0 && !(matches.length === 1 && matches[0] === value);

    const handleKeyDown = useCallback(
      (event) => {
        if (event.keyCode === 40) {
          // DOWN key
          event.preventDefault();
          setPosition((p) => (p < 9 ? p + 1 : p));
        } else if (event.keyCode === 38) {
          // UP key
          event.preventDefault();
          setPosition((p) => (p > -1 ? p - 1 : p));
        } else if (event.keyCode === 9 || event.keyCode === 13) {
          // TAB or ENTER key
          if (showMatches) {
            const goodPosition = position >= 0 && position < matches.length ? position : 0;
            const match = matches[goodPosition];
            acceptSuggestion(match);
            if (event.keyCode === 13 && onSubmit) {
              // ENTER key
              onSubmit(event, match);
            }
          }
        }
      },
      [position, acceptSuggestion, matches, showMatches, onSubmit],
    );

    return (
      <>
        <Input ref={ref} value={value} onKeyDown={handleKeyDown} onChange={handleChange} {...props} />
        {showMatches && (
          <ul className={`autocomplete-list ${noMargin ? 'mt-0' : ''}`}>
            {matches.map((match, index) => (
              <AutocardLi
                inModal
                image={cubeId ? `/tool/cardimageforcube/${match}/${cubeId}` : `/tool/cardimage/${match}`}
                key={index}
                onClick={handleClickSuggestion}
                className={index === position ? 'active' : undefined}
              >
                {match}
              </AutocardLi>
            ))}
          </ul>
        )}
      </>
    );
  },
);

export default AutocompleteInput;
