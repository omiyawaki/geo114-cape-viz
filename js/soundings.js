/**
 * Built-in soundings, University of Wyoming TEXT:LIST parser, and optional fetch.
 *
 * Paste is the supported classroom path. Browser fetch of weather.uwyo.edu is
 * attempted but usually blocked by CORS; the UI then offers a copy-the-text fallback.
 */

const MISSING = new Set(["", "99999", "9999.0", "999.0", "-999", "-9999"]);

function isMissing(tok) {
  if (tok == null) return true;
  const s = String(tok).trim();
  if (MISSING.has(s)) return true;
  const n = Number(s);
  return !Number.isFinite(n);
}

function num(tok) {
  if (isMissing(tok)) return null;
  return Number(tok);
}

/**
 * Parse University of Wyoming "Text: List" sounding output (and close variants).
 * Returns { header, station, wmo, time, levels: [{p,z,t,td,dir,spd}], raw }.
 */
export function parseUwyoText(text) {
  if (!text || !String(text).trim()) {
    throw new Error("Paste is empty.");
  }
  const raw = String(text).replace(/\r\n/g, "\n");
  const lines = raw.split("\n");

  let header = "";
  for (const line of lines) {
    if (/observations at/i.test(line) || /\b\d{5}\s+[A-Z]{3,4}\b/.test(line)) {
      header = line.replace(/<[^>]+>/g, "").trim();
      break;
    }
  }
  if (!header) {
    const first = lines.find((l) => l.trim() && !l.includes("---") && !/^\s*PRES/i.test(l));
    header = first ? first.trim() : "Pasted sounding";
  }

  const stationMatch = header.match(/\b([A-Z]{3,4})\b/);
  const wmoMatch = header.match(/\b(\d{5})\b/);
  const timeMatch = header.match(/(\d{1,2}Z\s+\d{1,2}\s+\w+\s+\d{4})/i);

  const levels = [];
  let inTable = false;
  let sawHeader = false;

  for (const line0 of lines) {
    const line = line0.replace(/<[^>]+>/g, "");
    if (/^\s*-{5,}/.test(line)) {
      inTable = true;
      continue;
    }
    if (/station information/i.test(line) || /station identifier/i.test(line)) {
      break;
    }
    if (/^\s*PRES\b/i.test(line)) {
      sawHeader = true;
      inTable = true;
      continue;
    }
    if (/^\s*hPa\b/i.test(line)) continue;
    if (!inTable && !sawHeader) continue;

    const trimmed = line.trim();
    if (!trimmed) {
      if (levels.length) break;
      continue;
    }
    // Data rows start with a pressure-like number.
    if (!/^[\d.]+/.test(trimmed)) {
      if (levels.length) break;
      continue;
    }
    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) continue;
    const p = num(parts[0]);
    if (p == null || p < 1 || p > 1100) continue;
    const z = parts.length > 1 ? num(parts[1]) : null;
    const t = parts.length > 2 ? num(parts[2]) : null;
    const td = parts.length > 3 ? num(parts[3]) : null;
    // Skip the 1000 hPa placeholder row that has no T.
    if (t == null && td == null) continue;
    const dir = parts.length > 6 ? num(parts[6]) : null;
    const spd = parts.length > 7 ? num(parts[7]) : null;
    levels.push({ p, z, t, td, dir, spd });
  }

  // Pressure should decrease with height. Sort just in case.
  levels.sort((a, b) => b.p - a.p);

  const withT = levels.filter((lv) => Number.isFinite(lv.t));
  if (withT.length < 6) {
    throw new Error(
      "Could not find a UWYO temperature profile. Need a Text:List table with PRES, TEMP, DWPT columns."
    );
  }

  return {
    header,
    station: stationMatch ? stationMatch[1] : "",
    wmo: wmoMatch ? wmoMatch[1] : "",
    time: timeMatch ? timeMatch[1] : "",
    levels: withT,
    raw,
    source: "paste",
  };
}

