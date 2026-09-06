/**
 * Lab wizard: seven steps, one panel at a time.
 * Thermo (thermo.js) and canvas (skewt.js) are unchanged; this file is the
 * UI state machine — which controls exist, which sounding is loaded, and
 * predict-first memory that survives Back/Next.
 */
import { liftSurfaceParcel } from "./thermo.js";
import { drawSkewT, readoutAt } from "./skewt.js";
import {
  EXAMPLES,
  parseUwyoText,
  fetchUwyo,
  STATIONS,
  toUwyoText,
} from "./soundings.js";

const $ = (id) => document.getElementById(id);

const INITIAL_CHOICES = [
  { id: "weak", label: "Weak — small orange sliver, or almost none" },
  { id: "moderate", label: "Moderate — a clear orange area, not huge" },
  { id: "strong", label: "Strong — a fat orange area LFC toward the tropopause" },
  { id: "extreme", label: "Extreme — huge orange area, very deep and wide" },
];

const CHANGE_CHOICES = [
  { id: "grow", label: "The orange area will grow (more CAPE)" },
  { id: "shrink", label: "The orange area will shrink (less CAPE)" },
  { id: "same", label: "Little change — area looks about the same" },
];

const STEPS = [
  {
    id: "orient",
    title: "Orient",
    ask: "Identify the traces on this High-CAPE Plains sounding (Norman 18Z 24 May 2011). Sliders stay hidden — look, don’t edit.",
    evidence:
      "On the chart: red environmental T, green dewpoint, dashed lifted parcel, orange CAPE, blue CIN (maybe a sliver or none), and the LCL / LFC / EL labels.",
    claim: "",
    show: { checklist: true, claim: false, predict: false, t: false, td: false, reset: false, metrics: false, paste: false },
    sounding: "highCape",
    slot: "plains",
    predictMode: "initial",
  },
  {
    id: "orange",
    title: "The orange area",
    ask: "If you lift a surface air parcel, where on this diagram is it positively buoyant? Where is it fighting a cap?",
    evidence:
      "Follow the dashed parcel: dry adiabat to the LCL, then a moist adiabat. Orange fill sits between parcel and environment from LFC to EL. Blue fill (if any) is where the parcel is cooler than the environment below the LFC.",
    claim:
      "CAPE is the orange region of positive buoyancy; CIN is the blue region you must punch through to reach the LFC. Do not quote a number yet.",
    show: { checklist: false, claim: true, predict: false, t: false, td: false, reset: false, metrics: false, paste: false },
    sounding: "highCape",
    slot: "plains",
    predictMode: "initial",
  },
  {
    id: "predict",
    title: "Predict then reveal",
    ask: "Looking only at the orange area, is this weak, moderate, strong, or extreme CAPE?",
    evidence:
      "Choose one option, then Reveal CAPE / CIN. Compare your call to the number and to the NWS-style bins on the bar (weak < 1000, moderate 1000–2500, strong 2500–4000, extreme ≥ 4000 J/kg).",
    claim: "One sentence: your prediction vs. the revealed value. If you missed, say what about the area you under- or over-read (thin vs. deep, LFC near the ground vs. high up).",
    show: { checklist: false, claim: true, predict: true, t: false, td: false, reset: false, metrics: true, paste: false },
    sounding: "highCape",
    slot: "plains",
    predictMode: "initial",
  },
  {
    id: "heat",
    title: "Heat the surface",
    ask: "If the ground heats 3 °C and dewpoint does not change, does the orange area grow, shrink, or stay put? Why?",
    evidence:
      "Predict grow / shrink / little change first. Then step surface T up by 3.0 °C (± is 0.5 °C — six clicks). Environment traces must not move. Watch the dashed parcel and the orange fill, then Reveal.",
    claim: "Heating at constant Td usually increases CAPE. Note the new number and the Δ.",
    show: { checklist: false, claim: true, predict: true, t: true, td: false, reset: true, metrics: true, paste: false },
    sounding: "highCape",
    slot: "plains",
    predictMode: "change",
    targetDT: 3,
    parcelNote: "T only — Td is locked. You are heating the surface parcel, not rewriting the balloon.",
  },
  {
    id: "dry",
    title: "Dry the dewpoint",
    ask: "This step starts from the original parcel (Reset if you still see the heated one). Drop dewpoint by 5 °C. What happens to LCL, the moist adiabat, and the orange vs. blue areas?",
    evidence:
      "Lower Td 5 °C (± is 0.5 °C — ten clicks of −). Td cannot exceed T. Watch for a blue CIN bite, then Reveal.",
    claim: "Lower Td raises the LCL and cools the moist adiabat. CAPE should crash; CIN may appear. Moisture is the fuel.",
    show: { checklist: false, claim: true, predict: true, t: false, td: true, reset: true, metrics: true, paste: false },
    sounding: "highCape",
    slot: "dry",
    predictMode: "change",
    resetOnFirstEnter: true,
    targetDTd: -5,
    parcelNote: "Td only — T is locked. Dry the boundary layer and watch CIN appear.",
  },
  {
    id: "cap",
    title: "The cap",
    ask: "Why can a sounding have both a large orange region aloft and a blue cap? What does +6 °C of surface heating do to that blue area?",
    evidence:
      "Loaded: Capped morning (OUN 12Z 24 May 2011). Find the inversion near 850–800 hPa. Predict 12Z CAPE/CIN, Reveal, then heat T +6 °C holding Td (twelve clicks of +).",
    claim: "The cap is CIN. Heating can erode it until the orange area opens to the ground — breaking the cap.",
    show: { checklist: false, claim: true, predict: true, t: true, td: false, reset: true, metrics: true, paste: false },
    sounding: "capped",
    slot: "capped",
    predictMode: "initial",
    targetDT: 6,
    parcelNote: "T only — heat the 12Z surface and watch the blue cap shrink. Td stays put.",
  },
  {
    id: "paste",
    title: "Paste a real sounding",
    ask: "Does Albany (or another assigned station) today / on a chosen severe-weather date look like Norman on 24 May 2011?",
    evidence:
      "Paste a UWYO Text:List sounding (fetch is optional and often blocked by CORS). Predict CAPE from the area, then Reveal. Optional: tweak T as if it were 4 pm local. Reload Norman 18Z to compare.",
    claim: "Compare area shape (fat and deep vs. skinny vs. missing) to the Norman 18Z case. Cite station, date, and hour.",
    show: { checklist: false, claim: true, predict: true, t: true, td: false, reset: true, metrics: true, paste: true },
    sounding: null,
    slot: "paste",
    predictMode: "initial",
    parcelNote: "Optional T tweak after you load a sounding. Environment traces stay locked.",
  },
];

