# lightweight-charts v5 marker API note

- In lightweight-charts v5, transition/event markers should be set with `createSeriesMarkers(series, markers)` from the markers plugin package.
- Relying on older `series.setMarkers(...)` behavior can result in markers not rendering in v5 setups.
- For the CASH chart, this migration is used for the `"New Venue"` transition marker in `web/components/price-chart.tsx`.
