import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';

import classNames from 'classnames';
import { createPortal } from 'react-dom';

import AutocardContext from '../../contexts/AutocardContext';
import { MatchFetcher } from '../../utils/cardAutocomplete';
import withAutocard from '../WithAutocard';
import Input, { InputProps } from './Input';
import Spinner from './Spinner';

const AutocardDiv = withAutocard('div');

// Shorter prefixes match an unhelpfully large slice of the catalog; the server
// enforces the same floor and returns nothing below it.
const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 150;

const normalize = (raw: string): string =>
  (raw || '')
    // Replace curly quotes with straight quotes. Needed for iOS.
    .replace(/[‘’“”]/g, (c: string) => '\'\'""'.substr('‘’“”'.indexOf(c), 1))
    .trim()
    .normalize('NFD') // convert to consistent unicode format
    .replace(/[̀-ͯ]/g, '') // remove unicode
    .toLowerCase();

export interface AutocompleteInputProps extends InputProps {
  // Returns the top matches for a query. See utils/cardAutocomplete for the
  // standard fetchers (cardNameMatches, cubeCardNameMatches, cubeCardTagMatches).
  getMatches: MatchFetcher;
  defaultValue?: string;
  value: string;
  setValue: (value: string) => void;
  onSubmit?: (event: React.FormEvent<HTMLInputElement>, match?: string) => void;
  wrapperClassName?: string;
  cubeId?: string;
  defaultPrinting?: string;
  showImages?: boolean;
  // Render the suggestion dropdown in a body portal (fixed-positioned under the
  // input) so it escapes any scroll/overflow container the input sits inside.
  portalDropdown?: boolean;
}

