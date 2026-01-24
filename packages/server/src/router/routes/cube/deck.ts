import { normalizeName } from '@utils/cardutil';
import Card from '@utils/datatypes/Card';
import { DRAFT_TYPES } from '@utils/datatypes/Draft';
import { cubeDao, draftDao, userDao } from 'dynamo/daos';
import { body } from 'express-validator';
import { ensureAuth } from 'router/middleware';
import { cardFromId, getIdsFromName, getMostReasonable } from 'serverutils/carddb';
import { addBasics, createPool, exportToMtgo } from 'serverutils/cube';
import { abbreviate, isCubeViewable } from 'serverutils/cubefn';
import generateMeta from 'serverutils/meta';
import { handleRouteError, redirect, render } from 'serverutils/render';
import { addNotification, getBaseUrl } from 'serverutils/util';

import { Request, Response } from '../../../types/express';

const DECK_CSV_HEADER = 'Quantity,"Name",Scryfall,Zone';

export const downloadXmageHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id || !req.params.seat) {
      req.flash('danger', 'Invalid deck or seat ID');
      return redirect(req, res, '/404');
    }

    const deck = await draftDao.getById(req.params.id);

    if (!deck) {
      req.flash('danger', `Deck ID ${req.params.id} not found/`);
      return redirect(req, res, '/404');
    }

    const seat = deck.seats[parseInt(req.params.seat, 10)];

    if (!seat || !seat.name) {
      req.flash('danger', 'Invalid seat');
      return redirect(req, res, '/404');
    }

    res.setHeader('Content-disposition', `attachment; filename=${seat.name.replace(/\W/g, '')}.dck`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    res.write(`NAME:${seat.name}\r\n`);
    const main: Record<string, number> = {};
    for (const row of seat.mainboard) {
      for (const col of row) {
        for (const cardIndex of col) {
          const card = deck.cards[cardIndex];
          if (!card) continue;
          const details = cardFromId(card.cardID);
          const name = `[${details.set.toUpperCase()}:${details.collector_number}] ${details.name}`;
          if (main[name]) {
            main[name] += 1;
          } else {
            main[name] = 1;
          }
        }
      }
    }
    for (const [key, value] of Object.entries(main)) {
      res.write(`${value} ${key}\r\n`);
    }

    const side: Record<string, number> = {};
    for (const row of seat.sideboard) {
      for (const col of row) {
        for (const cardIndex of col) {
          const card = deck.cards[cardIndex];
          if (!card) continue;
          const details = cardFromId(card.cardID);
          const name = `[${details.set.toUpperCase()}:${details.collector_number}] ${details.name}`;
          if (side[name]) {
            side[name] += 1;
          } else {
            side[name] = 1;
          }
        }
      }
    }
    for (const [key, value] of Object.entries(side)) {
      res.write(`SB: ${value} ${key}\r\n`);
    }
    return res.end();
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
};

export const downloadForgeHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id || !req.params.seat) {
      req.flash('danger', 'Invalid deck or seat ID');
      return redirect(req, res, '/404');
    }

    const deck = await draftDao.getById(req.params.id);
    if (!deck) {
      req.flash('danger', `Deck ID ${req.params.id} not found/`);
      return redirect(req, res, '/404');
    }
    const seat = deck.seats[parseInt(req.params.seat, 10)];

    if (!seat || !seat.name) {
      req.flash('danger', 'Invalid seat');
      return redirect(req, res, '/404');
    }

    res.setHeader('Content-disposition', `attachment; filename=${seat.name.replace(/\W/g, '')}.dck`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    res.write('[metadata]\r\n');
    res.write(`name=${seat.name}\r\n`);
    res.write('[Main]\r\n');
    const main: Record<string, number> = {};
    for (const row of seat.mainboard) {
      for (const col of row) {
        for (const cardIndex of col) {
          const card = deck.cards[cardIndex];
          if (!card) continue;
          const details = cardFromId(card.cardID);
          const name = `${details.name}|${details.set.toUpperCase()}`;
          if (main[name]) {
            main[name] += 1;
          } else {
            main[name] = 1;
          }
        }
      }
    }
    for (const [key, value] of Object.entries(main)) {
      res.write(`${value} ${key}\r\n`);
    }

    res.write('[Side]\r\n');
    const side: Record<string, number> = {};
    for (const row of seat.sideboard) {
      for (const col of row) {
        for (const cardIndex of col) {
          const card = deck.cards[cardIndex];
          if (!card) continue;
          const details = cardFromId(card.cardID);
          const name = `${details.name}|${details.set.toUpperCase()}`;
          if (side[name]) {
            side[name] += 1;
          } else {
            side[name] = 1;
          }
        }
      }
    }
    for (const [key, value] of Object.entries(side)) {
      res.write(`${value} ${key}\r\n`);
    }

    return res.end();
  } catch (err) {
    return handleRouteError(req, res, err as Error, '/404');
  }
};

