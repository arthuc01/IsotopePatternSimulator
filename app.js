const ISOTOPE_DATA = {
  H: [{ mass: 1.00782503223, abundance: 0.999885 }, { mass: 2.01410177812, abundance: 0.000115 }],
  He: [{ mass: 3.01602932265, abundance: 0.00000134 }, { mass: 4.00260325413, abundance: 0.99999866 }],
  Li: [{ mass: 6.0151228874, abundance: 0.0759 }, { mass: 7.0160034366, abundance: 0.9241 }],
  Be: [{ mass: 9.012183065, abundance: 1 }],
  B: [{ mass: 10.01293695, abundance: 0.199 }, { mass: 11.00930536, abundance: 0.801 }],
  C: [{ mass: 12, abundance: 0.9893 }, { mass: 13.00335483507, abundance: 0.0107 }],
  N: [{ mass: 14.00307400443, abundance: 0.99636 }, { mass: 15.00010889888, abundance: 0.00364 }],
  O: [{ mass: 15.99491461957, abundance: 0.99757 }, { mass: 16.9991317565, abundance: 0.00038 }, { mass: 17.99915961286, abundance: 0.00205 }],
  F: [{ mass: 18.99840316273, abundance: 1 }],
  Ne: [{ mass: 19.9924401762, abundance: 0.9048 }, { mass: 20.993846685, abundance: 0.0027 }, { mass: 21.991385114, abundance: 0.0925 }],
  Na: [{ mass: 22.989769282, abundance: 1 }],
  Mg: [{ mass: 23.985041697, abundance: 0.7899 }, { mass: 24.985836976, abundance: 0.1 }, { mass: 25.982592968, abundance: 0.1101 }],
  Al: [{ mass: 26.98153853, abundance: 1 }],
  Si: [{ mass: 27.97692653465, abundance: 0.92223 }, { mass: 28.9764946649, abundance: 0.04685 }, { mass: 29.973770136, abundance: 0.03092 }],
  P: [{ mass: 30.97376199842, abundance: 1 }],
  S: [{ mass: 31.9720711744, abundance: 0.9499 }, { mass: 32.9714589098, abundance: 0.0075 }, { mass: 33.967867004, abundance: 0.0425 }, { mass: 35.96708071, abundance: 0.0001 }],
  Cl: [{ mass: 34.968852682, abundance: 0.7576 }, { mass: 36.965902602, abundance: 0.2424 }],
  Ar: [{ mass: 35.967545105, abundance: 0.003365 }, { mass: 37.96273211, abundance: 0.000632 }, { mass: 39.9623831237, abundance: 0.996003 }],
  K: [{ mass: 38.9637064864, abundance: 0.932581 }, { mass: 39.963998166, abundance: 0.000117 }, { mass: 40.9618252579, abundance: 0.067302 }],
  Ca: [{ mass: 39.962590863, abundance: 0.96941 }, { mass: 41.95861783, abundance: 0.00647 }, { mass: 42.95876644, abundance: 0.00135 }, { mass: 43.95548156, abundance: 0.02086 }, { mass: 45.953689, abundance: 0.00004 }, { mass: 47.95252276, abundance: 0.00187 }],
  Sc: [{ mass: 44.95590828, abundance: 1 }],
  Ti: [{ mass: 45.95262772, abundance: 0.0825 }, { mass: 46.95175879, abundance: 0.0744 }, { mass: 47.94794198, abundance: 0.7372 }, { mass: 48.94786568, abundance: 0.0541 }, { mass: 49.94478689, abundance: 0.0518 }],
  V: [{ mass: 49.94715601, abundance: 0.0025 }, { mass: 50.94395704, abundance: 0.9975 }],
  Cr: [{ mass: 49.94604183, abundance: 0.04345 }, { mass: 51.94050623, abundance: 0.83789 }, { mass: 52.94064815, abundance: 0.09501 }, { mass: 53.93887916, abundance: 0.02365 }],
  Mn: [{ mass: 54.93804391, abundance: 1 }],
  Fe: [{ mass: 53.93960899, abundance: 0.05845 }, { mass: 55.93493633, abundance: 0.91754 }, { mass: 56.93539284, abundance: 0.02119 }, { mass: 57.93327443, abundance: 0.00282 }],
  Co: [{ mass: 58.93319429, abundance: 1 }],
  Ni: [{ mass: 57.93534241, abundance: 0.68077 }, { mass: 59.93078588, abundance: 0.26223 }, { mass: 60.93105557, abundance: 0.0114 }, { mass: 61.92834537, abundance: 0.03635 }, { mass: 63.92796682, abundance: 0.00926 }],
  Cu: [{ mass: 62.92959772, abundance: 0.6915 }, { mass: 64.9277897, abundance: 0.3085 }],
  Zn: [{ mass: 63.92914201, abundance: 0.4863 }, { mass: 65.92603381, abundance: 0.279 }, { mass: 66.92712775, abundance: 0.041 }, { mass: 67.92484455, abundance: 0.1875 }, { mass: 69.9253192, abundance: 0.0062 }],
  Ga: [{ mass: 68.9255735, abundance: 0.60108 }, { mass: 70.92470258, abundance: 0.39892 }],
  Ge: [{ mass: 69.92424875, abundance: 0.2057 }, { mass: 71.922075826, abundance: 0.2745 }, { mass: 72.923458956, abundance: 0.0775 }, { mass: 73.921177761, abundance: 0.365 }, { mass: 75.921402726, abundance: 0.0773 }],
  As: [{ mass: 74.92159457, abundance: 1 }],
  Se: [{ mass: 73.922475934, abundance: 0.0089 }, { mass: 75.919213704, abundance: 0.0937 }, { mass: 76.919914154, abundance: 0.0763 }, { mass: 77.91730928, abundance: 0.2377 }, { mass: 79.9165218, abundance: 0.4961 }, { mass: 81.9166995, abundance: 0.0873 }],
  Br: [{ mass: 78.9183376, abundance: 0.5069 }, { mass: 80.9162897, abundance: 0.4931 }],
  Kr: [{ mass: 77.92036494, abundance: 0.00355 }, { mass: 79.91637808, abundance: 0.02286 }, { mass: 81.91348273, abundance: 0.11593 }, { mass: 82.91412716, abundance: 0.115 }, { mass: 83.9114977282, abundance: 0.56987 }, { mass: 85.9106106269, abundance: 0.17379 }],
  Rb: [{ mass: 84.9117897379, abundance: 0.7217 }, { mass: 86.909180531, abundance: 0.2783 }],
  Sr: [{ mass: 83.9134191, abundance: 0.0056 }, { mass: 85.9092606, abundance: 0.0986 }, { mass: 86.9088775, abundance: 0.07 }, { mass: 87.9056125, abundance: 0.8258 }],
  Y: [{ mass: 88.9058403, abundance: 1 }],
  Zr: [{ mass: 89.9046977, abundance: 0.5145 }, { mass: 90.9056396, abundance: 0.1122 }, { mass: 91.9050347, abundance: 0.1715 }, { mass: 93.9063108, abundance: 0.1738 }, { mass: 95.9082714, abundance: 0.028 }],
  Nb: [{ mass: 92.906373, abundance: 1 }],
  Mo: [{ mass: 91.90680796, abundance: 0.1453 }, { mass: 93.9050849, abundance: 0.0915 }, { mass: 94.90583877, abundance: 0.1584 }, { mass: 95.90467612, abundance: 0.1667 }, { mass: 96.90601812, abundance: 0.096 }, { mass: 97.90540482, abundance: 0.2439 }, { mass: 99.9074718, abundance: 0.0982 }],
  Ag: [{ mass: 106.9050916, abundance: 0.51839 }, { mass: 108.9047553, abundance: 0.48161 }],
  Cd: [{ mass: 105.9064599, abundance: 0.0125 }, { mass: 107.9041834, abundance: 0.0089 }, { mass: 109.90300661, abundance: 0.1249 }, { mass: 110.90418287, abundance: 0.128 }, { mass: 111.90276287, abundance: 0.2413 }, { mass: 112.90440813, abundance: 0.1222 }, { mass: 113.90336509, abundance: 0.2873 }, { mass: 115.90476315, abundance: 0.0749 }],
  In: [{ mass: 112.90406184, abundance: 0.0429 }, { mass: 114.903878776, abundance: 0.9571 }],
  Sn: [{ mass: 111.90482387, abundance: 0.0097 }, { mass: 113.9027827, abundance: 0.0066 }, { mass: 114.903344699, abundance: 0.0034 }, { mass: 115.9017428, abundance: 0.1454 }, { mass: 116.90295398, abundance: 0.0768 }, { mass: 117.90160657, abundance: 0.2422 }, { mass: 118.90331117, abundance: 0.0859 }, { mass: 119.90220163, abundance: 0.3258 }, { mass: 121.9034438, abundance: 0.0463 }, { mass: 123.9052766, abundance: 0.0579 }],
  Sb: [{ mass: 120.903812, abundance: 0.5721 }, { mass: 122.9042132, abundance: 0.4279 }],
  Te: [{ mass: 119.9040593, abundance: 0.0009 }, { mass: 121.9030435, abundance: 0.0255 }, { mass: 122.9042698, abundance: 0.0089 }, { mass: 123.9028179, abundance: 0.0474 }, { mass: 124.9044299, abundance: 0.0707 }, { mass: 125.9033109, abundance: 0.1884 }, { mass: 127.90446128, abundance: 0.3174 }, { mass: 129.90622275, abundance: 0.3408 }],
  I: [{ mass: 126.9044719, abundance: 1 }],
  Xe: [{ mass: 123.905892, abundance: 0.001 }, { mass: 125.9042983, abundance: 0.0009 }, { mass: 127.903531, abundance: 0.0191 }, { mass: 128.9047808611, abundance: 0.264 }, { mass: 129.903509349, abundance: 0.0407 }, { mass: 130.90508406, abundance: 0.2123 }, { mass: 131.9041550856, abundance: 0.2691 }, { mass: 133.90539466, abundance: 0.1044 }, { mass: 135.90721448, abundance: 0.0886 }],
  Hg: [{ mass: 195.9658326, abundance: 0.0015 }, { mass: 197.9667686, abundance: 0.0997 }, { mass: 198.96828064, abundance: 0.1687 }, { mass: 199.96832659, abundance: 0.231 }, { mass: 200.97030284, abundance: 0.1318 }, { mass: 201.9706434, abundance: 0.2986 }, { mass: 203.97349398, abundance: 0.0687 }],
  Pb: [{ mass: 203.973044, abundance: 0.014 }, { mass: 205.9744657, abundance: 0.241 }, { mass: 206.9758973, abundance: 0.221 }, { mass: 207.9766525, abundance: 0.524 }]
};

