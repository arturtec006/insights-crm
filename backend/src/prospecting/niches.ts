// Maps a niche typed in Portuguese onto the OpenStreetMap tags that actually
// describe it. OSM tagging is a controlled vocabulary, not free text, so this
// table is what makes "clinica odontologica" find anything at all.
//
// Only categories that OSM covers well are listed — local businesses with a
// physical address. Service businesses that rarely have a storefront (agencies,
// consultancies) are deliberately absent: OSM barely maps them, and pretending
// otherwise would return empty results with no explanation.

export interface NicheDefinition {
  id: string;
  label: string;
  /** OSM tag filters; each entry becomes one query clause, OR-ed together. */
  tags: string[];
  /** Extra words that should match this niche when typed. */
  aliases: string[];
}

export const NICHES: NicheDefinition[] = [
  { id: "dentist", label: "Clínica odontológica / Dentista", tags: ["amenity=dentist", "healthcare=dentist"], aliases: ["dentista", "odontologia", "odontologica", "consultorio odontologico"] },
  { id: "clinic", label: "Clínica médica / Consultório", tags: ["amenity=clinic", "amenity=doctors", "healthcare=centre"], aliases: ["clinica", "medico", "consultorio", "clinica medica"] },
  { id: "veterinary", label: "Clínica veterinária", tags: ["amenity=veterinary"], aliases: ["veterinario", "veterinaria", "pet clinica"] },
  { id: "physiotherapy", label: "Fisioterapia", tags: ["healthcare=physiotherapist"], aliases: ["fisioterapeuta", "fisio"] },
  { id: "psychology", label: "Psicologia", tags: ["healthcare=psychotherapist", "healthcare=psychologist"], aliases: ["psicologo", "psicologa", "terapia"] },
  { id: "pharmacy", label: "Farmácia", tags: ["amenity=pharmacy"], aliases: ["drogaria", "farmacia"] },
  { id: "gym", label: "Academia", tags: ["leisure=fitness_centre", "leisure=sports_centre"], aliases: ["academia", "musculacao", "crossfit", "pilates"] },
  { id: "hairdresser", label: "Salão de beleza / Barbearia", tags: ["shop=hairdresser", "shop=beauty"], aliases: ["salao", "cabeleireiro", "barbearia", "barbeiro", "estetica", "manicure"] },
  { id: "pet", label: "Pet shop", tags: ["shop=pet", "shop=pet_grooming"], aliases: ["petshop", "pet shop", "banho e tosa"] },
  { id: "restaurant", label: "Restaurante", tags: ["amenity=restaurant"], aliases: ["restaurante", "comida"] },
  { id: "fast_food", label: "Lanchonete / Fast food", tags: ["amenity=fast_food"], aliases: ["lanchonete", "hamburgueria", "pastelaria", "fast food"] },
  { id: "cafe", label: "Cafeteria", tags: ["amenity=cafe"], aliases: ["cafeteria", "cafe", "doceria"] },
  { id: "bar", label: "Bar", tags: ["amenity=bar", "amenity=pub"], aliases: ["bar", "pub", "boteco"] },
  { id: "bakery", label: "Padaria", tags: ["shop=bakery"], aliases: ["padaria", "confeitaria"] },
  { id: "car_repair", label: "Oficina mecânica", tags: ["shop=car_repair"], aliases: ["oficina", "mecanica", "auto center", "funilaria"] },
  { id: "car_parts", label: "Autopeças", tags: ["shop=car_parts"], aliases: ["autopecas", "auto pecas"] },
  { id: "clothes", label: "Loja de roupas", tags: ["shop=clothes", "shop=boutique"], aliases: ["roupas", "boutique", "moda"] },
  { id: "optician", label: "Ótica", tags: ["shop=optician"], aliases: ["otica", "oculos"] },
  { id: "supermarket", label: "Supermercado / Mercado", tags: ["shop=supermarket", "shop=convenience"], aliases: ["supermercado", "mercado", "mercearia"] },
  { id: "hotel", label: "Hotel / Pousada", tags: ["tourism=hotel", "tourism=guest_house", "tourism=motel"], aliases: ["hotel", "pousada", "hospedagem"] },
  { id: "school", label: "Escola / Curso", tags: ["amenity=school", "amenity=language_school", "amenity=driving_school"], aliases: ["escola", "curso", "autoescola", "idiomas"] },
  { id: "lawyer", label: "Escritório de advocacia", tags: ["office=lawyer"], aliases: ["advogado", "advocacia", "juridico"] },
  { id: "accountant", label: "Contabilidade", tags: ["office=accountant"], aliases: ["contador", "contabilidade", "escritorio contabil"] },
  { id: "estate_agent", label: "Imobiliária", tags: ["office=estate_agent"], aliases: ["imobiliaria", "corretor"] },
  { id: "florist", label: "Floricultura", tags: ["shop=florist"], aliases: ["floricultura", "flores"] },
  { id: "furniture", label: "Loja de móveis", tags: ["shop=furniture"], aliases: ["moveis", "moveis planejados"] },
  { id: "hardware", label: "Material de construção", tags: ["shop=hardware", "shop=doityourself", "shop=trade"], aliases: ["material de construcao", "ferragens", "construcao"] },
  { id: "laundry", label: "Lavanderia", tags: ["shop=laundry", "shop=dry_cleaning"], aliases: ["lavanderia"] },
  { id: "jewelry", label: "Joalheria", tags: ["shop=jewelry"], aliases: ["joalheria", "joias", "relojoaria"] },
  { id: "bicycle", label: "Bicicletaria", tags: ["shop=bicycle"], aliases: ["bicicletaria", "bike"] },
];

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Resolve free text onto a niche. Matching is deliberately generous — exact id,
 * then label, then any alias, then a substring of either — because the user
 * types what the business is called, not an OSM tag.
 */
export function resolveNiche(query: string): NicheDefinition | null {
  const q = fold(query);
  if (!q) return null;

  for (const niche of NICHES) {
    if (niche.id === q) return niche;
    if (fold(niche.label) === q) return niche;
    if (niche.aliases.some((a) => fold(a) === q)) return niche;
  }
  for (const niche of NICHES) {
    if (niche.aliases.some((a) => q.includes(fold(a)) || fold(a).includes(q))) return niche;
    if (fold(niche.label).includes(q)) return niche;
  }
  return null;
}
