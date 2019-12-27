import React, { forwardRef, useCallback, useEffect, useMemo, useState } from 'react';

import { Input } from 'reactstrap';

function getAllMatches(names, current) {
  const posts = getPosts(names, current);
  const words = treeToWords(posts, 10).slice(0, 10);

  for (let i = 0; i < words.length; i++) {
    words[i] = current + words[i];
    words[i] = words[i].substr(0, words[i].length - 1);
  }
  return words;
}

function getPosts(names, current) {
  if (current == '') {
    return names;
  } else {
    const character = current.charAt(0);
    const sub = current.substr(1, current.length);

    //please don't try to understand why this works
    if (
      character.toUpperCase() != character.toLowerCase() &&
      (names[character.toUpperCase()] && names[character.toLowerCase()])
    ) {
      if (names[character.toUpperCase()][sub.charAt(0)]) {
        const upper = getPosts(names[character.toUpperCase()], sub);
        if (names[character.toLowerCase()]) {
          const lower = getPosts(names[character.toLowerCase()], sub);
          const res = deepmerge(upper, lower);
          return res;
        } else {
          return upper;
        }
      } else {
        const lower = getPosts(names[character.toLowerCase()], sub);
        if (names[character.toUpperCase()]) {
          const upper = getPosts(names[character.toUpperCase()], sub);
          const res = deepmerge(upper, lower);
          return res;
        } else {
          return lower;
        }
      }
    } else if (names[character.toUpperCase()]) {
      return getPosts(names[character.toUpperCase()], sub);
    } else if (names[character.toLowerCase()]) {
      return getPosts(names[character.toLowerCase()], sub);
    } else {
      return {};
    }
  }
}

function treeToWords(tree, max) {
  if (isEmpty(tree)) {
    return [];
  } else {
    const words = [];
    for (const prop in tree) {
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
}

function isEmpty(obj) {
  for (const prop in obj) {
    if (obj.hasOwnProperty(prop)) {
      return false;
    }
  }
  return true;
}

//Deepmerge utility
function isMergeableObject(val) {
  const nonNullObject = val && typeof val === 'object';

  return (
    nonNullObject &&
    Object.prototype.toString.call(val) !== '[object RegExp]' &&
    Object.prototype.toString.call(val) !== '[object Date]'
  );
}

function emptyTarget(val) {
  return Array.isArray(val) ? [] : {};
}

function cloneIfNecessary(value, optionsArgument) {
  const clone = optionsArgument && optionsArgument.clone === true;
  return clone && isMergeableObject(value) ? deepmerge(emptyTarget(value), value, optionsArgument) : value;
}

function defaultArrayMerge(target, source, optionsArgument) {
  const destination = target.slice();
  source.forEach(function(e, i) {
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

function mergeObject(target, source, optionsArgument) {
  const destination = {};
  if (isMergeableObject(target)) {
    Object.keys(target).forEach(function(key) {
      destination[key] = cloneIfNecessary(target[key], optionsArgument);
    });
  }
  Object.keys(source).forEach(function(key) {
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
  } else {
    return mergeObject(target, source, optionsArgument);
  }
}

deepmerge.all = function deepmergeAll(array, optionsArgument) {
  if (!Array.isArray(array) || array.length < 2) {
    throw new Error('first argument should be an array with at least two elements');
  }

  // we are sure there are at least 2 values, so it is safe to have no initial value
  return array.reduce(function(prev, next) {
    return deepmerge(prev, next, optionsArgument);
  });
};

// Map URL => Promise returning tree
const treeCache = {};

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
  ({ treeUrl, treePath, defaultValue, value, onChange, onSubmit, ...props }, ref) => {
    const [tree, setTree] = useState({});
    const [position, setPosition] = useState(-1);
    const [visible, setVisible] = useState(false);
    let [inputValue, setInputValue] = useState(defaultValue || '');

    if (typeof value !== 'undefined') {
      inputValue = value;
    }

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
    }, [treeUrl]);

    const handleChange = useCallback(
      (event) => {
        setInputValue(event.target.value);
        setVisible(true);
        onChange(event);
      },
      [onChange],
    );

    const acceptSuggestion = useCallback(
      (newValue) => {
        const target = {
          name: props.name,
          value: newValue,
        };
        setInputValue(newValue);
        setVisible(false);
        setPosition(-1);
        onChange({
          target,
          currentTarget: target,
        });
      },
      [onChange, props.name],
    );

    const handleClickSuggestion = useCallback(
      (event) => {
        event.preventDefault();
        acceptSuggestion(event.target.textContent);
      },
      [acceptSuggestion],
    );

    const matches = useMemo(() => getAllMatches(tree, inputValue), [tree, inputValue]);
    const showMatches = visible && inputValue && !(matches.length === 1 && matches[0] === inputValue);

    const handleKeyDown = useCallback(
      (event) => {
        if (event.keyCode == 40) {
          // DOWN key
          event.preventDefault();
          setPosition((position) => (position < 9 ? position + 1 : position));
        } else if (event.keyCode == 38) {
          // UP key
          event.preventDefault();
          setPosition((position) => (position > -1 ? position - 1 : position));
        } else if (event.keyCode == 9 || event.keyCode == 13) {
          // TAB or ENTER key
          if (showMatches) {
            const goodPosition = position >= 0 && position < matches.length ? position : 0;
            const match = matches[goodPosition];
            acceptSuggestion(match);
          }
          if (event.keyCode == 13 && onSubmit) {
            // ENTER key
            onSubmit(event, matches[0] ? matches[0] : '');
          }
        }
      },
      [position, acceptSuggestion, matches, showMatches, onSubmit],
    );

    return (
      <div>
        <Input ref={ref} value={inputValue} onKeyDown={handleKeyDown} onChange={handleChange} {...props} />
        {showMatches && (
          <ul className="autocomplete-list">
            {matches.map((match, index) => (
              <li key={index} onClick={handleClickSuggestion} className={index === position ? 'active' : undefined}>
                {match}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  },
);

export default AutocompleteInput;