const orbitrapCanvas = document.getElementById("orbitrap-canvas");
const orbitrapContext = orbitrapCanvas.getContext("2d");

const controls = {
  ionCount: document.getElementById("ion-count-input"),
  ionCountOutput: document.getElementById("ion-count-output"),
  orbitalSpeed: document.getElementById("orbital-speed-input"),
  orbitalSpeedOutput: document.getElementById("orbital-speed-output"),
  axialAmplitude: document.getElementById("axial-amplitude-input"),
  axialAmplitudeOutput: document.getElementById("axial-amplitude-output"),
  trailLength: document.getElementById("trail-length-input"),
  trailLengthOutput: document.getElementById("trail-length-output"),
  toggle: document.getElementById("orbitrap-toggle"),
  reset: document.getElementById("orbitrap-reset")
};

const trapModel = {
  Rm: 1.0,
  R1: 0.46,
  R2: 1.12,
  omegaZ: 1.0
};

const animationState = {
  running: true,
  time: 0,
  lastFrame: performance.now(),
  ions: []
};

function resizeCanvas() {
  const stageWidth = orbitrapCanvas.parentElement.clientWidth;
  const targetHeight = Math.max(420, Math.min(window.innerHeight - 220, 680));
  orbitrapCanvas.width = Math.floor(stageWidth * window.devicePixelRatio);
  orbitrapCanvas.height = Math.floor(targetHeight * window.devicePixelRatio);
  orbitrapCanvas.style.height = `${targetHeight}px`;
  orbitrapCanvas.style.width = `${stageWidth}px`;
  orbitrapContext.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
}

function syncOutputs() {
  controls.ionCountOutput.value = controls.ionCount.value;
  controls.orbitalSpeedOutput.value = `${Number(controls.orbitalSpeed.value).toFixed(1)}x`;
  controls.axialAmplitudeOutput.value = Number(controls.axialAmplitude.value).toFixed(2);
  controls.trailLengthOutput.value = controls.trailLength.value;
}

function electrodeZ(r, radius) {
  if (r <= 0 || r > radius) {
    return 0;
  }
  const inside = (r * r - radius * radius) / 2 + (trapModel.Rm * trapModel.Rm * Math.log(radius / r));
  return inside > 0 ? Math.sqrt(inside) : 0;
}

function equipotentialZ(r, equatorialRadius) {
  if (r <= 0) {
    return 0;
  }
  const inside = (r * r - equatorialRadius * equatorialRadius) / 2 + (trapModel.Rm * trapModel.Rm * Math.log(equatorialRadius / r));
  return inside > 0 ? Math.sqrt(inside) : 0;
}

function omegaPhi(radius) {
  return Math.sqrt(Math.max((trapModel.Rm * trapModel.Rm) / (radius * radius) - 1, 0) / 2);
}

function createIon(index, count) {
  const baseRadius = 0.54 + 0.1 * ((index + 0.5) / Math.max(count, 1));
  const stableRadius = Math.min(baseRadius, trapModel.Rm / Math.sqrt(2) - 0.03);
  const perturbation = (Math.random() - 0.5) * 0.018;
  const radius = stableRadius + perturbation;
  const l = radius * radius * omegaPhi(radius);
  const axialPhase = (Math.PI * 2 * index) / Math.max(count, 1);
  const mzFactor = 0.65 + ((index + 0.5) / Math.max(count, 1)) * 1.35;
  const frequencyScale = 1 / Math.sqrt(mzFactor);
  const hue = 205 - ((mzFactor - 0.65) / 1.35) * 155;
  return {
    r: radius,
    rDot: (Math.random() - 0.5) * 0.015,
    theta: (Math.PI * 2 * index) / Math.max(count, 1),
    angularMomentum: l,
    zAmplitude: 0.22 * Number(controls.axialAmplitude.value) * (0.88 + Math.random() * 0.24),
    axialPhase,
    hue,
    referenceRadius: radius,
    mzFactor,
    frequencyScale,
    history: []
  };
}

function resetIons() {
  const count = Number(controls.ionCount.value);
  animationState.ions = Array.from({ length: count }, (_, index) => createIon(index, count));
  animationState.time = 0;
}

