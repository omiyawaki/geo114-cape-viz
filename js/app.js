import { liftSurfaceParcel } from "./thermo.js";
import { drawSkewT, readoutAt } from "./skewt.js";
import {
  EXAMPLES,
  DEFAULT_EXAMPLE_ID,
  parseUwyoText,
  fetchUwyo,
  STATIONS,
  toUwyoText,
} from "./soundings.js";

const $ = (id) => document.getElementById(id);

const state = {
  sounding: EXAMPLES[DEFAULT_EXAMPLE_ID],
  exampleId: DEFAULT_EXAMPLE_ID,
  t: null,
  td: null,
  t0: null,
  td0: null,
  parcel: null,
  predictOn: true,
  revealed: false,
  predictMode: "initial", // initial | change
  lastCape: null,
};

const INITIAL_CHOICES = [
  { id: "weak", label: "Weak — small orange sliver, or almost none" },
  { id: "moderate", label: "Moderate — a clear orange area, not huge" },
  { id: "strong", label: "Strong / extreme — a fat orange area LFC to tropopause" },
];

const CHANGE_CHOICES = [
  { id: "grow", label: "The orange area will grow (more CAPE)" },
  { id: "shrink", label: "The orange area will shrink (less CAPE)" },
  { id: "same", label: "Little change — area looks about the same" },
];

function fmtP(p) {
  return Number.isFinite(p) ? `${p.toFixed(0)} hPa` : "—";
}
function fmtZ(z) {
  return Number.isFinite(z) ? `${Math.round(z)} m` : "";
}
function fmtCape(v) {
  if (!Number.isFinite(v)) return "0";
  return Math.round(v).toLocaleString("en-US");
}

function surfaceOf(sounding) {
  const lv = sounding.levels.find((d) => Number.isFinite(d.t) && Number.isFinite(d.td));
  if (!lv) throw new Error("Sounding has no surface T, Td.");
  return { t: lv.t, td: lv.td };
}

function setChoices(mode) {
  const box = $("predictChoices");
  const items = mode === "change" ? CHANGE_CHOICES : INITIAL_CHOICES;
  box.innerHTML = items
    .map(
      (c, i) =>
        `<label><input type="radio" name="pred" value="${c.id}" ${i === 0 ? "" : ""}/> ${c.label}</label>`
    )
    .join("");
  $("predictPrompt").textContent =
    mode === "change"
      ? "You moved the surface parcel. Before looking at the number: what happened to the orange area?"
      : "Look at the orange (CAPE) and blue (CIN) areas. Do not peek at the number yet. What kind of CAPE is this?";
  $("predictFeedback").textContent = "";
}

function selectedChoice() {
  const el = document.querySelector('input[name="pred"]:checked');
  return el ? el.value : null;
}

function categoryId(cape) {
  if (cape < 1000) return "weak";
  if (cape < 2500) return "moderate";
  return "strong";
}

function changeId(prev, next) {
  const d = next - prev;
  if (d > 150) return "grow";
  if (d < -150) return "shrink";
  return "same";
}

function scalePos(cape) {
  // 0, 1000, 2500, 4000 mapped across the bar
  const x = Math.max(0, Math.min(5000, cape));
  return `${(x / 5000) * 100}%`;
}

function applySounding(sounding, exampleId) {
  state.sounding = sounding;
  state.exampleId = exampleId || null;
  const s = surfaceOf(sounding);
  state.t0 = s.t;
  state.td0 = s.td;
  state.t = s.t;
  state.td = s.td;
  $("tSlider").value = s.t;
  $("tdSlider").value = Math.min(Number($("tdSlider").max), s.td);
  $("soundingTitle").textContent = sounding.title || sounding.header;
  $("soundingBlurb").textContent = sounding.blurb || sounding.header;
  $("btnHighCape").classList.toggle("active", exampleId === "highCape");
  $("btnCapped").classList.toggle("active", exampleId === "capped");
  state.lastCape = null;
  state.predictMode = "initial";
  state.revealed = !state.predictOn;
  setChoices("initial");
  recompute();
}

function recompute() {
  state.td = Math.min(state.td, state.t);
  $("tdSlider").max = String(Math.min(32, state.t));
  $("tSlider").value = state.t;
  $("tdSlider").value = state.td;
  $("tOut").textContent = `${state.t.toFixed(1)} °C`;
  $("tdOut").textContent = `${state.td.toFixed(1)} °C`;

  state.parcel = liftSurfaceParcel(state.sounding, state.t, state.td);
  draw();
  renderMetrics();
}

