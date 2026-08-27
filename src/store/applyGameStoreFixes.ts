import { sortTiles, tilesSameType, Tile, Wind } from '../types/tile';
import { Meld } from '../types/meld';

type StoreApi = {
  getState: () => any;
  setState: (partial: any) => void;
};

const getHumanSeat = (players: Record<Wind, { isHuman: boolean }>): Wind =>
  (Object.keys(players) as Wind[]).find((seat) => players[seat].isHuman) ?? 'east';

/**
 * Compatibility fixes for gameplay paths that still assumed the human was South.
 * Keeping these overrides small makes the migration easy to remove once the store
 * is refactored around a single human-seat source of truth.
 */
export const applyGameStoreFixes = (store: StoreApi) => {
  store.setState({
    sortHand: () => {
      const state = store.getState();
      const player = getHumanSeat(state.players);
      const players = { ...state.players };
      players[player] = {
        ...players[player],
        hand: sortTiles(players[player].hand),
      };
      store.setState({ players });
    },

    declareChow: (player: Wind, tiles: Tile[]) => {
      const state = store.getState();
      const discardTile = state.lastDiscard as Tile | null;
      const fromPlayer = state.lastDiscardBy as Wind | null;
      if (!discardTile || !fromPlayer) return;

      const players = { ...state.players };
      const meldTiles = [...tiles];
      const handTiles = meldTiles.filter((tile) => tile.instanceId !== discardTile.instanceId);
      const baseTile = [...meldTiles].sort((a, b) => (a.value ?? 0) - (b.value ?? 0))[0];

      const meld: Meld = {
        type: 'chow',
        tiles: meldTiles,
        isConcealed: false,
        baseTile,
        claimedFrom: fromPlayer,
      };

      players[player] = {
        ...players[player],
        hand: players[player].hand.filter(
          (tile: Tile) => !handTiles.some((claimed) => claimed.instanceId === tile.instanceId),
        ),
        melds: [...players[player].melds, meld],
      };

      players[fromPlayer] = {
        ...players[fromPlayer],
        discards: players[fromPlayer].discards.filter(
          (tile: Tile) => tile.instanceId !== discardTile.instanceId,
        ),
      };

      store.setState({
        players,
        currentTurn: player,
        turnPhase: 'discard',
        lastDiscard: null,
        lastDiscardBy: null,
        claimOffer: null,
        selectedTile: null,
      });

      store.getState().updateTeacherSuggestion();
      if (!players[player].isHuman) {
        setTimeout(() => store.getState().playAITurn(), 600);
      }
    },

    declareKong: (player: Wind, tiles: Tile[]) => {
      const state = store.getState();
      const players = { ...state.players };
      const discardTile = state.lastDiscard as Tile | null;
      const fromPlayer = state.lastDiscardBy as Wind | null;
      const isClaimedKong = Boolean(
        discardTile &&
          fromPlayer &&
          fromPlayer !== player &&
          tiles.some((tile) => tile.instanceId === discardTile.instanceId),
      );

      const handIds = new Set<string>(players[player].hand.map((tile: Tile) => tile.instanceId));
      const meld: Meld = {
        type: 'kong',
        tiles: [...tiles],
        isConcealed: !isClaimedKong && tiles.every((tile) => handIds.has(tile.instanceId)),
        baseTile: tiles.find((tile) => tile.instanceId !== discardTile?.instanceId) ?? tiles[0],
        ...(isClaimedKong && fromPlayer ? { claimedFrom: fromPlayer } : {}),
      };

      players[player] = {
        ...players[player],
        hand: players[player].hand.filter(
          (tile: Tile) => !tiles.some((meldTile) => meldTile.instanceId === tile.instanceId),
        ),
        melds: [...players[player].melds, meld],
      };

      if (isClaimedKong && fromPlayer && discardTile) {
        players[fromPlayer] = {
          ...players[fromPlayer],
          discards: players[fromPlayer].discards.filter(
            (tile: Tile) => tile.instanceId !== discardTile.instanceId,
          ),
        };
      }

      // Kong replacements come from the dead wall. Flowers/seasons drawn there
      // are exposed and replaced again until a playable tile is found.
      const deadWall = [...state.deadWall] as Tile[];
      const replacementFlowers: Tile[] = [];
      let replacement: Tile | null = null;
      while (deadWall.length > 0 && !replacement) {
        const candidate = deadWall.pop()!;
        if (candidate.category === 'flower' || candidate.category === 'season') {
          replacementFlowers.push(candidate);
        } else {
          replacement = candidate;
        }
      }

      if (replacementFlowers.length > 0) {
        players[player] = {
          ...players[player],
          flowers: [...players[player].flowers, ...replacementFlowers],
        };
      }

      if (replacement) {
        const nextHand = [...players[player].hand, replacement];
        players[player] = {
          ...players[player],
          hand: players[player].isHuman ? nextHand : sortTiles(nextHand),
        };
      }

      store.setState({
        deadWall,
        players,
        currentTurn: player,
        turnPhase: 'discard',
        lastDiscard: isClaimedKong ? null : state.lastDiscard,
        lastDiscardBy: isClaimedKong ? null : state.lastDiscardBy,
        claimOffer: null,
        selectedTile: null,
      });

      store.getState().updateTeacherSuggestion();
      if (!players[player].isHuman) {
        setTimeout(() => store.getState().playAITurn(), 600);
      }
    },

    resolveClaim: (action: 'pass' | 'pong' | 'kong' | 'chow' | 'win', data?: Tile[]) => {
      const state = store.getState();
      if (!state.claimOffer) return;

      const { fromPlayer, tile } = state.claimOffer as { fromPlayer: Wind; tile: Tile };
      const player = getHumanSeat(state.players);
      store.setState({ claimOffer: null });

      if (action === 'pass') {
        store.getState().nextTurn();
        return;
      }

      if (action === 'win') {
        store.getState().declareWin(player);
        return;
      }

      if (action === 'pong') {
        store.getState().declarePong(player, fromPlayer);
        return;
      }

      if (action === 'kong') {
        const matching = state.players[player].hand.filter((candidate: Tile) =>
          tilesSameType(candidate, tile),
        );
        store.getState().declareKong(player, [...matching, tile]);
        return;
      }

      if (action === 'chow' && data) {
        store.getState().declareChow(player, [...data, tile]);
      }
    },
  });
};