/** Common teaching / CONUS WMO ids. Keys are uppercase call signs. */
export const STATIONS = {
  ALB: { wmo: "72518", name: "Albany, NY" },
  OKX: { wmo: "72501", name: "Upton / NYC, NY" },
  BUF: { wmo: "72528", name: "Buffalo, NY" },
  OUN: { wmo: "72357", name: "Norman, OK" },
  TOP: { wmo: "72456", name: "Topeka, KS" },
  DDC: { wmo: "72451", name: "Dodge City, KS" },
  AMA: { wmo: "72363", name: "Amarillo, TX" },
  FWD: { wmo: "72249", name: "Fort Worth, TX" },
  DNR: { wmo: "72469", name: "Denver, CO" },
  SGF: { wmo: "72440", name: "Springfield, MO" },
  ILX: { wmo: "74560", name: "Lincoln, IL" },
  CHH: { wmo: "74494", name: "Chatham, MA" },
  GYX: { wmo: "74389", name: "Gray, ME" },
  IAD: { wmo: "72403", name: "Sterling, VA" },
  WAL: { wmo: "72402", name: "Wallops Island, VA" },
  CHS: { wmo: "72208", name: "Charleston, SC" },
  JAX: { wmo: "72206", name: "Jacksonville, FL" },
  TBW: { wmo: "72210", name: "Tampa Bay, FL" },
  MFL: { wmo: "72202", name: "Miami, FL" },
  JAN: { wmo: "72235", name: "Jackson, MS" },
  BMX: { wmo: "72230", name: "Birmingham, AL" },
  LZK: { wmo: "72340", name: "Little Rock, AR" },
  OAX: { wmo: "72558", name: "Omaha, NE" },
  MPX: { wmo: "72649", name: "Minneapolis, MN" },
  DVN: { wmo: "74455", name: "Davenport, IA" },
  ILN: { wmo: "72426", name: "Wilmington, OH" },
  APX: { wmo: "72632", name: "Gaylord, MI" },
  GRB: { wmo: "72645", name: "Green Bay, WI" },
  RAP: { wmo: "72662", name: "Rapid City, SD" },
  BIS: { wmo: "72764", name: "Bismarck, ND" },
  TFX: { wmo: "72776", name: "Great Falls, MT" },
  BOI: { wmo: "72681", name: "Boise, ID" },
  SLC: { wmo: "72572", name: "Salt Lake City, UT" },
  FGZ: { wmo: "72376", name: "Flagstaff, AZ" },
  TUS: { wmo: "72274", name: "Tucson, AZ" },
  ABQ: { wmo: "72365", name: "Albuquerque, NM" },
  EPZ: { wmo: "72364", name: "Santa Teresa, NM" },
  MAF: { wmo: "72265", name: "Midland, TX" },
  BRO: { wmo: "72250", name: "Brownsville, TX" },
  CRP: { wmo: "72251", name: "Corpus Christi, TX" },
  LCH: { wmo: "72240", name: "Lake Charles, LA" },
  LIX: { wmo: "72233", name: "Slidell, LA" },
  FFC: { wmo: "72215", name: "Peachtree City, GA" },
  RNK: { wmo: "72318", name: "Blacksburg, VA" },
  PIT: { wmo: "72520", name: "Pittsburgh, PA" },
  CAR: { wmo: "72712", name: "Caribou, ME" },
};

export function resolveStation(input) {
  const s = String(input || "").trim().toUpperCase();
  if (/^\d{5}$/.test(s)) return s;
  if (STATIONS[s]) return STATIONS[s].wmo;
  throw new Error("Use a 5-digit WMO id (e.g. 72518) or a known call sign (ALB, OUN, …).");
}

export function uwyoUrl({ year, month, day, hour, wmo }) {
  const yyyy = String(year).padStart(4, "0");
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const hh = String(hour).padStart(2, "0");
  const from = `${dd}${hh}`;
  const params = new URLSearchParams({
    region: "naconf",
    TYPE: "TEXT:LIST",
    YEAR: yyyy,
    MONTH: mm,
    FROM: from,
    TO: from,
    STNM: wmo,
  });
  return `https://weather.uwyo.edu/cgi-bin/sounding?${params.toString()}`;
}

/**
 * Try to fetch a UWYO sounding. Resolves with a parsed sounding, or throws
 * with { cors: true, url } when the browser blocks the request.
 */
