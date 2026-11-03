# Hackathon contribution record

Prepared October 28 – November 1, 2026 for the Indie Developer entry. This is a reviewable account of the current implementation, not independent certification of authorship or proof of competition eligibility. The owner must verify dates, ownership, contributors and any prior work before submitting.

## Newly implemented during this project session

The October 28 – November 1 implementation/progress record identifies:

- `apps/web/`: the three Next.js screens, shared Live/Replay clock, arrival-ensemble/revision display, NOAA map and viewing controls, local sensor import/QC display, **7-Step Citizen Science Journey** banner, **Prescriptive Diagnostic Evaluation** (Green/Yellow/Orange bars), **Central Citizen Magnetometer DB** (`/api/recordings`), **Meta AI Suite route** (`/api/meta`), Why? experience, Research results, audit/export, NOAA route and authenticated agent boundary.
- `apps/mobile/`: the three-screen Expo foreground recorder (`StormTrackScreen`, `AuroraMapScreen`, `GroundTruthScreen`, `SevenStepsGuidedJourney`, `MuseSparkDrawer`) with consent, native magnetic/motion/touch samples, Brian Eno *Bloom*-inspired ambient harmonic sonification, AI-assisted interference/object signature classifier, UTC/monotonic timing, cancellation, checkpoints, export/delete and prospective guided interaction cues.
- `packages/shared/`: versioned acquisition contracts, deterministic QC, capture gate, interaction annotations, interference classifier and prescriptive diagnostic evaluator with tests.
- `packages/coordinator/`: seven typed tools, authorization, regional validator, scripted replay, bounded Meta `muse-spark-1.3` / `wonder` / `image` / `sam-3.1` adapters (`runLiveMetaSparkInsight`) and Supabase budget/journal adapters with tests.
- `science/`: bounded scientific acquisition, Broomfield inspection, leakage-safe retrospective model comparison, phone-export/QC inspection and exploratory Gaussian-process/filter-transmission experiment.
- `supabase/`: proposed managed schema/RLS/private-storage/budget/summary migrations and pgTAP tests; hosted execution remains unverified.
- `.github/workflows/`, `demo/`, `docs/`: verification jobs, public source-hashed subsets, explicit synthetic fixture, measured reports, screenshots and reproduction instructions.

See `docs/progress.md` for commands, outcomes and limitations. At preparation, there is no published Git history or remote CI evidence. A later first commit establishes publication history, not proof of earlier creation time. Do not backdate commits or suggest otherwise. Preserve actual development evidence available to the owner.

## Inputs that were not created by this implementation

- Approved `goal.md`, `assets.md`, `plan.md` and the supplied concept wireframe were project inputs. They are specifications/design direction, not newly written implementation or measured evidence. Later amendments are recorded in the progress log.
- NASA, NOAA, USGS, OMNI and Broomfield records are pre-existing third-party scientific inputs. Acquisition/inspection/derived analyses are project work; the original observations/models are not ours.
- Next.js/React/Expo/React Native, TypeScript, Zod and scientific libraries are upstream dependencies, not original inventions. Lockfiles and notices preserve attribution.
- The three private phone recordings were collected by the owner on October 28 and October 31 (including the accepted 10-minute granite windowsill recording with `62.01 nT` baseline MAD). Their inspected aggregates are reported; raw records are not licensed for public distribution by their inclusion in the local workspace.
- EZIE-Mag hardware and operating guides are external resources. No paired test or calibrated comparison has been completed.

## Demo attribution and assistance

The owner should narrate and label the newly implemented features above. Describe NASA/NOAA/USGS data and framework components as inputs, not original discoveries. Identify any additional pre-existing code or collaborators before release; amend this record if discovered.

Implementation was AI-assisted using Codex; the human entrant remains responsible for review, scientific claims, ownership, licenses and the final submission. Coding agents are not human team members. List all actual human contributors in the submission portal. No claim of implemented/runtime Meta use follows from using a different vendor's coding assistant.

The browser coordinator is currently a **scripted synthetic policy demonstration**. Actual Muse Spark usage, model-chosen tool calls, model latency/cost and persisted real observation requests must be evidenced by a genuine run before that segment is represented as Meta execution. Do not use a staged badge or synthetic transcript to satisfy stage-one Meta use.

## Final recording/release gates

- Public repository, reviewed for private exports, credentials, locations and third-party rights.
- Three-minute video showing only hackathon-built work, with original contributions explicit.
- Actual Meta Model API/open-weight use that satisfies the guide's stage-one check; AuroraSense's approved path is Muse Spark 1.3.
- Honest captions for physical recordings, simulation, unavailable evidence, failed QC, retrospective scores and unexecuted cloud components.
- Accessible code/video/live-product links as requested by the final form, actual human contributors listed, and on-time receipt retained.

Primary references: [Participant Guide](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details), [Official Rules](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/waiver). The guide requires new work and clear contribution attribution; its requirements do not authorize publication, billing or accepting legal terms on the owner's behalf.
