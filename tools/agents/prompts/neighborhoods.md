# Agent: {{AGENT_LABEL}}
# Tab(s): {{TAB_IDS}}
# Run Date: {{RUN_DATE}}
# Locations: {{LOCATIONS_SCOPE}}

## Household Context
{{HOUSEHOLD_PROFILE_BLOCK}}

## Current Data
{{CURRENT_DATA_BLOCK}}

## Research Task

You are the neighborhoods agent. Research 4-6 neighborhoods per city/location suitable for a retired couple with a large dog. Focus on walkability, safety, access to services, dog-friendliness, and expat community presence.

### What to Research Per Neighborhood

1. **Name** — Neighborhood or commune/barrio name
2. **Housing** — Typical 2BR house rental range, housing stock description
3. **Walkability** — Walk Score or equivalent (1-10), pedestrian infrastructure, sidewalks, hills
4. **Safety** — Crime rate relative to city average, neighborhood feel, nighttime safety
5. **Dog-friendliness** — Parks, off-leash areas, pet stores, vet proximity, dog culture
6. **Expat community** — Size and activity of English-speaking expat community, if any
7. **Transit access** — Proximity to public transit (Metro, bus, tram)
8. **Grocery access** — Walking distance to supermarket or market
9. **Healthcare access** — Distance to nearest hospital or medical center
10. **Character** — Brief description of neighborhood vibe (quiet residential, vibrant urban, etc.)

### Selection Criteria for Neighborhoods

Choose neighborhoods that:
- Are realistic for retirees (not student areas or nightlife districts)
- Have housing available in the 2BR house rental range
- Are dog-friendly (parks, green space, tolerant of large dogs)
- Mix affordable and mid-range options (not all luxury or all budget)
- Are accessible (not isolated rural areas unless that is the location's nature, e.g., Boquete)

### Country-Specific Guidance

**US locations**: Use Walk Score (walkscore.com) for walkability data. NeighborhoodScout or Niche.com for safety ratings. Include at least one suburban and one more urban/walkable option per location.

**France locations**: French communes/quartiers. Use ViaMichelin or city websites. France generally has excellent walkability. Include both city-center and periphery options.

**Spain (Alicante)**: Include Costa Blanca coastal and inland neighborhoods. Playa de San Juan, El Campello, Alicante Centro, Villajoyosa, etc.

**Portugal (Lisbon/Algarve)**: Include both Lisbon neighborhoods (if applicable) and Algarve towns (Lagos, Faro, Tavira, Albufeira). Note that the location covers a region.

**Panama**: Panama City neighborhoods (El Cangrejo, Clayton, Costa del Este, San Francisco). Boquete neighborhoods/areas (Alto Boquete, Bajo Mono, Valle Escondido, central Boquete).

### Change Detection

Mark `changed: true` if any neighborhood was added/removed, or if housing costs changed by more than 5%.

## Sources to Check
{{SOURCES_BLOCK}}

### Default Sources
**US**: WalkScore.com, Niche.com, NeighborhoodScout.com, Redfin.com (neighborhood guides)
**France**: DataGouv.fr (crime stats), ViaMichelin.fr, city official websites, Numbeo.com
**Spain**: Idealista.com (barrio data), INE.es, local government websites
**Portugal**: Idealista.pt, INE.pt, local camara municipal websites
**Panama**: Encuentra24.com, expat forums, InternationalLiving.com, local real estate agents

## Output Format

```json
{
  "agentId": "neighborhoods",
  "runDate": "{{RUN_DATE}}",
  "locations": [
    {
      "locationId": "us-virginia",
      "changed": true,
      "confidence": "high",
      "data": {
        "neighborhoods": [
          {
            "name": "Fairfax City",
            "housing": {
              "typical2BRRent": 2600,
              "range": "2200-3000",
              "currency": "USD",
              "stockDescription": "Mix of older single-family homes and townhouses"
            },
            "walkability": {
              "score": 6,
              "notes": "Old Town Fairfax walkable; outer areas car-dependent"
            },
            "safety": {
              "rating": 8,
              "notes": "Low crime, safe for walking day and night"
            },
            "dogFriendliness": {
              "score": 7,
              "parks": ["Van Dyck Park", "Daniels Run Park"],
              "offLeash": "Fairfax Dog Park (Blake Lane)",
              "notes": "Dog-friendly community, many walking trails"
            },
            "expatCommunity": {
              "size": "N/A (domestic)",
              "notes": "Diverse international community due to DC proximity"
            },
            "transitAccess": "Fairfax Connector bus; Vienna Metro ~10 min drive",
            "groceryAccess": "Harris Teeter, Trader Joe's within 1 mile",
            "healthcareAccess": "Inova Fairfax Hospital 3 miles",
            "character": "Quiet suburban with historic Old Town center"
          }
        ]
      },
      "sources": []
    }
  ]
}
```

For EUR locations, add `_usd` fields to housing costs.

Return ONLY valid JSON matching the schema. No prose, no markdown fences.
