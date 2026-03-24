#!/usr/bin/env node
/**
 * AI Compliance Evidence Checker - Comprehensive Edition
 * Validates evidence completeness across ALL 22 templates.
 * Template-specific deep checks + cross-reference validation + interactive tool integration.
 * Zero dependencies (Node.js built-in only).
 * Usage: node evidence-checker.js [--config path] [--output path] [--template NN] [--verbose] [--json]
 */
var fs = require('fs');
var path = require('path');
var TOOLS_DIR = __dirname;
var DATA_DIR = path.join(TOOLS_DIR, 'data');

function loadJSON(fp) { return JSON.parse(fs.readFileSync(fp, 'utf8')); }
function today() { return new Date().toISOString().split('T')[0]; }
function safeReadFile(fp) { try { return fs.readFileSync(fp, 'utf8'); } catch (e) { return null; } }
function progressBar(pct, w) {
  w = w || 10; var filled = Math.round((pct / 100) * w); var bar = '';
  for (var i = 0; i < filled; i++) bar += '\u2588';
  for (var j = 0; j < w - filled; j++) bar += '\u2591';
  return bar;
}

function parseArgs() {
  var args = process.argv.slice(2);
  var r = { configPath: path.join(TOOLS_DIR, 'compliance-config.json'),
    outputDir: path.join(TOOLS_DIR, '..', 'output'), templateFilter: null, verbose: false, json: false };
  for (var i = 0; i < args.length; i++) {
    if (args[i] === '--config' && args[i+1]) { r.configPath = path.resolve(args[++i]); }
    else if (args[i] === '--output' && args[i+1]) { r.outputDir = path.resolve(args[++i]); }
    else if (args[i] === '--template' && args[i+1]) { r.templateFilter = args[++i]; }
    else if (args[i] === '--verbose') { r.verbose = true; }
    else if (args[i] === '--json') { r.json = true; }
  }
  return r;
}

// --- Markdown parsing helpers ---
function getSectionContent(md, hdr) {
  var esc = hdr.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
  var re = new RegExp('#{2,3}\\s*' + esc + '[\\s\\S]*?(?=\\r?\\n## [^#]|\\r?\\n---\\s*$|$)');
  var m = md.match(re); return m ? m[0] : '';
}
function getTableRows(text) {
  var rows = [], re = /^\|(.+)\|$/gm, m;
  while ((m = re.exec(text)) !== null) {
    var row = m[1]; if (/^[\s\-:|]+$/.test(row)) continue;
    rows.push(row.split('|').map(function(c) { return c.trim(); }));
  }
  return rows;
}
function getTableFieldValue(md, fn) {
  var esc = fn.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
  var re = new RegExp('\\|\\s*' + esc + '\\s*\\|([^|]*)\\|', 'i');
  var m = md.match(re);
  if (m) { var v = m[1].trim(); if (!v || (v.startsWith('[') && !v.startsWith('[x]') && !v.startsWith('[X]')) || v === 'Value' || v === '') return null; return v; }
  return null;
}
function countCheckboxes(text) {
  var u = (text.match(/\[ \]/g) || []).length, c = (text.match(/\[x\]/gi) || []).length;
  return { checked: c, unchecked: u, total: c + u };
}
function isFieldEmpty(v) { return !v || v === '' || (v.startsWith('[') && !v.startsWith('[x]') && !v.startsWith('[X]')) || v === 'Value'; }
function countEmptyTableRows(text, mc) {
  mc = mc || 2; var rows = getTableRows(text), empty = 0;
  for (var i = 1; i < rows.length; i++) {
    if (rows[i].length < mc) continue; var ae = true;
    for (var c = 1; c < rows[i].length; c++) { if (!isFieldEmpty(rows[i][c])) { ae = false; break; } }
    if (ae) empty++;
  }
  return empty;
}
function analyzeTemplateCompleteness(md) {
  var r = { totalFields: 0, filledFields: 0, emptyTableCells: 0, unfilledCheckboxes: 0, placeholders: 0 };
  var re = /^\|(.+)\|$/gm, m;
  while ((m = re.exec(md)) !== null) {
    var row = m[1]; if (/^[\s\-:|]+$/.test(row)) continue;
    var cells = row.split('|');
    for (var ci = 0; ci < cells.length; ci++) {
      var t = cells[ci].trim(); r.totalFields++;
      if (t === '' || t === '|') r.emptyTableCells++;
      else if (/^\[.*\]$/.test(t) && /\b(YYYY|Name|Describe|specify|method|details)\b/i.test(t)) r.placeholders++;
      else r.filledFields++;
    }
  }
  var cb = countCheckboxes(md);
  r.unfilledCheckboxes = cb.unchecked; r.totalFields += cb.total; r.filledFields += cb.checked;
  r.completeness = Math.round((r.filledFields / (r.totalFields || 1)) * 100);
  return r;
}
function checkMetadata(md) {
  var issues = [], fields = ['AI System Name', 'Organization', 'Document owner', 'Session/GitHub ref', 'Date created'];
  for (var i = 0; i < fields.length; i++) {
    if (!getTableFieldValue(md, fields[i])) issues.push('Metadata: "' + fields[i] + '" not filled');
  }
  return issues;
}

