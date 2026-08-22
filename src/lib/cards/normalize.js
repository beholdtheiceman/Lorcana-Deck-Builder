export function normalizedSetCode(raw) {
  return String(
    raw?.set || raw?.set_code || raw?.setCode || raw?.set?.code || ""
  ).toUpperCase();
}

const SETS = [
  { code: "TFC", name: "The First Chapter", shortName: "TFC", setNum: 1 },
  { code: "ROC", name: "Rise of the Floodborn", shortName: "ROC", setNum: 2 },
  { code: "IAT", name: "Into the Inklands", shortName: "IAT", setNum: 3 },
  { code: "URS", name: "Ursula's Return", shortName: "URS", setNum: 4 },
  { code: "SSK", name: "Shimmering Skies", shortName: "SSK", setNum: 5 },
  { code: "AZS", name: "Azurite Sea", shortName: "AZS", setNum: 6 },
  { code: "ARI", name: "Archazia's Island", shortName: "ARI", setNum: 7 },
  { code: "ROJ", name: "Reign of Jafar", shortName: "ROJ", setNum: 8 },
  { code: "FAB", name: "Fabled", shortName: "FAB", setNum: 9 },
  { code: "WITW", name: "Whispers in the Well", shortName: "WITW", setNum: 10 },
  { code: "WSP", name: "Winterspell", shortName: "WSP", setNum: 11 },
  { code: "WLD", name: "Wilds Unknown", shortName: "WLD", setNum: 12 },
  { code: "AOV", name: "Attack of the Vine!", shortName: "AOV", setNum: 13 },
];

export function getSetByNumber(setNum) {
  return SETS.find(set => set.setNum === setNum);
}

export function getSetByCode(code) {
  return SETS.find(set => set.code === code);
}

const INK_ORDER = ["Amber","Amethyst","Emerald","Ruby","Sapphire","Steel"];
const SET_CODE_ORDER = ["1","2","3","4","5","6","7","8","9","10","11","12","13","D100"]; // extend as new sets arrive

export function primaryInk(card){
  const ink = (Array.isArray(card.inks) && card.inks[0]) || card.ink || card._raw?.ink || "";
  return String(ink);
}

export function collectorParts(card){
  const raw = String(card.number ?? card.collector_number ?? card._raw?.collector_number ?? "");
  const m = raw.match(/^(\d+)([A-Za-z]*)$/);
  return { num: m ? parseInt(m[1],10) : Number.MAX_SAFE_INTEGER, suf: m ? String(m[2]).toLowerCase() : "" };
}

export function cardComparator(a, b) {
  // 1) Ink color (Amber, Amethyst, Emerald, Ruby, Sapphire, Steel)
  const ia = INK_ORDER.indexOf(primaryInk(a));
  const ib = INK_ORDER.indexOf(primaryInk(b));
  if (ia !== ib) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);

  // 2) Set — newest first within a color (numeric set code descending; unknown sets last)
  const ac = String(a.setCode || "").toUpperCase();
  const bc = String(b.setCode || "").toUpperCase();
  const an = /^\d+$/.test(ac) ? Number(ac) : null;
  const bn = /^\d+$/.test(bc) ? Number(bc) : null;
  if (an != null && bn != null && an !== bn) return bn - an;
  if (an != null && bn == null) return -1;
  if (an == null && bn != null) return 1;
  if (an == null && bn == null) {
    const sa = SET_CODE_ORDER.indexOf(ac);
    const sb = SET_CODE_ORDER.indexOf(bc);
    if (sa !== sb) return (sb === -1 ? -1 : sb) - (sa === -1 ? -1 : sa);
  }

  // 3) Collector number (numeric then suffix)
  const ca = collectorParts(a);
  const cb = collectorParts(b);
  if (ca.num !== cb.num) return ca.num - cb.num;
  if (ca.suf !== cb.suf) return String(ca.suf) < String(cb.suf) ? -1 : 1;

  // 4) Name tiebreaker
  const nameA = String(a.name || "");
  const nameB = String(b.name || "");
  return nameA.localeCompare(nameB);
}

export function getSetCodeAndName(card) {
  const code =
    String(card.setCode || card.set || card._raw?.set?.code || card._raw?.set_code || "")
      .toUpperCase().trim();
  const name =
    String(card.setName || card._raw?.set?.name || card._raw?.set_name || "")
      .toLowerCase().trim();
  return { code, name };
}

export function validateCardData(card) {
  if (!card || typeof card !== 'object') {
    return { isValid: false, issues: ['Not an object'] };
  }
  
  const issues = [];
  
  // Essential fields validation
  if (!card.name && !card.title) {
    issues.push('Missing name/title');
  }
  
  if (!card.set && !card.set_code && !card.setName) {
    issues.push('Missing set information');
  }
  
  if (!card.number && !card.collector_number && !card.no) {
    issues.push('Missing card number');
  }
  
  // Image data validation
  if (!card.image_uris || !card.image_uris.digital) {
    issues.push('Missing image data');
  }
  
  // Data quality scoring
  let qualityScore = 100;
  if (issues.length > 0) {
    qualityScore = Math.max(0, 100 - (issues.length * 20));
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    qualityScore,
    hasEssentialData: !issues.includes('Missing name/title') && 
                     !issues.includes('Missing set information') && 
                     !issues.includes('Missing card number')
  };
}

