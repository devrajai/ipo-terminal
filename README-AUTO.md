# IPO Terminal — future-proof automatic mode

IPO Terminal is designed as a continuously updating research terminal rather than a one-time IPO list.

## Automatic pipeline
- `scripts/update_data.py` collects the core IPO dataset.
- `scripts/enrich_public_sources.py` adds free public subscription/listing fields when available.
- `scripts/enrich_gmp_ipoguru.py` optionally adds IPOGuru data when an API key is configured.
- `scripts/build_terminal_state.py` creates a machine-readable terminal state, event stream, field-coverage metric and change log.
- `.github/workflows/update-ipo-data.yml` runs every 15 minutes and commits changed data automatically.
- GitHub Pages redeploys after data/code changes.

## Future-proof design
The site separates **source collection → normalized IPO data → evidence/state → UI**. New sources and new IPO lifecycle fields can therefore be added without redesigning the whole website.

The event engine already understands Open, Close, Allotment and Listing dates when those fields become available. New event fields can be added to the same schema.

## Research layer
- `data/analyst-knowledge.json` defines the evidence-first Research Lens.
- `data/research-library.json` is the attributed knowledge schema for future video, podcast, transcript, PDF and note ingestion.
- User-supplied educational material can improve research explanations, but official facts remain higher priority and conflicting claims stay attributed.

## UI identity
The product direction is a compact command center:
- IPO Radar — five evidence lanes plus Signal Conflict Detector.
- Research Lens — explains why an IPO stands out and what still needs checking.
- IPO Intelligence — detailed data/provenance view.
- IPO Calendar — lifecycle event view.
- Command-center header — automatic data heartbeat, coverage and source health.

## Data integrity
Missing data is displayed as unavailable rather than guessed. GMP is unofficial and is treated as a supporting signal only.

## GitHub Pages
Enable GitHub Pages for the repository. The Pages workflow copies `index.html`, `data` and `scripts` into the deployed site and injects the enhancement modules automatically.
