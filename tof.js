const tofCanvas = document.getElementById("tof-canvas");
const tofContext = tofCanvas.getContext("2d");

const tofControls = {
  mode: document.getElementById("tof-mode-input"),
  voltage: document.getElementById("tof-voltage-input"),
  voltageOutput: document.getElementById("tof-voltage-output"),
  spread: document.getElementById("tof-spread-input"),
  spreadOutput: document.getElementById("tof-spread-output"),
  speed: document.getElementById("tof-speed-input"),
  speedOutput: document.getElementById("tof-speed-output"),
  focus: document.getElementById("tof-focus-input"),
  focusOutput: document.getElementById("tof-focus-output"),
  massLight: document.getElementById("tof-mass-light-input"),
  massMid: document.getElementById("tof-mass-mid-input"),
  massHeavy: document.getElementById("tof-mass-heavy-input"),
  modeSummary: document.getElementById("tof-mode-summary"),
  focusSummary: document.getElementById("tof-focus-summary"),
  tableBody: document.getElementById("tof-table-body"),
  toggle: document.getElementById("tof-toggle"),
  reset: document.getElementById("tof-reset")
};

const tofMassBands = [
  { label: "Light", hue: 205, control: tofControls.massLight },
  { label: "Mid", hue: 128, control: tofControls.massMid },
  { label: "Heavy", hue: 42, control: tofControls.massHeavy }
];

const tofPhysics = {
  elementaryCharge: 1.602176634e-19,
  atomicMassUnit: 1.66053906660e-27,
  accelerationLength: 0.035,
  linearDriftLength: 1.2,
  reflectronLowerDriftLength: 0.62,
  reflectronUpperDriftLength: 0.62,
  reflectorDisplayLength: 0.24,
  packetParticles: 11
};

const tofState = {
  running: true,
  loopStart: performance.now(),
  elapsedMs: 0,
  cycleDurationMs: 6000,
  activeFlightMs: 4400,
  packet: [],
  stats: []
};