export function validateCardBatch(cards) {
  if (!Array.isArray(cards)) {
    return { validCards: [], invalidCards: [], summary: { total: 0, valid: 0, invalid: 0, qualityScore: 0 } };
  }
  
  const validCards = [];
  const invalidCards = [];
  let totalQualityScore = 0;
  
  cards.forEach((card, index) => {
    const validation = validateCardData(card);
    
    if (validation.isValid) {
      validCards.push(card);
      totalQualityScore += validation.qualityScore;
    } else {
      invalidCards.push({ card, validation, index });
    }
  });
  
  const summary = {
    total: cards.length,
    valid: validCards.length,
    invalid: invalidCards.length,
    qualityScore: validCards.length > 0 ? Math.round(totalQualityScore / validCards.length) : 0
  };
  
  return { validCards, invalidCards, summary };
}

export function getPrimaryInk(card) {
  if (Array.isArray(card?.inks) && card.inks.length > 0) {
    return card.inks[0];
  }
  if (card?.ink) {
    return Array.isArray(card.ink) ? card.ink[0] : card.ink;
  }
  // Try to get from _raw data
  if (card?._raw?.ink) {
    return Array.isArray(card._raw.ink) ? card._raw.ink[0] : card._raw.ink;
  }
  return "";
}

export function getCardInks(card) {
  if (Array.isArray(card.inks) && card.inks.length) {
    return new Set(card.inks.map(s => String(s).trim()));
  }
  if (typeof card.Color === "string" && card.Color.length) {
    return new Set(card.Color.split(",").map(s => String(s).trim()));
  }
  return new Set(); // fallback
}

export function matchesInkFilter(card, selectedInks) {
  const selCount = selectedInks.size;
  if (selCount === 0) return true;

  const inks = getCardInks(card);
  const cardCount = inks.size;

  // 1 ink selected: include mono or dual that contain it
  if (selCount === 1) {
    const [only] = [...selectedInks];
    return inks.has(only);
  }

  // 2 inks selected:
  // - include mono cards that match either of the two
  // - include dual ONLY if exactly those two inks
  if (selCount === 2) {
    if (cardCount === 1) {
      // mono: match either selected ink
      const [a, b] = [...selectedInks];
      return inks.has(a) || inks.has(b);
    }
    if (cardCount === 2) {
      // dual: must match both selected inks exactly
      for (const ink of selectedInks) {
        if (!inks.has(ink)) return false;
      }
      return true;
    }
    return false;
  }

  // 3+ inks selected (Lorcana is mono/dual): fall back to mono that match any selected ink
  // (Duals can't match exactly, so only allow if both inks ⊂ selected set — optional)
  if (cardCount === 1) {
    for (const ink of selectedInks) if (inks.has(ink)) return true;
    return false;
  }
  if (cardCount === 2) {
    // Optional: allow duals only if both inks are within the selected set
    for (const ink of inks) if (!selectedInks.has(ink)) return false;
    return true;
  }
  return false;
}

export const splitDisplayName = (name) => {
  const n = String(name || "");
  // split on hyphen / en dash / em dash, with or without spaces
  const parts = n.split(/\s*[-–—]\s*/);
  return {
    baseName: (parts[0] || "").trim(),
    subname:  (parts[1] || null)?.trim() || null,
  };
};

export const canon = (s) =>
  String(s || "")
    .toLowerCase()
    // normalize all dash styles to " - "
    .replace(/\s*[-–—]\s*/g, " - ")
    // collapse whitespace
    .replace(/\s+/g, " ")
    .trim();

// Helper function to detect cards with subtitles (used in multiple places)
export const hasSubtitleLike = (card) => {
  return !!(card.subname && card.subname.trim()) || 
         /\s[-–]\s/.test((card.name || "").toLowerCase());
};

export function toAppCard(raw) {
  // GUARD: Ensure raw is valid
  if (!raw || typeof raw !== 'object') {
    console.warn('[toAppCard] Invalid raw data:', raw);
    return null;
  }


  // Use the actual API structure from your database
  const id = raw.id || raw.Unique_ID || crypto.randomUUID();
  const name = raw.Name || raw.name || 'Unknown Card';
  const baseName = name.split(" - ")[0];
  const subtitle = name.includes(" - ") ? name.split(" - ")[1] : null;

  const splitList = (s) =>
    s ? s.split(",").map(x => x.trim()).filter(Boolean) : [];

  const abilities = raw.abilities || splitList(raw.Abilities || '');

  return {
    id: id,
    setId: raw.setId || raw.set || raw.Set_ID || null,
    setNum: raw.setNum || raw.Set_Num || null,
    cardNum: raw.cardNum || raw.number || raw.Card_Num || null,
    name: name,
    baseName: baseName,
    subtitle: subtitle,
    imageUrl: raw.imageUrl || raw.image || raw.Image || null,
    inkable: Boolean(raw.inkable ?? raw._raw?.inkwell ?? raw._raw?.inkable ?? raw._raw?.can_be_ink ?? raw._raw?.Inkable ?? false),
    colors: splitList(raw.colors || raw.color || raw.Color || ''),
    classifications: splitList(raw.classifications || raw.Classifications || ''),
    type: raw.type || raw.Type || null,
    cost: raw.cost || raw.Cost || 0,
    lore: raw.lore || raw.Lore || 0,
    willpower: raw.willpower || raw.Willpower || 0,
    strength: raw.strength || raw.Strength || 0,
    rarity: raw.rarity || raw.Rarity || null,
    abilities: abilities,
    rulesText: raw.rulesText || raw.bodyText || raw.Body_Text || '',
    flavorText: raw.flavorText || raw.Flavor_Text || '',
    artist: raw.artist || raw.Artist || null,
    franchise: raw.franchise || raw.Franchise || null,
  };
}
