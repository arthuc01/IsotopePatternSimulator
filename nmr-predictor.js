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
  carbonTab: document.getElementById("nmrp-carbon-tab")
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
  graph: null,
  predictions: { proton: [], carbon: [] }
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

function isAlkeneCarbon(atom) {
  return atom.element === "C" && atom.bonds.some((bond) => bond.order === 2);
}

function isAlkyneCarbon(atom) {
  return atom.element === "C" && atom.bonds.some((bond) => bond.order === 3);
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

function protonRule(graph, atom) {
  if (atom.element === "O") {
    if (neighbors(graph, atom).some(({ atom: n }) => isCarboxylCarbon(graph, n))) {
      return { shift: 11.2, reason: "carboxylic acid O-H", broad: true };
    }
    return { shift: 2.5, reason: "exchangeable O-H", broad: true };
  }
  if (atom.element === "N") return { shift: 3.5, reason: "exchangeable N-H", broad: true };
  if (atom.element === "S") return { shift: 2.2, reason: "exchangeable S-H", broad: true };
  if (atom.element !== "C") return null;
  if (isCarbonylCarbon(graph, atom) && atom.hydrogens > 0) return { shift: 9.7, reason: "aldehyde C-H" };
  if (atom.aromatic) return { shift: 7.25, reason: "aromatic C-H" };
  if (isAlkeneCarbon(atom)) return { shift: 5.5, reason: "alkene C-H" };
  if (isAlkyneCarbon(atom)) return { shift: 2.4, reason: "alkyne C-H" };
  if (neighbors(graph, atom).some(({ atom: n }) => n.aromatic)) return { shift: 2.35, reason: "benzylic C-H" };
  if (neighbors(graph, atom).some(({ bond }) => bond.order === 2)) return { shift: 2.0, reason: "allylic C-H" };
  if (isAttachedToCarbonyl(graph, atom)) return { shift: 2.15, reason: "alpha to carbonyl" };
  if (neighbors(graph, atom).some(({ atom: n }) => n.element === "O")) return { shift: 3.65, reason: "C-H next to oxygen" };
  if (neighbors(graph, atom).some(({ atom: n }) => n.element === "N")) return { shift: 2.75, reason: "C-H next to nitrogen" };
  if (neighbors(graph, atom).some(({ atom: n }) => HALOGENS.has(n.element))) return { shift: 3.35, reason: "C-H next to halogen" };
  const degree = carbonDegree(graph, atom);
  if (degree <= 1) return { shift: 0.95, reason: "primary alkyl" };
  if (degree === 2) return { shift: 1.30, reason: "secondary alkyl" };
  return { shift: 1.55, reason: "tertiary alkyl" };
}

function carbonRule(graph, atom) {
  if (isCarbonylCarbon(graph, atom)) {
    if (isCarboxylCarbon(graph, atom)) return { shift: 175, reason: "carboxyl/ester carbonyl" };
    if (atom.hydrogens > 0) return { shift: 200, reason: "aldehyde carbonyl" };
    return { shift: 205, reason: "ketone carbonyl" };
  }
  if (atom.aromatic) return { shift: 128, reason: "aromatic carbon" };
  if (isAlkeneCarbon(atom)) return { shift: 125, reason: "alkene carbon" };
  if (isAlkyneCarbon(atom)) return { shift: 78, reason: "alkyne carbon" };
  if (neighbors(graph, atom).some(({ atom: n }) => n.element === "O")) return { shift: 62, reason: "carbon attached to oxygen" };
  if (neighbors(graph, atom).some(({ atom: n }) => n.element === "N")) return { shift: 48, reason: "carbon attached to nitrogen" };
  if (neighbors(graph, atom).some(({ atom: n }) => HALOGENS.has(n.element))) return { shift: 42, reason: "carbon attached to halogen" };
  if (isAttachedToCarbonyl(graph, atom)) return { shift: 30, reason: "alpha carbonyl carbon" };
  const degree = carbonDegree(graph, atom);
  if (degree <= 1) return { shift: 14, reason: "primary alkyl carbon" };
  if (degree === 2) return { shift: 25, reason: "secondary alkyl carbon" };
  if (degree === 3) return { shift: 35, reason: "tertiary alkyl carbon" };
  return { shift: 42, reason: "quaternary alkyl carbon" };
}

function groupKey(item) {
  return `${item.kind}|${item.shift.toFixed(1)}|${item.reason}|${item.splitting}`;
}

function mergeEnvironments(items) {
  const map = new Map();
  for (const item of items) {
    const key = groupKey(item);
    const current = map.get(key);
    if (current) {
      current.integration += item.integration;
      current.atomIds.push(...item.atomIds);
    } else {
      map.set(key, { ...item, atomIds: [...item.atomIds] });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.shift - a.shift);
}

function predictEnvironments(graph) {
  const protonItems = [];
  const carbonItems = [];

  graph.atoms.forEach((atom) => {
    if (atom.hydrogens > 0 && ["C", "O", "N", "S"].includes(atom.element)) {
      const rule = protonRule(graph, atom);
      if (rule) {
        const n = rule.broad ? 0 : adjacentHydrogens(graph, atom);
        protonItems.push({
          kind: "1H",
          atomIds: [atom.id + 1],
          shift: rule.shift,
          integration: atom.hydrogens,
          splitting: rule.broad ? "broad s" : multiplicityLabel(n),
          neighborH: n,
          broad: Boolean(rule.broad),
          reason: rule.reason
        });
      }
    }
    if (atom.element === "C") {
      const rule = carbonRule(graph, atom);
      carbonItems.push({
        kind: "13C",
        atomIds: [atom.id + 1],
        shift: rule.shift,
        integration: 1,
        splitting: "s",
        neighborH: 0,
        broad: false,
        reason: rule.reason
      });
    }
  });

  return {
    proton: mergeEnvironments(protonItems),
    carbon: mergeEnvironments(carbonItems)
  };
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
      peaks.push({ ppm: env.shift, intensity: 1, env });
      return;
    }
    const jPpm = env.broad ? 0.035 : 7 / 400;
    const n = Math.max(0, Math.min(env.neighborH, 6));
    const weights = env.broad ? [1] : binomialWeights(n);
    const offsetCenter = (weights.length - 1) / 2;
    weights.forEach((weight, index) => {
      peaks.push({
        ppm: env.shift + (index - offsetCenter) * jPpm,
        intensity: weight * env.integration,
        env
      });
    });
  });
  return peaks;
}

