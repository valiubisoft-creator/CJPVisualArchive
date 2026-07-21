/**
 * geo.js — projection + packing helpers for the timeline/map prototype. No geo libs.
 *
 * Delhi is a small bbox, so an equirectangular (linear) projection is visually exact;
 * the only correction is squeezing longitude by cos(centreLat) so the map isn't
 * stretched east-west. The SAME projector is used for the boundary path AND the dot
 * anchors, so everything stays registered.
 */

/** Simplified Delhi NCT outer ring [lng,lat] (decimated from udit-001/india-maps-data). */
export const DELHI_RING = [
	[77.228, 28.76993], [77.26069, 28.73415], [77.2895, 28.70891], [77.33101, 28.71308],
	[77.32349, 28.67665], [77.34243, 28.622], [77.31337, 28.59654], [77.29702, 28.56603],
	[77.33698, 28.50545], [77.25369, 28.48285], [77.23293, 28.45783], [77.23059, 28.41591],
	[77.17636, 28.40493], [77.12369, 28.44532], [77.09125, 28.51226], [77.00718, 28.54123],
	[76.94984, 28.50458], [76.84526, 28.55023], [76.88834, 28.63187], [76.92493, 28.64987],
	[76.97189, 28.6975], [76.9558, 28.76729], [76.97968, 28.82128], [77.08269, 28.88362],
	[77.228, 28.76993]
];

/**
 * Aspect-fit equirectangular projector for a lng/lat bbox into a width×height box.
 * @param {{latMin:number,latMax:number,lngMin:number,lngMax:number}} bbox
 * @param {number} width @param {number} height @param {number} [pad]
 * @returns {(lng:number, lat:number) => {x:number,y:number}}
 */
export function makeProjection(bbox, width, height, pad = 24) {
	const { latMin, latMax, lngMin, lngMax } = bbox;
	const k = Math.cos(((latMin + latMax) / 2) * Math.PI / 180); // lon squeeze (~0.878 at Delhi)
	const geoW = (lngMax - lngMin) * k;
	const geoH = latMax - latMin;
	const scale = Math.min((width - 2 * pad) / geoW, (height - 2 * pad) / geoH);
	const offX = (width - geoW * scale) / 2;
	const offY = (height - geoH * scale) / 2;
	return (lng, lat) => ({
		x: offX + (lng - lngMin) * k * scale,
		y: offY + (latMax - lat) * scale // SVG y grows down → flip latitude
	});
}

/** SVG path "d" for a ring of [lng,lat] under a projector. */
export function ringPath(ring, project) {
	return 'M' + ring.map(([lng, lat]) => { const p = project(lng, lat); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join('L') + 'Z';
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5)); // ~2.39996 rad

/**
 * Phyllotaxis (sunflower) offset for the i-th of n items — a tidy, non-overlapping disc
 * around (0,0). Deterministic, so positions are stable across renders (no jump on scrub).
 * @param {number} i @param {number} spacing px between neighbours
 * @returns {{dx:number, dy:number, r:number}}
 */
export function phyllotaxis(i, spacing = 3.2) {
	const r = spacing * Math.sqrt(i + 0.5);
	const a = i * GOLDEN;
	return { dx: r * Math.cos(a), dy: r * Math.sin(a), r };
}

/** Fraction [0,1] of a date within [first,last]. */
export function dateFraction(date, first, last) {
	const t = Date.parse(date), a = Date.parse(first), b = Date.parse(last);
	if (!Number.isFinite(t) || !(b > a)) return 0;
	return Math.min(1, Math.max(0, (t - a) / (b - a)));
}

/** Inverse: fraction [0,1] → epoch ms within [first,last]. */
export function fractionToTime(frac, first, last) {
	const a = Date.parse(first), b = Date.parse(last);
	return a + Math.min(1, Math.max(0, frac)) * (b - a);
}
