# KidneyAI Design Direction

## Three Initial Approaches

### Theme Name: Clinical Signal
Very brief intro: A calm radiology workstation language with navy depth, warm clinical surfaces, and cyan signal accents. It makes the AI pipeline feel precise, trustworthy, and ready for real-world review.
Probability: 0.07

### Theme Name: Paper + Scan
Very brief intro: An editorial medical-research interface that pairs off-white paper tones with dark graphite imaging panels and restrained teal markers. It emphasizes academic clarity and portfolio-quality presentation.
Probability: 0.04

### Theme Name: Quiet Instrument
Very brief intro: An ultra-minimal instrument-panel aesthetic with pale gray surfaces, hairline rules, and a single sea-glass accent. It prioritizes data readability and a low cognitive load.
Probability: 0.02

## Chosen Approach: Clinical Signal

### Design Read
- Artifact: responsive medical AI analysis dashboard and demo workstation
- Audience: university evaluators, portfolio reviewers, and technical users reviewing an AI-assisted CT workflow
- Visual language: clinical radiology workstation with editorial product polish
- Mode: greenfield, frontend-only demo with future Flask API seams
- Visual variance: 6/10
- Motion intensity: 4/10
- Information density: 8/10 on results, 5/10 on onboarding
- Asset dependence: 7/10
- Brand fidelity: 6/10 for the new KidneyAI identity

### Design Movement
Contemporary Swiss information design translated into a clinical imaging workstation: strict hierarchy, asymmetric composition, purposeful negative space, and a small number of high-signal accents.

### Core Principles
1. Make the scan the visual anchor; the UI should frame, label, and interpret it rather than compete with it.
2. Use density intentionally: a quiet introduction, then compact evidence blocks once the user is in analysis or results.
3. Treat confidence as a model signal, not a diagnosis; every claim stays scoped and medically responsible.
4. Give future extensibility a visible place without pretending unavailable U-Net functionality is live.

### Color Philosophy
Deep navy and ink-black create a calm workstation backdrop that keeps CT imagery legible. Warm bone surfaces prevent the product from feeling cold or overly technical. Cyan-teal is reserved for active signal, interaction, and detection overlays; muted seafoam confirms completed system states. Orange is limited to warnings and red is reserved for true errors. No ornamental neon or gradient-heavy decoration.

### Layout Paradigm
A persistent compact rail on desktop, a contextual top bar on tablet, and a bottom-sheet navigation pattern on mobile. Main content uses a two-column workstation composition: narrative and controls on the left, scan context or evidence on the right. Results use a large imaging canvas paired with a narrow evidence rail instead of a wall of centered cards.

### Signature Elements
- A thin cyan "signal rail" that marks active sections and model states.
- Scan metadata written in small uppercase labels with monospaced numeric readouts.
- A split visual language: warm clinical cards for decisions, dark imaging canvases for evidence.

### Interaction Philosophy
Interactions should feel like operating a medical instrument: obvious affordances, low drama, reliable feedback, and reversible actions. Uploading, analyzing, comparing, downloading, and resetting all provide explicit states. Hover and press feedback are brief and physical; no decorative interaction blocks the scan.

### Animation
Use 180–260ms ease-out transitions for controls, subtle opacity/translate entrances for sections, and a single restrained pulse for live AI status. Processing uses a sequential step rail with a quiet moving indicator rather than a bouncing loader. Confidence fills animate once on result entry. Respect `prefers-reduced-motion` by removing nonessential movement and preserving state changes.

### Typography System
Use **Space Grotesk** for display headings and product labels, with **DM Sans** for body copy and controls. Use **IBM Plex Mono** for scan metadata, bounding-box coordinates, timestamps, and confidence readouts. Headings use tight tracking and sentence case; supporting copy stays readable at 14–16px; numeric evidence gets tabular figures and a clear baseline.

### Brand Essence
KidneyAI is a calm, transparent AI workstation for demonstrating kidney stone detection from CT images—different because it makes the evidence and the model boundary visible. Personality: precise, composed, forward-looking.

### Brand Voice
Headlines are direct and clinical without sounding bureaucratic. CTAs describe the next action instead of overselling AI. Microcopy distinguishes detection confidence from diagnosis and labels demo data honestly.

Example lines:
- “Review the signal, not the noise.”
- “Run a demo detection on a CT image.”

### Wordmark & Logo
A compact wordmark paired with a symbol built from a kidney-like contour, a scan reticle, and three linked nodes. The mark is used as a standalone signal tile in the rail and as a small lockup in the header; it should never be replaced by a generic medical cross.

### Signature Brand Color
**Signal Cyan — `#5FE0D2`**, a cool sea-glass cyan used sparingly for active analysis, detection overlays, and the brand mark. It is ownable because it sits between clinical teal and instrument phosphor without becoming neon.

## Design Decisions
- Primary palette: `#08151D` ink navy, `#102A34` deep slate, `#F4F1EA` warm bone, `#D9E5E1` mist, `#5FE0D2` signal cyan, `#B9E6C8` success seafoam, `#F4B37B` warning amber.
- Typography: Space Grotesk / DM Sans / IBM Plex Mono.
- Spacing: 4px base unit, with 8, 12, 16, 24, 32, 48, and 64px rhythm.
- Radius: 12px for primary panels, 8px for controls, 999px only for pills and status dots.
- Shadow: restrained dark shadow on light surfaces; no glow except a very soft active-state halo.
- Motion: ease-out `cubic-bezier(0.23, 1, 0.32, 1)`, mostly 180–260ms; sequencing only for page entry, processing, and result reveal.
- Accessibility: visible focus rings, strong contrast, semantic buttons, keyboard-reachable upload flow, descriptive image labels, and reduced-motion support.

## Asset Notes
Generated assets are referenced through the project lifecycle URLs in the implementation. The visual system uses the generated KidneyAI mark for branding, a CT hero visual for the dashboard introduction, a scan-card visual for model context, a future-pipeline illustration for extensibility, and a low-contrast DICOM texture for dark workstation depth.
