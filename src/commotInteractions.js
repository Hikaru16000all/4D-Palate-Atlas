import Papa from 'papaparse';

const cache = new Map();
let indexPromise;
const base = () => `${import.meta.env.BASE_URL}data/commot/`;
export const SOURCE_COLUMNS = ['Stage','batch','signal_type','pathway','pathwayLabel','ligand','receptor','ligand_receptor_pair','senderRegion','receiverRegion','interactionStrength','interactionPValue','edge_rank_within_signal','downstreamTF','tf_rank','correlation','tfPValue','tfFDR','direction','tfSelectionMode','clusterResultKey'];

export function parseTableCSV(text, required = SOURCE_COLUMNS) {
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: 'greedy', dynamicTyping: false });
  if (parsed.errors.length) throw new Error(`Invalid Table S3 CSV: ${parsed.errors[0].message}`);
  const missing = required.filter(key => !parsed.meta.fields?.includes(key));
  if (missing.length) throw new Error(`Missing source columns: ${missing.join(', ')}`);
  return parsed.data;
}
export function sourceNumber(value) {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
export const loadCOMMOTIndex = () => {
  if (!indexPromise) indexPromise = fetch(`${base()}index.json`).then(async response => {
    if (!response.ok) throw new Error(`Table S3 index unavailable (${response.status}).`);
    const data = await response.json();
    if (data.version !== '2.0' || !data.slices?.length) throw new Error('The full Table S3 index is unavailable.');
    return data;
  }).catch(error => { indexPromise = null; throw error; });
  return indexPromise;
};
async function loadFile(slice, kind) {
  const key = `${slice}:${kind}`;
  if (!cache.has(key)) cache.set(key, (async () => {
    const index = await loadCOMMOTIndex();
    const entry = index.slices.find(item => item.slice === slice);
    if (!entry) throw new Error(`No Table S3 data for ${slice}.`);
    const response = await fetch(`${base()}${entry[`${kind}File`]}`);
    if (!response.ok) throw new Error(`Table S3 data unavailable (${response.status}). Please retry.`);
    const rows = parseTableCSV(await response.text(), kind === 'detail' ? SOURCE_COLUMNS : ['Stage','batch','signal_type','pathway','receiverRegion','n_significant_edges','n_tf_exported']);
    if (rows.length !== entry[`${kind}Rows`] || rows.some(row => row.Stage !== entry.sourceStage)) throw new Error('Table S3 row count or stage does not match the source manifest.');
    return kind === 'summary' ? rows : rows.map((row, i) => ({ ...row, slice, signalType: row.signal_type, _id: `${slice}:${i + 2}`, _sourceRow: i + 2 }));
  })().catch(error => { cache.delete(key); throw error; }));
  return cache.get(key);
}
export const loadCOMMOTInteractionsBySlice = slice => loadFile(slice, 'detail');
export const loadCOMMOTSummaryBySlice = slice => loadFile(slice, 'summary');
export const loadCOMMOTInteractions = async () => (await Promise.all((await loadCOMMOTIndex()).slices.map(entry => loadCOMMOTInteractionsBySlice(entry.slice)))).flat();

// Export only original source fields, retaining stored decimal strings and original source order.
export function exportTableCSV(rows) {
  return Papa.unparse({ fields: SOURCE_COLUMNS, data: [...rows].sort((a,b) => a._sourceRow - b._sourceRow).map(row => SOURCE_COLUMNS.map(key => row[key] ?? '')) });
}
