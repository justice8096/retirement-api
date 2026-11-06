You are refreshing cost-of-living data for a retirement planner. Today is {TODAY}. Your locations: {IDS}.

Input: for each id, read {INPUT_DIR}/<id>.json. It holds the location name, country, currency, exchangeRate (local units per 1 USD) and the stored monthlyCosts (each category has min/typical/max and often notes). Values are in the location's own currency (EUR locations are in EUR, everything else USD unless the file says otherwise). Keep that currency in your output.

Household: 2 adults age 60, retiring in 2027, one large dog (Bernese Mountain Dog, ~100 lb), pet-friendly 2-3BR home, wants fast internet. In non-US countries they are legal-resident retirees (not citizens).

Research these categories for each location: rent, groceries, utilities, healthcare, insurance, petCare, petDaycare, petGrooming, transportation, entertainment, clothing, personalCare, phoneCell, medicalOOP. US locations only: also healthcarePreMedicare. Do NOT touch subscriptions, miscellaneous, buffer, taxes, medicine.

Definitions (keep each category's existing meaning as described in its stored notes where those are clear):
- rent: pet-friendly 2-3BR house or apartment typical of the area incl. tenant-paid fees.
- groceries: 2 adults plus food for a 100 lb dog. BASKET RULE: if the stored buffer typical is 800 (the household's detailed model) treat groceries as a household basket: only check whether local food CPI moved more than 10% since spring 2026; if not, return the stored value with verified:false and note "basket model kept".
- utilities: electricity, heating fuel/gas, water, sewer, trash. EXCLUDE internet.
- healthcare: US: Medicare-era cost for two = Part B x2 (use the 2026 standard $202.90; 2027 not yet published) + Medigap Plan G x2 for that state + Part D x2. Elsewhere: what a resident retiree couple age 60 actually pays for health coverage (public-system contributions available to residents plus the private or top-up cover expats there typically carry), monthly total for two.
- healthcarePreMedicare (US only): 2027 ACA marketplace premium for two 60-year-olds in that county, unsubsidized; typical = benchmark silver. 2027 rates are published (open enrollment began Nov 1 2026).
- insurance: renters/contents insurance only (US: renters policy; hurricane-zone notes OK). OLD-TEMPLATE RULE: if stored insurance typical is above ~100 it came from an old template where it meant health insurance; re-model it to renters/contents and make sure healthcare carries the full health-coverage cost.
- petCare: vet, vaccines, preventives for a large dog (not food). petDaycare: occasional daycare/boarding. petGrooming: large double-coated dog. All monthly averages.
- transportation: realistic for the place: one car (fuel, insurance, maintenance, registration/taxes) and/or transit passes (note senior passes).
- entertainment: home internet (fastest common plan) + streaming + dining out for 2 a few times a month + activities.
- clothing, personalCare, phoneCell (2 lines, local carriers), medicalOOP (out-of-pocket care beyond premiums).

Method: WebSearch (mode standard; extended when thin) and WebFetch. Prefer national statistics offices, regulators, utility tariff pages, insurer/carrier price pages, listing sites (Zillow/Zumper/Rentometer in the US; Idealista, SeLoger, Daft, Spitogatos, Inmuebles24, Encuentra24, FincaRaiz, Plusvalia etc. elsewhere), KFF/healthcare.gov for ACA, Numbeo/Expatistan/Live and Invest Overseas/International Living 2025-2026 guides as corroboration. Reuse a national figure across your locations when it is truly national (e.g. carrier plan prices, national health premiums), but research rent, utilities and transportation per location.

Hard rules: never invent numbers. A value marked verified must cite at least one real URL you actually saw. If you cannot verify, return the stored value with "verified": false (for an old-template insurance re-model use a small renters placeholder with verified:false). min <= typical <= max, whole numbers. ASCII only, no em dashes or smart quotes.

Output: write ONE file with the Write tool at {OUTPUT_FILE} containing ONLY this JSON:
{"locations":[{"id":"...","currency":"USD or EUR","categories":{"rent":{"min":0,"typical":0,"max":0,"verified":true,"notes":"1-2 sentences on basis","sources":[{"title":"...","url":"https://...","accessed":"{TODAY}"}]}, ...},"dataQualityFlags":["..."]}]}
Then validate it parses (python3 -c "import json;json.load(open('...'))"). Your final reply must be ONE line only: "<file> written: <id> <old typical total>-><new typical total>, ..." (totals over the categories you returned). Do not paste the JSON in your reply.
