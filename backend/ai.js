// ============================================================
// ai.js — car recommendation & comparison engine
//
// Runs entirely on the server with no external service:
//   • Min-max feature scaling across the whole inventory
//   • Weighted multi-criteria scoring for "which car suits me"
//   • Ridge regression on log(price) to estimate each car's fair
//     market price from year / mileage / engine / seats / type
//   • Distance-based similarity between cars
// If ANTHROPIC_API_KEY is set in .env, Claude writes the plain-
// language summary on top of these numbers; otherwise a rule-based
// summary is used, so the feature always works.
// ============================================================

const FINANCE = { downPaymentPct: 0.25, flatRatePerYear: 0.0299, years: 5 };
const INCOME_SHARE_FOR_CAR = 0.2; // rule of thumb: installment <= 20% of monthly income
const AI_LANGUAGE = process.env.AI_LANGUAGE || 'Thai';

// ---------- small helpers ----------
const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const roundTo = (v, step) => Math.round(v / step) * step;
const fmtTHB = (v) => `${Math.round(v).toLocaleString('en-US')} บาท`;

// Thai display names for the values stored in the database
const TYPE_TH = { Sedan: 'รถเก๋ง', SUV: 'รถอเนกประสงค์ (SUV)', 'Sports Car': 'รถสปอร์ต', Hatchback: 'รถแฮทช์แบ็ก', Pickup: 'รถกระบะ' };
const FUEL_TH = { Petrol: 'เบนซิน', Diesel: 'ดีเซล', Hybrid: 'ไฮบริด', EV: 'ไฟฟ้า (EV)' };
const TRANS_TH = { Automatic: 'เกียร์อัตโนมัติ', Manual: 'เกียร์ธรรมดา' };
const thType = (v) => TYPE_TH[v] || v;
const thFuel = (v) => FUEL_TH[v] || v;
const thTrans = (v) => TRANS_TH[v] || v;

function toCar(row) {
  return {
    id: row.id,
    name: row.name || '',
    model: row.model || '',
    type: row.type || '',
    price: num(row.price) ?? 0,
    image: row.image || '',
    stock: num(row.stock) ?? 0,
    year: num(row.year),
    mileage: num(row.mileage),
    fuel: row.fuel || '',
    transmission: row.transmission || '',
    seats: num(row.seats),
    engineCc: num(row.engine_cc),
    fuelEconomy: num(row.fuel_economy),
    color: row.color || '',
    sellerId: row.seller_id ?? null,
    sellerName: row.seller_name || '',
  };
}

function rangeOf(cars, key) {
  const vals = cars.map((c) => c[key]).filter((v) => v != null);
  if (!vals.length) return null;
  return { min: Math.min(...vals), max: Math.max(...vals) };
}

function buildRanges(cars) {
  return {
    price: rangeOf(cars, 'price'),
    year: rangeOf(cars, 'year'),
    mileage: rangeOf(cars, 'mileage'),
    fuelEconomy: rangeOf(cars, 'fuelEconomy'),
    seats: rangeOf(cars, 'seats'),
    engineCc: rangeOf(cars, 'engineCc'),
  };
}

// 0..1 where 1 = better. null when the value is unknown.
function scaled(value, range, higherIsBetter) {
  if (value == null || !range) return null;
  if (range.max === range.min) return 0.5;
  const t = (value - range.min) / (range.max - range.min);
  return higherIsBetter ? t : 1 - t;
}

function dimensionScores(car, ranges) {
  return {
    value: scaled(car.price, ranges.price, false),
    economy: car.fuel === 'EV' ? 1 : scaled(car.fuelEconomy, ranges.fuelEconomy, true),
    newness: scaled(car.year, ranges.year, true),
    lowMileage: scaled(car.mileage, ranges.mileage, false),
    space: scaled(car.seats, ranges.seats, true),
    power: scaled(car.engineCc, ranges.engineCc, true),
    smallEngine: scaled(car.engineCc, ranges.engineCc, false),
  };
}

// ---------- finance (Thai-style flat-rate hire purchase) ----------
function monthlyPayment(price) {
  const loan = price * (1 - FINANCE.downPaymentPct);
  const total = loan * (1 + FINANCE.flatRatePerYear * FINANCE.years);
  return Math.round(total / (FINANCE.years * 12));
}