export const downloadTxtHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id || !req.params.seat) {
      req.flash('danger', 'Invalid deck or seat ID');
      return redirect(req, res, '/404');
    }

    const deck = await draftDao.getById(req.params.id);
    if (!deck) {
      req.flash('danger', `Deck ID ${req.params.id} not found/`);
      return redirect(req, res, '/404');
    }
    const seat = deck.seats[parseInt(req.params.seat, 10)];
    if (!seat || !seat.name) {
      req.flash('danger', 'Invalid seat');
      return redirect(req, res, '/404');
    }

    res.setHeader('Content-disposition', `attachment; filename=${seat.name.replace(/\W/g, '')}.txt`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    for (const row of seat.mainboard) {
      for (const col of row) {
        for (const cardIndex of col) {
          const card = deck.cards[cardIndex];
          if (!card) continue;
          const { name } = cardFromId(card.cardID);
          res.write(`${name}\r\n`);
        }
      }
    }
    return res.end();
  } catch (err) {
    return handleRouteError(req, res, err as Error, '/404');
  }
};

export const downloadMtgoHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id || !req.params.seat) {
      req.flash('danger', 'Invalid deck or seat ID');
      return redirect(req, res, '/404');
    }

    const deck = await draftDao.getById(req.params.id);
    if (!deck) {
      req.flash('danger', `Deck ID ${req.params.id} not found/`);
      return redirect(req, res, '/404');
    }
    const seat = deck.seats[parseInt(req.params.seat, 10)];
    if (!seat || !seat.name) {
      req.flash('danger', 'Invalid seat');
      return redirect(req, res, '/404');
    }
    return exportToMtgo(res, seat.name, seat.mainboard.flat(), seat.sideboard.flat(), deck.cards);
  } catch (err) {
    return handleRouteError(req, res, err as Error, '/404');
  }
};

export const downloadArenaHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id || !req.params.seat) {
      req.flash('danger', 'Invalid deck or seat ID');
      return redirect(req, res, '/404');
    }

    const deck = await draftDao.getById(req.params.id);
    if (!deck) {
      req.flash('danger', `Deck ID ${req.params.id} not found/`);
      return redirect(req, res, '/404');
    }
    const seat = deck.seats[parseInt(req.params.seat, 10)];
    if (!seat || !seat.name) {
      req.flash('danger', 'Invalid seat');
      return redirect(req, res, '/404');
    }

    res.setHeader('Content-disposition', `attachment; filename=${seat.name.replace(/\W/g, '')}.txt`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    res.write('Deck\r\n');
    const main: Record<string, number> = {};
    for (const row of seat.mainboard) {
      for (const col of row) {
        for (const cardIndex of col) {
          const card = deck.cards[cardIndex];
          if (!card) continue;
          const details = cardFromId(card.cardID);
          const name = `${details.name} (${details.set.toUpperCase()}) ${details.collector_number}`;
          if (main[name]) {
            main[name] += 1;
          } else {
            main[name] = 1;
          }
        }
      }
    }
    for (const [key, value] of Object.entries(main)) {
      res.write(`${value} ${key}\r\n`);
    }

    res.write('\r\nSideboard\r\n');
    const side: Record<string, number> = {};
    for (const row of seat.sideboard) {
      for (const col of row) {
        for (const cardIndex of col) {
          const card = deck.cards[cardIndex];
          if (!card) continue;
          const details = cardFromId(card.cardID);
          const name = `${details.name} (${details.set.toUpperCase()}) ${details.collector_number}`;
          if (side[name]) {
            side[name] += 1;
          } else {
            side[name] = 1;
          }
        }
      }
    }
    for (const [key, value] of Object.entries(side)) {
      res.write(`${value} ${key}\r\n`);
    }

    return res.end();
  } catch (err) {
    return handleRouteError(req, res, err as Error, '/404');
  }
};

