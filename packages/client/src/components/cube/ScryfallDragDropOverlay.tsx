import React, { useCallback, useContext, useEffect, useState } from 'react';

import { BoardType } from '@utils/datatypes/Card';

import { CSRFContext } from 'contexts/CSRFContext';
import CubeContext from 'contexts/CubeContext';
import DisplayContext from 'contexts/DisplayContext';

import { Flexbox } from '../base/Layout';
import Text from '../base/Text';

/**
 * Extracts the Scryfall card ID from a Scryfall image URL
 * Pattern: https://cards.scryfall.io/{size}/front/f/b/fbdaa29b-85ff-4a06-b27e-fcdbdfd4a3fe.jpg
 * Returns: fbdaa29b-85ff-4a06-b27e-fcdbdfd4a3fe
 */
const extractScryfallId = (url: string): string | null => {
  try {
    const match = url.match(/cards\.scryfall\.io\/[^/]+\/[^/]+\/[^/]+\/[^/]+\/([a-f0-9-]+)\.(jpg|png)/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
};

/**
 * Extracts the image URL from the drag data
 */
const getImageUrlFromDrag = (dataTransfer: DataTransfer): string | null => {
  const html = dataTransfer.getData('text/html');
  if (!html) return null;

  // Parse HTML to find the img tag
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const img = doc.querySelector('img');

  if (!img) return null;

  const src = img.getAttribute('src');
  return src || null;
};

const ScryfallDragDropOverlay: React.FC = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [isValidDrag, setIsValidDrag] = useState(false);
  const [isDraggingFromWindow, setIsDraggingFromWindow] = useState(false);
  const { csrfFetch } = useContext(CSRFContext);
  const { addCard, cube, setAlerts } = useContext(CubeContext);
  const { setRightSidebarMode, showMaybeboard } = useContext(DisplayContext);
  const activeBoard: BoardType = showMaybeboard ? 'maybeboard' : 'mainboard';

  const handleDragStart = useCallback((e: DragEvent) => {
    // Mark that dragging started from within this window
    setIsDraggingFromWindow(true);
  }, []);

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if this drag contains HTML content (likely an image)
    // and is not from within this window
    if (e.dataTransfer && e.dataTransfer.types.includes('text/html') && !isDraggingFromWindow) {
      setIsDragging(true);
      setIsValidDrag(true);
    }
  }, [isDraggingFromWindow]);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Only hide if we're leaving the window entirely
    if (e.relatedTarget === null || (e.target as HTMLElement).nodeName === 'HTML') {
      setIsDragging(false);
      setIsValidDrag(false);
    }
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      setIsDragging(false);
      setIsValidDrag(false);

      // Don't add card if the drag originated from this window
      if (isDraggingFromWindow) {
        setIsDraggingFromWindow(false);
        return;
      }

      const imageUrl = getImageUrlFromDrag(e.dataTransfer!);
      if (!imageUrl) {
        setAlerts((prev) => [...prev, { color: 'danger', message: 'Could not find image URL from dragged content.' }]);

        // Auto-dismiss error alert after 5 seconds
        setTimeout(() => {
          setAlerts((prev) => prev.slice(1));
        }, 5000);
        return;
      }

      const scryfallId = extractScryfallId(imageUrl);
      if (!scryfallId) {
        setAlerts((prev) => [...prev, { color: 'danger', message: 'Could not extract Scryfall ID from image URL.' }]);

        // Auto-dismiss error alert after 5 seconds
        setTimeout(() => {
          setAlerts((prev) => prev.slice(1));
        }, 5000);
        return;
      }

      try {
        // Fetch the card details using the Scryfall ID
        const response = await csrfFetch(`/cube/api/getcardfromid/${scryfallId}`, {
          method: 'GET',
        });

        if (!response.ok) {
          setAlerts((prev) => [...prev, { color: 'danger', message: `Failed to fetch card: ${response.status}` }]);

          // Auto-dismiss error alert after 5 seconds
          setTimeout(() => {
            setAlerts((prev) => prev.slice(1));
          }, 5000);
          return;
        }

        const json = await response.json();
        if (json.success !== 'true' || !json.card) {
          setAlerts((prev) => [...prev, { color: 'danger', message: 'Card not found.' }]);

          // Auto-dismiss error alert after 5 seconds
          setTimeout(() => {
            setAlerts((prev) => prev.slice(1));
          }, 5000);
          return;
        }

        // Add the card to the cube
        await addCard(
          {
            cardID: scryfallId,
            addedTmsp: new Date().valueOf().toString(),
            status: cube.defaultStatus,
          },
          activeBoard,
        );

        // Expand the edit sidebar on desktop only (md breakpoint: 768px)
        if (window.innerWidth >= 768) {
          setRightSidebarMode('edit');
        }

        setAlerts((prev) => [...prev, { color: 'success', message: `Added ${json.card.name} to ${activeBoard}.` }]);

        // Auto-dismiss success alert after 5 seconds
        setTimeout(() => {
          setAlerts((prev) => prev.slice(1));
        }, 5000);
      } catch (error) {
        console.error('Error adding card from drag and drop:', error);
        setAlerts((prev) => [...prev, { color: 'danger', message: 'An error occurred while adding the card.' }]);

        // Auto-dismiss error alert after 5 seconds
        setTimeout(() => {
          setAlerts((prev) => prev.slice(1));
        }, 5000);
      }
    },
    [activeBoard, addCard, cube.defaultStatus, csrfFetch, isDraggingFromWindow, setAlerts, setRightSidebarMode],
  );

  useEffect(() => {
    const dragStart = handleDragStart as unknown as EventListener;
    const dragEnter = handleDragEnter as unknown as EventListener;
    const dragOver = handleDragOver as unknown as EventListener;
    const dragLeave = handleDragLeave as unknown as EventListener;
    const drop = handleDrop as unknown as EventListener;
    const dragEnd = (() => {
      // Reset the flag when dragging ends
      setIsDraggingFromWindow(false);
    }) as unknown as EventListener;

    document.addEventListener('dragstart', dragStart);
    document.addEventListener('dragenter', dragEnter);
    document.addEventListener('dragover', dragOver);
    document.addEventListener('dragleave', dragLeave);
    document.addEventListener('drop', drop);
    document.addEventListener('dragend', dragEnd);

    return () => {
      document.removeEventListener('dragstart', dragStart);
      document.removeEventListener('dragenter', dragEnter);
      document.removeEventListener('dragover', dragOver);
      document.removeEventListener('dragleave', dragLeave);
      document.removeEventListener('drop', drop);
      document.removeEventListener('dragend', dragEnd);
    };
  }, [handleDragStart, handleDragEnter, handleDragOver, handleDragLeave, handleDrop]);

  if (!isDragging || !isValidDrag) {
    return null;
  }

  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
      }}
    >
      <div className="container mx-auto h-full px-4 pt-4 pb-20 md:pb-4 flex items-center justify-center">
        <div
          className="pointer-events-auto rounded-2xl flex items-center justify-center p-12"
          style={{
            backgroundColor: 'rgba(30, 30, 30, 0.95)',
            border: '4px dashed #3b82f6',
            minWidth: '500px',
            minHeight: '300px',
          }}
        >
          <Flexbox direction="col" gap="3" alignItems="center" justify="center">
            <Text semibold className="text-4xl text-center text-white">
              Drop card image here to add to your cube
            </Text>
            <Text className="text-2xl text-center text-blue-500">
              Adding to: {activeBoard === 'mainboard' ? 'Mainboard' : 'Maybeboard'}
            </Text>
          </Flexbox>
        </div>
      </div>
    </div>
  );
};

export default ScryfallDragDropOverlay;
