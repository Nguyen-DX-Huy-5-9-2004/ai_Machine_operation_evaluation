# Dashboard and Machine Detail UI Review

## Baseline capture

`artifacts/ui_review/before/dashboard_1366x768.png` was captured from the mock server using Edge headless. It showed the shell and a persistent loading state, so it is not accepted as a presentation-quality dashboard capture.

## Replay UI changes

- `ReplayLivePanel` is shared by Dashboard, API Machine Detail and AI Model Monitor.
- It uses cursor-based deltas, an SSE connection, bounded client cache, event spacing, Brush and auto-follow/new-event handling.
- `useAdaptiveEventViewport` limits rendered points by actual panel width and preserves critical/anomaly/quality/energy points during downsampling.

## Outstanding visual acceptance

Final screenshots cannot be responsibly approved until a credentialed replay run supplies API data. The required screenshots must be collected after `start_demo_tomorrow.ps1` succeeds; only then can Dashboard and Machine Detail layout, tooltip, marker density, live append and console/network state be reviewed against real events.
