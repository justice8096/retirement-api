/**
 * Required Minimum Distribution (RMD) calculations
 * Based on IRS Uniform Lifetime Table (Table III), effective 2022+
 * Per SECURE 2.0 Act:
 *   - Born 1951-1959: RMDs start at age 73
 *   - Born 1960+: RMDs start at age 75
 */

// IRS Uniform Lifetime Table III — distribution period (divisor) by age
var UNIFORM_TABLE = {
  72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9,
  78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7,
  84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9,
  90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9,
  96: 8.4, 97: 7.8, 98: 7.3, 99: 6.8, 100: 6.4, 101: 6.0,
  102: 5.6, 103: 5.2, 104: 4.9, 105: 4.6, 106: 4.3, 107: 4.1,
  108: 3.9, 109: 3.7, 110: 3.5, 111: 3.4, 112: 3.3, 113: 3.1,
  114: 3.0, 115: 2.9, 116: 2.8, 117: 2.7, 118: 2.5, 119: 2.3,
  120: 2.0,
};

export function getRMDStartAge(birthYear) {
  if (birthYear <= 1950) return 72;
  if (birthYear <= 1959) return 73;
  return 75;
}

export function getDistributionPeriod(age) {
  if (age < 72) return 0;
  if (age > 120) return UNIFORM_TABLE[120];
  return UNIFORM_TABLE[age] || 0;
}

export function calcRMD(priorYearBalance, age, birthYear) {
  var startAge = getRMDStartAge(birthYear);
  if (age < startAge || priorYearBalance <= 0) {
    return { rmd: 0, divisor: 0, required: false, startAge: startAge };
  }
  var divisor = getDistributionPeriod(age);
  if (divisor <= 0) {
    return { rmd: 0, divisor: 0, required: false, startAge: startAge };
  }
  var rmd = priorYearBalance / divisor;
  return { rmd: rmd, divisor: divisor, required: true, startAge: startAge };
}

export function calcCoupleRMD(priorYearBalance, hAge, wAge, hBirthYear, wBirthYear, hAlive, wAlive) {
  if (priorYearBalance <= 0) {
    return { rmd: 0, divisor: 0, required: false, startAge: 0, rmdAge: 0 };
  }

  var age, birthYear;
  if (hAlive && wAlive) {
    if (hAge >= wAge) { age = hAge; birthYear = hBirthYear; }
    else { age = wAge; birthYear = wBirthYear; }
  } else if (hAlive) {
    age = hAge; birthYear = hBirthYear;
  } else if (wAlive) {
    age = wAge; birthYear = wBirthYear;
  } else {
    return { rmd: 0, divisor: 0, required: false, startAge: 0, rmdAge: 0 };
  }

  var result = calcRMD(priorYearBalance, age, birthYear);
  result.rmdAge = age;
  return result;
}

export var RMD_PENALTY_RATE = 0.25;
export var RMD_PENALTY_RATE_CORRECTED = 0.10;
