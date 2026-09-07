const buttonDefinitions = [
  { id: 'ZL', label: 'ZL', x: 222, y: 79, r: 24 },
  { id: 'L', label: 'L', x: 238, y: 107, r: 24 },
  { id: 'ZR', label: 'ZR', x: 538, y: 79, r: 24 },
  { id: 'R', label: 'R', x: 522, y: 107, r: 24 },
  { id: 'UP', label: 'UP', x: 182, y: 173, r: 21 },
  { id: 'LEFT', label: 'LEFT', x: 142, y: 213, r: 21 },
  { id: 'DOWN', label: 'DN', x: 182, y: 253, r: 21 },
  { id: 'RIGHT', label: 'RT', x: 222, y: 213, r: 21 },
  { id: 'L3', label: 'L3', x: 248, y: 244, r: 24 },
  { id: 'R3', label: 'R3', x: 511, y: 244, r: 24 },
  { id: 'W', label: 'W / Y', x: 553, y: 181, r: 21 },
  { id: 'N', label: 'N / X', x: 593, y: 141, r: 21 },
  { id: 'S', label: 'S / B', x: 593, y: 221, r: 21 },
  { id: 'E', label: 'E / A', x: 633, y: 181, r: 21 },
  { id: '-', label: '-', x: 326, y: 227, r: 18 },
  { id: '+', label: '+', x: 434, y: 227, r: 18 },
  { id: 'HOME', label: 'HOME', x: 380, y: 223, r: 16 },
  { id: 'CAPTURE', label: 'CAP', x: 380, y: 170, r: 16 }
];

const socketPathInput = document.querySelector('#socket-path');
const socketStatus = document.querySelector('#socket-status');
const checkSocketButton = document.querySelector('#check-socket');
const buttonLayer = document.querySelector('#button-layer');
const selectedButtonChip = document.querySelector('#selected-button-chip');
const buttonAssignmentInput = document.querySelector('#button-assignment');
const buttonLabelInput = document.querySelector('#button-label');
const applyButtonMappingButton = document.querySelector('#apply-button-mapping');
const loadButtonDraftButton = document.querySelector('#load-button-draft');
const gyroXInput = document.querySelector('#gyro-x');
const gyroYInput = document.querySelector('#gyro-y');
const gyroPreview = document.querySelector('#gyro-preview');
const applyGyroButton = document.querySelector('#apply-gyro');
const gyroMinSensInput = document.querySelector('#gyro-min-sens');
const gyroMaxSensInput = document.querySelector('#gyro-max-sens');
const gyroMinThresholdInput = document.querySelector('#gyro-min-threshold');
const gyroMaxThresholdInput = document.querySelector('#gyro-max-threshold');
const gyroCurveGrid = document.querySelector('#gyro-curve-grid');
const gyroCurveLine = document.querySelector('#gyro-curve-line');
const gyroCurvePreview = document.querySelector('#gyro-curve-preview');
const applyGyroCurveButton = document.querySelector('#apply-gyro-curve');
const accelerationRateInput = document.querySelector('#acceleration-rate');
const accelerationCapInput = document.querySelector('#acceleration-cap');
const accelerationPreview = document.querySelector('#acceleration-preview');
const curveGrid = document.querySelector('#curve-grid');
const curveLine = document.querySelector('#curve-line');
const applyAccelerationButton = document.querySelector('#apply-acceleration');
const rawCommandsInput = document.querySelector('#raw-commands');
const sendRawCommandsButton = document.querySelector('#send-raw-commands');
const insertButtonCommandButton = document.querySelector('#insert-button-command');
const activityLog = document.querySelector('#activity-log');

let selectedButton = buttonDefinitions[10];
const buttonDrafts = new Map();

