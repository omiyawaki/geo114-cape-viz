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
  { id: "weak", label: "Weak — small sliver, or almost none" },
  { id: "moderate", label: "Moderate — a clear patch, not huge" },
  { id: "strong", label: "Strong — fat, up toward the tropopause" },
  { id: "extreme", label: "Extreme — huge, deep and wide" },
];

const CHANGE_CHOICES = [
  { id: "grow", label: "Grow" },
  { id: "shrink", label: "Shrink" },
  { id: "same", label: "Little change" },
];

const STEPS = [
  {
    id: "orient",
    title: "Look around",
    ask: "Before you touch any of the controls, pause and recall — in plain words — what CAPE is, what CIN is, and what a lifted parcel is. Then look at the skew-T and map each idea onto the plot: which fill or line is which?",
    evidence: [
      "Check off each item below once you can point to it on the chart.",
      "If blue fill is missing on this sounding, that is fine — CIN can be near zero.",
      "Do not move any sliders yet; this step is just connecting the words to the picture.",
    ],
    claim: "In your own words: what is CAPE? what is CIN? what does the dashed line represent? Then note where each shows up on this plot.",
    show: { checklist: true, claim: true, predict: false, t: false, td: false, reset: false, metrics: false, paste: false },
    sounding: "highCape",
    slot: "plains",
    predictMode: "initial",
  },
  {
    id: "orange",
    title: "Orange area",
    ask: "Imagine lifting a surface parcel. Along the dashed path, where is that parcel warmer than the air around it, and where is it cooler? Use the fills on the chart to help you answer.",
    evidence: [
      "Follow the dashed parcel from the surface up to the LCL, then keep going upward.",
      "Find the orange fill and the blue fill (blue may be missing on some soundings).",
      "Note where LCL, LFC, and EL sit on the sounding.",
    ],
    claim: "In a sentence or two, what is the orange area telling you? What about the blue area? Skip the numbers for now.",
    show: { checklist: false, claim: true, predict: false, t: false, td: false, reset: false, metrics: false, paste: false },
    sounding: "highCape",
    slot: "plains",
    predictMode: "initial",
  },
  {
    id: "predict",
    title: "Make a guess",
    ask: "Looking only at how big the orange area looks — not at any number yet — would you call this CAPE weak, moderate, strong, or extreme?",
    evidence: [
      "Make your prediction before you reveal anything.",
      "Click Reveal CAPE / CIN and read the number.",
      "Compare your call to the number. If you missed, what about the orange area threw you off?",
    ],
    claim: "Write down your call versus the number. If you were off, what about the area did you misread?",
    show: { checklist: false, claim: true, predict: true, t: false, td: false, reset: false, metrics: true, paste: false },
    sounding: "highCape",
    slot: "plains",
    predictMode: "initial",
  },
  {
    id: "heat",
    title: "Warm the ground",
    ask: "Suppose the ground heats by about 3 °C while dewpoint stays the same. Do you expect the orange area to grow, shrink, or barely change?",
    evidence: [
      "Predict first: grow, shrink, or little change.",
      "Use the T slider (or the ± buttons) to raise surface temperature by about 3 °C. Leave Td alone.",
      "Click Reveal and see what the orange area and CAPE number did.",
    ],
    claim: "What did the orange area do after you warmed the ground, and why do you think that happened?",
    show: { checklist: false, claim: true, predict: true, t: true, td: false, reset: true, metrics: true, paste: false },
    sounding: "highCape",
    slot: "plains",
    predictMode: "change",
    targetDT: 3,
    parcelNote: "Move T only — dewpoint stays put for this step.",
  },
  {
    id: "dry",
    title: "Dry the air",
    ask: "Reset the parcel, then dry the air by dropping dewpoint about 5 °C. What should happen to the orange area, the blue area, and the LCL?",
    evidence: [
      "Click Reset parcel so you start from the original surface values.",
      "Predict first: grow, shrink, or little change for the orange area.",
      "Lower Td by about 5 °C. Leave T alone.",
      "Reveal, then check what happened to CAPE, CIN, and the LCL height.",
    ],
    claim: "What did drying the air do to the orange and blue areas? Mention the LCL if you noticed a change.",
    show: { checklist: false, claim: true, predict: true, t: false, td: true, reset: true, metrics: true, paste: false },
    sounding: "highCape",
    slot: "dry",
    predictMode: "change",
    resetOnFirstEnter: true,
    targetDTd: -5,
    parcelNote: "Move Td only — temperature stays put for this step.",
  },
  {
    id: "cap",
    title: "Morning cap",
    ask: "This sounding has orange aloft and blue near the surface. Why both? What do you think happens to the blue area if you warm the surface by about 6 °C?",
    evidence: [
      "Find the warm jog in the temperature profile near 850–800 hPa — that is the cap.",
      "Predict the CAPE category from the orange area, then Reveal.",
      "Predict what +6 °C of surface heating will do to the blue fill.",
      "Raise T by about 6 °C, leave Td alone, and Reveal again.",
    ],
    claim: "What is the blue area here, and what did heating the surface do to it?",
    show: { checklist: false, claim: true, predict: true, t: true, td: false, reset: true, metrics: true, paste: false },
    sounding: "capped",
    slot: "capped",
    predictMode: "initial",
    targetDT: 6,
    parcelNote: "Move T only — dewpoint stays put for this step.",
  },
  {
    id: "paste",
    title: "Your sounding",
    ask: "Load a real sounding for Albany (or whatever station you were given). Does it look anything like Norman on 24 May 2011 — fat and deep orange, skinny, or almost missing?",
    evidence: [
      "Go to weather.uwyo.edu/upperair/sounding.html.",
      "Set Type of plot to Text: List, pick station ALB (or yours), and copy the listing.",
      "Paste it in the box below and click Plot pasted sounding (or Fetch from UWYO).",
      "Predict CAPE from the orange area first, then Reveal.",
    ],
    claim: "Compared with Norman 18Z, is your sounding fat and deep, skinny, or missing CAPE? Note the station, date, and hour.",
    show: { checklist: false, claim: true, predict: true, t: true, td: false, reset: true, metrics: true, paste: true },
    sounding: null,
    slot: "paste",
    predictMode: "initial",
    parcelNote: "Optional: raise T a bit as if it were mid-afternoon.",
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

function renderEvidence(items) {
  const el = $("stepEvidence");
  el.replaceChildren();
  (items || []).forEach((text) => {
    const li = document.createElement("li");
    li.textContent = text;
    el.append(li);
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
  $("predictPrompt").textContent = "Make your prediction before you reveal.";
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
        `<li><button type="button" data-step="${i}" title="${i + 1} ${s.title}" aria-label="${i + 1} ${s.title}">${i + 1}</button></li>`
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
    $("tHint").textContent = `Each ± is 0.5 °C. Aim ${signed(spec.targetDT)}.`;
  } else {
    $("tHint").textContent = "Each ± is 0.5 °C.";
  }
}

function renderStep() {
  const spec = STEPS[state.step];
  const mem = stepMem(state.step);
  const n = state.step + 1;
  const sh = spec.show;

  $("stepTitle").textContent = `${n} ${spec.title}`;
  $("labPanel").dataset.step = String(n);
  $("labPanel").dataset.stepId = spec.id;

  $("stepAsk").textContent = spec.ask;
  renderEvidence(spec.evidence);
  $("stepClaim").textContent = spec.claim;
  $("claimBox").value = mem.claim || "";

  showBlock("ask", true);
  showBlock("checklist", !!sh.checklist);
  showBlock("claim", !!sh.claim);
  showBlock("predict", !!sh.predict);
  showBlock("tSlider", !!sh.t);
  showBlock("tdSlider", !!sh.td);
  showBlock("reset", !!sh.reset);
  showBlock("metrics", !!sh.metrics);
  showBlock("paste", !!sh.paste);
  showBlock("parcel", !!(sh.t || sh.td || sh.reset));
  showBlock("evidence", !!(spec.evidence && spec.evidence.length));

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
    $("wmaxVal").textContent = "hidden until you predict";
    $("scalePointer").style.left = "0%";
    $("scalePointer").style.opacity = "0.25";
  } else {
    $("capeVal").classList.remove("hidden-val");
    $("cinVal").classList.remove("hidden-val");
    $("capeVal").textContent = `${fmtCape(p.cape)} J/kg`;
    $("cinVal").textContent = `${fmtCape(p.cin)} J/kg`;
    $("capeCat").textContent = `${p.category.label} instability`;
    $("wmaxVal").textContent = `√(2 CAPE) ≈ ${p.wmax.toFixed(0)} m/s`;
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
    mem.feedback = "Pick one first.";
    $("predictFeedback").textContent = mem.feedback;
    $("predictFeedback").className = "status error";
    return;
  }

  let msg = "";
  if (mem.predictMode === "initial") {
    const actual = categoryId(p.cape);
    const ok = choice === actual;
    msg = ok
      ? `${fmtCape(p.cape)} J/kg — ${p.category.label}.`
      : `${fmtCape(p.cape)} J/kg — ${p.category.label}. Look at the area again.`;
  } else {
    const actual = changeId(mem.lastCape ?? p.cape, p.cape);
    const d = p.cape - (mem.lastCape ?? p.cape);
    const delta = `${d >= 0 ? "+" : ""}${Math.round(d)} J/kg`;
    const ok = choice === actual;
    msg = `CAPE ${fmtCape(mem.lastCape ?? p.cape)} → ${fmtCape(p.cape)} (${delta}).`;
    if (!ok) msg += " Look at the fill again.";
    if (spec.targetDT != null && Math.abs(state.t - state.t0 - spec.targetDT) > 0.6) {
      msg += ` Aim ${signed(spec.targetDT)} (you are at ${signed(state.t - state.t0)}).`;
    }
    if (spec.targetDTd != null && Math.abs(state.td - state.td0 - spec.targetDTd) > 0.6) {
      msg += ` Aim ${signed(spec.targetDTd)} (you are at ${signed(state.td - state.td0)}).`;
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
    sounding.blurb = label || "Pasted sounding.";
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
    sounding.blurb = "Fetched sounding.";
    applySounding(sounding, null);
    resetPastePredict();
    saveCurrentSlot();
    status($("loadStatus"), `Loaded ${sounding.levels.length} levels.`, "ok");
    renderMetrics();
  } catch (err) {
    if (err.cors && err.url) {
      status(
        $("loadStatus"),
        `Fetch blocked. Open the Wyoming page, copy Text: List, paste above. ${err.url}`,
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
    status($("loadStatus"), "Sample Norman 18Z inserted. Plot it.", "ok");
  });
  $("btnReloadNorman").addEventListener("click", () => {
    applySounding(EXAMPLES.highCape, "highCape");
    resetPastePredict();
    saveCurrentSlot();
    status($("loadStatus"), "Reloaded Norman 18Z 24 May 2011.", "ok");
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