function draw() {
  drawSkewT($("skewt"), {
    sounding: state.sounding,
    parcel: state.parcel,
    showCapeFill: true,
  });
}

function renderMetrics() {
  const p = state.parcel;
  const hide = state.predictOn && !state.revealed;
  $("predictCard").style.display = state.predictOn ? "" : "none";
  $("revealBtn").disabled = hide ? false : true;

  if (hide) {
    $("capeVal").textContent = "???";
    $("capeVal").classList.add("hidden-val");
    $("cinVal").textContent = "???";
    $("cinVal").classList.add("hidden-val");
    $("capeCat").textContent = "hidden until you predict";
    $("wmaxVal").textContent = "theoretical max updraft hidden";
    $("scalePointer").style.left = "0%";
    $("scalePointer").style.opacity = "0.25";
  } else {
    $("capeVal").classList.remove("hidden-val");
    $("cinVal").classList.remove("hidden-val");
    $("capeVal").textContent = `${fmtCape(p.cape)} J/kg`;
    $("cinVal").textContent = `${fmtCape(p.cin)} J/kg`;
    $("capeCat").textContent = `${p.category.label} instability`;
    $("wmaxVal").textContent = `√(2 CAPE) ≈ ${p.wmax.toFixed(0)} m/s  (undilute, no water loading)`;
    $("scalePointer").style.left = scalePos(p.cape);
    $("scalePointer").style.opacity = "1";
  }

  $("lclVal").textContent = `${fmtP(p.lcl.p)} · ${p.lcl.t.toFixed(1)} °C · ${fmtZ(p.lcl.z)}`;
  $("lfcVal").textContent = p.lfc ? `${fmtP(p.lfc.p)} · ${fmtZ(p.lfc.z)}` : "none (parcel never free)";
  $("elVal").textContent = p.el ? `${fmtP(p.el.p)} · ${fmtZ(p.el.z)}` : "—";
}

function bumpT(dt) {
  const next = Math.max(5, Math.min(42, state.t + dt));
  onParcelEdit(next, state.td);
}
function bumpTd(dt) {
  const next = Math.max(-5, Math.min(state.t, state.td + dt));
  onParcelEdit(state.t, next);
}

function onParcelEdit(t, td) {
  const prevCape = state.parcel ? state.parcel.cape : null;
  if (state.predictOn && state.revealed && prevCape != null) {
    state.lastCape = prevCape;
    state.revealed = false;
    state.predictMode = "change";
    setChoices("change");
  }
  state.t = t;
  state.td = Math.min(td, t);
  recompute();
}

function reveal() {
  const choice = selectedChoice();
  const p = state.parcel;
  let msg = "";
  if (!choice) {
    $("predictFeedback").textContent = "Pick an option first — the point is to commit before the number.";
    $("predictFeedback").className = "status error";
    return;
  }
  if (state.predictMode === "initial") {
    const actual = categoryId(p.cape);
    const ok = choice === actual || (choice === "strong" && actual === "strong");
    msg = ok
      ? `Matches the picture: ${fmtCape(p.cape)} J/kg is ${p.category.label} CAPE. The orange area was the evidence.`
      : `The orange area sizes to ${fmtCape(p.cape)} J/kg (${p.category.label}). Use the area, not a guess about the weather headline.`;
  } else {
    const actual = changeId(state.lastCape ?? p.cape, p.cape);
    const d = p.cape - (state.lastCape ?? p.cape);
    const delta = `${d >= 0 ? "+" : ""}${Math.round(d)} J/kg`;
    const ok = choice === actual;
    msg = ok
      ? `Yes. CAPE ${fmtCape(state.lastCape)} → ${fmtCape(p.cape)} (${delta}).`
      : `CAPE went ${fmtCape(state.lastCape)} → ${fmtCape(p.cape)} (${delta}). Watch the orange fill, not the slider labels.`;
  }
  state.revealed = true;
  $("predictFeedback").textContent = msg;
  $("predictFeedback").className = "status ok";
  renderMetrics();
}