// ==========================================
// Template-specific checkers (01-22)
// ==========================================

function chk01(md) {
  var f = [], p = [];
  if (!getTableFieldValue(md, 'What the system does') && !getTableFieldValue(md, 'System purpose'))
    f.push({ severity: 'CRITICAL', section: 'Sec 1', message: 'System purpose not filled' });
  if (!getTableFieldValue(md, 'Target jurisdictions') && !getTableFieldValue(md, 'Deployment jurisdictions'))
    f.push({ severity: 'HIGH', section: 'Sec 1', message: 'Jurisdictions not specified' });
  var s2 = getSectionContent(md, '2. Explainability');
  if (s2) { var e = countEmptyTableRows(s2); if (e > 2) f.push({ severity: 'HIGH', section: 'Sec 2', message: e + ' explainability rows empty' }); }
  var ec = getSectionContent(md, 'Evidence Checklist');
  if (ec) { var cb = countCheckboxes(ec); if (cb.unchecked > 3) f.push({ severity: 'MEDIUM', section: 'Checklist', message: cb.unchecked + '/' + cb.total + ' unchecked' }); }
  return { findings: f, passes: p };
}

function chk02(md) {
  var f = [], p = [];
  var s1 = getSectionContent(md, '1. Disclosure');
  if (s1) { var e = countEmptyTableRows(s1); if (e > 2) f.push({ severity: 'CRITICAL', section: 'Sec 1', message: e + ' disclosure rows empty' }); }
  var ec = getSectionContent(md, 'Evidence Checklist');
  if (ec) { var cb = countCheckboxes(ec); if (cb.unchecked > 3) f.push({ severity: 'MEDIUM', section: 'Checklist', message: cb.unchecked + '/' + cb.total + ' unchecked' }); }
  return { findings: f, passes: p };
}

function chk03(md) {
  var f = [], p = [];
  var s1 = getSectionContent(md, '1. Content');
  if (s1) { var e = countEmptyTableRows(s1); if (e > 2) f.push({ severity: 'HIGH', section: 'Sec 1', message: e + ' content rows empty' }); }
  var s2 = getSectionContent(md, '2. Labeling');
  if (s2) { var cb = countCheckboxes(s2); if (cb.unchecked > cb.checked) f.push({ severity: 'HIGH', section: 'Sec 2', message: cb.unchecked + ' labeling items not done' }); }
  var ec = getSectionContent(md, 'Evidence Checklist');
  if (ec) { var cb = countCheckboxes(ec); if (cb.unchecked > 3) f.push({ severity: 'MEDIUM', section: 'Checklist', message: cb.unchecked + '/' + cb.total + ' unchecked' }); }
  return { findings: f, passes: p };
}

function chk04(md) {
  var f = [], p = [];
  var s1 = getSectionContent(md, '1. Decision');
  if (s1) { var e = countEmptyTableRows(s1); if (e > 1) f.push({ severity: 'CRITICAL', section: 'Sec 1', message: 'Decision inventory incomplete' }); }
  var hr = getSectionContent(md, 'Human Review');
  if (hr) { var cb = countCheckboxes(hr); if (cb.unchecked > cb.checked) f.push({ severity: 'HIGH', section: 'Human Review', message: cb.unchecked + ' items not implemented' }); }
  var ec = getSectionContent(md, 'Evidence Checklist');
  if (ec) { var cb = countCheckboxes(ec); if (cb.unchecked > 3) f.push({ severity: 'MEDIUM', section: 'Checklist', message: cb.unchecked + '/' + cb.total + ' unchecked' }); }
  return { findings: f, passes: p };
}

function chk05(md) {
  var f = [], p = [];
  var s1 = getSectionContent(md, '1. Data');
  if (s1) { var e = countEmptyTableRows(s1); if (e > 2) f.push({ severity: 'CRITICAL', section: 'Sec 1', message: 'Data source inventory incomplete' }); }
  var cp = getSectionContent(md, 'Copyright'); if (!cp) cp = getSectionContent(md, 'Licensing');
  if (cp) { var cb = countCheckboxes(cp); if (cb.total > 0 && cb.checked === 0) f.push({ severity: 'HIGH', section: 'Copyright', message: 'No copyright checks done' }); }
  var ec = getSectionContent(md, 'Evidence Checklist');
  if (ec) { var cb = countCheckboxes(ec); if (cb.unchecked > 3) f.push({ severity: 'MEDIUM', section: 'Checklist', message: cb.unchecked + '/' + cb.total + ' unchecked' }); }
  return { findings: f, passes: p };
}

