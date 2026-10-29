# Production UI acceptance check — October 28, 2026

Executed against `npm run build` then `npm run start --workspace @aurorasense/web` on local loopback, using the actual rendered interface. No application code changed in this documentation milestone.

| Check | Actual result |
|---|---|
| Initial Storm Track | 10 original submissions, 7 methods, 19.9 h spread, May 11 03:00 UTC |
| Original revisions | Expanded table showed method/submitted/arrival timestamps |
| Replay start via keyboard Home | May 8 18:00 UTC, 4 submissions / 4 methods / 10.0 h spread; future rows removed |
| Shared time / reset | Tabs retained replay clock; reset restored initial event/time and cleared scripted result |
| Historical Aurora Map | Explicit missing 2024 model layer; no current grid relabeled as historical |
| Live map controls | Southern hemisphere, twilight off and Hobart selection changed displayed map/context |
| NOAA refresh | Three refreshed source manifests (OVATION, magnetic, wind), retrieved 21:51:50 UTC; successful retrieval does not itself prove product freshness |
| Ground reference | Adjusted USGS BOU F shown in nT with retrospective availability caveat |
| Synthetic raw import | 1,601 samples, 10.0 Hz, DEVICE axes, explicit SYNTHETIC PHONE SIMULATION; jump/orientation/interference/motion flags |
| Synthetic usable statistics | 1,520 usable samples; 1/6/24 h cards each partial, about 2.5 min coverage; pulse excluded |
| Invalid `{}` import | Visible unsupported schema/frame/units error; prior valid session remained |
| Scripted coordinator | INCONCLUSIVE, ten audited actions, simulated opt-in request, no model call |
| Workflow export | Downloaded JSON parsed; mode SCRIPTED_DEMO, verdict INCONCLUSIVE, ten timeline actions |
| Research | Measured four-model table, manifests, limitations and browser audit visible |
| Source/audit exports | Both downloaded files parsed as JSON with expected top-level containers |
| Why? | Advanced all five steps; source links, limitations and return control present |
| Reset with import | Import and prior audit retained as documented; scripted result cleared |
| Forget / capture instructions | Imported trace removed; native preparation instructions opened |
| Missing backend configuration | Actual HTTP POST returned 503 AGENT_NOT_CONFIGURED, mode UNAVAILABLE, modelCalled false |

Saved screenshot: [production review](screenshots/production-review-2026-10-28.png). The local production tab was left on reset Storm Track for the owner. Browser downloads contain the scripted public test scenario, not private phone exports; they were not added to the repository.

Earlier same-day UI checks covered desktop and 390 × 844 layouts, with existing screenshots in `docs/screenshots/`. This milestone repeated interactive checks on the desktop production build; it did not independently repeat every phone-width interaction, native capture or physical sensor experiment. Keyboard Home on replay was checked; a complete accessibility audit has not been performed.

Limitations remain material: no actual Meta call, real invitation, hosted auth/upload/RLS execution, live professional feed, historical OVATION, optical confirmation or phone-storm correlation. The UI tour establishes the implemented local paths, not end-to-end cloud product completion.

Runtime observation: the real wind response was 3,174,049 bytes, above Next's 2 MB fetch-cache entry limit. Refresh still completed and all three manifests exported; that raw response was not stored in Next's fetch cache. The route's CDN cache header is a separate unverified hosted behavior. Avoid rapid repeated refresh during rehearsal; managed source polling/cache integration remains open.
