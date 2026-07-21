// The timeline/map prototype reads the committed, geocoded viz dataset
// (built by scripts/build-viz-data.mjs). Prerendered — inherits prerender=true
// from the root +layout.js, so this is a fully static page.
import data from '$lib/data/timeline_clips.json';

export function load() {
	return data; // { meta, places, clips }
}