function inverseNormalCDF(probability) {
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
  const plow = 0.02425;
  const phigh = 1 - plow;

  if (probability <= 0) {
    return -Infinity;
  }
  if (probability >= 1) {
    return Infinity;
  }

  if (probability < plow) {
    const q = Math.sqrt(-2 * Math.log(probability));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
      / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }

  if (probability > phigh) {
    const q = Math.sqrt(-2 * Math.log(1 - probability));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
      / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }

  const q = probability - 0.5;
  const r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q
    / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

function createGaussianEnergyProfile(spreadFraction, count) {
  if (count <= 1) {
    return [{ offset: 0, weight: 1, zScore: 0 }];
  }

  const quantiles = Array.from({ length: count }, (_, index) => inverseNormalCDF((index + 0.5) / count));
  const maxAbs = Math.max(...quantiles.map((value) => Math.abs(value)));
  const weights = quantiles.map((value) => Math.exp(-0.5 * value * value));
  const weightSum = weights.reduce((sum, value) => sum + value, 0);
  return quantiles.map((value, index) => ({
    offset: (value / Math.max(maxAbs, 1e-9)) * spreadFraction,
    weight: weights[index] / Math.max(weightSum, 1e-9),
    zScore: value
  }));
}

function clampMass(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(6000, Math.max(20, Math.round(numeric)));
}

function getMasses() {
  const fallbacks = [500, 2000, 4000];
  return tofMassBands.map((band, index) => {
    const mass = clampMass(band.control.value, fallbacks[index]);
    band.control.value = String(mass);
    return {
      label: band.label,
      hue: band.hue,
      mass
    };
  });
}

function syncTofOutputs() {
  tofControls.voltageOutput.value = `${Number(tofControls.voltage.value).toFixed(1)} kV`;
  tofControls.spreadOutput.value = `${Number(tofControls.spread.value).toFixed(1)}%`;
  tofControls.speedOutput.value = `${Number(tofControls.speed.value).toFixed(1)}x`;
  tofControls.focusOutput.value = `${Number(tofControls.focus.value).toFixed(2)}x`;

  const reflectron = tofControls.mode.value === "reflectron";
  tofControls.focus.disabled = !reflectron;
  tofControls.focusOutput.style.opacity = reflectron ? "1" : "0.45";
  tofControls.modeSummary.textContent = reflectron
    ? "t contains drift and mirror terms; focused near center energy"
    : "t scales with path length / sqrt(E) in linear drift";
  tofControls.focusSummary.textContent = reflectron
    ? "Faster ions spend longer in the mirror, reducing temporal spread"
    : "Higher-energy ions arrive earlier because no mirror compensates them";
}

function resizeTofCanvas() {
  const stageWidth = tofCanvas.parentElement.clientWidth;
  const targetHeight = Math.max(420, Math.min(window.innerHeight - 220, 680));
  tofCanvas.width = Math.floor(stageWidth * window.devicePixelRatio);
  tofCanvas.height = Math.floor(targetHeight * window.devicePixelRatio);
  tofCanvas.style.width = `${stageWidth}px`;
  tofCanvas.style.height = `${targetHeight}px`;
  tofContext.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
}

function computeLinearTerms(massDa, voltageKV, energyFactor) {
  const mass = massDa * tofPhysics.atomicMassUnit;
  const voltage = voltageKV * 1000;
  const kineticEnergy = tofPhysics.elementaryCharge * voltage * energyFactor;
  const field = voltage / tofPhysics.accelerationLength;
  const acceleration = (tofPhysics.elementaryCharge * field) / mass;
  const tAcceleration = Math.sqrt((2 * tofPhysics.accelerationLength) / acceleration);
  const velocity = Math.sqrt((2 * kineticEnergy) / mass);
  const tDrift = tofPhysics.linearDriftLength / velocity;
  return {
    totalTime: tAcceleration + tDrift,
    tAcceleration,
    tDrift,
    velocity
  };
}

function computeReflectronTerms(massDa, voltageKV, energyFactor, focusFactor) {
  const mass = massDa * tofPhysics.atomicMassUnit;
  const voltage = voltageKV * 1000;
  const kineticEnergy = tofPhysics.elementaryCharge * voltage * energyFactor;
  const velocity = Math.sqrt((2 * kineticEnergy) / mass);
  const totalReflectronDrift = tofPhysics.reflectronLowerDriftLength + tofPhysics.reflectronUpperDriftLength;
  const field = (focusFactor * 4 * voltage) / totalReflectronDrift;
  const tAcceleration = Math.sqrt((2 * mass * tofPhysics.accelerationLength) / (tofPhysics.elementaryCharge * (voltage / tofPhysics.accelerationLength)));
  const tLower = tofPhysics.reflectronLowerDriftLength / velocity;
  const tUpper = tofPhysics.reflectronUpperDriftLength / velocity;
  const tPenetration = (mass * velocity) / (tofPhysics.elementaryCharge * field);
  const penetration = (voltage * energyFactor) / field;
  return {
    totalTime: tAcceleration + tLower + 2 * tPenetration + tUpper,
    tAcceleration,
    tLower,
    tUpper,
    tPenetration,
    penetration
  };
}

function createTofPacket() {
  const masses = getMasses();
  const mode = tofControls.mode.value;
  const spreadFraction = Number(tofControls.spread.value) / 100;
  const voltageKV = Number(tofControls.voltage.value);
  const focusFactor = Number(tofControls.focus.value);
  const energyProfile = createGaussianEnergyProfile(spreadFraction, tofPhysics.packetParticles);

  tofState.packet = [];
  let maxPhysicalAcceleration = 0;
  tofState.stats = masses.map((band) => {
    const ions = energyProfile.map((packetSlice, index) => {
      const energyFactor = 1 + packetSlice.offset;
      const base = mode === "reflectron"
        ? computeReflectronTerms(band.mass, voltageKV, energyFactor, focusFactor)
        : computeLinearTerms(band.mass, voltageKV, energyFactor);
      maxPhysicalAcceleration = Math.max(maxPhysicalAcceleration, base.tAcceleration);
      const ion = {
        label: band.label,
        hue: band.hue,
        mass: band.mass,
        energyFactor,
        packetWeight: packetSlice.weight,
        totalTime: base.totalTime,
        displayTime: 0,
        displayAccelerationTime: 0,
        mode,
        accelSeed: tofPhysics.packetParticles === 1 ? 1 : index / (tofPhysics.packetParticles - 1)
      };
      Object.assign(ion, base);
      tofState.packet.push(ion);
      return ion;
    });

    ions.sort((left, right) => left.totalTime - right.totalTime);
    const totalWeight = ions.reduce((sum, ion) => sum + ion.packetWeight, 0);
    const mean = ions.reduce((sum, ion) => sum + ion.totalTime * ion.packetWeight, 0) / Math.max(totalWeight, 1e-9);
    const variance = ions.reduce((sum, ion) => {
      const delta = ion.totalTime - mean;
      return sum + (delta * delta * ion.packetWeight);
    }, 0) / Math.max(totalWeight, 1e-9);
    const width = 2.355 * Math.sqrt(Math.max(variance, 0));
    return {
      label: band.label,
      hue: band.hue,
      mass: band.mass,
      meanTime: mean,
      width,
      firstTime: ions[0].totalTime
    };
  });

  const minFirst = Math.min(...tofState.stats.map((item) => item.firstTime));
  tofState.stats.forEach((item) => {
    item.relativeSeparation = item.firstTime - minFirst;
  });

  const maxTime = Math.max(...tofState.packet.map((ion) => ion.totalTime));
  const maxPostAccelerationTime = Math.max(...tofState.packet.map((ion) => ion.totalTime - ion.tAcceleration));
  tofState.activeFlightMs = 4400;
  const accelerationShare = 0.18;
  const commonAccelerationDisplay = (tofState.activeFlightMs / 1000) * accelerationShare;
  tofState.packet.forEach((ion) => {
    const postAccelerationTime = ion.totalTime - ion.tAcceleration;
    ion.displayAccelerationTime = commonAccelerationDisplay;
    ion.displayTime = commonAccelerationDisplay
      + (postAccelerationTime / Math.max(maxPostAccelerationTime, 1e-9)) * ((tofState.activeFlightMs / 1000) - commonAccelerationDisplay);
    ion.accelerationScale = ion.tAcceleration / Math.max(maxPhysicalAcceleration, 1e-12);
  });
  tofState.cycleDurationMs = Math.max(3800, maxTime * 1000 * 1.18);
  tofState.cycleDurationMs = Math.max(tofState.cycleDurationMs, tofState.activeFlightMs + 1200);
  tofState.loopStart = performance.now();
  renderTofTable();
}

function formatMicroseconds(seconds) {
  return `${(seconds * 1e6).toFixed(2)} us`;
}

function renderTofTable() {
  tofControls.tableBody.innerHTML = tofState.stats.map((item) => `
    <tr>
      <td><span style="color:hsl(${item.hue},92%,42%);font-weight:700">${item.label}</span></td>
      <td>${item.mass.toFixed(0)}</td>
      <td>${formatMicroseconds(item.meanTime)}</td>
      <td>${formatMicroseconds(item.width)}</td>
      <td>${formatMicroseconds(item.relativeSeparation)}</td>
    </tr>
  `).join("");
}

function getTofLayout(width, height) {
  const analyzerCenterY = height * 0.56;
  const analyzerGap = height * 0.20;
  return {
    sourceX: width * 0.08,
    accelStartX: width * 0.14,
    accelEndX: width * 0.24,
    mirrorFrontX: width * 0.76,
    reflectorEndX: width * 0.92,
    linearDetectorX: width * 0.88,
    reflectronDetectorX: width * 0.40,
    outboundY: analyzerCenterY - analyzerGap * 0.18,
    returnY: analyzerCenterY + analyzerGap * 0.32,
    returnMergeY: analyzerCenterY + analyzerGap * 0.12,
    traceTop: height * 0.76,
    traceBottom: height * 0.93
  };
}

function interpolatePoint(start, end, progress) {
  return {
    x: start.x + (end.x - start.x) * progress,
    y: start.y + (end.y - start.y) * progress
  };
}

function quadraticBezierPoint(start, control, end, progress) {
  const oneMinus = 1 - progress;
  return {
    x: (oneMinus * oneMinus * start.x) + (2 * oneMinus * progress * control.x) + (progress * progress * end.x),
    y: (oneMinus * oneMinus * start.y) + (2 * oneMinus * progress * control.y) + (progress * progress * end.y)
  };
}

function positionLinearIon(ion, elapsedSeconds, layout) {
  const effective = Math.min(elapsedSeconds, ion.displayTime);
  const tAcceleration = ion.displayAccelerationTime;
  const tDrift = ion.displayTime - tAcceleration;
  const startX = layout.accelStartX + (layout.accelEndX - layout.accelStartX) * ion.accelSeed * 0.9;
  const accelX = layout.accelEndX;
  const detectorX = layout.linearDetectorX;

  if (effective <= tAcceleration) {
    const progress = effective / Math.max(tAcceleration, 1e-9);
    const eased = 1 - ((1 - progress) * (1 - progress));
    return { x: startX + (accelX - startX) * eased, y: layout.outboundY };
  }

  const progress = (effective - tAcceleration) / Math.max(tDrift, 1e-9);
  return { x: accelX + (detectorX - accelX) * Math.min(progress, 1), y: layout.outboundY };
}

function positionReflectronIon(ion, elapsedSeconds, layout) {
  const effective = Math.min(elapsedSeconds, ion.displayTime);
  const entryX = layout.mirrorFrontX;
  const detectorX = layout.reflectronDetectorX;
  const tAcceleration = ion.displayAccelerationTime;
  const remainingDisplay = ion.displayTime - tAcceleration;
  const remainingPhysical = Math.max(ion.totalTime - ion.tAcceleration, 1e-12);
  const scale = remainingDisplay / remainingPhysical;
  const tLower = ion.tLower * scale;
  const tPenetration = ion.tPenetration * scale;
  const tUpper = ion.tUpper * scale;
  const turnaroundDepth = Math.min(
    entryX + (layout.reflectorEndX - entryX) * Math.min(ion.penetration / (tofPhysics.reflectronLowerDriftLength * 0.42), 1),
    layout.reflectorEndX - 4
  );
  const mirrorExit = { x: entryX, y: layout.returnMergeY };
  const detectorPoint = { x: detectorX, y: layout.returnY };
  const turnPoint = { x: turnaroundDepth, y: layout.outboundY };
  const mirrorControl = {
    x: layout.reflectorEndX + (layout.reflectorEndX - entryX) * 0.08,
    y: layout.outboundY + (layout.returnMergeY - layout.outboundY) * 0.52
  };

  if (effective <= tAcceleration) {
    const progress = effective / Math.max(tAcceleration, 1e-9);
    const eased = 1 - ((1 - progress) * (1 - progress));
    return {
      x: layout.accelStartX + (layout.accelEndX - layout.accelStartX) * (ion.accelSeed * 0.9 + (1 - ion.accelSeed * 0.9) * eased),
      y: layout.outboundY
    };
  }

  if (effective <= tAcceleration + tLower) {
    const progress = (effective - tAcceleration) / Math.max(tLower, 1e-9);
    return {
      x: layout.accelEndX + (entryX - layout.accelEndX) * progress,
      y: layout.outboundY
    };
  }

  if (effective <= tAcceleration + tLower + tPenetration) {
    const progress = (effective - tAcceleration - tLower) / Math.max(tPenetration, 1e-9);
    return interpolatePoint({ x: entryX, y: layout.outboundY }, turnPoint, progress);
  }

  if (effective <= tAcceleration + tLower + 2 * tPenetration) {
    const progress = (effective - tAcceleration - tLower - tPenetration) / Math.max(tPenetration, 1e-9);
    return quadraticBezierPoint(turnPoint, mirrorControl, mirrorExit, progress);
  }

  const progress = (effective - tAcceleration - tLower - 2 * tPenetration) / Math.max(tUpper, 1e-9);
  return interpolatePoint(mirrorExit, detectorPoint, Math.min(progress, 1));
}

function drawTofBackground(width, height, layout, mode) {
  const gradient = tofContext.createRadialGradient(width * 0.5, height * 0.42, 40, width * 0.5, height * 0.42, width * 0.5);
  gradient.addColorStop(0, "rgba(255, 255, 255, 0.88)");
  gradient.addColorStop(1, "rgba(217, 232, 237, 0.20)");
  tofContext.fillStyle = gradient;
  tofContext.fillRect(0, 0, width, height);

  const reflectronTopEndX = mode === "reflectron" ? layout.mirrorFrontX : layout.linearDetectorX;
  tofContext.fillStyle = "rgba(10, 76, 87, 0.08)";
  tofContext.fillRect(layout.sourceX, layout.outboundY - 16, reflectronTopEndX - layout.sourceX, 32);
  tofContext.fillStyle = "rgba(13, 108, 116, 0.12)";
  tofContext.fillRect(layout.accelStartX, layout.outboundY - 30, layout.accelEndX - layout.accelStartX, 60);

  tofContext.strokeStyle = "rgba(24, 36, 45, 0.14)";
  tofContext.lineWidth = 1.5;
  tofContext.setLineDash([6, 6]);
  tofContext.beginPath();
  tofContext.moveTo(layout.sourceX, layout.outboundY);
  tofContext.lineTo(reflectronTopEndX, layout.outboundY);
  tofContext.stroke();
  tofContext.setLineDash([]);

  tofContext.strokeStyle = "rgba(10, 76, 87, 0.50)";
  tofContext.lineWidth = 3;
  tofContext.strokeRect(layout.sourceX, layout.outboundY - 16, reflectronTopEndX - layout.sourceX, 32);
  if (mode === "reflectron") {
    tofContext.fillStyle = "rgba(10, 76, 87, 0.08)";
    tofContext.beginPath();
    tofContext.moveTo(layout.reflectronDetectorX, layout.returnY - 16);
    tofContext.lineTo(layout.mirrorFrontX, layout.returnMergeY - 16);
    tofContext.lineTo(layout.mirrorFrontX, layout.returnMergeY + 16);
    tofContext.lineTo(layout.reflectronDetectorX, layout.returnY + 16);
    tofContext.closePath();
    tofContext.fill();
    tofContext.strokeStyle = "rgba(10, 76, 87, 0.50)";
    tofContext.stroke();

    tofContext.fillStyle = "rgba(217, 115, 13, 0.12)";
    tofContext.fillRect(layout.mirrorFrontX, layout.outboundY - 52, layout.reflectorEndX - layout.mirrorFrontX, layout.returnY - layout.outboundY + 104);
    tofContext.strokeStyle = "rgba(217, 115, 13, 0.46)";
    tofContext.strokeRect(layout.mirrorFrontX, layout.outboundY - 52, layout.reflectorEndX - layout.mirrorFrontX, layout.returnY - layout.outboundY + 104);

    tofContext.strokeStyle = "rgba(10, 76, 87, 0.36)";
    tofContext.lineWidth = 2;
    tofContext.beginPath();
    tofContext.moveTo(layout.mirrorFrontX, layout.outboundY);
    tofContext.lineTo(layout.mirrorFrontX, layout.returnMergeY);
    tofContext.stroke();

    tofContext.strokeStyle = "rgba(24, 36, 45, 0.60)";
    tofContext.lineWidth = 1.8;
    tofContext.setLineDash([10, 12]);
    for (let index = 0; index < 5; index += 1) {
      const x = layout.mirrorFrontX + 22 + index * ((layout.reflectorEndX - layout.mirrorFrontX - 36) / 4);
      tofContext.beginPath();
      tofContext.moveTo(x - 6, layout.outboundY - 42);
      tofContext.lineTo(x + 6, layout.returnY + 42);
      tofContext.stroke();
    }
    tofContext.setLineDash([]);
  }

  tofContext.fillStyle = "rgba(24, 36, 45, 0.78)";
  tofContext.font = '500 12px "IBM Plex Mono", monospace';
  tofContext.fillText("source", layout.sourceX - 18, layout.outboundY - 40);
  tofContext.fillText("accelerate", layout.accelStartX + 2, layout.outboundY - 40);
  tofContext.fillText("drift", layout.accelEndX + 70, layout.outboundY - 40);
  if (mode === "reflectron") {
    tofContext.fillText("reflectron", layout.mirrorFrontX + 12, layout.outboundY - 64);
    tofContext.fillText("detector", layout.reflectronDetectorX - 24, layout.returnY + 40);
    tofContext.fillText("return drift", layout.reflectronDetectorX + 18, layout.returnY - 26);
  } else {
    tofContext.fillText("detector", layout.linearDetectorX - 34, layout.outboundY - 40);
  }

  tofContext.strokeStyle = "rgba(24, 36, 45, 0.42)";
  tofContext.lineWidth = 2;
  const detectorX = mode === "reflectron" ? layout.reflectronDetectorX : layout.linearDetectorX;
  const detectorY = mode === "reflectron" ? layout.returnY : layout.outboundY;
  tofContext.beginPath();
  tofContext.moveTo(detectorX, detectorY - 28);
  tofContext.lineTo(detectorX, detectorY + 28);
  tofContext.stroke();
}

function drawTofLegend(width) {
  const masses = getMasses();
  const legendX = width - 224;
  const legendY = 22;
  tofContext.fillStyle = "rgba(255, 255, 255, 0.78)";
  tofContext.strokeStyle = "rgba(24, 36, 45, 0.10)";
  tofContext.lineWidth = 1;
  tofContext.beginPath();
  tofContext.roundRect(legendX, legendY, 200, 104, 14);
  tofContext.fill();
  tofContext.stroke();

  tofContext.font = '500 12px "IBM Plex Mono", monospace';
  tofContext.fillStyle = "rgba(24, 36, 45, 0.78)";
  tofContext.fillText("mass groups", legendX + 14, legendY + 20);
  masses.forEach((mass, index) => {
    const y = legendY + 44 + index * 22;
    tofContext.fillStyle = `hsl(${mass.hue}, 92%, 56%)`;
    tofContext.beginPath();
    tofContext.arc(legendX + 22, y - 4, 6, 0, Math.PI * 2);
    tofContext.fill();
    tofContext.fillStyle = "rgba(24, 36, 45, 0.78)";
    tofContext.fillText(`${mass.label}: ${mass.mass} m/z`, legendX + 38, y);
  });
}

function drawArrivalTrace(width, height, elapsedSeconds) {
  const layout = getTofLayout(width, height);
  const left = width * 0.08;
  const right = width * 0.92;
  const traceHeight = layout.traceBottom - layout.traceTop;
  tofContext.fillStyle = "rgba(255,255,255,0.68)";
  tofContext.fillRect(left, layout.traceTop, right - left, traceHeight);
  tofContext.strokeStyle = "rgba(24, 36, 45, 0.10)";
  tofContext.strokeRect(left, layout.traceTop, right - left, traceHeight);

  tofContext.fillStyle = "rgba(24, 36, 45, 0.78)";
  tofContext.font = '500 12px "IBM Plex Mono", monospace';
  tofContext.fillText("arrival time axis", left, layout.traceTop - 10);

  const maxTime = Math.max(...tofState.packet.map((ion) => ion.totalTime));
  const masses = getMasses();
  const samples = 160;
  const kernelWidth = Math.max(maxTime * 0.012, 1e-7);
  const axisMaxTime = maxTime + (kernelWidth * 3.5);

  masses.forEach((massBand) => {
    const ions = tofState.packet.filter((ion) => ion.label === massBand.label);
    const profile = Array.from({ length: samples }, (_, index) => {
      const time = (index / (samples - 1)) * axisMaxTime;
      const intensity = ions.reduce((sum, ion) => {
        const activation = elapsedSeconds >= ion.displayTime ? 1 : 0;
        if (!activation) {
          return sum;
        }
        const delta = time - ion.totalTime;
        return sum + ion.packetWeight * Math.exp(-0.5 * (delta / kernelWidth) ** 2);
      }, 0);
      return { time, intensity };
    });

    const peak = Math.max(...profile.map((point) => point.intensity), 1e-9);
    tofContext.strokeStyle = `hsla(${massBand.hue}, 92%, 50%, 0.92)`;
    tofContext.lineWidth = 2.2;
    tofContext.beginPath();
    profile.forEach((point, index) => {
      const x = left + (point.time / axisMaxTime) * (right - left);
      const y = layout.traceBottom - (point.intensity / peak) * (traceHeight - 10);
      if (index === 0) {
        tofContext.moveTo(x, y);
      } else {
        tofContext.lineTo(x, y);
      }
    });
    tofContext.stroke();

    const arrivedIons = ions.filter((ion) => elapsedSeconds >= ion.displayTime);
    arrivedIons.forEach((ion) => {
      const x = left + (ion.totalTime / axisMaxTime) * (right - left);
      tofContext.fillStyle = `hsla(${ion.hue}, 92%, 48%, ${0.3 + ion.packetWeight * 2.8})`;
      tofContext.beginPath();
      tofContext.arc(x, layout.traceBottom - 4, 2.4 + ion.packetWeight * 18, 0, Math.PI * 2);
      tofContext.fill();
    });
  });
}

function drawTofFrame(now) {
  const width = tofCanvas.clientWidth;
  const height = tofCanvas.clientHeight;
  const layout = getTofLayout(width, height);
  const mode = tofControls.mode.value;
  const speed = Number(tofControls.speed.value);

  if (tofState.running) {
    tofState.elapsedMs = (now - tofState.loopStart) * speed;
    if (tofState.elapsedMs >= tofState.cycleDurationMs) {
      tofState.loopStart = now;
      tofState.elapsedMs = 0;
    }
  }

  const elapsedSeconds = Math.min(tofState.elapsedMs / 1000, tofState.cycleDurationMs / 1000);
  tofContext.clearRect(0, 0, width, height);
  drawTofBackground(width, height, layout, mode);

  tofState.packet.forEach((ion) => {
    const position = mode === "reflectron"
      ? positionReflectronIon(ion, elapsedSeconds, layout)
      : positionLinearIon(ion, elapsedSeconds, layout);
    const alpha = elapsedSeconds >= ion.displayTime ? 0.35 : 0.94;
    const radius = 4 + ion.packetWeight * 22;
    tofContext.fillStyle = `hsla(${ion.hue}, 92%, 56%, ${Math.min(1, alpha * (0.6 + ion.packetWeight * 5))})`;
    tofContext.shadowColor = `hsla(${ion.hue}, 92%, 56%, ${0.2 + ion.packetWeight * 1.6})`;
    tofContext.shadowBlur = 10;
    tofContext.beginPath();
    tofContext.arc(position.x, position.y, radius, 0, Math.PI * 2);
    tofContext.fill();
    tofContext.shadowBlur = 0;
  });

  drawTofLegend(width);
  drawArrivalTrace(width, height, elapsedSeconds);

  tofContext.fillStyle = "rgba(24, 36, 45, 0.78)";
  tofContext.font = '500 13px "IBM Plex Mono", monospace';
  tofContext.fillText("Linear: t ~ L sqrt(m / 2 q U). Reflectron: added mirror time can compensate kinetic-energy spread.", 24, 28);
  tofContext.fillText(`Mode: ${mode === "reflectron" ? "reflectron" : "linear"} | Voltage: ${Number(tofControls.voltage.value).toFixed(1)} kV | Energy spread: ${Number(tofControls.spread.value).toFixed(1)}%`, 24, 48);

  requestAnimationFrame(drawTofFrame);
}

function rebuildTofPacket() {
  syncTofOutputs();
  createTofPacket();
  tofState.elapsedMs = 0;
}

tofControls.mode.addEventListener("input", rebuildTofPacket);
tofControls.voltage.addEventListener("input", rebuildTofPacket);
tofControls.spread.addEventListener("input", rebuildTofPacket);
tofControls.speed.addEventListener("input", syncTofOutputs);
tofControls.focus.addEventListener("input", rebuildTofPacket);
tofMassBands.forEach((band) => {
  band.control.addEventListener("input", rebuildTofPacket);
});

tofControls.toggle.addEventListener("click", () => {
  tofState.running = !tofState.running;
  if (tofState.running) {
    tofState.loopStart = performance.now() - (tofState.elapsedMs / Math.max(Number(tofControls.speed.value), 0.1));
  }
  tofControls.toggle.textContent = tofState.running ? "Pause" : "Resume";
});

tofControls.reset.addEventListener("click", () => {
  tofState.loopStart = performance.now();
  tofState.elapsedMs = 0;
});

window.addEventListener("resize", resizeTofCanvas);

resizeTofCanvas();
syncTofOutputs();
createTofPacket();
requestAnimationFrame(drawTofFrame);
