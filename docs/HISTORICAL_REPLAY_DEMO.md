# Historical Replay Demo

1. Select a read-only historical time range after inspecting source distribution; do not fabricate a range or result.
2. Start `demo_fast` with a bounded tick count.
3. Set `VITE_REPLAY_RUN_ID=<run_id>` in the API frontend environment and open Dashboard, Machine Detail, or AI Model Monitor.
4. The compact Historical Replay panel receives deltas without a page refresh. Event spacing is the default; timestamps remain in the tooltip.
5. Turn off auto-follow when reviewing history. The panel retains a new-event count instead of moving the viewport.

The panel is observational. It does not change model scores, Policy v2, SQL rows, or dashboard SQL data.