function priceForMonthly(monthly) {
  const loan = (monthly * FINANCE.years * 12) / (1 + FINANCE.flatRatePerYear * FINANCE.years);
  return loan / (1 - FINANCE.downPaymentPct);
}

function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

// ============================================================
// 1) Recommendation — "what car and what budget suit me?"
// ============================================================
const USAGE_PROFILES = {
  city: {
    label: 'ขับในเมือง',
    types: { Hatchback: 1, Sedan: 0.8, SUV: 0.5, 'Sports Car': 0.3, Pickup: 0.1 },
    weights: { economy: 2, smallEngine: 1 },
    preferTransmission: 'Automatic',
  },
  family: {
    label: 'ใช้กับครอบครัว',
    types: { SUV: 1, Sedan: 0.7, Pickup: 0.4, Hatchback: 0.3, 'Sports Car': 0 },
    weights: { space: 2.5, newness: 1 },
  },
  long_trip: {
    label: 'เดินทางไกล',
    types: { Sedan: 1, SUV: 0.9, Pickup: 0.5, 'Sports Car': 0.5, Hatchback: 0.4 },
    weights: { economy: 1.5, newness: 1, lowMileage: 1 },
  },
  offroad: {
    label: 'ออฟโรด / ต่างจังหวัด',
    types: { Pickup: 1, SUV: 0.9, Sedan: 0.1, Hatchback: 0.1, 'Sports Car': 0 },
    weights: { power: 1.5 },
    preferFuels: ['Diesel'],
  },
  performance: {
    label: 'สมรรถนะ / ขับสนุก',
    types: { 'Sports Car': 1, Sedan: 0.5, SUV: 0.3, Hatchback: 0.3, Pickup: 0.1 },
    weights: { power: 2.5, newness: 0.5 },
  },
  economy: {
    label: 'ค่าใช้จ่ายต่ำ',
    types: { Hatchback: 1, Sedan: 0.8, SUV: 0.5, Pickup: 0.4, 'Sports Car': 0.1 },
    weights: { economy: 2.5, value: 1 },
    preferFuels: ['EV', 'Hybrid'],
  },
};

