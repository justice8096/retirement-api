#!/usr/bin/env node
/**
 * inject-medicine.js
 *
 * Adds the standard 13-medication medicine section to all locations
 * that are missing it, or updates locations with fewer than 13 meds.
 * Pricing is region-appropriate based on country healthcare systems.
 */
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve('data/locations');

// Standard 13-medication list by pricing region
// Regions: us, eu-high (France/Ireland), eu-med (Spain/Portugal/Italy/Greece/Croatia/Cyprus/Malta),
//          latam-low (Mexico/Colombia/Ecuador/Costa Rica), latam-mid (Panama/Uruguay)

const MEDICINE_TEMPLATES = {
  'United States': {
    monthlyPrescriptionCosts: { min: 73, typical: 91, max: 925 },
    commonMedications: [
      { name: 'Semaglutide / GLP-1 (Ozempic/Wegovy) [P1]', monthlyCost: 25, withoutInsurance: 900, coverageNote: 'Medicare Part D covers for diabetes (tier 3). $25 copay typical. Without coverage ~$900/mo. IRA negotiated price TBD.' },
      { name: 'Levothyroxine (Synthroid) [P1]', monthlyCost: 4, withoutInsurance: 15, coverageNote: 'Medicare Part D generic tier 1; $0-10 copay' },
      { name: 'Atorvastatin 20mg [P1]', monthlyCost: 4, withoutInsurance: 10, coverageNote: 'Medicare Part D generic tier 1; $0-10 copay' },
      { name: 'Montelukast (Singulair) [P1]', monthlyCost: 4, withoutInsurance: 15, coverageNote: 'Medicare Part D generic tier 1; $0-10 copay' },
      { name: 'Hydrochlorothiazide (HCTZ) [P1]', monthlyCost: 4, withoutInsurance: 8, coverageNote: 'Medicare Part D generic tier 1; $0-10 copay' },
      { name: 'Olmesartan/Medoxomil (Benicar) [P1]', monthlyCost: 10, withoutInsurance: 30, coverageNote: 'Medicare Part D generic tier 1-2; $4-15 copay' },
      { name: 'Albuterol inhaler [P1]', monthlyCost: 10, withoutInsurance: 35, coverageNote: 'Medicare Part D tier 2; $10-25 copay. IRA cap applies.' },
      { name: 'Metformin 500mg [P2]', monthlyCost: 4, withoutInsurance: 10, coverageNote: 'Medicare Part D generic tier 1; $0-10 copay' },
      { name: 'Allopurinol (gout) [P2]', monthlyCost: 4, withoutInsurance: 10, coverageNote: 'Medicare Part D generic tier 1; $0-10 copay' },
      { name: 'Lisinopril [P2]', monthlyCost: 4, withoutInsurance: 10, coverageNote: 'Medicare Part D generic tier 1; $0-10 copay' },
      { name: 'Topiramate (Topamax) [P2]', monthlyCost: 10, withoutInsurance: 25, coverageNote: 'Medicare Part D generic tier 1-2; $4-15 copay' },
      { name: 'Metoprolol (Lopressor) [P2]', monthlyCost: 4, withoutInsurance: 10, coverageNote: 'Medicare Part D generic tier 1; $0-10 copay' },
      { name: 'Atorvastatin 20mg [P2]', monthlyCost: 4, withoutInsurance: 10, coverageNote: 'Medicare Part D generic tier 1; $0-10 copay' },
    ],
    pharmacyAccess: 'CVS, Walgreens, Walmart, Kroger pharmacies widely available. $4 generic programs at Walmart/Kroger. Mail-order via OptumRx, Express Scripts, or Mark Cuban Cost Plus Drugs.',
    notes: 'US prices shown with Medicare Part D coverage. Without insurance, use GoodRx or Cost Plus Drugs for significant savings on generics. IRA Inflation Reduction Act caps insulin at $35/mo and out-of-pocket at $2,000/yr starting 2025.',
  },
  France: {
    monthlyPrescriptionCosts: { min: 29, typical: 36, max: 265 },
    commonMedications: [
      { name: 'Semaglutide / GLP-1 (Ozempic) [P1]', monthlyCost: 10, withoutInsurance: 220, coverageNote: 'Sécu reimburses 65% for diabetes indication; mutuelle covers rest. Without ALD, copay ~€10/mo.' },
      { name: 'Levothyroxine (Levothyrox) [P1]', monthlyCost: 2, withoutInsurance: 5, coverageNote: 'Fully reimbursed under Sécu (65%) + mutuelle' },
      { name: 'Atorvastatine 20mg [P1]', monthlyCost: 2, withoutInsurance: 8, coverageNote: 'Sécu 65% + mutuelle top-up' },
      { name: 'Montelukast (Singulair) [P1]', monthlyCost: 3, withoutInsurance: 12, coverageNote: 'Sécu 65% reimbursement' },
      { name: 'Hydrochlorothiazide [P1]', monthlyCost: 2, withoutInsurance: 4, coverageNote: 'Fully reimbursed generic' },
      { name: 'Olmesartan (Alteis/Olmetec) [P1]', monthlyCost: 3, withoutInsurance: 15, coverageNote: 'Sécu 65% + mutuelle' },
      { name: 'Salbutamol (Ventoline) [P1]', monthlyCost: 2, withoutInsurance: 4, coverageNote: 'Fully reimbursed under Sécu' },
      { name: 'Metformine 500mg [P2]', monthlyCost: 1, withoutInsurance: 4, coverageNote: 'Fully reimbursed generic' },
      { name: 'Allopurinol [P2]', monthlyCost: 2, withoutInsurance: 5, coverageNote: 'Sécu 65% reimbursement' },
      { name: 'Lisinopril (Zestril) [P2]', monthlyCost: 2, withoutInsurance: 6, coverageNote: 'Sécu 65% + mutuelle' },
      { name: 'Topiramate (Epitomax) [P2]', monthlyCost: 3, withoutInsurance: 15, coverageNote: 'Sécu 65% reimbursement' },
      { name: 'Metoprolol (Seloken) [P2]', monthlyCost: 2, withoutInsurance: 6, coverageNote: 'Sécu 65% + mutuelle' },
      { name: 'Atorvastatine 20mg [P2]', monthlyCost: 2, withoutInsurance: 8, coverageNote: 'Sécu 65% + mutuelle top-up' },
    ],
    pharmacyAccess: 'Pharmacies on nearly every block in French cities. Green cross signage. Pharmacists can dispense many medications with French prescription. EU prescriptions accepted.',
    notes: 'France Sécurité Sociale reimburses 65-100% of approved medications. With ALD (Affection Longue Durée) status for chronic conditions, reimbursement reaches 100%. Mutuelle (supplementary insurance) covers the rest. Prices shown are after typical Sécu + mutuelle reimbursement.',
  },
  Spain: {
    monthlyPrescriptionCosts: { min: 18, typical: 23, max: 224 },
    commonMedications: [
      { name: 'Semaglutida / GLP-1 (Ozempic) [P1]', monthlyCost: 8, withoutInsurance: 190, coverageNote: 'SNS covers for diabetes. Pensioners pay 10% capped at €8.23/mo per medication.' },
      { name: 'Levotiroxina (Eutirox) [P1]', monthlyCost: 1, withoutInsurance: 4, coverageNote: 'SNS reimbursed; pensioner copay minimal' },
      { name: 'Atorvastatina 20mg [P1]', monthlyCost: 1, withoutInsurance: 6, coverageNote: 'SNS reimbursed generic' },
      { name: 'Montelukast [P1]', monthlyCost: 2, withoutInsurance: 10, coverageNote: 'SNS reimbursed' },
      { name: 'Hidroclorotiazida [P1]', monthlyCost: 1, withoutInsurance: 3, coverageNote: 'SNS reimbursed generic' },
      { name: 'Olmesartan (Openvas) [P1]', monthlyCost: 2, withoutInsurance: 12, coverageNote: 'SNS reimbursed' },
      { name: 'Salbutamol (Ventolin) [P1]', monthlyCost: 1, withoutInsurance: 3, coverageNote: 'SNS reimbursed' },
      { name: 'Metformina 500mg [P2]', monthlyCost: 1, withoutInsurance: 3, coverageNote: 'SNS reimbursed generic' },
      { name: 'Alopurinol [P2]', monthlyCost: 1, withoutInsurance: 4, coverageNote: 'SNS reimbursed generic' },
      { name: 'Lisinopril [P2]', monthlyCost: 1, withoutInsurance: 5, coverageNote: 'SNS reimbursed' },
      { name: 'Topiramato [P2]', monthlyCost: 2, withoutInsurance: 12, coverageNote: 'SNS reimbursed' },
      { name: 'Metoprolol [P2]', monthlyCost: 1, withoutInsurance: 5, coverageNote: 'SNS reimbursed' },
      { name: 'Atorvastatina 20mg [P2]', monthlyCost: 1, withoutInsurance: 6, coverageNote: 'SNS reimbursed generic' },
    ],
    pharmacyAccess: 'Farmacias abundant in all Spanish cities. Green cross signage with rotating 24h duty pharmacies (farmacia de guardia). EU prescriptions accepted.',
    notes: 'Spain SNS (Sistema Nacional de Salud) covers most medications. Pensioners pay 10% copay capped at €8.23-18.52/mo depending on income. Non-residents need private insurance or pay full price. Prices shown assume resident/pensioner status.',
  },
  Portugal: {
    monthlyPrescriptionCosts: { min: 30, typical: 37, max: 243 },
    commonMedications: [
      { name: 'Semaglutido / GLP-1 (Ozempic) [P1]', monthlyCost: 12, withoutInsurance: 200, coverageNote: 'SNS covers for diabetes at 90% reimbursement. Without SNS ~€200/mo.' },
      { name: 'Levotiroxina [P1]', monthlyCost: 2, withoutInsurance: 5, coverageNote: 'SNS reimbursed 69-90%' },
      { name: 'Atorvastatina 20mg [P1]', monthlyCost: 2, withoutInsurance: 7, coverageNote: 'SNS reimbursed generic' },
      { name: 'Montelucaste [P1]', monthlyCost: 3, withoutInsurance: 12, coverageNote: 'SNS reimbursed 69%' },
      { name: 'Hidroclorotiazida [P1]', monthlyCost: 1, withoutInsurance: 4, coverageNote: 'SNS reimbursed generic' },
      { name: 'Olmesartan [P1]', monthlyCost: 3, withoutInsurance: 14, coverageNote: 'SNS reimbursed 69%' },
      { name: 'Salbutamol [P1]', monthlyCost: 2, withoutInsurance: 4, coverageNote: 'SNS reimbursed' },
      { name: 'Metformina 500mg [P2]', monthlyCost: 1, withoutInsurance: 3, coverageNote: 'SNS reimbursed generic' },
      { name: 'Alopurinol [P2]', monthlyCost: 2, withoutInsurance: 5, coverageNote: 'SNS reimbursed generic' },
      { name: 'Lisinopril [P2]', monthlyCost: 2, withoutInsurance: 6, coverageNote: 'SNS reimbursed' },
      { name: 'Topiramato [P2]', monthlyCost: 3, withoutInsurance: 14, coverageNote: 'SNS reimbursed' },
      { name: 'Metoprolol [P2]', monthlyCost: 2, withoutInsurance: 5, coverageNote: 'SNS reimbursed' },
      { name: 'Atorvastatina 20mg [P2]', monthlyCost: 2, withoutInsurance: 7, coverageNote: 'SNS reimbursed generic' },
    ],
    pharmacyAccess: 'Farmácias well-distributed in Portuguese cities with green cross signage. 24h pharmacies available in Lisbon and Porto. EU prescriptions accepted.',
    notes: 'Portugal SNS reimburses 15-90% depending on medication tier and pensioner status. Pensioners and low-income residents get higher reimbursement. Generic substitution is standard. Prices shown assume SNS enrollment.',
  },
  Panama: {
    monthlyPrescriptionCosts: { min: 383, typical: 479, max: 529 },
    commonMedications: [
      { name: 'Semaglutide / GLP-1 (Ozempic) [P1]', monthlyCost: 350, withoutInsurance: 350, coverageNote: 'No local insurance coverage for GLP-1. Cash price at Farmacia Arrocha or imported.' },
      { name: 'Levothyroxine (Synthroid) [P1]', monthlyCost: 8, withoutInsurance: 12, coverageNote: 'Available at local pharmacies, no prescription required for many medications' },
      { name: 'Atorvastatin 20mg [P1]', monthlyCost: 12, withoutInsurance: 18, coverageNote: 'Generic widely available' },
      { name: 'Montelukast [P1]', monthlyCost: 15, withoutInsurance: 20, coverageNote: 'Available at major pharmacies' },
      { name: 'Hydrochlorothiazide [P1]', monthlyCost: 6, withoutInsurance: 8, coverageNote: 'Inexpensive generic' },
      { name: 'Olmesartan [P1]', monthlyCost: 20, withoutInsurance: 30, coverageNote: 'Brand or generic available' },
      { name: 'Albuterol inhaler (Salbutamol) [P1]', monthlyCost: 8, withoutInsurance: 12, coverageNote: 'OTC at pharmacies' },
      { name: 'Metformin 500mg [P2]', monthlyCost: 6, withoutInsurance: 8, coverageNote: 'Inexpensive generic' },
      { name: 'Allopurinol [P2]', monthlyCost: 8, withoutInsurance: 12, coverageNote: 'Generic available' },
      { name: 'Lisinopril [P2]', monthlyCost: 8, withoutInsurance: 12, coverageNote: 'Generic available' },
      { name: 'Topiramate [P2]', monthlyCost: 18, withoutInsurance: 25, coverageNote: 'Available at major pharmacies' },
      { name: 'Metoprolol [P2]', monthlyCost: 8, withoutInsurance: 12, coverageNote: 'Generic available' },
      { name: 'Atorvastatin 20mg [P2]', monthlyCost: 12, withoutInsurance: 18, coverageNote: 'Generic widely available' },
    ],
    pharmacyAccess: 'Farmacia Arrocha (major chain), Metro Plus, and independent farmacias. Many medications available without prescription. Zona Libre in Colón offers discounted medications.',
    notes: 'Panama has no universal drug coverage for expats. CSS (Caja de Seguro Social) covers residents who contribute. Most expats pay cash. Pensionado visa holders get 15-25% pharmacy discounts. GLP-1 drugs are expensive as they must be imported.',
  },
  Mexico: {
    monthlyPrescriptionCosts: { min: 55, typical: 68, max: 385 },
    commonMedications: [
      { name: 'Semaglutida / GLP-1 (Ozempic) [P1]', monthlyCost: 280, withoutInsurance: 320, coverageNote: 'Available at Farmacias del Ahorro, Similares. No IMSS coverage for expats typically.' },
      { name: 'Levotiroxina [P1]', monthlyCost: 3, withoutInsurance: 6, coverageNote: 'Very inexpensive generic at Farmacia Similares' },
      { name: 'Atorvastatina 20mg [P1]', monthlyCost: 4, withoutInsurance: 8, coverageNote: 'Generic widely available, very affordable' },
      { name: 'Montelukast [P1]', monthlyCost: 5, withoutInsurance: 12, coverageNote: 'Generic available at most pharmacies' },
      { name: 'Hidroclorotiazida [P1]', monthlyCost: 2, withoutInsurance: 4, coverageNote: 'Inexpensive generic' },
      { name: 'Olmesartán [P1]', monthlyCost: 8, withoutInsurance: 18, coverageNote: 'Available at major pharmacy chains' },
      { name: 'Salbutamol (inhalador) [P1]', monthlyCost: 3, withoutInsurance: 6, coverageNote: 'OTC at pharmacies' },
      { name: 'Metformina 500mg [P2]', monthlyCost: 2, withoutInsurance: 4, coverageNote: 'Very inexpensive at Farmacia Similares' },
      { name: 'Alopurinol [P2]', monthlyCost: 3, withoutInsurance: 6, coverageNote: 'Generic available' },
      { name: 'Lisinopril [P2]', monthlyCost: 3, withoutInsurance: 6, coverageNote: 'Generic available' },
      { name: 'Topiramato [P2]', monthlyCost: 8, withoutInsurance: 18, coverageNote: 'Available at pharmacy chains' },
      { name: 'Metoprolol [P2]', monthlyCost: 3, withoutInsurance: 6, coverageNote: 'Generic available' },
      { name: 'Atorvastatina 20mg [P2]', monthlyCost: 4, withoutInsurance: 8, coverageNote: 'Generic widely available' },
    ],
    pharmacyAccess: 'Farmacias del Ahorro, Farmacias Similares (Dr. Simi — very affordable generics), Farmacias Guadalajara, Walmart pharmacy. Many medications available without prescription.',
    notes: 'Mexico offers very affordable generic medications. Farmacia Similares provides interchangeable generics at 50-80% below brand prices. IMSS (public insurance) available to residents for ~$500/yr but quality varies. Most expats use private pharmacies. GLP-1 drugs are expensive imports.',
  },
  Colombia: {
    monthlyPrescriptionCosts: { min: 40, typical: 52, max: 350 },
    commonMedications: [
      { name: 'Semaglutida / GLP-1 (Ozempic) [P1]', monthlyCost: 250, withoutInsurance: 300, coverageNote: 'EPS may cover for diabetes diagnosis. Otherwise cash at Droguería or imported.' },
      { name: 'Levotiroxina [P1]', monthlyCost: 2, withoutInsurance: 5, coverageNote: 'Very affordable generic' },
      { name: 'Atorvastatina 20mg [P1]', monthlyCost: 3, withoutInsurance: 7, coverageNote: 'Generic widely available' },
      { name: 'Montelukast [P1]', monthlyCost: 4, withoutInsurance: 10, coverageNote: 'Available at droguerías' },
      { name: 'Hidroclorotiazida [P1]', monthlyCost: 1, withoutInsurance: 3, coverageNote: 'Inexpensive generic' },
      { name: 'Olmesartán [P1]', monthlyCost: 6, withoutInsurance: 15, coverageNote: 'Available at pharmacy chains' },
      { name: 'Salbutamol (inhalador) [P1]', monthlyCost: 3, withoutInsurance: 5, coverageNote: 'Affordable at pharmacies' },
      { name: 'Metformina 500mg [P2]', monthlyCost: 1, withoutInsurance: 3, coverageNote: 'Very inexpensive generic' },
      { name: 'Alopurinol [P2]', monthlyCost: 2, withoutInsurance: 5, coverageNote: 'Generic available' },
      { name: 'Lisinopril [P2]', monthlyCost: 2, withoutInsurance: 5, coverageNote: 'Generic available' },
      { name: 'Topiramato [P2]', monthlyCost: 5, withoutInsurance: 14, coverageNote: 'Available at pharmacies' },
      { name: 'Metoprolol [P2]', monthlyCost: 2, withoutInsurance: 5, coverageNote: 'Generic available' },
      { name: 'Atorvastatina 20mg [P2]', monthlyCost: 3, withoutInsurance: 7, coverageNote: 'Generic widely available' },
    ],
    pharmacyAccess: 'Droguería La Rebaja, Farmatodo, Cruz Verde, Colsubsidio pharmacies throughout cities. Many generics available without prescription.',
    notes: 'Colombia EPS (public health insurance) covers most medications for enrolled residents (~$50-80/mo contribution). Expats with visa can enroll in EPS. Private insurance (medicina prepagada) also available. Generic prices are very low. GLP-1 drugs are expensive imports.',
  },
  'Costa Rica': {
    monthlyPrescriptionCosts: { min: 45, typical: 58, max: 370 },
    commonMedications: [
      { name: 'Semaglutida / GLP-1 (Ozempic) [P1]', monthlyCost: 270, withoutInsurance: 320, coverageNote: 'Not covered by CCSS typically. Cash price at private pharmacies.' },
      { name: 'Levotiroxina [P1]', monthlyCost: 3, withoutInsurance: 6, coverageNote: 'Available through CCSS or private pharmacies' },
      { name: 'Atorvastatina 20mg [P1]', monthlyCost: 4, withoutInsurance: 9, coverageNote: 'Generic available' },
      { name: 'Montelukast [P1]', monthlyCost: 5, withoutInsurance: 12, coverageNote: 'Available at pharmacies' },
      { name: 'Hidroclorotiazida [P1]', monthlyCost: 2, withoutInsurance: 4, coverageNote: 'CCSS formulary generic' },
      { name: 'Olmesartán [P1]', monthlyCost: 8, withoutInsurance: 18, coverageNote: 'Available at private pharmacies' },
      { name: 'Salbutamol (inhalador) [P1]', monthlyCost: 3, withoutInsurance: 6, coverageNote: 'CCSS formulary' },
      { name: 'Metformina 500mg [P2]', monthlyCost: 2, withoutInsurance: 4, coverageNote: 'CCSS formulary generic' },
      { name: 'Alopurinol [P2]', monthlyCost: 3, withoutInsurance: 6, coverageNote: 'Generic available' },
      { name: 'Lisinopril [P2]', monthlyCost: 3, withoutInsurance: 6, coverageNote: 'Generic available' },
      { name: 'Topiramato [P2]', monthlyCost: 8, withoutInsurance: 18, coverageNote: 'Available at pharmacies' },
      { name: 'Metoprolol [P2]', monthlyCost: 3, withoutInsurance: 6, coverageNote: 'CCSS formulary' },
      { name: 'Atorvastatina 20mg [P2]', monthlyCost: 4, withoutInsurance: 9, coverageNote: 'Generic available' },
    ],
    pharmacyAccess: 'Farmacia Fischel, Farmacia La Bomba, Walmart pharmacy, and CCSS (Caja) pharmacies for enrolled members. Private pharmacies in most towns.',
    notes: 'Costa Rica CCSS (Caja) provides universal healthcare including medications for enrolled residents (~7-11% of income). Legal residents must enroll. CCSS formulary covers most generics at no additional cost. Private pharmacies for non-formulary drugs.',
  },
  Ecuador: {
    monthlyPrescriptionCosts: { min: 35, typical: 45, max: 340 },
    commonMedications: [
      { name: 'Semaglutida / GLP-1 (Ozempic) [P1]', monthlyCost: 240, withoutInsurance: 290, coverageNote: 'Not typically covered by IESS. Cash price at private pharmacies.' },
      { name: 'Levotiroxina [P1]', monthlyCost: 2, withoutInsurance: 4, coverageNote: 'Very affordable generic' },
      { name: 'Atorvastatina 20mg [P1]', monthlyCost: 3, withoutInsurance: 6, coverageNote: 'Generic widely available' },
      { name: 'Montelukast [P1]', monthlyCost: 4, withoutInsurance: 10, coverageNote: 'Available at pharmacies' },
      { name: 'Hidroclorotiazida [P1]', monthlyCost: 1, withoutInsurance: 3, coverageNote: 'Inexpensive generic' },
      { name: 'Olmesartán [P1]', monthlyCost: 5, withoutInsurance: 14, coverageNote: 'Available at pharmacy chains' },
      { name: 'Salbutamol (inhalador) [P1]', monthlyCost: 2, withoutInsurance: 4, coverageNote: 'Affordable at pharmacies' },
      { name: 'Metformina 500mg [P2]', monthlyCost: 1, withoutInsurance: 3, coverageNote: 'Very inexpensive generic' },
      { name: 'Alopurinol [P2]', monthlyCost: 2, withoutInsurance: 4, coverageNote: 'Generic available' },
      { name: 'Lisinopril [P2]', monthlyCost: 2, withoutInsurance: 4, coverageNote: 'Generic available' },
      { name: 'Topiramato [P2]', monthlyCost: 5, withoutInsurance: 14, coverageNote: 'Available at pharmacies' },
      { name: 'Metoprolol [P2]', monthlyCost: 2, withoutInsurance: 4, coverageNote: 'Generic available' },
      { name: 'Atorvastatina 20mg [P2]', monthlyCost: 3, withoutInsurance: 6, coverageNote: 'Generic widely available' },
    ],
    pharmacyAccess: 'Fybeca, Pharmacys, Medicity, and Cruz Azul pharmacy chains. Generics widely available. Many medications sold without prescription.',
    notes: 'Ecuador IESS (public insurance) available to residents who contribute (~17.6% of declared income). Covers most formulary medications. Private pharmacies offer affordable generics. Ecuador uses USD so no currency risk. GLP-1 drugs are imported and expensive.',
  },
  Italy: {
    monthlyPrescriptionCosts: { min: 22, typical: 28, max: 235 },
    commonMedications: [
      { name: 'Semaglutide / GLP-1 (Ozempic) [P1]', monthlyCost: 10, withoutInsurance: 200, coverageNote: 'SSN covers for diabetes (Piano Terapeutico). Specialist prescription required.' },
      { name: 'Levotiroxina (Eutirox) [P1]', monthlyCost: 1, withoutInsurance: 5, coverageNote: 'SSN Class A — fully reimbursed' },
      { name: 'Atorvastatina 20mg [P1]', monthlyCost: 2, withoutInsurance: 7, coverageNote: 'SSN Class A — fully reimbursed, small regional copay possible' },
      { name: 'Montelukast [P1]', monthlyCost: 2, withoutInsurance: 10, coverageNote: 'SSN Class A reimbursed' },
      { name: 'Idroclorotiazide [P1]', monthlyCost: 1, withoutInsurance: 4, coverageNote: 'SSN Class A — fully reimbursed' },
      { name: 'Olmesartan (Olmetec) [P1]', monthlyCost: 2, withoutInsurance: 12, coverageNote: 'SSN Class A reimbursed' },
      { name: 'Salbutamolo (Ventolin) [P1]', monthlyCost: 1, withoutInsurance: 4, coverageNote: 'SSN Class A — fully reimbursed' },
      { name: 'Metformina 500mg [P2]', monthlyCost: 1, withoutInsurance: 4, coverageNote: 'SSN Class A — fully reimbursed' },
      { name: 'Allopurinolo [P2]', monthlyCost: 1, withoutInsurance: 4, coverageNote: 'SSN Class A — fully reimbursed' },
      { name: 'Lisinopril [P2]', monthlyCost: 1, withoutInsurance: 5, coverageNote: 'SSN Class A reimbursed' },
      { name: 'Topiramato [P2]', monthlyCost: 2, withoutInsurance: 12, coverageNote: 'SSN Class A reimbursed' },
      { name: 'Metoprololo (Lopresor) [P2]', monthlyCost: 1, withoutInsurance: 5, coverageNote: 'SSN Class A — fully reimbursed' },
      { name: 'Atorvastatina 20mg [P2]', monthlyCost: 2, withoutInsurance: 7, coverageNote: 'SSN Class A — fully reimbursed' },
    ],
    pharmacyAccess: 'Farmacie abundant in all Italian cities with green cross signage. Rotating 24h farmacia di turno system. EU prescriptions accepted. Parafarmacie sell OTC at lower prices.',
    notes: 'Italy SSN (Servizio Sanitario Nazionale) provides universal coverage. Class A medications (essential) are fully reimbursed with possible small regional copay (€1-4 per prescription). Residents enrolled in SSN pay based on income. EU health card (EHIC/GHIC) accepted for temporary stays.',
  },
  Greece: {
    monthlyPrescriptionCosts: { min: 20, typical: 26, max: 230 },
    commonMedications: [
      { name: 'Semaglutide / GLP-1 (Ozempic) [P1]', monthlyCost: 10, withoutInsurance: 195, coverageNote: 'EOPYY covers for diabetes with endocrinologist prescription' },
      { name: 'Λεβοθυροξίνη (Levothyroxine) [P1]', monthlyCost: 1, withoutInsurance: 4, coverageNote: 'EOPYY fully reimbursed' },
      { name: 'Atorvastatin 20mg [P1]', monthlyCost: 2, withoutInsurance: 6, coverageNote: 'EOPYY reimbursed generic' },
      { name: 'Montelukast [P1]', monthlyCost: 2, withoutInsurance: 10, coverageNote: 'EOPYY reimbursed' },
      { name: 'Hydrochlorothiazide [P1]', monthlyCost: 1, withoutInsurance: 3, coverageNote: 'EOPYY reimbursed generic' },
      { name: 'Olmesartan [P1]', monthlyCost: 2, withoutInsurance: 12, coverageNote: 'EOPYY reimbursed' },
      { name: 'Salbutamol (Ventolin) [P1]', monthlyCost: 1, withoutInsurance: 4, coverageNote: 'EOPYY reimbursed' },
      { name: 'Metformin 500mg [P2]', monthlyCost: 1, withoutInsurance: 3, coverageNote: 'EOPYY reimbursed generic' },
      { name: 'Allopurinol [P2]', monthlyCost: 1, withoutInsurance: 4, coverageNote: 'EOPYY reimbursed' },
      { name: 'Lisinopril [P2]', monthlyCost: 1, withoutInsurance: 5, coverageNote: 'EOPYY reimbursed' },
      { name: 'Topiramate [P2]', monthlyCost: 2, withoutInsurance: 12, coverageNote: 'EOPYY reimbursed' },
      { name: 'Metoprolol [P2]', monthlyCost: 1, withoutInsurance: 5, coverageNote: 'EOPYY reimbursed' },
      { name: 'Atorvastatin 20mg [P2]', monthlyCost: 2, withoutInsurance: 6, coverageNote: 'EOPYY reimbursed generic' },
    ],
    pharmacyAccess: 'Φαρμακεία (pharmacies) with green cross signage in all Greek cities and towns. Rotating 24h duty pharmacy system. EU prescriptions accepted.',
    notes: 'Greece EOPYY provides pharmaceutical coverage with 0-25% copay depending on medication category and patient status. Pensioners and chronic condition patients often pay 0-10%. Private pharmacies may charge slightly more than reference prices. EU EHIC card accepted.',
  },
  Croatia: {
    monthlyPrescriptionCosts: { min: 18, typical: 24, max: 225 },
    commonMedications: [
      { name: 'Semaglutide / GLP-1 (Ozempic) [P1]', monthlyCost: 10, withoutInsurance: 190, coverageNote: 'HZZO covers for diabetes with specialist prescription' },
      { name: 'Levotiroksin [P1]', monthlyCost: 1, withoutInsurance: 4, coverageNote: 'HZZO basic list — fully covered' },
      { name: 'Atorvastatin 20mg [P1]', monthlyCost: 1, withoutInsurance: 6, coverageNote: 'HZZO basic list generic' },
      { name: 'Montelukast [P1]', monthlyCost: 2, withoutInsurance: 10, coverageNote: 'HZZO supplementary list — small copay' },
      { name: 'Hidroklorotiazid [P1]', monthlyCost: 1, withoutInsurance: 3, coverageNote: 'HZZO basic list — fully covered' },
      { name: 'Olmesartan [P1]', monthlyCost: 2, withoutInsurance: 12, coverageNote: 'HZZO supplementary list' },
      { name: 'Salbutamol [P1]', monthlyCost: 1, withoutInsurance: 3, coverageNote: 'HZZO basic list' },
      { name: 'Metformin 500mg [P2]', monthlyCost: 1, withoutInsurance: 3, coverageNote: 'HZZO basic list — fully covered' },
      { name: 'Alopurinol [P2]', monthlyCost: 1, withoutInsurance: 4, coverageNote: 'HZZO basic list' },
      { name: 'Lizinopril [P2]', monthlyCost: 1, withoutInsurance: 5, coverageNote: 'HZZO basic list' },
      { name: 'Topiramat [P2]', monthlyCost: 2, withoutInsurance: 12, coverageNote: 'HZZO supplementary list' },
      { name: 'Metoprolol [P2]', monthlyCost: 1, withoutInsurance: 5, coverageNote: 'HZZO basic list' },
      { name: 'Atorvastatin 20mg [P2]', monthlyCost: 1, withoutInsurance: 6, coverageNote: 'HZZO basic list generic' },
    ],
    pharmacyAccess: 'Ljekarne (pharmacies) available in all Croatian cities. Rotating 24h duty pharmacy system. EU prescriptions accepted with some limitations.',
    notes: 'Croatia HZZO provides medication coverage through basic and supplementary lists. Basic list medications have no copay. Supplementary list has small copays. EU citizens can use EHIC. Temporary residents need private insurance or pay reference prices.',
  },
  Cyprus: {
    monthlyPrescriptionCosts: { min: 20, typical: 26, max: 230 },
    commonMedications: [
      { name: 'Semaglutide / GLP-1 (Ozempic) [P1]', monthlyCost: 10, withoutInsurance: 200, coverageNote: 'GHS (GESY) covers for diabetes with endocrinologist referral' },
      { name: 'Levothyroxine [P1]', monthlyCost: 1, withoutInsurance: 5, coverageNote: 'GHS reimbursed — €1 copay' },
      { name: 'Atorvastatin 20mg [P1]', monthlyCost: 1, withoutInsurance: 7, coverageNote: 'GHS reimbursed generic — €1 copay' },
      { name: 'Montelukast [P1]', monthlyCost: 2, withoutInsurance: 10, coverageNote: 'GHS reimbursed — €1 copay' },
      { name: 'Hydrochlorothiazide [P1]', monthlyCost: 1, withoutInsurance: 4, coverageNote: 'GHS reimbursed generic' },
      { name: 'Olmesartan [P1]', monthlyCost: 2, withoutInsurance: 13, coverageNote: 'GHS reimbursed' },
      { name: 'Salbutamol [P1]', monthlyCost: 1, withoutInsurance: 4, coverageNote: 'GHS reimbursed' },
      { name: 'Metformin 500mg [P2]', monthlyCost: 1, withoutInsurance: 3, coverageNote: 'GHS reimbursed generic — €1 copay' },
      { name: 'Allopurinol [P2]', monthlyCost: 1, withoutInsurance: 5, coverageNote: 'GHS reimbursed' },
      { name: 'Lisinopril [P2]', monthlyCost: 1, withoutInsurance: 5, coverageNote: 'GHS reimbursed' },
      { name: 'Topiramate [P2]', monthlyCost: 2, withoutInsurance: 12, coverageNote: 'GHS reimbursed' },
      { name: 'Metoprolol [P2]', monthlyCost: 1, withoutInsurance: 5, coverageNote: 'GHS reimbursed' },
      { name: 'Atorvastatin 20mg [P2]', monthlyCost: 1, withoutInsurance: 7, coverageNote: 'GHS reimbursed generic — €1 copay' },
    ],
    pharmacyAccess: 'Pharmacies in all Cypriot cities and towns. Both Greek-Cypriot pharmacies and international chains. EU prescriptions accepted.',
    notes: 'Cyprus GHS (GESY — General Healthcare System, launched 2019) provides universal coverage with €1 copay per prescription. Residents and EU citizens enrolled automatically. Private pharmacies may stock wider range. EU EHIC accepted.',
  },
  Ireland: {
    monthlyPrescriptionCosts: { min: 32, typical: 40, max: 275 },
    commonMedications: [
      { name: 'Semaglutide / GLP-1 (Ozempic) [P1]', monthlyCost: 12, withoutInsurance: 230, coverageNote: 'Covered under GMS medical card or Drugs Payment Scheme (€80/mo cap per family)' },
      { name: 'Levothyroxine (Eltroxin) [P1]', monthlyCost: 2, withoutInsurance: 8, coverageNote: 'GMS or DPS covered' },
      { name: 'Atorvastatin 20mg [P1]', monthlyCost: 2, withoutInsurance: 9, coverageNote: 'GMS or DPS; generic pricing applies' },
      { name: 'Montelukast (Singulair) [P1]', monthlyCost: 3, withoutInsurance: 14, coverageNote: 'GMS or DPS covered' },
      { name: 'Hydrochlorothiazide [P1]', monthlyCost: 2, withoutInsurance: 5, coverageNote: 'GMS or DPS — inexpensive generic' },
      { name: 'Olmesartan [P1]', monthlyCost: 3, withoutInsurance: 16, coverageNote: 'GMS or DPS covered' },
      { name: 'Salbutamol (Ventolin) [P1]', monthlyCost: 2, withoutInsurance: 6, coverageNote: 'GMS or DPS covered' },
      { name: 'Metformin 500mg [P2]', monthlyCost: 2, withoutInsurance: 5, coverageNote: 'GMS or DPS — inexpensive generic' },
      { name: 'Allopurinol [P2]', monthlyCost: 2, withoutInsurance: 6, coverageNote: 'GMS or DPS covered' },
      { name: 'Lisinopril [P2]', monthlyCost: 2, withoutInsurance: 7, coverageNote: 'GMS or DPS covered' },
      { name: 'Topiramate (Topamax) [P2]', monthlyCost: 3, withoutInsurance: 16, coverageNote: 'GMS or DPS covered' },
      { name: 'Metoprolol [P2]', monthlyCost: 2, withoutInsurance: 7, coverageNote: 'GMS or DPS covered' },
      { name: 'Atorvastatin 20mg [P2]', monthlyCost: 2, withoutInsurance: 9, coverageNote: 'GMS or DPS; generic pricing applies' },
    ],
    pharmacyAccess: 'Boots, LloydsPharmacy, and independent pharmacies throughout Ireland. Late-night pharmacies in cities. Prescription required for most medications.',
    notes: 'Ireland has the Drugs Payment Scheme (DPS) capping family medication costs at €80/month. Medical card holders (income-tested or over-70) pay nothing. Over-70s get automatic medical card. Prices shown assume DPS or medical card coverage.',
  },
  Malta: {
    monthlyPrescriptionCosts: { min: 20, typical: 26, max: 228 },
    commonMedications: [
      { name: 'Semaglutide / GLP-1 (Ozempic) [P1]', monthlyCost: 10, withoutInsurance: 195, coverageNote: 'GFL (Government Formulary List) covers for diabetes with specialist prescription' },
      { name: 'Levothyroxine [P1]', monthlyCost: 1, withoutInsurance: 5, coverageNote: 'GFL — free with pink card' },
      { name: 'Atorvastatin 20mg [P1]', monthlyCost: 2, withoutInsurance: 7, coverageNote: 'GFL — free with pink card' },
      { name: 'Montelukast [P1]', monthlyCost: 2, withoutInsurance: 10, coverageNote: 'GFL covered' },
      { name: 'Hydrochlorothiazide [P1]', monthlyCost: 1, withoutInsurance: 4, coverageNote: 'GFL — free with pink card' },
      { name: 'Olmesartan [P1]', monthlyCost: 2, withoutInsurance: 12, coverageNote: 'GFL covered' },
      { name: 'Salbutamol [P1]', monthlyCost: 1, withoutInsurance: 4, coverageNote: 'GFL — free with pink card' },
      { name: 'Metformin 500mg [P2]', monthlyCost: 1, withoutInsurance: 3, coverageNote: 'GFL — free with pink card' },
      { name: 'Allopurinol [P2]', monthlyCost: 1, withoutInsurance: 5, coverageNote: 'GFL covered' },
      { name: 'Lisinopril [P2]', monthlyCost: 1, withoutInsurance: 5, coverageNote: 'GFL covered' },
      { name: 'Topiramate [P2]', monthlyCost: 2, withoutInsurance: 12, coverageNote: 'GFL covered' },
      { name: 'Metoprolol [P2]', monthlyCost: 1, withoutInsurance: 5, coverageNote: 'GFL covered' },
      { name: 'Atorvastatin 20mg [P2]', monthlyCost: 2, withoutInsurance: 7, coverageNote: 'GFL — free with pink card' },
    ],
    pharmacyAccess: 'Pharmacies in all Maltese towns with rotating duty pharmacy system. Brown & Associates, Remedies, and independent pharmacies. EU prescriptions accepted.',
    notes: 'Malta provides free medications through the Government Formulary List (GFL) for residents with pink card (Schedule V for chronic conditions). EU citizens can access via EHIC. Private pharmacies charge reasonable prices for non-formulary items.',
  },
  Uruguay: {
    monthlyPrescriptionCosts: { min: 50, typical: 65, max: 380 },
    commonMedications: [
      { name: 'Semaglutida / GLP-1 (Ozempic) [P1]', monthlyCost: 280, withoutInsurance: 330, coverageNote: 'Limited FONASA/mutualista coverage. Cash price at pharmacies.' },
      { name: 'Levotiroxina [P1]', monthlyCost: 3, withoutInsurance: 6, coverageNote: 'FONASA mutualista covers with small copay' },
      { name: 'Atorvastatina 20mg [P1]', monthlyCost: 4, withoutInsurance: 8, coverageNote: 'Generic available, mutualista covered' },
      { name: 'Montelukast [P1]', monthlyCost: 5, withoutInsurance: 12, coverageNote: 'Mutualista covered' },
      { name: 'Hidroclorotiazida [P1]', monthlyCost: 2, withoutInsurance: 4, coverageNote: 'Inexpensive generic' },
      { name: 'Olmesartán [P1]', monthlyCost: 8, withoutInsurance: 18, coverageNote: 'Available at pharmacies' },
      { name: 'Salbutamol (inhalador) [P1]', monthlyCost: 3, withoutInsurance: 6, coverageNote: 'Mutualista covered' },
      { name: 'Metformina 500mg [P2]', monthlyCost: 2, withoutInsurance: 4, coverageNote: 'Inexpensive generic, FONASA covered' },
      { name: 'Alopurinol [P2]', monthlyCost: 3, withoutInsurance: 6, coverageNote: 'Generic available' },
      { name: 'Lisinopril [P2]', monthlyCost: 3, withoutInsurance: 6, coverageNote: 'Generic available' },
      { name: 'Topiramato [P2]', monthlyCost: 8, withoutInsurance: 18, coverageNote: 'Available at pharmacies' },
      { name: 'Metoprolol [P2]', monthlyCost: 3, withoutInsurance: 6, coverageNote: 'Generic available' },
      { name: 'Atorvastatina 20mg [P2]', monthlyCost: 4, withoutInsurance: 8, coverageNote: 'Generic available' },
    ],
    pharmacyAccess: 'Farmashop, Farmacia San Roque, and independent farmacias. Prescription required for most medications. Generics available but selection smaller than larger Latin American markets.',
    notes: 'Uruguay FONASA provides healthcare through mutualistas (private non-profit providers). Legal residents must enroll (4.5-8% of income). Medication coverage varies by mutualista plan. Uruguay is more expensive than other Latin American countries.',
  },
};

