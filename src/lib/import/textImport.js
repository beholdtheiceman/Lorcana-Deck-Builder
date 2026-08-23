import { deckKey } from '../cardUtils.js'
import { getCardImageUrl } from '../images.js'
import { parseCSVImport } from './csvImport.js'

const canon = (s) =>
  String(s || "")
    .toLowerCase()
    // normalize all dash styles to " - "
    .replace(/\s*[-–—]\s*/g, " - ")
    // collapse whitespace
    .replace(/\s+/g, " ")
    .trim();
function toAppCard(raw) {
  // GUARD: Ensure raw is valid
  if (!raw || typeof raw !== 'object') {
    console.warn('[toAppCard] Invalid raw data:', raw);
    return null;
  }

  // DEBUG: Log the actual structure of the card data
  console.log('[toAppCard] Raw card data structure:', {
    keys: Object.keys(raw),
    name: raw.name,
    baseName: raw.baseName,
    subname: raw.subname,
    setId: raw.setId,
    setNum: raw.setNum,
    cost: raw.cost,
    type: raw.type,
    inkable: raw.inkable
  });

  // Use the actual API structure from your database
  const id = raw.id || raw.Unique_ID || crypto.randomUUID();
  const name = raw.Name || raw.name || 'Unknown Card';
  const baseName = name.split(" - ")[0];
  const subtitle = name.includes(" - ") ? name.split(" - ")[1] : null;

  // NOTE: this file carries its own copy of toAppCard, duplicated from
  // lib/cards/normalize.js during extraction. Both copies need this fix.
  // Real pool cards carry classifications and abilities as ARRAYS; assuming a
  // comma-separated string threw "s.split is not a function" on every live
  // card, and the catch below then dropped the card art.
  const splitList = (s) => {
    if (Array.isArray(s)) return s.map(x => String(x).trim()).filter(Boolean);
    if (typeof s === "string") return s.split(",").map(x => x.trim()).filter(Boolean);
    return [];
  };

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
function asUrl(v) {
  if (!v) return null;
  if (typeof v === 'string') return v;
  // tolerate different shapes - extract URL from common object patterns
  return v.url ?? v.href ?? v.src ?? v.toString?.() ?? null;
}
function lorcanaImageProxyUrl(src){
  if (!src) return null;
  const srcStr = String(src);
  return `https://images.weserv.nl/?url=${encodeURIComponent(srcStr)}&output=jpg`;
}
function generateDeckId() {
  return `deck_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function importDeck(data, format = 'json') {
  try {
    let deck;
    
    switch (format) {
      case 'json':
        deck = typeof data === 'string' ? JSON.parse(data) : data;
        break;
      case 'txt':
        deck = parseTextImport(data);
        break;
      case 'csv':
        deck = parseCSVImport(data);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
    
    // Validate and normalize deck structure
    if (!deck.entries || typeof deck.entries !== 'object') {
      throw new Error('Invalid deck structure: missing entries');
    }
    
    // Ensure deck has required fields
    const normalizedDeck = {
      id: generateDeckId(),
      name: deck.name || "Imported Deck",
      entries: deck.entries,
      total: Object.values(deck.entries).reduce((sum, entry) => sum + (entry.count || 0), 0),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      description: deck.description || "",
      tags: deck.tags || [],
      format: deck.format || "Lorcana",
      notes: deck.notes || ""
    };
    
    return normalizedDeck;
  } catch (error) {
    console.error('[importDeck] Error importing deck:', error);
    throw error;
  }
}
export function findCardByLorcanitoFormat(cardName, subtitle, setId, setNumber) {
  const getCards = window.getAllCards || window.getCurrentCards;
  if (getCards) {
    const cards = getCards();

    if (!cards || cards.length === 0) {
      console.warn('[findCardByLorcanitoFormat] No cards available in database');
      return null;
    }
    
    
    // Try exact match first
    const exactMatch = cards.find(c => 
      c.name === `${cardName} — ${subtitle}` ||
      (c.name === cardName && c.subname === subtitle)
    );
    
    if (exactMatch) {
      console.log(`[findCardByLorcanitoFormat] Exact match found: "${exactMatch.name}"`);
      return exactMatch;
    }
    
    // Try matching by set and number
    const setMatch = cards.find(c => 
      String(c.setId) === String(setId) && 
      String(c.setNumber) === String(setNumber)
    );
    
    if (setMatch) {
      console.log(`[findCardByLorcanitoFormat] Set match found: "${setMatch.name}" (Set ${setMatch.setId} #${setMatch.setNumber})`);
      return setMatch;
    }
    
    // Try fuzzy name matching
    const fuzzyMatch = cards.find(c => 
      c.name.toLowerCase().includes(cardName.toLowerCase()) &&
      c.name.toLowerCase().includes(subtitle.toLowerCase())
    );
    
    if (fuzzyMatch) {
      console.log(`[findCardByLorcanitoFormat] Fuzzy match found: "${fuzzyMatch.name}"`);
      return fuzzyMatch;
    }
    
    console.log(`[findCardByLorcanitoFormat] No match found for "${cardName} — ${subtitle}"`);
    return null;
  } else {
    console.warn('[findCardByLorcanitoFormat] getCurrentCards function not available');
    return null;
  }
}
export function parseTextImport(text, suppliedCards) {
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid text input');
  }
  
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line);
  
  if (lines.length === 0) {
    throw new Error('No valid lines found in text input');
  }
  
  const deck = { entries: {} };
  let validCards = 0;
  let totalCards = 0;
  let skippedLines = 0;
  let foundCards = [];
  let notFoundCards = [];
  
  // Simple, permissive line format that handles:
  // "4 Name - Subtitle (TFC #123)"
  // Parse each line - just count and full card name
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    // Skip empty lines and comments
    if (!line || line.startsWith('#') || line.startsWith('//')) {
      skippedLines++;
      continue;
    }
    
    // DEBUG: Log the actual line content to see what we're parsing
    console.log(`[parseTextImport] Processing line ${index + 1}: "${line}"`);
    
    // Try to parse the line - just count and full card name
    const match = line.match(/^(\d+)\s+(.+)$/);
    if (!match) {
      console.warn(`[parseTextImport] Unrecognized format on line ${index + 1}: "${line}"`);
      skippedLines++;
      continue;
    }
    
    const [, count, fullCardName] = match;
    const countNum = parseInt(count);
    
    if (countNum <= 0 || !fullCardName.trim()) {
      console.warn(`[parseTextImport] Invalid count or card name on line ${index + 1}: "${line}"`);
      skippedLines++;
      continue;
    }
    
    totalCards += countNum;
    const cardName = fullCardName.trim();
    // The permissive line format only yields a full name; there is no separate
    // subtitle/set/number token. These are declared (empty) so the placeholder
    // fallbacks below resolve to their defaults instead of throwing ReferenceError.
    const cardSubtitle = '';
    const cardSet = '';
    const cardNumber = '';

    console.log(`[parseTextImport] Parsed: ${countNum}x "${cardName}"`);

    // Resolve against the FULL catalog, not the currently filtered view — an
    // active search/filter must not make deck-list cards unresolvable on import.
    // Prefer an explicitly supplied pool. The window globals are set by the
    // legacy builder; new callers pass their own cards instead.
    const cards = Array.isArray(suppliedCards) && suppliedCards.length
      ? suppliedCards
      : (window.getAllCards
        ? window.getAllCards()
        : (window.getCurrentCards ? window.getCurrentCards() : []));
    const foundCard = findCardByName(cardName, cards);
    
    if (foundCard && !foundCard.reason) {
      // Card found successfully
      const key = deckKey(foundCard);
      
              try {
          // Extract inkable information from the original card data BEFORE processing, prioritize inkwell field
          const inkable = foundCard.inkable ?? foundCard._raw?.inkwell ?? foundCard._raw?.inkable ?? foundCard._raw?.can_be_ink ?? foundCard._raw?.Inkable ?? false;
          
          const transformedCard = toAppCard(foundCard);
          const rawUrl = getCardImageUrl(transformedCard);
          const proxied = lorcanaImageProxyUrl(rawUrl);
          let image_url = asUrl(proxied) ?? asUrl(rawUrl);
          
          if (image_url && typeof image_url !== 'string') {
            image_url = null;
          }
          
          deck.entries[key] = { 
            card: {
              ...transformedCard,
              inkable: Boolean(inkable), // Use the extracted inkable value
              _raw: foundCard._raw, // Preserve the original raw data
              image_url,
              _generatedImageUrl: rawUrl,
              _proxiedImageUrl: proxied
            }, 
            count: countNum 
          };
        
        validCards++;
        foundCards.push({ name: foundCard.name, found: foundCard.name, count: countNum });
        console.log(`[parseTextImport] Successfully imported: ${foundCard.name}`);
        
      } catch (error) {
        console.warn(`[parseTextImport] Error processing card ${foundCard.name}:`, error);
        // Keep whatever art the source card already had. Nulling it here
        // turned any processing error into a silently missing image.
        deck.entries[key] = { 
          card: { ...foundCard }, 
          count: countNum 
        };
        validCards++;
        foundCards.push({ name: foundCard.name, found: foundCard.name, count: countNum });
      }
      
    } else if (foundCard && foundCard.reason === 'ambiguous-base' && foundCard.candidates) {
      // Handle ambiguous cases
      console.log(`[parseTextImport] Ambiguous card found for "${cardName}", ${foundCard.candidates.length} candidates`);
      
      // Use the first candidate as a best guess
      const bestMatch = foundCard.candidates[0];
      const key = deckKey(bestMatch);
      
              try {
          // Extract inkable information from the original card data BEFORE processing, prioritize inkwell field
          const inkable = bestMatch.inkable ?? bestMatch._raw?.inkwell ?? bestMatch._raw?.inkable ?? bestMatch._raw?.can_be_ink ?? bestMatch._raw?.Inkable ?? false;
          
          const transformedCard = toAppCard(bestMatch);
          const rawUrl = getCardImageUrl(transformedCard);
          const proxied = lorcanaImageProxyUrl(rawUrl);
          let image_url = asUrl(proxied) ?? asUrl(rawUrl);
          
          if (image_url && typeof image_url !== 'string') {
            image_url = null;
          }
          
          deck.entries[key] = { 
            card: {
              ...transformedCard,
              inkable: Boolean(inkable), // Use the extracted inkable value
              _raw: bestMatch._raw, // Preserve the original raw data
              image_url,
              _generatedImageUrl: rawUrl,
              _proxiedImageUrl: proxied,
              _resolvedFromAmbiguous: true
            }, 
            count: countNum 
          };
        
        validCards++;
        foundCards.push({ name: bestMatch.name, found: bestMatch.name, count: countNum, reason: 'resolved-from-ambiguous' });
        console.log(`[parseTextImport] Used best match: ${bestMatch.name}`);
        
      } catch (error) {
        console.warn(`[parseTextImport] Error processing ambiguous card ${bestMatch.name}:`, error);
        // Create placeholder
        const placeholderCard = {
          name: `${cardName}${cardSubtitle ? ` - ${cardSubtitle}` : ''}`,
          set: cardSet || 'Multiple',
          number: cardNumber || 'Multiple',
          cost: 0,
          inks: [],
          type: "Unknown",
          rarity: "Unknown",
          text: `Multiple variants found: ${foundCard.candidates.map(c => c.name).join(', ')}`,
          classifications: [],
          keywords: [],
          image_url: null,
          _raw: {},
          _candidates: foundCard.candidates,
          _needsResolution: true,
          setCode: cardSet || 'Multiple',
          setName: cardSet ? `Set ${cardSet}` : 'Multiple Sets',
          setNum: cardNumber || 'Multiple',
          inkable: false,
          lore: 0,
          willpower: 0,
          strength: 0,
          franchise: "",
          gamemode: "Lorcana"
        };
        
        const placeholderKey = deckKey(placeholderCard);
        deck.entries[placeholderKey] = { card: placeholderCard, count: countNum };
        validCards++;
        notFoundCards.push({ name: `${cardName}${cardSubtitle ? ` - ${cardSubtitle}` : ''}`, count: countNum, reason: 'ambiguous-needs-resolution' });
      }
      
    } else {
      // No card found, create placeholder
      console.log(`[parseTextImport] No card found for: "${cardName}${cardSubtitle ? ` - ${cardSubtitle}` : ''}"`);
      
      const placeholderCard = {
        name: `${cardName}${cardSubtitle ? ` - ${cardSubtitle}` : ''}`,
        set: cardSet || "Unknown",
        number: cardNumber || "?",
        cost: 0,
        inks: [],
        type: "Unknown",
        rarity: "Unknown",
        text: "",
        classifications: [],
        keywords: [],
        image_url: null,
        _raw: {},
        setCode: cardSet || "Unknown",
        setName: cardSet ? `Set ${cardSet}` : "Unknown",
        setNum: cardNumber || "?",
        inkable: false,
        lore: 0,
        willpower: 0,
        strength: 0,
        franchise: "",
        gamemode: "Lorcana"
      };
      
      const key = deckKey(placeholderCard);
      deck.entries[key] = { card: placeholderCard, count: countNum };
      validCards++;
      notFoundCards.push({ name: `${cardName}${cardSubtitle ? ` - ${cardSubtitle}` : ''}`, count: countNum, reason: 'not-found' });
    }
    
    // REMOVED: Duplicate processing blocks that were causing double processing
    // The main parsing logic above already handles all the formats we need
  }
  
  if (validCards === 0) {
    throw new Error('No valid cards found in text input');
  }
  
  // Ensure the deck has the total count properly set
  deck.total = totalCards;
  
  // Log detailed results for debugging
  
  // Extract all valid image URLs for prefetching (ensuring they're strings)
  const imageUrlsToPrefetch = Object.values(deck.entries)
    .map(entry => {
      const card = entry.card;
      if (!card) return null;
      
      
      // Use getCardImageUrl to get the best possible URL
      const rawUrl = getCardImageUrl(card);
      
      
      // GUARD: Ensure rawUrl is a string before calling proxyImageUrl
      if (typeof rawUrl !== 'string') {
        console.warn(`[parseTextImport] rawUrl is not a string, skipping proxy:`, rawUrl);
        return asUrl(rawUrl);
      }
      
      console.log(`[parseTextImport] Prefetch call to lorcanaImageProxyUrl with:`, { rawUrl, type: typeof rawUrl, function: typeof lorcanaImageProxyUrl });
      const proxied = lorcanaImageProxyUrl(rawUrl);
      return asUrl(proxied) ?? asUrl(rawUrl);
    })
    .filter(url => typeof url === 'string' && url.length > 0);
  
  console.log(`[parseTextImport] Extracted ${imageUrlsToPrefetch.length} valid image URLs for prefetching`);
  if (imageUrlsToPrefetch.length > 0) {
    console.log(`[parseTextImport] Sample URLs:`, imageUrlsToPrefetch.slice(0, 3));
  }
  
  if (foundCards.length > 0) {
    console.log('[parseTextImport] Found cards:', foundCards);
  }
  if (notFoundCards.length > 0) {
    console.log('[parseTextImport] Not found cards:', notFoundCards);
  }
  
  deck._report = {
    matched: foundCards,
    unmatched: notFoundCards,
    skippedLines,
    totalCards,
  };

  return deck;
}
export function matchCard(line, db) {
  const raw = line.trim();
  
  // Normalize function for consistent matching
  const clean = (s = '') => s.toLowerCase()
    .normalize('NFKD')
    .replace(/[–—]/g, '-')     // dash normalize
    .replace(/\s+/g, ' ')
    .trim();
  
  const normLine = clean(raw);
  
  // Split title into base and subtitle
  function splitTitle(line) {
    const m = clean(line).split(/\s-\s/); // tolerant of hyphenated subtitles
    return { base: m[0], sub: m[1] ?? '' };
  }
  
  // 1) Exact match on full normalized name
  const exact = db.find(c => clean(c.name) === normLine);
  if (exact) {
    console.log(`[matchCard] Exact match found: "${exact.name}"`);
    return { match: exact, needsConfirmation: false, reason: "exact-name" };
  }
  
  // 2) Name - Subtitle pairing using new normalized fields
  const { base, sub } = splitTitle(raw);
  if (sub) {
    console.log(`[matchCard] Trying subtitle match: base="${base}", sub="${sub}"`);
    
    // Use the new normalized fields for more reliable matching
    const subtitleCandidates = db.filter(c => {
      // First try the new normalized fields
      if (c.baseName && c.subname) {
        return clean(c.baseName) === clean(base) && clean(c.subname) === clean(sub);
      }
      // Fallback to parsing the name field (for legacy cards)
      const [cBase, cSub = ''] = clean(c.name).split(/\s-\s/);
      return cBase === clean(base) && cSub === clean(sub);
    });
    
    if (subtitleCandidates.length === 1) {
      console.log(`[matchCard] Single subtitle match: "${subtitleCandidates[0].name}"`);
      return { match: subtitleCandidates[0], needsConfirmation: false, reason: "name+subtitle" };
    }
    if (subtitleCandidates.length > 1) {
      console.log(`[matchCard] Multiple subtitle matches (${subtitleCandidates.length}), needs confirmation`);
      return { candidates: subtitleCandidates, needsConfirmation: true, reason: "ambiguous-name+subtitle" };
    }
  }
  
  // 3) Unique base-name fallback using new normalized fields
  const baseMatches = db.filter(c => {
    // First try the new normalized fields
    if (c.baseName) {
      return clean(c.baseName) === clean(base);
    }
    // Fallback to parsing the name field (for legacy cards)
    const [cBase] = clean(c.name).split(/\s-\s/);
    return cBase === clean(base);
  });
  
  if (baseMatches.length === 1) {
    console.log(`[matchCard] Unique base name match: "${baseMatches[0].name}"`);
    return { match: baseMatches[0], needsConfirmation: false, reason: "unique-base" };
  }
  
  if (baseMatches.length > 1) {
    console.log(`[matchCard] Multiple base matches (${baseMatches.length}), applying tiebreakers`);
    
    // Apply soft tiebreakers: set, color, inkable
    const boosted = [...baseMatches].sort((a, b) => {
      let scoreA = 0, scoreB = 0;
      if (normLine.includes(clean(String(a.setId)))) scoreA += 3;
      if (normLine.includes(clean(String(b.setId)))) scoreB += 3;
      if (normLine.includes(clean(String(a.setNum)))) scoreA += 2;
      if (normLine.includes(clean(String(b.setNum)))) scoreB += 2;
      if (normLine.includes(clean(String(a.colors?.[0])))) scoreA += 1;
      if (normLine.includes(clean(String(b.colors?.[0])))) scoreB += 1;
      return scoreB - scoreA;
    });
    
    // If the top score is unique & >0, pick it; else ask user
    const top = boosted[0];
    const topScore = (() => {
      let s = 0;
      if (normLine.includes(clean(String(top.setId)))) s += 3;
      if (normLine.includes(clean(String(top.setNum)))) s += 2;
      if (normLine.includes(clean(String(top.colors?.[0])))) s += 1;
      return s;
    })();
    
    if (topScore > 0 && (boosted.length === 1 || top !== boosted[1])) {
      console.log(`[matchCard] Tiebreaker resolved: "${top.name}" (score: ${topScore})`);
      return { match: top, needsConfirmation: false, reason: "base+tiebreak" };
    }
    
    console.log(`[matchCard] Ambiguous base matches, needs confirmation`);
    return { candidates: baseMatches, needsConfirmation: true, reason: "ambiguous-base" };
  }
  
  // 4) Give up cleanly
  console.log(`[matchCard] No match found for: "${line}"`);
  return { candidates: [], needsConfirmation: true, reason: "no-match" };
}
export function findCardByName(userLine, cards) {
  const typed = String(userLine || "");
  
  
  // DEBUG: Show detailed structure of sample cards
  console.log(`[findCardByName] Sample cards structure:`, 
    cards.slice(0, 3).map(c => ({
      name: c.name,
      baseName: c.baseName,
      subname: c.subname,
      subtitle: c.subtitle,
      allKeys: Object.keys(c).slice(0, 10), // Show first 10 keys
      hasRaw: !!c._raw,
      rawKeys: c._raw ? Object.keys(c._raw).slice(0, 5) : []
    }))
  );
  
  // DEBUG: Look for cards with similar names to understand the data structure
  if (typed.includes(" - ")) {
    const [baseTyped, subTyped] = typed.split(/\s*[-–—]\s*/);
    const similarCards = cards.filter(c => {
      const cardName = (c.name || "").toLowerCase();
      return cardName.startsWith(baseTyped.toLowerCase());
    }).slice(0, 5);
    
    console.log(`[findCardByName] Cards with similar base name "${baseTyped}":`, 
      similarCards.map(c => ({
        name: c.name,
        baseName: c.baseName,
        subname: c.subname,
        rawName: c._raw?.Name
      }))
    );
  }
  
  // DEBUG: Show what we're searching for
  console.log(`[findCardByName] Searching for complete card name: "${typed}"`);

  // 1) Try exact match first (case-insensitive)
  console.log(`[findCardByName] Trying exact match for: "${typed}"`);
  const exact = cards.find(c => c.name.toLowerCase() === typed.toLowerCase());
  if (exact) {
    console.log(`[findCardByName] Found exact match: "${exact.name}"`);
    return exact;
  }
  console.log(`[findCardByName] No exact match found`);

  // 2) Try case-insensitive match with normalized names
  console.log(`[findCardByName] Trying case-insensitive match for: "${typed.toLowerCase()}"`);
  const caseInsensitive = cards.find(c => canon(c.name) === canon(typed));
  if (caseInsensitive) {
    console.log(`[findCardByName] Found case-insensitive match: "${caseInsensitive.name}"`);
    return caseInsensitive;
  }
  console.log(`[findCardByName] No case-insensitive match found`);

  // 3) Try matching against the original Name field if it exists
  console.log(`[findCardByName] Trying original Name field match for: "${typed}"`);
  const originalNameMatch = cards.find(c => {
    const originalName = c._raw?.Name || c._raw?.name;
    return originalName && originalName.toLowerCase() === typed.toLowerCase();
  });
  if (originalNameMatch) {
    console.log(`[findCardByName] Found original Name match: "${originalNameMatch._raw?.Name || originalNameMatch._raw?.name}"`);
    return originalNameMatch;
  }
  console.log(`[findCardByName] No original Name match found`);

  // 4) Try matching against Lorcast API name + version combination
  console.log(`[findCardByName] Trying Lorcast name + version match for: "${typed}"`);
  const lorcastMatch = cards.find(c => {
    if (c._raw?.name && c._raw?.version) {
      const fullName = `${c._raw.name} - ${c._raw.version}`;
      return fullName.toLowerCase() === typed.toLowerCase();
    }
    return false;
  });
  if (lorcastMatch) {
    console.log(`[findCardByName] Found Lorcast name + version match: "${lorcastMatch._raw.name} - ${lorcastMatch._raw.version}"`);
    return lorcastMatch;
  }
  console.log(`[findCardByName] No Lorcast name + version match found`);

  // 5) Try fuzzy matching on the complete card name
  let candidates = cards.filter(c => {
    const cardName = (c.name || "").toLowerCase();
    const userFullName = typed.toLowerCase();
    
    // Check if the card name starts with the user's input or vice versa
    return cardName.startsWith(userFullName) || userFullName.startsWith(cardName);
  });
  
  console.log(`[findCardByName] Found ${candidates.length} fuzzy matches for "${typed}"`);
  if (candidates.length > 0) {
    console.log(`[findCardByName] Fuzzy match candidates:`, candidates.slice(0, 3).map(c => ({ name: c.name })));
    
    if (candidates.length === 1) {
      console.log(`[findCardByName] Found single fuzzy match: "${candidates[0].name}"`);
      return candidates[0];
    } else {
      console.log(`[findCardByName] Multiple fuzzy matches found, returning ambiguous result`);
      return { reason: "ambiguous-base", candidates };
    }
  }

  // 6) No match found
  console.log(`[findCardByName] No match found for: "${typed}"`);
  return null;
}

