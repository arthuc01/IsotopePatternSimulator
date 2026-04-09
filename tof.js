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
  lowerDriftLength: 1.2,
  upperDriftLength: 0.34,
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

function clampMass(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(6000, Math.max(20, Math.round(numeric)));
}

function getMasses() {
  const fallbacks = [150, 500, 1200];
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

function computeLinearTimeSeconds(massDa, voltageKV, energyFactor) {
  const mass = massDa * tofPhysics.atomicMassUnit;
  const voltage = voltageKV * 1000;
  const kineticEnergy = tofPhysics.elementaryCharge * voltage * energyFactor;
  const field = voltage / tofPhysics.accelerationLength;
  const acceleration = (tofPhysics.elementaryCharge * field) / mass;
  const tAcceleration = Math.sqrt((2 * tofPhysics.accelerationLength) / acceleration);
  const velocity = Math.sqrt((2 * kineticEnergy) / mass);
  const tDrift = tofPhysics.lowerDriftLength / velocity;
  return tAcceleration + tDrift;
}

function computeReflectronTerms(massDa, voltageKV, energyFactor, focusFactor) {
  const mass = massDa * tofPhysics.atomicMassUnit;
  const voltage = voltageKV * 1000;
  const kineticEnergy = tofPhysics.elementaryCharge * voltage * energyFactor;
  const velocity = Math.sqrt((2 * kineticEnergy) / mass);
  const field = (focusFactor * 4 * voltage) / (tofPhysics.lowerDriftLength + tofPhysics.upperDriftLength);
  const tAcceleration = Math.sqrt((2 * mass * tofPhysics.accelerationLength) / (tofPhysics.elementaryCharge * (voltage / tofPhysics.accelerationLength)));
  const tLower = tofPhysics.lowerDriftLength / velocity;
  const tUpper = tofPhysics.upperDriftLength / velocity;
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
  const energyOffsets = Array.from({ length: tofPhysics.packetParticles }, (_, index) => {
    if (tofPhysics.packetParticles === 1) {
      return 0;
    }
    return -spreadFraction + (2 * spreadFraction * index) / (tofPhysics.packetParticles - 1);
  });

  tofState.packet = [];
  tofState.stats = masses.map((band) => {
    const ions = energyOffsets.map((offset, index) => {
      const energyFactor = 1 + offset;
      const base = mode === "reflectron"
        ? computeReflectronTerms(band.mass, voltageKV, energyFactor, focusFactor)
        : { totalTime: computeLinearTimeSeconds(band.mass, voltageKV, energyFactor) };
      const jitter = (index - energyOffsets.length / 2) * 0.000002;
      const totalTime = base.totalTime + jitter;
      const ion = {
        label: band.label,
        hue: band.hue,
        mass: band.mass,
        energyFactor,
        totalTime,
        displayTime: 0,
        mode
      };
      if (mode === "reflectron") {
        Object.assign(ion, base);
      }
      tofState.packet.push(ion);
      return ion;
    });

    ions.sort((left, right) => left.totalTime - right.totalTime);
    const mean = ions.reduce((sum, ion) => sum + ion.totalTime, 0) / ions.length;
    const width = ions[ions.length - 1].totalTime - ions[0].totalTime;
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
  tofState.activeFlightMs = 4400;
  tofState.packet.forEach((ion) => {
    ion.displayTime = (ion.totalTime / maxTime) * (tofState.activeFlightMs / 1000);
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
  return {
    sourceX: width * 0.08,
    accelStartX: width * 0.14,
    accelEndX: width * 0.24,
    splitterX: width * 0.76,
    reflectorEndX: width * 0.92,
    linearDetectorX: width * 0.88,
    reflectronDetectorX: width * 0.88,
    lowerY: height * 0.66,
    upperY: height * 0.34,
    traceTop: height * 0.77,
    traceBottom: height * 0.94
  };
}

function positionLinearIon(ion, elapsedSeconds, layout) {
  const effective = Math.min(elapsedSeconds, ion.displayTime);
  const tAcceleration = ion.displayTime * 0.11;
  const tDrift = ion.displayTime - tAcceleration;
  const startX = layout.sourceX;
  const accelX = layout.accelEndX;
  const detectorX = layout.linearDetectorX;

  if (effective <= tAcceleration) {
    const progress = effective / Math.max(tAcceleration, 1e-9);
    const eased = progress * progress;
    return { x: startX + (accelX - startX) * eased, y: layout.lowerY };
  }

  const progress = (effective - tAcceleration) / Math.max(tDrift, 1e-9);
  return { x: accelX + (detectorX - accelX) * Math.min(progress, 1), y: layout.lowerY };
}

function positionReflectronIon(ion, elapsedSeconds, layout) {
  const effective = Math.min(elapsedSeconds, ion.displayTime);
  const entryX = layout.splitterX;
  const detectorX = layout.reflectronDetectorX;
  const scale = ion.displayTime / Math.max(ion.totalTime, 1e-9);
  const tAcceleration = ion.tAcceleration * scale;
  const tLower = ion.tLower * scale;
  const tPenetration = ion.tPenetration * scale;
  const tUpper = ion.tUpper * scale;
  const turnaroundDepth = Math.min(
    entryX + (layout.reflectorEndX - entryX) * (ion.penetration / (tofPhysics.lowerDriftLength * 0.34)),
    layout.reflectorEndX - 4
  );

  if (effective <= tAcceleration) {
    const progress = effective / Math.max(tAcceleration, 1e-9);
    const eased = progress * progress;
    return {
      x: layout.sourceX + (layout.accelEndX - layout.sourceX) * eased,
      y: layout.lowerY
    };
  }

  if (effective <= tAcceleration + tLower) {
    const progress = (effective - tAcceleration) / Math.max(tLower, 1e-9);
    return {
      x: layout.accelEndX + (entryX - layout.accelEndX) * progress,
      y: layout.lowerY
    };
  }

  if (effective <= tAcceleration + tLower + tPenetration) {
    const progress = (effective - tAcceleration - tLower) / Math.max(tPenetration, 1e-9);
    return {
      x: entryX + (turnaroundDepth - entryX) * progress,
      y: layout.lowerY
    };
  }

  if (effective <= tAcceleration + tLower + 2 * tPenetration) {
    const progress = (effective - tAcceleration - tLower - tPenetration) / Math.max(tPenetration, 1e-9);
    const x = turnaroundDepth + (entryX - turnaroundDepth) * progress;
    const y = layout.lowerY - (layout.lowerY - layout.upperY) * Math.sin(progress * Math.PI) * 0.22;
    return { x, y };
  }

  const progress = (effective - tAcceleration - tLower - 2 * tPenetration) / Math.max(tUpper, 1e-9);
  return {
    x: entryX + (detectorX - entryX) * Math.min(progress, 1),
    y: layout.upperY
  };
}

function drawTofBackground(width, height, layout, mode) {
  const gradient = tofContext.createRadialGradient(width * 0.5, height * 0.42, 40, width * 0.5, height * 0.42, width * 0.5);
  gradient.addColorStop(0, "rgba(255, 255, 255, 0.88)");
  gradient.addColorStop(1, "rgba(217, 232, 237, 0.20)");
  tofContext.fillStyle = gradient;
  tofContext.fillRect(0, 0, width, height);

  tofContext.fillStyle = "rgba(10, 76, 87, 0.08)";
  tofContext.fillRect(layout.sourceX, layout.lowerY - 16, layout.linearDetectorX - layout.sourceX, 32);
  tofContext.fillStyle = "rgba(13, 108, 116, 0.12)";
  tofContext.fillRect(layout.accelStartX, layout.lowerY - 30, layout.accelEndX - layout.accelStartX, 60);

  tofContext.strokeStyle = "rgba(24, 36, 45, 0.14)";
  tofContext.lineWidth = 1.5;
  tofContext.setLineDash([6, 6]);
  tofContext.beginPath();
  tofContext.moveTo(layout.sourceX, layout.lowerY);
  tofContext.lineTo(layout.linearDetectorX, layout.lowerY);
  tofContext.stroke();
  tofContext.setLineDash([]);

  tofContext.strokeStyle = "rgba(10, 76, 87, 0.50)";
  tofContext.lineWidth = 3;
  tofContext.strokeRect(layout.sourceX, layout.lowerY - 16, layout.linearDetectorX - layout.sourceX, 32);
  if (mode === "reflectron") {
    tofContext.fillStyle = "rgba(10, 76, 87, 0.08)";
    tofContext.fillRect(layout.splitterX, layout.upperY - 16, layout.reflectronDetectorX - layout.splitterX, 32);
    tofContext.strokeRect(layout.splitterX, layout.upperY - 16, layout.reflectronDetectorX - layout.splitterX, 32);

    tofContext.fillStyle = "rgba(217, 115, 13, 0.12)";
    tofContext.fillRect(layout.splitterX, layout.upperY - 52, layout.reflectorEndX - layout.splitterX, layout.lowerY - layout.upperY + 104);
    tofContext.strokeStyle = "rgba(217, 115, 13, 0.46)";
    tofContext.strokeRect(layout.splitterX, layout.upperY - 52, layout.reflectorEndX - layout.splitterX, layout.lowerY - layout.upperY + 104);
  }

  tofContext.fillStyle = "rgba(24, 36, 45, 0.78)";
  tofContext.font = '500 12px "IBM Plex Mono", monospace';
  tofContext.fillText("source", layout.sourceX - 18, layout.lowerY - 40);
  tofContext.fillText("accelerate", layout.accelStartX + 2, layout.lowerY - 40);
  tofContext.fillText("drift", layout.accelEndX + 70, layout.lowerY - 40);
  if (mode === "reflectron") {
    tofContext.fillText("reflectron", layout.splitterX + 12, layout.upperY - 64);
    tofContext.fillText("detector", layout.reflectronDetectorX - 42, layout.upperY - 24);
  } else {
    tofContext.fillText("detector", layout.linearDetectorX - 34, layout.lowerY - 40);
  }

  tofContext.strokeStyle = "rgba(24, 36, 45, 0.42)";
  tofContext.lineWidth = 2;
  const detectorX = mode === "reflectron" ? layout.reflectronDetectorX : layout.linearDetectorX;
  const detectorY = mode === "reflectron" ? layout.upperY : layout.lowerY;
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
  tofState.packet.forEach((ion) => {
    const x = left + (ion.totalTime / maxTime) * (right - left);
    const y = layout.traceBottom - (ion.energyFactor - (1 - Number(tofControls.spread.value) / 100)) / Math.max((Number(tofControls.spread.value) / 50) || 0.0001, 0.0001) * traceHeight;
    tofContext.strokeStyle = `hsla(${ion.hue}, 92%, 50%, 0.55)`;
    tofContext.lineWidth = 2;
    tofContext.beginPath();
    tofContext.moveTo(x, layout.traceBottom);
    tofContext.lineTo(x, Math.max(layout.traceTop + 8, Math.min(layout.traceBottom - 8, y)));
    tofContext.stroke();

    if (elapsedSeconds >= ion.displayTime) {
      tofContext.fillStyle = `hsla(${ion.hue}, 92%, 48%, 0.92)`;
      tofContext.beginPath();
      tofContext.arc(x, layout.traceTop + 10, 3.8, 0, Math.PI * 2);
      tofContext.fill();
    }
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
    tofContext.fillStyle = `hsla(${ion.hue}, 92%, 56%, ${alpha})`;
    tofContext.shadowColor = `hsla(${ion.hue}, 92%, 56%, 0.42)`;
    tofContext.shadowBlur = 10;
    tofContext.beginPath();
    tofContext.arc(position.x, position.y, 6.2, 0, Math.PI * 2);
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
