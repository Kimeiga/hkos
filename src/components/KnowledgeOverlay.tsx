import React, { useEffect, useMemo, useState } from 'react';
import { Tile as TileType, getTileDisplayName } from '../types/tile';
import { CORE_MAHJONG_CALLS, mahjongCallSearchText } from '../data/mahjongTerms';
import { Tile } from './Tile';
import { RULEBOOK_ENTRIES, RulebookEntry, findRulebookEntry } from '../data/rulebook';
import './KnowledgeOverlay.css';

export type KnowledgeRequest =
  | { kind: 'rulebook' }
  | { kind: 'hand'; handName: string }
  | { kind: 'tile'; tile: TileType };

interface KnowledgeOverlayProps {
  initial: KnowledgeRequest;
  onClose: () => void;
}

const tileFromCode = (code: string, index: number): TileType | null => {
  if (/^[bcd][1-9]$/.test(code)) {
    const suitMap = { b: 'bamboo', c: 'character', d: 'dot' } as const;
    const suit = suitMap[code[0] as keyof typeof suitMap];
    const value = Number(code[1]);
    return { id: `${suit}-${value}`, instanceId: `example-${code}-${index}`, category: suit, suit, value };
  }

  const windMap = { E: 'east', S: 'south', W: 'west', N: 'north' } as const;
  if (code in windMap) {
    const wind = windMap[code as keyof typeof windMap];
    return { id: `wind-${wind}`, instanceId: `example-${code}-${index}`, category: 'wind', wind };
  }

  const dragonMap = { DR: 'red', DG: 'green', DW: 'white' } as const;
  if (code in dragonMap) {
    const dragon = dragonMap[code as keyof typeof dragonMap];
    return { id: `dragon-${dragon}`, instanceId: `example-${code}-${index}`, category: 'dragon', dragon };
  }

  if (/^F[1-4]$/.test(code)) {
    const flowerNumber = Number(code[1]);
    return { id: `flower-${flowerNumber}`, instanceId: `example-${code}-${index}`, category: 'flower', flowerNumber };
  }

  if (/^SE[1-4]$/.test(code)) {
    const flowerNumber = Number(code.slice(2));
    return { id: `season-${flowerNumber}`, instanceId: `example-${code}-${index}`, category: 'season', flowerNumber };
  }

  return null;
};

const parseExample = (example: string) =>
  example.split('|').map((group, groupIndex) =>
    group.trim().split(/\s+/).map((code, tileIndex) => tileFromCode(code, groupIndex * 20 + tileIndex)).filter(Boolean) as TileType[]
  );

const relatedRuleIdsForTile = (tile: TileType): string[] => {
  if (tile.category === 'dragon') return ['dragon-pung', 'little-three-dragons', 'big-three-dragons'];
  if (tile.category === 'wind') return ['wind-pung', 'little-four-winds', 'big-four-winds'];
  if (tile.category === 'flower') return ['seat-flower', 'all-flowers'];
  if (tile.category === 'season') return ['seat-season', 'all-seasons'];
  if (tile.value === 1 || tile.value === 9) return ['all-terminals', 'half-flush', 'full-flush'];
  return ['all-chows', 'half-flush', 'full-flush'];
};

const tileDescription = (tile: TileType) => {
  if (tile.category === 'wind') {
    return 'An honor tile. Winds cannot form chows, but they can form pairs, pungs, and kongs. A pung/kong can score when it matches your seat wind or the prevailing round wind.';
  }
  if (tile.category === 'dragon') {
    return 'An honor tile. Dragons cannot form chows. A dragon pung or kong is a scoring element in HKOS and dragon combinations also appear in several higher-value hands.';
  }
  if (tile.category === 'flower') {
    return 'A bonus tile. Flowers are exposed when drawn and replaced from the dead wall; they are not used as one of the four sets and pair in the normal 14-tile hand.';
  }
  if (tile.category === 'season') {
    return 'A bonus tile. Seasons are exposed when drawn and replaced from the dead wall; they are not used as one of the four sets and pair in the normal 14-tile hand.';
  }
  const terminal = tile.value === 1 || tile.value === 9;
  return `A numbered ${tile.suit} tile. It can be used in a pair, pung, kong, or a same-suit chow. ${terminal ? 'Because it is a 1 or 9, it is also a terminal tile.' : 'Ranks 2–8 are often called simple tiles.'}`;
};

