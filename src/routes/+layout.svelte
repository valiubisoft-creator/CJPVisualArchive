<script>
	import '$lib/styles/fonts.css';
	import '$lib/styles/tokens.css';
	import '$lib/styles/base.css';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';
	import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';

	// Vercel Web Analytics + Speed Insights (cookieless, no PII). SvelteKit entry
	// points — NOT the /next paths. Data only flows once both are enabled in the
	// Vercel project dashboard; in dev they run in debug mode and send nothing.
	injectAnalytics();
	injectSpeedInsights();

	let { children } = $props();
</script>

{@render children()}