export const downloadCockatriceHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id || !req.params.seat) {
      req.flash('danger', 'Invalid deck or seat ID');
      return redirect(req, res, '/404');
    }

    const deck = await draftDao.getById(req.params.id);
    if (!deck) {
      req.flash('danger', `Deck ID ${req.params.id} not found/`);
      return redirect(req, res, '/404');
    }
    const seat = deck.seats[parseInt(req.params.seat, 10)];
    if (!seat || !seat.name) {
      req.flash('danger', 'Invalid seat');
      return redirect(req, res, '/404');
    }

    res.setHeader('Content-disposition', `attachment; filename=${seat.name.replace(/\W/g, '')}.txt`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    const main: Record<string, number> = {};
    for (const row of seat.mainboard) {
      for (const col of row) {
        for (const cardIndex of col) {
          const card = deck.cards[cardIndex];
          if (!card) continue;
          const details = cardFromId(card.cardID);
          const name = `${details.name}`;
          if (main[name]) {
            main[name] += 1;
          } else {
            main[name] = 1;
          }
        }
      }
    }
    for (const [key, value] of Object.entries(main)) {
      res.write(`${value}x ${key}\r\n`);
    }

    res.write('sideboard\r\n');
    const side: Record<string, number> = {};
    for (const row of seat.sideboard) {
      for (const col of row) {
        for (const cardIndex of col) {
          const card = deck.cards[cardIndex];
          if (!card) continue;
          const details = cardFromId(card.cardID);
          const name = `${details.name}`;
          if (side[name]) {
            side[name] += 1;
          } else {
            side[name] = 1;
          }
        }
      }
    }
    for (const [key, value] of Object.entries(side)) {
      res.write(`${value}x ${key}\r\n`);
    }

    return res.end();
  } catch (err) {
    return handleRouteError(req, res, err as Error, '/404');
  }
};

export const downloadTopdeckedHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id || !req.params.seat) {
      req.flash('danger', 'Invalid deck or seat ID');
      return redirect(req, res, '/404');
    }

    const deck = await draftDao.getById(req.params.id);
    if (!deck) {
      req.flash('danger', `Deck ID ${req.params.id} not found/`);
      return redirect(req, res, '/404');
    }
    const seat = deck.seats[parseInt(req.params.seat, 10)];
    if (!seat) {
      req.flash('danger', 'Invalid seat');
      return redirect(req, res, '/404');
    }

    res.setHeader('Content-disposition', `attachment; filename=${req.params.id}_${req.params.seat}.csv`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';

    res.write(`${DECK_CSV_HEADER}\r\n`);

    const main: Record<string, number> = {};
    const mainCardID: Record<string, string> = {};
    const mainCardName: Record<string, string> = {};
    for (const row of seat.mainboard) {
      for (const col of row) {
        for (const cardIndex of col) {
          const card = deck.cards[cardIndex];
          if (!card || !card.details) continue;
          const oracleId = `${card.details.oracle_id}`;
          if (main[oracleId]) {
            main[oracleId] += 1;
          } else {
            main[oracleId] = 1;
            mainCardID[oracleId] = `${card.cardID}`;
            mainCardName[oracleId] = `${card.details.name}`;
          }
        }
      }
    }
    for (const [oracleId, value] of Object.entries(main)) {
      res.write(`${value},"${mainCardName[oracleId]}",${mainCardID[oracleId]},main\r\n`);
    }

    const side: Record<string, number> = {};
    const sideCardID: Record<string, string> = {};
    const sideCardName: Record<string, string> = {};
    for (const row of seat.sideboard) {
      for (const col of row) {
        for (const cardIndex of col) {
          const card = deck.cards[cardIndex];
          if (!card || !card.details) continue;
          const oracleId = `${card.details.oracle_id}`;
          if (side[oracleId]) {
            side[oracleId] += 1;
          } else {
            side[oracleId] = 1;
            sideCardID[oracleId] = `${card.cardID}`;
            sideCardName[oracleId] = `${card.details.name}`;
          }
        }
      }
    }
    for (const [oracleId, value] of Object.entries(side)) {
      res.write(`${value},"${sideCardName[oracleId]}",${sideCardID[oracleId]},side\r\n`);
    }

    return res.end();
  } catch (err) {
    return handleRouteError(req, res, err as Error, '/404');
  }
};

