const NMRP = {
  smiles: document.getElementById("nmrp-smiles-input"),
  predict: document.getElementById("nmrp-predict-button"),
  draw: document.getElementById("nmrp-draw-button"),
  status: document.getElementById("nmrp-status"),
  rdkitSummary: document.getElementById("nmrp-rdkit-summary"),
  protonSummary: document.getElementById("nmrp-proton-summary"),
  carbonSummary: document.getElementById("nmrp-carbon-summary"),
  structure: document.getElementById("nmrp-structure"),
  spectrum: document.getElementById("nmrp-spectrum"),
  table: document.getElementById("nmrp-table-body"),
  protonTab: document.getElementById("nmrp-proton-tab"),
  carbonTab: document.getElementById("nmrp-carbon-tab"),
  zoomIn: document.getElementById("nmrp-zoom-in"),
  zoomOut: document.getElementById("nmrp-zoom-out"),
  resetZoom: document.getElementById("nmrp-reset-zoom"),
  splittingMode: document.getElementById("nmrp-splitting-mode")
};

const ATOM_RE = /Cl|Br|[BCNOFPSIbcnops]/;
const HALOGENS = new Set(["F", "Cl", "Br", "I"]);
const DISPLAY_COLORS = {
  proton: "#0d6c74",
  carbon: "#d9730d"
};

const state = {
  rdkit: null,
  jsme: null,
  activeSpectrum: "proton",
  selectedSignalId: null,
  graph: null,
  predictions: { proton: [], carbon: [] },
  signalSchema: {
    nucleus: "1H | 13C",
    signalId: "stable string",
    ppm: "number",
    atomIndices: "1-based heavy-atom indices",
    integral: "1H integral; atom count for 13C",
    multiplicity: "s, d, t, q, quint, m, broad s",
    label: "short assignment explanation",
    components: "expanded stick-spectrum components"
  },
  defaultDomains: {
    proton: { min: 0, max: 12 },
    carbon: { min: 0, max: 220 }
  },
  viewDomains: {
    proton: { min: 0, max: 12 },
    carbon: { min: 0, max: 220 }
  }
};

function setPredictorStatus(message, isError = false) {
  NMRP.status.textContent = message;
  NMRP.status.style.color = isError ? "#a11d37" : "";
}

function normalizeElement(token) {
  if (token.length === 1 && token === token.toLowerCase()) {
    return token.toUpperCase();
  }
  if (token === "cl") return "Cl";
  if (token === "br") return "Br";
  return token;
}

function isAromaticToken(token) {
  return token.length === 1 && token === token.toLowerCase();
}

function parseBracketAtom(content) {
  const elementMatch = content.match(/Cl|Br|[BCNOFPSIbcno]/);
  if (!elementMatch) {
    throw new Error(`Unsupported bracket atom [${content}].`);
  }
  const hMatch = content.match(/H(\d*)/);
  return {
    element: normalizeElement(elementMatch[0]),
    aromatic: isAromaticToken(elementMatch[0]),
    bracketHydrogens: hMatch ? Number(hMatch[1] || 1) : null
  };
}

function defaultBondOrder(previousAtom, nextAtom, explicitOrder) {
  if (explicitOrder) {
    return explicitOrder;
  }
  if (previousAtom?.aromatic && nextAtom?.aromatic) {
    return 1.5;
  }
  return 1;
}

