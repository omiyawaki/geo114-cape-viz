/**
 * Regression: CAPE/CIN fill must not span buoyancy gaps.
 *
 * Default Norman 18Z 24 May 2011 has a stable pocket ~824–744 hPa (B < 0)
 * between LFC and EL. Filling capeBand as one polygon painted that pocket
 * orange and spilled past the environmental T curve.
 *
 * Run: node test/check-bands.mjs
 */
import { EXAMPLES } from "../js/soundings.js";
import {
  liftSurfaceParcel,
  splitContiguousBands,
  bandLensRing,
} from "../js/thermo.js";
import { COLORS } from "../js/skewt.js";

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed++;
    console.error("FAIL:", msg);
  } else {
    console.log("ok  ", msg);
  }
}

function flatten(band) {
  return splitContiguousBands(band).flat();
}

function coversInterior(slices, p) {
  for (const s of slices) {
    const lo = Math.min(s.p0, s.p1);
    const hi = Math.max(s.p0, s.p1);
    if (p > lo + 1e-6 && p < hi - 1e-6) return true;
  }
  return false;
}

/** Ray-cast in (t, p). Ring is not required to repeat the first vertex. */
function pointInRing(t, p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const yi = ring[i].p;
    const yj = ring[j].p;
    const xi = ring[i].t;
    const xj = ring[j].t;
    const denom = yj - yi;
    if (denom === 0) continue;
    const intersect = yi > p !== yj > p && t < ((xj - xi) * (p - yi)) / denom + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function interpAt(p, pArr, vArr) {
  for (let i = 0; i < pArr.length - 1; i++) {
    const p0 = pArr[i];
    const p1 = pArr[i + 1];
    if ((p <= p0 && p >= p1) || (p >= p0 && p <= p1)) {
      const t = (p - p0) / (p1 - p0 || 1e-9);
      return vArr[i] + t * (vArr[i + 1] - vArr[i]);
    }
  }
  return NaN;
}

function surfaceOf(sounding) {
  return sounding.levels.find((d) => Number.isFinite(d.t) && Number.isFinite(d.td));
}

function ringsOf(band) {
  return splitContiguousBands(band).map(bandLensRing);
}

function inAnyRing(t, p, rings) {
  return rings.some((r) => r.length >= 4 && pointInRing(t, p, r));
}

function isBlue(css) {
  const m = String(css).match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!m) return false;
  const r = Number(m[1]);
  const g = Number(m[2]);
  const b = Number(m[3]);
  return b > r && b > g;
}

function isOrange(css) {
  const m = String(css).match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!m) return false;
  const r = Number(m[1]);
  const g = Number(m[2]);
  const b = Number(m[3]);
  return r > b && g > b;
}

function verticesBoundedByCurves(segment, ring) {
  const allowed = new Set();
  const add = (t, p) => allowed.add(`${t.toFixed(5)}@${p.toFixed(5)}`);
  const s0 = segment[0];
  add(s0.tP0, s0.p0);
  add(s0.tE0, s0.p0);
  for (const s of segment) {
    add(s.tP1, s.p1);
    add(s.tE1, s.p1);
  }
  return ring.every((v) => allowed.has(`${v.t.toFixed(5)}@${v.p.toFixed(5)}`));
}

// --- splitContiguousBands unit ---
{
  const a = { p0: 900, p1: 898, tP0: 20, tP1: 19, tE0: 18, tE1: 17 };
  const b = { p0: 898, p1: 896, tP0: 19, tP1: 18, tE0: 17, tE1: 16 };
  const c = { p0: 820, p1: 818, tP0: 10, tP1: 9, tE0: 12, tE1: 11 };
  const segs = splitContiguousBands([a, b, c]);
  assert(segs.length === 2, "splitContiguousBands breaks on a pGrid gap");
  assert(segs[0].length === 2 && segs[1].length === 1, "contiguous run stays together");
  assert(splitContiguousBands(segs).length === 2, "splitContiguousBands is idempotent on runs");
}

