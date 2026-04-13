const FALLBACK_COMMOT_INTERACTIONS = [
  {
    slice: 'E12.5',
    ligand: 'Inhba',
    receptor: 'Acvr1b_Acvr2a',
    signalType: 'lr_pair',
    parentSignalId: 'pathway:ACTIVIN',
    pathway: 'TGFb',
    senderRegion: 'Mesenchyme',
    receiverRegion: 'Medial Edge Epithelium',
    downstreamTF: 'Smad5_activity_extended',
    correlation: 0.78,
    direction: 'activation'
  },
  {
    slice: 'E12.5',
    ligand: 'Wnt10a',
    receptor: 'Fzd7',
    signalType: 'lr_pair',
    parentSignalId: 'pathway:WNT',
    pathway: 'WNT',
    senderRegion: 'Palatal Shelf Epithelium',
    receiverRegion: 'Anterior Mesenchyme',
    downstreamTF: 'Tcf7l2_activity_extended',
    correlation: 0.74,
    direction: 'activation'
  },
  {
    slice: 'E13.5',
    ligand: 'Fgf8',
    receptor: 'Fgfr2',
    signalType: 'lr_pair',
    parentSignalId: 'pathway:FGF',
    pathway: 'FGF',
    senderRegion: 'Posterior Mesenchyme',
    receiverRegion: 'Periderm',
    downstreamTF: 'Etv5_activity_extended',
    correlation: 0.69,
    direction: 'activation'
  },
  {
    slice: 'E13.5',
    ligand: 'Ihh',
    receptor: 'Ptch1',
    signalType: 'lr_pair',
    parentSignalId: 'pathway:HEDGEHOG',
    pathway: 'Hedgehog',
    senderRegion: 'Epithelial Ridge',
    receiverRegion: 'Neural Crest-derived Mesenchyme',
    downstreamTF: 'Gli2_activity_extended',
    correlation: 0.71,
    direction: 'activation'
  },
  {
    slice: 'E14.5',
    ligand: 'Bmp4',
    receptor: 'Bmpr2',
    signalType: 'lr_pair',
    parentSignalId: 'pathway:BMP',
    pathway: 'BMP',
    senderRegion: 'Medial Edge Epithelium',
    receiverRegion: 'Osteogenic Mesenchyme',
    downstreamTF: 'Runx2_activity_extended',
    correlation: 0.66,
    direction: 'activation'
  }
];

const REQUIRED_COLUMNS = [
  ['slice'],
  ['ligand'],
  ['receptor'],
  ['signal_type', 'signalType'],
  ['parent_signal_id', 'parentSignalId'],
  ['pathway'],
  ['sender_region', 'senderRegion'],
  ['receiver_region', 'receiverRegion'],
  ['downstreamTF', 'downstream_tf', 'downstreamTf'],
  ['direction']
];

const parseDelimitedRow = (line, delimiter = ',') => {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
};

const parseCOMMOTCSV = (csvText) => {
  const lines = csvText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error('COMMOT CSV needs at least header + 1 row');
  }

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const headers = parseDelimitedRow(lines[0], delimiter);
  const normalizedHeaderMap = headers.reduce((acc, header, idx) => {
    acc[header.trim()] = idx;
    return acc;
  }, {});

  const resolveHeaderIndex = (candidates) => {
    for (const candidate of candidates) {
      if (candidate in normalizedHeaderMap) return normalizedHeaderMap[candidate];
    }
    return undefined;
  };

  const missing = REQUIRED_COLUMNS.filter(candidates => resolveHeaderIndex(candidates) === undefined);
  if (missing.length > 0) {
    throw new Error(
      `COMMOT CSV is missing columns: ${missing.map(candidates => candidates[0]).join(', ')}`
    );
  }

  const indexMap = {
    slice: resolveHeaderIndex(['slice']),
    ligand: resolveHeaderIndex(['ligand']),
    receptor: resolveHeaderIndex(['receptor']),
    signalType: resolveHeaderIndex(['signal_type', 'signalType']),
    parentSignalId: resolveHeaderIndex(['parent_signal_id', 'parentSignalId']),
    pathway: resolveHeaderIndex(['pathway']),
    senderRegion: resolveHeaderIndex(['sender_region', 'senderRegion']),
    receiverRegion: resolveHeaderIndex(['receiver_region', 'receiverRegion']),
    downstreamTF: resolveHeaderIndex(['downstreamTF', 'downstream_tf', 'downstreamTf']),
    direction: resolveHeaderIndex(['direction']),
    correlation: resolveHeaderIndex(['correlation', 'rawCorrelation'])
  };

  return lines.slice(1).map((line) => {
    const row = parseDelimitedRow(line, delimiter);
    const correlationColumnIndex = indexMap.correlation;
    const correlationValue = Number(
      correlationColumnIndex !== undefined ? row[correlationColumnIndex] : 0
    );

    return {
      slice: row[indexMap.slice] || 'Unknown',
      ligand: row[indexMap.ligand] || 'Unknown',
      receptor: row[indexMap.receptor] || 'Unknown',
      signalType: row[indexMap.signalType] || 'Unknown',
      parentSignalId: row[indexMap.parentSignalId] || 'Unknown',
      pathway: row[indexMap.pathway] || 'Unknown',
      senderRegion: row[indexMap.senderRegion] || 'Unknown',
      receiverRegion: row[indexMap.receiverRegion] || 'Unknown',
      downstreamTF: row[indexMap.downstreamTF] || 'Unknown',
      correlation: Number.isFinite(correlationValue) ? correlationValue : 0,
      direction: row[indexMap.direction] || 'unknown'
    };
  });
};