const state = {
  step: -1,
  initialized: false,
  sounding: null,
  exampleId: null,
  t: null,
  td: null,
  t0: null,
  td0: null,
  parcel: null,
  mem: STEPS.map(() => emptyMem()),
  slots: {},
};

function emptyMem() {
  return {
    visited: false,
    claim: "",
    choice: null,
    revealed: false,
    feedback: "",
    predictMode: null,
    lastCape: null,
    checks: null,
  };
}

function stepMem(i) {
  return state.mem[i];
}

function showBlock(name, on) {
  document.querySelectorAll(`[data-block="${name}"]`).forEach((el) => {
    el.hidden = !on;
  });
}

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

function categoryId(cape) {
  if (cape < 1000) return "weak";
  if (cape < 2500) return "moderate";
  if (cape < 4000) return "strong";
  return "extreme";
}

function changeId(prev, next) {
  const d = next - prev;
  if (d > 150) return "grow";
  if (d < -150) return "shrink";
  return "same";
}

function scalePos(cape) {
  const x = Math.max(0, Math.min(5000, cape));
  return `${(x / 5000) * 100}%`;
}

function selectedChoice() {
  const el = document.querySelector('input[name="pred"]:checked');
  return el ? el.value : null;
}

function setChoices(mode, selectedId) {
  const box = $("predictChoices");
  const items = mode === "change" ? CHANGE_CHOICES : INITIAL_CHOICES;
  box.innerHTML = items
    .map((c) => `<label><input type="radio" name="pred" value="${c.id}"/> ${c.label}</label>`)
    .join("");
  $("predictPrompt").textContent =
    mode === "change"
      ? "Commit to grow / shrink / little change, then Reveal. The orange fill is the evidence; the number stays hidden."
      : "Commit to a bin, then Reveal. The orange fill stays visible; the number does not.";
  if (selectedId) {
    const el = box.querySelector(`input[name="pred"][value="${selectedId}"]`);
    if (el) el.checked = true;
  }
}

function restorePredictUI(mem) {
  const mode = mem.predictMode || "initial";
  setChoices(mode, mem.choice);
  $("predictFeedback").textContent = mem.feedback || "";
  $("predictFeedback").className = "status" + (mem.revealed && mem.feedback ? " ok" : mem.feedback ? " error" : "");
}

