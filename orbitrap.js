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

function createIon(index) {
  return {
    phase: (Math.PI * 2 * index) / Number(controls.ionCount.value),
    orbitRadius: 0.38 + Math.random() * 0.18,
    ellipseScale: 0.35 + Math.random() * 0.28,
    axialPhase: Math.random() * Math.PI * 2,
    axialFrequency: 0.7 + Math.random() * 0.55,
    hue: 182 + Math.random() * 28
  };
}

function resetIons() {
  animationState.ions = Array.from({ length: Number(controls.ionCount.value) }, (_, index) => createIon(index));
  animationState.time = 0;
}

function drawTrap(width, height) {
  const cx = width / 2;
  const cy = height / 2;
  const outerW = width * 0.78;
  const outerH = height * 0.74;
  const innerW = width * 0.19;
  const innerH = height * 0.58;

  orbitrapContext.save();
  orbitrapContext.translate(cx, cy);

  const shellGradient = orbitrapContext.createLinearGradient(-outerW / 2, 0, outerW / 2, 0);
  shellGradient.addColorStop(0, "rgba(22, 48, 61, 0.15)");
  shellGradient.addColorStop(0.5, "rgba(22, 48, 61, 0.05)");
  shellGradient.addColorStop(1, "rgba(22, 48, 61, 0.15)");

  orbitrapContext.beginPath();
  orbitrapContext.ellipse(0, 0, outerW / 2, outerH / 2, 0, 0, Math.PI * 2);
  orbitrapContext.fillStyle = shellGradient;
  orbitrapContext.fill();
  orbitrapContext.lineWidth = 5;
  orbitrapContext.strokeStyle = "rgba(10, 76, 87, 0.35)";
  orbitrapContext.stroke();

  const spindleGradient = orbitrapContext.createLinearGradient(0, -innerH / 2, 0, innerH / 2);
  spindleGradient.addColorStop(0, "rgba(217, 115, 13, 0.88)");
  spindleGradient.addColorStop(0.5, "rgba(242, 162, 68, 0.98)");
  spindleGradient.addColorStop(1, "rgba(217, 115, 13, 0.88)");
  orbitrapContext.beginPath();
  orbitrapContext.ellipse(0, 0, innerW / 2, innerH / 2, 0, 0, Math.PI * 2);
  orbitrapContext.fillStyle = spindleGradient;
  orbitrapContext.fill();

  orbitrapContext.setLineDash([8, 10]);
  orbitrapContext.beginPath();
  orbitrapContext.moveTo(-outerW * 0.42, 0);
  orbitrapContext.lineTo(outerW * 0.42, 0);
  orbitrapContext.strokeStyle = "rgba(10, 76, 87, 0.25)";
  orbitrapContext.lineWidth = 2;
  orbitrapContext.stroke();
  orbitrapContext.setLineDash([]);

  orbitrapContext.restore();
}

function drawIons(width, height) {
  const cx = width / 2;
  const cy = height / 2;
  const baseRadius = width * 0.29;
  const verticalExtent = height * 0.25 * Number(controls.axialAmplitude.value);
  const speed = Number(controls.orbitalSpeed.value);
  const trailLength = Number(controls.trailLength.value);

  animationState.ions.forEach((ion) => {
    for (let step = trailLength; step >= 0; step -= 1) {
      const t = animationState.time - step * 0.018;
      const angle = ion.phase + t * speed;
      const x = cx + Math.cos(angle) * baseRadius * ion.orbitRadius;
      const y = cy + Math.sin(angle * 0.9) * baseRadius * ion.ellipseScale + Math.sin(t * ion.axialFrequency + ion.axialPhase) * verticalExtent;
      const alpha = 1 - (step / (trailLength + 1));
      orbitrapContext.beginPath();
      orbitrapContext.arc(x, y, step === 0 ? 5.2 : 2.2 + alpha * 2.4, 0, Math.PI * 2);
      orbitrapContext.fillStyle = `hsla(${ion.hue}, 90%, 56%, ${0.08 + alpha * 0.72})`;
      orbitrapContext.fill();
    }
  });
}

function renderFrame(now) {
  const width = orbitrapCanvas.clientWidth;
  const height = orbitrapCanvas.clientHeight;
  const delta = Math.min((now - animationState.lastFrame) / 1000, 0.05);
  animationState.lastFrame = now;
  if (animationState.running) {
    animationState.time += delta;
  }

  orbitrapContext.clearRect(0, 0, width, height);

  const bgGradient = orbitrapContext.createRadialGradient(width / 2, height / 2, 40, width / 2, height / 2, width * 0.46);
  bgGradient.addColorStop(0, "rgba(255, 255, 255, 0.72)");
  bgGradient.addColorStop(1, "rgba(216, 230, 240, 0.18)");
  orbitrapContext.fillStyle = bgGradient;
  orbitrapContext.fillRect(0, 0, width, height);

  drawTrap(width, height);
  drawIons(width, height);

  requestAnimationFrame(renderFrame);
}

controls.ionCount.addEventListener("input", () => {
  syncOutputs();
  resetIons();
});
controls.orbitalSpeed.addEventListener("input", syncOutputs);
controls.axialAmplitude.addEventListener("input", syncOutputs);
controls.trailLength.addEventListener("input", syncOutputs);

controls.toggle.addEventListener("click", () => {
  animationState.running = !animationState.running;
  controls.toggle.textContent = animationState.running ? "Pause" : "Resume";
});

controls.reset.addEventListener("click", resetIons);
window.addEventListener("resize", resizeCanvas);

resizeCanvas();
syncOutputs();
resetIons();
requestAnimationFrame(renderFrame);