function parseFiniteNumber(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeSingleLine(value) {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function getGyroValues() {
  return {
    x: Math.max(0, parseFiniteNumber(gyroXInput.value, 0)),
    y: Math.max(0, parseFiniteNumber(gyroYInput.value, 0))
  };
}

function getAccelerationValues() {
  return {
    rate: Math.max(0, parseFiniteNumber(accelerationRateInput.value, 0)),
    cap: Math.max(1, parseFiniteNumber(accelerationCapInput.value, 1))
  };
}

function getGyroCurveValues() {
  const minSens = Math.max(0, parseFiniteNumber(gyroMinSensInput.value, 0));
  const maxSensRaw = Math.max(0, parseFiniteNumber(gyroMaxSensInput.value, minSens));
  const minThreshold = Math.max(0, parseFiniteNumber(gyroMinThresholdInput.value, 0));
  const maxThresholdRaw = Math.max(0, parseFiniteNumber(gyroMaxThresholdInput.value, minThreshold));

  return {
    minSens,
    maxSens: Math.max(minSens, maxSensRaw),
    minThreshold,
    maxThreshold: Math.max(minThreshold, maxThresholdRaw)
  };
}

function addLogEntry(title, detail, isError = false) {
  const item = document.createElement('li');
  const strong = document.createElement('strong');
  strong.textContent = title;
  item.append(strong, document.createTextNode(` — ${detail}`));
  if (isError) {
    item.style.color = '#ff9e9e';
  }
  activityLog.prepend(item);
}

function getSocketPath() {
  return socketPathInput.value.trim();
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json'
    },
    ...options
  });

  const body = await response.text();
  let payload = {};

  try {
    payload = body ? JSON.parse(body) : {};
  } catch (error) {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(payload.detail || payload.error || body || response.statusText || 'Request failed.');
  }
  return payload;
}

async function checkSocket() {
  const path = getSocketPath();
  const query = path ? `?path=${encodeURIComponent(path)}` : '';

  try {
    const payload = await api(`/api/socket-status${query}`);
    socketPathInput.value = payload.socketPath;
    socketStatus.textContent = payload.available ? 'Socket ready' : 'Socket missing';
    socketStatus.style.background = payload.available ? 'rgba(57, 217, 138, 0.18)' : 'rgba(255, 200, 87, 0.18)';
    addLogEntry('Socket check', payload.available ? `Using ${payload.socketPath}` : payload.message || `Using ${payload.socketPath}`);
  } catch (error) {
    socketStatus.textContent = 'Socket error';
    socketStatus.style.background = 'rgba(255, 110, 110, 0.18)';
    addLogEntry('Socket check failed', error.message, true);
  }
}

async function sendCommands(commands, title) {
  try {
    const payload = await api('/api/commands', {
      method: 'POST',
      body: JSON.stringify({
        socketPath: getSocketPath(),
        commands
      })
    });
    addLogEntry(title, `${payload.sent.join(' · ')} → ${payload.socketPath}`);
    await checkSocket();
  } catch (error) {
    addLogEntry(`${title} failed`, error.message, true);
  }
}

function buildButtonCommand(buttonId, assignment, label) {
  const safeAssignment = sanitizeSingleLine(assignment);
  const safeLabel = sanitizeSingleLine(label);
  const suffix = safeLabel ? ` # ${safeLabel}` : '';
  return `${buttonId} = ${safeAssignment}${suffix}`;
}

function selectButton(buttonId) {
  selectedButton = buttonDefinitions.find((button) => button.id === buttonId) ?? selectedButton;
  selectedButtonChip.textContent = `Selected: ${selectedButton.id}`;

  buttonLayer.querySelectorAll('.svg-button').forEach((element) => {
    const isSelected = element.dataset.buttonId === selectedButton.id;
    element.classList.toggle('is-selected', isSelected);
    element.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
  });

  loadSelectedDraft();
}

function renderButtons() {
  buttonLayer.innerHTML = '';

  for (const button of buttonDefinitions) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'svg-button');
    group.setAttribute('role', 'button');
    group.setAttribute('tabindex', '0');
    group.setAttribute('focusable', 'true');
    group.setAttribute('aria-label', `Configure ${button.id}`);
    group.setAttribute('aria-pressed', 'false');
    group.dataset.buttonId = button.id;

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('class', 'hit-target');
    circle.setAttribute('cx', String(button.x));
    circle.setAttribute('cy', String(button.y));
    circle.setAttribute('r', String(button.r));

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('class', 'label');
    label.setAttribute('x', String(button.x));
    label.setAttribute('y', String(button.y + 1));
    label.textContent = button.label;

    group.append(circle, label);
    group.addEventListener('click', () => selectButton(button.id));
    group.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar' || event.code === 'Space') {
        event.preventDefault();
        selectButton(button.id);
      }
    });
    buttonLayer.append(group);
  }

  selectButton(selectedButton.id);
}

function loadSelectedDraft() {
  const draft = buttonDrafts.get(selectedButton.id);
  buttonAssignmentInput.value = draft?.assignment ?? '';
  buttonLabelInput.value = draft?.label ?? '';
}

