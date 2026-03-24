export function calcBracketTax(income, brackets) {
  var tax = 0;
  for (var i = 0; i < brackets.length; i++) {
    var b = brackets[i];
    if (income <= b.min) break;
    var taxable = Math.min(income, b.max || Infinity) - b.min;
    tax += taxable * b.rate;
  }
  return tax;
}

export function calcTaxesForLocation(loc, ssIncome, iraIncome, investIncome) {
  var taxes = loc.taxes;
  if (!taxes) return null;
  var totalIncome = ssIncome + iraIncome + investIncome;
  var result = { federal: 0, state: 0, socialCharges: 0, salesVat: 0, vehicleTax: 0, total: 0, details: [] };

  // Federal income tax (US citizens everywhere)
  // 85% of SS is taxable at federal level for most retirees
  var ssTaxable = ssIncome * 0.85;
  var federalTaxableIncome = ssTaxable + iraIncome + investIncome;
  var fedDeduction = (taxes.federalIncomeTax && taxes.federalIncomeTax.standardDeduction) || 30000;
  var fedAGI = Math.max(0, federalTaxableIncome - fedDeduction);
  var fedBrackets = [
    { min: 0, max: 23850, rate: 0.10 }, { min: 23850, max: 96950, rate: 0.12 },
    { min: 96950, max: 206700, rate: 0.22 }, { min: 206700, max: 394600, rate: 0.24 },
  ];
  result.federal = calcBracketTax(fedAGI, fedBrackets);
  result.details.push({
    label: 'US Federal Income Tax', amount: result.federal,
    note: 'AGI $' + Math.round(fedAGI).toLocaleString() + ' after $' + fedDeduction.toLocaleString() + ' standard deduction',
  });

  // State/country income tax
  var st = taxes.stateIncomeTax;
  if (st && st.brackets && st.brackets.length > 0) {
    var stateIncome = iraIncome + investIncome;
    if (!taxes.ssExempt && !taxes.ssTaxedInCountry) {
      stateIncome += ssTaxable;
    }
    var stDeduction = st.deduction || 0;
    var stateAGI = Math.max(0, stateIncome - stDeduction);

    if (taxes.retirementExempt) {
      stateAGI = Math.max(0, investIncome - stDeduction);
      result.state = calcBracketTax(stateAGI, st.brackets);
      result.details.push({
        label: (st.label || 'State Income Tax'), amount: result.state,
        note: 'Retirement income exempt. Only investment income taxed.',
      });
    } else {
      result.state = calcBracketTax(stateAGI, st.brackets);
      var stLabel = st.label || 'State/Local Income Tax';
      result.details.push({ label: stLabel, amount: result.state, note: st.exemptions || '' });
    }

    // Foreign tax credit
    if (taxes.federalIncomeTax && taxes.federalIncomeTax.foreignTaxCredit && result.state > 0) {
      var ftc = Math.min(result.state, result.federal);
      result.federal = Math.max(0, result.federal - ftc);
      result.details[0].amount = result.federal;
      result.details[0].note += ' (after $' + Math.round(ftc).toLocaleString() + ' foreign tax credit)';
    }
  } else if (st && st.type === 'none') {
    result.details.push({ label: 'State Income Tax', amount: 0, note: st.exemptions || 'No state income tax' });
  } else if (st && st.type === 'territorial') {
    result.details.push({ label: st.label || 'Local Income Tax', amount: 0, note: st.exemptions || 'Territorial system: foreign income not taxed' });
  }

  // Social charges (France CSM etc.)
  if (taxes.socialCharges && taxes.socialCharges.rate > 0) {
    var scBase = iraIncome + investIncome;
    var scThreshold = taxes.socialCharges.annualThreshold || 0;
    var scTaxable = Math.max(0, scBase - scThreshold);
    result.socialCharges = scTaxable * taxes.socialCharges.rate;
    result.details.push({
      label: taxes.socialCharges.name || 'Social Charges',
      amount: result.socialCharges,
      note: (taxes.socialCharges.rate * 100).toFixed(1) + '% on ' + taxes.socialCharges.basis,
    });
  }

  // Vehicle tax
  if (taxes.estVehicleTax > 0) {
    result.vehicleTax = taxes.estVehicleTax;
    result.details.push({ label: 'Vehicle Property Tax', amount: result.vehicleTax, note: 'Annual estimate' });
  }

  result.total = result.federal + result.state + result.socialCharges + result.vehicleTax;
  result.totalIncome = totalIncome;
  result.effectiveRate = totalIncome > 0 ? result.total / totalIncome : 0;
  return result;
}