function chk06(md) {
  var f = [], p = [];
  var sr = getSectionContent(md, 'Risk');
  if (sr) { var rows = getTableRows(sr); var ms = 0; for (var i = 1; i < rows.length; i++) { if (rows[i].length >= 3 && (isFieldEmpty(rows[i][1]) || isFieldEmpty(rows[i][2]))) ms++; } if (ms > 2) f.push({ severity: 'CRITICAL', section: 'Risk', message: ms + ' risk items missing scores' }); }
  if (!getTableFieldValue(md, 'Overall risk level') && !getTableFieldValue(md, 'Risk classification'))
    f.push({ severity: 'CRITICAL', section: 'Sign-off', message: 'Overall risk level not assigned' });
  var ec = getSectionContent(md, 'Evidence Checklist');
  if (ec) { var cb = countCheckboxes(ec); if (cb.unchecked > 3) f.push({ severity: 'MEDIUM', section: 'Checklist', message: cb.unchecked + '/' + cb.total + ' unchecked' }); }
  return { findings: f, passes: p };
}

function chk07(md) {
  var f = [], p = [];
  var s1 = getSectionContent(md, '1. Processing Activity Description');
  var s1r = getTableRows(s1); var iss = 0;
  for (var i = 0; i < s1r.length; i++) {
    var row = s1r[i]; if (row.length < 2) continue;
    var fld = row[0].toLowerCase(), empty = isFieldEmpty(row[1]);
    if (fld.indexOf('personal data') >= 0 && fld.indexOf('what') >= 0 && empty) { f.push({ severity: 'CRITICAL', section: 'Sec 1', message: 'Personal data types not specified' }); iss++; }
    if (fld.indexOf('legal basis') >= 0 && empty) { f.push({ severity: 'CRITICAL', section: 'Sec 1', message: 'Legal basis empty' }); iss++; }
    if (fld.indexOf('data subjects affected') >= 0 && empty) { f.push({ severity: 'CRITICAL', section: 'Sec 1', message: 'Data subjects not specified' }); iss++; }
  }
  if (iss === 0 && s1r.length > 1) p.push({ section: 'Sec 1', message: 'Processing activity documented' });
  var s2 = getSectionContent(md, '2. Necessity and Proportionality');
  var s2r = getTableRows(s2); var una = 0;
  for (var i = 1; i < s2r.length; i++) { if (s2r[i].length >= 2 && isFieldEmpty(s2r[i][1])) una++; }
  if (una > 0) f.push({ severity: 'HIGH', section: 'Sec 2', message: una + ' necessity question(s) unanswered' });
  else if (s2r.length > 1) p.push({ section: 'Sec 2', message: 'Necessity fully answered' });
  var s31 = getSectionContent(md, '3.1 Risks to Data Subjects');
  var s31r = getTableRows(s31); var m31 = 0, h31 = 0;
  for (var i = 1; i < s31r.length; i++) { var row = s31r[i]; if (row.length < 5) continue; if (isFieldEmpty(row[1]) || isFieldEmpty(row[2])) m31++; if (/\b(high|critical|h)\b/i.test(row[1] + row[2]) && isFieldEmpty(row[4])) h31++; }
  if (m31 > 0) f.push({ severity: 'CRITICAL', section: 'Sec 3.1', message: m31 + ' risk(s) missing scores' });
  if (h31 > 0) f.push({ severity: 'HIGH', section: 'Sec 3.1', message: h31 + ' high risk(s) without mitigation' });
  var s32 = getSectionContent(md, '3.2 AI-Specific Privacy Risks');
  var s32r = getTableRows(s32); var m32 = 0;
  for (var i = 1; i < s32r.length; i++) { if (s32r[i].length >= 5 && (isFieldEmpty(s32r[i][1]) || isFieldEmpty(s32r[i][2]))) m32++; }
  if (m32 > 0) f.push({ severity: 'CRITICAL', section: 'Sec 3.2', message: m32 + ' AI risk(s) missing scores' });
  var s4 = getSectionContent(md, '4. Data Subject Rights');
  var s4r = getTableRows(s4); var ni = 0;
  for (var i = 1; i < s4r.length; i++) { if (s4r[i].length >= 2 && /\[ \]/.test(s4r[i][1])) ni++; }
  if (ni > 0) f.push({ severity: 'HIGH', section: 'Sec 4', message: ni + ' right(s) not implemented' });
  var s5 = getSectionContent(md, '5. Data Protection Measures');
  var s5r = getTableRows(s5); var cm = ['encryption at rest', 'encryption in transit', 'breach notification'], cmiss = [];
  for (var i = 1; i < s5r.length; i++) { if (s5r[i].length >= 2 && /\[ \]/.test(s5r[i][1])) { var meas = s5r[i][0].toLowerCase(); for (var ci = 0; ci < cm.length; ci++) { if (meas.indexOf(cm[ci]) >= 0) { cmiss.push(s5r[i][0]); break; } } } }
  if (cmiss.length > 0) f.push({ severity: 'HIGH', section: 'Sec 5', message: 'Critical measures missing: ' + cmiss.join(', ') });
  var s7 = getSectionContent(md, '7. Consultation');
  var s7r = getTableRows(s7); var dpo = false;
  for (var i = 1; i < s7r.length; i++) { if (s7r[i].length >= 2 && s7r[i][0].toLowerCase().indexOf('data protection officer') >= 0 && !isFieldEmpty(s7r[i][1])) dpo = true; }
  if (!dpo) f.push({ severity: 'CRITICAL', section: 'Sec 7', message: 'DPO consultation not documented' });
  if (!getTableFieldValue(md, 'Overall risk level after mitigation') || !getTableFieldValue(md, 'Approved by'))
    f.push({ severity: 'CRITICAL', section: 'Sec 8', message: 'Outcome/sign-off incomplete' });
  else p.push({ section: 'Sec 8', message: 'Outcome and sign-off complete' });
  return { findings: f, passes: p };
}