const ELECTRON_MASS = 0.000548579909065;
const MASS_BUCKET = 0.00001;
const PRUNE_THRESHOLD = 1e-10;
const MAX_PEAKS = 12000;

const state = {
  peaks: [],
  profile: [],
  formula: "",
  composition: {},
  charge: 1,
  polarity: "cation",
  view: null,
  selection: null
};

const elements = {
  formulaInput: document.getElementById("formula-input"),
  chargeInput: document.getElementById("charge-input"),
  polaritySelect: document.getElementById("polarity-select"),
  resolutionInput: document.getElementById("resolution-input"),
  resolutionOutput: document.getElementById("resolution-output"),
  samplesInput: document.getElementById("samples-input"),
  samplesOutput: document.getElementById("samples-output"),
  profileToggle: document.getElementById("profile-toggle"),
  sticksToggle: document.getElementById("sticks-toggle"),
  simulateButton: document.getElementById("simulate-button"),
  peaksDownload: document.getElementById("peaks-download"),
  profileDownload: document.getElementById("profile-download"),
  peakFilterInput: document.getElementById("peak-filter-input"),
  zoomIn: document.getElementById("zoom-in"),
  zoomOut: document.getElementById("zoom-out"),
  resetView: document.getElementById("reset-view"),
  statusMessage: document.getElementById("status-message"),
  peakTableBody: document.getElementById("peak-table-body"),
  monoisotopicMass: document.getElementById("monoisotopic-mass"),
  monoisotopicMz: document.getElementById("monoisotopic-mz"),
  peakCount: document.getElementById("peak-count"),
  basePeak: document.getElementById("base-peak"),
  plot: document.getElementById("plot")
};