function advanceIon(ion, dt) {
  const radialForce = (ion.angularMomentum * ion.angularMomentum) / (ion.r * ion.r * ion.r) - 0.5 * ((trapModel.Rm * trapModel.Rm) / ion.r - ion.r);
  ion.rDot += radialForce * dt;
  ion.r += ion.rDot * dt;
  ion.theta += (ion.angularMomentum / (ion.r * ion.r)) * dt;

  if (!Number.isFinite(ion.r) || ion.r <= trapModel.R1 * 1.06 || ion.r >= trapModel.Rm * 0.985) {
    const replacement = createIon(0, 1);
    ion.r = replacement.r;
    ion.rDot = replacement.rDot;
    ion.theta = replacement.theta;
    ion.angularMomentum = replacement.angularMomentum;
    ion.zAmplitude = replacement.zAmplitude;
    ion.referenceRadius = replacement.referenceRadius;
    ion.mzFactor = replacement.mzFactor;
    ion.frequencyScale = replacement.frequencyScale;
    ion.hue = replacement.hue;
    ion.history = [];
  }
}

function sampleIonPosition(ion, timeOffset) {
  const z = ion.zAmplitude * Math.cos(trapModel.omegaZ * ion.frequencyScale * timeOffset + ion.axialPhase);
  const projectedR = ion.r * Math.cos(ion.theta);
  return { z, projectedR };
}

function drawAxes(width, height, scale, origin) {
  orbitrapContext.save();
  orbitrapContext.strokeStyle = "rgba(24, 36, 45, 0.36)";
  orbitrapContext.fillStyle = "rgba(24, 36, 45, 0.72)";
  orbitrapContext.lineWidth = 1.5;

  orbitrapContext.beginPath();
  orbitrapContext.moveTo(origin.x - scale.zMax * scale.z, origin.y);
  orbitrapContext.lineTo(origin.x + scale.zMax * scale.z, origin.y);
  orbitrapContext.stroke();

  orbitrapContext.beginPath();
  orbitrapContext.moveTo(origin.x, origin.y + scale.rMax * scale.r);
  orbitrapContext.lineTo(origin.x, origin.y - scale.rMax * scale.r);
  orbitrapContext.stroke();

  orbitrapContext.beginPath();
  orbitrapContext.moveTo(origin.x + scale.zMax * scale.z, origin.y);
  orbitrapContext.lineTo(origin.x + scale.zMax * scale.z - 10, origin.y - 4);
  orbitrapContext.lineTo(origin.x + scale.zMax * scale.z - 10, origin.y + 4);
  orbitrapContext.closePath();
  orbitrapContext.fill();

  orbitrapContext.beginPath();
  orbitrapContext.moveTo(origin.x, origin.y - scale.rMax * scale.r);
  orbitrapContext.lineTo(origin.x - 4, origin.y - scale.rMax * scale.r + 10);
  orbitrapContext.lineTo(origin.x + 4, origin.y - scale.rMax * scale.r + 10);
  orbitrapContext.closePath();
  orbitrapContext.fill();

  orbitrapContext.font = '500 14px "IBM Plex Mono", monospace';
  orbitrapContext.fillText('z', origin.x + scale.zMax * scale.z - 18, origin.y - 10);
  orbitrapContext.fillText('r', origin.x + 10, origin.y - scale.rMax * scale.r + 22);
  orbitrapContext.restore();
}

function drawPathFromRFunction(radiusLimit, color, lineWidth, origin, scale) {
  const samples = [];
  const steps = 260;
  for (let index = 1; index <= steps; index += 1) {
    const r = (radiusLimit * index) / steps;
    const z = electrodeZ(r, radiusLimit);
    if (z > 0) {
      samples.push({ r, z });
    }
  }

  orbitrapContext.save();
  orbitrapContext.strokeStyle = color;
  orbitrapContext.lineWidth = lineWidth;
  orbitrapContext.beginPath();
  samples.forEach((point, index) => {
    const x = origin.x - point.z * scale.z;
    const y = origin.y - point.r * scale.r;
    if (index === 0) {
      orbitrapContext.moveTo(x, y);
    } else {
      orbitrapContext.lineTo(x, y);
    }
  });
  for (let index = samples.length - 1; index >= 0; index -= 1) {
    const point = samples[index];
    orbitrapContext.lineTo(origin.x + point.z * scale.z, origin.y - point.r * scale.r);
  }
  orbitrapContext.stroke();

  orbitrapContext.beginPath();
  samples.forEach((point, index) => {
    const x = origin.x - point.z * scale.z;
    const y = origin.y + point.r * scale.r;
    if (index === 0) {
      orbitrapContext.moveTo(x, y);
    } else {
      orbitrapContext.lineTo(x, y);
    }
  });
  for (let index = samples.length - 1; index >= 0; index -= 1) {
    const point = samples[index];
    orbitrapContext.lineTo(origin.x + point.z * scale.z, origin.y + point.r * scale.r);
  }
  orbitrapContext.stroke();
  orbitrapContext.restore();
}

