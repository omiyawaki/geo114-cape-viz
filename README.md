# CAPE on a Skew-T

Static skew-T lab: CAPE as a filled area that grows or shrinks when surface T or Td change. Seven steps map onto [Lab4-notes.md](Lab4-notes.md). Instructor keys: [INSTRUCTOR.md](INSTRUCTOR.md).

The skew-T stays visible; the right-hand panel shows only the current step. Prev / Next and progress dots move between steps without wiping predictions. The core exercise runs in this app — no third-party skew-T site.

## Run locally

This is a static site (HTML + CSS + ES modules). Serve the **repo root** — opening `index.html` as a `file://` URL usually blocks modules.

```bash
cd geo114-cape-viz
python -m http.server 8000
# or: python3 -m http.server 8000
```

Then open [http://127.0.0.1:8000/](http://127.0.0.1:8000/).

Python 3.x is enough. Any other static server from the repo root also works (`npx serve`, `php -S`, Caddy, …).

## GitHub Pages

1. Push this repo to GitHub.
2. Settings → Pages → Deploy from a branch → `main` / `/ (root)`.
3. The app is then at `https://<user>.github.io/geo114-cape-viz/`.

Pages serves `.js` with the right MIME type, so ES modules work. Fetching Wyoming soundings is still subject to **CORS** (see below).

## What the app does

The wizard reveals controls only when the beat needs them. Nothing is grayed out and left in the way.

| Step | What is on screen |
|---|---|
| 1 Orient | Norman 18Z loaded. Checklist (orange, blue, dashed parcel). No sliders. |
| 2 Orange | Areas. Write-in. Still no sliders. |
| 3 Predict | Weak / moderate / strong / extreme + Reveal. Numbers stay hidden until then. |
| 4 Heat | **T** slider only (Td locked). Predict grow/shrink, then +3 °C. Reset parcel. |
| 5 Dry | **Td** slider only, starting from the original parcel. −5 °C Td; CIN can appear. |
| 6 Cap | Auto-switches to Capped morning (12Z). T heating (+6 °C). Paste hidden. |
| 7 Paste | Paste / fetch / sample-insert unlock. Optional T tweak. Reload Norman 18Z to compare. |

| Always | Effect |
|---|---|
| Skew-T canvas | Environment traces locked. Orange CAPE and blue CIN fills update live when T/Td change. |
| Predict first | Hides CAPE/CIN **numbers** until Reveal. Shaded areas stay visible. |
| Surface **T** / **Td** (when unlocked) | Lift a *modified surface parcel*. ±0.5 °C steppers. |
| **Station + date + hour fetch** (step 7) | Tries `weather.uwyo.edu`. If CORS blocks it, the app opens the URL so you can copy/paste. |

Nearby sounding for Union: **ALB 72518** (Albany, NY).

## Load a University of Wyoming sounding

The archive UI is [weather.uwyo.edu/upperair/sounding.html](https://weather.uwyo.edu/upperair/sounding.html).

1. Region: North America.
2. **Type of plot: Text: List** (not GIF / SVG).
3. Year, month, and From = To (one time). Hours are usually **00Z** or **12Z**.
4. Click a station. Copy the entire page of numbers.
5. Paste into the app and click **Plot pasted sounding**.

A sample listing is in [`examples/oun-20110524-18z.txt`](examples/oun-20110524-18z.txt). The in-app **Insert sample text** button loads the same case.

Direct URL pattern (also built by the fetch form):

```
https://weather.uwyo.edu/cgi-bin/sounding?region=naconf&TYPE=TEXT:LIST&YEAR=2011&MONTH=05&FROM=2418&TO=2418&STNM=72357
```

`FROM` / `TO` are `DDHH` (day + UTC hour). `STNM` is the 5-digit WMO id (`OUN` = `72357`, `ALB` = `72518`).

### CORS fallback (fetch)

Browsers typically **do not** allow a page on GitHub Pages or `localhost` to read `weather.uwyo.edu` (no `Access-Control-Allow-Origin`). That is expected.

- **Supported path:** paste Text:List.
- **Optional path:** the fetch button still tries. On failure the app reports CORS, prints the Wyoming URL, and opens it in a new tab so you can copy the text.
- This repo does **not** use a public CORS proxy. Those break without warning and would put the lab on a flaky third party.

## Thermodynamic approximations

The code is a teaching model, not SPC or MetPy. Numbers will not match a forecast sounding pixel-for-pixel. They should be in the same ballpark (this preloaded OUN 18Z case is ~3200 J/kg here vs. UWYO virtual-T CAPE ~3111 J/kg).

### Parcel

1. **Surface-based.** The parcel is the surface T and Td you set with the sliders, at the first sounding level that has both. UWYO’s published CAPE is often a **mixed-layer** mean of the lowest ~500 m, so it can differ even on the same listing.
2. **LCL** (Bolton 1980):  
   \(T_\mathrm{LCL} = \big(1/(T_d-56) + \ln(T/T_d)/800\big)^{-1} + 56\) (T, Td in K), then  
   \(p_\mathrm{LCL} = p\,(T_\mathrm{LCL}/T)^{c_p/R_d}\).
3. **Dry adiabat** from the surface to the LCL:  
   \(T(p) = T_s (p/p_s)^{R_d/c_p}\), \(R_d/c_p \approx 0.286\).
4. **Moist adiabat** (liquid pseudoadiabat) above the LCL. Condensate is assumed to fall out. Integration uses the MetPy / Bakhshaii & Stull (2013) form  
   \(\dfrac{dT}{dP} = \dfrac{1}{P}\dfrac{R_d T + L_v r_s}{c_{pd} + L_v^2 r_s \varepsilon /(R_d T^2)}\)  
   with RK4 steps of 1 hPa. Ice-phase processes are ignored. \(L_v\) is held constant at \(2.501\times10^6\) J kg⁻¹.
5. Saturation vapor pressure is Bolton (1980) over **liquid** only.

### CAPE and CIN

Virtual temperature (Hobbs / MetPy):

\[
T_v = T\,\frac{w+\varepsilon}{\varepsilon(1+w)}
\]

Energy integrals in pressure coordinates (\(R_d = 287.05\) J kg⁻¹ K⁻¹):

\[
\mathrm{CAPE} = -R_d \int_{\mathrm{LFC}}^{\mathrm{EL}} \max(T_{v,p}-T_{v,e},0)\,d\ln p
\]

\[
\mathrm{CIN} = R_d \int_{\mathrm{sfc}}^{\mathrm{LFC}} \max(T_{v,e}-T_{v,p},0)\,d\ln p
\]

LFC is the first level at or above the LCL where the parcel becomes warmer (in \(T_v\)) than the environment. EL is the last crossing back to negative buoyancy.

Reported **CIN ≥ 0**. Theoretical max updraft \(\sqrt{2\,\mathrm{CAPE}}\) ignores entrainment, water loading, and perturbation pressure — it is a ceiling, not a forecast.

### What the orange area is (and isn’t)

The fill is the region between parcel T and environmental T on the **skew-T**. That is the textbook picture of CAPE.

On a true emagram (T vs. log p, no skew) the geometric area is proportional to the integral. A skew-T warps that area. **Trust the integral for the number; trust the fill for the story.** If the orange patch fattens, CAPE went up.

### Constants

| Symbol | Value |
|---|---|
| \(R_d\) | 287.05 J kg⁻¹ K⁻¹ |
| \(R_v\) | 461.51 J kg⁻¹ K⁻¹ |
| \(\varepsilon = R_d/R_v\) | ≈ 0.622 |
| \(c_{pd}\) | 1004 J kg⁻¹ K⁻¹ |
| \(L_v\) | 2.501 × 10⁶ J kg⁻¹ (constant) |
| \(g\) | 9.80665 m s⁻² |

### Known biases vs. operational codes

- Surface-based vs. mixed-layer / most-unstable CAPE.
- Liquid-only pseudoadiabat (no ice, no retained condensate).
- Constant \(L_v\).
- No virtual-mass or hydrometeor drag.
- Soundings truncated or with missing Td in the upper troposphere change EL/CAPE.
- Geometric skew-T area ≠ J/kg.

Qualitative NWS-style bins used in the readout: <1000 weak, 1000–2500 moderate, 2500–4000 strong, ≥4000 extreme (J/kg).

## Repo map

```
index.html          app shell
css/app.css
js/thermo.js        parcel, LCL, moist adiabat, CAPE/CIN
js/skewt.js         skew-T drawing
js/soundings.js     examples, UWYO parser, fetch
js/app.js           7-step wizard, predict-first, load UI
examples/           sample UWYO text
Lab4-notes.md       student handout
INSTRUCTOR.md       keys and classroom notes
```

## Lab

Student handout: [Lab4-notes.md](Lab4-notes.md). Keys: [INSTRUCTOR.md](INSTRUCTOR.md). Predict-first is locked on (no toggle).

## Data credit

Preloaded profiles are University of Wyoming TEXT:LIST soundings for **72357 OUN Norman, 24 May 2011** (18Z high-CAPE, 12Z capped), a MetEd “all-star” case. Wyoming upper-air archive: [weather.uwyo.edu/upperair/sounding.html](https://weather.uwyo.edu/upperair/sounding.html).
