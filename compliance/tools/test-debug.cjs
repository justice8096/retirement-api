var fs = require('fs');
var path = require('path');
var md = fs.readFileSync(path.join(__dirname, '..', 'output', '07-Privacy-Impact-Assessment.md'), 'utf8');

function getSectionContent(md, sectionHeader) {
  var escaped = sectionHeader.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
  var re = new RegExp('##\\s*' + escaped + '[\\s\\S]*?(?=\\n##\\s|\\n---\\s*$|$)');
  var m = md.match(re);
  return m ? m[0] : 'NOT FOUND';
}

function getTableRows(text) {
  var rows = [];
  var re = /^\|(.+)\|$/gm;
  var m;
  while ((m = re.exec(text)) !== null) {
    var row = m[1];
    if (/^[\s\-:|]+$/.test(row)) continue;
    rows.push(row.split('|').map(function(c) { return c.trim(); }));
  }
  return rows;
}

var sec1 = getSectionContent(md, '1. Processing Activity Description');
console.log('SEC1 found:', sec1 !== 'NOT FOUND');
console.log('SEC1 preview:', sec1.substring(0, 100));
var sec1Rows = getTableRows(sec1);
console.log('SEC1 rows:', sec1Rows.length);
for (var i = 0; i < sec1Rows.length; i++) {
  console.log('  Row', i, ':', JSON.stringify(sec1Rows[i]));
}

console.log('---');
// Manual regex test
var testRe = /#{2,3}\s*3\.1 Risks to Data Subjects[\s\S]*?(?=\r?\n#{2,3}\s|\r?\n---\s*$|$)/;
var testMatch = md.match(testRe);
console.log('Manual test match length:', testMatch ? testMatch[0].length : 'NO MATCH');
if (testMatch) console.log('Manual last 80:', testMatch[0].substring(testMatch[0].length - 80));

// Also test simpler approach
var idx32 = md.indexOf('### 3.2');
var idx31 = md.indexOf('### 3.1');
console.log('idx 3.1:', idx31, 'idx 3.2:', idx32);
console.log('chars between idx32-5 to idx32+5:', JSON.stringify(md.substring(idx32-5, idx32+5)));

var sec31 = getSectionContent(md, '3.1 Risks to Data Subjects');
console.log('SEC3.1 found:', sec31 !== 'NOT FOUND');
console.log('SEC3.1 length:', sec31.length);
console.log('SEC3.1 last 80 chars:', sec31.substring(sec31.length - 80));
var sec31Rows = getTableRows(sec31);
console.log('SEC3.1 rows:', sec31Rows.length);
var sec32 = getSectionContent(md, '3.2 AI-Specific Privacy Risks');
console.log('SEC3.2 found:', sec32 !== 'NOT FOUND');
var sec32Rows = getTableRows(sec32);
console.log('SEC3.2 rows:', sec32Rows.length);

console.log('---');
var sec4 = getSectionContent(md, '4. Data Subject Rights Implementation');
console.log('SEC4 found:', sec4 !== 'NOT FOUND');
var sec4Rows = getTableRows(sec4);
console.log('SEC4 rows:', sec4Rows.length);
if (sec4Rows.length > 1) {
  console.log('  Row 1:', JSON.stringify(sec4Rows[1]));
}
