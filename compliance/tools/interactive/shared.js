/**
 * Shared utilities for compliance interactive tools
 */

// --- Config load/save ---
function loadConfigFromFile(callback) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const config = JSON.parse(ev.target.result);
        callback(config);
      } catch (err) {
        alert('Invalid JSON file: ' + err.message);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function saveConfigToFile(config) {
  config.dates = config.dates || {};
  config.dates.configLastUpdated = new Date().toISOString().split('T')[0];
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'compliance-config.json';
  a.click();
  URL.revokeObjectURL(url);
}

function exportMarkdown(filename, content) {
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// --- UI helpers ---
function el(tag, attrs, children) {
  attrs = attrs || {};
  children = children || [];
  const e = document.createElement(tag);
  for (const k of Object.keys(attrs)) {
    const v = attrs[k];
    if (k === 'className') e.className = v;
    else if (k === 'htmlFor') e.htmlFor = v;
    else if (k === 'textContent') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
    else e.setAttribute(k, v);
  }
  for (const child of children) {
    if (typeof child === 'string') e.appendChild(document.createTextNode(child));
    else if (child) e.appendChild(child);
  }
  return e;
}

function createSection(title, contentArray) {
  const section = el('div', { className: 'section' });
  section.appendChild(el('h2', {}, [title]));
  for (const item of contentArray) {
    if (item) section.appendChild(item);
  }
  return section;
}

function createToggle(label, value, onChange) {
  const wrapper = el('div', { className: 'toggle-row' });
  wrapper.appendChild(el('label', { className: 'toggle-label' }, [label]));
  const group = el('div', { className: 'toggle-group' });

  const yesBtn = el('button', {
    className: 'toggle-btn' + (value === true ? ' active yes' : ''),
    textContent: 'Yes',
    onClick: function() { onChange(true); updateToggle(wrapper, true); }
  });
  const noBtn = el('button', {
    className: 'toggle-btn' + (value === false ? ' active no' : ''),
    textContent: 'No',
    onClick: function() { onChange(false); updateToggle(wrapper, false); }
  });
  group.appendChild(yesBtn);
  group.appendChild(noBtn);
  wrapper.appendChild(group);
  return wrapper;
}

function updateToggle(wrapper, value) {
  const btns = wrapper.querySelectorAll('.toggle-btn');
  btns[0].className = 'toggle-btn' + (value === true ? ' active yes' : '');
  btns[1].className = 'toggle-btn' + (value === false ? ' active no' : '');
}

function createSelect(label, options, value, onChange) {
  var selectId = 'field-' + label.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const select = el('select', { className: 'field-select', id: selectId });
  for (const opt of options) {
    const option = el('option', { value: opt.value, textContent: opt.label });
    if (opt.value === value) option.selected = true;
    select.appendChild(option);
  }
  select.addEventListener('change', function() { onChange(select.value); });
  const row = el('div', { className: 'field-row' });
  row.appendChild(el('label', { className: 'field-label', htmlFor: selectId }, [label]));
  row.appendChild(select);
  return row;
}

function createTextInput(label, value, onChange, placeholder) {
  var inputId = 'field-' + label.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const input = el('input', {
    type: 'text', className: 'field-input', id: inputId, value: value || '', placeholder: placeholder || ''
  });
  input.addEventListener('input', function() { onChange(input.value); });
  const row = el('div', { className: 'field-row' });
  row.appendChild(el('label', { className: 'field-label', htmlFor: inputId }, [label]));
  row.appendChild(input);
  return row;
}

function createTextArea(label, value, onChange, placeholder) {
  var taId = 'field-' + label.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const ta = el('textarea', { className: 'field-textarea', id: taId, placeholder: placeholder || '' });
  ta.value = value || '';
  ta.addEventListener('input', function() { onChange(ta.value); });
  const row = el('div', { className: 'field-row' });
  row.appendChild(el('label', { className: 'field-label', htmlFor: taId }, [label]));
  row.appendChild(ta);
  return row;
}

function createAlert(type, text) {
  return el('div', { className: 'alert ' + type, textContent: text });
}

// --- Common CSS ---
var SHARED_CSS = [
  '* { box-sizing: border-box; margin: 0; padding: 0; }',
  'body { font-family: "Segoe UI", system-ui, -apple-system, sans-serif; background: #0B1426; color: #F0EBE0; line-height: 1.6; max-width: 900px; margin: 0 auto; padding: 24px; }',
  'h1 { font-size: 1.8em; margin-bottom: 8px; color: #E8B96A; font-weight: 300; letter-spacing: 1px; }',
  'h2 { font-size: 1.2em; margin: 24px 0 12px; color: #9AACBA; font-weight: 400; border-bottom: 1px solid #1E2D3D; padding-bottom: 6px; }',
  'h3 { font-size: 1em; margin: 16px 0 8px; color: #9AACBA; }',
  '.subtitle { color: #C8D6E4; font-size: 0.9em; margin-bottom: 24px; }',
  '.section { margin-bottom: 32px; }',
  '.toolbar { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }',
  '.btn { padding: 8px 20px; border: 1px solid #3A4A5A; border-radius: 4px; background: #1E2D3D; color: #F0EBE0; cursor: pointer; font-size: 0.85em; transition: all 0.15s; }',
  '.btn:hover { background: #2A3D4D; border-color: #D4943A; }',
  '.btn.primary { background: #D4943A; border-color: #D4943A; color: #0B1426; font-weight: 600; }',
  '.btn.primary:hover { background: #E8B96A; }',
  '.btn.success { background: #2A7B7B; border-color: #2A7B7B; }',
  '.btn.success:hover { background: #3A9E9E; }',
  '.toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; border: 1px solid #1E2D3D; border-radius: 4px; margin-bottom: 6px; background: #0D1830; }',
  '.toggle-label { flex: 1; font-size: 0.9em; padding-right: 16px; }',
  '.toggle-group { display: flex; gap: 4px; }',
  '.toggle-btn { padding: 4px 16px; border: 1px solid #3A4A5A; border-radius: 3px; background: transparent; color: #9AACBA; cursor: pointer; font-size: 0.8em; }',
  '.toggle-btn.active.yes { background: #c0392b; border-color: #c0392b; color: white; }',
  '.toggle-btn.active.no { background: #2A7B7B; border-color: #2A7B7B; color: white; }',
  '.field-row { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }',
  '.field-label { min-width: 200px; font-size: 0.85em; color: #9AACBA; }',
  '.field-input, .field-select, .field-textarea { flex: 1; padding: 6px 10px; background: #0D1830; border: 1px solid #3A4A5A; border-radius: 3px; color: #F0EBE0; font-size: 0.85em; font-family: inherit; }',
  '.field-textarea { min-height: 60px; resize: vertical; }',
  '.field-input:focus, .field-select:focus, .field-textarea:focus { border-color: #D4943A; outline: 2px solid #D4943A; outline-offset: 2px; }',
  '.badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 0.7em; margin: 2px; }',
  '.badge.enacted { background: #D4943A33; color: #E8B96A; border: 1px solid #D4943A55; }',
  '.badge.active-sector { background: #2A7B7B33; color: #4DBFBF; border: 1px solid #2A7B7B55; }',
  '.alert { padding: 12px 16px; border-radius: 4px; margin: 12px 0; font-size: 0.9em; }',
  '.alert.danger { background: #c0392b22; border: 1px solid #c0392b55; color: #e74c3c; }',
  '.alert.success { background: #2A7B7B22; border: 1px solid #2A7B7B55; color: #4DBFBF; }',
  '.alert.warning { background: #D4943A22; border: 1px solid #D4943A55; color: #E8B96A; }',
  '.alert.info { background: #1E2D3D; border: 1px solid #3A4A5A; color: #9AACBA; }',
  '.result-table { width: 100%; border-collapse: collapse; margin: 12px 0; }',
  '.result-table th, .result-table td { padding: 8px 12px; text-align: left; border: 1px solid #1E2D3D; font-size: 0.85em; }',
  '.result-table th { background: #1E2D3D; color: #9AACBA; }',
  '.result-table td { background: #0D1830; }',
  '.step { display: none; }',
  '.step.active { display: block; }',
  '.step-nav { display: flex; justify-content: space-between; margin-top: 24px; }',
  '.progress { display: flex; gap: 8px; margin-bottom: 24px; }',
  '.progress-dot { width: 10px; height: 10px; border-radius: 50%; background: #3A4A5A; }',
  '.progress-dot.active { background: #D4943A; }',
  '.progress-dot.done { background: #2A7B7B; }',
  '.checklist-item { display: flex; align-items: center; gap: 8px; padding: 6px 0; }',
  '.checklist-item input[type="checkbox"] { accent-color: #D4943A; }',
  '.score-high { color: #e74c3c; font-weight: 600; }',
  '.score-med { color: #E8B96A; font-weight: 600; }',
  '.score-low { color: #4DBFBF; font-weight: 600; }',
  '.hidden { display: none; }'
].join('\n');

function injectCSS() {
  var style = document.createElement('style');
  style.textContent = SHARED_CSS;
  document.head.appendChild(style);
}

// --- Session persistence ---
// Auto-saves form state to sessionStorage so browser reloads don't lose data.
function persistState(key, state) {
  try { sessionStorage.setItem('wizard_' + key, JSON.stringify(state)); } catch(e) {}
}
function restoreState(key) {
  try {
    var raw = sessionStorage.getItem('wizard_' + key);
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
}
function persistStep(key, step) {
  try { sessionStorage.setItem('wizard_step_' + key, String(step)); } catch(e) {}
}
function restoreStep(key) {
  try {
    var raw = sessionStorage.getItem('wizard_step_' + key);
    return raw !== null ? parseInt(raw, 10) : 0;
  } catch(e) { return 0; }
}

// --- Wizard framework ---
// Renders page chrome (title, toolbar, progress, nav) once.
// Only the step content area is rebuilt on state changes.
// This prevents full-page DOM wipes that destroy in-progress input data.
// Optional: pass stateKey + getState + setState for auto-persist across reloads.
function createWizard(opts) {
  // opts: { title, subtitle, totalSteps, stepLabels, renderStep, onSave, onExport, onLoad,
  //         stateKey, getState, setState }
  var _currentStep = opts.stateKey ? restoreStep(opts.stateKey) : 0;
  if (_currentStep >= opts.totalSteps) _currentStep = 0;
  var _built = false;
  var _stepContainer = null;
  var _progressContainer = null;
  var _navContainer = null;

  function buildChrome() {
    document.body.textContent = '';
    document.body.appendChild(el('h1', {}, [opts.title]));
    if (opts.subtitle) document.body.appendChild(el('p', { className: 'subtitle' }, [opts.subtitle]));

    var toolbar = el('div', { className: 'toolbar' });
    toolbar.appendChild(el('button', { className: 'btn', textContent: 'Load Config', onClick: function() {
      if (opts.onLoad) opts.onLoad();
    }}));
    toolbar.appendChild(el('button', { className: 'btn', textContent: 'Save Config', onClick: function() {
      if (opts.onSave) opts.onSave();
    }}));
    toolbar.appendChild(el('button', { className: 'btn primary', textContent: 'Export Markdown', onClick: function() {
      if (opts.onExport) opts.onExport();
    }}));
    document.body.appendChild(toolbar);

    _progressContainer = el('div', { className: 'progress' });
    document.body.appendChild(_progressContainer);

    _stepContainer = el('div', { id: 'step-container' });
    if (opts.stateKey && opts.getState) {
      var _saveTimer = null;
      _stepContainer.addEventListener('input', function() {
        clearTimeout(_saveTimer);
        _saveTimer = setTimeout(function() {
          persistState(opts.stateKey, opts.getState());
        }, 300);
      });
    }
    document.body.appendChild(_stepContainer);

    _navContainer = el('div', { className: 'step-nav' });
    document.body.appendChild(_navContainer);

    _built = true;
  }

  function updateProgress() {
    _progressContainer.textContent = '';
    for (var i = 0; i < opts.totalSteps; i++) {
      var cls = 'progress-dot';
      if (i === _currentStep) cls += ' active';
      else if (i < _currentStep) cls += ' done';
      _progressContainer.appendChild(el('span', { className: cls, title: opts.stepLabels[i] }));
    }
  }

  function updateNav() {
    _navContainer.textContent = '';
    if (_currentStep > 0) {
      _navContainer.appendChild(el('button', { className: 'btn', textContent: 'Previous', onClick: function() { _currentStep--; refreshStep(); } }));
    } else {
      _navContainer.appendChild(el('span'));
    }
    if (_currentStep < opts.totalSteps - 1) {
      _navContainer.appendChild(el('button', { className: 'btn primary', textContent: 'Next', onClick: function() { _currentStep++; refreshStep(); } }));
    }
  }

  function refreshStep() {
    if (!_built) buildChrome();
    var scrollY = window.scrollY;
    _stepContainer.textContent = '';
    updateProgress();
    opts.renderStep(_currentStep, _stepContainer);
    updateNav();
    if (opts.stateKey) {
      persistStep(opts.stateKey, _currentStep);
      if (opts.getState) persistState(opts.stateKey, opts.getState());
    }
    requestAnimationFrame(function() { window.scrollTo(0, scrollY); });
  }

  return {
    render: function() {
      if (opts.stateKey && opts.setState) {
        var saved = restoreState(opts.stateKey);
        if (saved) opts.setState(saved);
      }
      buildChrome();
      refreshStep();
    },
    refreshStep: refreshStep,
    saveNow: function() {
      if (opts.stateKey && opts.getState) persistState(opts.stateKey, opts.getState());
    },
    getCurrentStep: function() { return _currentStep; },
    setStep: function(s) { _currentStep = s; refreshStep(); }
  };
}