function renderSpectrum(environments, type) {
  if (!environments.length) {
    NMRP.spectrum.innerHTML = '<div class="plot-empty">No predicted signals for this nucleus.</div>';
    return;
  }
  const width = Math.max(NMRP.spectrum.clientWidth || 500, 360);
  const height = Math.max(NMRP.spectrum.clientHeight || 360, 300);
  const domain = type === "carbon" ? { min: 0, max: 220 } : { min: 0, max: 12 };
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
  const tickCount = type === "carbon" ? 11 : 7;
  const ticks = Array.from({ length: tickCount }, (_, index) => {
    const frac = index / (tickCount - 1);
    const ppm = domain.max - frac * (domain.max - domain.min);
    const x = margin.left + frac * plotWidth;
    return `<line x1="${x}" y1="${margin.top}" x2="${x}" y2="${margin.top + plotHeight}" stroke="rgba(24,36,45,0.08)"></line><text x="${x}" y="${height - 18}" text-anchor="middle" font-size="11" fill="#56646f">${ppm.toFixed(type === "carbon" ? 0 : 1)}</text>`;
  }).join("");
  const sticks = peaks.map((peak) => {
    const x = xToPx(peak.ppm);
    const y = yToPx((peak.intensity / Math.max(...peaks.map((p) => p.intensity))) * maxY);
    return `<line x1="${x.toFixed(2)}" y1="${margin.top + plotHeight}" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}" stroke="${color}" stroke-width="${type === "carbon" ? 2.2 : 1.4}" opacity="0.75"></line>`;
  }).join("");

  NMRP.spectrum.innerHTML = `<svg class="plot-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><rect x="${margin.left}" y="${margin.top}" width="${plotWidth}" height="${plotHeight}" rx="14" fill="rgba(255,255,255,0.72)"></rect>${ticks}<line x1="${margin.left}" y1="${margin.top + plotHeight}" x2="${margin.left + plotWidth}" y2="${margin.top + plotHeight}" stroke="#23343f"></line><line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotHeight}" stroke="#23343f"></line><polygon points="${fill}" fill="${type === "carbon" ? "rgba(217,115,13,0.14)" : "rgba(13,108,116,0.14)"}"></polygon><polyline points="${line}" fill="none" stroke="${color}" stroke-width="2.3" stroke-linejoin="round"></polyline>${sticks}<text x="${margin.left + plotWidth / 2}" y="${height - 2}" text-anchor="middle" font-size="12" fill="#18242d">Chemical shift (ppm)</text><text x="${margin.left + 8}" y="${margin.top + 14}" font-size="12" fill="#18242d">${type === "carbon" ? "13C" : "1H"} predicted spectrum</text></svg>`;
}

function renderAssignments() {
  const all = [...state.predictions.proton, ...state.predictions.carbon];
  if (!all.length) {
    NMRP.table.innerHTML = '<tr><td colspan="6">No assignments.</td></tr>';
    return;
  }
  NMRP.table.innerHTML = all.map((item) => `
    <tr>
      <td>${item.kind}</td>
      <td>${item.atomIds.join(", ")}</td>
      <td>${item.shift.toFixed(2)} ppm</td>
      <td>${item.kind === "1H" ? item.integration.toFixed(0) : item.atomIds.length.toFixed(0)}</td>
      <td>${item.splitting}</td>
      <td>${item.reason}</td>
    </tr>
  `).join("");
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
    NMRP.structure.innerHTML = mol.get_svg();
  } catch (error) {
    NMRP.structure.innerHTML = `<div class="plot-empty">${error.message}</div>`;
  } finally {
    if (mol?.delete) {
      mol.delete();
    }
  }
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