function chk08(md) {
  var f = [], p = [];
  var pc = getSectionContent(md, 'Protected');
  if (pc) { var cb = countCheckboxes(pc); if (cb.total > 0 && cb.checked === 0) f.push({ severity: 'CRITICAL', section: 'Protected', message: 'No protected characteristics identified' }); }
  var ts = getSectionContent(md, 'Testing');
  if (ts) { var e = countEmptyTableRows(ts); if (e > 2) f.push({ severity: 'HIGH', section: 'Testing', message: 'Testing methodology incomplete' }); }
  var ec = getSectionContent(md, 'Evidence Checklist');
  if (ec) { var cb = countCheckboxes(ec); if (cb.unchecked > 3) f.push({ severity: 'MEDIUM', section: 'Checklist', message: cb.unchecked + '/' + cb.total + ' unchecked' }); }
  return { findings: f, passes: p };
}

function chk09(md) {
  var f = [], p = [];
  if (!getTableFieldValue(md, 'Oversight model'))
    f.push({ severity: 'CRITICAL', section: 'Sec 1', message: 'Oversight model not specified' });
  else p.push({ section: 'Sec 1', message: 'Oversight model specified' });
  var ov = getSectionContent(md, 'Override');
  if (ov) { var cb = countCheckboxes(ov); if (cb.total > 0 && cb.checked === 0) f.push({ severity: 'HIGH', section: 'Override', message: 'Override not implemented' }); }
  var ec = getSectionContent(md, 'Evidence Checklist');
  if (ec) { var cb = countCheckboxes(ec); if (cb.unchecked > 3) f.push({ severity: 'MEDIUM', section: 'Checklist', message: cb.unchecked + '/' + cb.total + ' unchecked' }); }
  return { findings: f, passes: p };
}

function chk10(md) {
  var f = [], p = [];
  var s1 = getSectionContent(md, '1. Consent Requirements Mapping');
  var s1r = getTableRows(s1); var eb = 0;
  for (var i = 1; i < s1r.length; i++) { if (s1r[i].length >= 2 && isFieldEmpty(s1r[i][1])) eb++; }
  if (eb > 0) f.push({ severity: 'CRITICAL', section: 'Sec 1', message: eb + ' activities with empty legal basis' });
  else if (s1r.length > 1) p.push({ section: 'Sec 1', message: 'All activities mapped' });
  var s5 = getSectionContent(md, '5. Withdrawal Mechanism');
  var s5r = getTableRows(s5); var wm = false;
  for (var i = 1; i < s5r.length; i++) { if (s5r[i].length >= 2 && s5r[i][0].toLowerCase().indexOf('withdrawal method') >= 0 && !isFieldEmpty(s5r[i][1])) wm = true; }
  if (!wm) f.push({ severity: 'CRITICAL', section: 'Sec 5', message: 'Withdrawal method empty' });
  var s7 = getSectionContent(md, '7. Audit and Evidence');
  var sp = s7.split('### Consent Withdrawal Log')[0] || s7;
  var sr = getTableRows(sp); var hr = false;
  for (var i = 1; i < sr.length; i++) { for (var c = 0; c < sr[i].length; c++) { if (!isFieldEmpty(sr[i][c]) && sr[i][c] !== 'consent_id') { hr = true; break; } } if (hr) break; }
  if (!hr) f.push({ severity: 'CRITICAL', section: 'Sec 7', message: 'No sample consent records' });
  var s8 = getSectionContent(md, '8. Evidence Checklist');
  var cb = countCheckboxes(s8);
  if (cb.unchecked > 3) f.push({ severity: 'CRITICAL', section: 'Sec 8', message: cb.unchecked + '/' + cb.total + ' checklist unchecked' });
  else if (cb.total > 0) p.push({ section: 'Sec 8', message: cb.checked + '/' + cb.total + ' complete' });
  return { findings: f, passes: p };
}

