const FALLBACK_COMMOT_INTERACTIONS = [
  {
    slice: 'E12.5',
    pathway: 'TGFb',
    senderRegion: 'Mesenchyme',
    receiverRegion: 'Medial Edge Epithelium',
    downstreamTF: 'Smad5_activity_extended',
    correlation: 0.78,
    direction: 'activation'
  },
  {
    slice: 'E12.5',
    pathway: 'WNT',
    senderRegion: 'Palatal Shelf Epithelium',
    receiverRegion: 'Anterior Mesenchyme',
    downstreamTF: 'Tcf7l2_activity_extended',
    correlation: 0.74,
    direction: 'activation'
  },
  {
    slice: 'E13.5',
    pathway: 'FGF',
    senderRegion: 'Posterior Mesenchyme',
    receiverRegion: 'Periderm',
    downstreamTF: 'Etv5_activity_extended',
    correlation: 0.69,
    direction: 'activation'
  },
  {
    slice: 'E13.5',
    pathway: 'Hedgehog',
    senderRegion: 'Epithelial Ridge',
    receiverRegion: 'Neural Crest-derived Mesenchyme',
    downstreamTF: 'Gli2_activity_extended',
    correlation: 0.71,
    direction: 'activation'
  },
  {
    slice: 'E14.5',
    pathway: 'BMP',
    senderRegion: 'Medial Edge Epithelium',
    receiverRegion: 'Osteogenic Mesenchyme',
    downstreamTF: 'Runx2_activity_extended',
    correlation: 0.66,
    direction: 'activation'
  }
];

const REQUIRED_COLUMNS = [
  'slice',
  'pathway',
  'senderRegion',
  'receiverRegion',
  'downstreamTF',
  'correlation',
  'direction'
];

const parseCSVRow = (line) => {
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

    if (char === ',' && !inQuotes) {
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

  const headers = parseCSVRow(lines[0]);
  const headerIndexMap = headers.reduce((acc, header, idx) => {
    acc[header] = idx;
    return acc;
  }, {});

  const missing = REQUIRED_COLUMNS.filter(column => !(column in headerIndexMap));
  if (missing.length > 0) {
    throw new Error(`COMMOT CSV is missing columns: ${missing.join(', ')}`);
  }

  return lines.slice(1).map((line) => {
    const row = parseCSVRow(line);
    const correlationValue = Number(row[headerIndexMap.correlation]);

    return {
      slice: row[headerIndexMap.slice],
      pathway: row[headerIndexMap.pathway],
      senderRegion: row[headerIndexMap.senderRegion],
      receiverRegion: row[headerIndexMap.receiverRegion],
      downstreamTF: row[headerIndexMap.downstreamTF],
      correlation: Number.isFinite(correlationValue) ? correlationValue : 0,
      direction: row[headerIndexMap.direction] || 'unknown'
    };
  });
};

export const loadCOMMOTInteractions = async () => {
  try {
    const response = await fetch('./data/commot_interactions.csv');
    if (!response.ok) {
      return FALLBACK_COMMOT_INTERACTIONS;
    }

    const csvText = await response.text();
    const parsed = parseCOMMOTCSV(csvText);
    return parsed.length > 0 ? parsed : FALLBACK_COMMOT_INTERACTIONS;
  } catch (error) {
    console.warn('Failed to load COMMOT CSV, using fallback interactions:', error);
    return FALLBACK_COMMOT_INTERACTIONS;
  }
};

export { FALLBACK_COMMOT_INTERACTIONS };