function recommend(rows, prefs = {}) {
  const all = rows.map(toCar);
  const ranges = buildRanges(all);
  const available = all.filter((c) => c.stock > 0);

  const budget = num(prefs.budget);
  const income = num(prefs.monthlyIncome);
  const passengers = num(prefs.passengers);
  const usages = (Array.isArray(prefs.usages) ? prefs.usages : []).filter((u) => USAGE_PROFILES[u]);
  const fuelPref = prefs.fuel && prefs.fuel !== 'Any' ? prefs.fuel : null;
  const transPref = prefs.transmission && prefs.transmission !== 'Any' ? prefs.transmission : null;

  const scored = available.map((car) => {
    const dims = dimensionScores(car, ranges);
    const reasons = [];
    let fit = 0;
    let fitWeight = 0;
    const add = (score, weight) => {
      fit += (score ?? 0.5) * weight; // unknown spec -> neutral
      fitWeight += weight;
    };

    if (usages.length) {
      for (const key of usages) {
        const p = USAGE_PROFILES[key];
        const typeFit = p.types[car.type] ?? 0.4;
        add(typeFit, 2);
        if (typeFit >= 0.9) reasons.push(`${thType(car.type)} เหมาะกับการใช้งานแบบ "${p.label}"`);
        for (const [dim, w] of Object.entries(p.weights)) add(dims[dim], w);
        if (p.preferTransmission && car.transmission) add(car.transmission === p.preferTransmission ? 1 : 0.3, 0.5);
        if (p.preferFuels && car.fuel) {
          const match = p.preferFuels.includes(car.fuel);
          add(match ? 1 : 0.4, 1);
          if (match) reasons.push(`เชื้อเพลิง${thFuel(car.fuel)} เหมาะกับการใช้งานแบบ "${p.label}"`);
        }
      }
    } else {
      ['value', 'newness', 'lowMileage', 'economy'].forEach((d) => add(dims[d], 1));
    }

    // Always lean a little towards cars in better condition
    add(dims.newness, 0.5);
    add(dims.lowMileage, 0.5);

    let excludedBy = null;
    if (passengers && car.seats != null) {
      if (car.seats >= passengers) {
        add(1, 1.5);
        if (passengers >= 5) reasons.push(`${car.seats} ที่นั่ง — นั่งได้ ${passengers} คนสบายๆ`);
      } else {
        excludedBy = 'seats';
      }
    }
    if (fuelPref) {
      add(car.fuel === fuelPref ? 1 : 0, 1.5);
      if (car.fuel === fuelPref) reasons.push(`${thFuel(car.fuel)} ตามที่คุณต้องการ`);
    }
    if (transPref) {
      add(car.transmission === transPref ? 1 : 0, 1.5);
      if (car.transmission === transPref) reasons.push(`${thTrans(car.transmission)} ตามที่คุณต้องการ`);
    }

    if (dims.economy != null && dims.economy >= 0.75) {
      reasons.push(car.fuel === 'EV' ? 'รถไฟฟ้า — ค่าใช้จ่ายต่ำที่สุด' : `ประหยัดน้ำมัน (${car.fuelEconomy} กม./ลิตร)`);
    }
    if (dims.lowMileage != null && dims.lowMileage >= 0.75) reasons.push(`ไมล์น้อย (${car.mileage.toLocaleString('en-US')} กม.)`);
    if (dims.newness != null && dims.newness >= 0.75) reasons.push(`รถปีใหม่ (ปี ${car.year})`);

    const fitScore = fit / fitWeight;

    let budgetStatus = 'none';
    let budgetScore = null;
    if (budget) {
      const ratio = car.price / budget;
      if (ratio <= 1) {
        budgetStatus = 'within';
        budgetScore = ratio >= 0.6 ? 1 : 0.85;
      } else if (ratio <= 1.1) {
        budgetStatus = 'stretch';
        budgetScore = 0.4;
        reasons.push(`เกินงบประมาณประมาณ ${Math.round((ratio - 1) * 100)}%`);
      } else {
        budgetStatus = 'over';
        excludedBy = excludedBy || 'budget';
      }
    }
    const BUDGET_WEIGHT = 3;
    const score = budgetScore == null ? fitScore : (fit + budgetScore * BUDGET_WEIGHT) / (fitWeight + BUDGET_WEIGHT);

    return {
      car,
      score: Math.round(score * 100),
      fitScore: Math.round(fitScore * 100),
      reasons: [...new Set(reasons)].slice(0, 4),
      budgetStatus,
      monthly: monthlyPayment(car.price),
      excludedBy,
    };
  });

  const results = scored
    .filter((s) => !s.excludedBy)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ excludedBy, ...rest }) => rest);

  // ---- Budget advice: what price range buys the cars that fit best? ----
  const bestFitPrices = scored
    .filter((s) => s.excludedBy !== 'seats')
    .sort((a, b) => b.fitScore - a.fitScore)
    .slice(0, 8)
    .map((s) => s.car.price)
    .sort((a, b) => a - b);

  const suggestedMin = bestFitPrices.length ? roundTo(quantile(bestFitPrices, 0.25), 10000) : null;
  const suggestedMax = bestFitPrices.length ? roundTo(quantile(bestFitPrices, 0.75), 10000) : null;
  const maxMonthly = income ? Math.round(income * INCOME_SHARE_FOR_CAR) : null;
  const affordableMax = maxMonthly ? roundTo(priceForMonthly(maxMonthly), 10000) : null;

  const notes = [];
  if (suggestedMin != null) {
    const range = `${fmtTHB(suggestedMin)} – ${fmtTHB(suggestedMax)}`;
    if (!budget) notes.push(`รถที่ตรงกับความต้องการของคุณที่สุดส่วนใหญ่ราคา ${range}`);
    else if (budget < suggestedMin) notes.push(`รถที่ตรงกับความต้องการของคุณที่สุดส่วนใหญ่ราคา ${range} ซึ่งสูงกว่างบของคุณ — ลองเพิ่มงบอีกเล็กน้อย หรือลดเงื่อนไขบางข้อลง`);
    else if (budget > suggestedMax * 1.2) notes.push(`คุณใช้งบน้อยกว่านี้ได้: รถที่เหมาะที่สุดอยู่ในช่วง ${range}`);
    else notes.push(`งบของคุณเหมาะกับรถที่ตรงความต้องการที่สุดพอดี (${range})`);
  }
  if (affordableMax) {
    notes.push(`ถ้าต้องการให้ค่างวดไม่เกิน ${fmtTHB(maxMonthly)}/เดือน (20% ของรายได้) ควรเลือกรถราคาไม่เกินประมาณ ${fmtTHB(affordableMax)}`);
    if (budget && budget > affordableMax) notes.push('งบของคุณสูงกว่านั้น — ถ้าดาวน์มากขึ้นจะช่วยให้ค่างวดต่อเดือนไม่หนักเกินไป');
  }
  if (budget) {
    notes.push(`ค่างวดโดยประมาณที่งบของคุณ: ${fmtTHB(monthlyPayment(budget))}/เดือน (ดาวน์ ${FINANCE.downPaymentPct * 100}%, ผ่อน ${FINANCE.years} ปี, ดอกเบี้ยคงที่ ${(FINANCE.flatRatePerYear * 100).toFixed(2)}% ต่อปี)`);
  }
  if (!results.length) notes.push('ตอนนี้ยังไม่มีรถในสต็อกที่ตรงกับทุกเงื่อนไขของคุณ');

  return {
    results,
    budget: { suggestedMin, suggestedMax, affordableMax, maxMonthly, finance: FINANCE, notes },
    considered: available.length,
  };
}