export async function fetchUwyo(opts) {
  const wmo = resolveStation(opts.station);
  const url = uwyoUrl({ ...opts, wmo });
  let res;
  try {
    res = await fetch(url, { mode: "cors" });
  } catch (err) {
    const e = new Error(
      "Browser blocked the request (CORS). Open the Wyoming page and paste the text instead."
    );
    e.cors = true;
    e.url = url;
    e.cause = err;
    throw e;
  }
  if (!res.ok) {
    const e = new Error(`Wyoming archive returned HTTP ${res.status}. Try paste, or check station/date/hour.`);
    e.url = url;
    throw e;
  }
  const text = await res.text();
  if (/can't get/i.test(text) || /not available/i.test(text) || !/\bPRES\b/.test(text)) {
    const e = new Error("No sounding at that station/time in the Wyoming archive. Try another hour or paste text.");
    e.url = url;
    throw e;
  }
  const parsed = parseUwyoText(text);
  parsed.source = "fetch";
  parsed.url = url;
  parsed.wmo = parsed.wmo || wmo;
  return parsed;
}

function fromTable(header, rows, extra = {}) {
  const levels = rows
    .map(([p, z, t, td, dir, spd]) => ({ p, z, t, td, dir, spd }))
    .filter((lv) => Number.isFinite(lv.p) && Number.isFinite(lv.t));
  const stationMatch = header.match(/\b([A-Z]{3,4})\b/);
  const wmoMatch = header.match(/\b(\d{5})\b/);
  const timeMatch = header.match(/(\d{1,2}Z\s+\d{1,2}\s+\w+\s+\d{4})/i);
  return {
    header,
    station: stationMatch ? stationMatch[1] : "",
    wmo: wmoMatch ? wmoMatch[1] : "",
    time: timeMatch ? timeMatch[1] : "",
    levels,
    source: "builtin",
    ...extra,
  };
}

/* -------------------------------------------------------------------------- */
/* Built-in example: high-CAPE Great Plains (preloaded).                       */
/* 72357 OUN Norman, 18Z 24 May 2011. UWYO SBCAPE ~2885 J/kg (virtual ~3111). */
/* Source: University of Wyoming TEXT:LIST via MetEd all-star sounding set.   */
/* -------------------------------------------------------------------------- */
const OUN_18Z_ROWS = [
  [964.0, 345, 25.8, 21.2, 160, 11],
  [953.0, 447, 24.2, 20.8, 162, 14],
  [935.5, 610, 22.6, 20.9, 165, 19],
  [925.0, 710, 21.6, 20.9, 165, 19],
  [910.0, 852, 20.4, 20.4, 172, 21],
  [903.5, 914, 20.0, 20.0, 175, 22],
  [872.1, 1219, 18.3, 17.8, 190, 30],
  [850.0, 1440, 17.0, 16.2, 200, 31],
  [849.0, 1450, 17.0, 16.1, 200, 31],
  [839.0, 1551, 16.0, 14.6, 204, 31],
  [837.0, 1572, 15.8, 13.5, 205, 31],
  [832.0, 1623, 15.2, 6.2, 207, 31],
  [829.0, 1653, 15.0, 4.0, 208, 31],
  [827.0, 1674, 16.0, 4.0, 209, 31],
  [821.0, 1736, 20.2, 7.2, 211, 31],
  [819.0, 1757, 21.0, 7.0, 212, 31],
  [812.2, 1829, 20.6, 5.1, 215, 31],
  [787.0, 2100, 19.0, -2.0, 206, 34],
  [783.9, 2134, 18.7, -2.3, 205, 34],
  [756.2, 2438, 16.1, -4.9, 205, 38],
  [729.4, 2743, 13.6, -7.5, 205, 37],
  [700.0, 3090, 10.6, -10.4, 205, 37],
  [659.0, 3588, 6.2, -13.8, 205, 34],
  [653.4, 3658, 5.7, -14.1, 205, 34],
  [609.0, 4229, 1.4, -16.6, 224, 35],
  [606.1, 4267, 1.3, -17.0, 225, 35],
  [598.0, 4375, 1.0, -18.0, 227, 36],
  [561.1, 4877, -3.5, -21.7, 235, 40],
  [519.3, 5486, -9.0, -26.1, 215, 39],
  [514.0, 5567, -9.7, -26.7, 218, 40],
  [500.0, 5780, -11.1, -27.1, 225, 43],
  [479.7, 6096, -13.6, -29.6, 225, 50],
  [474.0, 6188, -14.3, -30.3, 225, 50],
  [468.0, 6285, -14.1, -30.1, 226, 50],
  [430.0, 6923, -17.9, -35.9, 228, 48],
  [400.0, 7460, -22.3, -40.3, 230, 47],
  [391.2, 7620, -23.7, -41.5, 230, 48],
  [375.0, 7925, -26.3, -43.9, 235, 46],
  [342.0, 8588, -32.1, -49.1, 243, 55],
  [315.8, 9144, -36.4, -52.8, 250, 63],
  [300.0, 9500, -39.1, -55.1, 255, 70],
  [289.0, 9754, -41.2, -56.0, 255, 74],
  [282.0, 9919, -42.5, -56.5, 255, 75],
  [261.0, 10435, -45.9, -59.9, 255, 78],
  [250.0, 10720, -46.9, -60.9, 255, 79],
  [221.0, 11528, -50.8, -63.6, 260, 83],
  [219.2, 11582, -51.1, -63.8, 260, 83],
  [203.0, 12084, -53.5, -65.5, 256, 76],
  [200.0, 12180, -54.3, -66.3, 255, 75],
  [187.0, 12608, -57.3, -68.3, 258, 72],
  [181.3, 12802, -58.0, -69.0, 260, 70],
  [169.0, 13245, -59.7, -70.7, 255, 53],
  [159.0, 13627, -59.5, -70.5, 251, 38],
  [156.7, 13716, -60.0, -71.0, 250, 34],
  [150.0, 13990, -61.5, -72.5, 245, 33],
  [147.0, 14115, -62.5, -72.5, 245, 32],
  [138.0, 14503, -63.1, -73.1, 245, 30],
  [136.0, 14592, -62.3, -72.3, 245, 29],
  [132.0, 14776, -63.7, -73.7, 245, 28],
  [127.0, 15011, -64.3, -74.3, 245, 26],
  [123.0, 15207, -62.7, -72.7, 245, 25],
  [122.3, 15240, -62.9, -72.9, 245, 25],
  [115.0, 15618, -65.5, -75.5, 242, 24],
  [102.0, 16341, -67.9, -77.9, 235, 21],
  [100.0, 16460, -67.3, -77.3, 235, 27],
  [70.0, 18620, -65.7, -75.7, 215, 1],
  [50.0, 20670, -62.5, -73.5, 290, 1],
];

