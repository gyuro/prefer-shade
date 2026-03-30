# Prefer Shade 🌿

Walk the shadiest path to your destination.

**[Live app →](https://gyuro.github.io/prefer-shade/)**

Prefer Shade is a pedestrian routing app that computes shadow polygons from real building heights and sun position, then finds the walking route with the most shade coverage.

## How it works

1. **Shadow casting** — Building footprints and heights are fetched from OpenStreetMap (Overpass API). For a given date and time, sun altitude and azimuth are computed with SunCalc, and each building casts a shadow polygon using flat-earth displacement math.
2. **Route scoring** — The fastest walking route is fetched from OpenStreetMap's OSRM foot-routing server. Each route is sampled every 6 m and checked against a spatial index of shadow polygons, producing a shade score (0–100%).
3. **Shade optimisation** — The app probes ±45 m perpendicular to the route at every 100 m interval. If a shadier parallel street is found (≥ 5 shade-point improvement, within the detour cap), an alternative route is fetched through that corridor. OSRM's own geometric alternatives are also scored and the shadiest is presented.
4. **Shade timeline** — After a route is found, the shade score is recomputed for every hour of the day (5 am – 9 pm) using the same pipeline, showing when the route is shadiest.

## Features

- Shadow-optimised pedestrian routing
- Configurable shade priority: Speed / Balanced / Max Shade
- Adjustable max-detour slider (5 %–50 %)
- Shade-by-time-of-day chart with best window recommendation
- Date & time picker — plan a future walk
- GPS auto-centering on page load
- "Navigate in Google Maps" with route waypoints
- Entirely free — no API keys required

## Tech stack

| Layer | Library |
|---|---|
| Framework | Next.js 14 (static export) |
| Map | MapLibre GL + react-map-gl |
| Tiles | OpenFreeMap (liberty style) |
| Routing | OSRM (routing.openstreetmap.de/routed-foot) |
| Geocoding | Photon (photon.komoot.io) |
| Buildings | Overpass API |
| Shadow math | SunCalc + custom flat-earth geometry |
| Spatial index | Custom R-tree-like bounding-box index |
| Geometry | Turf.js (convex hull only) |
| Hosting | GitHub Pages via GitHub Actions |

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000/prefer-shade](http://localhost:3000/prefer-shade).

No API keys or `.env` file needed — all data sources are free and public.

## Deployment

Pushes to `main` automatically deploy to GitHub Pages via `.github/workflows/deploy.yml`.

## License

MIT — see [LICENSE](LICENSE).
