# Exoplanetary System Orrery

An interactive simulator that procedurally generates physically plausible
exoplanetary systems — from a collapsing cloud of gas all the way to the
atmospheres of the worlds it leaves behind — and then lets you watch those
worlds orbit in real time, scaled to their true orbital periods.

Every system is grown from a random seed using real astrophysical
relationships (Kepler's third law, the mass–luminosity relation, the Roche
limit, Jeans escape, blackbody equilibrium…), simplified where needed so the
result is always legible and always possible.

---

## What you can do

- **Click any planet (or its orbit ring, or the star)** to open a scan panel
  with three sections: *Orbital Characteristics*, *Physical Characteristics*
  and *Atmosphere* — including a live ephemeris (mean anomaly, true anomaly
  and star-planet distance solved from Kepler's equation as the sim runs).
- **Play / pause** the simulation (or press `Space`).
- **Change the rate**: 0.5× = 0.5 simulated days per second, up to
  50× = 50 days per second.
- **Zoom** the system in and out (60–150%).
- **Generate a new system** with the `NEW SYSTEM` button or the `N` key —
  a short formation sequence runs through all eight pipeline stages.
- **Hop between worlds** with the `←` / `→` arrow keys; `Esc` closes the panel.

---

## How a system is generated — step by step

The generator runs an eight-stage pipeline. Each system starts from a random
seed, so the same seed always reproduces the same system.

### Step 1 — Parent nebula (initial conditions)

Everything begins in a cold molecular-cloud core:

- **Cloud mass** is drawn from an IMF-like distribution (small cores are
  common, giant ones rare): roughly 2–130 solar masses.
- **Metallicity `[Fe/H]`** is drawn between −1.6 and +0.5 dex. This sets the
  ratio of heavy elements (rock and ice) to hydrogen and helium — a
  metal-poor cloud makes fewer rocky worlds and fewer giant planets.
- **Angular momentum** sets a spin factor that scales how wide the resulting
  disk can be.

### Step 2 — Star and protoplanetary disk formation

- Only **25–45% of the cloud collapses into the star** — star formation is
  inefficient. The stellar mass therefore comes *from the cloud mass*, and
  the star's spectral type (M → O), temperature, luminosity (`L ∝ M^3.5`)
  and radius (`R ∝ M^0.85`) are all derived from it.
- The **leftover gas feeds the protoplanetary disk**; a small capture
  fraction of it becomes the disk's real mass, converted to Earth masses.
- **Disk lifetime scales inversely with stellar mass**: fierce UV/X-ray
  radiation photo-evaporates disks around massive stars. M-dwarfs keep
  theirs ~10 Myr, Sun-like stars ~3–5 Myr, O/B blue giants less than
  1 Myr (`t_disk ≈ 9 · (0.4/M★)^1.1`, clamped to 0.3–12 Myr).

### Step 3 — The time check & formation mode

- The star's main-sequence lifespan (`10 · M^−2.5` Gyr) and the disk
  lifetime are compared against the time core accretion needs (~1–10 Myr).
- **If the star is an O- or B-type blue giant, rocky planet formation is
  disabled entirely** — the star's radiation blows the dust away before
  rocky cores can assemble. Such systems form only gas giants via
  **gravitational disk instability**, far out where the disk is cold and
  massive (22–55 AU).
- Even for normal stars, gas giants require the disk to survive > 2.2 Myr
  and ice giants > 1.2 Myr; shorter-lived disks produce only rocky/icy
  worlds.
- Otherwise the mode is **core accretion** — dust grinds into embryos,
  embryos into planets.

### Step 4 — Orbital architecture & accretion

- The disk's solid material is distributed into planetary embryos. **More
  metals → more rocky embryos**; metal-poor systems (`[Fe/H] < −0.5`) skip
  many of them and host fewer worlds overall.
- Embryos are spaced geometrically (each orbit 1.35–1.9× the previous),
  starting outside the **Roche-safe floor** (≥ 3× the fluid Roche limit, so
  tides can never shred a world) and never inside the readable-motion
  floor.
- Every world's mass is drawn against a **strict budget** carved from the
  disk mass — if the budget runs dry, embryos are trimmed or abandoned.
  You cannot get ten Jupiters from a disk that only held two.

### Step 5 — Classification by the frost line

Worlds are categorized by where they sit relative to the **frost line**
(`2.7 · √L★` AU), the distance where water and other volatiles freeze:

- **Inside**: terrestrial worlds — lava, rocky, desert, ocean and
  super-Earth types (ocean worlds are likelier when metals are plentiful).
- **Outside**: ice giants or gas giants, depending on how much gas they
  accreted before the disk dissipated; worlds that missed both become ice
  worlds.

### Step 6 — Orbital dynamics & migration

- **Migration**: giant planets interact with the gas disk and drift inward
  (gas giants keep 50–92% of their birth distance; rocky worlds barely
  move), then the system is re-sorted by distance.
- **Resonances**: near-rational period ratios (3:2, 5:3, 2:1, 5:2) are
  snapped into exact mean-motion locks, as real migrating planets do.
- **Stability**: eccentricities are biased low, clamped so no periapsis ever
  approaches the Roche limit, and mutually trimmed so neighbouring apsidal
  corridors never cross. Finally a **Hill-stability pass** removes any
  world closer than ~3.5 mutual Hill radii to its neighbour — unstable
  planets are scattered and ejected from the system.

### Step 7 — Atmospheric evolution & stellar stripping

- Each world gets an atmosphere model: **Jeans escape** decides which gases
  its gravity can hold at the exospheric temperature; volcanic feedstock,
  CO₂ photolysis, water-vapor saturation (Magnus formula), ⁴⁰Ar
  accumulation with system age, and condensation/cold-trap rules set the
  **composition by volume** (the ten most abundant species) and the
  **surface pressure**. Rotation drives dynamo shielding and circulation
  regime; obliquity sets the seasonal pressure swing.
- **Stellar stripping**: young O/B stars and flaring M-dwarfs bombard
  close-in planets with X-ray/UV flux (∝ 1/a²). Weak-gravity worlds lose
  their air; a close-in giant can lose its *entire envelope*, collapsing
  into a **chthonian world** — the exposed iron–silicate core of a former
  giant, rebuilt at core density with a fresh tenuous atmosphere.

### Step 8 — Final validation

- The summed planetary mass is checked against the disk it formed from —
  if it ever exceeds the disk mass, the most massive giant is removed until
  the budget balances.
- The cleared-gap debris belt (the asteroid belt, placed strictly inside the
  widest apsidal gap so it can never intersect an orbit) and all final
  records are assembled, and the star's field note is annotated with its
  birth cloud, metallicity and disk lifetime.

---

## How the simulation works

- Orbits use full Keplerian elements (`a`, `e`, `i`, `Ω`, `ω`). Each frame
  the mean anomaly `M(t)` is advanced, Kepler's equation is solved for the
  eccentric anomaly (Newton iteration), and the planet's position is
  projected through its orbital frame — so worlds genuinely race through
  periapsis and crawl through apoapsis.
- Distances are compressed with a power law so Mercury-like and
  Neptune-like orbits share one screen; **periods are true to ratio**.
- Axial tilt leans rings and cloud bands, rotation speed sets band drift,
  flattening squashes fast-spinning giants, surface pressure sizes each
  world's haze shell, and a per-frame terminator keeps every night side
  facing the star.
- A dark-grey graticule marks the system's **invariable plane** — the plane
  perpendicular to the total orbital angular momentum (the fossil orientation
  of the protoplanetary disk). Its spacing is **linear only**: a single
  constant pixels-per-AU step (the outermost orbit maps to the chart's outer
  ring), so every cell is exactly **1 AU** everywhere on the sheet — on very
  tight charts the step jumps to a uniform 2 AU multiple rather than
  distorting. The sheet runs to the horizon and gives an absolute
  orientation cue across camera views —
  a full sheet in top view, a line edge-on. Like the HZ it sits beneath
  every layer needed to read the simulation.
- A faint green annulus marks the star's circumstellar habitable zone
  (`0.95–1.67 AU × √L★`). It is drawn as the bottom layer of the stage —
  beneath the belt, orbit rings, markers, motion trails, star and planets —
  with a deliberately near-invisible fill so it never covers a world or an
  orbit you need to read. The zone is always rendered, even when no world
  orbits inside it: around dim stars the compressed band is anchored just
  outside the star's limb so it never vanishes. Its inner edge is clipped
  at the star's fluid Roche limit — a region where tides shred bodies
  cannot, by definition, be habitable — and the scan panel reports the
  clipped edge as such.

## Tech

React + TypeScript + Vite, Tailwind CSS, canvas starfield/trails/belt,
SVG orbit geometry. Seeded `mulberry32` PRNG keeps every system
reproducible by its seed.