function parseSmiles(smiles) {
  const atoms = [];
  const bonds = [];
  const branches = [];
  const rings = new Map();
  let current = null;
  let pendingBond = null;

  const addAtom = (atom) => {
    atom.id = atoms.length;
    atom.bonds = [];
    atoms.push(atom);
    if (current !== null) {
      const previous = atoms[current];
      const order = defaultBondOrder(previous, atom, pendingBond);
      const bond = { from: current, to: atom.id, order };
      bonds.push(bond);
      previous.bonds.push(bond);
      atom.bonds.push(bond);
    }
    current = atom.id;
    pendingBond = null;
  };

  for (let i = 0; i < smiles.length; i += 1) {
    const char = smiles[i];
    if (char === "(") {
      branches.push(current);
      continue;
    }
    if (char === ")") {
      current = branches.pop();
      continue;
    }
    if (char === "=") {
      pendingBond = 2;
      continue;
    }
    if (char === "#") {
      pendingBond = 3;
      continue;
    }
    if (char === "-" || char === "/" || char === "\\") {
      pendingBond = 1;
      continue;
    }
    if (/[0-9]/.test(char)) {
      if (current === null) {
        throw new Error("Ring closure appeared before an atom.");
      }
      if (rings.has(char)) {
        const ring = rings.get(char);
        const atom = atoms[current];
        const previous = atoms[ring.atomId];
        const order = defaultBondOrder(previous, atom, pendingBond || ring.bondOrder);
        const bond = { from: ring.atomId, to: current, order };
        bonds.push(bond);
        previous.bonds.push(bond);
        atom.bonds.push(bond);
        rings.delete(char);
      } else {
        rings.set(char, { atomId: current, bondOrder: pendingBond });
      }
      pendingBond = null;
      continue;
    }
    if (char === "[") {
      const end = smiles.indexOf("]", i);
      if (end === -1) {
        throw new Error("Unclosed bracket atom.");
      }
      addAtom(parseBracketAtom(smiles.slice(i + 1, end)));
      i = end;
      continue;
    }
    const pair = smiles.slice(i, i + 2);
    const token = ATOM_RE.test(pair) && (pair === "Cl" || pair === "Br") ? pair : char;
    if (ATOM_RE.test(token)) {
      addAtom({
        element: normalizeElement(token),
        aromatic: isAromaticToken(token),
        bracketHydrogens: null
      });
      if (token.length === 2) {
        i += 1;
      }
      continue;
    }
    throw new Error(`Unsupported SMILES token "${char}".`);
  }

  if (rings.size) {
    throw new Error("Unclosed ring in SMILES.");
  }

  assignImplicitHydrogens(atoms);
  return { atoms, bonds };
}

function bondOrderSum(atom) {
  return atom.bonds.reduce((sum, bond) => sum + bond.order, 0);
}

function typicalValence(atom) {
  if (atom.aromatic && atom.element === "C") return 4;
  if (atom.element === "C") return 4;
  if (atom.element === "N") return atom.aromatic ? 3 : 3;
  if (atom.element === "O") return 2;
  if (atom.element === "S") return 2;
  if (atom.element === "P") return 3;
  if (HALOGENS.has(atom.element)) return 1;
  return 0;
}

function assignImplicitHydrogens(atoms) {
  atoms.forEach((atom) => {
    if (atom.bracketHydrogens !== null) {
      atom.hydrogens = atom.bracketHydrogens;
      return;
    }
    const raw = typicalValence(atom) - bondOrderSum(atom);
    atom.hydrogens = Math.max(0, Math.round(raw));
  });
}

function otherAtom(graph, bond, atomId) {
  return graph.atoms[bond.from === atomId ? bond.to : bond.from];
}

function neighbors(graph, atom) {
  return atom.bonds.map((bond) => ({ atom: otherAtom(graph, bond, atom.id), bond }));
}

function hasBondTo(graph, atom, element, order = null) {
  return neighbors(graph, atom).some(({ atom: n, bond }) => n.element === element && (order === null || bond.order === order));
}

function isCarbonylCarbon(graph, atom) {
  return atom.element === "C" && hasBondTo(graph, atom, "O", 2);
}

function isCarboxylCarbon(graph, atom) {
  if (!isCarbonylCarbon(graph, atom)) return false;
  return neighbors(graph, atom).some(({ atom: n, bond }) => bond.order === 1 && n.element === "O");
}

function isAttachedToCarbonyl(graph, atom) {
  return neighbors(graph, atom).some(({ atom: n }) => isCarbonylCarbon(graph, n));
}

function isAlkeneCarbon(graph, atom) {
  return atom.element === "C" && atom.bonds.some((bond) => bond.order === 2 && otherAtom(graph, bond, atom.id).element === "C");
}

function isAlkyneCarbon(graph, atom) {
  return atom.element === "C" && atom.bonds.some((bond) => bond.order === 3 && otherAtom(graph, bond, atom.id).element === "C");
}

function carbonDegree(graph, atom) {
  return neighbors(graph, atom).filter(({ atom: n }) => n.element === "C").length;
}

function adjacentHydrogens(graph, atom) {
  if (atom.element !== "C") {
    return 0;
  }
  return neighbors(graph, atom)
    .filter(({ atom: n, bond }) => n.element === "C" && bond.order === 1)
    .reduce((sum, { atom: n }) => sum + n.hydrogens, 0);
}

function shortestPathDistances(graph, sourceId) {
  const distances = Array(graph.atoms.length).fill(Infinity);
  const queue = [sourceId];
  distances[sourceId] = 0;
  for (let index = 0; index < queue.length; index += 1) {
    const atomId = queue[index];
    for (const { atom } of neighbors(graph, graph.atoms[atomId])) {
      if (distances[atom.id] === Infinity) {
        distances[atom.id] = distances[atomId] + 1;
        queue.push(atom.id);
      }
    }
  }
  return distances;
}

