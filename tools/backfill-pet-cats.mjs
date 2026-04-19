/**
 * One-off: add missing petDaycare + petGrooming categories to locations that
 * were added without them. Matches the pattern used on sibling Mid-Atlantic
 * locations.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const targets = [
  {
    id: 'us-annapolis-md',
    petDaycare: { min: 310, max: 490, typical: 395, annualInflation: 0.035, notes: 'Doggy daycare 2 days/week. Similar to Fairfax-area pricing.' },
    petGrooming: { min: 85, max: 160, typical: 120, annualInflation: 0.03, notes: 'Professional grooming monthly.' },
  },
  {
    id: 'us-gainesville-va',
    petDaycare: { min: 305, max: 475, typical: 385, annualInflation: 0.035, notes: 'Doggy daycare 2 days/week. PWC area, slightly below Fairfax.' },
    petGrooming: { min: 80, max: 150, typical: 115, annualInflation: 0.03, notes: 'Professional grooming monthly.' },
  },
  {
    id: 'us-camden-nj',
    petDaycare: { min: 270, max: 440, typical: 350, annualInflation: 0.035, notes: 'South NJ pricing — below NOVA averages.' },
    petGrooming: { min: 75, max: 140, typical: 105, annualInflation: 0.03, notes: 'Professional grooming monthly.' },
  },
];

for (const t of targets) {
  const path = join(__dirname, '..', 'data', 'locations', t.id, 'location.json');
  const loc = JSON.parse(readFileSync(path, 'utf-8'));
  if (!loc.monthlyCosts.petDaycare) loc.monthlyCosts.petDaycare = t.petDaycare;
  if (!loc.monthlyCosts.petGrooming) loc.monthlyCosts.petGrooming = t.petGrooming;
  writeFileSync(path, JSON.stringify(loc, null, 2) + '\n', 'utf-8');
  console.log(`  ✓ ${t.id}`);
}