// Process all locations
const dirs = fs.readdirSync(DATA_DIR).filter(d =>
  fs.statSync(path.join(DATA_DIR, d)).isDirectory()
);

let created = 0;
let updated = 0;
let skipped = 0;

for (const dir of dirs) {
  const locPath = path.join(DATA_DIR, dir, 'location.json');
  const dcPath = path.join(DATA_DIR, dir, 'detailed-costs.json');

  if (!fs.existsSync(locPath)) continue;

  const loc = JSON.parse(fs.readFileSync(locPath, 'utf-8'));
  const country = loc.country;

  const template = MEDICINE_TEMPLATES[country];
  if (!template) {
    console.log(`  ⚠ ${dir}: no template for country "${country}" — skipping`);
    skipped++;
    continue;
  }

  const medicine = {
    monthlyPrescriptionCosts: template.monthlyPrescriptionCosts,
    commonMedications: template.commonMedications,
    pharmacyAccess: template.pharmacyAccess,
    notes: template.notes,
  };

  if (fs.existsSync(dcPath)) {
    // Update existing detailed-costs.json
    const dc = JSON.parse(fs.readFileSync(dcPath, 'utf-8'));
    const existingMeds = dc.medicine?.commonMedications?.length || 0;
    if (existingMeds >= 13) {
      console.log(`  ✓ ${dir}: already has ${existingMeds} meds — skipping`);
      skipped++;
      continue;
    }
    dc.medicine = medicine;
    fs.writeFileSync(dcPath, JSON.stringify(dc, null, 2) + '\n', 'utf-8');
    console.log(`  ↑ ${dir}: updated ${existingMeds} → 13 meds`);
    updated++;
  } else {
    // Create new detailed-costs.json with medicine only
    const dc = { medicine };
    fs.writeFileSync(dcPath, JSON.stringify(dc, null, 2) + '\n', 'utf-8');
    console.log(`  + ${dir}: created detailed-costs.json with 13 meds`);
    created++;
  }
}

console.log(`\nDone: ${created} created, ${updated} updated, ${skipped} skipped`);
