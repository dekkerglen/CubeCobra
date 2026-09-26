import { ManaMatrixCategory, ManaMatrixCellPopularity } from '@utils/datatypes/ManaMatrix';

import { getCardArtUrl } from 'components/manamatrix/useCardArt';

/**
 * Renders a shareable PNG of the board: category headers plus each cell's
 * answer over its art crop, tinted by result. Art is loaded through the
 * same-origin image proxy so the canvas never gets CORS-tainted; cells fall
 * back to flat tints if an image can't load. Fixed dark palette independent
 * of site theme.
 */

export interface ManaMatrixImageOptions {
  date: string;
  columns: ManaMatrixCategory[];
  rows: ManaMatrixCategory[];
  values: string[][];
  correct: (boolean | null)[][];
  popularity?: (ManaMatrixCellPopularity | null)[][] | null;
}

const COLORS = {
  background: '#22262a',
  cell: '#2c3237',
  cellSolved: '#173225',
  cellMissed: '#3a2023',
  borderSolved: '#22c55e',
  borderMissed: '#ef4444',
  border: '#4a5057',
  text: '#f0f0f0',
  textSecondary: '#9aa3ab',
};

// Wraps text to maxWidth, drawing at most maxLines (ellipsized), centered on x.
const drawWrappedText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
): number => {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) {
    lines.push(line);
  }

  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = `${lines[maxLines - 1]}…`;
  }

  lines.forEach((textLine, index) => {
    ctx.fillText(textLine, x, y + index * lineHeight, maxWidth);
  });

  return lines.length * lineHeight;
};

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};

// Ellipsize to fit a single line.
const fitText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string => {
  let fitted = text;
  while (ctx.measureText(fitted).width > maxWidth && fitted.length > 2) {
    fitted = `${fitted.slice(0, -2)}…`;
  }
  return fitted;
};

const loadImage = (url: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });

const loadCellArt = async (name: string): Promise<HTMLImageElement | null> => {
  try {
    const uri = await getCardArtUrl(name);
    if (!uri) {
      return null;
    }
    // The same-origin proxy keeps the canvas untainted regardless of the
    // image host's CORS headers.
    return await loadImage(`/tool/imageproxy?url=${encodeURIComponent(uri)}`);
  } catch {
    return null;
  }
};

export const renderManaMatrixImage = async ({
  date,
  columns,
  rows,
  values,
  correct,
  popularity,
}: ManaMatrixImageOptions): Promise<Blob> => {
  const width = 1000;
  const height = 1000;
  const margin = 24;
  const labelWidth = 200;
  const headerHeight = 96;
  const titleHeight = 84;
  const footerHeight = 40;
  const gap = 8;

  const cellWidth = (width - margin * 2 - labelWidth - gap * 3) / 3;
  const cellHeight = (height - margin * 2 - titleHeight - headerHeight - footerHeight - gap * 3) / 3;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas is not supported');
  }

  // Resolve every answered cell's art up front (misses resolve to null).
  const artImages = await Promise.all(
    values.map((row) => Promise.all(row.map((answer) => (answer ? loadCellArt(answer) : Promise.resolve(null))))),
  );

  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Title
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText('Mana Matrix', width / 2, margin + 34);
  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = '20px sans-serif';
  ctx.fillText(date, width / 2, margin + 64);

  const gridTop = margin + titleHeight;
  const gridLeft = margin;
  const cellX = (col: number) => gridLeft + labelWidth + gap + col * (cellWidth + gap);
  const cellY = (row: number) => gridTop + headerHeight + gap + row * (cellHeight + gap);

  // Column headers
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 17px sans-serif';
  for (let col = 0; col < 3; col++) {
    drawWrappedText(
      ctx,
      columns[col]?.description ?? '',
      cellX(col) + cellWidth / 2,
      gridTop + 34,
      cellWidth - 16,
      22,
      3,
    );
  }

  // Row labels + cells
  for (let row = 0; row < 3; row++) {
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 17px sans-serif';
    drawWrappedText(
      ctx,
      rows[row]?.description ?? '',
      gridLeft + labelWidth / 2,
      cellY(row) + cellHeight / 2 - 22,
      labelWidth - 12,
      22,
      4,
    );

    for (let col = 0; col < 3; col++) {
      const state = correct[row]?.[col] ?? null;
      const answer = values[row]?.[col] ?? '';
      const art = artImages[row]?.[col] ?? null;
      const x = cellX(col);
      const y = cellY(row);

      ctx.fillStyle = state === true ? COLORS.cellSolved : state === false ? COLORS.cellMissed : COLORS.cell;
      roundRect(ctx, x, y, cellWidth, cellHeight, 12);
      ctx.fill();

      if (art) {
        // Cover-fit the art crop inside the rounded cell, like the game tiles.
        ctx.save();
        roundRect(ctx, x, y, cellWidth, cellHeight, 12);
        ctx.clip();
        const scale = Math.max(cellWidth / art.width, cellHeight / art.height);
        const sourceWidth = cellWidth / scale;
        const sourceHeight = cellHeight / scale;
        ctx.drawImage(
          art,
          (art.width - sourceWidth) / 2,
          (art.height - sourceHeight) / 2,
          sourceWidth,
          sourceHeight,
          x,
          y,
          cellWidth,
          cellHeight,
        );
        ctx.restore();
      }

      if (answer) {
        // Name bar along the bottom, mirroring the game tiles; grows to two
        // lines when the answer has a community-popularity stat.
        const cellPopularity = popularity?.[row]?.[col] ?? null;
        const barHeight = cellPopularity ? 64 : 44;
        ctx.save();
        roundRect(ctx, x, y, cellWidth, cellHeight, 12);
        ctx.clip();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(x, y + cellHeight - barHeight, cellWidth, barHeight);
        ctx.restore();

        ctx.fillStyle = COLORS.text;
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText(
          fitText(ctx, answer, cellWidth - 16),
          x + cellWidth / 2,
          y + cellHeight - (cellPopularity ? 36 : 16),
        );

        if (cellPopularity) {
          ctx.fillStyle = COLORS.textSecondary;
          ctx.font = '15px sans-serif';
          ctx.fillText(
            fitText(ctx, `${cellPopularity.percentage}% answered this`, cellWidth - 16),
            x + cellWidth / 2,
            y + cellHeight - 13,
          );
        }
      } else {
        ctx.fillStyle = COLORS.textSecondary;
        ctx.font = '26px sans-serif';
        ctx.fillText('—', x + cellWidth / 2, y + cellHeight / 2 + 8);
      }

      ctx.strokeStyle = state === true ? COLORS.borderSolved : state === false ? COLORS.borderMissed : COLORS.border;
      ctx.lineWidth = 3;
      roundRect(ctx, x, y, cellWidth, cellHeight, 12);
      ctx.stroke();
    }
  }

  // Footer
  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = '18px sans-serif';
  ctx.fillText('cubecobra.com/manamatrix', width / 2, height - margin);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to render image'));
      }
    }, 'image/png');
  });
};
