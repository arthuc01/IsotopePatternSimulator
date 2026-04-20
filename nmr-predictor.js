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
  resetZoom: document.getElementById("nmrp-reset-zoom")
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

function adjacentHydrogenEnvironments(graph, atom) {
  if (atom.element !== "C") {
    return [];
  }
  if (atom.aromatic) {
    return aromaticHydrogenEnvironments(graph, atom);
  }
  const groups = new Map();
  neighbors(graph, atom)
    .filter(({ atom: n, bond }) => n.element === "C" && bond.order === 1 && n.hydrogens > 0)
    .forEach(({ atom: n, bond }) => {
      const key = atomFeatureKey(graph, n);
      const current = groups.get(key) || { count: 0, atomIds: [], jHz: estimateJHz(graph, atom, n, bond) };
      current.count += n.hydrogens;
      current.atomIds.push(n.id + 1);
      groups.set(key, current);
    });
  return Array.from(groups.values())
    .sort((a, b) => b.count - a.count || a.atomIds[0] - b.atomIds[0])
    .slice(0, 3);
}

function aromaticHydrogenEnvironments(graph, atom) {
  // Teaching approximation for aromatic splitting: keep only ortho coupling.
  // Meta/para couplings are real but omitted here to keep spectra readable.
  const distances = shortestPathDistances(graph, atom.id);
  const orthoAtoms = graph.atoms
    .filter((candidate) => candidate.id !== atom.id && candidate.element === "C" && candidate.aromatic && candidate.hydrogens > 0)
    .filter((candidate) => distances[candidate.id] === 1);
  if (!orthoAtoms.length) {
    return [];
  }
  return [{
    count: 1,
    atomIds: orthoAtoms.map((candidate) => candidate.id + 1),
    jHz: 8.0,
    label: "ortho"
  }];
}

function estimateJHz(graph, atom, neighbour, bond) {
  if (bond.order !== 1) return 0;
  if (atom.aromatic || neighbour.aromatic) return 7.5;
  if (isAlkeneCarbon(graph, atom) || isAlkeneCarbon(graph, neighbour)) return 7.0;
  return 7.0;
}

function multiplicityFromEnvironments(environments) {
  if (!environments.length) return "s";
  return environments.map((environment) => multiplicityLabel(environment.count)).join("");
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
      groups.push({ type: "alcohol/ether O", atomId: atom.id, effectH: 0.55, effectC: 18 });
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
  return [
    atom.element,
    atom.aromatic ? "aromatic" : "aliphatic",
    `H${atom.hydrogens}`,
    `bo${bondOrderSum(atom).toFixed(1)}`,
    `deg${carbonDegree(graph, atom)}`,
    isCarbonylCarbon(graph, atom) ? "carbonyl" : "",
    isAlkeneCarbon(graph, atom) ? "alkene" : "",
    isAlkyneCarbon(graph, atom) ? "alkyne" : "",
  ].join("|");
}

function radiusEnvironmentKey(graph, atom, radius = 3) {
  // Morgan-like teaching signature: repeatedly fold sorted neighbour signatures
  // into each atom key. This separates ortho/meta/para-type environments before
  // any ppm calculation, instead of relying on shift similarity.
  let signatures = graph.atoms.map((entry) => atomFeatureKey(graph, entry));
  for (let level = 1; level <= radius; level += 1) {
    signatures = graph.atoms.map((entry) => {
      const neighbourSignatures = neighbors(graph, entry)
        .map(({ atom: n, bond }) => `${bond.order}:${signatures[n.id]}`)
        .sort()
        .join(",");
      return `r${level}(${signatures[entry.id]}->[${neighbourSignatures}])`;
    });
  }
  return signatures[atom.id];
}

function baseProtonShift(graph, atom) {
  if (atom.element === "O") {
    if (neighbors(graph, atom).some(({ atom: n }) => isCarboxylCarbon(graph, n))) {
      return { ppm: 11.4, label: "acid OH base range 10-13", broad: true };
    }
    if (neighbors(graph, atom).some(({ atom: n }) => n.aromatic)) {
      return { ppm: 5.6, label: "exchangeable phenol OH, often broad/variable", broad: true };
    }
    return { ppm: 4.8, label: "exchangeable alcohol OH, often broad/variable", broad: true };
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
    return { ppm: 3.05, label: "alpha to O/N/X base range 3.0-4.5" };
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
  })).map(normalizeSignalSplitting);
  return applyTieBreaking(grouped).sort((a, b) => b.ppm - a.ppm);
}