function chk11(md) { var f = [], p = []; var sr = getSectionContent(md, 'Rights'); if (sr) { var cb = countCheckboxes(sr); if (cb.total > 0 && cb.checked < 5) f.push({ severity: 'HIGH', section: 'Rights', message: 'Only ' + cb.checked + '/' + cb.total + ' rights implemented' }); } var ec = getSectionContent(md, 'Evidence Checklist'); if (ec) { var cb = countCheckboxes(ec); if (cb.unchecked > 3) f.push({ severity: 'MEDIUM', section: 'Checklist', message: cb.unchecked + '/' + cb.total + ' unchecked' }); } return { findings: f, passes: p }; }
function chk12(md) { var f = [], p = []; var s1 = getSectionContent(md, '1. Governance'); if (s1) { var e = countEmptyTableRows(s1); if (e > 2) f.push({ severity: 'CRITICAL', section: 'Sec 1', message: 'Governance structure not documented' }); } var sr = getSectionContent(md, 'Roles'); if (sr) { var e = countEmptyTableRows(sr); if (e > 2) f.push({ severity: 'HIGH', section: 'Roles', message: e + ' roles not assigned' }); } var ec = getSectionContent(md, 'Evidence Checklist'); if (ec) { var cb = countCheckboxes(ec); if (cb.unchecked > 3) f.push({ severity: 'MEDIUM', section: 'Checklist', message: cb.unchecked + '/' + cb.total + ' unchecked' }); } return { findings: f, passes: p }; }
function chk13(md) { var f = [], p = []; var s1 = getSectionContent(md, '1. Incident'); if (s1) { var e = countEmptyTableRows(s1); if (e > 2) f.push({ severity: 'CRITICAL', section: 'Sec 1', message: 'Incident response incomplete' }); } var sn = getSectionContent(md, 'Notification'); if (sn) { var e = countEmptyTableRows(sn); if (e > 1) f.push({ severity: 'HIGH', section: 'Notification', message: 'Breach timelines not specified' }); } var ec = getSectionContent(md, 'Evidence Checklist'); if (ec) { var cb = countCheckboxes(ec); if (cb.unchecked > 3) f.push({ severity: 'MEDIUM', section: 'Checklist', message: cb.unchecked + '/' + cb.total + ' unchecked' }); } return { findings: f, passes: p }; }
function chk14(md) { var f = [], p = []; var s1 = getSectionContent(md, '1. Registration'); if (s1) { var e = countEmptyTableRows(s1); if (e > 1) f.push({ severity: 'HIGH', section: 'Sec 1', message: 'Registration requirements not mapped' }); } var sf = getSectionContent(md, 'Filing'); if (sf) { var cb = countCheckboxes(sf); if (cb.total > 0 && cb.checked === 0) f.push({ severity: 'CRITICAL', section: 'Filing', message: 'No filings completed' }); } return { findings: f, passes: p }; }
function chk15(md) { var f = [], p = []; var sc = getSectionContent(md, 'Controls'); if (!sc) sc = getSectionContent(md, '1. Security'); if (sc) { var cb = countCheckboxes(sc); if (cb.total > 0 && cb.checked < cb.total / 2) f.push({ severity: 'CRITICAL', section: 'Controls', message: 'Less than half implemented (' + cb.checked + '/' + cb.total + ')' }); else if (cb.total > 0) p.push({ section: 'Controls', message: cb.checked + '/' + cb.total + ' implemented' }); } var ec = getSectionContent(md, 'Evidence Checklist'); if (ec) { var cb = countCheckboxes(ec); if (cb.unchecked > 3) f.push({ severity: 'MEDIUM', section: 'Checklist', message: cb.unchecked + '/' + cb.total + ' unchecked' }); } return { findings: f, passes: p }; }
function chk16(md) { var f = [], p = []; var s1 = getSectionContent(md, '1. Content'); if (s1) { var e = countEmptyTableRows(s1); if (e > 2) f.push({ severity: 'HIGH', section: 'Sec 1', message: 'Content policy not documented' }); } var sm = getSectionContent(md, 'Moderation'); if (sm) { var cb = countCheckboxes(sm); if (cb.total > 0 && cb.checked === 0) f.push({ severity: 'HIGH', section: 'Mechanism', message: 'No moderation implemented' }); } return { findings: f, passes: p }; }
function chk17(md) { var f = [], p = []; if (!getTableFieldValue(md, 'Classification') && !getTableFieldValue(md, 'Risk classification assigned') && !getTableFieldValue(md, 'Assigned risk level')) f.push({ severity: 'CRITICAL', section: 'Classification', message: 'Risk classification not assigned' }); else p.push({ section: 'Classification', message: 'Risk classification assigned' }); var se = getSectionContent(md, 'EU AI Act'); if (se) { var cb = countCheckboxes(se); if (cb.total > 0 && cb.checked === 0) f.push({ severity: 'HIGH', section: 'EU AI Act', message: 'EU AI Act classification not completed' }); } return { findings: f, passes: p }; }
function chk18(md) { var f = [], p = []; var s1 = getSectionContent(md, '1. Training'); if (!s1) s1 = getSectionContent(md, '1. AI Literacy'); if (s1) { var e = countEmptyTableRows(s1); if (e > 2) f.push({ severity: 'HIGH', section: 'Sec 1', message: 'Training program not documented' }); } var sc = getSectionContent(md, 'Competency'); if (sc) { var cb = countCheckboxes(sc); if (cb.total > 0 && cb.checked === 0) f.push({ severity: 'HIGH', section: 'Competency', message: 'No competency assessments' }); } return { findings: f, passes: p }; }
function chk19(md) { var f = [], p = []; var s1 = getSectionContent(md, '1. Standards'); if (!s1) s1 = getSectionContent(md, '1. Conformity'); if (s1) { var e = countEmptyTableRows(s1); if (e > 2) f.push({ severity: 'HIGH', section: 'Sec 1', message: 'Standards mapping incomplete' }); } var sa = getSectionContent(md, 'Assessment'); if (sa) { var cb = countCheckboxes(sa); if (cb.total > 0 && cb.checked === 0) f.push({ severity: 'HIGH', section: 'Assessment', message: 'No conformity assessment done' }); } return { findings: f, passes: p }; }
function chk20(md) { var f = [], p = []; var s1 = getSectionContent(md, '1. Sector'); if (s1) { var e = countEmptyTableRows(s1); if (e > 2) f.push({ severity: 'HIGH', section: 'Sec 1', message: 'Sector requirements not mapped' }); } return { findings: f, passes: p }; }
function chk22(md) { var f = [], p = []; var sd = getSectionContent(md, 'Deadline'); if (!sd) sd = getSectionContent(md, 'Timeline'); if (sd) { var rows = getTableRows(sd); var es = 0; for (var i = 1; i < rows.length; i++) { if (rows[i].length >= 4 && isFieldEmpty(rows[i][rows[i].length - 1])) es++; } if (es > 3) f.push({ severity: 'HIGH', section: 'Deadlines', message: es + ' deadline(s) with no status' }); } return { findings: f, passes: p }; }

