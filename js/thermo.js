/**
 * Pedagogical thermodynamics for surface-based CAPE on a skew-T.
 *
 * Parcel: dry adiabatic from the surface to the LCL, then a liquid-water
 * pseudoadiabat (moist adiabatic, condensate assumed rained out).
 * CAPE/CIN: virtual-temperature buoyancy integrated in pressure coordinates.
 *
 * These are teaching approximations, not an operational forecast package.
 * See README.md for the formula list and known biases vs. UWYO / MetPy.
 */

export const Rd = 287.05; // J kg-1 K-1  dry air
export const Rv = 461.51; // J kg-1 K-1  water vapor
export const CP = 1004.0; // J kg-1 K-1  dry air
export const G = 9.80665; // m s-2
export const EPS = Rd / Rv; // ≈ 0.622
export const LV = 2.501e6; // J kg-1  latent heat (held constant)
export const P0 = 1000.0; // hPa
export const KAPPA = Rd / CP; // ≈ 0.286

export function cToK(tC) {
  return tC + 273.15;
}
export function kToC(tK) {
  return tK - 273.15;
}

/** Bolton (1980) saturation vapor pressure over liquid, hPa. tC in °C. */
export function satVaporPressure(tC) {
  return 6.112 * Math.exp((17.67 * tC) / (tC + 243.5));
}

/** Inverse of Bolton es: dewpoint (°C) from vapor pressure (hPa). */
export function dewpointFromE(eHpa) {
  const e = Math.max(eHpa, 1e-6);
  const a = Math.log(e / 6.112);
  return (243.5 * a) / (17.67 - a);
}

/** Water-vapor mixing ratio (kg/kg) from dewpoint (°C) and pressure (hPa). */
export function mixingRatio(tdC, pHpa) {
  const e = satVaporPressure(tdC);
  const denom = pHpa - e;
  if (denom <= 0.05) return EPS * e / 0.05;
  return (EPS * e) / denom;
}

/** Dewpoint (°C) from mixing ratio (kg/kg) and pressure (hPa). */
export function dewpointFromMixingRatio(w, pHpa) {
  const e = (w * pHpa) / (EPS + w);
  return dewpointFromE(e);
}

/** Virtual temperature (K). Mixing ratio in kg/kg. Hobbs / MetPy form. */
export function virtualTemp(tK, w) {
  const ww = Math.max(w, 0);
  return tK * (ww + EPS) / (EPS * (1 + ww));
}

export function potentialTemp(tK, pHpa) {
  return tK * Math.pow(P0 / pHpa, KAPPA);
}

/**
 * Bolton (1980) LCL temperature (K).
 * T and Td in Kelvin. Valid for typical tropospheric values.
 */
export function lclTemperatureK(tK, tdK) {
  if (tdK >= tK - 1e-6) return tK;
  return 1 / (1 / (tdK - 56) + Math.log(tK / tdK) / 800) + 56;
}

/** LCL pressure (hPa) from Poisson (dry adiabat through the surface). */
export function lclPressure(pHpa, tK, tLclK) {
  return pHpa * Math.pow(tLclK / tK, 1 / KAPPA);
}

/** Dry-adiabatic temperature (K) at pressure p, from (t0K, p0). */
export function dryAdiabatT(t0K, p0, p) {
  return t0K * Math.pow(p / p0, KAPPA);
}

/**
 * dT/dp (K / hPa) along a liquid pseudoadiabat.
 * MetPy / Bakhshaii & Stull (2013):
 *   dT/dP = (1/P) (Rd T + Lv rs) / (Cp + Lv² rs ε / (Rd T²))
 * with P in Pa.
 */
export function moistLapseKPerHpa(tK, pHpa) {
  const tC = kToC(tK);
  const es = satVaporPressure(tC);
  const rs = mixingRatio(tC, pHpa); // saturated: Td = T
  const pPa = pHpa * 100;
  const num = Rd * tK + LV * rs;
  const den = CP + (LV * LV * rs * EPS) / (Rd * tK * tK);
  return ((num / den) / pPa) * 100;
}

