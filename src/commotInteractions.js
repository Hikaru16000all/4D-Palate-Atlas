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
  try {
    const csvUrl = `${import.meta.env.BASE_URL}data/commot_interactions.csv`;
    const response = await fetch(csvUrl);
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