// --- default 18Z High-CAPE Plains ---
{
  const sfc = surfaceOf(EXAMPLES.highCape);
  const parcel = liftSurfaceParcel(EXAMPLES.highCape, sfc.t, sfc.td);
  const capeSegs = splitContiguousBands(parcel.capeBand);
  const cinSegs = splitContiguousBands(parcel.cinBand);
  const capeFlat = flatten(parcel.capeBand);
  const cinFlat = flatten(parcel.cinBand);

  assert(parcel.cape > 2500, `18Z CAPE is strong (got ${Math.round(parcel.cape)})`);
  assert(parcel.cin < 50, `18Z CIN integral stays ~0 sfc→LFC (got ${Math.round(parcel.cin)})`);
  assert(capeSegs.length >= 2, `18Z capeBand splits into ≥2 runs (got ${capeSegs.length})`);

  const badCape = capeFlat.filter((s) => !(s.bMid > 0));
  const badCin = cinFlat.filter((s) => !(s.bMid < 0));
  assert(badCape.length === 0, `every cape slice has B > 0 (${capeFlat.length} slices)`);
  assert(badCin.length === 0, `every cin slice has B < 0 (${cinFlat.length} slices)`);

  const capeRings = ringsOf(parcel.capeBand);
  const cinRings = ringsOf(parcel.cinBand);

  let negLayers = 0;
  let capeHits = 0;
  let missingCin = 0;
  let spills = 0;
  for (let i = 0; i < parcel.pGrid.length; i++) {
    const p = parcel.pGrid[i];
    if (p > 850 || p < 700) continue;
    if (!(parcel.B[i] < 0)) continue;
    negLayers++;
    if (coversInterior(capeFlat, p) || inAnyRing(0.5 * (parcel.tParcel[i] + parcel.tEnvironment[i]), p, capeRings)) {
      capeHits++;
    }
    const tP = parcel.tParcel[i];
    const tE = parcel.tEnvironment[i];
    const tMid = 0.5 * (tP + tE);
    if (!inAnyRing(tMid, p, cinRings)) missingCin++;
    const tRight = Math.max(tP, tE) + 8;
    if (inAnyRing(tRight, p, cinRings) || inAnyRing(tRight, p, capeRings)) spills++;
  }
  assert(negLayers > 0, "18Z 850–700 hPa has at least one B<0 layer (the reported pocket)");
  assert(capeHits === 0, `18Z B<0 layers in 850–700 are not in cape fill (${negLayers} layers)`);
  assert(missingCin === 0, `18Z B<0 layers in 850–700 are in cin fill (${negLayers} layers)`);
  assert(spills === 0, "18Z fill does not spill to the right of env/parcel T");

  for (const seg of cinSegs) {
    const ring = bandLensRing(seg);
    assert(verticesBoundedByCurves(seg, ring), "cin polygon vertices are parcel T or env T");
    const mid = seg[Math.floor(seg.length / 2)];
    const p = 0.5 * (mid.p0 + mid.p1);
    const tP = interpAt(p, [mid.p0, mid.p1], [mid.tP0, mid.tP1]);
    const tE = interpAt(p, [mid.p0, mid.p1], [mid.tE0, mid.tE1]);
    const tMid = 0.5 * (tP + tE);
    assert(pointInRing(tMid, p, ring), "cin lens contains the midpoint between parcel and env");
    assert(!pointInRing(Math.max(tP, tE) + 10, p, ring), "cin lens does not contain the exterior");
  }

  for (const seg of capeSegs) {
    const ring = bandLensRing(seg);
    assert(verticesBoundedByCurves(seg, ring), "cape polygon vertices are parcel T or env T");
    const mid = seg[Math.floor(seg.length / 2)];
    const p = 0.5 * (mid.p0 + mid.p1);
    const tP = interpAt(p, [mid.p0, mid.p1], [mid.tP0, mid.tP1]);
    const tE = interpAt(p, [mid.p0, mid.p1], [mid.tE0, mid.tE1]);
    assert(pointInRing(0.5 * (tP + tE), p, ring), "cape lens contains the midpoint between parcel and env");
  }

  assert(isBlue(COLORS.cin), `cin fill is blue (got ${COLORS.cin})`);
  assert(isOrange(COLORS.cape), `cape fill is orange (got ${COLORS.cape})`);
}

// --- capped 12Z: CIN below LFC, CAPE above, no cross-paint ---
{
  const sfc = surfaceOf(EXAMPLES.capped);
  const parcel = liftSurfaceParcel(EXAMPLES.capped, sfc.t, sfc.td);
  const capeFlat = flatten(parcel.capeBand);
  const cinFlat = flatten(parcel.cinBand);
  const capeRings = ringsOf(parcel.capeBand);
  const cinRings = ringsOf(parcel.cinBand);

  assert(parcel.cin > 100, `12Z CIN is substantial (got ${Math.round(parcel.cin)})`);
  assert(cinFlat.length > 0, "12Z has cin fill");

  assert(
    capeFlat.every((s) => s.bMid > 0) && cinFlat.every((s) => s.bMid < 0),
    "12Z cape slices have B > 0 and cin slices have B < 0"
  );

  let neg12 = 0;
  let bad12 = 0;
  for (let i = 0; i < parcel.pGrid.length; i++) {
    const p = parcel.pGrid[i];
    if (p > 850 || p < 700) continue;
    if (!(parcel.B[i] < 0)) continue;
    neg12++;
    const tMid = 0.5 * (parcel.tParcel[i] + parcel.tEnvironment[i]);
    if (coversInterior(capeFlat, p) || inAnyRing(tMid, p, capeRings) || !inAnyRing(tMid, p, cinRings)) {
      bad12++;
    }
  }
  assert(neg12 > 0 && bad12 === 0, `12Z 850–700 B<0 is cin, not cape (${neg12} layers)`);

  for (const seg of splitContiguousBands(parcel.cinBand)) {
    assert(verticesBoundedByCurves(seg, bandLensRing(seg)), "12Z cin vertices are parcel+env T");
  }
}

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