/* Same day, 12Z: elevated mixed layer / cap. UWYO CAPE ~1812, CIN ~-313. */
const OUN_12Z_ROWS = [
  [965.0, 345, 21.8, 19.5, 155, 10],
  [952.0, 463, 21.8, 20.0, 157, 22],
  [936.0, 610, 20.7, 19.6, 160, 36],
  [925.0, 712, 20.0, 19.3, 165, 43],
  [917.0, 787, 19.4, 18.9, 169, 44],
  [903.6, 914, 19.3, 18.7, 175, 45],
  [879.0, 1153, 19.0, 18.2, 191, 42],
  [872.2, 1219, 18.5, 17.8, 195, 41],
  [852.0, 1421, 16.8, 16.4, 209, 38],
  [850.0, 1441, 16.8, 16.3, 210, 38],
  [844.0, 1502, 17.4, 15.3, 216, 35],
  [832.0, 1625, 20.0, 11.0, 229, 30],
  [828.0, 1667, 21.2, 6.2, 233, 29],
  [822.0, 1730, 22.0, 3.0, 240, 26],
  [812.6, 1829, 22.0, 0.1, 250, 22],
  [809.0, 1868, 22.0, -1.0, 251, 22],
  [784.1, 2134, 19.7, -2.9, 255, 22],
  [756.6, 2438, 17.1, -5.0, 250, 23],
  [729.9, 2743, 14.5, -7.1, 245, 23],
  [700.0, 3099, 11.4, -9.6, 240, 26],
  [680.0, 3340, 9.0, -11.0, 236, 25],
  [653.8, 3658, 6.0, -12.4, 230, 23],
  [606.4, 4267, 0.2, -15.0, 220, 23],
  [584.0, 4572, -2.7, -16.4, 210, 22],
  [575.0, 4697, -3.9, -16.9, 218, 25],
  [562.0, 4877, -4.9, -20.3, 230, 29],
  [559.0, 4920, -5.1, -21.1, 232, 30],
  [551.0, 5033, -4.7, -21.7, 238, 33],
  [540.6, 5182, -5.8, -22.8, 245, 36],
  [500.0, 5790, -10.3, -27.3, 255, 34],
  [481.0, 6087, -12.5, -28.5, 260, 32],
  [443.3, 6706, -16.2, -32.2, 260, 50],
  [440.0, 6762, -16.5, -32.5, 260, 50],
  [400.0, 7470, -22.7, -37.7, 260, 48],
  [391.8, 7620, -23.9, -39.0, 260, 46],
  [356.0, 8312, -29.7, -44.7, 260, 54],
  [328.0, 8890, -33.3, -48.3, 260, 60],
  [316.2, 9144, -35.3, -49.9, 260, 63],
  [300.0, 9510, -38.1, -52.1, 265, 68],
  [250.0, 10740, -47.9, -60.9, 265, 71],
  [233.0, 11200, -51.7, -63.7, 268, 73],
  [217.0, 11659, -53.3, -64.3, 271, 75],
  [200.0, 12180, -56.3, -67.3, 275, 77],
  [181.2, 12802, -60.2, -70.4, 275, 64],
  [174.0, 13054, -60.5, -70.5, 271, 67],
  [164.2, 13411, -62.6, -72.6, 265, 72],
  [160.0, 13573, -62.1, -72.1, 266, 69],
  [150.0, 13970, -63.9, -73.9, 270, 56],
  [141.6, 14326, -61.6, -71.6, 275, 45],
  [128.3, 14935, -60.7, -70.7, 295, 15],
  [122.2, 15240, -62.6, -72.6, 285, 15],
  [112.0, 15774, -63.5, -73.5, 261, 16],
  [100.0, 16460, -68.5, -77.5, 230, 18],
  [70.0, 18610, -66.9, -75.9, 220, 6],
  [50.0, 20650, -64.1, -74.1, 100, 11],
];