function setStatus(message, isError = false) {
  elements.statusMessage.textContent = message;
  elements.statusMessage.style.color = isError ? "#a11d37" : "";
}

function parseFormula(formula) {
  const normalized = formula.replace(/\s+/g, "").replace(/[·•]/g, ".");
  if (!normalized) {
    throw new Error("Enter a molecular formula.");
  }

  const segments = normalized.split(".").filter(Boolean);
  const total = {};
  for (const segment of segments) {
    const match = segment.match(/^(\d+)(.*)$/);
    const multiplier = match ? Number(match[1]) : 1;
    const body = match ? match[2] : segment;
    const parsed = parseGroup(body, 0);
    if (parsed.index !== body.length) {
      throw new Error(`Unexpected token near "${body.slice(parsed.index)}".`);
    }
    mergeComposition(total, parsed.composition, multiplier);
  }
  return total;
}

function parseGroup(text, startIndex) {
  const composition = {};
  let index = startIndex;

  while (index < text.length) {
    const token = text[index];
    if (token === "(") {
      const nested = parseGroup(text, index + 1);
      index = nested.index;
      if (text[index] !== ")") {
        throw new Error("Missing closing parenthesis.");
      }
      index += 1;
      const number = parseNumber(text, index);
      mergeComposition(composition, nested.composition, number.value);
      index = number.nextIndex;
      continue;
    }

    if (token === ")") {
      return { composition, index };
    }

    if (!/[A-Z]/.test(token)) {
      throw new Error(`Unexpected token "${token}".`);
    }

    let symbol = token;
    index += 1;
    while (index < text.length && /[a-z]/.test(text[index])) {
      symbol += text[index];
      index += 1;
    }

    if (!ISOTOPE_DATA[symbol]) {
      throw new Error(`Element "${symbol}" is not in the built-in isotope table.`);
    }

    const number = parseNumber(text, index);
    composition[symbol] = (composition[symbol] || 0) + number.value;
    index = number.nextIndex;
  }

  return { composition, index };
}