// ============================================================
// 2) Fair-price model — ridge regression on log(price)
// ============================================================
function solveLinear(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    if (Math.abs(M[pivot][col]) < 1e-12) return null;
    [M[col], M[pivot]] = [M[pivot], M[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      for (let k = col; k <= n; k++) M[r][k] -= f * M[col][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

function fitPriceModel(cars) {
  const usable = cars.filter((c) => c.price > 0 && c.year != null && c.mileage != null);
  const types = [...new Set(usable.map((c) => c.type).filter(Boolean))].sort().slice(1); // first type = baseline
  const engineMean = mean(usable.map((c) => c.engineCc).filter((v) => v != null)) ?? 1500;
  const seatsMean = mean(usable.map((c) => c.seats).filter((v) => v != null)) ?? 5;
  const featuresOf = (c) => [
    c.year,
    c.mileage,
    c.engineCc ?? engineMean,
    c.seats ?? seatsMean,
    c.fuel === 'Hybrid' || c.fuel === 'EV' ? 1 : 0, // electrified cars hold higher prices
    ...types.map((t) => (c.type === t ? 1 : 0)),
  ];

  const p = 5 + types.length;
  if (usable.length < Math.max(8, p + 3)) return null; // not enough data to learn from

  const X = usable.map(featuresOf);
  const y = usable.map((c) => Math.log(c.price));

  const mu = [];
  const sd = [];
  for (let j = 0; j < p; j++) {
    const col = X.map((r) => r[j]);
    const m = mean(col);
    mu.push(m);
    sd.push(Math.sqrt(mean(col.map((x) => (x - m) ** 2))) || 1);
  }
  const Z = X.map((r) => r.map((x, j) => (x - mu[j]) / sd[j]));
  const yMean = mean(y);

  const LAMBDA = 1.0; // ridge penalty keeps it stable on small inventories
  const A = Array.from({ length: p }, (_, i) =>
    Array.from({ length: p }, (_, j) => Z.reduce((s, r) => s + r[i] * r[j], 0) + (i === j ? LAMBDA : 0))
  );
  const b = Array.from({ length: p }, (_, i) => Z.reduce((s, r, k) => s + r[i] * (y[k] - yMean), 0));
  const w = solveLinear(A, b);
  if (!w) return null;

  const predictLog = (f) => yMean + f.reduce((s, x, j) => s + (w[j] * (x - mu[j])) / sd[j], 0);
  const ssTot = y.reduce((s, v) => s + (v - yMean) ** 2, 0);
  const ssRes = X.reduce((s, f, k) => s + (y[k] - predictLog(f)) ** 2, 0);

  return {
    samples: usable.length,
    r2: ssTot ? 1 - ssRes / ssTot : 0,
    predict: (c) => (c.year == null || c.mileage == null ? null : Math.exp(predictLog(featuresOf(c)))),
  };
}

// ============================================================
// 3) Comparison
// ============================================================
const COMPARE_DIMENSIONS = [
  { key: 'value', label: 'ความคุ้มค่า' },
  { key: 'economy', label: 'ความประหยัดน้ำมัน' },
  { key: 'newness', label: 'ความใหม่ของรถ' },
  { key: 'lowMileage', label: 'ไมล์น้อย' },
  { key: 'space', label: 'ความจุ / ที่นั่ง' },
  { key: 'power', label: 'สมรรถนะ' },
];

function similarityPct(a, b, ranges) {
  const keys = ['value', 'economy', 'newness', 'lowMileage', 'space', 'power'];
  const vec = (c) => {
    const d = dimensionScores(c, ranges);
    return keys.map((k) => d[k] ?? 0.5);
  };
  const va = vec(a);
  const vb = vec(b);
  const dist = Math.sqrt(va.reduce((s, v, i) => s + (v - vb[i]) ** 2, 0) / keys.length);
  let sim = 1 - dist;
  sim = a.type && a.type === b.type ? sim * 0.8 + 0.2 : sim * 0.8;
  return Math.round(sim * 100);
}

function compare(rows, ids, priorities = {}) {
  const all = rows.map(toCar);
  const ranges = buildRanges(all);
  const model = fitPriceModel(all);
  const useModel = model && model.r2 >= 0.3; // ignore a model that explains too little
  const selected = ids.map((id) => all.find((c) => Number(c.id) === Number(id))).filter(Boolean);

  const dimensions = COMPARE_DIMENSIONS.map((d) => {
    const w = num(priorities[d.key]);
    return { ...d, weight: w != null && w >= 0 ? w : 1 };
  });

  const cars = selected.map((car) => {
    const dims = dimensionScores(car, ranges);
    const fairPrice = useModel ? model.predict(car) : null;
    let dealPct = null;
    let dealLabel = null;
    if (fairPrice) {
      dealPct = Math.round(((fairPrice - car.price) / fairPrice) * 100); // + means cheaper than market
      dims.value = clamp01(0.5 + dealPct / 40); // ±20% maps to 0..1
      dealLabel = dealPct >= 5 ? 'Good deal' : dealPct <= -5 ? 'Above market' : 'Fair price';
    }

    const scores = {};
    let total = 0;
    let wsum = 0;
    for (const d of dimensions) {
      const s = dims[d.key];
      scores[d.key] = s == null ? null : Math.round(s * 100);
      if (s != null && d.weight > 0) {
        total += s * d.weight;
        wsum += d.weight;
      }
    }

    return {
      ...car,
      scores,
      overall: wsum ? Math.round((total / wsum) * 100) : null,
      fairPrice: fairPrice ? roundTo(fairPrice, 1000) : null,
      dealPct,
      dealLabel,
      monthly: monthlyPayment(car.price),
    };
  });

  const winners = {};
  for (const d of dimensions) {
    const known = cars.filter((c) => c.scores[d.key] != null);
    if (known.length < 2) {
      winners[d.key] = null;
      continue;
    }
    const best = Math.max(...known.map((c) => c.scores[d.key]));
    const top = known.filter((c) => c.scores[d.key] === best);
    winners[d.key] = top.length === 1 ? top[0].id : null;
  }

  const ranked = cars.filter((c) => c.overall != null).sort((a, b) => b.overall - a.overall);
  const bestOverallId = ranked.length ? ranked[0].id : null;

  const similarity = [];
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      similarity.push({ a: cars[i].id, b: cars[j].id, percent: similarityPct(cars[i], cars[j], ranges) });
    }
  }

  return {
    cars,
    dimensions,
    winners,
    bestOverallId,
    similarity,
    priceModel: model ? { samples: model.samples, r2: Number(model.r2.toFixed(2)), used: !!useModel } : null,
  };
}

// ============================================================
// 4) Natural-language summaries (Claude if configured, else rules)
// ============================================================
async function askClaude(system, userContent) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
        max_tokens: 400,
        system,
        messages: [{ role: 'user', content: userContent }],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error('Claude API error', res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    return text || null;
  } catch (err) {
    console.error('Claude API call failed:', err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const SYSTEM_PROMPT =
  'You are a friendly, honest car-buying advisor at a car dealership in Thailand. Prices are in Thai baht (THB). ' +
  'Base every statement only on the data provided — never invent cars, specs or prices. ' +
  `Reply in ${AI_LANGUAGE}, as plain text without markdown, in under 120 words.`;

async function summarizeRecommendation(prefs, result) {
  const top = result.results.slice(0, 5).map((r) => ({
    name: r.car.name,
    type: r.car.type,
    year: r.car.year,
    price: r.car.price,
    fuel: r.car.fuel,
    score: r.score,
    reasons: r.reasons,
    budgetStatus: r.budgetStatus,
  }));
  if (!top.length) return { text: result.budget.notes.join(' '), source: 'rules' };

  const needs = {
    budget: prefs.budget,
    monthlyIncome: prefs.monthlyIncome,
    usages: prefs.usages,
    passengers: prefs.passengers,
    fuel: prefs.fuel,
    transmission: prefs.transmission,
    notes: typeof prefs.notes === 'string' ? prefs.notes.slice(0, 500) : undefined,
  };
  const llm = await askClaude(
    SYSTEM_PROMPT,
    `Customer needs: ${JSON.stringify(needs)}\n\nTop matches from our scoring model (score 0-100):\n${JSON.stringify(top)}\n\n` +
      `Budget analysis:\n${JSON.stringify(result.budget.notes)}\n\n` +
      'Recommend the best 1-2 cars for this customer, explain why, and give one sentence of budget advice.'
  );
  if (llm) return { text: llm, source: 'claude' };

  const [best, second] = top;
  let text = `รถที่เหมาะกับคุณที่สุด: ${best.name} (${best.score}/100)`;
  if (best.reasons.length) text += ` — ${best.reasons.slice(0, 2).join(', ')}`;
  if (second) text += ` · อันดับรองลงมา: ${second.name} (${second.score}/100)`;
  if (result.budget.notes[0]) text += ` · ${result.budget.notes[0]}`;
  return { text, source: 'rules' };
}

async function summarizeComparison(result) {
  const nameOf = (id) => result.cars.find((c) => c.id === id)?.name;
  const leads = {};
  for (const d of result.dimensions) {
    const id = result.winners[d.key];
    if (id != null) (leads[nameOf(id)] = leads[nameOf(id)] || []).push(d.label);
  }

  const llm = await askClaude(
    SYSTEM_PROMPT,
    `Compare these cars for a buyer. Data (scores are 0-100, higher is better; fairPrice comes from a price model trained on our inventory):\n` +
      JSON.stringify({
        cars: result.cars.map((c) => ({
          name: c.name, type: c.type, year: c.year, mileage: c.mileage, price: c.price, fuel: c.fuel,
          transmission: c.transmission, seats: c.seats, scores: c.scores, overall: c.overall,
          fairPrice: c.fairPrice, dealLabel: c.dealLabel,
        })),
        leadsIn: leads,
      }) +
      '\n\nSay which car is the best overall pick and who each of the others suits better.'
  );
  if (llm) return { text: llm, source: 'claude' };

  const parts = [];
  const best = result.cars.find((c) => c.id === result.bestOverallId);
  if (best) parts.push(`โดยรวมดีที่สุด: ${best.name} (${best.overall}/100)`);
  for (const [name, dims] of Object.entries(leads)) parts.push(`${name} เด่นด้าน${dims.join(', ')}`);
  for (const c of result.cars) {
    if (c.dealLabel === 'Good deal') parts.push(`${c.name} ราคาต่ำกว่าราคาตลาดที่ประเมินไว้ประมาณ ${c.dealPct}%`);
    if (c.dealLabel === 'Above market') parts.push(`${c.name} ราคาสูงกว่าราคาตลาดที่ประเมินไว้ประมาณ ${-c.dealPct}%`);
  }
  return { text: parts.join(' · '), source: 'rules' };
}

module.exports = {
  recommend,
  compare,
  summarizeRecommendation,
  summarizeComparison,
  // exported for testing
  fitPriceModel,
  toCar,
};