function status(el, text, kind) {
  el.textContent = text;
  el.className = "status" + (kind ? " " + kind : "");
}

function loadFromText(text, label) {
  try {
    const sounding = parseUwyoText(text);
    sounding.title = sounding.header;
    sounding.blurb = label || "Pasted University of Wyoming Text:List sounding. Environment locked; sliders move the surface parcel.";
    applySounding(sounding, null);
    status($("loadStatus"), `Loaded ${sounding.levels.length} levels from “${sounding.header}”.`, "ok");
    $("loadBox").open = true;
  } catch (err) {
    status($("loadStatus"), err.message, "error");
  }
}

function fillStationList() {
  const dl = $("stnList");
  dl.innerHTML = Object.entries(STATIONS)
    .map(([id, s]) => `<option value="${id}">${s.wmo} ${s.name}</option>`)
    .join("");
}

function parseDate(value) {
  const [y, m, d] = value.split("-").map(Number);
  return { year: y, month: m, day: d };
}

async function onFetch() {
  const stn = $("stnInput").value;
  const hour = $("hourInput").value;
  const { year, month, day } = parseDate($("dateInput").value);
  status($("loadStatus"), "Requesting weather.uwyo.edu …", "");
  try {
    const sounding = await fetchUwyo({ station: stn, year, month, day, hour });
    sounding.title = sounding.header;
    sounding.blurb = "Fetched from the University of Wyoming archive. Environment locked.";
    applySounding(sounding, null);
    status($("loadStatus"), `Loaded ${sounding.levels.length} levels.`, "ok");
  } catch (err) {
    if (err.cors && err.url) {
      status(
        $("loadStatus"),
        `CORS blocked the Wyoming server (expected in most browsers). Open this URL, copy the whole Text:List page, and paste it above: ${err.url}`,
        "error"
      );
      window.open(err.url, "_blank", "noopener");
      return;
    }
    const extra = err.url ? ` URL: ${err.url}` : "";
    status($("loadStatus"), err.message + extra, "error");
    if (err.url) window.open(err.url, "_blank", "noopener");
  }
}

function bind() {
  $("tSlider").addEventListener("input", (e) => onParcelEdit(Number(e.target.value), state.td));
  $("tdSlider").addEventListener("input", (e) => onParcelEdit(state.t, Number(e.target.value)));
  $("tUp").addEventListener("click", () => bumpT(0.5));
  $("tDown").addEventListener("click", () => bumpT(-0.5));
  $("tdUp").addEventListener("click", () => bumpTd(0.5));
  $("tdDown").addEventListener("click", () => bumpTd(-0.5));

  $("btnHighCape").addEventListener("click", () => applySounding(EXAMPLES.highCape, "highCape"));
  $("btnCapped").addEventListener("click", () => applySounding(EXAMPLES.capped, "capped"));
  $("btnResetParcel").addEventListener("click", () => {
    onParcelEdit(state.t0, state.td0);
  });

  $("predictToggle").addEventListener("change", (e) => {
    state.predictOn = e.target.checked;
    state.revealed = !state.predictOn;
    if (state.predictOn) {
      state.predictMode = "initial";
      setChoices("initial");
    }
    renderMetrics();
  });
  $("revealBtn").addEventListener("click", reveal);

  $("btnPaste").addEventListener("click", () => loadFromText($("pasteBox").value, "Pasted sounding."));
  $("btnSamplePaste").addEventListener("click", () => {
    $("pasteBox").value = toUwyoText(EXAMPLES.highCape);
    status($("loadStatus"), "Sample OUN 18Z 24 May 2011 text inserted. Click “Plot pasted sounding”.", "ok");
  });
  $("btnFetch").addEventListener("click", onFetch);

  const canvas = $("skewt");
  canvas.addEventListener("pointermove", (ev) => {
    const r = readoutAt(canvas, ev.clientX, ev.clientY);
    $("cursorReadout").textContent = r ? `${r.t.toFixed(1)} °C  ·  ${r.p.toFixed(0)} hPa` : "";
  });
  canvas.addEventListener("pointerleave", () => {
    $("cursorReadout").textContent = "";
  });

  window.addEventListener("resize", () => draw());
}

fillStationList();
bind();
applySounding(EXAMPLES[DEFAULT_EXAMPLE_ID], DEFAULT_EXAMPLE_ID);
setChoices("initial");