export const KnowledgeOverlay: React.FC<KnowledgeOverlayProps> = ({ initial, onClose }) => {
  const [view, setView] = useState<KnowledgeRequest>(initial);
  const [search, setSearch] = useState('');

  useEffect(() => setView(initial), [initial]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return RULEBOOK_ENTRIES;
    return RULEBOOK_ENTRIES.filter(entry =>
      [entry.title, entry.category, entry.definition, ...(entry.aliases ?? [])]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [search]);

  const filteredCallTerms = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return CORE_MAHJONG_CALLS;
    return CORE_MAHJONG_CALLS.filter(term => mahjongCallSearchText(term).includes(query));
  }, [search]);

  const openEntry = (entry: RulebookEntry) => setView({ kind: 'hand', handName: entry.title });

  const renderEntry = (entry: RulebookEntry) => (
    <div className="knowledge-detail">
      <div className="knowledge-title-row">
        <div>
          <div className="knowledge-eyebrow">{entry.category}</div>
          <h2>{entry.title}</h2>
        </div>
        <span className={`fan-badge ${entry.fan === 'Limit' ? 'limit' : ''}`}>{entry.fan}</span>
      </div>

      <p className="knowledge-definition">{entry.definition}</p>

      <section>
        <h3>What makes it count</h3>
        <ul className="knowledge-requirements">
          {entry.requirements.map(requirement => <li key={requirement}>{requirement}</li>)}
        </ul>
      </section>

      {entry.notes?.map(note => <p className="knowledge-note" key={note}>{note}</p>)}

      {entry.examples?.length ? (
        <section>
          <h3>Example{entry.examples.length > 1 ? ' hands' : ''}</h3>
          <div className="rule-examples">
            {entry.examples.map((example, exampleIndex) => (
              <div className="rule-example" key={`${entry.id}-${exampleIndex}`}>
                {parseExample(example).map((group, groupIndex) => (
                  <div className="rule-example-group" key={groupIndex}>
                    {group.map(tile => (
                      <Tile
                        key={tile.instanceId}
                        tile={tile}
                        className="rule-example-tile"
                        onClick={() => setView({ kind: 'tile', tile })}
                      />
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="knowledge-tap-hint">Tap any example tile to identify it.</div>
        </section>
      ) : null}
    </div>
  );

  const content = (() => {
    if (view.kind === 'tile') {
      const tile = view.tile;
      const related = relatedRuleIdsForTile(tile)
        .map(id => RULEBOOK_ENTRIES.find(entry => entry.id === id))
        .filter(Boolean) as RulebookEntry[];
      return (
        <div className="knowledge-detail tile-detail">
          <div className="tile-detail-hero">
            <Tile tile={tile} className="knowledge-tile-large" />
            <div>
              <div className="knowledge-eyebrow">Tile</div>
              <h2>{getTileDisplayName(tile)}</h2>
            </div>
          </div>
          <p className="knowledge-definition">{tileDescription(tile)}</p>
          <section>
            <h3>Related rules and hands</h3>
            <div className="related-rules">
              {related.map(entry => (
                <button key={entry.id} onClick={() => openEntry(entry)}>
                  <span>{entry.title}</span>
                  <span>{entry.fan}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      );
    }

    if (view.kind === 'hand') {
      const entry = findRulebookEntry(view.handName);
      return entry ? renderEntry(entry) : (
        <div className="knowledge-detail">
          <h2>{view.handName}</h2>
          <p className="knowledge-definition">This term does not have a rulebook entry yet.</p>
        </div>
      );
    }

    return (
      <div className="rulebook-list-view">
        <div className="knowledge-title-row">
          <div>
            <div className="knowledge-eyebrow">HKOS reference</div>
            <h2>Rulebook</h2>
          </div>
        </div>
        <p className="knowledge-definition">Tap a hand, scoring rule, or concept for a beginner-friendly explanation and examples. Core calls also show the Cantonese term used in Hong Kong and the common Mandarin equivalent.</p>
        <input
          className="rulebook-search"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Search hand, fan, soeng5, chī, pung…"
          aria-label="Search rulebook"
        />

        {filteredCallTerms.length > 0 && (
          <section className="terminology-section" aria-label="Core Mahjong calls">
            <div className="terminology-heading">
              <span>Core calls</span>
              <small>English · Cantonese (粵) · Mandarin (普)</small>
            </div>
            <div className="terminology-grid">
              {filteredCallTerms.map(term => (
                <article className="terminology-card" key={term.key}>
                  <strong>{term.primary}</strong>
                  <div className="terminology-languages">
                    <span><b>粵</b> {term.cantonese.script} <i>{term.cantonese.jyutping}</i></span>
                    <span><b>普</b> {term.mandarin.script} <i>{term.mandarin.pinyin}</i></span>
                  </div>
                  <p>{term.definition}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        <div className="rulebook-grid">
          {filteredEntries.map(entry => (
            <button className="rulebook-entry" key={entry.id} onClick={() => openEntry(entry)}>
              <span>
                <strong>{entry.title}</strong>
                <small>{entry.category}</small>
              </span>
              <span className={`fan-badge ${entry.fan === 'Limit' ? 'limit' : ''}`}>{entry.fan}</span>
            </button>
          ))}
        </div>
      </div>
    );
  })();

  return (
    <div className="knowledge-overlay" role="presentation" onMouseDown={onClose}>
      <div className="knowledge-card" role="dialog" aria-modal="true" aria-label="HKOS rulebook" onMouseDown={event => event.stopPropagation()}>
        <div className="knowledge-toolbar">
          {view.kind !== 'rulebook' ? (
            <button className="knowledge-back" onClick={() => setView({ kind: 'rulebook' })}>← Rulebook</button>
          ) : <span />}
          <button className="knowledge-close" onClick={onClose} aria-label="Close rulebook">×</button>
        </div>
        {content}
      </div>
    </div>
  );
};

export default KnowledgeOverlay;