const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  getMatches,
  value,
  setValue,
  onSubmit,
  cubeId,
  defaultPrinting = null,
  showImages = true,
  portalDropdown = false,
  ...props
}) => {
  const [matches, setMatches] = useState<string[]>([]);
  const [position, setPosition] = useState(-1);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const { hideCard } = useContext(AutocardContext);
  // For the portal dropdown: the input's on-screen box, so the portalled list
  // can be fixed-positioned directly under it (kept fresh on scroll/resize).
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [portalRect, setPortalRect] = useState<{ top: number; left: number; width: number } | null>(null);

  // Guards against out-of-order responses: only the newest request may write
  // state. Bumped per keystroke; stale resolutions compare unequal and no-op.
  const requestSeq = useRef(0);
  const cache = useRef<Map<string, string[]>>(new Map());
  // Held in a ref so a fresh getMatches identity each parent render doesn't
  // restart the debounce timer (callers pass inline fetcher factories).
  const getMatchesRef = useRef(getMatches);
  getMatchesRef.current = getMatches;

  // Clear cache when the fetcher changes (e.g., toggling filter options).
  // Callers should memoize getMatches so identity only changes when params do.
  const prevGetMatches = useRef(getMatches);
  useEffect(() => {
    if (prevGetMatches.current !== getMatches) {
      cache.current.clear();
      prevGetMatches.current = getMatches;
    }
  }, [getMatches]);

  const normalizedValue = normalize(value);

  // Debounced async lookup. Fires only once the user has typed enough and the
  // dropdown is meant to be open; never ships the catalog to the client.
  useEffect(() => {
    if (!visible || normalizedValue.length < MIN_QUERY_LENGTH) {
      setMatches([]);
      setLoading(false);
      return;
    }

    const cached = cache.current.get(normalizedValue);
    if (cached) {
      setMatches(cached);
      setLoading(false);
      return;
    }

    requestSeq.current += 1;
    const seq = requestSeq.current;
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      const result = await getMatchesRef.current(normalizedValue, controller.signal);
      if (seq !== requestSeq.current) return;
      cache.current.set(normalizedValue, result);
      setMatches(result);
      setLoading(false);
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [normalizedValue, visible]);

  // Reset position when value changes externally (e.g., cleared after submit)
  useEffect(() => {
    setPosition(-1);
    if (!value) {
      setVisible(false);
    }
  }, [value]);

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
    (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      event.preventDefault();
      acceptSuggestion(event.currentTarget.textContent!);
    },
    [acceptSuggestion],
  );

  const showMatches =
    visible && !!value && matches.length > 0 && !(matches.length === 1 && matches[0] === normalizedValue);
  // While a lookup is in flight, keep the dropdown open with a single spinner row
  // (the user can keep typing). Resolves to the matches once they arrive.
  const hasQuery = visible && !!value && normalizedValue.length >= MIN_QUERY_LENGTH;
  const showDropdown = hasQuery && (loading || showMatches);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      const enterPressed = event.keyCode === 13;
      if (event.keyCode === 40) {
        // DOWN key
        event.preventDefault();
        setPosition((p) => (p < 9 ? p + 1 : p));
      } else if (event.keyCode === 38) {
        // UP key
        event.preventDefault();
        setPosition((p) => (p > -1 ? p - 1 : p));
      } else if (event.keyCode === 9 || enterPressed) {
        // TAB or ENTER key
        if (showMatches) {
          const goodPosition = position >= 0 && position < matches.length ? position : 0;
          const match = matches[goodPosition];
          acceptSuggestion(match);
          if (enterPressed && onSubmit) {
            // ENTER key
            onSubmit(event, match);
          }
          //If not showing matches but there is a single match for the current card name, then hitting enter should trigger the on submit
        } else if (matches.length === 1 && matches[0] === normalizedValue) {
          if (enterPressed && onSubmit) {
            // ENTER key
            onSubmit(event, matches[0]);
          }
        }
      }
    },
    [position, acceptSuggestion, matches, showMatches, onSubmit, normalizedValue],
  );

  // Portal mode: keep the fixed-positioned dropdown glued under the input while
  // it's open, even as ancestors scroll or the window resizes.
  useEffect(() => {
    if (!portalDropdown || !showDropdown) return undefined;
    const update = () => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (rect) setPortalRect({ top: rect.bottom, left: rect.left, width: rect.width });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [portalDropdown, showDropdown]);

  const dropdownItems = (
    <>
      {loading && (
        <div className="list-none p-2 bg-bg-accent rounded-md flex items-center justify-center">
          <Spinner sm />
        </div>
      )}
      {!loading &&
        matches.map((match, index) => {
          return showImages ? (
            <AutocardDiv
              inModal
              image={
                cubeId
                  ? `/tool/cardimageforcube/${encodeURIComponent(match)}/${cubeId}`
                  : `/tool/cardimage/${encodeURIComponent(match)}` +
                    (defaultPrinting !== null ? `?defaultPrinting=${defaultPrinting}` : '')
              }
              key={index}
              onClick={(e) => handleClickSuggestion(e)}
              className={classNames(
                'list-none p-2 bg-bg-accent hover:bg-bg-active cursor-pointer',
                { 'border-t border-border': index !== 0 },
                { 'bg-bg-active': index === position },
                { 'rounded-t-md': index === 0 },
                { 'rounded-b-md': index === matches.length - 1 },
              )}
            >
              {match}
            </AutocardDiv>
          ) : (
            <div
              key={index}
              onClick={(e) => handleClickSuggestion(e)}
              className={classNames(
                'list-none p-2 bg-bg-accent hover:bg-bg-active cursor-pointer',
                { 'border-t border-border': index !== 0 },
                { 'bg-bg-active': index === position },
                { 'rounded-t-md': index === 0 },
                { 'rounded-b-md': index === matches.length - 1 },
              )}
            >
              {match}
            </div>
          );
        })}
    </>
  );

  return (
    <div ref={wrapperRef} className="relative overflow-y-visible w-full">
      <Input value={value} onKeyDown={handleKeyDown} onChange={handleChange} {...props} />
      {showDropdown &&
        portalDropdown &&
        portalRect &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed border border-border rounded-md flex flex-col z-[1050]"
            style={{ top: `${portalRect.top}px`, left: `${portalRect.left}px`, width: `${portalRect.width}px` }}
          >
            {dropdownItems}
          </div>,
          document.body,
        )}
      {showDropdown && !portalDropdown && (
        <div
          className={classNames(
            'absolute border border-border rounded-md top-0 left-0 translate-y-9 w-full flex flex-col overflow-y-visible z-[1050]',
          )}
        >
          {dropdownItems}
        </div>
      )}
    </div>
  );
};

AutocompleteInput.displayName = 'AutocompleteInput';

export default AutocompleteInput;
