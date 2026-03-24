import React, { useContext, useState } from 'react';
import { jsPDF } from 'jspdf';

import { cardImageNormal } from '@utils/cardutil';
import { sortForDownload } from '@utils/sorting/Sort';

import CubeContext from '../../contexts/CubeContext';
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
}

const PrintAndPlayExportModal: React.FC<PrintAndPlayExportModalProps> = ({
  isOpen,
  setOpen,
  isSortUsed,
  isFilterUsed,
}) => {
  const { addAlert } = useAlerts();
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const { cube, sortPrimary, sortSecondary, sortTertiary, sortQuaternary } = useContext(CubeContext);
  const { cardFilter } = useContext(FilterContext)!;

  const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (err) => {
        console.error('Image load error:', err);
        reject(err);
      };
      img.src = url;
    });
  };

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

  const generatePrintAndPlayPDF = async () => {
    setIsGenerating(true);
    setProgress({ current: 0, total: 0 });

    try {
      // Get and filter cards
      let cards = cube.cards.mainboard;
      if (isFilterUsed) {
        cards = cards.filter(cardFilter.filter);
      }

      // Sort cards if needed
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

      // Filter out cards without images
      const cardsWithImages = sortedCards.filter((card) => {
        const imageUrl = cardImageNormal(card);
        return imageUrl && imageUrl.length > 0;
      });

      if (cardsWithImages.length === 0) {
        addAlert('danger', 'No cards with images found to export.');
        setIsGenerating(false);
        return;
      }

      setProgress({ current: 0, total: cardsWithImages.length });

      // PDF settings for portrait US Letter: 8.5" x 11"
      // Target: 3 rows × 3 columns, adjacent cards (no spacing), 2.5" × 3.5" printed size
      // Compensating for ~8% oversizing: 2.5/1.08 = 2.31" × 3.5/1.08 = 3.24" maintains 5:7 ratio
      // Total grid: 6.93" × 9.72" centered on page

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'in',
        format: 'letter',
      });

      const cardWidth = 2.31;
      const cardHeight = 3.24;
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
        const imageUrl = cardImageNormal(card);

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

          cardIndex++;

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
                This will generate a PDF with your cube cards arranged for printing. Each page will contain 9 cards (3
                rows × 3 columns) with no spacing between them for easy cutting.
              </Text>
              <Text sm className="text-text-secondary">
                Note: PDF generation may take a few minutes depending on the size of your cube. Cards are sized to print
                at 2.5" × 3.5" (standard poker card size) on portrait US Letter (8.5" × 11") paper.
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
          <Button color="primary" onClick={generatePrintAndPlayPDF} disabled={isGenerating}>
            {isGenerating ? 'Generating...' : 'Generate PDF'}
          </Button>
        </Flexbox>
      </ModalFooter>
    </Modal>
  );
};

export default PrintAndPlayExportModal;