function parseNumber(text, startIndex) {
  let index = startIndex;
  let digits = "";
  while (index < text.length && /\d/.test(text[index])) {
    digits += text[index];
    index += 1;
  }
  return { value: digits ? Number(digits) : 1, nextIndex: index };
}

function mergeComposition(target, source, multiplier = 1) {
  for (const [symbol, count] of Object.entries(source)) {
    target[symbol] = (target[symbol] || 0) + count * multiplier;
  }
}

function convolveDistributions(a, b) {
  const buckets = new Map();
  for (const peakA of a) {
    for (const peakB of b) {
      const rightIntensity = peakB.intensity ?? peakB.abundance;
      const intensity = peakA.intensity * rightIntensity;
      if (intensity < PRUNE_THRESHOLD) {
        continue;
      }
      const mass = peakA.mass + peakB.mass;
      const bucket = Math.round(mass / MASS_BUCKET);
      const existing = buckets.get(bucket);
      if (existing) {
        const combinedIntensity = existing.intensity + intensity;
        existing.mass = ((existing.mass * existing.intensity) + (mass * intensity)) / combinedIntensity;
        existing.intensity = combinedIntensity;
      } else {
        buckets.set(bucket, { mass, intensity });
      }
    }
  }

  return pruneDistribution(Array.from(buckets.values()));
}

function pruneDistribution(peaks) {
  if (!peaks.length) {
    return peaks;
  }

  const maxIntensity = peaks.reduce((max, peak) => Math.max(max, peak.intensity), 0);
  let pruned = peaks.filter((peak) => peak.intensity >= maxIntensity * PRUNE_THRESHOLD);
  pruned.sort((left, right) => right.intensity - left.intensity);
  if (pruned.length > MAX_PEAKS) {
    pruned = pruned.slice(0, MAX_PEAKS);
  }
  pruned.sort((left, right) => left.mass - right.mass);
  return pruned;
}

function buildDistribution(formulaComposition) {
  let distribution = [{ mass: 0, intensity: 1 }];
  for (const [symbol, count] of Object.entries(formulaComposition)) {
    for (let index = 0; index < count; index += 1) {
      distribution = convolveDistributions(distribution, ISOTOPE_DATA[symbol]);
    }
  }

  const maxIntensity = distribution.reduce((max, peak) => Math.max(max, peak.intensity), 0);
  if (!distribution.length || !Number.isFinite(maxIntensity) || maxIntensity <= 0) {
    throw new Error("Isotope distribution could not be generated for this formula.");
  }
  return distribution.map((peak) => ({
    mass: peak.mass,
    intensity: maxIntensity ? (peak.intensity / maxIntensity) * 100 : 0
  }));
}

function monoisotopicMass(composition) {
  return Object.entries(composition).reduce((total, [symbol, count]) => {
    const isotope = ISOTOPE_DATA[symbol].reduce((best, current) => current.abundance > best.abundance ? current : best);
    return total + isotope.mass * count;
  }, 0);
}

function applyChargeToMass(mass, charge, polarity) {
  const sign = polarity === "anion" ? 1 : -1;
  return (mass + (sign * charge * ELECTRON_MASS)) / charge;
}