/** One RK4 step along the moist adiabat. dpHpa < 0 when lifting. */
export function stepMoist(tK, pHpa, dpHpa) {
  const p2 = pHpa + dpHpa;
  if (p2 <= 1) return tK;
  const k1 = moistLapseKPerHpa(tK, pHpa);
  const k2 = moistLapseKPerHpa(tK + 0.5 * dpHpa * k1, pHpa + 0.5 * dpHpa);
  const k3 = moistLapseKPerHpa(tK + 0.5 * dpHpa * k2, pHpa + 0.5 * dpHpa);
  const k4 = moistLapseKPerHpa(tK + dpHpa * k3, p2);
  return tK + (dpHpa / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
}

/** Integrate a moist adiabat from (tK, pStart) onto decreasing pressures. */
export function moistAdiabatProfile(tStartK, pStart, pTargets) {
  const out = new Array(pTargets.length);
  let t = tStartK;
  let p = pStart;
  const dp = -1; // 1 hPa steps upward
  let i = 0;
  while (i < pTargets.length && pTargets[i] > pStart + 0.01) {
    out[i] = kToC(dryAdiabatT(tStartK, pStart, pTargets[i])); // shouldn't happen
    i++;
  }
  for (; i < pTargets.length; i++) {
    const target = pTargets[i];
    while (p + dp > target) {
      t = stepMoist(t, p, dp);
      p += dp;
    }
    const last = target - p;
    if (Math.abs(last) > 1e-6) t = stepMoist(t, p, last);
    p = target;
    out[i] = kToC(t);
  }
  return out;
}

export function interpLogP(p, pArr, vArr) {
  const n = pArr.length;
  if (n === 0) return NaN;
  if (p >= pArr[0]) return vArr[0];
  if (p <= pArr[n - 1]) return vArr[n - 1];
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (pArr[mid] >= p) lo = mid;
    else hi = mid;
  }
  const lp = Math.log(p);
  const l0 = Math.log(pArr[lo]);
  const l1 = Math.log(pArr[hi]);
  const t = (lp - l0) / (l1 - l0);
  return vArr[lo] + t * (vArr[hi] - vArr[lo]);
}

function validPairs(levels, key) {
  const p = [];
  const v = [];
  for (const lv of levels) {
    if (Number.isFinite(lv.p) && Number.isFinite(lv[key])) {
      p.push(lv.p);
      v.push(lv[key]);
    }
  }
  return { p, v };
}

export function capeCategory(cape) {
  if (cape < 100) return { id: "none", label: "essentially none", hint: "parcel is not free to rise" };
  if (cape < 1000) return { id: "weak", label: "weak", hint: "weak instability" };
  if (cape < 2500) return { id: "moderate", label: "moderate", hint: "moderate instability" };
  if (cape < 4000) return { id: "strong", label: "strong", hint: "strong instability" };
  return { id: "extreme", label: "extreme", hint: "extreme instability" };
}

/**
 * Break a CAPE/CIN band into contiguous pressure runs.
 * Slices are omitted where buoyancy has the other sign, so a flat array can
 * jump in pGrid; each jump starts a new polygon. Accepts a flat list or a
 * list of runs (idempotent).
 */
export function splitContiguousBands(band) {
  if (!band || band.length === 0) return [];
  if (Array.isArray(band[0])) {
    const out = [];
    for (const run of band) {
      if (Array.isArray(run) && run.length) out.push(...splitContiguousBands(run));
    }
    return out;
  }
  const segs = [];
  let cur = [band[0]];
  for (let i = 1; i < band.length; i++) {
    const prev = cur[cur.length - 1];
    if (Math.abs(band[i].p0 - prev.p1) <= 0.05) cur.push(band[i]);
    else {
      segs.push(cur);
      cur = [band[i]];
    }
  }
  segs.push(cur);
  return segs;
}

/**
 * Closed (t, p) ring for the lens between parcel T and env T.
 * Colder side bottom→top, warmer side top→bottom, so the interior is always
 * the region between the two curves (not the exterior, even when the parcel
 * is to the left of the environment).
 */
