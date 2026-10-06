/**
 * Deterministic simulation behind the hero scene (never real data).
 * A scripted session of 4 trades — 3 winners and 1 stopped-out loser, because a demo where
 * everything wins is neither credible nor honest. P&L = points × point value × contracts,
 * using the real CME point values of each contract (NQ $20/pt, ES $50/pt).
 */
export type Side = 'long' | 'short'
export type Sym = 'NQ' | 'ES'
export type Candle = { o: number; h: number; l: number; c: number }
export type Phase = 'scan' | 'signal' | 'order' | 'trade' | 'result'

export const SPEC: Record<Sym, { base: number; tick: number; pointValue: number; vol: number }> = {
  NQ: { base: 21480, tick: 0.25, pointValue: 20, vol: 5.5 },
  ES: { base: 6125, tick: 0.25, pointValue: 50, vol: 1.5 },
}

/** points > 0 = the trade reaches its target, points < 0 = stopped out. */
export const TRADES: { sym: Sym; side: Side; points: number }[] = [
  { sym: 'NQ', side: 'long', points: 21.25 }, // +$425.00
  { sym: 'ES', side: 'short', points: 6.25 }, // +$312.50
  { sym: 'NQ', side: 'long', points: -7.5 }, // −$150.00 (stop)
  { sym: 'NQ', side: 'short', points: 25.5 }, // +$510.00
]

export const START_BALANCE = 10_000
export const CONTRACTS = 1
export const MAX_CANDLES = 34

/** Ticks spent in each phase (one tick ≈ 650 ms). */
export const PHASE_LEN: Record<Phase, number> = { scan: 7, signal: 3, order: 2, trade: 10, result: 4 }
const ORDER: Phase[] = ['scan', 'signal', 'order', 'trade', 'result']

export type SceneState = {
  seed: number
  tradeIdx: number
  phase: Phase
  step: number
  sym: Sym
  candles: Candle[]
  entry: number
  target: number
  stop: number
  /** index (in `candles`) of the candle where the order was filled; -1 = none */
  entryIndex: number
  openPnl: number
  lastPnl: number
  balance: number
  /** P&L of each closed trade in the current session */
  results: number[]
}

/* ── helpers ── */

function rand(seed: number): [number, number] {
  // mulberry32
  let t = (seed + 0x6d2b79f5) | 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, seed + 0x6d2b79f5]
}

const roundTo = (v: number, tick: number) => Math.round(v / tick) * tick
const dirOf = (side: Side) => (side === 'long' ? 1 : -1)
export const pnlOf = (sym: Sym, side: Side, entry: number, price: number) => (price - entry) * dirOf(side) * SPEC[sym].pointValue * CONTRACTS

/** Adds one candle whose close is `close` (plus wicks). */
function pushCandle(s: SceneState, close: number): SceneState {
  const { tick, vol } = SPEC[s.sym]
  let seed = s.seed
  let r1: number, r2: number
  ;[r1, seed] = rand(seed)
  ;[r2, seed] = rand(seed)
  const o = s.candles[s.candles.length - 1]?.c ?? close
  const c = roundTo(close, tick)
  const h = roundTo(Math.max(o, c) + r1 * vol * 0.7, tick)
  const l = roundTo(Math.min(o, c) - r2 * vol * 0.7, tick)
  const candles = [...s.candles, { o, h, l, c }]
  const drop = Math.max(0, candles.length - MAX_CANDLES)
  return { ...s, seed, candles: candles.slice(drop), entryIndex: s.entryIndex >= 0 ? s.entryIndex - drop : -1 }
}

/** Random-walk step that slowly reverts to the instrument's base price. */
function walk(s: SceneState, scale = 1): SceneState {
  const { base, vol } = SPEC[s.sym]
  const last = s.candles[s.candles.length - 1]?.c ?? base
  let seed = s.seed
  let r: number
  ;[r, seed] = rand(seed)
  const close = last + (r - 0.5) * 2 * vol * scale + (base - last) * 0.06
  return pushCandle({ ...s, seed }, close)
}