function applySounding(sounding, exampleId, opts = {}) {
  state.sounding = sounding;
  state.exampleId = exampleId || null;
  const s = surfaceOf(sounding);
  state.t0 = s.t;
  state.td0 = s.td;
  if (Number.isFinite(opts.t) && Number.isFinite(opts.td)) {
    state.t = opts.t;
    state.td = Math.min(opts.td, opts.t);
  } else {
    state.t = s.t;
    state.td = s.td;
  }
  $("chartSounding").textContent = sounding.title || sounding.header;
  recompute();
}

function saveCurrentSlot() {
  if (state.step < 0 || !state.sounding) return;
  const slot = STEPS[state.step].slot;
  state.slots[slot] = {
    sounding: state.sounding,
    exampleId: state.exampleId,
    t: state.t,
    td: state.td,
  };
}

function loadSlotSounding(spec, mem, first) {
  const saved = state.slots[spec.slot];

  if (spec.sounding === "highCape") {
    if (saved) {
      applySounding(EXAMPLES.highCape, "highCape", { t: saved.t, td: saved.td });
    } else if (spec.resetOnFirstEnter && first) {
      applySounding(EXAMPLES.highCape, "highCape");
    } else if (first && state.exampleId === "highCape" && Number.isFinite(state.t)) {
      applySounding(EXAMPLES.highCape, "highCape", { t: state.t, td: state.td });
    } else {
      applySounding(EXAMPLES.highCape, "highCape");
    }
    return;
  }

  if (spec.sounding === "capped") {
    if (saved && saved.exampleId === "capped") {
      applySounding(EXAMPLES.capped, "capped", { t: saved.t, td: saved.td });
    } else {
      applySounding(EXAMPLES.capped, "capped");
    }
    return;
  }

  if (saved && saved.sounding) {
    applySounding(saved.sounding, saved.exampleId, { t: saved.t, td: saved.td });
  } else {
    applySounding(EXAMPLES.highCape, "highCape");
  }
}

function stepFromHash() {
  const m = location.hash.match(/step-(\d+)/i);
  if (!m) return 0;
  const n = Number(m[1]) - 1;
  if (!Number.isInteger(n) || n < 0 || n >= STEPS.length) return 0;
  return n;
}

function enterStep(next) {
  if (next === state.step && state.initialized) {
    renderStep();
    return;
  }
  if (state.initialized) saveCurrentSlot();

  const spec = STEPS[next];
  const mem = stepMem(next);
  const first = !mem.visited;
  mem.visited = true;
  if (!mem.predictMode) mem.predictMode = spec.predictMode || "initial";

  state.step = next;
  loadSlotSounding(spec, mem, first);
  if (mem.lastCape == null && spec.predictMode === "change" && state.parcel) {
    mem.lastCape = state.parcel.cape;
  }
  renderStep();
  $("stepScroll").scrollTop = 0;
  history.replaceState(null, "", `#step-${next + 1}`);
  state.initialized = true;
}

function renderDots() {
  const ol = $("progressDots");
  if (!ol.dataset.ready) {
    ol.innerHTML = STEPS.map(
      (s, i) =>
        `<li><button type="button" data-step="${i}" title="${s.title}" aria-label="Step ${i + 1}: ${s.title}">${i + 1}</button></li>`
    ).join("");
    ol.dataset.ready = "1";
    ol.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-step]");
      if (b) enterStep(Number(b.dataset.step));
    });
  }
  ol.querySelectorAll("button").forEach((b, i) => {
    const visited = !!state.mem[i]?.visited;
    b.classList.toggle("current", i === state.step);
    b.classList.toggle("visited", visited && i !== state.step);
    b.setAttribute("aria-current", i === state.step ? "step" : "false");
  });
}