function computeDistanceMatrix(graph) {
  // RDKit's GetDistanceMatrix is mirrored here as a small topological BFS matrix,
  // because this static GitHub Pages app cannot run a Python RDKit backend.
  return graph.atoms.map((atom) => shortestPathDistances(graph, atom.id));
}

function distanceWeight(distance) {
  if (distance === 1) return 1.0;
  if (distance === 2) return 0.45;
  if (distance === 3) return 0.20;
  if (distance >= 4 && distance < Infinity) return 0.05;
  return 0;
}

function classifyFunctionalGroups(graph) {
  const groups = [];
  graph.atoms.forEach((atom) => {
    if (isCarbonylCarbon(graph, atom)) {
      groups.push({ type: "carbonyl", atomId: atom.id, effectH: 0.65, effectC: 10 });
    }
    if (atom.element === "O") {
      groups.push({ type: "alcohol/ether O", atomId: atom.id, effectH: 0.75, effectC: 18 });
    }
    if (atom.element === "N") {
      groups.push({ type: "amine N", atomId: atom.id, effectH: 0.42, effectC: 10 });
    }
    if (HALOGENS.has(atom.element)) {
      groups.push({ type: "halogen", atomId: atom.id, effectH: 0.55, effectC: 14 });
    }
    if (atom.element === "C" && hasBondTo(graph, atom, "N", 3)) {
      groups.push({ type: "nitrile", atomId: atom.id, effectH: 0.38, effectC: 8 });
    }
    if (atom.aromatic) {
      groups.push({ type: "aromatic ring", atomId: atom.id, effectH: 0.08, effectC: 3 });
    }
    if (isAlkeneCarbon(graph, atom)) {
      groups.push({ type: "alkene", atomId: atom.id, effectH: 0.25, effectC: 6 });
    }
  });
  return groups;
}

function estimatePartialCharges(graph) {
  // A compact Gasteiger-like teaching approximation: electronegative atoms pull
  // charge from neighbours, and carbonyl/pi bonds add small polarization terms.
  const electronegativity = { C: 2.55, H: 2.20, N: 3.04, O: 3.44, F: 3.98, Cl: 3.16, Br: 2.96, I: 2.66, S: 2.58, P: 2.19 };
  const charges = Array(graph.atoms.length).fill(0);
  graph.atoms.forEach((atom) => {
    neighbors(graph, atom).forEach(({ atom: n, bond }) => {
      if (atom.id > n.id) return;
      const delta = ((electronegativity[n.element] || 2.5) - (electronegativity[atom.element] || 2.5)) * 0.035 * bond.order;
      charges[atom.id] += delta;
      charges[n.id] -= delta;
    });
  });
  graph.atoms.forEach((atom) => {
    if (isCarbonylCarbon(graph, atom)) {
      charges[atom.id] += 0.08;
      neighbors(graph, atom)
        .filter(({ atom: n, bond }) => n.element === "O" && bond.order === 2)
        .forEach(({ atom: oxygen }) => {
          charges[oxygen.id] -= 0.08;
        });
    }
  });
  return charges;
}