function history(sym: Sym, seed: number): SceneState['candles'] {
  let s: SceneState = { ...emptyState(seed), sym, candles: [] }
  for (let i = 0; i < MAX_CANDLES; i++) s = walk(s)
  return s.candles
}

function emptyState(seed: number): SceneState {
  return { seed, tradeIdx: 0, phase: 'scan', step: 0, sym: 'NQ', candles: [], entry: 0, target: 0, stop: 0, entryIndex: -1, openPnl: 0, lastPnl: 0, balance: START_BALANCE, results: [] }
}

export function initialState(seed = 7): SceneState {
  return { ...emptyState(seed), candles: history('NQ', seed) }
}

/* ── one tick of the story ── */

export function step(prev: SceneState): SceneState {
  const trade = TRADES[prev.tradeIdx]
  let s: SceneState = { ...prev, step: prev.step + 1 }

  // move to the next phase when the current one is over
  if (s.step >= PHASE_LEN[s.phase]) {
    const next = ORDER[(ORDER.indexOf(s.phase) + 1) % ORDER.length]
    s = { ...s, phase: next, step: 0 }

    if (next === 'scan') {
      // next trade (a new session after the last one)
      const tradeIdx = (prev.tradeIdx + 1) % TRADES.length
      const newSession = tradeIdx === 0
      s = { ...s, tradeIdx, entryIndex: -1, openPnl: 0, ...(newSession ? { balance: START_BALANCE, results: [] } : {}) }
      if (TRADES[tradeIdx].sym !== s.sym) s = { ...s, sym: TRADES[tradeIdx].sym, candles: history(TRADES[tradeIdx].sym, s.seed + tradeIdx) }
    }

    if (next === 'signal') {
      const { tick } = SPEC[s.sym]
      const entry = s.candles[s.candles.length - 1].c
      const d = dirOf(trade.side)
      // winners: target = the scripted points; the loser shows a 14-pt target it never reaches
      const reward = trade.points > 0 ? trade.points : 14
      const risk = trade.points > 0 ? roundTo(trade.points * 0.4, tick) : Math.abs(trade.points)
      s = { ...s, entry, target: roundTo(entry + d * reward, tick), stop: roundTo(entry - d * risk, tick) }
    }

    if (next === 'trade') s = { ...s, entryIndex: s.candles.length - 1 }

    if (next === 'result') {
      const exit = trade.points > 0 ? s.target : s.stop
      const pnl = pnlOf(s.sym, trade.side, s.entry, exit)
      s = { ...s, lastPnl: pnl, openPnl: 0, balance: s.balance + pnl, results: [...s.results, pnl] }
    }
  }

  // price action for this tick
  if (s.phase === 'trade') {
    const exit = trade.points > 0 ? s.target : s.stop
    const p = (s.step + 1) / PHASE_LEN.trade
    const eased = p < 1 ? 1 - Math.pow(1 - p, 2) : 1
    let seed = s.seed
    let r: number
    ;[r, seed] = rand(seed)
    // losers first wander in favor, then reverse into the stop
    const path = trade.points > 0 ? eased : p < 0.5 ? -0.35 * Math.sin(p * Math.PI * 2) : (p - 0.5) * 2
    const noise = (r - 0.5) * SPEC[s.sym].vol * 1.4 * (1 - p)
    const close = p >= 1 ? exit : s.entry + (exit - s.entry) * path + noise
    s = pushCandle({ ...s, seed }, close)
    s = { ...s, openPnl: pnlOf(s.sym, trade.side, s.entry, s.candles[s.candles.length - 1].c) }
  } else {
    s = walk(s, s.phase === 'signal' || s.phase === 'order' ? 0.35 : 1)
  }
  return s
}

/** State shown to visitors who prefer reduced motion: the end of the first (winning) trade. */
export function staticState(): SceneState {
  let s = initialState()
  const ticks = PHASE_LEN.scan + PHASE_LEN.signal + PHASE_LEN.order + PHASE_LEN.trade + 1
  for (let i = 0; i < ticks; i++) s = step(s)
  return s
}

export const money = (n: number, sign = false) =>
  `${sign ? (n > 0 ? '+' : n < 0 ? '−' : '') : n < 0 ? '−' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const price = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
