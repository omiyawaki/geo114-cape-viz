/**
 * Skew-T log-P renderer. Environment traces stay fixed; the parcel path and
 * CAPE/CIN fills update when surface T / Td change.
 *
 * Coordinates: horizontal isotherms are skewed ~45° (up and to the right).
 * The geometric fill is the textbook picture of CAPE; the J/kg number is the
 * virtual-temperature integral in thermo.js, not the pixel area.
 */

import {
  dewpointFromMixingRatio,
  dryAdiabatT,
  moistAdiabatFrom,
  cToK,
  kToC,
} from "./thermo.js";

const P_BOT = 1050;
const P_TOP = 100;
const T_MIN = -40;
const T_MAX = 48;
const SKEW = 0.92; // 1 = 45° in pixel space

const P_MOIST = [];
for (let p = 1000; p >= P_TOP; p -= 10) P_MOIST.push(p);
const MOIST_BG = [];
for (let tw = -20; tw <= 32; tw += 4) {
  MOIST_BG.push({ tw, p: P_MOIST, t: moistAdiabatFrom(tw, 1000, P_MOIST) });
}

const COLORS = {
  paper: "#f3eee3",
  frame: "#2a2520",
  isobar: "rgba(40, 36, 32, 0.22)",
  isotherm: "rgba(70, 110, 170, 0.28)",
  dry: "rgba(170, 90, 40, 0.28)",
  moist: "rgba(20, 120, 100, 0.28)",
  mixr: "rgba(30, 130, 70, 0.38)",
  temp: "#c0392b",
  dew: "#1b7a45",
  parcel: "#1a1410",
  cape: "rgba(214, 96, 32, 0.38)",
  capeStroke: "rgba(180, 70, 18, 0.55)",
  cin: "rgba(46, 90, 170, 0.32)",
  cinStroke: "rgba(30, 70, 150, 0.5)",
  label: "#3a342c",
  muted: "rgba(40, 36, 32, 0.55)",
  lcl: "#6b3fa0",
  lfc: "#c0392b",
  el: "#1f5f8a",
};

function layout(w, h) {
  const padL = 52;
  const padR = 18;
  const padT = 18;
  const padB = 44;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  return {
    w,
    h,
    padL,
    padR,
    padT,
    padB,
    plotW,
    plotH,
    skew: plotW < 480 ? 0.52 : SKEW,
  };
}

function yOfP(p, L) {
  const ln = Math.log;
  return L.padT + ((ln(p) - ln(P_TOP)) / (ln(P_BOT) - ln(P_TOP))) * L.plotH;
}

function xOfTP(tC, p, L) {
  const y = yOfP(p, L);
  const yBot = yOfP(P_BOT, L);
  const tFrac = (tC - T_MIN) / (T_MAX - T_MIN);
  return L.padL + tFrac * L.plotW + L.skew * (yBot - y);
}

function pOfY(y, L) {
  const lnTop = Math.log(P_TOP);
  const lnBot = Math.log(P_BOT);
  const f = (y - L.padT) / L.plotH;
  return Math.exp(lnTop + f * (lnBot - lnTop));
}

function tOfXP(x, p, L) {
  const y = yOfP(p, L);
  const yBot = yOfP(P_BOT, L);
  const xUnskew = x - L.skew * (yBot - y);
  return T_MIN + ((xUnskew - L.padL) / L.plotW) * (T_MAX - T_MIN);
}

function clipPlot(ctx, L) {
  ctx.beginPath();
  ctx.rect(L.padL, L.padT, L.plotW, L.plotH);
  ctx.clip();
}

function lineAtP(ctx, pArr, tArr, L, color, width, dash) {
  ctx.save();
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash || []);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  let started = false;
  const n = Math.min(pArr.length, tArr.length);
  for (let i = 0; i < n; i++) {
    const t = tArr[i];
    const p = pArr[i];
    if (!Number.isFinite(t) || !Number.isFinite(p)) {
      started = false;
      continue;
    }
    const x = xOfTP(t, p, L);
    const y = yOfP(p, L);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

function fillBand(ctx, band, L, fill, stroke) {
  if (!band.length) return;
  ctx.save();
  ctx.beginPath();
  const first = band[0];
  ctx.moveTo(xOfTP(first.tP0, first.p0, L), yOfP(first.p0, L));
  for (const s of band) {
    ctx.lineTo(xOfTP(s.tP1, s.p1, L), yOfP(s.p1, L));
  }
  for (let i = band.length - 1; i >= 0; i--) {
    const s = band[i];
    ctx.lineTo(xOfTP(s.tE1, s.p1, L), yOfP(s.p1, L));
  }
  ctx.lineTo(xOfTP(first.tE0, first.p0, L), yOfP(first.p0, L));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }
  ctx.restore();
}