export const loadCOMMOTInteractions = async () => {
  const index = await loadCOMMOTIndex();
  const sliceEntries = index?.slices || [];

  if (sliceEntries.length === 0) {
    return FALLBACK_COMMOT_INTERACTIONS;
  }

  const allData = await Promise.all(
    sliceEntries.map(entry => loadCOMMOTInteractionsBySlice(entry.slice))
  );

  return allData.flat();
};

let commotIndexCache = null;
const commotSliceCache = new Map();

export const loadCOMMOTIndex = async () => {
  if (commotIndexCache) return commotIndexCache;

  try {
    const indexUrl = `${import.meta.env.BASE_URL}data/commot/index.json`;
    const response = await fetch(indexUrl);
    if (!response.ok) {
      commotIndexCache = {
        version: 'fallback',
        slices: [{ slice: 'E125', file: 'commot_interactions.csv', rows: FALLBACK_COMMOT_INTERACTIONS.length }]
      };
      return commotIndexCache;
    }

    commotIndexCache = await response.json();
    return commotIndexCache;
  } catch (error) {
    console.warn('Failed to load COMMOT index, using fallback interactions:', error);
    commotIndexCache = {
      version: 'fallback',
      slices: [{ slice: 'E125', file: 'commot_interactions.csv', rows: FALLBACK_COMMOT_INTERACTIONS.length }]
    };
    return commotIndexCache;
  }
};

export const loadCOMMOTInteractionsBySlice = async (slice) => {
  if (!slice) return [];
  if (commotSliceCache.has(slice)) return commotSliceCache.get(slice);

  const index = await loadCOMMOTIndex();
  const sliceEntry = (index?.slices || []).find(entry => entry.slice === slice);

  if (!sliceEntry) {
    const fallback = FALLBACK_COMMOT_INTERACTIONS.filter(item => item.slice === slice);
    commotSliceCache.set(slice, fallback);
    return fallback;
  }

  try {
    const filePath = sliceEntry.file === 'commot_interactions.csv'
      ? `${import.meta.env.BASE_URL}data/commot_interactions.csv`
      : `${import.meta.env.BASE_URL}data/commot/${sliceEntry.file}`;
    const response = await fetch(filePath);
    if (!response.ok) {
      const fallback = FALLBACK_COMMOT_INTERACTIONS.filter(item => item.slice === slice);
      commotSliceCache.set(slice, fallback);
      return fallback;
    }

    const csvText = await response.text();
    const parsed = parseCOMMOTCSV(csvText).filter(item => item.slice === slice);
    const result = parsed.length > 0 ? parsed : FALLBACK_COMMOT_INTERACTIONS.filter(item => item.slice === slice);
    commotSliceCache.set(slice, result);
    return result;
  } catch (error) {
    console.warn(`Failed to load COMMOT slice ${slice}, using fallback interactions:`, error);
    const fallback = FALLBACK_COMMOT_INTERACTIONS.filter(item => item.slice === slice);
    commotSliceCache.set(slice, fallback);
    return fallback;
  }
};

export { FALLBACK_COMMOT_INTERACTIONS };