export function bandLensRing(segment) {
  if (!segment || !segment.length) return [];
  const pts = [{ tP: segment[0].tP0, tE: segment[0].tE0, p: segment[0].p0 }];
  for (const s of segment) pts.push({ tP: s.tP1, tE: s.tE1, p: s.p1 });
  const ring = [];
  for (const v of pts) ring.push({ t: Math.min(v.tP, v.tE), p: v.p });
  for (let i = pts.length - 1; i >= 0; i--) {
    ring.push({ t: Math.max(pts[i].tP, pts[i].tE), p: pts[i].p });
  }
  return ring;
}

/**
 * Surface-based parcel lift and CAPE/CIN.
 *
 * @param {object} sounding  { levels: [{p, z, t, td}, ...] } p decreasing
 * @param {number} tSfcC     parcel surface temperature °C
 * @param {number} tdSfcC    parcel surface dewpoint °C
 */
export function liftSurfaceParcel(sounding, tSfcC, tdSfcC) {
  const levels = sounding.levels.filter((lv) => Number.isFinite(lv.p) && Number.isFinite(lv.t));
  if (levels.length < 4) {
    throw new Error("Sounding needs at least 4 temperature levels.");
  }
  const pSfc = levels[0].p;
  const tSfc = tSfcC;
  const tdSfc = Math.min(tdSfcC, tSfcC);
  const tK = cToK(tSfc);
  const tdK = cToK(tdSfc);
  const wSfc = mixingRatio(tdSfc, pSfc);

  const tLclK = lclTemperatureK(tK, tdK);
  const pLcl = Math.min(pSfc - 0.1, Math.max(50, lclPressure(pSfc, tK, tLclK)));
  const tLclC = kToC(tLclK);

  const pTop = Math.max(50, levels[levels.length - 1].p);
  const dp = 2;
  const n = Math.floor((pSfc - pTop) / dp) + 1;
  const pGrid = new Array(n);
  for (let i = 0; i < n; i++) pGrid[i] = pSfc - i * dp;

  const tEnv = validPairs(levels, "t");
  const tdEnv = validPairs(levels, "td");
  const zEnv = validPairs(levels, "z");

  const tParcel = new Array(n);
  const tdParcel = new Array(n);
  const tEnvironment = new Array(n);
  const tdEnvironment = new Array(n);
  const zGrid = new Array(n);
  const tvP = new Array(n);
  const tvE = new Array(n);
  const B = new Array(n); // Tv_p - Tv_e

  // Moist branch: integrate from LCL upward on the same 2 hPa grid.
  const upIdx = [];
  const upP = [];
  for (let i = 0; i < n; i++) {
    if (pGrid[i] <= pLcl) {
      upIdx.push(i);
      upP.push(pGrid[i]);
    }
  }
  const moistT = upP.length ? moistAdiabatProfile(tLclK, pLcl, upP) : [];
  let moistK = 0;

  for (let i = 0; i < n; i++) {
    const p = pGrid[i];
    tEnvironment[i] = interpLogP(p, tEnv.p, tEnv.v);
    tdEnvironment[i] =
      tdEnv.p.length >= 2 ? interpLogP(p, tdEnv.p, tdEnv.v) : tEnvironment[i] - 20;
    zGrid[i] =
      zEnv.p.length >= 2
        ? interpLogP(p, zEnv.p, zEnv.v)
        : i === 0
          ? 0
          : zGrid[i - 1] + (Rd * virtualTemp(cToK(tEnvironment[i]), mixingRatio(tdEnvironment[i], p)) / G) * Math.log(pGrid[i - 1] / p);

    if (p >= pLcl) {
      tParcel[i] = kToC(dryAdiabatT(tK, pSfc, p));
      tdParcel[i] = dewpointFromMixingRatio(wSfc, p);
    } else {
      tParcel[i] = moistT[moistK++];
      tdParcel[i] = tParcel[i];
    }

    const wP = p >= pLcl ? wSfc : mixingRatio(tParcel[i], p);
    const wE = mixingRatio(tdEnvironment[i], p);
    tvP[i] = virtualTemp(cToK(tParcel[i]), wP);
    tvE[i] = virtualTemp(cToK(tEnvironment[i]), wE);
    B[i] = tvP[i] - tvE[i];
  }

  const zOf = (p) => interpLogP(p, pGrid, zGrid);

  // LFC: first transition to positive buoyancy at or above the LCL.
  let pLfc = null;
  let pEl = null;
  const iLcl = pGrid.findIndex((p) => p <= pLcl);
  const i0 = iLcl < 0 ? 0 : iLcl;

  if (B[i0] > 0) {
    pLfc = pGrid[i0];
  } else {
    for (let i = i0; i < n - 1; i++) {
      if (B[i] <= 0 && B[i + 1] > 0) {
        const frac = B[i] / (B[i] - B[i + 1] || 1e-9);
        pLfc = pGrid[i] + frac * (pGrid[i + 1] - pGrid[i]);
        break;
      }
    }
  }

  if (pLfc != null) {
    for (let i = n - 2; i >= 0; i--) {
      if (pGrid[i] > pLfc) continue;
      if (B[i] > 0 && B[i + 1] <= 0) {
        const frac = B[i] / (B[i] - B[i + 1] || 1e-9);
        pEl = pGrid[i] + frac * (pGrid[i + 1] - pGrid[i]);
        break;
      }
    }
    if (pEl == null && B[n - 1] > 0) pEl = pGrid[n - 1];
  }

  // Pressure-coordinate integrals:
  // CAPE = -Rd ∫_{LFC}^{EL} (Tv_p - Tv_e) d ln p   (positive area)
  // CIN  = -Rd ∫_{sfc}^{LFC} (Tv_p - Tv_e) d ln p   (negative area, reported ≥ 0)
  let cape = 0;
  let cin = 0;
  const capeBand = [];
  const cinBand = [];

  for (let i = 0; i < n - 1; i++) {
    const dlnp = Math.log(pGrid[i + 1] / pGrid[i]); // negative when going up
    const bMid = 0.5 * (B[i] + B[i + 1]);
    const dE = -Rd * bMid * dlnp; // J/kg  (positive if parcel warmer)
    const pMid = 0.5 * (pGrid[i] + pGrid[i + 1]);

    const pt = {
      p0: pGrid[i],
      p1: pGrid[i + 1],
      tP0: tParcel[i],
      tP1: tParcel[i + 1],
      tE0: tEnvironment[i],
      tE1: tEnvironment[i + 1],
      bMid,
    };

    if (pLfc != null && pEl != null && pMid <= pLfc && pMid >= pEl && bMid > 0) {
      cape += dE;
      capeBand.push(pt);
    }
    if ((pLfc == null || pMid >= pLfc) && bMid < 0) {
      cin += -dE;
      cinBand.push(pt);
    } else if (pLfc != null && pEl != null && pMid < pLfc && pMid >= pEl && bMid < 0) {
      // Stable pocket above the LFC: shade as CIN, do not add to the sfc→LFC integral.
      cinBand.push(pt);
    }
  }

  cape = Math.max(0, cape);
  cin = Math.max(0, cin);

  const parcelPath = pGrid.map((p, i) => ({
    p,
    t: tParcel[i],
    td: tdParcel[i],
    tEnv: tEnvironment[i],
    tdEnv: tdEnvironment[i],
    z: zGrid[i],
  }));

  return {
    pSfc,
    tSfc,
    tdSfc,
    wSfc,
    lcl: { p: pLcl, t: tLclC, z: zOf(pLcl) },
    lfc: pLfc == null ? null : { p: pLfc, t: interpLogP(pLfc, pGrid, tParcel), z: zOf(pLfc) },
    el: pEl == null ? null : { p: pEl, t: interpLogP(pEl, pGrid, tParcel), z: zOf(pEl) },
    cape,
    cin,
    category: capeCategory(cape),
    wmax: Math.sqrt(2 * cape), // m/s, undilute theoretical cap
    parcelPath,
    capeBand: splitContiguousBands(capeBand),
    cinBand: splitContiguousBands(cinBand),
    pGrid,
    tParcel,
    tEnvironment,
    B,
  };
}

/** Wet-bulb potential temperature is not needed; this traces a moist adiabat
 *  that passes through (tC, pHpa), used only to draw background lines. */
export function moistAdiabatFrom(tC, pHpa, pTargets) {
  return moistAdiabatProfile(cToK(tC), pHpa, pTargets);
}