export const EXAMPLES = {
  highCape: fromTable(
    "72357 OUN Norman Observations at 18Z 24 May 2011",
    OUN_18Z_ROWS,
    {
      id: "highCape",
      title: "Norman, OK 18Z 24 May 2011",
      blurb:
        "Late-day Great Plains sounding. Warm, moist surface air under steep mid-level lapse rates. Orange area should be large; CIN almost gone.",
      uwyoCape: 2885,
      uwyoCins: 0,
    }
  ),
  capped: fromTable(
    "72357 OUN Norman Observations at 12Z 24 May 2011",
    OUN_12Z_ROWS,
    {
      id: "capped",
      title: "Norman, OK 12Z 24 May 2011",
      blurb:
        "Same day, 12Z. An elevated mixed layer (the cap) sits above a cool moist boundary layer. Heat the surface T and watch CIN shrink and CAPE grow.",
      uwyoCape: 1812,
      uwyoCins: 313,
    }
  ),
};

export const DEFAULT_EXAMPLE_ID = "highCape";

/** Reconstruct a paste-able UWYO-like listing from a parsed sounding. */
export function toUwyoText(sounding) {
  const lines = [
    sounding.header || "Sounding",
    "----------------------------------------------------------------------------- ",
    "   PRES   HGHT   TEMP   DWPT   RELH   MIXR   DRCT   SKNT   THTA   THTE   THTV",
    "    hPa     m      C      C      %    g/kg    deg   knot     K      K      K ",
    "----------------------------------------------------------------------------- ",
  ];
  for (const lv of sounding.levels) {
    const p = lv.p.toFixed(1).padStart(7);
    const z = String(Math.round(lv.z ?? 0)).padStart(7);
    const t = (lv.t ?? 0).toFixed(1).padStart(7);
    const td = (lv.td ?? 0).toFixed(1).padStart(7);
    const dir = String(lv.dir ?? "").padStart(7);
    const spd = String(lv.spd ?? "").padStart(7);
    lines.push(`${p}${z}${t}${td}                ${dir}${spd}`);
  }
  lines.push("Station information and sounding indices");
  return lines.join("\n");
}