var TEMPLATE_CHECKERS = {
  '01': chk01, '02': chk02, '03': chk03, '04': chk04, '05': chk05,
  '06': chk06, '07': chk07, '08': chk08, '09': chk09, '10': chk10,
  '11': chk11, '12': chk12, '13': chk13, '14': chk14, '15': chk15,
  '16': chk16, '17': chk17, '18': chk18, '19': chk19, '20': chk20,
  '22': chk22
};

// --- Cross-reference checks ---
function crossReferenceChecks(config, outputDir, outputFiles) {
  var checks = [];
  var itr = config.interactiveToolResults || {};
  var tc = [
    { key: 'riskClassification', label: 'Risk Classification', t: '17' },
    { key: 'impactRiskScoring', label: 'Impact Scoring', t: '06' },
    { key: 'humanOversight', label: 'Human Oversight', t: '09' },
    { key: 'biasTesting', label: 'Bias Testing', t: '08' },
    { key: 'consentDesign', label: 'Consent Design', t: '10' },
    { key: 'consentRecordsAudit', label: 'Consent Audit', t: '10' },
    { key: 'securityAssessment', label: 'Security', t: '15' },
    { key: 'piaAssessment', label: 'PIA', t: '07' },
    { key: 'dsrRightsImplementation', label: 'DSR Rights', t: '11' },
    { key: 'transparencyDocumentation', label: 'Transparency', t: '01' },
    { key: 'disclosureToolkit', label: 'Disclosure', t: '02' },
    { key: 'contentLabeling', label: 'Content Labeling', t: '03' },
    { key: 'automatedDecisionLogic', label: 'Automated Decision', t: '04' },
    { key: 'trainingDataDisclosure', label: 'Training Data', t: '05' },
    { key: 'governanceFramework', label: 'Governance', t: '12' },
    { key: 'incidentManagement', label: 'Incident Mgmt', t: '13' },
    { key: 'conformityAssessment', label: 'Conformity', t: '19' },
    { key: 'contentModeration', label: 'Content Moderation', t: '16' },
    { key: 'aiLiteracyTraining', label: 'AI Literacy', t: '18' }
  ];
  for (var i = 0; i < tc.length; i++) {
    if (itr[tc[i].key]) checks.push({ pass: true, message: 'Tool done: ' + tc[i].label + ' (T' + tc[i].t + ')' });
    else checks.push({ pass: false, message: 'Tool NOT done: ' + tc[i].label + ' (T' + tc[i].t + ')' });
  }
  var piaMd = null, consMd = null;
  for (var fi = 0; fi < outputFiles.length; fi++) {
    if (outputFiles[fi].indexOf('07-') === 0) piaMd = safeReadFile(path.join(outputDir, outputFiles[fi]));
    if (outputFiles[fi].indexOf('10-') === 0) consMd = safeReadFile(path.join(outputDir, outputFiles[fi]));
  }
  if (piaMd && consMd) {
    var m = piaMd.match(/\|\s*Legal basis for processing\s*\|([^|]*)\|/i);
    if (m && /consent/i.test(m[1])) {
      var s7 = getSectionContent(consMd, '7. Audit and Evidence');
      var sp = s7.split('### Consent Withdrawal Log')[0] || s7;
      var sr = getTableRows(sp); var hr = false;
      for (var i = 1; i < sr.length; i++) { for (var c = 0; c < sr[i].length; c++) { if (!isFieldEmpty(sr[i][c]) && sr[i][c] !== 'consent_id') { hr = true; break; } } if (hr) break; }
      if (!hr) checks.push({ pass: false, message: 'PIA basis is consent but T10 has no records' });
      else checks.push({ pass: true, message: 'PIA consent basis matches T10 records' });
    }
  }
  if (itr.riskClassification && !itr.impactRiskScoring) checks.push({ pass: false, message: 'Risk classified but impact scoring not done' });
  return checks;
}

