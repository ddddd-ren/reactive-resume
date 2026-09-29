import { unzlibSync } from "fflate";

/**
 * Font bytes for Forme: WOFF files become plain sfnt, and ligatures are switched off.
 *
 * Forme 0.25 maps a ligature glyph back to only its first character in the PDF's ToUnicode table, so "Profiles"
 * set with an fi ligature extracts as "Profles" and applicant tracking systems read the wrong word
 * (danmolitor/forme#156). Renaming the GSUB `liga`, `clig`, `dlig` and `hlig` feature tags stops the shaper from
 * applying them. `rlig` stays: Arabic needs its required ligatures to be readable at all.
 * ponytail: byte patch until Forme fixes #156; drop it then.
 */

const WOFF = 0x774f4646; // "wOFF"
const LIGATURE_FEATURES = new Set(["liga", "clig", "dlig", "hlig"]);
// Any tag the shaper doesn't know works; this one says why it's there.
const DISABLED_TAG = [0x78, 0x6c, 0x69, 0x67]; // "xlig"

const tagAt = (view: DataView, offset: number) =>
	String.fromCharCode(
		view.getUint8(offset),
		view.getUint8(offset + 1),
		view.getUint8(offset + 2),
		view.getUint8(offset + 3),
	);

/** WOFF 1.0 → sfnt: inflate each table and lay them out after a fresh table directory. */
function woffToSfnt(bytes: Uint8Array): Uint8Array {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const flavor = view.getUint32(4);
	const numTables = view.getUint16(12);

	const tables: { tag: number; checksum: number; data: Uint8Array }[] = [];
	for (let index = 0; index < numTables; index++) {
		const entry = 44 + index * 20;
		const tag = view.getUint32(entry);
		const offset = view.getUint32(entry + 4);
		const compLength = view.getUint32(entry + 8);
		const origLength = view.getUint32(entry + 12);
		const checksum = view.getUint32(entry + 16);
		const stored = bytes.subarray(offset, offset + compLength);
		const data = compLength < origLength ? unzlibSync(stored) : stored;
		tables.push({ tag, checksum, data });
	}

	const headerLength = 12 + numTables * 16;
	const padded = (length: number) => (length + 3) & ~3;
	const total = tables.reduce((sum, table) => sum + padded(table.data.length), headerLength);
	const out = new Uint8Array(total);
	const outView = new DataView(out.buffer);

	let searchRange = 1;
	let entrySelector = 0;
	while (searchRange * 2 <= numTables) {
		searchRange *= 2;
		entrySelector++;
	}
	outView.setUint32(0, flavor);
	outView.setUint16(4, numTables);
	outView.setUint16(6, searchRange * 16);
	outView.setUint16(8, entrySelector);
	outView.setUint16(10, numTables * 16 - searchRange * 16);

	let dataOffset = headerLength;
	tables.forEach((table, index) => {
		const record = 12 + index * 16;
		outView.setUint32(record, table.tag);
		outView.setUint32(record + 4, table.checksum);
		outView.setUint32(record + 8, dataOffset);
		outView.setUint32(record + 12, table.data.length);
		out.set(table.data, dataOffset);
		dataOffset += padded(table.data.length);
	});
	return out;
}

/** Renames the discretionary ligature features in GSUB, in place. Returns how many it renamed. */
function disableLigatures(sfnt: Uint8Array): number {
	const view = new DataView(sfnt.buffer, sfnt.byteOffset, sfnt.byteLength);
	const numTables = view.getUint16(4);
	for (let index = 0; index < numTables; index++) {
		const record = 12 + index * 16;
		if (tagAt(view, record) !== "GSUB") continue;
		const gsub = view.getUint32(record + 8);
		const featureList = gsub + view.getUint16(gsub + 6);
		const featureCount = view.getUint16(featureList);
		let renamed = 0;
		for (let feature = 0; feature < featureCount; feature++) {
			const tag = featureList + 2 + feature * 6;
			if (!LIGATURE_FEATURES.has(tagAt(view, tag))) continue;
			sfnt.set(DISABLED_TAG, tag);
			renamed++;
		}
		return renamed;
	}
	return 0;
}

/** Font file bytes ready for Forme. Formats it can't patch (WOFF2, collections) pass through unchanged. */
export function prepareFontBytes(bytes: Uint8Array): Uint8Array {
	if (bytes.byteLength < 12) return bytes;
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const signature = view.getUint32(0);
	const sfnt = signature === WOFF ? woffToSfnt(bytes) : bytes.slice();
	const flavor = new DataView(sfnt.buffer, sfnt.byteOffset, sfnt.byteLength).getUint32(0);
	// TrueType (0x00010000, "true") and CFF ("OTTO") share the table directory layout.
	if (flavor === 0x00010000 || flavor === 0x74727565 || flavor === 0x4f54544f) disableLigatures(sfnt);
	return sfnt;
}