function applyChargeToDistribution(peaks, charge, polarity) {
  return peaks.map((peak) => ({ mass: applyChargeToMass(peak.mass, charge, polarity), intensity: peak.intensity }));
}

function simulateGaussianProfile(peaks, resolvingPower, pointsPerFwhm) {
  if (!peaks.length) {
    return [];
  }

  const basePeak = peaks.reduce((best, current) => current.intensity > best.intensity ? current : best);
  const representativeFwhm = Math.max(basePeak.mass / resolvingPower, 0.0005);
  const step = representativeFwhm / pointsPerFwhm;
  const minX = peaks[0].mass - representativeFwhm * 5;
  const maxX = peaks[peaks.length - 1].mass + representativeFwhm * 5;
  const profile = [];

  for (let x = minX; x <= maxX; x += step) {
    let y = 0;
    for (const peak of peaks) {
      const fwhm = Math.max(peak.mass / resolvingPower, 0.0005);
      const sigma = fwhm / 2.354820045;
      const distance = x - peak.mass;
      y += peak.intensity * Math.exp(-(distance * distance) / (2 * sigma * sigma));
    }
    profile.push({ mass: x, intensity: y });
  }

  const profileMax = profile.reduce((max, point) => Math.max(max, point.intensity), 0);
  return profile.map((point) => ({
    mass: point.mass,
    intensity: profileMax ? (point.intensity / profileMax) * 100 : 0
  }));
}

function averageMassCenter(source) {
  const total = source.reduce((sum, point) => sum + point.intensity, 0);
  if (!total) {
    return (source[0].mass + source[source.length - 1].mass) / 2;
  }
  return source.reduce((sum, point) => sum + (point.mass * point.intensity), 0) / total;
}

function defaultViewRange() {
  const source = state.profile.length ? state.profile : state.peaks;
  if (!source.length) {
    return { minX: 0, maxX: 1 };
  }
  const minMass = source[0].mass;
  const maxMass = source[source.length - 1].mass;
  const center = averageMassCenter(source);
  const halfSpan = Math.max(center - minMass, maxMass - center, 0.01);
  const padding = Math.max(halfSpan * 0.08, 0.01);
  return { minX: center - halfSpan - padding, maxX: center + halfSpan + padding };
}

function clampView(view) {
  const full = defaultViewRange();
  const minSpan = Math.max((full.maxX - full.minX) / 500, 0.0005);
  let minX = view.minX;
  let maxX = view.maxX;
  if ((maxX - minX) < minSpan) {
    const center = (minX + maxX) / 2;
    minX = center - minSpan / 2;
    maxX = center + minSpan / 2;
  }
  if (minX < full.minX) {
    maxX += full.minX - minX;
    minX = full.minX;
  }
  if (maxX > full.maxX) {
    minX -= maxX - full.maxX;
    maxX = full.maxX;
  }
  return { minX: Math.max(minX, full.minX), maxX: Math.min(maxX, full.maxX) };
}

function getVisibleData() {
  if (!state.view) {
    state.view = defaultViewRange();
  }
  return {
    peaks: state.peaks.filter((peak) => peak.mass >= state.view.minX && peak.mass <= state.view.maxX),
    profile: state.profile.filter((point) => point.mass >= state.view.minX && point.mass <= state.view.maxX)
  };
}

function nearestDatum(mass) {
  const candidates = [];
  if (elements.profileToggle.checked) {
    candidates.push(...state.profile);
  }
  if (elements.sticksToggle.checked) {
    candidates.push(...state.peaks);
  }
  if (!candidates.length) {
    return null;
  }

  let best = candidates[0];
  let bestDistance = Math.abs(best.mass - mass);
  for (const point of candidates) {
    const distance = Math.abs(point.mass - mass);
    if (distance < bestDistance) {
      best = point;
      bestDistance = distance;
    }
  }
  return best;
}

function getPeakFilterThreshold() {
  return Math.max(0, Number(elements.peakFilterInput.value) || 0);
}

function getFilteredPeaks() {
  const threshold = getPeakFilterThreshold();
  return state.peaks.filter((peak) => peak.intensity >= threshold);
}

