import React, { useContext, useMemo, useState } from 'react';

import { cardImageUrl } from '@utils/cardutil';
import Card from '@utils/datatypes/Card';
import { getViewByName } from '@utils/datatypes/Cube';
import { sortForDownload } from '@utils/sorting/Sort';
import { jsPDF } from 'jspdf';

import CubeContext from '../../contexts/CubeContext';
import DisplayContext from '../../contexts/DisplayContext';
import FilterContext from '../../contexts/FilterContext';
import useAlerts from '../../hooks/UseAlerts';
import Button from '../base/Button';
import { Flexbox } from '../base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../base/Modal';
import Spinner from '../base/Spinner';
import Text from '../base/Text';

interface PrintAndPlayExportModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  isSortUsed: boolean;
  isFilterUsed: boolean;
  exportAllBoards?: boolean;
}

const PrintAndPlayExportModal: React.FC<PrintAndPlayExportModalProps> = ({
  isOpen,
  setOpen,
  isSortUsed,
  isFilterUsed,
  exportAllBoards = false,
}) => {
  const { addAlert } = useAlerts();
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const { cube, sortPrimary, sortSecondary, sortTertiary, sortQuaternary } = useContext(CubeContext);
  const { activeView } = useContext(DisplayContext);
  const { cardFilter } = useContext(FilterContext)!;

  // Derive boards to export
  const currentViewBoards = useMemo(() => {
    const view = getViewByName(cube, activeView);
    return view?.boards.map((b) => b.toLowerCase()) || ['mainboard'];
  }, [cube, activeView]);

  const getImageDataUrl = async (url: string): Promise<string> => {
    try {
      // Use server proxy to avoid CORS issues
      const proxyUrl = `/tool/imageproxy?url=${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      const blob = await response.blob();

      // Create object URL and load into image
      const objectUrl = URL.createObjectURL(blob);
      const img = new Image();

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = objectUrl;
      });

      // Convert to canvas and get data URL
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');
      ctx.drawImage(img, 0, 0);

      // Clean up object URL
      URL.revokeObjectURL(objectUrl);

      return canvas.toDataURL('image/jpeg', 0.95);
    } catch (error) {
      console.error('Failed to convert image:', error);
      throw error;
    }
  };

  // Collect the cards to export from the appropriate boards, applying the same
  // filter/sort the user has active, and dropping any card that has no image.
  // Shared by the PDF download and the browser-print paths.
  const collectCardsWithImages = (): Card[] => {
    let boardKeys: string[];
    if (exportAllBoards) {
      boardKeys = Object.keys(cube.cards).filter((k) => k !== 'id');
    } else {
      boardKeys = currentViewBoards;
    }

    let cards: Card[] = [];
    for (const key of boardKeys) {
      const boardCards = cube.cards[key];
      if (Array.isArray(boardCards)) {
        cards = cards.concat(boardCards);
      }
    }

    if (isFilterUsed) {
      cards = cards.filter(cardFilter.filter);
    }

    let sortedCards = cards;
    if (isSortUsed) {
      sortedCards = sortForDownload(
        cards,
        sortPrimary ?? undefined,
        sortSecondary ?? undefined,
        sortTertiary ?? undefined,
        sortQuaternary ?? undefined,
        cube.showUnsorted,
        cube,
      );
    }

    return sortedCards.filter((card) => {
      const imageUrl = cardImageUrl(card);
      return imageUrl && imageUrl.length > 0;
    });
  };

  // Render the cards into a self-contained print window and open the browser's
  // print dialog. Unlike the jsPDF path this just displays the images as <img>
  // tags — no canvas readback — so it needs no image proxy and works directly
  // with the cross-origin hosted card images. Layout matches the PDF: 3x3 grid
  // of 2.5"x3.5" cards on US Letter (0.25" top/bottom, 0.5" left/right margins).
  const printInBrowser = () => {
    const cardsWithImages = collectCardsWithImages();

    if (cardsWithImages.length === 0) {
      addAlert('danger', 'No cards with images found to export.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      addAlert('danger', 'Could not open a print window. Please allow pop-ups for this site and try again.');
      return;
    }

    const escapeHtml = (value: string): string =>
      value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // The print window is about:blank, so relative image paths (e.g. custom-card
    // placeholders at /content/...) must be resolved against the app origin here.
    const toAbsoluteUrl = (url: string): string => {
      try {
        return new URL(url, window.location.href).href;
      } catch {
        return url;
      }
    };

    const imagesHtml = cardsWithImages
      .map((card) => {
        const imageUrl = toAbsoluteUrl(cardImageUrl(card));
        return `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(card.details?.name ?? '')}" />`;
      })
      .join('');

    const title = `${cube.name} - Print and Play`;

    // The inline script waits for every image to finish loading (or error) before
    // opening the print dialog, so no card prints blank. `</script>` is split so
    // it can't terminate this string early when bundled.
    printWindow.document.write(
      `<!doctype html><html><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title>` +
        `<style>` +
        `* { margin: 0; padding: 0; box-sizing: border-box; }` +
        `html, body { background: #fff; }` +
        `.pnp-grid { display: grid; grid-template-columns: repeat(3, 2.5in); grid-auto-rows: 3.5in; }` +
        `.pnp-grid img { width: 2.5in; height: 3.5in; display: block; break-inside: avoid; ` +
        `-webkit-print-color-adjust: exact; print-color-adjust: exact; }` +
        `@page { size: letter; margin: 0.25in 0.5in; }` +
        `</style></head><body>` +
        `<div class="pnp-grid">${imagesHtml}</div>` +
        `<script>(function(){var imgs=Array.prototype.slice.call(document.images);var pending=imgs.length;` +
        `function done(){if(--pending<=0){window.focus();window.print();}}` +
        `if(!pending){window.focus();window.print();return;}` +
        `imgs.forEach(function(img){if(img.complete){done();}else{img.addEventListener('load',done);` +
        `img.addEventListener('error',done);}});})();<\/script>` +
        `</body></html>`,
    );
    printWindow.document.close();

    setOpen(false);
  };

  const generatePrintAndPlayPDF = async () => {
    setIsGenerating(true);
    setProgress({ current: 0, total: 0 });

    try {
      const cardsWithImages = collectCardsWithImages();

      if (cardsWithImages.length === 0) {
        addAlert('danger', 'No cards with images found to export.');
        setIsGenerating(false);
        return;
      }

      setProgress({ current: 0, total: cardsWithImages.length });

      // PDF settings for portrait US Letter: 8.5" x 11"
      // Target: 3 rows × 3 columns, adjacent cards (no spacing), 2.5" × 3.5" printed size
      // Total grid: 7.5" × 10.5" centered on page

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'in',
        format: 'letter',
      });

      const cardWidth = 2.5;
      const cardHeight = 3.5;
      const cardsPerRow = 3;
      const rowsPerPage = 3;
      const cardsPerPage = cardsPerRow * rowsPerPage;

      // Center the grid on the page (no spacing between cards, only outer margins)
      const totalGridWidth = cardWidth * cardsPerRow;
      const totalGridHeight = cardHeight * rowsPerPage;
      const marginLeft = (8.5 - totalGridWidth) / 2;
      const marginTop = (11 - totalGridHeight) / 2;

      let cardIndex = 0;

      for (let i = 0; i < cardsWithImages.length; i++) {
        const card = cardsWithImages[i];
        const imageUrl = cardImageUrl(card);

        if (!imageUrl) continue;

        try {
          // Load image and convert to data URL to avoid CORS issues
          const imageDataUrl = await getImageDataUrl(imageUrl);
          setProgress({ current: i + 1, total: cardsWithImages.length });

          // Calculate position
          const positionInPage = cardIndex % cardsPerPage;
          const row = Math.floor(positionInPage / cardsPerRow);
          const col = positionInPage % cardsPerRow;

          const x = marginLeft + col * cardWidth;
          const y = marginTop + row * cardHeight;

          // Add image to PDF
          pdf.addImage(imageDataUrl, 'JPEG', x, y, cardWidth, cardHeight);

          cardIndex += 1;

          // Add new page if needed
          if (cardIndex % cardsPerPage === 0 && i < cardsWithImages.length - 1) {
            pdf.addPage();
          }
        } catch (error) {
          console.error(`Failed to load image for card: ${card.details?.name}`, error);
          // Continue with next card
        }
      }

      // Save PDF
      const fileName = `${cube.name.replace(/[^a-z0-9]/gi, '_')}_print_and_play.pdf`;
      pdf.save(fileName);

      addAlert('success', 'PDF generated successfully!');
      setIsGenerating(false);
      setOpen(false);
    } catch (error) {
      console.error('Error generating PDF:', error);
      addAlert('danger', 'Failed to generate PDF. Please try again.');
      setIsGenerating(false);
    }
  };

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} md>
      <ModalHeader setOpen={setOpen}>
        <Text semibold lg>
          Export Print and Play PDF
        </Text>
      </ModalHeader>
      <ModalBody>
        <Flexbox direction="col" gap="3">
          {!isGenerating ? (
            <>
              <Text md>
                Arrange your cube cards for printing — 9 cards per page (3 rows × 3 columns) with no spacing between
                them for easy cutting, sized at 2.5" × 3.5" (standard poker card size) on portrait US Letter (8.5" ×
                11") paper.
              </Text>
              <Text sm className="text-text-secondary">
                <strong>Print via Browser</strong> opens a print-ready page and your browser's print dialog (choose
                "Save as PDF" there if you want a file). For best results set Margins to "Default" or "None".{' '}
                <strong>Download PDF</strong> builds the PDF directly, which may take a few minutes for large cubes.
              </Text>
            </>
          ) : (
            <Flexbox direction="col" gap="3" alignItems="center" className="py-6">
              <Spinner lg />
              <Text md semibold>
                Generating PDF...
              </Text>
              <Text sm className="text-text-secondary">
                {progress.total > 0
                  ? `Processing card ${progress.current} of ${progress.total}`
                  : 'Preparing export...'}
              </Text>
              <Text xs className="text-text-secondary">
                This may take a few minutes. Please don't close this window.
              </Text>
            </Flexbox>
          )}
        </Flexbox>
      </ModalBody>
      <ModalFooter>
        <Flexbox direction="row" gap="2" justify="end">
          <Button color="secondary" onClick={() => setOpen(false)} disabled={isGenerating}>
            Cancel
          </Button>
          <Button color="secondary" onClick={generatePrintAndPlayPDF} disabled={isGenerating}>
            {isGenerating ? 'Generating...' : 'Download PDF'}
          </Button>
          <Button color="primary" onClick={printInBrowser} disabled={isGenerating}>
            Print via Browser
          </Button>
        </Flexbox>
      </ModalFooter>
    </Modal>
  );
};

export default PrintAndPlayExportModal;
