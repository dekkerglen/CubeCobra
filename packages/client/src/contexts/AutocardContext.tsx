import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { cardTags, isCardFoil, showsBlackBorderForFoil } from '@utils/cardutil';
import { cdnUrl } from '@utils/cdnUrl';
import Card from '@utils/datatypes/Card';
import { TagColor } from '@utils/datatypes/Cube';

import { getTagColorClass, getTagColorStyle } from '../../../utils/src/Util';
import BlackBorderOverlay from '../components/BlackBorderOverlay';
import { Flexbox } from '../components/base/Layout';
import Tag from '../components/base/Tag';

interface Tag {
  value: string;
  colorClass: string;
  colorStyle?: React.CSSProperties;
}

interface CardDivProps {
  hidden: boolean;
  front: string | null;
  back: string | null;
  tags: Tag[];
  zIndex: number;
  foilOverlay: boolean;
  blackBorder: boolean;
  anchor: HTMLElement | null;
}

// Gap between the cursor (or focused trigger) and the preview, and the minimum distance
// the preview keeps from the edge of the viewport.
const GAP = 5;
const EDGE_MARGIN = 5;
// Width budget for the tag rail that sits alongside the preview.
const TAG_WIDTH = 128;

interface Layout {
  left: number;
  top: number;
  tagsLeft: number;
}

/**
 * Place a box of `size` alongside the span [start, end] within `extent`, preferring the
 * trailing side, falling back to the leading side, then to a hard clamp. Every branch
 * resolves inside the viewport, so a preview can never be stranded past the footer.
 */
const placeAlong = (start: number, end: number, size: number, extent: number): number => {
  if (size >= extent - 2 * EDGE_MARGIN) {
    return EDGE_MARGIN;
  }
  if (end + GAP + size <= extent - EDGE_MARGIN) {
    return end + GAP;
  }
  if (start - GAP - size >= EDGE_MARGIN) {
    return start - GAP - size;
  }
  return Math.max(EDGE_MARGIN, extent - EDGE_MARGIN - size);
};