function renderPlot() {
  if (!state.peaks.length) {
    elements.plot.innerHTML = '<div class="plot-empty">No spectrum to display.</div>';
    return;
  }

  state.view = clampView(state.view || defaultViewRange());
  const visible = getVisibleData();
  const width = Math.max(elements.plot.clientWidth || 320, 320);
  const height = 540;
  const margin = { top: 20, right: 44, bottom: 44, left: 88 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const minX = state.view.minX;
  const maxX = state.view.maxX;
  const xToPx = (x) => margin.left + ((x - minX) / (maxX - minX)) * plotWidth;
  const yToPx = (y) => margin.top + plotHeight - (y / 100) * plotHeight;

  const sticksMarkup = elements.sticksToggle.checked
    ? visible.peaks.map((peak) => `<line x1="${xToPx(peak.mass).toFixed(2)}" y1="${yToPx(0).toFixed(2)}" x2="${xToPx(peak.mass).toFixed(2)}" y2="${yToPx(peak.intensity).toFixed(2)}" stroke="#d9730d" stroke-width="1.8" />`).join("")
    : "";

  let profileMarkup = "";
  if (elements.profileToggle.checked && visible.profile.length) {
    const points = visible.profile.map((point) => `${xToPx(point.mass).toFixed(2)},${yToPx(point.intensity).toFixed(2)}`).join(" ");
    const filled = `${margin.left},${yToPx(0).toFixed(2)} ${points} ${margin.left + plotWidth},${yToPx(0).toFixed(2)}`;
    profileMarkup = `<polygon points="${filled}" fill="rgba(13, 108, 116, 0.16)"></polygon><polyline points="${points}" fill="none" stroke="#0d6c74" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"></polyline>`;
  }

  const xTickMarkup = Array.from({ length: 7 }, (_, index) => {
    const value = minX + ((maxX - minX) * index / 6);
    const x = margin.left + (plotWidth * index / 6);
    return `<line x1="${x}" y1="${margin.top}" x2="${x}" y2="${margin.top + plotHeight}" stroke="rgba(24,36,45,0.08)" /><text x="${x}" y="${height - 14}" text-anchor="middle" font-size="11" fill="#56646f">${value.toFixed(4)}</text>`;
  }).join("");

  const yTickMarkup = [0, 25, 50, 75, 100].map((value) => {
    const y = yToPx(value);
    return `<line x1="${margin.left}" y1="${y}" x2="${margin.left + plotWidth}" y2="${y}" stroke="rgba(24,36,45,0.08)" /><text x="${margin.left - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="#56646f">${value}</text>`;
  }).join("");

  elements.plot.innerHTML = `<svg class="plot-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><rect x="${margin.left}" y="${margin.top}" width="${plotWidth}" height="${plotHeight}" fill="rgba(255,255,255,0.72)" rx="14"></rect>${xTickMarkup}${yTickMarkup}<line x1="${margin.left}" y1="${margin.top + plotHeight}" x2="${margin.left + plotWidth}" y2="${margin.top + plotHeight}" stroke="#23343f" /><line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotHeight}" stroke="#23343f" />${profileMarkup}${sticksMarkup}<line id="hover-line" x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotHeight}" stroke="#0a4c57" stroke-dasharray="4 4" opacity="0"></line><text x="${margin.left + plotWidth / 2}" y="${height - 2}" text-anchor="middle" font-size="12" fill="#18242d">m/z</text><text x="18" y="${margin.top + plotHeight / 2}" text-anchor="middle" font-size="12" fill="#18242d" transform="rotate(-90 18 ${margin.top + plotHeight / 2})">Relative intensity</text></svg><div id="plot-tooltip" class="plot-tooltip"></div><div id="zoom-box" class="zoom-box"></div>`;

  const svg = elements.plot.querySelector(".plot-svg");
  const tooltip = elements.plot.querySelector("#plot-tooltip");
  const hoverLine = elements.plot.querySelector("#hover-line");
  const zoomBox = elements.plot.querySelector("#zoom-box");

  const massFromClientX = (clientX) => {
    const rect = elements.plot.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, margin.left), rect.width - margin.right);
    const fraction = (x - margin.left) / plotWidth;
    return minX + fraction * (maxX - minX);
  };

  const showTooltip = (event) => {
    const datum = nearestDatum(massFromClientX(event.clientX));
    if (!datum) {
      return;
    }
    const x = xToPx(datum.mass);
    hoverLine.setAttribute("x1", x);
    hoverLine.setAttribute("x2", x);
    hoverLine.setAttribute("opacity", "1");
    tooltip.innerHTML = `m/z ${datum.mass.toFixed(5)}<br>int ${datum.intensity.toFixed(3)}`;
    tooltip.style.left = `${event.offsetX}px`;
    tooltip.style.top = `${event.offsetY}px`;
    tooltip.style.opacity = "1";
  };

  svg.addEventListener("mousemove", showTooltip);
  svg.addEventListener("mouseleave", () => {
    hoverLine.setAttribute("opacity", "0");
    tooltip.style.opacity = "0";
  });

  svg.addEventListener("wheel", (event) => {
    event.preventDefault();
    const center = massFromClientX(event.clientX);
    const span = state.view.maxX - state.view.minX;
    const nextSpan = span * (event.deltaY > 0 ? 1.2 : 0.82);
    const ratio = (center - state.view.minX) / span;
    state.view = clampView({ minX: center - nextSpan * ratio, maxX: center + nextSpan * (1 - ratio) });
    renderPlot();
  }, { passive: false });

  const plotRect = () => elements.plot.getBoundingClientRect();

  svg.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      return;
    }
    const rect = plotRect();
    const start = Math.min(Math.max(event.clientX - rect.left, margin.left), rect.width - margin.right);
    state.selection = { start, current: start, pointerId: event.pointerId };
    zoomBox.style.left = `${start}px`;
    zoomBox.style.width = '0px';
    zoomBox.style.top = `${margin.top}px`;
    zoomBox.style.height = `${plotHeight}px`;
    zoomBox.style.opacity = '1';
    svg.setPointerCapture(event.pointerId);
  });

  svg.addEventListener("pointermove", (event) => {
    if (state.selection && state.selection.pointerId === event.pointerId) {
      const rect = plotRect();
      const current = Math.min(Math.max(event.clientX - rect.left, margin.left), rect.width - margin.right);
      state.selection.current = current;
      const left = Math.min(state.selection.start, current);
      const widthPx = Math.abs(current - state.selection.start);
      zoomBox.style.left = `${left}px`;
      zoomBox.style.width = `${widthPx}px`;
      zoomBox.style.opacity = widthPx > 2 ? '1' : '0';
      return;
    }
  });

  const stopDrag = (event) => {
    if (!state.selection || (event && state.selection.pointerId !== event.pointerId)) {
      return;
    }
    const widthPx = Math.abs(state.selection.current - state.selection.start);
    if (widthPx > 8) {
      const left = Math.min(state.selection.start, state.selection.current);
      const right = Math.max(state.selection.start, state.selection.current);
      const leftMass = minX + ((left - margin.left) / plotWidth) * (maxX - minX);
      const rightMass = minX + ((right - margin.left) / plotWidth) * (maxX - minX);
      state.view = clampView({ minX: leftMass, maxX: rightMass });
    }
    state.selection = null;
    zoomBox.style.opacity = '0';
    renderPlot();
  };
  svg.addEventListener("pointerup", stopDrag);
  svg.addEventListener("pointercancel", stopDrag);
}