export const deleteDeckHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      req.flash('danger', 'Invalid deck ID');
      return res.status(400).send({
        success: 'false',
        message: 'Invalid deck ID',
      });
    }

    const deck = await draftDao.getById(req.params.id);

    if (!deck) {
      req.flash('danger', 'Deck not found');
      return res.status(404).send({
        success: 'false',
        message: 'Deck not found.',
      });
    }

    const ownerId = typeof deck.owner === 'string' ? deck.owner : deck.owner.id;
    const cubeOwnerId = typeof deck.cubeOwner === 'string' ? deck.cubeOwner : deck.cubeOwner.id;

    if (!req.user || (req.user.id !== ownerId && req.user.id !== cubeOwnerId)) {
      req.flash('danger', 'Unauthorized');
      return res.status(401).send({
        success: 'false',
        message: 'Unauthorized',
      });
    }

    await draftDao.deleteById(deck.id);

    req.flash('success', 'Deck Deleted');
    return res.send('Success');
  } catch {
    return res.status(500).send({
      success: 'false',
      message: 'Error deleting deck.',
    });
  }
};

export const rebuildHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id || !req.params.index) {
      req.flash('danger', 'Invalid deck or index');
      return redirect(req, res, '/404');
    }

    const index = parseInt(req.params.index, 10);
    const base = await draftDao.getById(req.params.id);

    if (!base) {
      req.flash('danger', 'Deck not found');
      return redirect(req, res, '/404');
    }

    const cube = await cubeDao.getById(base.cube);

    if (!cube || !isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, `/cube/deck/${base.id}`);
    }

    if (!req.user) {
      req.flash('danger', 'Please login to rebuild a deck');
      return redirect(req, res, `/cube/deck/${base.id}`);
    }

    const cardsArray = [];
    for (const card of base.cards) {
      const newCard = { ...card, details: cardFromId(card.cardID) };
      cardsArray.push(newCard);
    }

    const baseCubeOwnerId = typeof base.cubeOwner === 'string' ? base.cubeOwner : base.cubeOwner.id;

    const deck: any = {
      cube: base.cube,
      owner: req.user.id,
      cubeOwner: baseCubeOwnerId,
      date: new Date().valueOf(),
      type: base.type,
      seats: [],
      cards: base.cards,
      basics: base.basics,
      InitialState: base.InitialState,
    };
    deck.seats.push({
      ...base.seats[index],
      owner: req.user.id,
      title: `${req.user.username}'s rebuild from ${cube.name}`,
      description: 'This deck was rebuilt from another draft deck.',
    });
    for (let i = 0; i < base.seats.length; i++) {
      if (i !== index) {
        deck.seats.push(base.seats[i]);
      }
    }

    cube.numDecks += 1;

    const user = await userDao.getById(req.user.id);
    // const baseUser = await User.getById(base.owner);
    // const cubeOwner = await User.getById(cube.owner);

    //TODO: Can remove after fixing models to not muck with the original input
    const cubeOwner = cube.owner;

    const id = await draftDao.createDraft(deck);
    await cubeDao.update(cube, { skipTimestampUpdate: true });

    if (user && cube.owner.id !== user.id && !cube.disableAlerts) {
      await addNotification(
        cubeOwner,
        user,
        `/cube/deck/${id}`,
        `${user.username} rebuilt a deck from your cube: ${cube.name}`,
      );
    }
    if (user && base.owner && base.owner.id !== user.id) {
      await addNotification(
        base.owner,
        user,
        `/cube/deck/${id}`,
        `${user.username} rebuilt your deck from cube: ${cube.name}`,
      );
    }

    return redirect(req, res, `/draft/deckbuilder/${id}`);
  } catch (err) {
    return handleRouteError(req, res, err as Error, `/404`);
  }
};

