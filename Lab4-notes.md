# Lab 4 — Seeing CAPE

**Union College GEO 114 Extreme Weather**

CAPE is not a weather-app badge. It is a **region on a sounding**: the area where a lifted surface parcel is warmer than the air around it. This lab forces you to look at that area first, then attach a number.

Use the static app in this repo (not a public skew-T site). Built-in soundings are enough for every beat except the last.

**Predict first** stays **on** unless your instructor says otherwise. The orange and blue fills stay visible; the J/kg values stay hidden until you commit.

---

## Learning goals

After this lab you should be able to:

1. Point to CAPE and CIN on a skew-T and say what each area means for a lifted parcel.
2. Explain why heating the surface or moistening the dewpoint changes the **parcel path**, not the environmental traces.
3. Predict the direction of the CAPE change *before* reading the number, then check.
4. Distinguish a high-CAPE uncapped afternoon from a capped morning on the same day.
5. Load a real University of Wyoming Text:List sounding by paste (fetch is optional and often blocked).

---

## Setup (2 minutes)

1. Open the app (local `python3 -m http.server` from the repo root, or the class GitHub Pages URL).
2. Confirm the preloaded case is **High-CAPE Plains — Norman, OK 18Z 24 May 2011**.
3. Confirm **Predict first / lab mode** is checked.
4. Identify, without touching sliders:
   - red environmental temperature
   - green dewpoint
   - dashed lifted-parcel path
   - **orange fill (CAPE)** and **blue fill (CIN)**
   - labels **LCL**, **LFC**, **EL**

The red and green lines are **locked**. Sliders only change the surface parcel you lift.

---

## Beat 1 — What is the orange area?

**Ask.** If you lift a surface air parcel, where on this diagram is it *positively buoyant*? Where is it fighting a cap?

**Evidence.**

- Follow the dashed parcel: dry adiabat (right-up) to the **LCL**, then a moist adiabat.
- Orange fill sits between parcel and environment from **LFC to EL**.
- Blue fill (if any) is where the parcel is cooler than the environment below the LFC.

**Claim.** Write 3–5 sentences: CAPE is the orange region of positive buoyancy; CIN is the blue region you must punch through to reach the LFC. Do not quote a number yet.

---

## Beat 2 — Predict the size, then reveal

**Ask.** Looking only at the orange area, is this weak, moderate, or strong/extreme CAPE?

**Evidence.**

- Choose one option in **Predict first**.
- Click **Reveal CAPE / CIN**.
- Compare your call to the number and to the NWS-style bins on the bar (weak < 1000, moderate 1000–2500, strong 2500–4000, extreme ≥ 4000 J/kg).

**Claim.** One sentence: your prediction vs. the revealed value. If you missed, say what about the *area* you under- or over-read (thin vs. deep, LFC near the ground vs. high up).

Instructor ballpark for the preloaded 18Z parcel: **strong**, about **3 × 10³ J/kg**, CIN ≈ 0, LCL ≈ LFC near 900 hPa, EL near 180 hPa. Your build may differ by a few hundred J/kg; the picture should not.

---

## Beat 3 — Afternoon heating (T up, Td fixed)

**Ask.** If the ground heats 3 °C and dewpoint does not change, does the orange area grow, shrink, or stay put? Why?

**Evidence.**

1. Write the prediction in the lab sheet *before* moving the slider.
2. Step surface **T** up by 3.0 °C (± buttons are 0.5 °C). Environment traces must not move.
3. Watch the dashed parcel and the orange fill.
4. Commit to grow / shrink / little change in the app, then reveal.

**Claim.** Heating at constant Td raises the dry adiabat (parcel is warmer at every level below the LCL) and usually **increases CAPE**. T−Td also widens, so the LCL can rise. For this loaded sounding the orange area should still fatten.

Note the new CAPE and the Δ. Optional: \(\sqrt{2\,\mathrm{CAPE}}\) is an **undilute ceiling**, not an observed updraft.

---

## Beat 4 — Dry the boundary layer (Td down, T fixed)

**Ask.** Reset the parcel, then drop dewpoint by 5 °C. What happens to LCL, to the moist adiabat, and to the orange vs. blue areas?

**Evidence.**

1. **Reset parcel**.
2. Predict: grow / shrink / little change.
3. Lower **Td** 5 °C. Td cannot exceed T — that constraint is physical (RH ≤ 100%).
4. Reveal.