function normalizeSignalSplitting(signal) {
  if (signal.nucleus !== "1H" || signal.broad || !signal.splitEnvironments?.length) {
    return signal;
  }
  const memberAtoms = new Set(signal.atomIds);
  const splitEnvironments = signal.splitEnvironments
    .map((environment) => {
      const atomIds = environment.atomIds.filter((atomId) => !memberAtoms.has(atomId));
      const count = environment.label === "ortho" ? 1 : environment.label ? atomIds.length : environment.count;
      return { ...environment, atomIds, count };
    })
    .filter((environment) => environment.count > 0);
  return {
    ...signal,
    splitEnvironments,
    neighborH: splitEnvironments.reduce((sum, environment) => sum + environment.count, 0),
    multiplicity: multiplicityFromEnvironments(splitEnvironments)
  };
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
        const splitEnvironments = base.broad ? [] : adjacentHydrogenEnvironments(graph, atom);
        const n = splitEnvironments.reduce((sum, environment) => sum + environment.count, 0);
        const splitKey = splitEnvironments.map((environment) => `${environment.label || "adj"}:${environment.count}:${environment.jHz.toFixed(1)}`).join("/");
        const environmentKey = `1H|${radiusEnvironmentKey(graph, atom, 3)}|split:${splitKey}|${base.broad ? "broad" : "sharp"}`;
        protonItems.push({
          nucleus: "1H",
          atomIds: [atom.id + 1],
          rawPpm: clampShift(base.ppm + correction.ppm, "1H"),
          integration: atom.hydrogens,
          multiplicity: base.broad ? "broad s" : multiplicityFromEnvironments(splitEnvironments),
          neighborH: n,
          splitEnvironments,
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
      const environmentKey = `13C|${radiusEnvironmentKey(graph, atom, 3)}`;
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
      peaks.push({ ppm: env.ppm, intensity: 1, env, fwhm: 0.55 });
      return;
    }
    let components = [{ offsetHz: 0, intensity: 1 }];
    const splitEnvironments = env.broad ? [] : (env.splitEnvironments || []).slice(0, 3);
    splitEnvironments.forEach((splitEnvironment) => {
      const weights = binomialWeights(Math.max(0, Math.min(splitEnvironment.count, 6)));
      const center = (weights.length - 1) / 2;
      const next = [];
      components.forEach((component) => {
        weights.forEach((weight, index) => {
          next.push({
            offsetHz: component.offsetHz + (index - center) * splitEnvironment.jHz,
            intensity: component.intensity * weight
          });
        });
      });
      components = next;
    });
    if (!components.length) {
      components = [{ offsetHz: 0, intensity: 1 }];
    }
    const merged = new Map();
    components.forEach((component) => {
      const ppm = env.ppm + component.offsetHz / 400;
      const key = ppm.toFixed(5);
      merged.set(key, (merged.get(key) || 0) + component.intensity);
    });
    const totalIntensity = Array.from(merged.values()).reduce((sum, intensity) => sum + intensity, 0) || 1;
    Array.from(merged.entries()).forEach(([ppm, intensity]) => {
      const scaledIntensity = (intensity / totalIntensity) * env.integration;
      peaks.push({ ppm: Number(ppm), intensity: scaledIntensity, env, fwhm: env.broad ? 0.22 : 0.0045 });
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
  if (!window.Plotly) {
    NMRP.spectrum.innerHTML = '<div class="plot-empty">Plotly.js did not load. Check network access and refresh.</div>';
    return;
  }
  const fullDomain = state.defaultDomains[type];
  const domain = state.viewDomains[type] || fullDomain;
  const color = type === "carbon" ? DISPLAY_COLORS.carbon : DISPLAY_COLORS.proton;
  const peaks = expandPeaks(environments, type);
  const fwhm = type === "carbon" ? 0.55 : 0.0045;
  const sampleCount = type === "carbon" ? 1600 : 9000;
  const xValues = [];
  const yValues = [];
  Array.from({ length: sampleCount }, (_, index) => {
    const ppm = domain.min + ((domain.max - domain.min) * index) / (sampleCount - 1);
    const y = peaks.reduce((sum, peak) => sum + peak.intensity * gaussian(ppm, peak.ppm, peak.fwhm || fwhm), 0);
    xValues.push(ppm);
    yValues.push(y);
  });
  const maxY = yValues.reduce((max, y) => Math.max(max, y), 0) || 1;
  const maxPeak = Math.max(...peaks.map((peak) => peak.intensity), 1);
  const visiblePeaks = peaks.filter((peak) => peak.ppm >= domain.min && peak.ppm <= domain.max);
  const profileHeightAt = (ppm) => {
    const y = peaks.reduce((sum, peak) => sum + peak.intensity * gaussian(ppm, peak.ppm, peak.fwhm || fwhm), 0);
    return (y / maxY) * 100;
  };
  const showTms = domain.min <= 0 && domain.max >= 0;
  const tmsHeight = 14;
  const profileTrace = {
    x: xValues,
    y: yValues.map((y) => (y / maxY) * 100),
    type: "scatter",
    mode: "lines",
    line: { color, width: 2.5 },
    fill: "tozeroy",
    fillcolor: type === "carbon" ? "rgba(217,115,13,0.14)" : "rgba(13,108,116,0.14)",
    hoverinfo: "skip",
    name: "broadened profile"
  };
  const markerTrace = {
    x: [...visiblePeaks.map((peak) => peak.ppm), ...(showTms ? [0] : [])],
    y: [...visiblePeaks.map((peak) => profileHeightAt(peak.ppm)), ...(showTms ? [tmsHeight] : [])],
    type: "scatter",
    mode: "markers",
    marker: {
      color: [...visiblePeaks.map((peak) => peak.env.signalId === state.selectedSignalId ? "#a11d37" : color), ...(showTms ? ["#56646f"] : [])],
      size: [...visiblePeaks.map((peak) => peak.env.signalId === state.selectedSignalId ? 11 : 7), ...(showTms ? [7] : [])],
      line: { color: "#ffffff", width: 1 }
    },
    customdata: [...visiblePeaks.map((peak) => peak.env.signalId), ...(showTms ? [""] : [])],
    text: [...visiblePeaks.map((peak) => `${peak.env.nucleus} ${peak.env.ppm.toFixed(2)} ppm (${peak.env.multiplicity})<br>Atoms ${peak.env.atomIds.join(", ")}<br>${multipletDetail(peak.env)}<br>${peak.env.label}`), ...(showTms ? ["TMS reference peak<br>0.00 ppm"] : [])],
    hovertemplate: "%{text}<extra></extra>",
    name: "clickable peaks"
  };
  const integralLabelTrace = {
    x: type === "proton" ? environments.map((env) => env.ppm) : [],
    y: type === "proton" ? environments.map((env) => {
      const envPeaks = visiblePeaks.filter((peak) => peak.env.signalId === env.signalId);
      const top = envPeaks.reduce((max, peak) => Math.max(max, profileHeightAt(peak.ppm)), 0);
      return Math.min(99, top + 5);
    }) : [],
    type: "scatter",
    mode: "text",
    text: type === "proton" ? environments.map((env) => `${env.integration}H`) : [],
    textfont: { color: "#18242d", size: 12 },
    textposition: "top center",
    hoverinfo: "skip",
    name: "integrals"
  };
  const shapes = visiblePeaks.map((peak) => ({
    type: "line",
    xref: "x",
    yref: "y",
      x0: peak.ppm,
      x1: peak.ppm,
      y0: 0,
      y1: profileHeightAt(peak.ppm),
    line: {
      color: peak.env.signalId === state.selectedSignalId ? "#a11d37" : color,
      width: peak.env.signalId === state.selectedSignalId ? 4 : type === "carbon" ? 2.2 : 1.4
    }
  }));
  if (showTms) {
    shapes.push({
      type: "line",
      xref: "x",
      yref: "y",
      x0: 0,
      x1: 0,
      y0: 0,
      y1: tmsHeight,
      line: { color: "#56646f", width: 1.6, dash: "dot" }
    });
  }
  const annotations = showTms ? [{
    x: 0,
    y: tmsHeight + 5,
    text: "TMS",
    showarrow: false,
    font: { size: 11, color: "#56646f" },
    yanchor: "bottom"
  }] : [];
  const layout = {
    autosize: true,
    margin: { t: 34, r: 22, b: 46, l: 42 },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(255,255,255,0.72)",
    showlegend: false,
    dragmode: "zoom",
    shapes,
    annotations,
    title: {
      text: `${type === "carbon" ? "13C" : "1H"} predicted spectrum`,
      x: 0.02,
      xanchor: "left",
      font: { size: 13, color: "#18242d" }
    },
    xaxis: {
      title: "Chemical shift (ppm)",
      autorange: "reversed",
      range: [domain.max, domain.min],
      gridcolor: "rgba(24,36,45,0.08)",
      zeroline: false
    },
    yaxis: {
      title: "Relative intensity",
      range: [0, 105],
      gridcolor: "rgba(24,36,45,0.08)",
      zeroline: false,
      fixedrange: true
    }
  };
  const config = {
    responsive: true,
    scrollZoom: true,
    displaylogo: false,
    modeBarButtonsToRemove: ["lasso2d", "select2d", "autoScale2d"]
  };
  window.Plotly.react(NMRP.spectrum, [profileTrace, markerTrace, integralLabelTrace], layout, config).then(() => {
    NMRP.spectrum.removeAllListeners?.("plotly_click");
    NMRP.spectrum.removeAllListeners?.("plotly_relayout");
    NMRP.spectrum.on("plotly_click", (event) => {
      const signalId = event.points?.find((point) => point.customdata)?.customdata;
      if (signalId) selectSignal(signalId);
    });
    NMRP.spectrum.on("plotly_relayout", (event) => {
      const min = event["xaxis.range[1]"];
      const max = event["xaxis.range[0]"];
      if (Number.isFinite(min) && Number.isFinite(max)) {
        state.viewDomains[type] = { min: Math.min(min, max), max: Math.max(min, max) };
      }
    });
  });
}

function bindPeakEvents() {
  // Plotly handles peak click binding in renderSpectrum.
}

function multipletDetail(signal) {
  if (signal.nucleus !== "1H" || signal.broad) {
    return signal.multiplicity;
  }
  const environments = signal.splitEnvironments || [];
  if (!environments.length) {
    return "singlet: no adjacent carbon-bound H";
  }
  return environments.map((environment, index) => {
    const label = environment.label ? `${environment.label} ` : "";
    return `J${index + 1} ${environment.jHz.toFixed(1)} Hz ${label}to ${environment.count}H on atom(s) ${environment.atomIds.join(",")}`;
  }).join("; ");
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
      <td>${item.label}${item.nucleus === "1H" ? `; ${multipletDetail(item)}` : ""}</td>
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
    let svg = "";
    if (selected && mol.get_svg_with_highlights) {
      const details = JSON.stringify({
        atoms: selected.atomIds.map((id) => id - 1),
        highlightColour: [0.85, 0.12, 0.22]
      });
      svg = mol.get_svg_with_highlights(details);
    } else {
      svg = mol.get_svg();
    }
    NMRP.structure.innerHTML = addAtomNumbersToSvg(svg, state.graph);
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

function addAtomNumbersToSvg(svg, graph) {
  if (!graph?.atoms?.length || !svg.includes("</svg>")) {
    return svg;
  }
  const positions = inferSvgAtomPositions(svg, graph);
  if (!positions.length) {
    return svg;
  }
  const labels = positions.map((point, index) => `<g class="atom-number-label"><circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="7.2" fill="rgba(255,255,255,0.92)" stroke="#0d6c74" stroke-width="1"></circle><text x="${point.x.toFixed(1)}" y="${(point.y + 3.5).toFixed(1)}" text-anchor="middle" font-size="9" fill="#0a4c57" font-family="Arial">${index + 1}</text></g>`).join("");
  return svg.replace("</svg>", `${labels}</svg>`);
}

function inferSvgAtomPositions(svg, graph) {
  const explicit = Array.from(svg.matchAll(/class=['"]atom-\d+['"][^>]*?(?:cx=['"]([\d.-]+)['"][^>]*?cy=['"]([\d.-]+)['"]|x=['"]([\d.-]+)['"][^>]*?y=['"]([\d.-]+)['"])/g))
    .map((match) => ({ x: Number(match[1] || match[3]), y: Number(match[2] || match[4]) }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (explicit.length >= graph.atoms.length) {
    return explicit.slice(0, graph.atoms.length);
  }

  const bondCoordinates = Array.from(svg.matchAll(/x1=['"]([\d.-]+)['"][^>]*y1=['"]([\d.-]+)['"][^>]*x2=['"]([\d.-]+)['"][^>]*y2=['"]([\d.-]+)['"]/g))
    .map((match) => [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])])
    .filter((coords) => coords.every(Number.isFinite));
  if (!bondCoordinates.length) {
    return [];
  }

  const points = [];
  const addPoint = (x, y) => {
    const current = points.find((point) => Math.hypot(point.x - x, point.y - y) < 3);
    if (current) {
      current.x = (current.x * current.count + x) / (current.count + 1);
      current.y = (current.y * current.count + y) / (current.count + 1);
      current.count += 1;
    } else {
      points.push({ x, y, count: 1 });
    }
  };
  bondCoordinates.forEach(([x1, y1, x2, y2]) => {
    addPoint(x1, y1);
    addPoint(x2, y2);
  });
  return points
    .sort((a, b) => b.count - a.count)
    .slice(0, graph.atoms.length);
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