function drawEquipotentials(origin, scale) {
  const levels = [0.56, 0.64, 0.75, 0.88, 0.98];
  orbitrapContext.save();
  orbitrapContext.strokeStyle = 'rgba(10, 76, 87, 0.20)';
  orbitrapContext.lineWidth = 1.1;

  levels.forEach((level) => {
    const points = [];
    for (let r = trapModel.R1 * 1.02; r <= Math.min(level, trapModel.R2); r += 0.004) {
      const z = equipotentialZ(r, level);
      if (z > 0) {
        points.push({ r, z });
      }
    }
    if (!points.length) {
      return;
    }

    orbitrapContext.beginPath();
    points.forEach((point, index) => {
      const x = origin.x - point.z * scale.z;
      const y = origin.y - point.r * scale.r;
      if (index === 0) orbitrapContext.moveTo(x, y);
      else orbitrapContext.lineTo(x, y);
    });
    for (let index = points.length - 1; index >= 0; index -= 1) {
      const point = points[index];
      orbitrapContext.lineTo(origin.x + point.z * scale.z, origin.y - point.r * scale.r);
    }
    orbitrapContext.stroke();

    orbitrapContext.beginPath();
    points.forEach((point, index) => {
      const x = origin.x - point.z * scale.z;
      const y = origin.y + point.r * scale.r;
      if (index === 0) orbitrapContext.moveTo(x, y);
      else orbitrapContext.lineTo(x, y);
    });
    for (let index = points.length - 1; index >= 0; index -= 1) {
      const point = points[index];
      orbitrapContext.lineTo(origin.x + point.z * scale.z, origin.y + point.r * scale.r);
    }
    orbitrapContext.stroke();
  });

  orbitrapContext.restore();
}

function drawElectrodes(origin, scale) {
  orbitrapContext.save();
  orbitrapContext.fillStyle = 'rgba(24, 36, 45, 0.08)';
  drawPathFromRFunction(trapModel.R2, 'rgba(10, 76, 87, 0.42)', 4, origin, scale);
  orbitrapContext.restore();

  orbitrapContext.save();
  orbitrapContext.strokeStyle = 'rgba(217, 115, 13, 0.95)';
  orbitrapContext.lineWidth = 4;
  drawPathFromRFunction(trapModel.R1, 'rgba(217, 115, 13, 0.95)', 4, origin, scale);
  orbitrapContext.restore();
}

function drawIons(origin, scale) {
  const trailLength = Number(controls.trailLength.value);
  animationState.ions.forEach((ion) => {
    const trailPoints = ion.history.slice(-trailLength - 1).map((point, index, array) => ({
      x: origin.x + point.z * scale.z,
      y: origin.y - point.projectedR * scale.r,
      alpha: (index + 1) / Math.max(array.length, 1)
    }));
    if (!trailPoints.length) {
      return;
    }

    for (let index = 1; index < trailPoints.length; index += 1) {
      const previous = trailPoints[index - 1];
      const current = trailPoints[index];
      orbitrapContext.beginPath();
      orbitrapContext.moveTo(previous.x, previous.y);
      orbitrapContext.lineTo(current.x, current.y);
      orbitrapContext.strokeStyle = `hsla(${ion.hue}, 92%, 56%, ${0.04 + current.alpha * 0.72})`;
      orbitrapContext.lineWidth = 1.0 + current.alpha * 2.8;
      orbitrapContext.lineCap = "round";
      orbitrapContext.stroke();
    }

    const head = trailPoints[trailPoints.length - 1];
    orbitrapContext.beginPath();
    orbitrapContext.arc(head.x, head.y, 4.8, 0, Math.PI * 2);
    orbitrapContext.fillStyle = `hsla(${ion.hue}, 96%, 56%, 0.95)`;
    orbitrapContext.fill();
  });
}