export const editDeckHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      req.flash('danger', 'Invalid deck ID');
      return redirect(req, res, '/404');
    }

    const deck = await draftDao.getById(req.params.id);

    if (!deck) {
      req.flash('danger', 'Deck not found');
      return redirect(req, res, '/404');
    }

    if (!req.user) {
      return res.status(401).send({
        success: false,
        message: 'You must be logged in to finish a draft',
      });
    }

    if (typeof deck.owner !== 'string' && deck.owner?.id !== req.user.id) {
      return res.status(401).send({
        success: false,
        message: 'You do not own this draft',
      });
    }

    const { main, side, title, description, seat } = req.body;

    const seatIndex = parseInt(seat || '0', 10);
    const targetSeat = deck.seats[seatIndex];
    if (!targetSeat) {
      req.flash('danger', 'Invalid seat');
      return redirect(req, res, '/404');
    }

    targetSeat.mainboard = JSON.parse(main);
    targetSeat.sideboard = JSON.parse(side);
    (targetSeat as any).title = (title || '').substring(0, 100);
    (targetSeat as any).body = (description || '').substring(0, 1000);

    deck.complete = true;

    await draftDao.update(deck);

    req.flash('success', 'Deck saved successfully');
    return redirect(req, res, `/cube/deck/${deck.id}`);
  } catch (err) {
    return handleRouteError(req, res, err as Error, '/404');
  }
};

export const submitDeckHandler = async (req: Request, res: Response) => {
  try {
    const draftid = req.body.body;

    if (req.body.skipDeckbuilder) {
      return redirect(req, res, `/cube/deck/${draftid}`);
    }

    return redirect(req, res, `/draft/deckbuilder/${draftid}`);
  } catch (err) {
    return handleRouteError(req, res, err as Error, `/cube/playtest/${encodeURIComponent(req.params.id || '')}`);
  }
};

export const uploadDecklistHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id) {
      req.flash('danger', 'Invalid cube ID');
      return redirect(req, res, '/404');
    }

    const cube = await cubeDao.getById(req.params.id);

    if (!cube || !isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found.');
      return redirect(req, res, '/404');
    }

    if (!req.user || cube.owner.id !== req.user.id) {
      req.flash('danger', 'Not Authorized');
      return redirect(req, res, `/cube/playtest/${encodeURIComponent(req.params.id)}`);
    }

    const cards = req.body.body.match(/[^\r\n]+/g);
    if (!cards) {
      req.flash('danger', 'No cards detected');
      return redirect(req, res, `/cube/playtest/${encodeURIComponent(req.params.id)}`);
    }

    const cardList: any[] = [];

    const added: number[][] = [];
    for (let i = 0; i < 16; i += 1) {
      added.push([]);
    }

    const cubeCards = await cubeDao.getCards(cube.id);
    const { mainboard } = cubeCards;

    const customCardNameMap = mainboard
      .filter((card: any) => card.custom_name)
      .reduce((map: Map<string, Card>, card: any) => {
        const normalizedCustomName = normalizeName(card.custom_name);
        if (!map.has(normalizedCustomName)) {
          map.set(normalizedCustomName, card);
        }
        return map;
      }, new Map<string, Card>());

    for (let i = 0; i < cards.length; i += 1) {
      const item = cards[i].toLowerCase().trim();
      const numericMatch = item.match(/([0-9]+)x? (.*)/);
      if (numericMatch) {
        let count = parseInt(numericMatch[1], 10);
        if (!Number.isInteger(count)) {
          count = 1;
        }
        for (let j = 0; j < count; j += 1) {
          cards.push(numericMatch[2]);
        }
      } else {
        let selected = null;
        // does not have set info
        const normalizedName = normalizeName(item);
        const potentialIds = getIdsFromName(normalizedName);
        if (potentialIds && potentialIds.length > 0) {
          const inCube = mainboard.find((card: any) => cardFromId(card.cardID).name_lower === normalizedName);
          if (inCube) {
            selected = {
              finish: inCube.finish,
              imgBackUrl: inCube.imgBackUrl,
              imgUrl: inCube.imgUrl,
              cardID: inCube.cardID,
              details: cardFromId(inCube.cardID),
            };
          } else {
            const reasonableCard = getMostReasonable(normalizedName, cube.defaultPrinting as any);
            const reasonableId = reasonableCard ? reasonableCard.scryfall_id : null;
            const selectedId = reasonableId || potentialIds[0];
            if (selectedId) {
              selected = {
                cardID: selectedId,
                details: cardFromId(selectedId),
              };
            }
          }
        } else if (customCardNameMap.has(normalizedName)) {
          const cubeCard = customCardNameMap.get(normalizedName)!;
          selected = {
            finish: cubeCard.finish,
            imgBackUrl: cubeCard.imgBackUrl,
            imgUrl: cubeCard.imgUrl,
            cardID: cubeCard.cardID,
            details: cardFromId(cubeCard.cardID),
          };
        }

        if (selected) {
          // push into correct column.
          const details = selected.details;
          let column = Math.min(7, details.cmc !== undefined ? details.cmc : 0);
          if (!details.type.toLowerCase().includes('creature')) {
            column += 8;
          }
          const targetColumn = added[column];
          if (targetColumn) {
            targetColumn.push(cardList.length);
          }
          cardList.push(selected);
        }
      }
    }

    const deck: any = {
      cube: req.params.id,
      owner: req.user.id,
      cubeOwner: cube.owner.id,
      date: new Date().valueOf(),
      type: DRAFT_TYPES.UPLOAD,
      cards: cardList,
      seats: [
        {
          owner: req.user.id,
          title: `${req.user.username}'s decklist upload`,
          mainboard: [added.slice(0, 8), added.slice(8, 16)],
          sideboard: createPool(),
        },
      ],
      complete: true,
      basics: cube.basics,
    };

    addBasics(deck, cube.basics);

    const id = await draftDao.createDraft(deck);

    cube.numDecks += 1;
    await cubeDao.update(cube, { skipTimestampUpdate: true });

    return redirect(req, res, `/draft/deckbuilder/${id}`);
  } catch (err) {
    return handleRouteError(req, res, err as Error, '/404');
  }
};