function signed(v) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)} °C`;
}

function renderDelta() {
  const spec = STEPS[state.step];
  const sh = spec.show;
  const dT = state.t - state.t0;
  const dTd = state.td - state.td0;
  const parts = [];
  if (sh.t) parts.push(`ΔT ${signed(dT)}`);
  if (sh.td) parts.push(`ΔTd ${signed(dTd)}`);
  if (spec.targetDT != null) {
    parts.push(
      Math.abs(dT - spec.targetDT) < 0.2
        ? `target ${signed(spec.targetDT)} reached`
        : `aim ${signed(spec.targetDT)}`
    );
  }
  if (spec.targetDTd != null) {
    parts.push(
      Math.abs(dTd - spec.targetDTd) < 0.2
        ? `target ${signed(spec.targetDTd)} reached`
        : `aim ${signed(spec.targetDTd)}`
    );
  }
  $("parcelDelta").textContent = parts.join(" · ");
  $("parcelDelta").hidden = parts.length === 0;

  if (sh.t && !sh.td) {
    $("lockedOther").textContent = `Td locked at ${state.td.toFixed(1)} °C`;
    $("lockedOther").hidden = false;
  } else if (sh.td && !sh.t) {
    $("lockedOther").textContent = `T locked at ${state.t.toFixed(1)} °C`;
    $("lockedOther").hidden = false;
  } else {
    $("lockedOther").textContent = "";
    $("lockedOther").hidden = true;
  }

  if (spec.targetDT != null) {
    $("tHint").textContent = `Each ± is 0.5 °C. Aim ${signed(spec.targetDT)} from the original surface.`;
  } else {
    $("tHint").textContent = "Each ± is 0.5 °C. Environment traces stay put.";
  }
}

function renderStep() {
  const spec = STEPS[state.step];
  const mem = stepMem(state.step);
  const n = state.step + 1;
  const sh = spec.show;

  $("stepTitle").textContent = `Step ${n} of 7 · ${spec.title}`;
  $("labPanel").dataset.step = String(n);
  $("labPanel").dataset.stepId = spec.id;

  $("stepAsk").replaceChildren();
  const askLead = document.createElement("strong");
  askLead.textContent = "Ask. ";
  $("stepAsk").append(askLead, document.createTextNode(spec.ask));

  $("stepEvidence").textContent = spec.evidence;
  $("stepClaim").textContent = spec.claim;
  $("claimBox").value = mem.claim || "";

  showBlock("checklist", !!sh.checklist);
  showBlock("claim", !!sh.claim);
  showBlock("predict", !!sh.predict);
  showBlock("tSlider", !!sh.t);
  showBlock("tdSlider", !!sh.td);
  showBlock("reset", !!sh.reset);
  showBlock("metrics", !!sh.metrics);
  showBlock("paste", !!sh.paste);
  showBlock("parcel", !!(sh.t || sh.td || sh.reset));
  showBlock("evidence", true);

  $("parcelNote").textContent = spec.parcelNote || "";
  $("parcelNote").hidden = !spec.parcelNote;

  if (sh.predict) restorePredictUI(mem);

  if (sh.checklist) {
    const boxes = [...$("orientChecklist").querySelectorAll("input")];
    boxes.forEach((inp, i) => {
      inp.checked = !!(mem.checks && mem.checks[i]);
    });
  }

  renderDots();
  const last = state.step === STEPS.length - 1;
  $("btnPrev").disabled = state.step === 0;
  $("btnNext").disabled = last;
  $("btnNext").textContent = last ? "Done" : "Next";

  renderMetrics();
  renderDelta();
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
  if (state.step >= 0) {
    renderMetrics();
    renderDelta();
  }
}

function draw() {
  drawSkewT($("skewt"), {
    sounding: state.sounding,
    parcel: state.parcel,
    showCapeFill: true,
  });
}

function renderMetrics() {
  if (state.step < 0) return;
  const spec = STEPS[state.step];
  if (!spec.show.metrics) return;
  const p = state.parcel;
  const mem = stepMem(state.step);
  const hide = !mem.revealed;

  $("revealBtn").disabled = !hide;

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
  const mem = stepMem(state.step);
  const prevCape = state.parcel ? state.parcel.cape : null;
  if (prevCape != null && mem.lastCape == null) {
    mem.lastCape = prevCape;
  }
  if (mem.revealed && prevCape != null) {
    mem.lastCape = prevCape;
    mem.revealed = false;
    mem.predictMode = "change";
    mem.choice = null;
    mem.feedback = "";
    setChoices("change");
    $("predictFeedback").textContent = "";
    $("predictFeedback").className = "status";
  }
  state.t = t;
  state.td = Math.min(td, t);
  recompute();
}

function reveal() {
  const mem = stepMem(state.step);
  const spec = STEPS[state.step];
  const choice = selectedChoice();
  const p = state.parcel;
  mem.choice = choice;
  if (!choice) {
    mem.feedback = "Pick an option first — the point is to commit before the number.";
    $("predictFeedback").textContent = mem.feedback;
    $("predictFeedback").className = "status error";
    return;
  }

  let msg = "";
  if (mem.predictMode === "initial") {
    const actual = categoryId(p.cape);
    const ok = choice === actual;
    msg = ok
      ? `Matches the picture: ${fmtCape(p.cape)} J/kg is ${p.category.label} CAPE. The orange area was the evidence.`
      : `The orange area sizes to ${fmtCape(p.cape)} J/kg (${p.category.label}). Use the area, not a guess about the weather headline.`;
  } else {
    const actual = changeId(mem.lastCape ?? p.cape, p.cape);
    const d = p.cape - (mem.lastCape ?? p.cape);
    const delta = `${d >= 0 ? "+" : ""}${Math.round(d)} J/kg`;
    const ok = choice === actual;
    msg = ok
      ? `Yes. CAPE ${fmtCape(mem.lastCape ?? p.cape)} → ${fmtCape(p.cape)} (${delta}).`
      : `CAPE went ${fmtCape(mem.lastCape ?? p.cape)} → ${fmtCape(p.cape)} (${delta}). Watch the orange fill, not the slider labels.`;
    if (spec.targetDT != null && Math.abs(state.t - state.t0 - spec.targetDT) > 0.6) {
      msg += ` (You are ${signed(state.t - state.t0)} from the original T; the beat asks for ${signed(spec.targetDT)}.)`;
    }
    if (spec.targetDTd != null && Math.abs(state.td - state.td0 - spec.targetDTd) > 0.6) {
      msg += ` (You are ${signed(state.td - state.td0)} from the original Td; the beat asks for ${signed(spec.targetDTd)}.)`;
    }
  }
  mem.revealed = true;
  mem.feedback = msg;
  $("predictFeedback").textContent = msg;
  $("predictFeedback").className = "status ok";
  renderMetrics();
}

function status(el, text, kind) {
  el.textContent = text;
  el.className = "status" + (kind ? " " + kind : "");
}

function resetPastePredict() {
  const mem = stepMem(state.step);
  mem.revealed = false;
  mem.choice = null;
  mem.feedback = "";
  mem.predictMode = "initial";
  mem.lastCape = null;
  setChoices("initial");
  $("predictFeedback").textContent = "";
  $("predictFeedback").className = "status";
}

function loadFromText(text, label) {
  try {
    const sounding = parseUwyoText(text);
    sounding.title = sounding.header;
    sounding.blurb =
      label || "Pasted University of Wyoming Text:List sounding. Environment locked; sliders move the surface parcel.";
    applySounding(sounding, null);
    resetPastePredict();
    saveCurrentSlot();
    status($("loadStatus"), `Loaded ${sounding.levels.length} levels from “${sounding.header}”.`, "ok");
    renderMetrics();
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
    resetPastePredict();
    saveCurrentSlot();
    status($("loadStatus"), `Loaded ${sounding.levels.length} levels.`, "ok");
    renderMetrics();
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

  $("btnResetParcel").addEventListener("click", () => {
    onParcelEdit(state.t0, state.td0);
  });

  $("predictChoices").addEventListener("change", () => {
    stepMem(state.step).choice = selectedChoice();
  });
  $("revealBtn").addEventListener("click", reveal);

  $("claimBox").addEventListener("input", (e) => {
    stepMem(state.step).claim = e.target.value;
  });
  $("orientChecklist").addEventListener("change", () => {
    stepMem(0).checks = [...$("orientChecklist").querySelectorAll("input")].map((inp) => inp.checked);
  });

  $("btnPrev").addEventListener("click", () => {
    if (state.step > 0) {
      enterStep(state.step - 1);
      $("stepAsk").focus();
    }
  });
  $("btnNext").addEventListener("click", () => {
    if (state.step < STEPS.length - 1) {
      enterStep(state.step + 1);
      $("stepAsk").focus();
    }
  });

  $("btnPaste").addEventListener("click", () => loadFromText($("pasteBox").value, "Pasted sounding."));
  $("btnSamplePaste").addEventListener("click", () => {
    $("pasteBox").value = toUwyoText(EXAMPLES.highCape);
    status($("loadStatus"), "Sample OUN 18Z 24 May 2011 text inserted. Click “Plot pasted sounding”.", "ok");
  });
  $("btnReloadNorman").addEventListener("click", () => {
    applySounding(EXAMPLES.highCape, "highCape");
    resetPastePredict();
    saveCurrentSlot();
    status($("loadStatus"), "Reloaded High-CAPE Plains — Norman 18Z 24 May 2011.", "ok");
    renderMetrics();
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
  window.addEventListener("hashchange", () => {
    const i = stepFromHash();
    if (i !== state.step) enterStep(i);
  });
}

fillStationList();
bind();
enterStep(stepFromHash());
