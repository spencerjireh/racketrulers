export const CARD_WIDTH = 224; // w-56
export const CARD_HEIGHT = 100; // accounts for set scores row beneath team rows
export const COL_GAP = 48; // 3rem
export const ROW_GAP = 24; // 1.5rem between cards

export interface BracketGame {
  id: string;
  feederGame1Id: string | null;
  feederGame2Id: string | null;
}

export interface BracketNode {
  gameId: string;
  col: number;
  row: number; // fractional y position (in card-height units)
}

export interface Connector {
  fromId: string;
  toId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  midX: number;
}

export interface BracketLayout {
  nodes: BracketNode[];
  connectors: Connector[];
  totalCols: number;
  totalWidth: number;
  totalHeight: number;
}

/**
 * Compute bracket layout positions for single-elimination games.
 *
 * Games are organized by bracket round (column). First-round games are
 * evenly spaced vertically, and subsequent-round games are centered
 * between their two feeder games.
 */
export function computeBracketLayout(
  rounds: { index: number; games: BracketGame[] }[]
): BracketLayout {
  if (rounds.length === 0) {
    return { nodes: [], connectors: [], totalCols: 0, totalWidth: 0, totalHeight: 0 };
  }

  const totalCols = rounds.length;
  const nodeMap = new Map<string, BracketNode>();
  const slotHeight = CARD_HEIGHT + ROW_GAP;

  // First round: evenly spaced
  const firstRound = rounds[0];
  if (firstRound) {
    for (let i = 0; i < firstRound.games.length; i++) {
      const node: BracketNode = {
        gameId: firstRound.games[i].id,
        col: 0,
        row: i,
      };
      nodeMap.set(node.gameId, node);
    }
  }

  // Subsequent rounds: center between feeders
  for (let col = 1; col < rounds.length; col++) {
    const round = rounds[col];
    for (let i = 0; i < round.games.length; i++) {
      const game = round.games[i];
      const feeder1 = game.feederGame1Id ? nodeMap.get(game.feederGame1Id) : null;
      const feeder2 = game.feederGame2Id ? nodeMap.get(game.feederGame2Id) : null;

      let row: number;
      if (feeder1 && feeder2) {
        row = (feeder1.row + feeder2.row) / 2;
      } else if (feeder1) {
        row = feeder1.row;
      } else if (feeder2) {
        row = feeder2.row;
      } else {
        // No feeders -- fallback to centering in the column
        row = i * 2;
      }

      const node: BracketNode = { gameId: game.id, col, row };
      nodeMap.set(node.gameId, node);
    }
  }

  const nodes = Array.from(nodeMap.values());

  // Compute connectors
  const connectors: Connector[] = [];
  for (const round of rounds) {
    for (const game of round.games) {
      const target = nodeMap.get(game.id);
      if (!target) continue;

      for (const feederId of [game.feederGame1Id, game.feederGame2Id]) {
        if (!feederId) continue;
        const source = nodeMap.get(feederId);
        if (!source) continue;

        const x1 = source.col * (CARD_WIDTH + COL_GAP) + CARD_WIDTH;
        const y1 = source.row * slotHeight + CARD_HEIGHT / 2;
        const x2 = target.col * (CARD_WIDTH + COL_GAP);
        const y2 = target.row * slotHeight + CARD_HEIGHT / 2;
        const midX = (x1 + x2) / 2;

        connectors.push({ fromId: feederId, toId: game.id, x1, y1, x2, y2, midX });
      }
    }
  }

  const maxRow = nodes.reduce((max, n) => Math.max(max, n.row), 0);
  const totalHeight = (maxRow + 1) * slotHeight;
  const totalWidth = totalCols * (CARD_WIDTH + COL_GAP) - COL_GAP;

  return { nodes, connectors, totalCols, totalWidth, totalHeight };
}