export const getDeckHandler = async (req: Request, res: Response) => {
  try {
    if (!req.params.id || req.params.id === 'null' || req.params.id === 'false') {
      req.flash('danger', 'Invalid deck ID.');
      return redirect(req, res, '/404');
    }

    const draft = await draftDao.getById(req.params.id);

    if (!draft) {
      req.flash('danger', 'Deck not found');
      return redirect(req, res, '/404');
    }

    const cube = await cubeDao.getById(draft.cube);

    if (!cube || !isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    const baseUrl = getBaseUrl();
    return render(
      req,
      res,
      'CubeDeckPage',
      {
        cube,
        draft,
      },
      {
        title: `Draft deck of ${abbreviate(cube.name)}`,
        metadata: generateMeta(
          `Cube Cobra Deck: ${cube.name}`,
          cube.description,
          cube.image.uri,
          `${baseUrl}/cube/deck/${req.params.id}`,
        ),
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err as Error, '/404');
  }
};

export const routes = [
  {
    path: '/download/xmage/:id/:seat',
    method: 'get',
    handler: [downloadXmageHandler],
  },
  {
    path: '/download/forge/:id/:seat',
    method: 'get',
    handler: [downloadForgeHandler],
  },
  {
    path: '/download/txt/:id/:seat',
    method: 'get',
    handler: [downloadTxtHandler],
  },
  {
    path: '/download/mtgo/:id/:seat',
    method: 'get',
    handler: [downloadMtgoHandler],
  },
  {
    path: '/download/arena/:id/:seat',
    method: 'get',
    handler: [downloadArenaHandler],
  },
  {
    path: '/download/cockatrice/:id/:seat',
    method: 'get',
    handler: [downloadCockatriceHandler],
  },
  {
    path: '/download/topdecked/:id/:seat',
    method: 'get',
    handler: [downloadTopdeckedHandler],
  },
  {
    path: '/deletedeck/:id',
    method: 'delete',
    handler: [ensureAuth, deleteDeckHandler],
  },
  {
    path: '/rebuild/:id/:index',
    method: 'get',
    handler: [ensureAuth, rebuildHandler],
  },
  {
    path: '/editdeck/:id',
    method: 'post',
    handler: [ensureAuth, editDeckHandler],
  },
  {
    path: '/submitdeck/:id',
    method: 'post',
    handler: [body('skipDeckbuilder').toBoolean(), submitDeckHandler],
  },
  {
    path: '/uploaddecklist/:id',
    method: 'post',
    handler: [ensureAuth, uploadDecklistHandler],
  },
  {
    path: '/:id',
    method: 'get',
    handler: [getDeckHandler],
  },
];