function updateGyroPreview() {
  const { x, y } = getGyroValues();
  gyroPreview.textContent = `GYRO_SENS = ${x} ${y}`;
}

function updateAccelerationPreview() {
  const { rate, cap } = getAccelerationValues();
  accelerationPreview.textContent = `STICK_ACCELERATION_RATE = ${rate} · STICK_ACCELERATION_CAP = ${cap}`;
}

function updateGyroCurvePreview() {
  const { minSens, maxSens, minThreshold, maxThreshold } = getGyroCurveValues();
  gyroCurvePreview.textContent = `MIN_GYRO_SENS = ${minSens} · MAX_GYRO_SENS = ${maxSens} · MIN_GYRO_THRESHOLD = ${minThreshold} · MAX_GYRO_THRESHOLD = ${maxThreshold}`;
}

function drawGyroCurve() {
  const { minSens, maxSens, minThreshold, maxThreshold } = getGyroCurveValues();
  const margin = { left: 38, right: 26, top: 20, bottom: 28 };
  const width = 420 - margin.left - margin.right;
  const height = 220 - margin.top - margin.bottom;
  const xMax = Math.max(1, maxThreshold || 1);
  const yMax = Math.max(1, maxSens, minSens) + 0.5;

  gyroCurveGrid.innerHTML = '';
  for (let tick = 0; tick <= 4; tick += 1) {
    const y = margin.top + (height * tick) / 4;
    const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    gridLine.setAttribute('x1', String(margin.left));
    gridLine.setAttribute('x2', String(margin.left + width));
    gridLine.setAttribute('y1', String(y));
    gridLine.setAttribute('y2', String(y));
    gyroCurveGrid.append(gridLine);

    const yLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    yLabel.setAttribute('x', '8');
    yLabel.setAttribute('y', String(y + 4));
    yLabel.textContent = (yMax - ((yMax - 0) * tick) / 4).toFixed(1);
    gyroCurveGrid.append(yLabel);
  }

  for (let tick = 0; tick <= 4; tick += 1) {
    const x = margin.left + (width * tick) / 4;
    const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    gridLine.setAttribute('x1', String(x));
    gridLine.setAttribute('x2', String(x));
    gridLine.setAttribute('y1', String(margin.top));
    gridLine.setAttribute('y2', String(margin.top + height));
    gyroCurveGrid.append(gridLine);

    const xLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    xLabel.setAttribute('x', String(x));
    xLabel.setAttribute('y', '208');
    xLabel.setAttribute('text-anchor', 'middle');
    xLabel.textContent = ((xMax * tick) / 4).toFixed(1);
    gyroCurveGrid.append(xLabel);
  }

  const sensitivityAt = (velocity) => {
    if (velocity <= minThreshold || maxThreshold === minThreshold) {
      return minSens;
    }
    if (velocity >= maxThreshold) {
      return maxSens;
    }

    const progress = (velocity - minThreshold) / (maxThreshold - minThreshold);
    return minSens + (maxSens - minSens) * progress;
  };

  const points = [];
  for (let sample = 0; sample <= 32; sample += 1) {
    const velocity = (xMax * sample) / 32;
    const sensitivity = sensitivityAt(velocity);
    const x = margin.left + (velocity / xMax) * width;
    const y = margin.top + height - (sensitivity / yMax) * height;
    points.push(`${sample === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }

  gyroCurveLine.setAttribute('d', points.join(' '));
  updateGyroCurvePreview();
}

function drawCurve() {
  const { rate, cap } = getAccelerationValues();
  const margin = { left: 38, right: 26, top: 20, bottom: 28 };
  const width = 420 - margin.left - margin.right;
  const height = 220 - margin.top - margin.bottom;
  const timeToCap = rate > 0 ? Math.max(0, (cap - 1) / rate) : null;
  const xMax = timeToCap === 0 ? 0.25 : timeToCap ? Math.max(0.5, timeToCap) : 1;
  const yMax = Math.max(1.1, cap + 0.25);

  curveGrid.innerHTML = '';
  for (let tick = 0; tick <= 4; tick += 1) {
    const y = margin.top + (height * tick) / 4;
    const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    gridLine.setAttribute('x1', String(margin.left));
    gridLine.setAttribute('x2', String(margin.left + width));
    gridLine.setAttribute('y1', String(y));
    gridLine.setAttribute('y2', String(y));
    curveGrid.append(gridLine);

    const yLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    yLabel.setAttribute('x', '8');
    yLabel.setAttribute('y', String(y + 4));
    yLabel.textContent = (yMax - ((yMax - 1) * tick) / 4).toFixed(1);
    curveGrid.append(yLabel);
  }

  for (let tick = 0; tick <= 4; tick += 1) {
    const x = margin.left + (width * tick) / 4;
    const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    gridLine.setAttribute('x1', String(x));
    gridLine.setAttribute('x2', String(x));
    gridLine.setAttribute('y1', String(margin.top));
    gridLine.setAttribute('y2', String(margin.top + height));
    curveGrid.append(gridLine);

    const xLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    xLabel.setAttribute('x', String(x));
    xLabel.setAttribute('y', '208');
    xLabel.setAttribute('text-anchor', 'middle');
    xLabel.textContent = ((xMax * tick) / 4).toFixed(1);
    curveGrid.append(xLabel);
  }

  const points = [];
  for (let sample = 0; sample <= 32; sample += 1) {
    const time = (xMax * sample) / 32;
    const multiplier = Math.min(cap, 1 + rate * time);
    const x = margin.left + (time / xMax) * width;
    const y = margin.top + height - ((multiplier - 1) / (yMax - 1)) * height;
    points.push(`${sample === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }

  curveLine.setAttribute('d', points.join(' '));
  updateAccelerationPreview();
}

checkSocketButton.addEventListener('click', checkSocket);
loadButtonDraftButton.addEventListener('click', loadSelectedDraft);
applyButtonMappingButton.addEventListener('click', async () => {
  const assignment = sanitizeSingleLine(buttonAssignmentInput.value);
  const label = sanitizeSingleLine(buttonLabelInput.value);

  if (!assignment) {
    addLogEntry('Button mapping skipped', 'Enter an assignment first.', true);
    return;
  }

  buttonAssignmentInput.value = assignment;
  buttonLabelInput.value = label;
  buttonDrafts.set(selectedButton.id, { assignment, label });
  await sendCommands([buildButtonCommand(selectedButton.id, assignment, label)], `Mapped ${selectedButton.id}`);
});

applyGyroButton.addEventListener('click', async () => {
  updateGyroPreview();
  await sendCommands([gyroPreview.textContent], 'Updated gyro sensitivity');
});

applyGyroCurveButton.addEventListener('click', async () => {
  drawGyroCurve();
  const { minSens, maxSens, minThreshold, maxThreshold } = getGyroCurveValues();
  await sendCommands([
    `MIN_GYRO_SENS = ${minSens}`,
    `MAX_GYRO_SENS = ${maxSens}`,
    `MIN_GYRO_THRESHOLD = ${minThreshold}`,
    `MAX_GYRO_THRESHOLD = ${maxThreshold}`
  ], 'Updated gyro acceleration curve');
});

applyAccelerationButton.addEventListener('click', async () => {
  drawCurve();
  const { rate, cap } = getAccelerationValues();
  await sendCommands([
    `STICK_ACCELERATION_RATE = ${rate}`,
    `STICK_ACCELERATION_CAP = ${cap}`
  ], 'Updated stick acceleration');
});

sendRawCommandsButton.addEventListener('click', async () => {
  const commands = rawCommandsInput.value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  await sendCommands(commands, 'Sent raw commands');
});

insertButtonCommandButton.addEventListener('click', () => {
  const assignment = sanitizeSingleLine(buttonAssignmentInput.value) || 'LMOUSE';
  const label = sanitizeSingleLine(buttonLabelInput.value);
  buttonAssignmentInput.value = assignment;
  buttonLabelInput.value = label;
  const command = buildButtonCommand(selectedButton.id, assignment, label);
  rawCommandsInput.value = `${rawCommandsInput.value.trim()}\n${command}`.trim();
  addLogEntry('Draft command inserted', command);
});

gyroXInput.addEventListener('input', updateGyroPreview);
gyroYInput.addEventListener('input', updateGyroPreview);
gyroMinSensInput.addEventListener('input', drawGyroCurve);
gyroMaxSensInput.addEventListener('input', drawGyroCurve);
gyroMinThresholdInput.addEventListener('input', drawGyroCurve);
gyroMaxThresholdInput.addEventListener('input', drawGyroCurve);
accelerationRateInput.addEventListener('input', drawCurve);
accelerationCapInput.addEventListener('input', drawCurve);

renderButtons();
updateGyroPreview();
drawGyroCurve();
drawCurve();
checkSocket();