function drawMassLegend(width) {
  const legendX = width - 178;
  const legendY = 24;
  orbitrapContext.save();
  orbitrapContext.fillStyle = "rgba(255, 255, 255, 0.72)";
  orbitrapContext.strokeStyle = "rgba(24, 36, 45, 0.10)";
  orbitrapContext.lineWidth = 1;
  orbitrapContext.beginPath();
  orbitrapContext.roundRect(legendX, legendY, 154, 70, 14);
  orbitrapContext.fill();
  orbitrapContext.stroke();

  orbitrapContext.font = '500 12px "IBM Plex Mono", monospace';
  orbitrapContext.fillStyle = "rgba(24, 36, 45, 0.78)";
  orbitrapContext.fillText("relative m/z", legendX + 14, legendY + 20);

  const gradient = orbitrapContext.createLinearGradient(legendX + 14, 0, legendX + 140, 0);
  gradient.addColorStop(0, "hsl(205, 92%, 56%)");
  gradient.addColorStop(0.5, "hsl(130, 92%, 56%)");
  gradient.addColorStop(1, "hsl(50, 92%, 56%)");
  orbitrapContext.fillStyle = gradient;
  orbitrapContext.fillRect(legendX + 14, legendY + 30, 126, 12);

  orbitrapContext.fillStyle = "rgba(24, 36, 45, 0.78)";
  orbitrapContext.fillText("lighter", legendX + 14, legendY + 58);
  orbitrapContext.fillText("heavier", legendX + 84, legendY + 58);
  orbitrapContext.restore();
}

function renderFrame(now) {
  const width = orbitrapCanvas.clientWidth;
  const height = orbitrapCanvas.clientHeight;
  const delta = Math.min((now - animationState.lastFrame) / 1000, 0.05);
  animationState.lastFrame = now;
  const speed = Number(controls.orbitalSpeed.value);

  if (animationState.running) {
    animationState.time += delta * speed;
    animationState.ions.forEach((ion) => advanceIon(ion, delta * speed));
  }
  animationState.ions.forEach((ion) => {
    const point = sampleIonPosition(ion, animationState.time);
    ion.history.push(point);
    const maxHistory = Number(controls.trailLength.value) + 2;
    if (ion.history.length > maxHistory) {
      ion.history.splice(0, ion.history.length - maxHistory);
    }
  });

  orbitrapContext.clearRect(0, 0, width, height);
  const bgGradient = orbitrapContext.createRadialGradient(width / 2, height / 2, 40, width / 2, height / 2, width * 0.48);
  bgGradient.addColorStop(0, 'rgba(255, 255, 255, 0.82)');
  bgGradient.addColorStop(1, 'rgba(216, 230, 240, 0.24)');
  orbitrapContext.fillStyle = bgGradient;
  orbitrapContext.fillRect(0, 0, width, height);

  const origin = { x: width / 2, y: height / 2 };
  const zMax = Math.max(electrodeZ(trapModel.R1 * 0.08, trapModel.R1), electrodeZ(trapModel.R2 * 0.22, trapModel.R2), 1.25);
  const rMax = trapModel.R2 * 1.08;
  const scale = {
    z: (width * 0.38) / zMax,
    r: (height * 0.33) / rMax,
    zMax,
    rMax
  };

  drawAxes(width, height, scale, origin);
  drawEquipotentials(origin, scale);
  drawElectrodes(origin, scale);
  drawIons(origin, scale);
  drawMassLegend(width);

  orbitrapContext.fillStyle = 'rgba(24, 36, 45, 0.78)';
  orbitrapContext.font = '500 13px "IBM Plex Mono", monospace';
  orbitrapContext.fillText('U(r,z) = k/2 (z^2 - r^2/2) + k/2 Rm^2 ln(r/Rm)', 24, 28);
  orbitrapContext.fillText('Mixed m/z packet: omega_z ~ (m/z)^-1/2; radial motion numerically integrated from Eq. 3', 24, 48);

  requestAnimationFrame(renderFrame);
}

controls.ionCount.addEventListener('input', () => {
  syncOutputs();
  resetIons();
});
controls.orbitalSpeed.addEventListener('input', syncOutputs);
controls.axialAmplitude.addEventListener('input', () => {
  syncOutputs();
  resetIons();
});
controls.trailLength.addEventListener('input', syncOutputs);

controls.toggle.addEventListener('click', () => {
  animationState.running = !animationState.running;
  controls.toggle.textContent = animationState.running ? 'Pause' : 'Resume';
});

controls.reset.addEventListener('click', resetIons);
window.addEventListener('resize', resizeCanvas);

resizeCanvas();
syncOutputs();
resetIons();
requestAnimationFrame(renderFrame);