function renderTable() {
  const filteredPeaks = getFilteredPeaks();
  const rows = filteredPeaks.slice(0, 250).map((peak, index) => `\n      <tr>\n        <td>${index + 1}</td>\n        <td>${peak.mass.toFixed(5)}</td>\n        <td>${peak.intensity.toFixed(3)}</td>\n      </tr>\n    `).join("");
  elements.peakTableBody.innerHTML = rows || '<tr><td colspan="3">No peaks match the current filter.</td></tr>';
}

function updateSummary(composition, charge, polarity) {
  const monoMass = monoisotopicMass(composition);
  const monoMz = applyChargeToMass(monoMass, charge, polarity);
  const filteredPeaks = getFilteredPeaks();
  const basePeak = state.peaks.reduce((best, current) => current.intensity > best.intensity ? current : best, { mass: 0, intensity: 0 });
  elements.monoisotopicMass.textContent = monoMass.toFixed(5);
  elements.monoisotopicMz.textContent = monoMz.toFixed(5);
  elements.peakCount.textContent = String(filteredPeaks.length);
  elements.basePeak.textContent = `${basePeak.mass.toFixed(5)} / ${basePeak.intensity.toFixed(2)}`;
}

function downloadCsv(rows, filename) {
  const blob = new Blob([rows], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

function sanitizeFilename(value) {
  return value.replace(/[^a-z0-9-_]+/gi, "_").replace(/^_+|_+$/g, "") || "isotope-pattern";
}

function exportPeaksCsv() {
  const filteredPeaks = getFilteredPeaks();
  if (!filteredPeaks.length) {
    setStatus("No centroid peaks match the current filter.", true);
    return;
  }
  const lines = ["mz,relative_intensity"];
  for (const peak of filteredPeaks) {
    lines.push(`${peak.mass.toFixed(8)},${peak.intensity.toFixed(6)}`);
  }
  downloadCsv(lines.join("\n"), `${sanitizeFilename(state.formula)}-peaks.csv`);
  setStatus(`Downloaded ${filteredPeaks.length} centroid peaks for ${state.formula}.`);
}

function exportProfileCsv() {
  if (!state.profile.length) {
    setStatus("Enable the Gaussian profile and run a simulation before exporting profile data.", true);
    return;
  }
  const lines = ["mz,relative_intensity"];
  for (const point of state.profile) {
    lines.push(`${point.mass.toFixed(8)},${point.intensity.toFixed(6)}`);
  }
  downloadCsv(lines.join("\n"), `${sanitizeFilename(state.formula)}-profile.csv`);
  setStatus(`Downloaded Gaussian profile for ${state.formula}.`);
}

function simulate(resetView = true) {
  try {
    const formula = elements.formulaInput.value.trim();
    const composition = parseFormula(formula);
    const charge = Math.max(1, Number(elements.chargeInput.value) || 1);
    const polarity = elements.polaritySelect.value;
    const neutralPeaks = buildDistribution(composition);
    const peaks = applyChargeToDistribution(neutralPeaks, charge, polarity);
    const resolution = Number(elements.resolutionInput.value);
    const samplesPerFwhm = Number(elements.samplesInput.value);

    state.formula = formula;
    state.composition = composition;
    state.charge = charge;
    state.polarity = polarity;
    state.peaks = peaks;
    state.profile = elements.profileToggle.checked ? simulateGaussianProfile(peaks, resolution, samplesPerFwhm) : [];
    state.view = resetView || !state.view ? defaultViewRange() : clampView(state.view);

    renderPlot();
    renderTable();
    updateSummary(composition, charge, polarity);
    setStatus(`Simulated ${formula} as ${charge}${polarity === "cation" ? "+" : "-"} ion(s).`);
  } catch (error) {
    state.peaks = [];
    state.profile = [];
    state.view = null;
    renderPlot();
    renderTable();
    elements.monoisotopicMass.textContent = "-";
    elements.monoisotopicMz.textContent = "-";
    elements.peakCount.textContent = "-";
    elements.basePeak.textContent = "-";
    setStatus(error.message, true);
  }
}

function zoomPlot(factor) {
  if (!state.peaks.length) {
    return;
  }
  const center = (state.view.minX + state.view.maxX) / 2;
  const span = (state.view.maxX - state.view.minX) * factor;
  state.view = clampView({ minX: center - span / 2, maxX: center + span / 2 });
  renderPlot();
}

function bindEvents() {
  elements.resolutionInput.addEventListener("input", () => {
    elements.resolutionOutput.value = elements.resolutionInput.value;
  });

  elements.samplesInput.addEventListener("input", () => {
    elements.samplesOutput.value = `${elements.samplesInput.value} pts/FWHM`;
  });

  elements.simulateButton.addEventListener("click", () => simulate(true));
  elements.peaksDownload.addEventListener("click", exportPeaksCsv);
  elements.profileDownload.addEventListener("click", exportProfileCsv);
  elements.profileToggle.addEventListener("change", () => simulate(true));
  elements.sticksToggle.addEventListener("change", renderPlot);
  elements.peakFilterInput.addEventListener("input", () => {
    renderTable();
    updateSummary(state.composition, state.charge, state.polarity);
  });
  elements.resolutionInput.addEventListener("change", () => simulate(true));
  elements.samplesInput.addEventListener("change", () => simulate(true));
  elements.chargeInput.addEventListener("change", () => simulate(true));
  elements.polaritySelect.addEventListener("change", () => simulate(true));
  elements.zoomIn.addEventListener("click", () => zoomPlot(0.7));
  elements.zoomOut.addEventListener("click", () => zoomPlot(1.4));
  elements.resetView.addEventListener("click", () => {
    state.view = defaultViewRange();
    renderPlot();
  });

  elements.formulaInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      simulate(true);
    }
  });

  document.querySelectorAll("[data-formula]").forEach((button) => {
    button.addEventListener("click", () => {
      elements.formulaInput.value = button.dataset.formula;
      simulate(true);
    });
  });
}

bindEvents();
elements.resolutionOutput.value = elements.resolutionInput.value;
elements.samplesOutput.value = `${elements.samplesInput.value} pts/FWHM`;
renderPlot();
simulate(true);