**Claim.** Lower Td means a lower mixing ratio, a **higher LCL** (harder to saturate), and a **colder moist adiabat** (lower θe). CAPE should **crash**; CIN may appear as a blue bite. Moisture is not a side dish — it is most of the fuel.

---

## Beat 5 — The cap (same day, 12Z)

**Ask.** Switch to **Capped morning**. Why can a sounding have *both* a large orange region aloft *and* a blue cap? What does +6 °C of surface heating do to that blue area?

**Evidence.**

1. Load **Capped morning** (OUN 12Z 24 May 2011). Do not peek at numbers first.
2. Sketch: where is the inversion / elevated mixed layer (environmental T jogs warm around 850–800 hPa)?
3. Predict whether 12Z CAPE is weaker than 18Z, and whether CIN is larger.
4. Reveal.
5. Predict what +6 °C of surface T (holding Td) does to CIN. Then apply it.

**Claim.** The cap is CIN: the parcel is colder than the warm layer, so it is not free. Heating can **erode CIN** until LFC drops to the LCL and the orange area opens to the ground. That is “breaking the cap.” Severe weather needs CAPE *and* a way to use it.

Instructor ballpark: 12Z surface-based CAPE moderate (~1500 J/kg) with CIN of a few hundred J/kg; after +6 °C, CIN ≈ 0 and CAPE into the strong bin. UWYO mixed-layer numbers will not match exactly.

---

## Beat 6 — A real sounding (paste)

**Ask.** Does Albany (or another assigned station) today / on a chosen severe-weather date look like Norman on 24 May 2011?

**Evidence.**

1. Open [University of Wyoming upper-air](https://weather.uwyo.edu/upperair/sounding.html).
2. Type of plot: **Text: List**. Station **ALB** (72518) for Union, or the case your instructor names.
3. Copy the whole listing. Paste into the app. (Fetch-by-station is optional; if the browser reports CORS, that is expected — paste is the lab path.)
4. Predict CAPE category from the area, then reveal.
5. Optional: modify T as if it were 4 pm local and argue whether a cap would break.

**Claim.** Compare **area shape** (fat and deep vs. skinny vs. missing) to the Norman 18Z case. One paragraph. Cite station, date, hour.

Practice paste without the network: `examples/oun-20110524-18z.txt`, or **Insert sample text** in the app.

---

## Write-up (submit)

A complete lab write-up has **six claims**, each tied to evidence from the app (what the area did, plus the revealed number after the prediction). Do not lead with the number.

Include:

- A sentence that CAPE is an **area**, CIN is an **area**.
- The heating result and the drying result, with direction of change.
- Why the 12Z cap can hide 18Z’s orange area until the boundary layer warms.
- The real sounding identifier (station + date + hour).

---

## Instructor notes

- Core exercise is offline once the repo is served. Wyoming is only for Beat 6.
- Predict-first hides **numbers**, not fills. If a student toggles lab mode off, ask them to toggle it back.
- Surface-based CAPE here vs. UWYO mixed-layer CAPE: document the difference rather than chasing the archive’s index line.
- If someone pastes a GIF URL or an HTML weather blog, the parser will fail until they paste **PRES / TEMP / DWPT** columns.
- Common misconception: moving T “rewrites the balloon.” The badge **Environment locked** is the correction.
- Common misconception: high CAPE ⇒ tornado. This lab does not treat shear. Point at GEO 114’s later hodograph / SRH material.
- Suggested time: 50–75 minutes; Beat 6 can be homework if the period is short.

### Approximate keys (this code, surface-based, virtual T)

| Case | CAPE | CIN | LCL | LFC | EL |
|---|---|---|---|---|---|
| OUN 18Z 24 May 2011 | ~3200 J/kg | ~0 | ~900 hPa | ~900 hPa | ~180 hPa |
| 18Z, T + 3 °C | ~3900 | ~0 | lower p (higher LCL) | near LCL | ~170 hPa |
| 18Z, Td − 5 °C | ~900 | ~300 | ~840 hPa | ~640 hPa | ~250 hPa |
| OUN 12Z 24 May 2011 | ~1500 | ~320 | ~930 hPa | ~665 hPa | ~210 hPa |
| 12Z, T + 6 °C | ~2700 | ~0 | ~855 hPa | ~LCL | ~180 hPa |

Treat as order-of-magnitude keys, not an answer token.
