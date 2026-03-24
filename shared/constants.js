export const CURRENT_YEAR = 2026;

export const COLORS = ['#D4943A', '#2A7B7B', '#5C9CE6', '#9C6FDE', '#4CAF50', '#E57373', '#E8B86D', '#3AA0A0'];

export const CAT_COLORS = {
  rent: '#D4943A', groceries: '#2A7B7B', utilities: '#5C9CE6', healthcare: '#E57373',
  insurance: '#9C6FDE', petCare: '#4CAF50', petDaycare: '#66BB6A', petGrooming: '#81C784',
  transportation: '#E8B86D', entertainment: '#3AA0A0', clothing: '#7E57C2',
  personalCare: '#AB47BC', subscriptions: '#5C6BC0', phoneCell: '#42A5F5',
  miscellaneous: '#5A6F94', taxes: '#EF5350', medicalOOP: '#FF7043', buffer: '#F39C12',
};

export const PROJ_CAT_LABELS = {
  rent: 'Rent', groceries: 'Groceries', utilities: 'Utilities', healthcare: 'Healthcare',
  insurance: 'Insurance', petCare: 'Pet Care', petDaycare: 'Pet Daycare/Sitter', petGrooming: 'Pet Grooming',
  transportation: 'Transport', entertainment: 'Entertainment', clothing: 'Clothing',
  personalCare: 'Personal Care', subscriptions: 'Subscriptions', phoneCell: 'Cell Phone',
  miscellaneous: 'Misc', taxes: 'Taxes', medicalOOP: 'Medical OOP', buffer: 'Buffer',
};

export const COST_CATEGORIES = [
  { key: 'rent', label: 'Rent', defaultInflation: 0.035 },
  { key: 'groceries', label: 'Groceries', defaultInflation: 0.03 },
  { key: 'utilities', label: 'Utilities', defaultInflation: 0.03 },
  { key: 'healthcare', label: 'Healthcare', defaultInflation: 0.05 },
  { key: 'insurance', label: 'Insurance', defaultInflation: 0.04 },
  { key: 'petCare', label: 'Pet Care', defaultInflation: 0.03 },
  { key: 'petDaycare', label: 'Pet Daycare/Sitter', defaultInflation: 0.03 },
  { key: 'petGrooming', label: 'Pet Grooming', defaultInflation: 0.03 },
  { key: 'transportation', label: 'Transportation', defaultInflation: 0.03 },
  { key: 'entertainment', label: 'Entertainment', defaultInflation: 0.025 },
  { key: 'clothing', label: 'Clothing', defaultInflation: 0.02 },
  { key: 'personalCare', label: 'Personal Care', defaultInflation: 0.025 },
  { key: 'subscriptions', label: 'Subscriptions', defaultInflation: 0.03 },
  { key: 'phoneCell', label: 'Cell Phone', defaultInflation: 0.02 },
  { key: 'miscellaneous', label: 'Miscellaneous', defaultInflation: 0.025 },
  { key: 'taxes', label: 'Taxes', defaultInflation: 0.02 },
  { key: 'medicalOOP', label: 'Medical Deductible/Copays', defaultInflation: 0.05 },
  { key: 'buffer', label: 'Monthly Buffer', defaultInflation: 0.025 },
];

export const TAB_CONFIG = [
  { id: 'overview', label: 'Overview', path: '/overview' },
  { id: 'compare', label: 'Compare', path: '/compare' },
  { id: 'projections', label: 'Projections', path: '/projections' },
  { id: 'montecarlo', label: 'Monte Carlo', path: '/montecarlo', lazy: true },
  { id: 'scenarios', label: 'Scenarios', path: '/scenarios' },
  { id: 'sssimulator', label: 'SS Benefits', path: '/ss-benefits' },
  { id: 'neighborhoods', label: 'Neighborhoods', path: '/neighborhoods', lazy: true },
  { id: 'services', label: 'Services', path: '/services', lazy: true },
  { id: 'inclusion', label: 'Inclusion', path: '/inclusion', lazy: true },
  { id: 'visiondental', label: 'Vision & Dental', path: '/vision-dental' },
  { id: 'entertainment', label: 'Entertainment', path: '/entertainment' },
  { id: 'transportation', label: 'Transportation', path: '/transportation' },
  { id: 'medicine', label: 'Medicine', path: '/medicine' },
  { id: 'groceries', label: 'Groceries', path: '/groceries' },
  { id: 'taxes', label: 'Taxes', path: '/taxes' },
  { id: 'cellphones', label: 'Cell Phones', path: '/cell-phones' },
  { id: 'housing', label: 'Housing', path: '/housing' },
  { id: 'personalcare', label: 'Personal Care', path: '/personal-care' },
  { id: 'localinfo', label: 'Local Info', path: '/local-info' },
  { id: 'brochure', label: 'Brochures', path: '/brochure' },
  { id: 'manage', label: 'Manage Locations', path: '/manage' },
];
