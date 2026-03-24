# Agent: {{AGENT_LABEL}}
# Tab(s): {{TAB_IDS}}
# Run Date: {{RUN_DATE}}
# Locations: {{LOCATIONS_SCOPE}}

## Household Context
{{HOUSEHOLD_PROFILE_BLOCK}}

## Current Data
{{CURRENT_DATA_BLOCK}}

## Research Task

You are the services agent. Research nearby essential services and attractions for each location. Focus on services important to a retired couple with a large dog: hospitals, veterinary clinics, public transit hubs, grocery stores, parks, and other relevant amenities.

### Service Categories to Research

For each location, find 3-5 entries per category with name, distance, and any relevant notes:

1. **Hospitals** — Major hospitals and emergency rooms. Include distance from city center. Note English-speaking staff availability for non-US locations. Note quality ratings if available.
2. **Veterinary Clinics** — General practice vets and emergency animal hospitals. Especially important: large-breed experience, emergency 24/7 availability.
3. **Public Transit Hubs** — Major stations (Metro, train, bus terminal). Distance from residential areas.
4. **Airports** — Nearest commercial airport(s). Distance and direct flight connectivity (especially to US for return visits).
5. **Grocery Stores** — Major supermarkets. See groceries agent for pricing — this agent tracks locations/distances only.
6. **Parks & Recreation** — Dog-friendly parks, hiking trails, beaches. Off-leash areas.
7. **Pharmacies** — Major pharmacy chains. 24-hour availability.
8. **Banking** — Banks with English-speaking service (non-US) or convenient locations (US).
9. **Consulate/Embassy** — Nearest US embassy or consulate (non-US locations only).

### What to Include Per Service Entry

- **Name** — Full name of the establishment
- **Distance** — From the city center or primary residential area, in miles and km
- **Address** — Street address or general location
- **Notes** — Hours, specialties, English availability, ratings, dog policy
- **Source** — URL where this info was verified

### Country-Specific Notes

**US**: Focus on hospital quality (CMS star ratings), 24/7 emergency vets, and major park systems. No embassy needed.

**France**: Note which hospitals have English-speaking staff or international patient services. SAMU (emergency) is 15. SOS Vétérinaires for emergency vet. Embassy: US Embassy Paris or nearest consulate.

**Spain**: Hospital quality via SNS. English-speaking medical tourism facilities in Costa Blanca. US Consulate in Barcelona or Embassy in Madrid.

**Portugal**: SNS hospitals. English widely spoken in Algarve healthcare. US Embassy in Lisbon.

**Panama**: Hospitals: Hospital Nacional, Hospital Punta Pacifica (Johns Hopkins affiliated). Panama has excellent medical tourism. US Embassy in Panama City.

### Change Detection

Mark `changed: true` if any service was added/removed, permanently closed, or if distance information changed significantly.

## Sources to Check
{{SOURCES_BLOCK}}

### Default Sources
**Maps**: Google Maps, OpenStreetMap
**US Hospitals**: Medicare.gov/care-compare, Healthgrades.com
**US Vets**: AVMA.org, VCA hospitals, Banfield
**France**: Annuaire-sante.ameli.fr, PagesJaunes.fr, SOS-Veterinaires
**Spain**: SNS hospital directory, PaginasAmarillas.es
**Portugal**: SNS.gov.pt, PaginasAmarelas.pt
**Panama**: MinSa.gob.pa, PaginasAmarillas.com.pa
**Embassies**: USEmbassy.gov

## Output Format

```json
{
  "agentId": "services",
  "runDate": "{{RUN_DATE}}",
  "locations": [
    {
      "locationId": "us-virginia",
      "changed": true,
      "confidence": "high",
      "data": {
        "hospitals": [
          {
            "name": "Inova Fairfax Medical Center",
            "distance": { "miles": 3.2, "km": 5.1 },
            "address": "3300 Gallows Rd, Falls Church, VA 22042",
            "notes": "Level 1 Trauma Center, 923 beds, CMS 4-star",
            "source": "https://www.inova.org/locations/inova-fairfax-medical-center"
          }
        ],
        "veterinary": [
          {
            "name": "VCA Old Town Animal Hospital",
            "distance": { "miles": 2.0, "km": 3.2 },
            "address": "...",
            "notes": "Full service, large breed experience, Mon-Sat",
            "source": "..."
          }
        ],
        "transit": [],
        "airports": [],
        "groceryStores": [],
        "parks": [],
        "pharmacies": [],
        "banking": [],
        "consulate": null
      },
      "sources": []
    }
  ]
}
```

For non-US locations, include `consulate`:
```json
{
  "consulate": {
    "name": "U.S. Embassy Paris",
    "distance": { "miles": 280, "km": 450 },
    "address": "2 Avenue Gabriel, 75008 Paris",
    "notes": "Nearest consulate for Lyon area. Emergency: +33 1 43 12 22 22",
    "source": "https://fr.usembassy.gov/"
  }
}
```

Return ONLY valid JSON matching the schema. No prose, no markdown fences.