// --- Report generation ---
function generateReport(config, matrix, tplResults, crossRef, opts) {
  var orgName = (config.organization && config.organization.name) || '(not set)';
  var sysName = (config.system && config.system.name) || '(not set)';
  var lines = []; function ln(s) { lines.push(s !== undefined ? s : ''); }
  ln('\u2550'.repeat(60));
  ln('  AI Compliance Evidence Checker \u2014 Comprehensive Report');
  ln('  ' + today() + ' | ' + orgName + ' | ' + sysName);
  ln('\u2550'.repeat(60)); ln();
  ln('TEMPLATE COMPLETENESS'); ln('\u2500'.repeat(60));
  var sorted = Object.keys(tplResults).sort();
  var totalC = 0, totalH = 0, totalM = 0;
  for (var si = 0; si < sorted.length; si++) {
    var tn = sorted[si], r = tplResults[tn]; var name = r.name || ('Template ' + tn), pct = r.completeness;
    var bar = progressBar(pct, 12); var label = '  ' + tn + ' ' + name; while (label.length < 48) label += ' ';
    var status = '';
    if (r.deepCheck) {
      var sev = { CRITICAL: 0, HIGH: 0, MEDIUM: 0 };
      for (var fi = 0; fi < r.deepCheck.findings.length; fi++) sev[r.deepCheck.findings[fi].severity]++;
      totalC += sev.CRITICAL; totalH += sev.HIGH; totalM += sev.MEDIUM;
      if (r.deepCheck.findings.length === 0) status = ' \u2713';
      else { var parts = []; if (sev.CRITICAL > 0) parts.push(sev.CRITICAL + 'C'); if (sev.HIGH > 0) parts.push(sev.HIGH + 'H'); if (sev.MEDIUM > 0) parts.push(sev.MEDIUM + 'M'); status = ' ' + parts.join('/'); }
    }
    ln(label + bar + ' ' + (pct < 10 ? '  ' : pct < 100 ? ' ' : '') + pct + '%' + status);
  } ln();
  for (var si = 0; si < sorted.length; si++) {
    var tn = sorted[si], r = tplResults[tn];
    if (!r.deepCheck || (r.deepCheck.findings.length === 0 && !opts.verbose)) continue;
    ln('TEMPLATE ' + tn + ': ' + (r.name || '').toUpperCase()); ln('\u2500'.repeat(40));
    var items = [];
    for (var i = 0; i < r.deepCheck.findings.length; i++) { var fi = r.deepCheck.findings[i]; items.push({ severity: fi.severity, section: fi.section, message: fi.message, pass: false }); }
    if (opts.verbose) { for (var i = 0; i < r.deepCheck.passes.length; i++) { var pi = r.deepCheck.passes[i]; items.push({ section: pi.section, message: pi.message, pass: true }); } }
    var so = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
    items.sort(function(a, b) { if (a.pass !== b.pass) return a.pass ? 1 : -1; if (!a.pass && !b.pass) return (so[a.severity] || 3) - (so[b.severity] || 3); return 0; });
    for (var i = 0; i < items.length; i++) { var it = items[i]; if (it.pass) ln('  PASS     \u2713 ' + it.section + ': ' + it.message); else { var sv = it.severity; while (sv.length < 8) sv += ' '; ln('  ' + sv + ' ' + (it.severity === 'MEDIUM' ? '\u25B3' : '\u2717') + ' ' + it.section + ': ' + it.message); } }
    ln();
  }
  if (crossRef && crossRef.length > 0) {
    ln('CROSS-REFERENCE CHECKS'); ln('\u2500'.repeat(60));
    var pc = 0;
    for (var i = 0; i < crossRef.length; i++) { if (crossRef[i].pass) pc++; if (!crossRef[i].pass || opts.verbose) ln('  ' + (crossRef[i].pass ? '\u2713' : '\u2717') + ' ' + crossRef[i].message); }
    if (!opts.verbose && pc > 0) ln('  ... and ' + pc + ' passing check(s)'); ln();
  }
  ln('OVERALL SUMMARY'); ln('\u2500'.repeat(60));
  ln('  Findings: ' + (totalC + totalH + totalM) + ' (' + totalC + ' critical, ' + totalH + ' high, ' + totalM + ' medium)');
  ln('  Templates: ' + sorted.length);
  var nextSteps = [];
  for (var si = 0; si < sorted.length; si++) { var r = tplResults[sorted[si]]; if (r.deepCheck) { for (var fi = 0; fi < r.deepCheck.findings.length; fi++) { if (r.deepCheck.findings[fi].severity === 'CRITICAL') nextSteps.push('T' + sorted[si] + ': ' + r.deepCheck.findings[fi].message); } } }
  if (nextSteps.length > 0) { ln(); ln('  CRITICAL items:'); for (var i = 0; i < Math.min(nextSteps.length, 10); i++) ln('    ' + (i+1) + '. ' + nextSteps[i]); if (nextSteps.length > 10) ln('    ... and ' + (nextSteps.length - 10) + ' more'); }
  var itr = config.interactiveToolResults || {};
  var tm = { riskClassification: 'risk-classification.html', impactRiskScoring: 'impact-risk-scoring.html', humanOversight: 'human-oversight.html', biasTesting: 'bias-testing.html', consentDesign: 'consent-design.html', securityAssessment: 'security-assessment.html', piaAssessment: 'pia-assessment.html', consentRecordsAudit: 'consent-records-audit.html', dsrRightsImplementation: 'dsr-rights-implementation.html', transparencyDocumentation: 'transparency-documentation.html', disclosureToolkit: 'disclosure-toolkit.html', contentLabeling: 'content-labeling.html', automatedDecisionLogic: 'automated-decision-logic.html', trainingDataDisclosure: 'training-data-disclosure.html', governanceFramework: 'governance-framework.html', incidentManagement: 'incident-management.html', conformityAssessment: 'conformity-assessment.html', contentModeration: 'content-moderation.html', aiLiteracyTraining: 'ai-literacy-training.html' };
  var missing = []; for (var key in tm) { if (!itr[key]) missing.push(tm[key]); }
  if (missing.length > 0) { ln(); ln('  Run these interactive tools:'); for (var i = 0; i < missing.length; i++) ln('    - tools/interactive/' + missing[i]); }
  ln();
  return { text: lines.join('\n'), hasCritical: totalC > 0 };
}