const CardDiv: React.FC<CardDivProps> = ({ hidden, front, back, tags, zIndex, foilOverlay, blackBorder, anchor }) => {
  const [layout, setLayout] = useState<Layout | null>(null);
  const autocardPopup = useRef<HTMLDivElement>(null);
  const cursor = useRef<{ x: number; y: number } | null>(null);

  const visible = !hidden && (front !== null || back !== null);

  const reposition = useCallback(() => {
    const popup = autocardPopup.current;
    if (!popup) {
      return;
    }

    let startX: number;
    let endX: number;
    let startY: number;
    let endY: number;

    if (anchor) {
      const rect = anchor.getBoundingClientRect();
      startX = rect.left;
      endX = rect.right;
      startY = rect.top;
      endY = rect.bottom;
    } else if (cursor.current) {
      startX = cursor.current.x;
      endX = cursor.current.x;
      startY = cursor.current.y;
      endY = cursor.current.y;
    } else {
      return;
    }

    // clientWidth/clientHeight exclude the scrollbars that innerWidth/innerHeight include.
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const { width, height } = popup.getBoundingClientRect();

    const left = placeAlong(startX, endX, width, viewportWidth);
    const top = placeAlong(startY, endY, height, viewportHeight);
    const tagsFitRight = left + width + TAG_WIDTH <= viewportWidth - EDGE_MARGIN;

    setLayout({ left, top, tagsLeft: tagsFitRight ? left + width : Math.max(EDGE_MARGIN, left - TAG_WIDTH) });
  }, [anchor]);

  // Tracked unconditionally. A preview can be triggered with no mouse movement at all —
  // scrolling a card under a resting cursor fires mouseenter on its own — and it still
  // needs somewhere to go.
  useEffect(() => {
    const track = (event: MouseEvent) => {
      cursor.current = { x: event.clientX, y: event.clientY };
    };
    document.addEventListener('mousemove', track, { passive: true });
    return () => document.removeEventListener('mousemove', track);
  }, []);

  // Position before paint so a preview is never shown at the previous card's coordinates.
  useLayoutEffect(() => {
    if (!visible) {
      setLayout(null);
      return;
    }
    reposition();
  }, [visible, front, back, reposition]);

  useEffect(() => {
    if (!visible) {
      return undefined;
    }

    let frameId: number | null = null;
    const schedule = () => {
      if (frameId !== null) {
        return;
      }
      frameId = requestAnimationFrame(() => {
        frameId = null;
        reposition();
      });
    };

    document.addEventListener('mousemove', schedule, { passive: true });
    // Capture, so previews stay glued to the cursor when a scrollable panel scrolls.
    window.addEventListener('scroll', schedule, { passive: true, capture: true });
    window.addEventListener('resize', schedule, { passive: true });
    return () => {
      document.removeEventListener('mousemove', schedule);
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [visible, reposition]);

  const ready = visible && layout !== null;

  const popupStyle: React.CSSProperties = {
    zIndex,
    left: layout?.left ?? 0,
    top: layout?.top ?? 0,
    visibility: ready ? 'visible' : 'hidden',
  };

  const tagPosition: React.CSSProperties = {
    position: 'fixed',
    pointerEvents: 'none',
    zIndex,
    left: layout?.tagsLeft ?? 0,
    top: layout?.top ?? 0,
    maxWidth: `${TAG_WIDTH}px`,
    visibility: ready ? 'visible' : 'hidden',
  };

  return (
    <>
      <div className={back ? 'double-width' : undefined} id="autocardPopup" style={popupStyle} ref={autocardPopup}>
        <div className="autocard-background bg-bg-accent">
          <Flexbox direction="row">
            {front && (
              <div className="col position-relative card-border">
                {blackBorder && <BlackBorderOverlay />}
                {foilOverlay && (
                  <img className="foilOverlay" src={cdnUrl('/content/foilOverlay.png')} alt="foil overlay" />
                )}
                <img className="rounded-b-md" id="autocardImageFront" src={front} alt={front} key={front} />
              </div>
            )}
            {back && (
              <div className="col position-relative card-border">
                {blackBorder && <BlackBorderOverlay />}
                {foilOverlay && (
                  <img className="foilOverlay" src={cdnUrl('/content/foilOverlay.png')} alt="foil overlay" />
                )}
                <img className="rounded-b-md" id="autocardImageBack" src={back} alt={back} key={back} />
              </div>
            )}
          </Flexbox>
        </div>
      </div>
      {tags.length > 0 && (
        <div id="autocardTags" style={tagPosition}>
          <div
            className="mx-2 autocard-tags-container bg-bg-accent"
            style={{ padding: '0.5rem', whiteSpace: 'nowrap', overflow: 'hidden', borderRadius: '0.5rem' }}
          >
            <Flexbox direction="col" gap="1">
              {tags.map((tag) => (
                <Tag key={tag.value} text={tag.value} colorClass={tag.colorClass} colorStyle={tag.colorStyle} />
              ))}
            </Flexbox>
          </div>
        </div>
      )}
    </>
  );
};

export interface AutocardContextValue {
  /**
   * Shows a preview and returns a token identifying it, or null if nothing was shown.
   * Pass the token back to hideCard so a stale trigger can't dismiss a newer preview.
   */
  showCard: (
    card: any,
    inModal: boolean,
    showCustomImages: boolean,
    tagColors: TagColor[],
    anchor?: HTMLElement | null,
  ) => number | null;
  hideCard: (token?: number | null) => void;
  stopAutocard: boolean;
  setStopAutocard: React.Dispatch<React.SetStateAction<boolean>>;
}

const AutocardContext = React.createContext<AutocardContextValue>({
  showCard: () => null,
  hideCard: () => {},
  stopAutocard: false,
  setStopAutocard: () => {},
});

export const AutocardContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hidden, setHidden] = useState(true);
  const [foilOverlay, setFoilOverlay] = useState(false);
  const [blackBorder, setBlackBorder] = useState(false);
  const [front, setFront] = useState<string | null>(null);
  const [back, setBack] = useState<string | null>(null);
  const [stopAutocard, setStopAutocard] = useState(false);
  const [tags, setTags] = useState<Tag[]>([]);
  const [zIndex, setZIndex] = useState(500);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const token = useRef(0);

  const showCard = useCallback(
    (
      card: Card,
      inModal: boolean,
      showCustomImages: boolean,
      tagColors: TagColor[],
      anchorElement?: HTMLElement | null,
    ) => {
      if (stopAutocard || !card) {
        return null;
      }

      setHidden(false);
      setFoilOverlay(isCardFoil(card));
      setBlackBorder(showsBlackBorderForFoil(card, isCardFoil(card)));
      setFront(((showCustomImages && card.imgUrl) || card.details?.image_normal) ?? null);
      setBack(((showCustomImages && card.imgBackUrl) || card.details?.image_flip) ?? null);
      setTags(
        cardTags(card).map((tag) => ({
          value: tag,
          colorClass: getTagColorClass(tagColors, tag),
          colorStyle: getTagColorStyle(tagColors, tag),
        })),
      );
      setZIndex(inModal ? 1500 : 500);
      setAnchor(anchorElement ?? null);

      token.current += 1;
      return token.current;
    },
    [stopAutocard],
  );

  const hideCard = useCallback((forToken?: number | null) => {
    // A trigger that was superseded before it unmounted must not dismiss the preview
    // that replaced it. An argument-less call is an unconditional dismiss.
    if (forToken !== undefined && forToken !== null && forToken !== token.current) {
      return;
    }

    token.current += 1;
    setHidden(true);
    setFoilOverlay(false);
    setBlackBorder(false);
    setFront(null);
    setBack(null);
    setTags([]);
    setAnchor(null);
  }, []);

  // The trigger's own mouseleave is not a sufficient dismiss signal: it never fires when
  // the pointer leaves the window, when the tab is backgrounded, or when the element is
  // removed while hovered. Without these the preview is stranded on screen and then
  // follows the cursor around on its return.
  useEffect(() => {
    const dismiss = () => hideCard();
    const handleMouseOut = (event: MouseEvent) => {
      // A null relatedTarget means the pointer left the window, or the element under it
      // was removed from the document.
      if (!event.relatedTarget) {
        hideCard();
      }
    };
    const handleVisibility = () => {
      if (document.hidden) {
        hideCard();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        hideCard();
      }
    };

    window.addEventListener('blur', dismiss);
    document.addEventListener('mouseout', handleMouseOut);
    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('blur', dismiss);
      document.removeEventListener('mouseout', handleMouseOut);
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [hideCard]);

  const value: AutocardContextValue = {
    showCard,
    hideCard,
    stopAutocard,
    setStopAutocard,
  };

  return (
    <AutocardContext.Provider value={value}>
      {children}
      <CardDiv
        hidden={hidden}
        front={front}
        back={back}
        tags={tags}
        zIndex={zIndex}
        foilOverlay={foilOverlay}
        blackBorder={blackBorder}
        anchor={anchor}
      />
    </AutocardContext.Provider>
  );
};

export default AutocardContext;
