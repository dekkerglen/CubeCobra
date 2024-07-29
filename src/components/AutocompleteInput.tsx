/* eslint-disable react/no-array-index-key */
import React, { forwardRef, useCallback, useEffect, useMemo, useState, useContext, ReactNode } from 'react';
import { Input, InputProps } from 'reactstrap';
import withAutocard from 'components/WithAutocard';
import AutocardContext from 'contexts/AutocardContext';

interface AutocardLiProps {
  inModal: boolean;
  image: string;
  onClick: (event: React.MouseEvent<HTMLLIElement, MouseEvent>) => void;
  className?: string;
  children?: ReactNode;
}

const AutocardLi = withAutocard('li') as React.ForwardRefExoticComponent<
  AutocardLiProps & React.RefAttributes<HTMLLIElement>
>;

// Deepmerge utility
function isMergeableObject(val: any): val is Record<string, any> {
  const nonNullObject = val && typeof val === 'object';

  return (
    nonNullObject &&
    Object.prototype.toString.call(val) !== '[object RegExp]' &&
    Object.prototype.toString.call(val) !== '[object date]'
  );
}

function emptyTarget<T>(val: T): T {
  return Array.isArray(val) ? ([] as T) : ({} as T);
}

function cloneIfNecessary<T>(value: T, optionsArgument?: { clone?: boolean }): T {
  const clone = optionsArgument && optionsArgument.clone === true;
  return clone && isMergeableObject(value) ? deepmerge(emptyTarget(value), value, optionsArgument) : value;
}

function mergeObject<T extends Record<string, any>>(target: T, source: T, optionsArgument?: { clone?: boolean }): T {
  const destination: T = {} as T;
  if (isMergeableObject(target)) {
    Object.keys(target).forEach((key) => {
      destination[key as keyof T] = cloneIfNecessary(target[key as keyof T], optionsArgument);
    });
  }
  Object.keys(source).forEach((key) => {
    if (!isMergeableObject(source[key]) || !target[key as keyof T]) {
      destination[key as keyof T] = cloneIfNecessary(source[key as keyof T], optionsArgument);
    } else {
      destination[key as keyof T] = deepmerge(target[key as keyof T], source[key as keyof T], optionsArgument);
    }
  });
  return destination;
}

function deepmerge<T extends {} | any[]>(
  target: T,
  source: T,
  optionsArgument?: { clone?: boolean; arrayMerge?: <U>(target: U[], source: U[], options?: any) => U[] },
): T {
  const array = Array.isArray(source);
  const options = optionsArgument || {
    arrayMerge: defaultArrayMerge,
  };
  const arrayMerge = options.arrayMerge || defaultArrayMerge;

  if (array) {
    return Array.isArray(target)
      ? (arrayMerge(target, source, optionsArgument) as T)
      : cloneIfNecessary(source, optionsArgument);
  }
  return mergeObject(target, source, optionsArgument);
}

function defaultArrayMerge<T>(target: T[], source: T[], optionsArgument?: { clone?: boolean }): T[] {
  const destination = target.slice();
  source.forEach((e, i) => {
    if (typeof destination[i] === 'undefined') {
      destination[i] = cloneIfNecessary(e, optionsArgument);
    } else if (isMergeableObject(e)) {
      destination[i] = deepmerge(target[i] as any, e, optionsArgument);
    } else if (target.indexOf(e) === -1) {
      destination.push(cloneIfNecessary(e, optionsArgument));
    }
  });
  return destination;
}

interface TreeNode {
  [key: string]: TreeNode;
}

function getPosts(names: TreeNode, current: string): TreeNode {
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

function getAllMatches(names: TreeNode, current: string): string[] {
  const posts = getPosts(names, current);
  const words = treeToWords(posts, 10).slice(0, 10);

  for (let i = 0; i < words.length; i++) {
    words[i] = current + words[i];
    words[i] = words[i].substr(0, words[i].length - 1);
  }
  return words;
}

function treeToWords(tree: TreeNode, max: number): string[] {
  if (isEmpty(tree)) {
    return [];
  }
  const words: string[] = [];
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

function isEmpty(obj: any): boolean {
  for (const prop in obj) {
    // eslint-disable-next-line no-prototype-builtins
    if (obj.hasOwnProperty(prop)) {
      return false;
    }
  }
  return true;
}

// Map URL => Promise returning tree
export const treeCache: Record<string, Promise<TreeNode | null>> = {};

const fetchTree = async (treeUrl: string, treePath: string): Promise<TreeNode | null> => {
  const response = await fetch(treeUrl);
  if (!response.ok) {
    console.error(`Failed to fetch autocomplete tree: ${response.status}`);
    return null;
  }
  const json = await response.json();
  if (json.success !== 'true') {
    console.error('Error getting autocomplete tree.');
    return null;
  }

  return json[treePath];
};

interface AutocompleteInputProps extends InputProps {
  treeUrl: string;
  treePath: string;
  defaultValue?: string;
  value: string;
  setValue: (value: string) => void;
  onSubmit?: (event: React.FormEvent<HTMLInputElement>, match?: string) => void;
  wrapperClassName?: string;
  cubeId?: string;
  noMargin?: boolean;
}

const AutocompleteInput = forwardRef<Input, AutocompleteInputProps>(
  (
    { treeUrl, treePath, defaultValue, value, setValue, onSubmit, wrapperClassName, cubeId, noMargin, ...props },
    ref,
  ) => {
    const [tree, setTree] = useState<TreeNode>({});
    const [position, setPosition] = useState(-1);
    const [visible, setVisible] = useState(false);
    const { hideCard } = useContext(AutocardContext);

    useEffect(() => {
      const wrapper = async () => {
        try {
          if (!treeCache[treeUrl]) {
            treeCache[treeUrl] = fetchTree(treeUrl, treePath);
          }
          setTree((await treeCache[treeUrl]) ?? {});
        } catch (e) {
          console.error('Error getting autocomplete tree.', e);
        }
      };
      wrapper();
    }, [treePath, treeUrl]);

    const handleChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        setValue(event.target.value);
        setVisible(true);
        hideCard();
      },
      [hideCard, setValue],
    );

    const acceptSuggestion = useCallback(
      (newValue: string) => {
        setValue(newValue);
        setVisible(false);
        hideCard();
        setPosition(-1);
      },
      [hideCard, setValue],
    );

    const handleClickSuggestion = useCallback(
      (event: React.MouseEvent<HTMLLIElement, MouseEvent>) => {
        event.preventDefault();
        acceptSuggestion(event.currentTarget.textContent!);
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
      (event: React.KeyboardEvent<HTMLInputElement>) => {
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