// --- Main ---
function main() {
  var parsed = parseArgs();
  var config;
  try { config = loadJSON(parsed.configPath); if (!parsed.json) console.log('Config loaded: ' + parsed.configPath); }
  catch (e) { console.error('ERROR: Cannot read config: ' + e.message); process.exit(1); }
  var matrix;
  try { matrix = loadJSON(path.join(DATA_DIR, 'jurisdiction-matrix.json')); }
  catch (e) { console.error('ERROR: Cannot read jurisdiction-matrix.json: ' + e.message); process.exit(1); }
  var required = {};
  var jurs = config.jurisdictions || [];
  for (var ji = 0; ji < jurs.length; ji++) { var reqs = matrix.templateRequirements || {}; var tns = Object.keys(reqs); for (var ti = 0; ti < tns.length; ti++) { if (reqs[tns[ti]][jurs[ji]]) required[tns[ti]] = true; } }
  if (!fs.existsSync(parsed.outputDir)) { console.error('ERROR: Output not found. Run autofill.js first.'); process.exit(1); }
  var outputFiles = fs.readdirSync(parsed.outputDir).filter(function(f) { return f.endsWith('.md') && /^\d{2}-/.test(f); }).sort();
  var tplResults = {};
  var checkList = parsed.templateFilter ? [parsed.templateFilter] : Object.keys(required).sort();
  for (var ri = 0; ri < checkList.length; ri++) {
    var tn = checkList[ri]; var name = (matrix.templateNames && matrix.templateNames[tn]) || ('Template ' + tn);
    var mf = null; for (var fi = 0; fi < outputFiles.length; fi++) { if (outputFiles[fi].indexOf(tn + '-') === 0) { mf = outputFiles[fi]; break; } }
    if (!mf) { tplResults[tn] = { name: name, exists: false, completeness: 0, deepCheck: { findings: [{ severity: 'CRITICAL', section: 'File', message: 'Not found' }], passes: [] } }; continue; }
    var md = safeReadFile(path.join(parsed.outputDir, mf));
    if (!md) { tplResults[tn] = { name: name, exists: false, completeness: 0, deepCheck: { findings: [{ severity: 'CRITICAL', section: 'File', message: 'Cannot read' }], passes: [] } }; continue; }
    var analysis = analyzeTemplateCompleteness(md);
    var metaIssues = checkMetadata(md);
    var dc = TEMPLATE_CHECKERS[tn] ? TEMPLATE_CHECKERS[tn](md) : { findings: [], passes: [] };
    for (var mi = 0; mi < metaIssues.length; mi++) dc.findings.push({ severity: 'MEDIUM', section: 'Metadata', message: metaIssues[mi] });
    tplResults[tn] = { name: name, exists: true, completeness: analysis.completeness, deepCheck: dc };
  }
  var crossRef = crossReferenceChecks(config, parsed.outputDir, outputFiles);
  var report = generateReport(config, matrix, tplResults, crossRef, { verbose: parsed.verbose });
  if (parsed.json) {
    var json = { date: today(), organization: config.organization, system: config.system, templates: tplResults, crossReferences: crossRef, summary: { templates: Object.keys(tplResults).length, critical: 0, high: 0, medium: 0 } };
    for (var k in tplResults) { if (tplResults[k].deepCheck) { for (var fi = 0; fi < tplResults[k].deepCheck.findings.length; fi++) { var s = tplResults[k].deepCheck.findings[fi].severity; if (s === 'CRITICAL') json.summary.critical++; else if (s === 'HIGH') json.summary.high++; else if (s === 'MEDIUM') json.summary.medium++; } } }
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log(report.text);
    var rp = path.join(parsed.outputDir, 'evidence-check-report.txt');
    try { fs.writeFileSync(rp, report.text, 'utf8'); console.log('Report written to: ' + rp); }
    catch (e) { console.error('WARNING: Could not write report: ' + e.message); }
  }
  process.exit(report.hasCritical ? 1 : 0);
}

main();