function stableHash(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function atomFeatureKey(graph, atom) {
  const neighbourBits = neighbors(graph, atom)
    .map(({ atom: n, bond }) => `${n.element}${n.aromatic ? "ar" : ""}:${bond.order}:${n.hydrogens}`)
    .sort()
    .join(",");
  return [
    atom.element,
    atom.aromatic ? "aromatic" : "aliphatic",
    `H${atom.hydrogens}`,
    `bo${bondOrderSum(atom).toFixed(1)}`,
    `deg${carbonDegree(graph, atom)}`,
    isCarbonylCarbon(graph, atom) ? "carbonyl" : "",
    isAlkeneCarbon(graph, atom) ? "alkene" : "",
    isAlkyneCarbon(graph, atom) ? "alkyne" : "",
    neighbourBits
  ].join("|");
}

function baseProtonShift(graph, atom) {
  if (atom.element === "O") {
    if (neighbors(graph, atom).some(({ atom: n }) => isCarboxylCarbon(graph, n))) {
      return { ppm: 11.4, label: "acid OH base range 10-13", broad: true };
    }
    return { ppm: 2.7, label: "exchangeable alcohol/phenol OH", broad: true };
  }
  if (atom.element === "N") return { ppm: 3.0, label: "exchangeable amine/amidic NH", broad: true };
  if (atom.element === "S") return { ppm: 2.0, label: "exchangeable thiol SH", broad: true };
  if (isCarbonylCarbon(graph, atom) && atom.hydrogens > 0) return { ppm: 9.6, label: "aldehyde C-H base range 9.0-10.2" };
  if (atom.aromatic) return { ppm: 7.25, label: "aromatic C-H base range 6.5-8.0" };
  if (isAlkeneCarbon(graph, atom)) return { ppm: 5.45, label: "vinylic C-H base range 4.5-6.5" };
  if (isAlkyneCarbon(graph, atom)) return { ppm: 2.35, label: "alkynyl C-H" };
  if (neighbors(graph, atom).some(({ atom: n }) => n.aromatic)) return { ppm: 2.35, label: "benzylic C-H base range 1.8-3.0" };
  if (neighbors(graph, atom).some(({ bond }) => bond.order === 2)) return { ppm: 2.05, label: "allylic C-H base range 1.8-3.0" };
  if (neighbors(graph, atom).some(({ atom: n }) => ["O", "N"].includes(n.element) || HALOGENS.has(n.element))) {
    return { ppm: 3.55, label: "alpha to O/N/X base range 3.0-4.5" };
  }
  const degree = carbonDegree(graph, atom);
  return { ppm: degree <= 1 ? 0.95 : degree === 2 ? 1.30 : 1.55, label: "alkyl sp3 C-H base range 0.9-1.7" };
}

function baseCarbonShift(graph, atom) {
  if (isCarbonylCarbon(graph, atom)) {
    if (isCarboxylCarbon(graph, atom)) return { ppm: 172, label: "carboxyl/ester carbonyl base range 160-220" };
    if (atom.hydrogens > 0) return { ppm: 198, label: "aldehyde carbonyl base range 160-220" };
    return { ppm: 205, label: "ketone carbonyl base range 160-220" };
  }
  if (atom.aromatic || isAlkeneCarbon(graph, atom)) return { ppm: atom.aromatic ? 128 : 122, label: "alkene/aromatic sp2 base range 110-160" };
  if (isAlkyneCarbon(graph, atom)) return { ppm: 78, label: "alkyne carbon" };
  if (neighbors(graph, atom).some(({ atom: n }) => ["O", "N"].includes(n.element) || HALOGENS.has(n.element))) {
    return { ppm: 58, label: "C attached to O/N/X base range 45-85" };
  }
  const degree = carbonDegree(graph, atom);
  return { ppm: degree <= 1 ? 14 : degree === 2 ? 25 : degree === 3 ? 35 : 40, label: "alkyl sp3 base range 10-40" };
}

function correctionForAtom(graph, atom, nucleus, context) {
  const { groups, distances, charges } = context;
  let ppm = 0;
  const labels = [];
  groups.forEach((group) => {
    const distance = distances[atom.id][group.atomId];
    if (distance === 0) return;
    const effect = nucleus === "1H" ? group.effectH : group.effectC;
    const contribution = distanceWeight(distance) * effect;
    if (Math.abs(contribution) >= 0.01) {
      ppm += contribution;
      if (distance <= 3) labels.push(`${group.type} d${distance}`);
    }
  });

  const ownCharge = charges[atom.id] || 0;
  const neighbourCharge = neighbors(graph, atom).reduce((sum, { atom: n }) => sum + (charges[n.id] || 0), 0) / Math.max(neighbors(graph, atom).length, 1);
  ppm += nucleus === "1H" ? (ownCharge * 0.28 + neighbourCharge * 0.16) : (ownCharge * 5.5 + neighbourCharge * 2.0);

  if (atom.aromatic) ppm += nucleus === "1H" ? 0.18 : 3.0;
  if (neighbors(graph, atom).some(({ atom: n }) => n.aromatic || isAlkeneCarbon(graph, n))) {
    ppm += nucleus === "1H" ? 0.10 : 1.5;
  }
  return { ppm, labels };
}

function binomialWeights(n) {
  const weights = [1];
  for (let row = 0; row < n; row += 1) {
    for (let i = weights.length - 1; i > 0; i -= 1) {
      weights[i] += weights[i - 1];
    }
    weights.push(1);
  }
  return weights;
}

function multiplicityLabel(n) {
  if (n <= 0) return "s";
  if (n === 1) return "d";
  if (n === 2) return "t";
  if (n === 3) return "q";
  if (n === 4) return "quint";
  return "m";
}

function mergeEnvironmentKeys(items) {
  const map = new Map();
  for (const item of items) {
    const current = map.get(item.environmentKey);
    if (current) {
      current.integration += item.integration;
      current.atomIds.push(...item.atomIds);
      current.sourcePpm.push(item.rawPpm);
    } else {
      map.set(item.environmentKey, { ...item, atomIds: [...item.atomIds], sourcePpm: [item.rawPpm] });
    }
  }
  const grouped = Array.from(map.values()).map((item) => ({
    ...item,
    ppm: item.sourcePpm.reduce((sum, value) => sum + value, 0) / item.sourcePpm.length
  }));
  return applyTieBreaking(grouped).sort((a, b) => b.ppm - a.ppm);
}

function applyTieBreaking(signals) {
  const exactGroups = new Map();
  signals.forEach((signal) => {
    const key = `${signal.nucleus}|${signal.ppm.toFixed(4)}`;
    const bucket = exactGroups.get(key) || [];
    bucket.push(signal);
    exactGroups.set(key, bucket);
  });
  exactGroups.forEach((bucket) => {
    const uniqueKeys = new Set(bucket.map((signal) => signal.environmentKey));
    if (uniqueKeys.size <= 1) return;
    bucket.forEach((signal) => {
      const offset = ((stableHash(signal.environmentKey) % 7) - 3) * 0.01;
      signal.ppm += offset;
      signal.label = `${signal.label}; tiny deterministic tie-break ${offset >= 0 ? "+" : ""}${offset.toFixed(2)} ppm`;
    });
  });
  return signals;
}

function predictEnvironments(graph) {
  const context = {
    distances: computeDistanceMatrix(graph),
    groups: classifyFunctionalGroups(graph),
    charges: estimatePartialCharges(graph)
  };
  const protonItems = [];
  const carbonItems = [];

  graph.atoms.forEach((atom) => {
    if (atom.hydrogens > 0 && ["C", "O", "N", "S"].includes(atom.element)) {
      const base = baseProtonShift(graph, atom);
      if (base) {
        const correction = correctionForAtom(graph, atom, "1H", context);
        const n = base.broad || NMRP.splittingMode.value === "beginner" ? 0 : adjacentHydrogens(graph, atom);
        const environmentKey = `1H|${atomFeatureKey(graph, atom)}|n${n}|${base.broad ? "broad" : "sharp"}`;
        protonItems.push({
          nucleus: "1H",
          atomIds: [atom.id + 1],
          rawPpm: clampShift(base.ppm + correction.ppm, "1H"),
          integration: atom.hydrogens,
          multiplicity: base.broad ? "broad s" : multiplicityLabel(n),
          neighborH: n,
          broad: Boolean(base.broad),
          environmentKey,
          signalId: `H-${stableHash(environmentKey).toString(16)}`,
          label: [base.label, ...correction.labels].join("; ")
        });
      }
    }
    if (atom.element === "C") {
      const base = baseCarbonShift(graph, atom);
      const correction = correctionForAtom(graph, atom, "13C", context);
      const environmentKey = `13C|${atomFeatureKey(graph, atom)}`;
      carbonItems.push({
        nucleus: "13C",
        atomIds: [atom.id + 1],
        rawPpm: clampShift(base.ppm + correction.ppm, "13C"),
        integration: 1,
        multiplicity: "s",
        neighborH: 0,
        broad: false,
        environmentKey,
        signalId: `C-${stableHash(environmentKey).toString(16)}`,
        label: [base.label, ...correction.labels].join("; ")
      });
    }
  });

  return {
    proton: attachComponents(mergeEnvironmentKeys(protonItems), "proton"),
    carbon: attachComponents(mergeEnvironmentKeys(carbonItems), "carbon")
  };
}

function clampShift(ppm, nucleus) {
  if (nucleus === "13C") return Math.min(220, Math.max(0, ppm));
  return Math.min(13, Math.max(0, ppm));
}

function gaussian(x, center, fwhm) {
  const sigma = fwhm / 2.354820045;
  const z = (x - center) / sigma;
  return Math.exp(-0.5 * z * z);
}

function expandPeaks(environments, type) {
  const peaks = [];
  environments.forEach((env) => {
    if (type === "carbon") {
      peaks.push({ ppm: env.ppm, intensity: 1, env });
      return;
    }
    const jPpm = env.broad ? 0.035 : 7 / 400;
    const n = Math.max(0, Math.min(env.neighborH, 6));
    const weights = env.broad ? [1] : binomialWeights(n);
    const offsetCenter = (weights.length - 1) / 2;
    weights.forEach((weight, index) => {
      peaks.push({
        ppm: env.ppm + (index - offsetCenter) * jPpm,
        intensity: weight * env.integration,
        env
      });
    });
  });
  return peaks;
}

function attachComponents(signals, type) {
  return signals.map((signal) => {
    const components = expandPeaks([signal], type).map((peak) => ({
      ppm: Number(peak.ppm.toFixed(4)),
      relativeIntensity: peak.intensity
    }));
    return { ...signal, components };
  });
}

function renderSpectrum(environments, type) {
  if (!environments.length) {
    NMRP.spectrum.innerHTML = '<div class="plot-empty">No predicted signals for this nucleus.</div>';
    return;
  }
  const width = Math.max(NMRP.spectrum.clientWidth || 500, 360);
  const height = Math.max(NMRP.spectrum.clientHeight || 360, 300);
  const fullDomain = state.defaultDomains[type];
  const domain = state.viewDomains[type] || fullDomain;
  const margin = { top: 22, right: 22, bottom: 46, left: 42 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const color = type === "carbon" ? DISPLAY_COLORS.carbon : DISPLAY_COLORS.proton;
  const peaks = expandPeaks(environments, type);
  const fwhm = type === "carbon" ? 0.55 : 0.035;
  const sampleCount = 900;
  const values = Array.from({ length: sampleCount }, (_, index) => {
    const ppm = domain.min + ((domain.max - domain.min) * index) / (sampleCount - 1);
    const y = peaks.reduce((sum, peak) => sum + peak.intensity * gaussian(ppm, peak.ppm, fwhm), 0);
    return { ppm, y };
  });
  const maxY = values.reduce((max, point) => Math.max(max, point.y), 0) || 1;
  const xToPx = (ppm) => margin.left + ((domain.max - ppm) / (domain.max - domain.min)) * plotWidth;
  const yToPx = (value) => margin.top + plotHeight - (value / maxY) * plotHeight;
  const line = values.map((point) => `${xToPx(point.ppm).toFixed(2)},${yToPx(point.y).toFixed(2)}`).join(" ");
  const fill = `${margin.left},${margin.top + plotHeight} ${line} ${margin.left + plotWidth},${margin.top + plotHeight}`;
  const tickCount = type === "carbon" ? 8 : 7;
  const ticks = Array.from({ length: tickCount }, (_, index) => {
    const frac = index / (tickCount - 1);
    const ppm = domain.max - frac * (domain.max - domain.min);
    const x = margin.left + frac * plotWidth;
    return `<line x1="${x}" y1="${margin.top}" x2="${x}" y2="${margin.top + plotHeight}" stroke="rgba(24,36,45,0.08)"></line><text x="${x}" y="${height - 18}" text-anchor="middle" font-size="11" fill="#56646f">${ppm.toFixed(type === "carbon" ? 0 : 1)}</text>`;
  }).join("");
  const sticks = peaks.map((peak) => {
    if (peak.ppm < domain.min || peak.ppm > domain.max) {
      return "";
    }
    const x = xToPx(peak.ppm);
    const y = yToPx((peak.intensity / Math.max(...peaks.map((p) => p.intensity))) * maxY);
    const selected = peak.env.signalId === state.selectedSignalId;
    return `<line class="nmrp-peak" data-signal-id="${peak.env.signalId}" x1="${x.toFixed(2)}" y1="${margin.top + plotHeight}" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}" stroke="${selected ? "#a11d37" : color}" stroke-width="${selected ? 4 : type === "carbon" ? 2.2 : 1.4}" opacity="${selected ? 1 : 0.75}"><title>${peak.env.nucleus} ${peak.env.ppm.toFixed(2)} ppm, atoms ${peak.env.atomIds.join(", ")}</title></line>`;
  }).join("");

  const rangeText = `${domain.max.toFixed(type === "carbon" ? 0 : 2)} to ${domain.min.toFixed(type === "carbon" ? 0 : 2)} ppm`;
  NMRP.spectrum.innerHTML = `<svg class="plot-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><rect x="${margin.left}" y="${margin.top}" width="${plotWidth}" height="${plotHeight}" rx="14" fill="rgba(255,255,255,0.72)"></rect>${ticks}<line x1="${margin.left}" y1="${margin.top + plotHeight}" x2="${margin.left + plotWidth}" y2="${margin.top + plotHeight}" stroke="#23343f"></line><line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotHeight}" stroke="#23343f"></line><polygon points="${fill}" fill="${type === "carbon" ? "rgba(217,115,13,0.14)" : "rgba(13,108,116,0.14)"}"></polygon><polyline points="${line}" fill="none" stroke="${color}" stroke-width="2.3" stroke-linejoin="round"></polyline>${sticks}<text x="${margin.left + plotWidth / 2}" y="${height - 2}" text-anchor="middle" font-size="12" fill="#18242d">Chemical shift (ppm)</text><text x="${margin.left + 8}" y="${margin.top + 14}" font-size="12" fill="#18242d">${type === "carbon" ? "13C" : "1H"} predicted spectrum</text><text x="${width - 24}" y="${margin.top + 14}" text-anchor="end" font-size="11" fill="#56646f">${rangeText}</text></svg>`;
  bindPeakEvents();
}

function bindPeakEvents() {
  NMRP.spectrum.querySelectorAll(".nmrp-peak").forEach((peak) => {
    peak.addEventListener("click", (event) => {
      event.stopPropagation();
      selectSignal(peak.dataset.signalId);
    });
  });
}

function zoomSpectrum(factor, centerPpm = null) {
  const type = state.activeSpectrum;
  const full = state.defaultDomains[type];
  const current = state.viewDomains[type];
  const span = current.max - current.min;
  const minimumSpan = type === "carbon" ? 8 : 0.25;
  const nextSpan = Math.min(full.max - full.min, Math.max(minimumSpan, span * factor));
  const center = centerPpm ?? (current.min + current.max) / 2;
  let min = center - nextSpan / 2;
  let max = center + nextSpan / 2;
  if (min < full.min) {
    max += full.min - min;
    min = full.min;
  }
  if (max > full.max) {
    min -= max - full.max;
    max = full.max;
  }
  state.viewDomains[type] = {
    min: Math.max(full.min, min),
    max: Math.min(full.max, max)
  };
  renderActiveSpectrum();
}

function resetSpectrumZoom(type = state.activeSpectrum) {
  state.viewDomains[type] = { ...state.defaultDomains[type] };
  renderActiveSpectrum();
}

function ppmFromPointer(event) {
  const rect = NMRP.spectrum.getBoundingClientRect();
  const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
  const domain = state.viewDomains[state.activeSpectrum];
  return domain.max - fraction * (domain.max - domain.min);
}

function renderAssignments() {
  const all = [...state.predictions.proton, ...state.predictions.carbon];
  if (!all.length) {
    NMRP.table.innerHTML = '<tr><td colspan="6">No assignments.</td></tr>';
    return;
  }
  NMRP.table.innerHTML = all.map((item) => `
    <tr class="nmrp-assignment-row ${item.signalId === state.selectedSignalId ? "is-selected" : ""}" data-signal-id="${item.signalId}">
      <td>${item.nucleus}</td>
      <td>${item.atomIds.join(", ")}</td>
      <td>${item.ppm.toFixed(2)} ppm</td>
      <td>${item.nucleus === "1H" ? item.integration.toFixed(0) : item.atomIds.length.toFixed(0)}</td>
      <td>${item.multiplicity}</td>
      <td>${item.label}</td>
    </tr>
  `).join("");
  NMRP.table.querySelectorAll(".nmrp-assignment-row").forEach((row) => {
    row.addEventListener("click", () => selectSignal(row.dataset.signalId));
  });
}

function renderActiveSpectrum() {
  const type = state.activeSpectrum;
  NMRP.protonTab.classList.toggle("nav-link-active", type === "proton");
  NMRP.carbonTab.classList.toggle("nav-link-active", type === "carbon");
  renderSpectrum(state.predictions[type], type);
}

function tryRenderRdkit(smiles) {
  if (!state.rdkit) {
    NMRP.structure.innerHTML = '<div class="plot-empty">RDKit structure rendering unavailable. Prediction still uses the SMILES graph.</div>';
    return;
  }
  let mol = null;
  try {
    mol = state.rdkit.get_mol(smiles);
    if (!mol) {
      throw new Error("RDKit could not parse SMILES.");
    }
    const selected = getSelectedSignal();
    if (selected && mol.get_svg_with_highlights) {
      const details = JSON.stringify({
        atoms: selected.atomIds.map((id) => id - 1),
        highlightColour: [0.85, 0.12, 0.22]
      });
      NMRP.structure.innerHTML = mol.get_svg_with_highlights(details);
    } else {
      NMRP.structure.innerHTML = mol.get_svg();
    }
    if (selected) {
      NMRP.structure.insertAdjacentHTML("beforeend", `<div class="nmrp-highlight-note">Selected atoms: ${selected.atomIds.join(", ")}</div>`);
    }
  } catch (error) {
    NMRP.structure.innerHTML = `<div class="plot-empty">${error.message}</div>`;
  } finally {
    if (mol?.delete) {
      mol.delete();
    }
  }
}

function getSelectedSignal() {
  return [...state.predictions.proton, ...state.predictions.carbon].find((signal) => signal.signalId === state.selectedSignalId) || null;
}

function selectSignal(signalId) {
  state.selectedSignalId = signalId;
  if (state.graph) {
    tryRenderRdkit(NMRP.smiles.value.trim());
  }
  renderAssignments();
  renderActiveSpectrum();
}

function predictNmr() {
  const smiles = NMRP.smiles.value.trim();
  if (!smiles) {
    setPredictorStatus("Enter a SMILES string.", true);
    return;
  }
  try {
    const graph = parseSmiles(smiles);
    const predictions = predictEnvironments(graph);
    state.graph = graph;
    state.predictions = predictions;
    state.selectedSignalId = null;
    state.viewDomains = {
      proton: { ...state.defaultDomains.proton },
      carbon: { ...state.defaultDomains.carbon }
    };
    NMRP.protonSummary.textContent = String(predictions.proton.length);
    NMRP.carbonSummary.textContent = String(predictions.carbon.length);
    tryRenderRdkit(smiles);
    renderAssignments();
    renderActiveSpectrum();
    setPredictorStatus(`Predicted ${predictions.proton.length} proton and ${predictions.carbon.length} carbon environments from teaching rules.`);
  } catch (error) {
    setPredictorStatus(error.message || "Could not predict this structure.", true);
  }
}

function sendSmilesToJsme() {
  if (!state.jsme) {
    setPredictorStatus("JSME is not available yet. You can still type SMILES directly.", true);
    return;
  }
  const smiles = NMRP.smiles.value.trim();
  if (state.jsme.readGenericMolecularInput) {
    state.jsme.readGenericMolecularInput(smiles);
  } else if (state.jsme.readMolecule) {
    state.jsme.readMolecule(smiles);
  }
}

function initialiseJsme(attempt = 0) {
  if (!window.JSApplet?.JSME) {
    if (attempt < 25) {
      window.setTimeout(() => initialiseJsme(attempt + 1), 200);
      return;
    }
    document.getElementById("jsme-container").innerHTML = '<div class="plot-empty">JSME did not load. Use the SMILES box directly.</div>';
    return;
  }
  document.getElementById("jsme-container").innerHTML = "";
  state.jsme = new window.JSApplet.JSME("jsme-container", "100%", "360px", {
    options: "oldlook,star"
  });
  if (state.jsme.setCallBack) {
    state.jsme.setCallBack("AfterStructureModified", () => {
      if (state.jsme.smiles) {
        NMRP.smiles.value = state.jsme.smiles();
        predictNmr();
      }
    });
  }
  sendSmilesToJsme();
}

function initialiseRdkit() {
  if (!window.initRDKitModule) {
    NMRP.rdkitSummary.textContent = "unavailable";
    return Promise.resolve();
  }
  return window.initRDKitModule()
    .then((rdkit) => {
      state.rdkit = rdkit;
      NMRP.rdkitSummary.textContent = "loaded";
    })
    .catch(() => {
      NMRP.rdkitSummary.textContent = "unavailable";
    });
}

NMRP.predict.addEventListener("click", predictNmr);
NMRP.draw.addEventListener("click", sendSmilesToJsme);
NMRP.smiles.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    predictNmr();
  }
});
NMRP.protonTab.addEventListener("click", () => {
  state.activeSpectrum = "proton";
  renderActiveSpectrum();
});
NMRP.carbonTab.addEventListener("click", () => {
  state.activeSpectrum = "carbon";
  renderActiveSpectrum();
});
NMRP.zoomIn.addEventListener("click", () => zoomSpectrum(0.5));
NMRP.zoomOut.addEventListener("click", () => zoomSpectrum(2));
NMRP.resetZoom.addEventListener("click", () => resetSpectrumZoom());
NMRP.splittingMode.addEventListener("change", predictNmr);
NMRP.spectrum.addEventListener("wheel", (event) => {
  event.preventDefault();
  zoomSpectrum(event.deltaY > 0 ? 1.25 : 0.8, ppmFromPointer(event));
}, { passive: false });
NMRP.spectrum.addEventListener("dblclick", () => resetSpectrumZoom());
document.querySelectorAll(".nmr-example").forEach((button) => {
  button.addEventListener("click", () => {
    NMRP.smiles.value = button.dataset.smiles;
    sendSmilesToJsme();
    predictNmr();
  });
});
window.addEventListener("resize", renderActiveSpectrum);

window.addEventListener("load", () => {
  initialiseJsme();
  initialiseRdkit().then(predictNmr);
});
