import React, { useState, useEffect, useRef } from 'react';

const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const VAL = Object.fromEntries(VALUES.map((v, i) => [v, i + 2]));
const isRed = s => s === '♥' || s === '♦';
const NUM_P = 4;
const NAMES = ['You', 'Alice', 'Bob', 'Carol'];
const MAX_ROUND = Math.floor(52 / NUM_P);

function makeDeck() {
  return SUITS.flatMap(s => VALUES.map(v => ({ s, v, id: `${v}${s}` })));
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function getTrickWinner(trick, trump) {
  let best = 0;
  for (let i = 1; i < trick.length; i++) {
    const b = trick[best].card, c = trick[i].card;
    const bT = b.s === trump, cT = c.s === trump;
    if (cT && !bT) { best = i; continue; }
    if (!cT && bT) continue;
    if (c.s === b.s && VAL[c.v] > VAL[b.v]) best = i;
  }
  return trick[best].player;
}
function aiBid(hand, trump, round) {
  let est = 0;
  for (const c of hand) {
    if (c.s === trump) est += VAL[c.v] >= 12 ? 1 : VAL[c.v] >= 9 ? 0.5 : 0.25;
    else {
      if (VAL[c.v] === 14) est += 0.7;
      else if (VAL[c.v] === 13) est += 0.4;
      else if (VAL[c.v] === 12) est += 0.2;
    }
  }
  return Math.max(0, Math.min(Math.round(est + (Math.random() - 0.5) * 0.6), round));
}
function aiChooseCard(hand, trick, trump, bid, taken) {
  const lead = trick.length > 0 ? trick[0].card.s : null;
  const followable = lead ? hand.filter(c => c.s === lead) : [];
  const playable = followable.length > 0 ? followable : hand;
  const sorted = [...playable].sort((a, b) => VAL[a.v] - VAL[b.v]);
  return taken < bid ? sorted[sorted.length - 1] : sorted[0];
}
function getForbiddenBid(bids, round) {
  const sum = bids.reduce((a, b) => a + (b ?? 0), 0);
  const forbidden = round - sum;
  return forbidden >= 0 && forbidden <= round ? forbidden : null;
}
function dealRound(round, dealer, scores) {
  const deck = shuffle(makeDeck());
  const hands = Array.from({ length: NUM_P }, (_, i) => deck.slice(i * round, (i + 1) * round));
  const trumpCard = deck[NUM_P * round] || null;
  const trump = trumpCard ? trumpCard.s : null;
  const firstP = (dealer + 1) % NUM_P;
  return {
    phase: 'bidding', round, dealer, scores: [...scores],
    hands, trump, trumpCard,
    bids: Array(NUM_P).fill(null),
    taken: Array(NUM_P).fill(0),
    trick: [], leader: firstP, current: firstP,
    lastWinner: null, scoreChanges: null,
  };
}
function doPlayCard(state, player, card) {
  const newHands = state.hands.map((h, i) =>
    i === player ? h.filter(c => c.id !== card.id) : h
  );
  const newTrick = [...state.trick, { player, card }];
  if (newTrick.length < NUM_P) {
    return { ...state, hands: newHands, trick: newTrick, current: (player + 1) % NUM_P };
  }
  const winner = getTrickWinner(newTrick, state.trump);
  const newTaken = [...state.taken];
  newTaken[winner]++;
  return { ...state, hands: newHands, trick: newTrick, taken: newTaken, lastWinner: winner, phase: 'trick_end' };
}

export default function OhHellGame() {
  const [gs, setGs] = useState(null);
  const [sel, setSel] = useState(null);
  const timerRef = useRef(null);

  const clearT = () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } };

  useEffect(() => {
    if (!gs) return;
    clearT();

    if (gs.phase === 'bidding' && gs.current !== 0) {
      timerRef.current = setTimeout(() => {
        setGs(prev => {
          if (!prev || prev.phase !== 'bidding' || prev.current === 0) return prev;
          const isLastBidder = prev.current === prev.dealer;
          let bid = aiBid(prev.hands[prev.current], prev.trump, prev.round);
          if (isLastBidder) {
            const forbidden = getForbiddenBid(prev.bids, prev.round);
            if (forbidden !== null && bid === forbidden) {
              if (forbidden + 1 <= prev.round) bid = forbidden + 1;
              else bid = forbidden - 1;
            }
          }
          const newBids = [...prev.bids];
          newBids[prev.current] = bid;
          const next = (prev.current + 1) % NUM_P;
          const done = newBids.every(b => b !== null);
          return { ...prev, bids: newBids, current: done ? prev.leader : next, phase: done ? 'playing' : 'bidding' };
        });
      }, 650);
    }

    if (gs.phase === 'playing' && gs.current !== 0) {
      timerRef.current = setTimeout(() => {
        setGs(prev => {
          if (!prev || prev.phase !== 'playing' || prev.current === 0) return prev;
          const card = aiChooseCard(prev.hands[prev.current], prev.trick, prev.trump, prev.bids[prev.current], prev.taken[prev.current]);
          return doPlayCard(prev, prev.current, card);
        });
      }, 850);
    }

    if (gs.phase === 'trick_end') {
      timerRef.current = setTimeout(() => {
        setGs(prev => {
          if (!prev || prev.phase !== 'trick_end') return prev;
          const total = prev.taken.reduce((a, b) => a + b, 0);
          if (total >= prev.round) {
            const changes = prev.bids.map((bid, i) => {
              const delta = Math.abs(prev.taken[i] - bid);
              return delta === 0 ? 10 + bid * bid : -(10 + delta * delta);
            });
            const newScores = prev.scores.map((s, i) => s + changes[i]);
            const nextPhase = prev.round >= MAX_ROUND ? 'game_over' : 'round_end';
            return { ...prev, scores: newScores, scoreChanges: changes, phase: nextPhase };
          }
          return { ...prev, trick: [], leader: prev.lastWinner, current: prev.lastWinner, phase: 'playing' };
        });
      }, 1400);
    }

    return clearT;
  }, [gs?.phase, gs?.current]);

  function humanBid(bid) {
    if (!gs || gs.phase !== 'bidding' || gs.current !== 0) return;
    if (gs.dealer === 0) {
      const forbidden = getForbiddenBid(gs.bids, gs.round);
      if (forbidden !== null && bid === forbidden) return;
    }
    setGs(prev => {
      const newBids = [...prev.bids];
      newBids[0] = bid;
      const done = newBids.every(b => b !== null);
      return { ...prev, bids: newBids, current: done ? prev.leader : 1, phase: done ? 'playing' : 'bidding' };
    });
  }

  function humanPlay(card) {
    if (!gs || gs.phase !== 'playing' || gs.current !== 0) return;
    const lead = gs.trick.length > 0 ? gs.trick[0].card.s : null;
    if (lead) {
      const hasLead = gs.hands[0].some(c => c.s === lead);
      if (hasLead && card.s !== lead) return;
    }
    setSel(null);
    setGs(prev => doPlayCard(prev, 0, card));
  }

  function startGame() { setSel(null); setGs(dealRound(1, 0, Array(NUM_P).fill(0))); }
  function nextRound() { setSel(null); setGs(prev => dealRound(prev.round + 1, (prev.dealer + 1) % NUM_P, prev.scores)); }

  const sc = s => isRed(s) ? 'text-red-500' : 'text-gray-800';

  // ── START SCREEN ──
  if (!gs) {
    return (
      <div className="h-screen overflow-y-auto bg-green-900 flex items-center justify-center p-4">
        <div className="text-center max-w-sm w-full py-2">
          <div className="text-5xl mb-1">🃏</div>
          <h1 className="text-5xl font-bold text-yellow-300 mb-1">Oh Hell!</h1>
          <p className="text-green-300 text-sm mb-4">Trick-taking card game · 4 players · 13 rounds</p>
          <div className="bg-green-800 rounded-2xl p-4 mb-5 text-left text-green-100 text-sm space-y-1.5">
            <p className="font-bold text-white text-base mb-1">How to play</p>
            <p>📦 Deal grows from 1 card up to 13 each round</p>
            <p>🎯 Bid exactly how many tricks you will win</p>
            <p>♠ Must follow suit if possible; trump beats all</p>
            <p>✅ Make your bid: <span className="text-green-300 font-bold">+10 + bid²</span> pts</p>
            <p>❌ Miss your bid: <span className="text-red-400 font-bold">−(10 + delta²)</span> pts</p>
            <p>🚫 Total bids cannot equal the number of cards dealt</p>
          </div>
          <button onClick={startGame} className="bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold py-4 px-12 rounded-2xl text-2xl shadow-xl transition-colors w-full">
            Deal Cards!
          </button>
        </div>
      </div>
    );
  }

  const { phase, round, trump, trumpCard, bids, taken, trick, hands, scores, current, leader, lastWinner, scoreChanges, dealer } = gs;

  // ── GAME OVER ──
  if (phase === 'game_over') {
    const ranked = NAMES.map((n, i) => ({ n, s: scores[i] })).sort((a, b) => b.s - a.s);
    return (
      <div className="h-screen overflow-hidden bg-green-900 flex items-center justify-center p-4">
        <div className="text-center max-w-sm w-full">
          <div className="text-5xl mb-2">🏆</div>
          <h1 className="text-4xl font-bold text-white mb-1">Game Over!</h1>
          <p className="text-yellow-300 text-xl font-bold mb-6">{ranked[0].n} wins!</p>
          <div className="bg-green-800 rounded-2xl overflow-hidden mb-6">
            {ranked.map((p, i) => (
              <div key={p.n} className={`flex justify-between px-5 py-3 ${i === 0 ? 'bg-yellow-400 text-gray-900 font-bold text-lg' : 'text-white border-t border-green-700'}`}>
                <span>{i + 1}. {p.n}</span><span>{p.s} pts</span>
              </div>
            ))}
          </div>
          <button onClick={startGame} className="bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold py-3 px-8 rounded-xl text-xl w-full transition-colors">Play Again</button>
        </div>
      </div>
    );
  }

  // ── ROUND END ──
  if (phase === 'round_end') {
    return (
      <div className="h-screen overflow-hidden bg-green-900 flex items-center justify-center p-4">
        <div className="text-center max-w-sm w-full">
          <h2 className="text-3xl font-bold text-white mb-1">Round {round} Done!</h2>
          <p className="text-green-400 text-sm mb-4">Round {round + 1} next — {round + 1} card{round + 1 !== 1 ? 's' : ''} each</p>
          <div className="bg-green-800 rounded-2xl overflow-hidden mb-5">
            {NAMES.map((name, i) => {
              const made = taken[i] === bids[i];
              const ch = scoreChanges ? scoreChanges[i] : 0;
              return (
                <div key={i} className="flex items-center gap-2 px-4 py-2.5 text-white border-t border-green-700 first:border-0">
                  <span className="font-medium w-14">{name}</span>
                  <span className="text-green-400 text-xs flex-1">{taken[i]} of {bids[i]} bid</span>
                  <span className={`font-bold w-12 text-right ${made ? 'text-green-400' : 'text-red-400'}`}>{ch > 0 ? '+' : ''}{ch}</span>
                  <span className="text-yellow-300 font-bold w-14 text-right">{scores[i]} pt</span>
                </div>
              );
            })}
          </div>
          <button onClick={nextRound} className="bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold py-3 px-8 rounded-xl text-xl w-full transition-colors">Next Round →</button>
        </div>
      </div>
    );
  }

  // ── MAIN GAME ──
  const myHand = hands[0] || [];
  const isMyBidTurn = phase === 'bidding' && current === 0;
  const isMyPlayTurn = phase === 'playing' && current === 0;
  const leadSuit = trick.length > 0 ? trick[0].card.s : null;

  const humanForbiddenBid = (isMyBidTurn && dealer === 0) ? getForbiddenBid(bids, round) : null;

  const canPlay = (card) => {
    if (!isMyPlayTurn) return false;
    if (!leadSuit) return true;
    return !myHand.some(c => c.s === leadSuit) || card.s === leadSuit;
  };

  const statusMsg =
    phase === 'trick_end' ? `${NAMES[lastWinner]} wins the trick!` :
    phase === 'bidding' ? (isMyBidTurn ? 'Your bid — how many tricks?' : `${NAMES[current]} is bidding...`) :
    isMyPlayTurn ? (trick.length === 0 ? 'Your lead — play any card' : 'Your turn to play') :
    `${NAMES[current]} is playing...`;

  return (
    <div className="h-screen overflow-hidden bg-green-800 flex flex-col">

      {/* ── TOP BAR ── */}
      <div className="bg-green-900 px-2 py-1 flex items-center gap-1.5 shrink-0">
        {/* Title + round */}
        <div className="shrink-0 text-center">
          <div className="text-yellow-300 font-bold text-xs leading-tight">Oh Hell!</div>
          <div className="text-green-400 text-xs leading-tight">Rd {round}/{MAX_ROUND}</div>
        </div>

        {/* Player panels */}
        <div className="flex gap-1 flex-1 min-w-0">
          {NAMES.map((name, i) => (
            <div key={i} className={`text-center px-0.5 py-0.5 rounded text-xs flex-1 min-w-0 transition-colors
              ${i === current && (phase === 'bidding' || phase === 'playing') ? 'bg-yellow-400 text-gray-900' : 'bg-green-800 text-white'}`}>
              <div className="font-bold truncate leading-tight">{name}</div>
              <div className="leading-tight">{scores[i]}</div>
              {bids[i] !== null && <div className="opacity-75 leading-tight">{taken[i]}/{bids[i]}</div>}
            </div>
          ))}
        </div>

        {/* Trump badge */}
        <div className={`shrink-0 flex flex-col items-center justify-center rounded-lg px-1.5 py-0.5 border-2
          ${trump ? (isRed(trump) ? 'bg-white border-red-500' : 'bg-white border-gray-800') : 'bg-green-800 border-green-700'}`}>
          <span className={`text-xs font-black uppercase leading-none ${trump ? 'text-gray-400' : 'text-green-600'}`}>trump</span>
          {trump ? (
            <>
              <span className={`text-3xl font-black leading-none ${sc(trump)}`}>{trump}</span>
              <span className={`text-xs font-bold leading-none ${sc(trump)}`}>{trumpCard?.v}</span>
            </>
          ) : (
            <span className="text-green-600 text-base leading-none">—</span>
          )}
        </div>
      </div>

      {/* ── AI HANDS (face-down, heavily overlapping) ── */}
      <div className="shrink-0 flex justify-around px-2 pt-1 pb-0.5">
        {[1, 2, 3].map(i => (
          <div key={i} className="text-center">
            <div className={`text-xs mb-0.5 leading-tight ${i === current && phase !== 'trick_end' ? 'text-yellow-300 font-bold' : 'text-green-400'}`}>
              {NAMES[i]}{bids[i] !== null ? ` (${taken[i]}/${bids[i]})` : ''}
            </div>
            <div className="flex justify-center">
              {Array.from({ length: (hands[i] || []).length }, (_, j) => (
                <div key={j} className={`w-5 h-7 bg-blue-900 rounded border border-blue-700 ${j > 0 ? '-ml-2.5' : ''}`} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── STATUS BAR ── */}
      <div className={`mx-2 px-3 py-1 rounded-lg text-center text-xs font-medium shrink-0 transition-colors
        ${phase === 'trick_end' ? 'bg-yellow-500 text-gray-900' :
          isMyBidTurn || isMyPlayTurn ? 'bg-blue-600 text-white' : 'bg-green-700 text-green-200'}`}>
        {statusMsg}
      </div>

      {/* ── TRICK AREA — fixed compact height, no flex-1 ── */}
      <div className="shrink-0 h-24 flex items-center justify-center px-4">
        {trick.length > 0 ? (
          <div className="flex gap-2 flex-wrap justify-center items-end">
            {trick.map(({ player, card }) => (
              <div key={player} className="text-center">
                <div className={`w-10 h-14 bg-white rounded-lg flex flex-col items-center justify-center font-bold shadow-lg
                  ${player === lastWinner && phase === 'trick_end' ? 'ring-4 ring-yellow-400' : 'ring-1 ring-gray-200'}
                  ${sc(card.s)}`}>
                  <div className="text-xs leading-tight">{card.v}</div>
                  <div className="text-xl leading-none">{card.s}</div>
                </div>
                <div className="text-xs text-green-300 mt-0.5">{NAMES[player]}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-green-600 text-sm italic">
            {phase === 'playing' ? (current === 0 ? 'Your lead!' : `Waiting for ${NAMES[leader]}...`) : ''}
          </div>
        )}
      </div>

      {/* ── BID BUTTONS ── */}
      {isMyBidTurn && (
        <div className="shrink-0 px-3 pb-1">
          <p className="text-green-300 text-xs text-center mb-1">
            Bid (0–{round})
            {humanForbiddenBid !== null && <span className="text-red-400 ml-1">· cannot bid {humanForbiddenBid}</span>}
          </p>
          <div className="flex gap-1 justify-center flex-wrap">
            {Array.from({ length: round + 1 }, (_, i) => {
              const isForbidden = i === humanForbiddenBid;
              return (
                <button key={i} onClick={() => humanBid(i)} disabled={isForbidden}
                  className={`font-bold w-9 h-9 rounded-xl text-sm shadow transition-all
                    ${isForbidden ? 'bg-gray-600 text-gray-400 opacity-40 cursor-not-allowed'
                      : 'bg-yellow-400 hover:bg-yellow-300 active:scale-95 text-gray-900'}`}>
                  {i}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── HUMAN HAND — horizontally scrollable, no overlap ── */}
      <div className="shrink-0 px-2 pb-3">
        <div className="flex justify-between text-xs text-green-400 mb-1 px-1">
          <span>Your hand</span>
          <span>{bids[0] !== null ? `Bid ${bids[0]} · Won ${taken[0]}` : 'Waiting to bid'}</span>
        </div>

        {/* Outer: clips overflow and scrolls. Inner: min-w-max so it never wraps, justify-center when there's room */}
        <div className="overflow-x-auto">
          <div className="flex gap-2 justify-center min-w-max px-1 pt-2 pb-1">
            {myHand.map(card => {
              const playable = canPlay(card);
              const selected = sel === card.id;
              return (
                <div
                  key={card.id}
                  onClick={() => {
                    if (!isMyPlayTurn || !playable) return;
                    if (selected) humanPlay(card);
                    else setSel(card.id);
                  }}
                  className={`flex-none w-12 h-16 bg-white rounded-xl flex flex-col items-center justify-center font-bold shadow cursor-pointer transition-all duration-150
                    ${selected ? 'ring-4 ring-blue-500 -translate-y-4 shadow-xl' : 'ring-1 ring-gray-200'}
                    ${!playable ? 'opacity-30' : isMyPlayTurn ? 'hover:-translate-y-2' : ''}
                    ${sc(card.s)}`}
                >
                  <div className="text-xs leading-tight">{card.v}</div>
                  <div className="text-xl leading-none">{card.s}</div>
                </div>
              );
            })}
          </div>
        </div>

        {sel && isMyPlayTurn && (
          <p className="text-center text-xs text-yellow-300 mt-0.5 animate-pulse">Tap again to play</p>
        )}
      </div>
    </div>
  );
}
