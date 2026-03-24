export function fmt(n) {
  return '$' + Math.round(n).toLocaleString();
}

export function fmtK(n) {
  return '$' + (n / 1000).toFixed(0) + 'K';
}

export function pct(n) {
  return (n * 100).toFixed(1) + '%';
}