function drawGrid(ctx, L) {
  ctx.save();
  clipPlot(ctx, L);

  // Isotherms every 10 °C, skewed.
  ctx.lineWidth = 1;
  for (let t = -90; t <= 50; t += 10) {
    ctx.beginPath();
    ctx.strokeStyle = t === 0 ? "rgba(70, 110, 170, 0.55)" : COLORS.isotherm;
    ctx.lineWidth = t === 0 ? 1.4 : 1;
    const p0 = P_BOT;
    const p1 = P_TOP;
    ctx.moveTo(xOfTP(t, p0, L), yOfP(p0, L));
    ctx.lineTo(xOfTP(t, p1, L), yOfP(p1, L));
    ctx.stroke();
  }

  // Dry adiabats (θ).
  const pDry = [];
  for (let p = P_BOT; p >= P_TOP; p -= 10) pDry.push(p);
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = COLORS.dry;
  ctx.lineWidth = 1;
  for (let thetaC = -20; thetaC <= 120; thetaC += 10) {
    ctx.beginPath();
    let started = false;
    for (const p of pDry) {
      const t = kToC(dryAdiabatT(cToK(thetaC), 1000, p));
      if (t < -90 || t > 55) continue;
      const x = xOfTP(t, p, L);
      const y = yOfP(p, L);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Moist adiabats (precomputed once — RK4 is too slow to redo on every slider tick).
  ctx.setLineDash([3, 6]);
  ctx.strokeStyle = COLORS.moist;
  for (const line of MOIST_BG) {
    ctx.beginPath();
    ctx.moveTo(xOfTP(line.tw, 1000, L), yOfP(1000, L));
    for (let i = 0; i < line.p.length; i++) {
      ctx.lineTo(xOfTP(line.t[i], line.p[i], L), yOfP(line.p[i], L));
    }
    ctx.stroke();
  }

  // Mixing-ratio lines (g/kg), surface to ~400 hPa.
  ctx.setLineDash([1, 4]);
  ctx.strokeStyle = COLORS.mixr;
  const mixVals = [0.4, 1, 2, 3, 5, 8, 12, 16, 20, 24, 32];
  const pMix = [];
  for (let p = P_BOT; p >= 400; p -= 10) pMix.push(p);
  for (const gkg of mixVals) {
    const w = gkg / 1000;
    ctx.beginPath();
    let started = false;
    for (const p of pMix) {
      const td = dewpointFromMixingRatio(w, p);
      if (!Number.isFinite(td) || td < -40) continue;
      const x = xOfTP(td, p, L);
      const y = yOfP(p, L);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  ctx.restore();

  // Mixing-ratio labels (g/kg) near 700 hPa — skip when the plot is too narrow.
  if (L.plotW >= 480) {
    ctx.save();
    ctx.font = "10px ui-sans-serif, system-ui, sans-serif";
    ctx.fillStyle = "rgba(27, 122, 69, 0.75)";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    for (const gkg of [2, 5, 8, 12, 16, 20, 24]) {
      const td = dewpointFromMixingRatio(gkg / 1000, 700);
      const x = xOfTP(td, 700, L);
      const y = yOfP(700, L);
      if (x > L.padL && x < L.padL + L.plotW - 20) ctx.fillText(`${gkg}`, x + 2, y - 2);
    }
    ctx.restore();
  }

  // Isobars (drawn unclipped so labels sit in the left margin).
  const isobars = [1000, 850, 700, 500, 400, 300, 250, 200, 150, 100];
  ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (const p of isobars) {
    const y = yOfP(p, L);
    ctx.beginPath();
    ctx.strokeStyle = p === 500 || p === 1000 ? "rgba(40,36,32,0.45)" : COLORS.isobar;
    ctx.lineWidth = p === 500 || p === 1000 ? 1.3 : 1;
    ctx.setLineDash([]);
    ctx.moveTo(L.padL, y);
    ctx.lineTo(L.padL + L.plotW, y);
    ctx.stroke();
    ctx.fillStyle = COLORS.label;
    ctx.fillText(String(p), L.padL - 8, y);
  }

  // Temperature labels along the 1050 hPa isobar.
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = COLORS.label;
  for (let t = -30; t <= 40; t += 10) {
    const x = xOfTP(t, P_BOT, L);
    if (x < L.padL || x > L.padL + L.plotW) continue;
    ctx.fillText(`${t}°`, x, L.padT + L.plotH + 8);
  }

  ctx.save();
  ctx.translate(16, L.padT + L.plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = COLORS.muted;
  ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("pressure (hPa, log scale)", 0, 0);
  ctx.restore();

  ctx.textAlign = "center";
  ctx.fillStyle = COLORS.muted;
  ctx.fillText("temperature (°C), isotherms skewed", L.padL + L.plotW / 2, L.h - 12);
}

function marker(ctx, p, t, L, color, label, side, dy = 0) {
  if (p == null || !Number.isFinite(p) || !Number.isFinite(t)) return;
  const x = xOfTP(t, p, L);
  const y = yOfP(p, L) + dy;
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, yOfP(p, L), 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = "bold 11px ui-sans-serif, system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = side === "left" ? "right" : "left";
  const tx = side === "left" ? x - 8 : Math.min(x + 8, L.padL + L.plotW - 6);
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(243, 238, 227, 0.92)";
  ctx.strokeText(label, tx, y);
  ctx.fillStyle = color;
  ctx.fillText(label, tx, y);
  ctx.restore();
}

export function drawSkewT(canvas, { sounding, parcel, showCapeFill = true }) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(320, rect.width);
  const h = Math.max(420, rect.height);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const L = layout(w, h);
  canvas._skewt = { L };

  ctx.fillStyle = COLORS.paper;
  ctx.fillRect(0, 0, w, h);

  drawGrid(ctx, L);

  ctx.save();
  clipPlot(ctx, L);

  if (showCapeFill && parcel) {
    fillBand(ctx, parcel.cinBand, L, COLORS.cin, COLORS.cinStroke);
    fillBand(ctx, parcel.capeBand, L, COLORS.cape, COLORS.capeStroke);
  }

  const envP = [];
  const envT = [];
  const envTd = [];
  for (const lv of sounding.levels) {
    if (lv.p < P_TOP - 5 || lv.p > P_BOT) continue;
    if (Number.isFinite(lv.t)) {
      envP.push(lv.p);
      envT.push(lv.t);
      envTd.push(lv.td);
    }
  }
  lineAtP(ctx, envP, envTd, L, COLORS.dew, 2.4, []);
  lineAtP(ctx, envP, envT, L, COLORS.temp, 2.6, []);

  if (parcel) {
    const pp = parcel.parcelPath;
    lineAtP(
      ctx,
      pp.map((d) => d.p),
      pp.map((d) => d.t),
      L,
      COLORS.parcel,
      2.2,
      [6, 4]
    );
    // Mixing-ratio construction from surface Td to LCL.
    const mixP = [];
    const mixT = [];
    for (const d of pp) {
      if (d.p < parcel.lcl.p) break;
      mixP.push(d.p);
      mixT.push(d.td);
    }
    lineAtP(ctx, mixP, mixT, L, "rgba(27,122,69,0.85)", 1.5, [2, 3]);
  }

  ctx.restore();

  // Frame
  ctx.strokeStyle = COLORS.frame;
  ctx.lineWidth = 1.4;
  ctx.strokeRect(L.padL, L.padT, L.plotW, L.plotH);

  if (parcel) {
    const closeLfc =
      parcel.lfc && Math.abs(parcel.lfc.p - parcel.lcl.p) < 25;
    if (closeLfc) {
      marker(ctx, parcel.lcl.p, parcel.lcl.t, L, COLORS.lfc, "LCL ≈ LFC", "right", 0);
    } else {
      marker(ctx, parcel.lcl.p, parcel.lcl.t, L, COLORS.lcl, "LCL", "left", 0);
      if (parcel.lfc) marker(ctx, parcel.lfc.p, parcel.lfc.t, L, COLORS.lfc, "LFC", "right", 0);
    }
    if (parcel.el) marker(ctx, parcel.el.p, parcel.el.t, L, COLORS.el, "EL", "right", 0);
  }

  return L;
}

export function readoutAt(canvas, clientX, clientY) {
  const L = canvas._skewt && canvas._skewt.L;
  if (!L) return null;
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  if (x < L.padL || x > L.padL + L.plotW || y < L.padT || y > L.padT + L.plotH) return null;
  const p = pOfY(y, L);
  const t = tOfXP(x, p, L);
  return { p, t };
}

export { COLORS };
