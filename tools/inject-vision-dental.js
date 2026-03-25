#!/usr/bin/env node
/**
 * inject-vision-dental.js
 *
 * Adds visionDental detailed cost data to all 138 locations.
 * Country-specific templates with all costs in USD.
 * Syncs to packages/dashboard/public/data/locations/.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.resolve(ROOT, 'data/locations');
const DASHBOARD_DIR = path.resolve(ROOT, 'packages/dashboard/public/data/locations');

// ────────────────────────────────────────────────────────────────
// Helper: round to nearest integer
// ────────────────────────────────────────────────────────────────
const r = (n) => Math.round(n);

// ────────────────────────────────────────────────────────────────
// Country-specific vision & dental templates
// All costs in USD
// ────────────────────────────────────────────────────────────────

function usTemplate() {
  const visionPremium = 15;
  const dentalPremium = 35;
  const annualPremiums = (visionPremium + dentalPremium) * 12;
  const annualOOP = 200;
  const annualTotal = annualPremiums + annualOOP;
  const annualNoIns = 500;

  return {
    monthlyBudget: { min: 80, typical: 120, max: 180 },
    vision: {
      eyeExam: { withInsurance: 20, withoutInsurance: 75, notes: 'Standard comprehensive eye exam. Most VSP/EyeMed plans cover 1 exam/year with $10-20 copay.' },
      glasses: { basic: 100, progressive: 250, contacts12mo: 200, notes: 'Frames + single-vision lenses ~$100 with insurance allowance. Progressive lenses add $100-150. Contacts 12-month supply varies by brand.' },
      insurance: { monthlyPremium: 15, coverage: 'VSP or EyeMed plan, 1 exam + $150 frame allowance/year', notes: 'Employer-style standalone vision plan. Covers 1 exam/year, $150 frame allowance, contacts allowance in lieu of frames.' },
    },
    dental: {
      cleaning: { withInsurance: 25, withoutInsurance: 100, notes: 'Preventive cleaning 2x/year. Most plans cover 100% preventive.' },
      filling: { withInsurance: 50, withoutInsurance: 200, notes: 'Composite (tooth-colored) filling. Insurance typically covers 80% of basic procedures.' },
      crown: { withInsurance: 400, withoutInsurance: 1200, notes: 'Porcelain-fused-to-metal crown. Insurance typically covers 50% of major procedures.' },
      insurance: { monthlyPremium: 35, coverage: 'Delta Dental or equivalent, 2 cleanings/year, 80% basic, 50% major', notes: 'DHMO or PPO plan. Annual max $1,000-$1,500. Waiting periods may apply for major work.' },
    },
    annualEstimate: {
      withInsurance: { premiums: annualPremiums, outOfPocket: annualOOP, total: annualTotal, monthlyEquiv: r(annualTotal / 12) },
      withoutInsurance: { outOfPocket: annualNoIns, monthlyEquiv: r(annualNoIns / 12) },
    },
  };
}

function franceTemplate() {
  const mutuelleVision = 8;
  const mutuelleDental = 15;
  const annualPremiums = (mutuelleVision + mutuelleDental) * 12;
  const annualOOP = 120;
  const annualTotal = annualPremiums + annualOOP;
  const annualNoIns = 350;

  return {
    monthlyBudget: { min: 40, typical: 75, max: 120 },
    vision: {
      eyeExam: { withInsurance: 5, withoutInsurance: 28, notes: 'Exam ~25 EUR. Securite Sociale reimburses 70%, mutuelle covers remainder. Ophthalmologist visit may cost more if secteur 2.' },
      glasses: { basic: 57, progressive: 170, contacts12mo: 140, notes: 'Glasses with mutuelle ~50-100 EUR after refund. 100% Sante reform guarantees a fully covered frame+lens option. Progressive lenses ~150 EUR.' },
      insurance: { monthlyPremium: 8, coverage: 'Mutuelle complementaire covers vision copays + frame/lens allowance', notes: 'Mutuelle typically included as part of broader health complementaire (~40-60 EUR/mo total). Vision portion ~8 EUR/mo. 100% Sante ensures zero out-of-pocket for basic frames.' },
    },
    dental: {
      cleaning: { withInsurance: 8, withoutInsurance: 34, notes: 'Detartrage (scaling) ~30 EUR. Securite Sociale covers 70% of tarif conventionnel. Mutuelle covers ticket moderateur.' },
      filling: { withInsurance: 15, withoutInsurance: 68, notes: 'Composite filling ~60 EUR. Well-covered under Securite Sociale + mutuelle. Depassements possible for some dentists.' },
      crown: { withInsurance: 170, withoutInsurance: 570, notes: 'Couronne ceramique ~500 EUR. RAC zero (100% Sante) available for certain crown types since 2020 reform. Otherwise mutuelle covers 200-300% base tariff.' },
      insurance: { monthlyPremium: 15, coverage: 'Mutuelle complementaire dental, 2 cleanings/year, 100% Sante crowns/bridges', notes: 'Dental portion of mutuelle. 100% Sante reform guarantees zero-cost crowns, bridges, and dentures for regulated tariff options.' },
    },
    annualEstimate: {
      withInsurance: { premiums: annualPremiums, outOfPocket: annualOOP, total: annualTotal, monthlyEquiv: r(annualTotal / 12) },
      withoutInsurance: { outOfPocket: annualNoIns, monthlyEquiv: r(annualNoIns / 12) },
    },
  };
}

function spainTemplate() {
  const dentalPlanMo = 17;
  const visionPlanMo = 0; // No separate vision insurance typical in Spain
  const annualPremiums = (dentalPlanMo + visionPlanMo) * 12;
  const annualOOP = 150;
  const annualTotal = annualPremiums + annualOOP;
  const annualNoIns = 380;

  return {
    monthlyBudget: { min: 35, typical: 65, max: 110 },
    vision: {
      eyeExam: { withInsurance: 0, withoutInsurance: 34, notes: 'Exam ~30 EUR. Public health covers ophthalmologist referral. Private clinics charge 30-50 EUR.' },
      glasses: { basic: 90, progressive: 200, contacts12mo: 170, notes: 'Basic frames+lenses ~80 EUR at chains like Optica2000 or Alain Afflelou. Progressive ~180 EUR. Not covered by public health.' },
      insurance: { monthlyPremium: 0, coverage: 'Public health covers ophthalmology referrals; glasses/contacts not covered', notes: 'No standalone vision insurance typical. Private health plans (Sanitas, Adeslas ~60 EUR/mo) include ophthalmology but not glasses.' },
    },
    dental: {
      cleaning: { withInsurance: 0, withoutInsurance: 45, notes: 'Limpieza dental ~40 EUR. Often included free with dental plan (seguro dental).' },
      filling: { withInsurance: 34, withoutInsurance: 68, notes: 'Empaste composite ~60 EUR. Dental plans cover 20-50% of basic treatments.' },
      crown: { withInsurance: 285, withoutInsurance: 400, notes: 'Corona de porcelana ~350 EUR. Dental plans typically discount 20-30% on major work.' },
      insurance: { monthlyPremium: 17, coverage: 'Seguro dental (Sanitas Dental, DKV), free cleanings, 20-50% off treatments', notes: 'Dental-only plan ~15 EUR/mo. Includes free cleanings, x-rays, and discounted fillings/crowns. No annual maximum typical.' },
    },
    annualEstimate: {
      withInsurance: { premiums: annualPremiums, outOfPocket: annualOOP, total: annualTotal, monthlyEquiv: r(annualTotal / 12) },
      withoutInsurance: { outOfPocket: annualNoIns, monthlyEquiv: r(annualNoIns / 12) },
    },
  };
}

function italyTemplate() {
  const dentalPlanMo = 17;
  const annualPremiums = dentalPlanMo * 12;
  const annualOOP = 160;
  const annualTotal = annualPremiums + annualOOP;
  const annualNoIns = 400;

  return {
    monthlyBudget: { min: 40, typical: 70, max: 120 },
    vision: {
      eyeExam: { withInsurance: 0, withoutInsurance: 34, notes: 'Visita oculistica ~30 EUR. SSN (public health) covers ophthalmologist with GP referral. Private ~30-50 EUR.' },
      glasses: { basic: 90, progressive: 200, contacts12mo: 170, notes: 'Basic frames+lenses ~80 EUR at chains like GrandVision, Salmoiraghi. Progressive ~180 EUR. Not covered by SSN.' },
      insurance: { monthlyPremium: 0, coverage: 'SSN covers ophthalmology referrals; glasses/contacts not covered', notes: 'No standalone vision insurance common. Private health (Unisalute, Generali) may include vision benefits.' },
    },
    dental: {
      cleaning: { withInsurance: 10, withoutInsurance: 57, notes: 'Pulizia dentale ~50 EUR. Very limited public dental for adults.' },
      filling: { withInsurance: 34, withoutInsurance: 80, notes: 'Otturazione composita ~70 EUR. Private dental is standard; public waitlists are long.' },
      crown: { withInsurance: 285, withoutInsurance: 455, notes: 'Corona in ceramica ~400 EUR. Dental funds (fondi sanitari) through employers reduce costs.' },
      insurance: { monthlyPremium: 17, coverage: 'Private dental plan or fondo sanitario, discounted cleanings and treatments', notes: 'Dental-only plans ~15 EUR/mo (DentaVox, Unisalute Dental). Free cleanings, 30-50% off treatments. Fondi sanitari via CCNL employment contracts common.' },
    },
    annualEstimate: {
      withInsurance: { premiums: annualPremiums, outOfPocket: annualOOP, total: annualTotal, monthlyEquiv: r(annualTotal / 12) },
      withoutInsurance: { outOfPocket: annualNoIns, monthlyEquiv: r(annualNoIns / 12) },
    },
  };
}

function portugalTemplate() {
  const dentalPlanMo = 14;
  const annualPremiums = dentalPlanMo * 12;
  const annualOOP = 130;
  const annualTotal = annualPremiums + annualOOP;
  const annualNoIns = 320;

  return {
    monthlyBudget: { min: 30, typical: 60, max: 100 },
    vision: {
      eyeExam: { withInsurance: 0, withoutInsurance: 28, notes: 'Consulta de oftalmologia ~25 EUR. SNS (public health) covers referral. Private ~25-40 EUR.' },
      glasses: { basic: 68, progressive: 170, contacts12mo: 140, notes: 'Basic frames+lenses ~60 EUR at chains like MultiOpticas, Wells. Progressive ~150 EUR. Not covered by SNS.' },
      insurance: { monthlyPremium: 0, coverage: 'SNS covers ophthalmology referrals; glasses/contacts not covered', notes: 'No standalone vision insurance typical. Private health (Multicare, Medis) may include vision.' },
    },
    dental: {
      cleaning: { withInsurance: 8, withoutInsurance: 40, notes: 'Destartarizacao ~35 EUR. Cheque-dentista program covers some preventive dental for eligible residents.' },
      filling: { withInsurance: 23, withoutInsurance: 57, notes: 'Obturacao composta ~50 EUR. Most dental care is private in Portugal.' },
      crown: { withInsurance: 228, withoutInsurance: 342, notes: 'Coroa ceramica ~300 EUR. Portugal is a dental tourism destination; prices competitive.' },
      insurance: { monthlyPremium: 14, coverage: 'Private dental plan (Multicare Dental, Medicare), 2 cleanings/year, discounted treatments', notes: 'Dental-only plans ~12 EUR/mo. Cheque-dentista program provides limited free preventive dental for SNS users.' },
    },
    annualEstimate: {
      withInsurance: { premiums: annualPremiums, outOfPocket: annualOOP, total: annualTotal, monthlyEquiv: r(annualTotal / 12) },
      withoutInsurance: { outOfPocket: annualNoIns, monthlyEquiv: r(annualNoIns / 12) },
    },
  };
}

function irelandTemplate() {
  const dentalPlanMo = 20;
  const annualPremiums = dentalPlanMo * 12;
  const annualOOP = 180;
  const annualTotal = annualPremiums + annualOOP;
  const annualNoIns = 550;

  return {
    monthlyBudget: { min: 50, typical: 85, max: 140 },
    vision: {
      eyeExam: { withInsurance: 10, withoutInsurance: 56, notes: 'Eye test ~50 EUR. PRSI Treatment Benefit covers 1 free eye exam every 2 years for eligible contributors.' },
      glasses: { basic: 100, progressive: 230, contacts12mo: 190, notes: 'Frames+lenses ~90 EUR with PRSI contribution. Progressive ~200 EUR. PRSI gives up to 51.50 EUR toward glasses every 2 years.' },
      insurance: { monthlyPremium: 0, coverage: 'PRSI Treatment Benefit covers 1 exam/2yr + 51.50 EUR glasses contribution', notes: 'No separate vision insurance. Private health insurance (VHI, Laya, Irish Life) may include optical benefit. Medical card holders get free eye tests.' },
    },
    dental: {
      cleaning: { withInsurance: 20, withoutInsurance: 67, notes: 'Scale and polish ~60 EUR. PRSI covers 1 free dental exam + cleaning per year for eligible PRSI contributors.' },
      filling: { withInsurance: 40, withoutInsurance: 112, notes: 'Composite filling ~100 EUR. PRSI does not cover fillings. Private dental plan recommended.' },
      crown: { withInsurance: 450, withoutInsurance: 672, notes: 'Porcelain crown ~600 EUR. Major work expensive; dental plans help with 25-40% discount.' },
      insurance: { monthlyPremium: 20, coverage: 'DeCare Dental or equivalent, PRSI exam + cleaning, 30% off treatments', notes: 'Dental plans ~18 EUR/mo. DeCare is main Irish dental insurer. Medical card provides free dental for low-income residents.' },
    },
    annualEstimate: {
      withInsurance: { premiums: annualPremiums, outOfPocket: annualOOP, total: annualTotal, monthlyEquiv: r(annualTotal / 12) },
      withoutInsurance: { outOfPocket: annualNoIns, monthlyEquiv: r(annualNoIns / 12) },
    },
  };
}

function greeceTemplate() {
  const dentalPlanMo = 12;
  const annualPremiums = dentalPlanMo * 12;
  const annualOOP = 100;
  const annualTotal = annualPremiums + annualOOP;
  const annualNoIns = 280;

  return {
    monthlyBudget: { min: 25, typical: 50, max: 90 },
    vision: {
      eyeExam: { withInsurance: 0, withoutInsurance: 23, notes: 'Exam ~20 EUR. EOPYY (public health) covers ophthalmologist referral. Private ~20-30 EUR.' },
      glasses: { basic: 57, progressive: 140, contacts12mo: 115, notes: 'Basic frames+lenses ~50 EUR. Progressive ~120 EUR. EOPYY provides partial glasses reimbursement with referral.' },
      insurance: { monthlyPremium: 0, coverage: 'EOPYY covers ophthalmology + partial glasses reimbursement with prescription', notes: 'No standalone vision insurance. Private health (Interamerican, Ethniki) may include optical. EOPYY reimburses ~40-100 EUR for glasses with prescription.' },
    },
    dental: {
      cleaning: { withInsurance: 8, withoutInsurance: 34, notes: 'Katharismos ~30 EUR. Very limited public dental via EOPYY. Most dental is private.' },
      filling: { withInsurance: 20, withoutInsurance: 45, notes: 'Sfragisma ~40 EUR. Private dental very affordable by EU standards.' },
      crown: { withInsurance: 170, withoutInsurance: 285, notes: 'Stefani porselanis ~250 EUR. Greece is a dental tourism destination. Quality excellent.' },
      insurance: { monthlyPremium: 12, coverage: 'Private dental plan, free cleanings, 30% off treatments', notes: 'Dental plans ~10 EUR/mo through private insurers. EOPYY covers minimal preventive dental only.' },
    },
    annualEstimate: {
      withInsurance: { premiums: annualPremiums, outOfPocket: annualOOP, total: annualTotal, monthlyEquiv: r(annualTotal / 12) },
      withoutInsurance: { outOfPocket: annualNoIns, monthlyEquiv: r(annualNoIns / 12) },
    },
  };
}

function croatiaTemplate() {
  const dentalPlanMo = 10;
  const annualPremiums = dentalPlanMo * 12;
  const annualOOP = 80;
  const annualTotal = annualPremiums + annualOOP;
  const annualNoIns = 230;

  return {
    monthlyBudget: { min: 20, typical: 45, max: 80 },
    vision: {
      eyeExam: { withInsurance: 0, withoutInsurance: 17, notes: 'Pregled ociju ~15 EUR. HZZO (public health) covers ophthalmology. Private ~15-25 EUR.' },
      glasses: { basic: 45, progressive: 120, contacts12mo: 100, notes: 'Basic frames+lenses ~40 EUR. Progressive ~100 EUR. HZZO subsidizes glasses for children and some adults.' },
      insurance: { monthlyPremium: 0, coverage: 'HZZO covers ophthalmology; partial glasses subsidy for eligible patients', notes: 'No standalone vision insurance. Supplemental HZZO (dopunsko) ~10 EUR/mo covers participation fees for all medical visits.' },
    },
    dental: {
      cleaning: { withInsurance: 0, withoutInsurance: 28, notes: 'Ciscenje zubi ~25 EUR. HZZO covers 1 free preventive dental visit per year.' },
      filling: { withInsurance: 8, withoutInsurance: 40, notes: 'Plomba ~35 EUR. Basic fillings covered by HZZO with small participation fee.' },
      crown: { withInsurance: 140, withoutInsurance: 228, notes: 'Krunica ~200 EUR. Croatia is a dental tourism hub; prices 50-70% less than Western EU.' },
      insurance: { monthlyPremium: 10, coverage: 'HZZO supplemental (dopunsko), covers participation fees + basic dental', notes: 'Supplemental insurance ~10 EUR/mo. Covers participation fees (20% copay). Basic dental (cleanings, fillings, extractions) covered by public HZZO.' },
    },
    annualEstimate: {
      withInsurance: { premiums: annualPremiums, outOfPocket: annualOOP, total: annualTotal, monthlyEquiv: r(annualTotal / 12) },
      withoutInsurance: { outOfPocket: annualNoIns, monthlyEquiv: r(annualNoIns / 12) },
    },
  };
}

function mexicoTemplate() {
  return {
    monthlyBudget: { min: 15, typical: 35, max: 65 },
    vision: {
      eyeExam: { withInsurance: 5, withoutInsurance: 15, notes: 'Examen de la vista ~$10-20 at private optometrist. Simi Optica and similar chains offer free exams with purchase.' },
      glasses: { basic: 30, progressive: 80, contacts12mo: 70, notes: 'Basic frames+lenses ~$25-40 at Simi Optica or local opticas. Progressive ~$70. Very affordable by US standards.' },
      insurance: { monthlyPremium: 0, coverage: 'IMSS covers ophthalmology for enrolled residents; glasses not covered', notes: 'No standalone vision insurance. IMSS voluntary enrollment ~$50/mo covers full medical. Private health plans (GNP, AXA) may include optical.' },
    },
    dental: {
      cleaning: { withInsurance: 5, withoutInsurance: 25, notes: 'Limpieza dental ~$20-30 at private dentist. Quality is excellent; many US-trained dentists near border.' },
      filling: { withInsurance: 15, withoutInsurance: 35, notes: 'Resina compuesta ~$30-40. Very affordable private dental care.' },
      crown: { withInsurance: 120, withoutInsurance: 200, notes: 'Corona de porcelana ~$150-250. Mexico is top dental tourism destination. Quality comparable to US at 20-30% of cost.' },
      insurance: { monthlyPremium: 8, coverage: 'IMSS voluntary enrollment covers basic dental; or private dental plan ~$8/mo', notes: 'IMSS voluntary ($50/mo total) includes basic dental. Separate dental plans ~$8/mo through local insurers. Many expats pay out-of-pocket given low costs.' },
    },
    annualEstimate: {
      withInsurance: { premiums: 96, outOfPocket: 80, total: 176, monthlyEquiv: 15 },
      withoutInsurance: { outOfPocket: 250, monthlyEquiv: 21 },
    },
  };
}

function colombiaTemplate() {
  return {
    monthlyBudget: { min: 10, typical: 25, max: 50 },
    vision: {
      eyeExam: { withInsurance: 0, withoutInsurance: 10, notes: 'Examen visual ~$8-12 at optica or EPS clinic. EPS (mandatory health) covers ophthalmology referral.' },
      glasses: { basic: 20, progressive: 60, contacts12mo: 50, notes: 'Basic frames+lenses ~$15-25 at local opticas. Progressive ~$50. Very affordable.' },
      insurance: { monthlyPremium: 0, coverage: 'EPS mandatory health covers ophthalmology; glasses partially subsidized', notes: 'No separate vision insurance needed. EPS covers eye exams and ophthalmology. Glasses subsidy available through EPS for qualifying prescriptions.' },
    },
    dental: {
      cleaning: { withInsurance: 0, withoutInsurance: 15, notes: 'Limpieza dental ~$12-18. EPS (Plan Obligatorio de Salud) covers 1 cleaning per year.' },
      filling: { withInsurance: 5, withoutInsurance: 20, notes: 'Resina compuesta ~$15-25. EPS covers basic restorative dental.' },
      crown: { withInsurance: 80, withoutInsurance: 150, notes: 'Corona ceramica ~$120-180. Colombia has excellent dental care at very low cost. Medellin and Bogota are dental tourism hubs.' },
      insurance: { monthlyPremium: 0, coverage: 'EPS mandatory health covers preventive dental + basic restorative', notes: 'EPS contribution included in health system (~12.5% of income, split employer/employee). Covers cleanings, fillings, extractions. Prepaid medicine plans (medicina prepagada ~$80/mo) add premium dental.' },
    },
    annualEstimate: {
      withInsurance: { premiums: 0, outOfPocket: 100, total: 100, monthlyEquiv: 8 },
      withoutInsurance: { outOfPocket: 200, monthlyEquiv: 17 },
    },
  };
}

function costaRicaTemplate() {
  return {
    monthlyBudget: { min: 15, typical: 35, max: 70 },
    vision: {
      eyeExam: { withInsurance: 0, withoutInsurance: 20, notes: 'Examen de la vista ~$15-25 private. CAJA (CCSS public health) covers ophthalmology with referral, but long waits.' },
      glasses: { basic: 35, progressive: 90, contacts12mo: 80, notes: 'Basic frames+lenses ~$30-40 at local opticas. Progressive ~$80. Reasonable prices.' },
      insurance: { monthlyPremium: 0, coverage: 'CAJA (CCSS) covers ophthalmology with referral; glasses not covered', notes: 'No standalone vision insurance. CAJA voluntary enrollment ~$100/mo covers all medical. Private insurance (INS) may include optical.' },
    },
    dental: {
      cleaning: { withInsurance: 5, withoutInsurance: 30, notes: 'Limpieza dental ~$25-35 private. CAJA covers basic extractions only; limited preventive dental.' },
      filling: { withInsurance: 15, withoutInsurance: 40, notes: 'Resina compuesta ~$35-50. Private dental quality is good; many bilingual dentists in Central Valley.' },
      crown: { withInsurance: 150, withoutInsurance: 250, notes: 'Corona de porcelana ~$200-300. Costa Rica is a dental tourism destination, especially San Jose area.' },
      insurance: { monthlyPremium: 10, coverage: 'CAJA basic dental + private dental plan for comprehensive care', notes: 'CAJA ($100/mo total) covers emergency dental. Private dental plans ~$10/mo for cleanings and discounts. Many expats use private dentists out-of-pocket.' },
    },
    annualEstimate: {
      withInsurance: { premiums: 120, outOfPocket: 100, total: 220, monthlyEquiv: 18 },
      withoutInsurance: { outOfPocket: 320, monthlyEquiv: 27 },
    },
  };
}

function panamaTemplate() {
  return {
    monthlyBudget: { min: 12, typical: 30, max: 60 },
    vision: {
      eyeExam: { withInsurance: 5, withoutInsurance: 15, notes: 'Examen visual ~$12-20 at private optica or clinic. CSS (public health) covers ophthalmology for enrolled.' },
      glasses: { basic: 25, progressive: 70, contacts12mo: 60, notes: 'Basic frames+lenses ~$20-30 at local opticas (Optica Lopez, MultiMax). Progressive ~$60. USD-denominated economy.' },
      insurance: { monthlyPremium: 0, coverage: 'CSS covers ophthalmology for enrolled; glasses not covered', notes: 'No standalone vision insurance. Private health plans available. Many expats pay out-of-pocket given low costs.' },
    },
    dental: {
      cleaning: { withInsurance: 5, withoutInsurance: 25, notes: 'Limpieza dental ~$20-30. Affordable private dental throughout Panama.' },
      filling: { withInsurance: 12, withoutInsurance: 30, notes: 'Resina compuesta ~$25-35. Quality is good in Panama City; more limited in rural areas.' },
      crown: { withInsurance: 120, withoutInsurance: 200, notes: 'Corona de porcelana ~$150-250. Panama City has excellent dental specialists. Pensionado visa holders get 15% medical discount.' },
      insurance: { monthlyPremium: 8, coverage: 'Private dental plan or Pensionado discount (15% off medical/dental)', notes: 'Private dental plans ~$8/mo. Pensionado visa provides 15% discount on dental and medical. CSS covers basic dental for enrolled residents.' },
    },
    annualEstimate: {
      withInsurance: { premiums: 96, outOfPocket: 70, total: 166, monthlyEquiv: 14 },
      withoutInsurance: { outOfPocket: 250, monthlyEquiv: 21 },
    },
  };
}

function ecuadorTemplate() {
  return {
    monthlyBudget: { min: 8, typical: 20, max: 45 },
    vision: {
      eyeExam: { withInsurance: 0, withoutInsurance: 10, notes: 'Examen visual ~$8-12 at private optica. IESS (public health) covers ophthalmology for enrolled. USD-denominated economy.' },
      glasses: { basic: 18, progressive: 50, contacts12mo: 45, notes: 'Basic frames+lenses ~$15-20 at local opticas. Progressive ~$40-60. Very affordable.' },
      insurance: { monthlyPremium: 0, coverage: 'IESS covers ophthalmology for enrolled; glasses not covered', notes: 'No standalone vision insurance. IESS voluntary enrollment available for residents. Private insurance (Humana, BMI) may include optical.' },
    },
    dental: {
      cleaning: { withInsurance: 0, withoutInsurance: 15, notes: 'Limpieza dental ~$12-18. IESS covers basic preventive dental for enrolled.' },
      filling: { withInsurance: 5, withoutInsurance: 18, notes: 'Resina compuesta ~$15-20. Very affordable private dental care.' },
      crown: { withInsurance: 60, withoutInsurance: 120, notes: 'Corona ceramica ~$100-150. Ecuador has very affordable dental care. Cuenca is a hub for expat dental services.' },
      insurance: { monthlyPremium: 0, coverage: 'IESS mandatory for residents covers basic dental + ophthalmology', notes: 'IESS contribution ~17.6% of declared income. Covers preventive dental, fillings, extractions. Private dental plans rare; most pay out-of-pocket given low costs.' },
    },
    annualEstimate: {
      withInsurance: { premiums: 0, outOfPocket: 80, total: 80, monthlyEquiv: 7 },
      withoutInsurance: { outOfPocket: 180, monthlyEquiv: 15 },
    },
  };
}

function uruguayTemplate() {
  return {
    monthlyBudget: { min: 20, typical: 45, max: 80 },
    vision: {
      eyeExam: { withInsurance: 0, withoutInsurance: 22, notes: 'Examen oftalmologico ~$18-25. FONASA (public health) covers ophthalmology through mutualista (health cooperative).' },
      glasses: { basic: 45, progressive: 110, contacts12mo: 90, notes: 'Basic frames+lenses ~$40-50 at local opticas. Progressive ~$100. Slightly more expensive than neighboring countries.' },
      insurance: { monthlyPremium: 0, coverage: 'FONASA/mutualista covers ophthalmology; glasses not covered', notes: 'No standalone vision insurance. Mutualista membership through FONASA includes ophthalmology. Private insurance (Blue Cross Uruguay) may add optical benefit.' },
    },
    dental: {
      cleaning: { withInsurance: 8, withoutInsurance: 30, notes: 'Limpieza dental ~$25-35. Mutualista covers 1 basic dental visit/year; limited coverage.' },
      filling: { withInsurance: 15, withoutInsurance: 40, notes: 'Empaste compuesto ~$35-45. Private dental recommended for quality care.' },
      crown: { withInsurance: 180, withoutInsurance: 300, notes: 'Corona ceramica ~$250-350. Uruguay dental costs higher than regional average but lower than US/EU.' },
      insurance: { monthlyPremium: 12, coverage: 'Mutualista basic dental + private dental supplement for major work', notes: 'Mutualista membership (~$60/mo through FONASA) includes basic dental. Private dental plans ~$12/mo for additional coverage. Many expats use private dentists out-of-pocket.' },
    },
    annualEstimate: {
      withInsurance: { premiums: 144, outOfPocket: 100, total: 244, monthlyEquiv: 20 },
      withoutInsurance: { outOfPocket: 350, monthlyEquiv: 29 },
    },
  };
}

function cyprusTemplate() {
  const dentalPlanMo = 15;
  const annualPremiums = dentalPlanMo * 12;
  const annualOOP = 130;
  const annualTotal = annualPremiums + annualOOP;
  const annualNoIns = 380;

  return {
    monthlyBudget: { min: 30, typical: 55, max: 95 },
    vision: {
      eyeExam: { withInsurance: 0, withoutInsurance: 28, notes: 'Eye exam ~25 EUR. GHS (GESY public health) covers ophthalmology with small copay (~6 EUR).' },
      glasses: { basic: 68, progressive: 170, contacts12mo: 140, notes: 'Basic frames+lenses ~60 EUR. Progressive ~150 EUR. Not covered by GESY. Local and chain opticians available.' },
      insurance: { monthlyPremium: 0, coverage: 'GESY (GHS) covers ophthalmology with small copay; glasses not covered', notes: 'No standalone vision insurance. GESY contribution ~2.65% of income. Private health plans (Bupa Cyprus, Interlife) may add optical.' },
    },
    dental: {
      cleaning: { withInsurance: 8, withoutInsurance: 45, notes: 'Katharismos ~40 EUR. GESY covers limited preventive dental (1 exam + cleaning/year).' },
      filling: { withInsurance: 25, withoutInsurance: 57, notes: 'Sfragisma ~50 EUR. GESY covers basic fillings with copay. Private dental for faster service.' },
      crown: { withInsurance: 250, withoutInsurance: 400, notes: 'Stefani ~350 EUR. Private dental recommended for major work. Good quality specialists available.' },
      insurance: { monthlyPremium: 15, coverage: 'GESY preventive dental + private dental plan for comprehensive coverage', notes: 'GESY covers basic dental with copays. Private dental plans ~15 EUR/mo for enhanced coverage. Cyprus dental costs moderate by EU standards.' },
    },
    annualEstimate: {
      withInsurance: { premiums: annualPremiums, outOfPocket: annualOOP, total: annualTotal, monthlyEquiv: r(annualTotal / 12) },
      withoutInsurance: { outOfPocket: annualNoIns, monthlyEquiv: r(annualNoIns / 12) },
    },
  };
}

function maltaTemplate() {
  const dentalPlanMo = 15;
  const annualPremiums = dentalPlanMo * 12;
  const annualOOP = 140;
  const annualTotal = annualPremiums + annualOOP;
  const annualNoIns = 400;

  return {
    monthlyBudget: { min: 30, typical: 60, max: 100 },
    vision: {
      eyeExam: { withInsurance: 0, withoutInsurance: 28, notes: 'Eye exam ~25 EUR. Public health covers ophthalmology at Mater Dei Hospital with referral. Private ~25-40 EUR.' },
      glasses: { basic: 68, progressive: 170, contacts12mo: 140, notes: 'Basic frames+lenses ~60 EUR. Progressive ~150 EUR. Several optician chains (Specsavers, EyeQ) on the islands.' },
      insurance: { monthlyPremium: 0, coverage: 'Public health covers ophthalmology referrals; glasses not covered', notes: 'No standalone vision insurance common. Private health plans available. Public system provides free eye care at government clinics.' },
    },
    dental: {
      cleaning: { withInsurance: 10, withoutInsurance: 45, notes: 'Tindif ~40 EUR. Government dental clinic offers free basic dental for residents (long waits).' },
      filling: { withInsurance: 25, withoutInsurance: 57, notes: 'Filling ~50 EUR. Government dental clinic covers basic fillings free; private is faster.' },
      crown: { withInsurance: 260, withoutInsurance: 400, notes: 'Crown ~350 EUR. Limited dental specialists on island; some travel to Sicily for major work.' },
      insurance: { monthlyPremium: 15, coverage: 'Private dental plan, free cleanings, discounted treatments', notes: 'Private dental plans ~15 EUR/mo. Government dental clinic provides free basic care for residents. Private dental recommended for faster service and major work.' },
    },
    annualEstimate: {
      withInsurance: { premiums: annualPremiums, outOfPocket: annualOOP, total: annualTotal, monthlyEquiv: r(annualTotal / 12) },
      withoutInsurance: { outOfPocket: annualNoIns, monthlyEquiv: r(annualNoIns / 12) },
    },
  };
}

// ────────────────────────────────────────────────────────────────
// Country → template mapping
// ────────────────────────────────────────────────────────────────
const TEMPLATES = {
  'United States': usTemplate,
  'France': franceTemplate,
  'Spain': spainTemplate,
  'Italy': italyTemplate,
  'Portugal': portugalTemplate,
  'Ireland': irelandTemplate,
  'Greece': greeceTemplate,
  'Croatia': croatiaTemplate,
  'Mexico': mexicoTemplate,
  'Colombia': colombiaTemplate,
  'Costa Rica': costaRicaTemplate,
  'Panama': panamaTemplate,
  'Ecuador': ecuadorTemplate,
  'Uruguay': uruguayTemplate,
  'Cyprus': cyprusTemplate,
  'Malta': maltaTemplate,
};

// ────────────────────────────────────────────────────────────────
// Process all locations
// ────────────────────────────────────────────────────────────────

const dirs = fs.readdirSync(DATA_DIR).filter(d =>
  fs.statSync(path.join(DATA_DIR, d)).isDirectory()
);

let created = 0;
let skipped = 0;
let synced = 0;
let errors = 0;

for (const dir of dirs) {
  const locPath = path.join(DATA_DIR, dir, 'location.json');
  const dcPath = path.join(DATA_DIR, dir, 'detailed-costs.json');

  if (!fs.existsSync(locPath)) {
    console.log(`  ! ${dir}: no location.json — skipping`);
    errors++;
    continue;
  }

  const loc = JSON.parse(fs.readFileSync(locPath, 'utf-8'));
  const country = loc.country;

  // Get template for this country
  const templateFn = TEMPLATES[country];
  if (!templateFn) {
    console.log(`  ! ${dir}: no visionDental template for "${country}" — skipping`);
    errors++;
    continue;
  }

  // Read or create detailed-costs.json
  let dc = {};
  if (fs.existsSync(dcPath)) {
    dc = JSON.parse(fs.readFileSync(dcPath, 'utf-8'));
    if (dc.visionDental) {
      console.log(`  - ${dir}: already has visionDental — skipping`);
      skipped++;
      continue;
    }
  }

  const vd = templateFn();
  dc.visionDental = vd;
  fs.writeFileSync(dcPath, JSON.stringify(dc, null, 2) + '\n', 'utf-8');
  console.log(`  + ${dir}: added visionDental (${country}, typical $${vd.monthlyBudget.typical}/mo)`);
  created++;

  // Sync to dashboard public dir
  const dashDir = path.join(DASHBOARD_DIR, dir);
  if (fs.existsSync(dashDir)) {
    const dashDcPath = path.join(dashDir, 'detailed-costs.json');
    if (fs.existsSync(dashDcPath)) {
      const dashDc = JSON.parse(fs.readFileSync(dashDcPath, 'utf-8'));
      dashDc.visionDental = vd;
      fs.writeFileSync(dashDcPath, JSON.stringify(dashDc, null, 2) + '\n', 'utf-8');
    } else {
      fs.writeFileSync(dashDcPath, JSON.stringify({ visionDental: vd }, null, 2) + '\n', 'utf-8');
    }
    synced++;
  }
}

console.log(`\nDone: ${created} created, ${skipped} skipped, ${synced} synced to dashboard, ${errors} errors`);
