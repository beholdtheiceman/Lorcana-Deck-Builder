// Deck Presentation view — the rich deck-name editor, cards-by-type grid,
// stats/charts, tournament results, and action-button row that used to live
// inside App.jsx's <DeckPresentationPopup> (a blocking Modal). This is now a
// bare-content component: it renders no Modal/overlay of its own, so its
// container is responsible for positioning it — a docked side panel in the
// Deck Lab (see App.jsx's "Docked Deck Presentation panel" block), or an
// inline section on the My Decks page (see src/pages/MyDecksPage.jsx).
//
// Extracted verbatim from App.jsx except:
//  - the <Modal> wrapper and its close button are gone (bare content now)
//  - `onClose` is gone; callers don't get a close callback anymore
//  - `alert(...)` calls became `toast?.(...)` calls (a docked panel /
//    inline page section shouldn't block on native alert dialogs)
//  - `onGenerateImage` is now called with no args and awaited locally so
//    this component can show its own "Generating..." button state
//  - added an optional `onEditInLab` link near the deck name (used by the
//    My Decks page; the Deck Lab's own panel doesn't need it)
//
// Many helpers this used to reach as in-file closures (Modal, Section, Pill,
// WinRateBar, useDeckResults, TournamentResultsSection, getCost, getInks,
// deckKey, normalizedType, FALLBACK_IMG, EnhancedCurveChart,
// DrawProbabilityTool, DrawSimulator, HoverableStatLine, HoverableStatBox,
// rolesForCard, ROLE_ORDER, detectSynergies) are still defined in App.jsx and
// are now exported from there for this component to import, rather than
// duplicating ~1700 lines of chart/analysis logic into a second file.

import React, { useState, useEffect } from "react";
import DeckActionBar from './deck/DeckActionBar.jsx'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  getCost,
  getInks,
  deckKey,
  normalizedType,
  FALLBACK_IMG,
  rolesForCard,
  ROLE_ORDER,
  detectSynergies,
} from "../lib/cardUtils.js";
import {
  EnhancedCurveChart,
  DrawProbabilityTool,
  DrawSimulator,
  HoverableStatLine,
  HoverableStatBox,
} from "./deckCharts.jsx";
import { TournamentResultsSection } from "./TournamentResults.jsx";
import { InkCurve, InkLedger, CostHex, InkSplitBar, inkVar } from "./ui/index.js";

// Ink name → design token for the six Lorcana inks, plus a Dual-Ink accent.
// HTML surfaces resolve colors through inkVar() (CSS var() works inline); this
// map is only for the Recharts pie's SVG <Cell> fills, where var() does not
// resolve — so we still drive the palette from the tokens' values.
const INK_TOKEN_HEX = {
  Amber: "#f4b223",
  Amethyst: "#9b59d0",
  Emerald: "#2ecc71",
  Ruby: "#e74c5e",
  Sapphire: "#3aa0e0",
  Steel: "#9aa7b8",
  "Dual-Ink": "#f4b223",
};

// `mobileSection` is used by the mobile "Deck" tab (see AppInner in App.jsx) to
// render only half of this component's content at a time, inside its own
// segmented control ("Cards" / "Info") — instead of the full desktop/My Decks
// experience which always renders everything together.
//   - "cards": deck-name header + the cards-by-type grid only.
//   - "info": stats, charts, tournament results, and every action button.
//   - undefined/omitted (default): renders both, exactly as before.
export default function DeckPresentationView({ deck, allCards, onSave, onGenerateImage, toast, onEditInLab, mobileSection, onAdjustCount }) {
  const showCardsSection = mobileSection == null || mobileSection === 'cards';
  const showInfoSection = mobileSection == null || mobileSection === 'info';
  const [deckName, setDeckName] = useState(deck.name || "Untitled Deck");
  const [selectedHubId, setSelectedHubId] = useState('');
  const [hubs, setHubs] = useState([]);
  const [loadingHubs, setLoadingHubs] = useState(false);
  const [savingToHub, setSavingToHub] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const entries = Object.values(deck.entries || {}).filter((e) => e.count > 0);

  async function handleDownloadImage() {
    setIsGeneratingImage(true);
    try {
      await onGenerateImage?.();
    } catch (error) {
      console.error('Failed to generate deck image:', error);
      toast?.('Failed to generate deck image. Please try again.', 'error');
    } finally {
      setIsGeneratingImage(false);
    }
  }

  // Lorcanito export constants and functions
  const GROUP_ORDER = ["Character", "Action", "Song", "Item", "Location"];

  function groupAndSortForText(entries) {
    try {
      console.log('[Lorcanito Export] groupAndSortForText called with:', entries);
      
      const buckets = new Map(GROUP_ORDER.map(t => [t, []]));
      for (const e of entries) {
        const t = normalizedType(e.card);
        if (!buckets.has(t)) buckets.set(t, []);
        buckets.get(t).push(e);
      }
      
      console.log('[Lorcanito Export] Initial buckets:', Object.fromEntries(buckets));
      
      for (const [t, arr] of buckets) {
        arr.sort((a, b) => (getCost(a.card) ?? 0) - (getCost(b.card) ?? 0) || a.card.name.localeCompare(b.card.name));
      }
      
      const result = GROUP_ORDER
        .filter(t => buckets.get(t)?.length)
        .map(t => ({ section: t, entries: buckets.get(t) }));
      
      console.log('[Lorcanito Export] Final grouped result:', result);
      return result;
    } catch (error) {
      console.error('[Lorcanito Export] Error in groupAndSortForText:', error);
      throw error;
    }
  }

  function displayNameForText(card) {
    const variant = card.title || card.version || card._raw?.version || card._raw?.Version || card.subname || null;
    return variant ? `${card.name} — ${variant}` : card.name;
  }

  // Optional: append set + number when available to disambiguate
  function lineForText(e, withSet = true) {
    const c = e.card;
    const set = c.set || c._raw?.setCode || c._raw?.set;
    const num = c.number || c._raw?.number || c._raw?.collector_number;
    const base = `${e.count} ${displayNameForText(c)}`;
    return withSet && set && num ? `${base} (${set} #${num})` : base;
  }

  function makeLorcanitoTextExport({ name, inks, entries }) {
    try {
      console.log('[Lorcanito Export] makeLorcanitoTextExport called with:', { name, inks, entries });
      
      const groups = groupAndSortForText(entries);
      console.log('[Lorcanito Export] Grouped entries:', groups);
      
      const lines = [];
      if (name) lines.push(`# ${name}`);
      if (inks?.length) lines.push(`# Inks: ${inks.join(" / ")}`);
      lines.push(`# Total: ${entries.reduce((s, x) => s + (x.count || 0), 0)}`, "");

      for (const { section, entries: list } of groups) {
        lines.push(`# ${section}s`);
        for (const e of list) {
          const line = lineForText(e, /*withSet*/ true);
          lines.push(line);
          console.log(`[Lorcanito Export] Added line: ${line}`);
        }
        lines.push("");
      }
      
      const result = lines.join("\n").trim() + "\n";
      console.log('[Lorcanito Export] Final result:', result);
      return result;
    } catch (error) {
      console.error('[Lorcanito Export] Error in makeLorcanitoTextExport:', error);
      throw error;
    }
  }

  // Fetch user's hubs
  useEffect(() => {
    const fetchHubs = async () => {
      try {
        setLoadingHubs(true);
        const response = await fetch('/api/hubs');
        if (response.ok) {
          const data = await response.json();
          setHubs(data);
        }
      } catch (error) {
        console.error('Error fetching hubs:', error);
      } finally {
        setLoadingHubs(false);
      }
    };

    fetchHubs();
  }, []);

  // Save deck to team hub
  const handleSaveToHub = async () => {
    if (!selectedHubId || !deckName.trim()) return;

    try {
      setSavingToHub(true);
      
      // Save to the selected hub by creating a new deck (this will also save locally via saveDeckToCloud)
      const response = await fetch('/api/decks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: deckName.trim(),
          data: deck
        })
      });

      if (response.ok) {
        console.log('Deck saved to hub successfully');
        toast?.(`Deck "${deckName.trim()}" added to team hub.`, 'success');
      } else {
        const errorData = await response.json();
        console.error('Failed to save deck to hub:', errorData.error);
        toast?.('Failed to save deck to team hub.', 'error');
      }
    } catch (error) {
      console.error('Error saving deck to hub:', error);
      toast?.('Failed to save deck to team hub.', 'error');
    } finally {
      setSavingToHub(false);
    }
  };

  // Generate Dreamborn-style clipboard format
  function generateDreambornFormat(deck) {
    const entries = Object.values(deck.entries || {}).filter(e => e.count > 0);
    
    // Sort by cost, then by name
    const sortedEntries = entries.sort((a, b) => {
      const costA = getCost(a.card) ?? 0;
      const costB = getCost(b.card) ?? 0;
      if (costA !== costB) return costA - costB;
      return a.card.name.localeCompare(b.card.name);
    });
    
    // Generate lines in Dreamborn format: "4 Nick Wilde - Soggy Fox"
    return sortedEntries.map(entry => {
      const card = entry.card;
      const variant = card.title || card.version || card._raw?.version || card._raw?.Version || card.subname || null;
      const displayName = variant ? `${card.name} - ${variant}` : card.name;
      return `${entry.count} ${displayName}`;
    }).join('\n');
  }

  // Hook up to a button
  async function onExportLorcanito(deck) {
    console.log('[Lorcanito Export] BUTTON CLICKED! Function called with deck:', deck);
    try {
      console.log('[Lorcanito Export] Starting export for deck:', deck);
      console.log('[Lorcanito Export] Deck entries:', deck.entries);
      
      // Convert deck.entries object to array format and filter out zero-count cards
      const deckEntries = Object.values(deck.entries || {}).filter(e => e.count > 0);
      console.log('[Lorcanito Export] Filtered deck entries:', deckEntries);
      
      if (deckEntries.length === 0) {
        toast?.("No cards in deck to export!", "error");
        return;
      }
      
      // Extract ink colors from the deck (handle multiple data structures)
      const inkColors = new Set();
      for (const { card } of deckEntries) {
        // Check multiple possible ink field locations
        const inks = card.inks || card._raw?.inks || card._raw?.Inks || [];
        if (Array.isArray(inks)) {
          inks.forEach(ink => inkColors.add(ink));
        } else if (typeof inks === 'string') {
          // Handle comma-separated ink strings
          inks.split(',').map(ink => ink.trim()).forEach(ink => inkColors.add(ink));
        }
      }
      console.log('[Lorcanito Export] Extracted ink colors:', Array.from(inkColors));
      
      const text = makeLorcanitoTextExport({
        name: deck.name || "Untitled Deck",
        inks: inkColors.size > 0 ? Array.from(inkColors) : undefined,
        entries: deckEntries
      });
      
      console.log('[Lorcanito Export] Generated text:', text);
      console.log('[Lorcanito Export] Text length:', text.length);
      
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        console.log('[Lorcanito Export] Using modern clipboard API');
        await navigator.clipboard.writeText(text);
        console.log('[Lorcanito Export] Clipboard write successful');
      } else {
        // Fallback to older method
        console.log('[Lorcanito Export] Using fallback clipboard method');
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (!successful) {
          throw new Error('Fallback clipboard method failed');
        }
        console.log('[Lorcanito Export] Fallback clipboard successful');
      }
      
      toast?.("Deck list copied to clipboard! Paste it into Lorcanito's import box or any other Lorcana tool.", "success");
      console.log('[Lorcanito Export] Export completed successfully');
    } catch (error) {
      console.error('[Lorcanito Export] Error copying deck list:', error);
      console.error('[Lorcanito Export] Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });

      // Show more specific error message
      if (error.name === 'NotAllowedError') {
        toast?.('Clipboard permission denied. Please allow clipboard access and try again.', 'error');
      } else if (error.name === 'NotSupportedError') {
        toast?.('Clipboard not supported in this browser.', 'error');
      } else {
        toast?.(`Error copying deck list: ${error.message}. Please try again.`, 'error');
      }
    }
  }

  // Copy Dreamborn format to clipboard
  async function onCopyDreamborn(deck) {
    try {
      const text = generateDreambornFormat(deck);
      
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback to older method
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (!successful) {
          throw new Error('Fallback clipboard method failed');
        }
      }
      
      toast?.("Deck list copied to clipboard in Dreamborn format!", "success");
    } catch (error) {
      console.error('Error copying Dreamborn format:', error);
      toast?.(`Error copying deck list: ${error.message}. Please try again.`, "error");
    }
  }
  
  // Calculate deck statistics
  const totalCards = entries.reduce((sum, e) => sum + e.count, 0);
  const totalInkable = entries.reduce((sum, e) => {
    const isInkable = Boolean(e.card.inkable ?? e.card._raw?.inkwell ?? e.card._raw?.inkable ?? e.card._raw?.can_be_ink ?? e.card._raw?.Inkable ?? false);
    return sum + (isInkable ? e.count : 0);
  }, 0);
  const totalUninkable = totalCards - totalInkable;
  
  // Calculate cost curve
  const costCurve = {};
  entries.forEach(e => {
    const cost = getCost(e.card);
    const normalizedCost = cost >= 10 ? 10 : cost;
    costCurve[normalizedCost] = (costCurve[normalizedCost] || 0) + e.count;
  });

  // Per-cost ink breakdown for the token-colored InkCurve primitive. Buckets
  // 0..10 (10 = "10+"); each card's count is attributed to its ink (first ink
  // for multi-ink cards, Steel when a card has no detectable ink).
  const curveBuckets = Array.from({ length: 11 }, (_, i) => ({
    label: i === 10 ? "10+" : String(i),
    counts: {},
  }));
  entries.forEach(e => {
    const cost = getCost(e.card);
    const idx = Number.isFinite(cost) ? (cost >= 10 ? 10 : Math.max(0, cost)) : 0;
    const inks = getInks(e.card);
    const inkKey = inks.length >= 1 ? inks[0] : "Steel";
    const bucket = curveBuckets[idx];
    bucket.counts[inkKey] = (bucket.counts[inkKey] || 0) + e.count;
  });
  
  // Calculate type distribution
  const typeDistribution = {};
  entries.forEach(e => {
    const types = Array.isArray(e.card.types) ? e.card.types : [e.card.type];
    types.forEach(type => {
      if (type) {
        const cleanType = type.split(' - ')[0]; // Handle "Action - Song" -> "Action"
        typeDistribution[cleanType] = (typeDistribution[cleanType] || 0) + e.count;
      }
    });
  });
  
  // Calculate ink color distribution with dual-ink tracking
  const inkDistribution = {};
  const dualInkCards = [];
  
  entries.forEach(e => {
    const inks = getInks(e.card);

    if (inks.length > 0) {
      // Track dual-ink cards for special presentation
      if (inks.length > 1) {
        dualInkCards.push({
          name: e.card.name,
          inks: inks,
          count: e.count
        });
        // Add to dual-ink category instead of both individual colors
        inkDistribution['Dual-Ink'] = (inkDistribution['Dual-Ink'] || 0) + e.count;
      } else {
        // Single ink card: add to its ink color
        inks.forEach(ink => {
          if (ink) {
            inkDistribution[ink] = (inkDistribution[ink] || 0) + e.count;
          }
        });
      }
    } else {
      // Enhanced fallback: try to detect ink colors from card properties
      console.log(`[Ink Distribution Debug] No inks found for ${e.card.name}, trying fallback detection`);
      
      // Try to get ink color from various card properties
      let detectedInks = [];
      
      // Check if card has ink-related properties
      if (e.card._raw) {
        const raw = e.card._raw;
        
        // Debug: log the entire raw object for cards with null ink
        if (raw.ink === null) {
          console.log(`[Dual-Ink Debug] ${e.card.name} has null ink, examining full structure:`, raw);
        }
        
        // Try different possible ink color properties
        if (raw.ink && raw.ink !== null) detectedInks.push(raw.ink);
        if (raw.Ink && raw.Ink !== null) detectedInks.push(raw.Ink);
        if (raw.inkColor && raw.inkColor !== null) detectedInks.push(raw.inkColor);
        if (raw.Ink_Color && raw.Ink_Color !== null) detectedInks.push(raw.Ink_Color);
        if (raw.color && raw.color !== null) detectedInks.push(raw.color);
        if (raw.Color && raw.Color !== null) detectedInks.push(raw.Color);
        
        // Check for dual-ink specific properties
        if (raw.inks && Array.isArray(raw.inks)) {
          detectedInks.push(...raw.inks.filter(ink => ink && ink !== null));
        }
        if (raw.inkColors && Array.isArray(raw.inkColors)) {
          detectedInks.push(...raw.inkColors.filter(ink => ink && ink !== null));
        }
        
        // Check for comma-separated ink strings
        if (raw.colors) {
          if (Array.isArray(raw.colors)) {
            detectedInks.push(...raw.colors.filter(ink => ink && ink !== null));
          } else if (typeof raw.colors === 'string') {
            detectedInks.push(...raw.colors.split(',').map(c => c.trim()).filter(ink => ink && ink !== null));
          }
        }
        if (raw.Colors) {
          if (Array.isArray(raw.Colors)) {
            detectedInks.push(...raw.Colors.filter(ink => ink && ink !== null));
          } else if (typeof raw.Colors === 'string') {
            detectedInks.push(...raw.Colors.split(',').map(c => c.trim()).filter(ink => ink && ink !== null));
          }
        }
        
        // Special case: check if card has multiple ink-related fields
        const allInkFields = [raw.ink, raw.Ink, raw.inkColor, raw.Ink_Color, raw.color, raw.Color];
        const validInks = allInkFields.filter(ink => ink && ink !== null && ink !== 'null');
        if (validInks.length > 1) {
          console.log(`[Dual-Ink Debug] ${e.card.name} has multiple ink fields:`, validInks);
          detectedInks.push(...validInks);
        }
      }
      
      // Remove duplicates and normalize ink names
      detectedInks = [...new Set(detectedInks)].filter(ink => ink && ink !== 'undefined');
      
      if (detectedInks.length > 0) {
        console.log(`[Ink Distribution Debug] Fallback detected inks for ${e.card.name}:`, detectedInks);
        
        if (detectedInks.length > 1) {
          // Dual-ink card: add to dual-ink category
          dualInkCards.push({
            name: e.card.name,
            inks: detectedInks,
            count: e.count
          });
          inkDistribution['Dual-Ink'] = (inkDistribution['Dual-Ink'] || 0) + e.count;
        } else {
          // Single ink card: add to its ink color
          detectedInks.forEach(ink => {
            inkDistribution[ink] = (inkDistribution[ink] || 0) + e.count;
          });
        }
      } else {
        console.log(`[Ink Distribution Debug] No inks detected for ${e.card.name}, skipping`);
      }
    }
  });
  
  // Debug: log dual-ink cards found
  console.log('[Ink Distribution Debug] Dual-ink cards found:', dualInkCards);
  console.log('[Ink Distribution Debug] Final inkDistribution:', inkDistribution);
  
  // Calculate average cost
  const totalCost = entries.reduce((sum, e) => sum + (getCost(e.card) * e.count), 0);
  // Guard against divide-by-zero on an empty deck (0 cards) so summary numbers
  // show 0 / 0% instead of NaN / NaN%.
  const averageCost = totalCards > 0 ? totalCost / totalCards : 0;
  const inkableRatio = totalCards > 0 ? totalInkable / totalCards : 0;
  const uninkableRatio = totalCards > 0 ? totalUninkable / totalCards : 0;
  
  // Find most expensive and cheapest cards
  const sortedByCost = entries.sort((a, b) => getCost(b.card) - getCost(a.card));
  const mostExpensive = sortedByCost[0];
  const cheapest = sortedByCost[sortedByCost.length - 1];

  // Ink-ledger entries — ONE item per card copy for the hero's <InkLedger>.
  // Each copy takes its card's primary ink (getInks()[0]; Steel when no ink is
  // detectable) and an inkability flag via the same fallback chain used for the
  // Inkable/Uninkable totals above. InkLedger regroups by ink, so order here is
  // irrelevant (safe despite the in-place sort of `entries` on the line above).
  const ledgerEntries = entries.flatMap((e) => {
    const inks = getInks(e.card);
    const ink = inks.length >= 1 ? inks[0] : 'Steel';
    const inkable = Boolean(
      e.card.inkable ??
      e.card._raw?.inkwell ??
      e.card._raw?.inkable ??
      e.card._raw?.can_be_ink ??
      e.card._raw?.Inkable ??
      false
    );
    return Array.from({ length: e.count }, () => ({ ink, inkable }));
  });

  // Signature card for the hero art crop — the deck's highest-cost card. Resolve
  // its art exactly like the card grid does; if the deck is empty (no card) the
  // panel is skipped so an empty deck never breaks the hero.
  const signatureCard = mostExpensive?.card || null;
  const signatureImg = signatureCard
    ? (signatureCard.image_url || signatureCard._imageFromAPI || FALLBACK_IMG)
    : null;
  const signatureName = (() => {
    if (!signatureCard) return '';
    const variant =
      signatureCard.title ||
      signatureCard.version ||
      signatureCard._raw?.version ||
      signatureCard._raw?.Version ||
      signatureCard.subname ||
      null;
    return variant ? `${signatureCard.name} — ${variant}` : signatureCard.name;
  })();
  
  
  // Helper function to draw fallback card content
  function drawFallbackCard(ctx, x, y, width, height, card) {
    // Card background - darker to indicate missing image
    ctx.fillStyle = '#1a202c';
    ctx.fillRect(x, y, width, height);
    
    // Card border
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    
    // Card name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.textAlign = 'center';
    
    // Wrap text if too long
    const maxWidth = width - 10;
    const words = (card.name || 'Unknown').split(' ');
    let line = '';
    let lineY = y + 20;
    
    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + ' ';
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > maxWidth && i > 0) {
        ctx.fillText(line, x + width / 2, lineY);
        line = words[i] + ' ';
        lineY += 15;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x + width / 2, lineY);
    
    // Card cost (more prominent)
    const cost = getCost(card);
    if (cost !== undefined) {
      ctx.font = 'bold 14px Arial, sans-serif';
      ctx.fillStyle = '#10b981';
      ctx.fillText(`Cost: ${cost}`, x + width / 2, lineY + 25);
    }
    
    // Card details
    ctx.font = '10px Arial, sans-serif';
    ctx.fillStyle = '#a0aec0';
    
    if (card.set) {
      ctx.fillText(`Set: ${card.set}`, x + width / 2, lineY + 40);
    }
    
    if (card.number) {
      ctx.fillText(`#${card.number}`, x + width / 2, lineY + 55);
    }
  }
  
  return (
    <div className="space-y-6">
      {showCardsSection && (
        <>
        {/* Deck hero — editable title, quick stats, and the signature ink-ledger
            on the left; a card-art crop of the deck's signature card on the
            right (design/comps/uninkable-deck-detail-comp.html: .hero). */}
        <div
          className="rounded-lg border overflow-hidden p-7 grid gap-8 md:grid-cols-[1.25fr_.9fr]"
          style={{
            borderColor: 'var(--line)',
            background:
              'radial-gradient(120% 160% at 0% 0%, color-mix(in srgb, var(--ink-a) 9%, transparent), transparent 55%), radial-gradient(120% 160% at 100% 100%, color-mix(in srgb, var(--ink-b) 10%, transparent), transparent 55%), var(--panel)',
          }}
        >
          <div>
            <div className="mb-4">
              <label
                className="block text-[11px] uppercase tracking-[0.14em] font-semibold mb-2"
                style={{ color: 'var(--faint)' }}
              >
                Deck Name
              </label>
              <input
                type="text"
                value={deckName}
                onChange={(e) => setDeckName(e.target.value)}
                className="font-display w-full px-4 py-2 rounded-lg border focus:outline-none text-3xl"
                style={{
                  background: 'var(--panel)',
                  borderColor: 'var(--line-2)',
                  color: 'var(--text)',
                  fontWeight: 560,
                  letterSpacing: '-0.01em',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--sapphire)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--line-2)')}
                placeholder="Enter deck name..."
              />
            </div>
            <p className="font-display italic mt-2" style={{ color: 'var(--muted)' }}>A Lorcana Deck</p>
            {onEditInLab && (
              <button
                type="button"
                onClick={onEditInLab}
                className="mt-2 text-sm underline underline-offset-2 transition-colors"
                style={{ color: 'var(--sapphire)' }}
              >
                Edit in Deck Lab
              </button>
            )}
            {deck.updatedAt && (
              <p className="text-xs mt-1" style={{ color: 'var(--faint)' }}>
                Last saved: {new Date(deck.updatedAt).toLocaleString()}
              </p>
            )}

            {/* Quick stats — mirror the comp hero's statrow. Reads the existing
                computed values (unchanged), just surfaced up here too. */}
            <div className="flex flex-wrap gap-7 mt-6">
              {[
                { k: 'Cards', v: totalCards },
                { k: 'Uninkable', v: totalUninkable },
                { k: 'Avg cost', v: averageCost.toFixed(1) },
              ].map((s) => (
                <div key={s.k}>
                  <div className="font-display tabular-nums" style={{ fontSize: 22, fontWeight: 560, color: 'var(--text)' }}>{s.v}</div>
                  <div className="text-[11px] uppercase tracking-[0.1em] mt-0.5" style={{ color: 'var(--faint)' }}>{s.k}</div>
                </div>
              ))}
            </div>

            {/* Signature element: the ink ledger — one hex per card copy, colored
                by ink, hollow when uninkable (comp .ledger / .strip). */}
            {ledgerEntries.length > 0 && (
              <div className="mt-6">
                <div className="text-[11px] uppercase tracking-[0.1em] mb-2" style={{ color: 'var(--faint)' }}>
                  Ink ledger · <b style={{ color: 'var(--muted)', fontWeight: 600 }}>hollow = uninkable</b>
                </div>
                <InkLedger entries={ledgerEntries} />
              </div>
            )}
          </div>

          {/* Signature card art crop (comp .art). Skipped entirely when there's
              no card to feature, so an empty deck never renders a broken panel. */}
          {signatureCard && (
            <div
              className="relative rounded-md overflow-hidden min-h-[300px] border"
              style={{ borderColor: 'var(--line-2)', background: '#0b0c0f' }}
            >
              <img
                src={signatureImg}
                alt={signatureName}
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
              />
              <div
                className="absolute inset-x-0 bottom-0 flex items-baseline justify-between gap-3 p-4"
                style={{ background: 'linear-gradient(to top, rgba(11,12,15,.85), transparent 90%)' }}
              >
                <div
                  className="font-display"
                  style={{ fontSize: 17, fontWeight: 560, color: '#fff', textShadow: '0 1px 8px rgba(0,0,0,.6)' }}
                >
                  {signatureName}
                </div>
                <div className="text-[10.5px] uppercase tracking-[0.12em] whitespace-nowrap" style={{ color: 'rgba(255,255,255,.75)' }}>
                  Signature card
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Card Images Grid - Organized by Type and Cost */}
        <div className="rounded-lg p-4 border border-line bg-raised">
          <h3 className="font-display text-lg mb-4 text-center">Deck Cards</h3>
          
          {/* Character Cards */}
          {(() => {
            const characterCards = entries.filter(e => normalizedType(e.card) === 'Character').sort((a, b) => getCost(a.card) - getCost(b.card));
            if (characterCards.length > 0) {
              return (
                <div className="mb-6">
                  <h4 className="font-display text-base mb-3 text-center" style={{ color: 'var(--sapphire)' }}>Character Cards</h4>
                  <div className="grid justify-center gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, 160px)' }}>
                    {characterCards.map((e) => (
                      <div key={deckKey(e.card)} className="relative w-[160px]">
                        <div className="rounded-lg overflow-hidden shadow-lg ring-1 ring-black/40">
                          <img 
                            src={e.card.image_url || e.card._imageFromAPI || FALLBACK_IMG} 
                            alt={e.card.name} 
                            className="block w-full h-[224px] object-cover bg-overlay"
                            loading="lazy"
                          />
                        </div>
                        <div className="absolute -top-2.5 -right-2.5 z-10">
                          <div className="relative">
                            {onAdjustCount ? (
                              <div className="flex items-center gap-0.5 bg-black/85 rounded-full shadow-[0_4px_8px_rgba(0,0,0,0.6)] ring-1 ring-[color:var(--line-2)] pl-0.5 pr-1 py-0.5" style={{ color: 'var(--text)' }}>
                                <button
                                  type="button"
                                  onClick={() => onAdjustCount(e.card, -1)}
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold hover:bg-[color:var(--line-2)] transition"
                                  aria-label={`Remove one ${e.card.name}`}
                                >
                                  −
                                </button>
                                <span className="text-sm font-bold tracking-tight tabular-nums w-4 text-center">{e.count}</span>
                                <button
                                  type="button"
                                  onClick={() => onAdjustCount(e.card, 1)}
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold hover:brightness-110 transition" style={{ background: 'var(--sapphire)', color: '#0b1620' }}
                                  aria-label={`Add one ${e.card.name}`}
                                >
                                  +
                                </button>
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-black/85 flex items-center justify-center text-sm font-bold tracking-tight shadow-[0_4px_8px_rgba(0,0,0,0.6)] ring-1 ring-[color:var(--line-2)]" style={{ color: 'var(--text)' }}>
                                {e.count}
                              </div>
                            )}
                            <div className="absolute -bottom-1 right-0.5 w-0 h-0 border-l-[8px] border-l-transparent border-t-[8px] border-t-black/80" />
                          </div>
                        </div>
                        <div className="mt-2 text-center">
                          {/* Smart display name with variant/subtitle */}
                          {(() => {
                            // Prefer the variant/subtitle if present
                            const variant =
                              e.card.title ||
                              e.card.version ||
                              e.card._raw?.version ||
                              e.card._raw?.Version ||
                              e.card.subname ||
                              null;

                            const displayName = variant ? `${e.card.name} — ${variant}` : e.card.name;

                            return (
                              <div
                                className="text-sm font-semibold line-clamp-2 leading-tight px-1" style={{ color: 'var(--text)' }}
                                title={displayName}         // full hover tooltip
                                aria-label={displayName}
                              >
                                {displayName}
                              </div>
                            );
                          })()}
                          
                          {/* Card type + cost — cost hex tinted by the card's ink */}
                          <div className="mt-1 flex items-center justify-center gap-1.5">
                            <CostHex cost={getCost(e.card)} ink={getInks(e.card)[0] || 'Steel'} size={20} />
                            <span className="text-xs line-clamp-1 leading-tight" style={{ color: 'var(--muted)' }}>
                              {normalizedType(e.card)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            return null;
          })()}
          
          {/* Action Cards */}
          {(() => {
            const actionCards = entries.filter(e => normalizedType(e.card) === 'Action').sort((a, b) => getCost(a.card) - getCost(b.card));
            if (actionCards.length > 0) {
              return (
                <div className="mb-6">
                  <h4 className="font-display text-base mb-3 text-center" style={{ color: 'var(--emerald)' }}>Action Cards</h4>
                  <div className="grid justify-center gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, 160px)' }}>
                    {actionCards.map((e) => (
                      <div key={deckKey(e.card)} className="relative w-[160px]">
                        <div className="rounded-lg overflow-hidden shadow-lg ring-1 ring-black/40">
                          <img 
                            src={e.card.image_url || e.card._imageFromAPI || FALLBACK_IMG} 
                            alt={e.card.name} 
                            className="block w-full h-[224px] object-cover bg-overlay"
                            loading="lazy"
                          />
                        </div>
                        <div className="absolute -top-2.5 -right-2.5 z-10">
                          <div className="relative">
                            {onAdjustCount ? (
                              <div className="flex items-center gap-0.5 bg-black/85 rounded-full shadow-[0_4px_8px_rgba(0,0,0,0.6)] ring-1 ring-[color:var(--line-2)] pl-0.5 pr-1 py-0.5" style={{ color: 'var(--text)' }}>
                                <button
                                  type="button"
                                  onClick={() => onAdjustCount(e.card, -1)}
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold hover:bg-[color:var(--line-2)] transition"
                                  aria-label={`Remove one ${e.card.name}`}
                                >
                                  −
                                </button>
                                <span className="text-sm font-bold tracking-tight tabular-nums w-4 text-center">{e.count}</span>
                                <button
                                  type="button"
                                  onClick={() => onAdjustCount(e.card, 1)}
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold hover:brightness-110 transition" style={{ background: 'var(--sapphire)', color: '#0b1620' }}
                                  aria-label={`Add one ${e.card.name}`}
                                >
                                  +
                                </button>
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-black/85 flex items-center justify-center text-sm font-bold tracking-tight shadow-[0_4px_8px_rgba(0,0,0,0.6)] ring-1 ring-[color:var(--line-2)]" style={{ color: 'var(--text)' }}>
                                {e.count}
                              </div>
                            )}
                            <div className="absolute -bottom-1 right-0.5 w-0 h-0 border-l-[8px] border-l-transparent border-t-[8px] border-t-black/80" />
                          </div>
                        </div>
                        <div className="mt-2 text-center">
                          {/* Smart display name with variant/subtitle */}
                          {(() => {
                            // Prefer the variant/subtitle if present
                            const variant =
                              e.card.title ||
                              e.card.version ||
                              e.card._raw?.version ||
                              e.card._raw?.Version ||
                              e.card.subname ||
                              null;

                            const displayName = variant ? `${e.card.name} — ${variant}` : e.card.name;

                            return (
                              <div
                                className="text-sm font-semibold line-clamp-2 leading-tight px-1" style={{ color: 'var(--text)' }}
                                title={displayName}         // full hover tooltip
                                aria-label={displayName}
                              >
                                {displayName}
                              </div>
                            );
                          })()}
                          
                          {/* Card type + cost — cost hex tinted by the card's ink */}
                          <div className="mt-1 flex items-center justify-center gap-1.5">
                            <CostHex cost={getCost(e.card)} ink={getInks(e.card)[0] || 'Steel'} size={20} />
                            <span className="text-xs line-clamp-1 leading-tight" style={{ color: 'var(--muted)' }}>
                              {normalizedType(e.card)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            return null;
          })()}
          
          {/* Song Cards */}
          {(() => {
            const songCards = entries.filter(e => normalizedType(e.card) === 'Song').sort((a, b) => getCost(a.card) - getCost(b.card));
            if (songCards.length > 0) {
              return (
                <div className="mb-6">
                  <h4 className="font-display text-base mb-3 text-center" style={{ color: 'var(--amethyst)' }}>Song Cards</h4>
                  <div className="grid justify-center gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, 160px)' }}>
                    {songCards.map((e) => (
                      <div key={deckKey(e.card)} className="relative w-[160px]">
                        <div className="rounded-lg overflow-hidden shadow-lg ring-1 ring-black/40">
                          <img 
                            src={e.card.image_url || e.card._imageFromAPI || FALLBACK_IMG} 
                            alt={e.card.name} 
                            className="block w-full h-[224px] object-cover bg-overlay"
                            loading="lazy"
                          />
                        </div>
                        <div className="absolute -top-2.5 -right-2.5 z-10">
                          <div className="relative">
                            {onAdjustCount ? (
                              <div className="flex items-center gap-0.5 bg-black/85 rounded-full shadow-[0_4px_8px_rgba(0,0,0,0.6)] ring-1 ring-[color:var(--line-2)] pl-0.5 pr-1 py-0.5" style={{ color: 'var(--text)' }}>
                                <button
                                  type="button"
                                  onClick={() => onAdjustCount(e.card, -1)}
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold hover:bg-[color:var(--line-2)] transition"
                                  aria-label={`Remove one ${e.card.name}`}
                                >
                                  −
                                </button>
                                <span className="text-sm font-bold tracking-tight tabular-nums w-4 text-center">{e.count}</span>
                                <button
                                  type="button"
                                  onClick={() => onAdjustCount(e.card, 1)}
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold hover:brightness-110 transition" style={{ background: 'var(--sapphire)', color: '#0b1620' }}
                                  aria-label={`Add one ${e.card.name}`}
                                >
                                  +
                                </button>
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-black/85 flex items-center justify-center text-sm font-bold tracking-tight shadow-[0_4px_8px_rgba(0,0,0,0.6)] ring-1 ring-[color:var(--line-2)]" style={{ color: 'var(--text)' }}>
                                {e.count}
                              </div>
                            )}
                            <div className="absolute -bottom-1 right-0.5 w-0 h-0 border-l-[8px] border-l-transparent border-t-[8px] border-t-black/80" />
                          </div>
                        </div>
                        <div className="mt-2 text-center">
                          {/* Smart display name with variant/subtitle */}
                          {(() => {
                            // Prefer the variant/subtitle if present
                            const variant =
                              e.card.title ||
                              e.card.version ||
                              e.card._raw?.version ||
                              e.card._raw?.Version ||
                              e.card.subname ||
                              null;

                            const displayName = variant ? `${e.card.name} — ${variant}` : e.card.name;

                            return (
                              <div
                                className="text-sm font-semibold line-clamp-2 leading-tight px-1" style={{ color: 'var(--text)' }}
                                title={displayName}         // full hover tooltip
                                aria-label={displayName}
                              >
                                {displayName}
                              </div>
                            );
                          })()}
                          
                          {/* Card type + cost — cost hex tinted by the card's ink */}
                          <div className="mt-1 flex items-center justify-center gap-1.5">
                            <CostHex cost={getCost(e.card)} ink={getInks(e.card)[0] || 'Steel'} size={20} />
                            <span className="text-xs line-clamp-1 leading-tight" style={{ color: 'var(--muted)' }}>
                              {normalizedType(e.card)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            return null;
          })()}
          
          {/* Item Cards */}
          {(() => {
            const itemCards = entries.filter(e => normalizedType(e.card) === 'Item').sort((a, b) => getCost(a.card) - getCost(b.card));
            if (itemCards.length > 0) {
              return (
                <div className="mb-6">
                  <h4 className="font-display text-base mb-3 text-center" style={{ color: 'var(--amber)' }}>Item Cards</h4>
                  <div className="grid justify-center gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, 160px)' }}>
                    {itemCards.map((e) => (
                      <div key={deckKey(e.card)} className="relative w-[160px]">
                        <div className="rounded-lg overflow-hidden shadow-lg ring-1 ring-black/40">
                          <img 
                            src={e.card.image_url || e.card._imageFromAPI || FALLBACK_IMG} 
                            alt={e.card.name} 
                            className="block w-full h-[224px] object-cover bg-overlay"
                            loading="lazy"
                          />
                        </div>
                        <div className="absolute -top-2.5 -right-2.5 z-10">
                          <div className="relative">
                            {onAdjustCount ? (
                              <div className="flex items-center gap-0.5 bg-black/85 rounded-full shadow-[0_4px_8px_rgba(0,0,0,0.6)] ring-1 ring-[color:var(--line-2)] pl-0.5 pr-1 py-0.5" style={{ color: 'var(--text)' }}>
                                <button
                                  type="button"
                                  onClick={() => onAdjustCount(e.card, -1)}
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold hover:bg-[color:var(--line-2)] transition"
                                  aria-label={`Remove one ${e.card.name}`}
                                >
                                  −
                                </button>
                                <span className="text-sm font-bold tracking-tight tabular-nums w-4 text-center">{e.count}</span>
                                <button
                                  type="button"
                                  onClick={() => onAdjustCount(e.card, 1)}
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold hover:brightness-110 transition" style={{ background: 'var(--sapphire)', color: '#0b1620' }}
                                  aria-label={`Add one ${e.card.name}`}
                                >
                                  +
                                </button>
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-black/85 flex items-center justify-center text-sm font-bold tracking-tight shadow-[0_4px_8px_rgba(0,0,0,0.6)] ring-1 ring-[color:var(--line-2)]" style={{ color: 'var(--text)' }}>
                                {e.count}
                              </div>
                            )}
                            <div className="absolute -bottom-1 right-0.5 w-0 h-0 border-l-[8px] border-l-transparent border-t-[8px] border-t-black/80" />
                          </div>
                        </div>
                        <div className="mt-2 text-center">
                          {/* Smart display name with variant/subtitle */}
                          {(() => {
                            // Prefer the variant/subtitle if present
                            const variant =
                              e.card.title ||
                              e.card.version ||
                              e.card._raw?.version ||
                              e.card._raw?.Version ||
                              e.card.subname ||
                              null;

                            const displayName = variant ? `${e.card.name} — ${variant}` : e.card.name;

                            return (
                              <div
                                className="text-sm font-semibold line-clamp-2 leading-tight px-1" style={{ color: 'var(--text)' }}
                                title={displayName}         // full hover tooltip
                                aria-label={displayName}
                              >
                                {displayName}
                              </div>
                            );
                          })()}
                          
                          {/* Card type + cost — cost hex tinted by the card's ink */}
                          <div className="mt-1 flex items-center justify-center gap-1.5">
                            <CostHex cost={getCost(e.card)} ink={getInks(e.card)[0] || 'Steel'} size={20} />
                            <span className="text-xs line-clamp-1 leading-tight" style={{ color: 'var(--muted)' }}>
                              {normalizedType(e.card)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            return null;
          })()}
          
          {/* Location Cards */}
          {(() => {
            const locationCards = entries.filter(e => normalizedType(e.card) === 'Location').sort((a, b) => getCost(a.card) - getCost(b.card));
            if (locationCards.length > 0) {
              return (
                <div className="mb-6">
                  <h4 className="font-display text-base mb-3 text-center" style={{ color: 'var(--ruby)' }}>Location Cards</h4>
                  <div className="grid justify-center gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, 160px)' }}>
                    {locationCards.map((e) => (
                      <div key={deckKey(e.card)} className="relative w-[160px]">
                        <div className="rounded-lg overflow-hidden shadow-lg ring-1 ring-black/40">
                          <img 
                            src={e.card.image_url || e.card._imageFromAPI || FALLBACK_IMG} 
                            alt={e.card.name} 
                            className="block w-full h-[224px] object-cover bg-overlay"
                            loading="lazy"
                          />
                        </div>
                        <div className="absolute -top-2.5 -right-2.5 z-10">
                          <div className="relative">
                            {onAdjustCount ? (
                              <div className="flex items-center gap-0.5 bg-black/85 rounded-full shadow-[0_4px_8px_rgba(0,0,0,0.6)] ring-1 ring-[color:var(--line-2)] pl-0.5 pr-1 py-0.5" style={{ color: 'var(--text)' }}>
                                <button
                                  type="button"
                                  onClick={() => onAdjustCount(e.card, -1)}
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold hover:bg-[color:var(--line-2)] transition"
                                  aria-label={`Remove one ${e.card.name}`}
                                >
                                  −
                                </button>
                                <span className="text-sm font-bold tracking-tight tabular-nums w-4 text-center">{e.count}</span>
                                <button
                                  type="button"
                                  onClick={() => onAdjustCount(e.card, 1)}
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold hover:brightness-110 transition" style={{ background: 'var(--sapphire)', color: '#0b1620' }}
                                  aria-label={`Add one ${e.card.name}`}
                                >
                                  +
                                </button>
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-black/85 flex items-center justify-center text-sm font-bold tracking-tight shadow-[0_4px_8px_rgba(0,0,0,0.6)] ring-1 ring-[color:var(--line-2)]" style={{ color: 'var(--text)' }}>
                                {e.count}
                              </div>
                            )}
                            <div className="absolute -bottom-1 right-0.5 w-0 h-0 border-l-[8px] border-l-transparent border-t-[8px] border-t-black/80" />
                          </div>
                        </div>
                        <div className="mt-2 text-center">
                          {/* Smart display name with variant/subtitle */}
                          {(() => {
                            // Prefer the variant/subtitle if present
                            const variant =
                              e.card.title ||
                              e.card.version ||
                              e.card._raw?.version ||
                              e.card._raw?.Version ||
                              e.card.subname ||
                              null;

                            const displayName = variant ? `${e.card.name} — ${variant}` : e.card.name;

                            return (
                              <div
                                className="text-sm font-semibold line-clamp-2 leading-tight px-1" style={{ color: 'var(--text)' }}
                                title={displayName}         // full hover tooltip
                                aria-label={displayName}
                              >
                                {displayName}
                              </div>
                            );
                          })()}
                          
                          {/* Card type + cost — cost hex tinted by the card's ink */}
                          <div className="mt-1 flex items-center justify-center gap-1.5">
                            <CostHex cost={getCost(e.card)} ink={getInks(e.card)[0] || 'Steel'} size={20} />
                            <span className="text-xs line-clamp-1 leading-tight" style={{ color: 'var(--muted)' }}>
                              {normalizedType(e.card)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            return null;
          })()}
        </div>
        </>
      )}

      {showInfoSection && (
        <>
        {/* Basic Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Cards', value: totalCards, accent: '--sapphire' },
            { label: 'Inkable', value: totalInkable, accent: '--emerald' },
            { label: 'Uninkable', value: totalUninkable, accent: '--ruby' },
            { label: 'Avg Cost', value: averageCost.toFixed(1), accent: '--amber' },
          ].map((s) => (
            <div key={s.label} className="rounded-lg p-4 text-center border border-line bg-raised">
              <div className="font-display text-2xl tabular-nums" style={{ color: `var(${s.accent})`, fontWeight: 560 }}>{s.value}</div>
              <div className="text-[11px] uppercase tracking-[0.1em] font-semibold mt-1" style={{ color: 'var(--faint)' }}>{s.label}</div>
            </div>
          ))}
        </div>
        
        {/* Deck Health Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg p-4 text-center border border-line bg-raised">
            <div className="font-display text-base mb-2" style={{ color: 'var(--text)' }}>Deck Size</div>
            <div className="text-2xl font-bold tabular-nums" style={{ color: totalCards === 60 ? 'var(--emerald)' : totalCards >= 55 && totalCards <= 65 ? 'var(--amber)' : 'var(--ruby)' }}>
              {totalCards}/60
            </div>
            <div className="text-xs" style={{ color: 'var(--faint)' }}>
              {totalCards === 60 ? 'Perfect!' : totalCards >= 55 && totalCards <= 65 ? 'Close' : 'Needs adjustment'}
            </div>
          </div>

          <div className="rounded-lg p-4 text-center border border-line bg-raised">
            <div className="font-display text-base mb-2" style={{ color: 'var(--text)' }}>Inkable Ratio</div>
            <div className="text-2xl font-bold tabular-nums" style={{ color: inkableRatio >= 0.7 ? 'var(--emerald)' : inkableRatio >= 0.6 ? 'var(--amber)' : 'var(--ruby)' }}>
              {(inkableRatio * 100).toFixed(0)}%
            </div>
            <div className="text-xs" style={{ color: 'var(--faint)' }}>
              {inkableRatio >= 0.7 ? 'Good' : inkableRatio >= 0.6 ? 'Acceptable' : 'Low'}
            </div>
          </div>

          <div className="rounded-lg p-4 text-center border border-line bg-raised">
            <div className="font-display text-base mb-2" style={{ color: 'var(--text)' }}>Cost Balance</div>
            <div className="text-2xl font-bold tabular-nums" style={{ color: averageCost >= 2.5 && averageCost <= 4.5 ? 'var(--emerald)' : averageCost >= 2.0 && averageCost <= 5.0 ? 'var(--amber)' : 'var(--ruby)' }}>
              {averageCost.toFixed(1)}
            </div>
            <div className="text-xs" style={{ color: 'var(--faint)' }}>
              {averageCost >= 2.5 && averageCost <= 4.5 ? 'Balanced' : averageCost >= 2.0 && averageCost <= 5.0 ? 'Moderate' : 'Extreme'}
            </div>
          </div>
        </div>
        
        {/* Cost Curve Chart — CSS-only, token-colored InkCurve (comp .curve),
            stacked by the deck's ink colors instead of a single hardcoded blue. */}
        <div className="rounded-lg p-4 border border-line bg-raised">
          <h3 className="font-display text-lg mb-4 text-center">Cost Curve</h3>
          <InkCurve buckets={curveBuckets} height={200} />
        </div>
        
        {/* Type Distribution Pie Chart */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-lg p-4 border border-line bg-raised">
            <h3 className="font-display text-lg mb-4 text-center">Card Types</h3>
            <div className="space-y-2">
              {Object.entries(typeDistribution).map(([type, count]) => {
                const percentage = totalCards > 0 ? ((count / totalCards) * 100).toFixed(1) : '0';
                const typeInk = {
                  'Character': '--ruby',
                  'Action': '--sapphire',
                  'Item': '--emerald',
                  'Location': '--amethyst',
                  'Song': '--amber'
                };
                return (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: `var(${typeInk[type] || '--steel'})` }} />
                      <span className="text-sm" style={{ color: 'var(--text)' }}>{type}</span>
                    </div>
                    <div className="text-sm font-semibold tabular-nums" style={{ color: 'var(--muted)' }}>{count} ({percentage}%)</div>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Ink Color Distribution */}
          <div className="rounded-lg p-4 border border-line bg-raised">
            <h3 className="font-display text-lg mb-4 text-center">Ink Colors</h3>

            {Object.keys(inkDistribution).length > 0 ? (
              <>
                {/* Ink split — each ink's share as one quiet token-colored bar
                    (comp .split), above the detailed pie/legend. */}
                <InkSplitBar
                  className="mb-4"
                  segments={Object.entries(inkDistribution).map(([ink, count]) => ({ ink, count }))}
                />
                {/* Recharts pie: SVG <Cell> fills can't resolve CSS var(), so
                    drive them from the tokens' hex values (INK_TOKEN_HEX). */}
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={Object.entries(inkDistribution).map(([ink, count]) => ({
                        name: ink,
                        value: count
                      }))}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={80}
                    >
                      {Object.entries(inkDistribution).map(([ink, count], index) => (
                        <Cell key={`cell-${index}`} fill={INK_TOKEN_HEX[ink] || INK_TOKEN_HEX.Steel} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [value, name]} />
                  </PieChart>
                </ResponsiveContainer>

                {/* Bug B fix: this legend used to sit INSIDE <PieChart> (an SVG
                    subtree) so it never rendered. It's now a sibling of the
                    chart, and its swatches resolve through the ink tokens. */}
                <div className="mt-3 flex flex-wrap justify-center gap-4">
                  {Object.entries(inkDistribution).map(([ink, count], index) => {
                    // Percentage against actual deck size, not the ink total.
                    const percentage = totalCards > 0 ? ((count / totalCards) * 100).toFixed(0) : '0';
                    return (
                      <div key={index} className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: ink === 'Dual-Ink' ? 'var(--amber)' : inkVar(ink) }}
                        />
                        <span className="text-sm" style={{ color: 'var(--muted)' }}>{ink}</span>
                        <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text)' }}>{percentage}%</span>
                        <span className="text-xs tabular-nums" style={{ color: 'var(--faint)' }}>({count})</span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="text-center py-8" style={{ color: 'var(--muted)' }}>
                <p>No ink color data available</p>
                <p className="text-sm mt-2">Debug: inkDistribution = {JSON.stringify(inkDistribution)}</p>
                <p className="text-sm mt-2">Total cards: {totalCards}</p>
                <p className="text-sm mt-2">Entries length: {entries?.length || 0}</p>
              </div>
            )}
          </div>
        </div>
        

        
        {/* Additional Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Cost Analysis - Hidden per user request */}
          {/* <div className="rounded-lg p-4 border border-line bg-raised">
            <h4 className="font-semibold mb-2 text-center">Cost Analysis</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Most Expensive:</span>
                <span className="font-semibold">{mostExpensive?.card.name} (Cost {getCost(mostExpensive?.card)})</span>
              </div>
              <div className="flex justify-between">
                <span>Cheapest:</span>
                <span className="font-semibold">{cheapest?.card.name} (Cost {getCost(cheapest?.card)})</span>
              </div>
              <div className="flex justify-between">
                <span>Total Cost:</span>
                <span className="font-semibold">{totalCost}</span>
              </div>
            </div>
          </div> */}
          
          <div className="rounded-lg p-4 border border-line bg-raised">
            <h4 className="font-display text-base mb-2 text-center" style={{ color: 'var(--text)' }}>Deck Composition</h4>
            <div className="space-y-1 text-sm" style={{ color: 'var(--muted)' }}>
              <div className="flex justify-between">
                <span>Inkable Ratio:</span>
                <span className="font-semibold tabular-nums" style={{ color: 'var(--text)' }}>{(inkableRatio * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Uninkable Ratio:</span>
                <span className="font-semibold tabular-nums" style={{ color: 'var(--text)' }}>{(uninkableRatio * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Unique Cards:</span>
                <span className="font-semibold tabular-nums" style={{ color: 'var(--text)' }}>{entries.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* NEW COMPETITIVE ANALYSIS IN DECK MODAL */}
        <div className="rounded-lg p-6 mt-6 border border-line bg-raised">
          <h3 className="font-display text-2xl text-center mb-6" style={{ color: 'var(--emerald)' }}>🎯 Competitive Analysis</h3>
          
          {(() => {
            // Calculate data for competitive analysis in modal
            const cards = entries.flatMap(e => Array(e.count).fill(e.card));
            
            // Meta curve templates for comparison
            const metaCurves = {
              "Aggro": { "1": 8, "2": 12, "3": 8, "4": 6, "5": 4, "6": 2, "7+": 0 },
              "Midrange": { "1": 4, "2": 8, "3": 10, "4": 8, "5": 6, "6": 4, "7+": 0 },
              "Control": { "1": 2, "2": 6, "3": 8, "4": 8, "5": 6, "6": 6, "7+": 4 },
              "Ramp": { "1": 2, "2": 4, "3": 6, "4": 6, "5": 8, "6": 8, "7+": 6 }
            };

            // Curve with inkable/uninkable breakdown + meta comparison
            const curveData = (() => {
              const buckets = {};
              const deckSize = cards.length;
              
              // Initialize buckets
              const order = ["0","1","2","3","4","5","6","7+"];
              order.forEach(key => {
                buckets[key] = { cost: key, inkable: 0, uninkable: 0, total: 0 };
              });
              
              // Fill with deck data
              cards.forEach(c => {
                const cost = Math.min(Math.max(Number(c.cost ?? 0), 0), 8);
                const key = cost >= 7 ? "7+" : String(cost);
                buckets[key].total++;
                const isInkable = Boolean(c.inkable ?? c._raw?.inkwell ?? c._raw?.inkable ?? false);
                (isInkable ? buckets[key].inkable++ : buckets[key].uninkable++);
              });
              
              // Add meta comparison (scaled to deck size)
              return order.map(k => {
                const bucket = buckets[k];
                const result = { ...bucket };
                
                // Add meta curves (scaled to percentage of 60-card deck)
                Object.entries(metaCurves).forEach(([archetype, curve]) => {
                  const metaCount = curve[k] || 0;
                  result[`meta_${archetype.toLowerCase()}`] = deckSize > 0 ? (metaCount / 60) * deckSize : 0;
                });
                
                return result;
              }).filter(k => k.total > 0 || Object.keys(metaCurves).some(arch => k[`meta_${arch.toLowerCase()}`] > 0));
            })();

            // Draw consistency analysis
            const drawConsistency = (() => {
              let drawCount = 0, searchCount = 0, rawDrawPieces = 0;
              const detectedCards = { draw: [], search: [], combined: [] };
              
              const textOf = c => (c?.text || c?.rulesText || c?.Body_Text || "").toString();
              const RX_DRAW = /draw|draws|draw a card|draw two|card advantage|gain\s+a\s+card|gain\s+cards|add.*to.*hand|put.*(?:a\s+card|cards?).*into\s+your\s+hand/i;
              const RX_SEARCH = /search|look at|reveal|scry|find|choose.*card.*hand|choose.*put.*hand|select.*card.*hand|put.*on top|put.*on bottom|shuffle|arrange/i;
              
              cards.forEach(c => {
                const t = textOf(c);
                if (RX_DRAW.test(t)) { 
                  drawCount++; 
                  rawDrawPieces++; 
                  detectedCards.draw.push(c.name);
                  detectedCards.combined.push(c.name);
                }
                if (RX_SEARCH.test(t)) { 
                  searchCount++; 
                  rawDrawPieces++; 
                  detectedCards.search.push(c.name);
                  if (!detectedCards.combined.includes(c.name)) {
                    detectedCards.combined.push(c.name);
                  }
                }
              });
              const density = (rawDrawPieces / Math.max(cards.length, 1)) * 100;
              return { 
                drawCount, 
                searchCount, 
                density: Number(density.toFixed(1)),
                detectedCards 
              };
            })();

            // Synergies detection
            const synergies = [];
            // Add basic synergy detection here...

            return (
              <div>
                {/* Enhanced Cost Curve with Meta Comparison */}
                <div className="rounded-lg p-4 mb-6 border" style={{ background: 'var(--panel-2)', borderColor: 'var(--line)' }}>
                  <h4 className="text-lg font-semibold mb-3" style={{ color: 'var(--emerald)' }}>🏗️ Enhanced Cost Curve</h4>
                  <EnhancedCurveChart data={curveData} />
                </div>



                {/* Draw Probability Calculator */}
                <div className="rounded-lg p-4 mb-6 border" style={{ background: 'var(--panel-2)', borderColor: 'var(--line)' }}>
                  <h4 className="text-lg font-semibold mb-3" style={{ color: 'var(--emerald)' }}>🎯 Draw Probability Calculator</h4>
                  <DrawProbabilityTool deck={entries} />
                </div>

                {/* Turn-by-Turn Draw Simulator */}
                <div className="rounded-lg p-4 mb-6 border" style={{ background: 'var(--panel-2)', borderColor: 'var(--line)' }}>
                  <h4 className="text-lg font-semibold mb-3" style={{ color: 'var(--emerald)' }}>🎲 Turn-by-Turn Draw Simulator</h4>
                  <DrawSimulator deck={entries} />
                </div>

                {/* Consistency & Role Analysis */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Draw Consistency */}
                  <div className="rounded-lg p-4 border" style={{ background: 'var(--panel-2)', borderColor: 'var(--line)' }}>
                    <h4 className="text-lg font-semibold mb-3" style={{ color: 'var(--emerald)' }}>Consistency</h4>
                    <div className="space-y-3 text-sm">
                      <HoverableStatLine 
                        label="Draw pieces" 
                        value={drawConsistency.drawCount} 
                        cards={drawConsistency.detectedCards.draw}
                      />
                      <HoverableStatLine 
                        label="Search/Dig pieces" 
                        value={drawConsistency.searchCount} 
                        cards={drawConsistency.detectedCards.search}
                      />
                      <HoverableStatLine 
                        label="Card advantage density" 
                        value={`${drawConsistency.density}% of deck`} 
                        cards={drawConsistency.detectedCards.combined}
                      />
                      <p className="text-xs mt-2" style={{ color: 'var(--faint)' }}>Heuristic: scans rules text for draw/search verbs.</p>
                    </div>
                  </div>

                  {/* Synergies - Hidden per user request */}
                  {/* <div className="rounded-lg p-4 border" style={{ background: 'var(--panel-2)', borderColor: 'var(--line)' }}>
                    <h4 className="text-lg font-semibold mb-3" style={{ color: 'var(--emerald)' }}>Synergies</h4>
                    {synergies.length > 0 ? (
                      <div className="space-y-2">
                        <ul className="space-y-1 text-sm">
                          {synergies.map((s, i) => (
                            <li key={i} className="text-xs" style={{ color: 'var(--emerald)' }}>• {s}</li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="text-sm" style={{ color: 'var(--faint)' }}>No obvious synergies detected.</p>
                    )}
                  </div> */}
                </div>
              </div>
            );
          })()}
        </div>



        {/* OLD Comp Dashboard - TEMPORARILY DISABLED TO SHOW NEW FEATURES */}
        {false && <div className="rounded-lg p-6 border" style={{ background: 'var(--panel-2)', borderColor: 'var(--line)' }}>
          <h3 className="text-2xl font-bold text-center mb-6" style={{ color: 'var(--emerald)' }}>OLD Competitive Analysis</h3>
          
          {/* Comp Dashboard Data Calculations */}
          {(() => {
            // Debug: Log deck structure
            console.log('[Comp Dashboard] Deck object:', deck);
            console.log('[Comp Dashboard] Deck entries:', deck?.entries);
            console.log('[Comp Dashboard] Deck entries keys:', Object.keys(deck?.entries || {}));
            
            // Create cards array from deck entries
            const cards = Object.values(deck?.entries || {})
              .filter(e => e.count > 0)
              .flatMap(e => Array(e.count).fill(e.card));

            console.log('[Comp Dashboard] Cards array created:', cards.length, 'cards');
            console.log('[Comp Dashboard] Sample card:', cards[0]);
            console.log('[Comp Dashboard] Sample card properties:', cards[0] ? Object.keys(cards[0]) : 'No cards');
            if (cards[0]) {
              console.log('[Comp Dashboard] Sample card text fields:', {
                text: cards[0].text,
                rulesText: cards[0].rulesText,
                _raw: cards[0]._raw,
                lore: cards[0].lore,
                cost: cards[0].cost
              });
              console.log('[Comp Dashboard] Sample card full structure:', cards[0]);
              
              // Check for any fields that might contain lore values
              const allCardFields = Object.keys(cards[0]);
              const loreRelatedFields = allCardFields.filter(field => 
                field.toLowerCase().includes('lore') || 
                field.toLowerCase().includes('quest') ||
                field.toLowerCase().includes('win')
              );
              console.log('[Comp Dashboard] Lore-related fields found:', loreRelatedFields);
              
              // Check raw fields too
              if (cards[0]._raw) {
                const allRawFields = Object.keys(cards[0]._raw);
                const rawLoreRelatedFields = allRawFields.filter(field => 
                  field.toLowerCase().includes('lore') || 
                  field.toLowerCase().includes('quest') ||
                  field.toLowerCase().includes('win')
                );
                console.log('[Comp Dashboard] Raw lore-related fields found:', rawLoreRelatedFields);
              }
            }

            // --- Curve (stacked inkable/uninkable) ---
            const curveData = (() => {
              const buckets = {};
              cards.forEach(c => {
                const cost = Math.min(Math.max(Number(c.cost ?? 0), 0), 8);
                const key = cost >= 7 ? "7+" : String(cost);
                if (!buckets[key]) buckets[key] = { cost: key, inkable: 0, uninkable: 0 };
                // Check inkable status using the same logic as elsewhere in the component
                const isInkable = Boolean(c.inkable ?? c._raw?.inkwell ?? c._raw?.inkable ?? c._raw?.can_be_ink ?? c._raw?.Inkable ?? false);
                if (isInkable) {
                  buckets[key].inkable++;
                } else {
                  buckets[key].uninkable++;
                }
              });
              const order = ["0","1","2","3","4","5","6","7+"];
              return order.filter(k => buckets[k]).map(k => buckets[k]);
            })();

            // --- Ink pie ---
            const inkPieData = (() => {
              const counts = new Map();
              cards.forEach(c => {
                // Use the same ink detection logic as elsewhere
                const inks = c.inks || c._raw?.inks || [];
                if (Array.isArray(inks)) {
                  inks.forEach(i => {
                    if (i) counts.set(i, (counts.get(i)||0)+1);
                  });
                }
              });
              return [...counts.entries()].map(([name, value]) => ({ name, value }));
            })();

            // --- Draw / consistency ---
            const drawConsistency = (() => {
              let drawCount=0, searchCount=0, rawDrawPieces=0;
              const detectedCards = { draw: [], search: [], combined: [] };
              
              cards.forEach(c => {
                // Get card text from various possible fields
                const cardText = (c.text || c.rulesText || c._raw?.text || c._raw?.rulesText || c._raw?.Body_Text || "").toString().toLowerCase();
                console.log('[Comp Dashboard] Card text for', c.name, ':', cardText);
                
                if (RX_DRAW.test(cardText)) { 
                  drawCount++; 
                  rawDrawPieces++; 
                  detectedCards.draw.push(c.name);
                  detectedCards.combined.push(c.name);
                  console.log('[Comp Dashboard] Draw card detected:', c.name);
                }
                if (RX_SEARCH.test(cardText)) { 
                  searchCount++; 
                  rawDrawPieces++; 
                  detectedCards.search.push(c.name);
                  if (!detectedCards.combined.includes(c.name)) {
                    detectedCards.combined.push(c.name);
                  }
                  console.log('[Comp Dashboard] Search card detected:', c.name);
                }
              });
              
              const density = (rawDrawPieces / Math.max(cards.length,1))*100;
              console.log('[Comp Dashboard] Draw consistency:', { 
                drawCount, 
                searchCount, 
                density, 
                totalCards: cards.length,
                detectedDrawCards: detectedCards.draw,
                detectedSearchCards: detectedCards.search
              });
              return { 
                drawCount, 
                searchCount, 
                density: Number(density.toFixed(1)),
                detectedCards 
              };
            })();

            // --- Average lore per card ---
            const avgLorePerCard = (() => {
              const totalLore = cards.reduce((a,c) => {
                // Check multiple possible lore fields
                const lore = Number(c.lore || c._raw?.Lore || c._raw?.lore || c._raw?.loreValue || 0);
                console.log('[Comp Dashboard] Card lore for', c.name, ':', {
                  c_lore: c.lore,
                  raw_Lore: c._raw?.Lore,
                  raw_lore: c._raw?.lore,
                  raw_loreValue: c._raw?.loreValue,
                  final: lore
                });
                
                // Also check if there are any other lore-related fields
                const allFields = Object.keys(c).filter(key => key.toLowerCase().includes('lore'));
                const allRawFields = Object.keys(c._raw || {}).filter(key => key.toLowerCase().includes('lore'));
                if (allFields.length > 0 || allRawFields.length > 0) {
                  console.log('[Comp Dashboard] Additional lore fields for', c.name, ':', {
                    cardFields: allFields,
                    rawFields: allRawFields
                  });
                }
                
                return a + lore;
              }, 0);
              const result = Number((totalLore / Math.max(cards.length,1)).toFixed(2));
              console.log('[Comp Dashboard] Lore calculation:', { totalLore, cardsLength: cards.length, result });
              return result;
            })();

            // --- Roles breakdown - Multi-role support ---
            const compDashboardRoleData = (() => {
              const counts = {};
              const roleAssignments = {};
              
              cards.forEach(c => {
                const roles = rolesForCard(c);
                roles.forEach(role => {
                  counts[role] = (counts[role] || 0) + 1;
                  
                  // Track which cards go into which roles
                  if (!roleAssignments[role]) roleAssignments[role] = [];
                  roleAssignments[role].push(c.name);
                });
              });
              
              return ROLE_ORDER.map(role => ({
                role,
                value: counts[role] || 0,
                cards: roleAssignments[role] || []
              }));
            })();
            
            // Make compDashboardRoleData available as 'roleData' for chart (now includes cards)
            const roleData = compDashboardRoleData;

            // --- Synergies list ---
            const synergies = (() => detectSynergies(cards))();

            return (
              <div className="space-y-6">
                {/* Curve & Cost */}
                <div>
                  <h4 className="text-lg font-semibold mb-3 text-center">Curve (Inkable vs Uninkable)</h4>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={curveData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="cost" stroke="#9CA3AF" />
                      <YAxis allowDecimals={false} stroke="#9CA3AF" />
                      <Tooltip 
                        formatter={(value, name) => [value, name === 'inkable' ? 'Inkable' : 'Uninkable']}
                        contentStyle={{
                          backgroundColor: '#1F2937',
                          border: '1px solid #374151',
                          borderRadius: '8px',
                          color: '#F9FAFB'
                        }}
                      />
                      <Legend />
                      <Bar dataKey="inkable" stackId="a" fill="#10b981" />
                      <Bar dataKey="uninkable" stackId="a" fill="#f59e0b" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Draw / Consistency */}
                <div className="rounded-lg p-4 border" style={{ background: 'var(--panel-2)', borderColor: 'var(--line)' }}>
                  <h4 className="text-lg font-semibold mb-3 text-center">Consistency</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                    <HoverableStatBox
                      value={drawConsistency.drawCount}
                      label="Draw pieces"
                      color="text-blue-400"
                      cards={drawConsistency.detectedCards?.draw || []}
                    />
                    <HoverableStatBox 
                      value={drawConsistency.searchCount}
                      label="Search/Dig pieces"
                      color="text-green-400"
                      cards={drawConsistency.detectedCards?.search || []}
                    />
                    <HoverableStatBox 
                      value={`${drawConsistency.density}%`}
                      label="Card advantage density"
                      color="text-purple-400"
                      cards={drawConsistency.detectedCards?.combined || []}
                    />
                  </div>
                  <p className="text-xs text-[color:var(--faint)] mt-3 text-center">Heuristic: scans rules text for draw/search verbs</p>
                </div>

                {/* Lore Efficiency */}
                <div className="bg-[color:var(--panel-2)] border border-[color:var(--line)] rounded-lg p-4 text-center">
                  <h4 className="text-lg font-semibold mb-2">Lore Efficiency</h4>
                  <div className="text-3xl font-bold text-[color:var(--emerald)]">{avgLorePerCard}</div>
                  <div className="text-sm text-[color:var(--muted)]">Average Lore per Card</div>
                </div>

                {/* Roles & Synergies */}
                <div>
                  <h4 className="text-lg font-semibold mb-3 text-center">Card Roles</h4>
                  {console.log('[Card Roles Chart] MAIN roleData with cards:', roleData)}
                  {console.log('[Card Roles Chart] First item cards check:', roleData[0]?.cards?.length || 'NO CARDS')}
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={roleData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="role" interval={0} angle={-10} textAnchor="end" height={60} stroke="#9CA3AF" />
                      <YAxis allowDecimals={false} stroke="#9CA3AF" />
                      <Tooltip 
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            const cards = data.cards || [];
                            
                            // Debug: Check if we can find the cards in roleData by matching the role
                            const roleMatch = roleData.find(item => item.role === data.role);
                            const fallbackCards = roleMatch?.cards || [];
                            const finalCards = cards.length > 0 ? cards : fallbackCards;
                            
                            console.log('[Card Roles Tooltip] DEBUG DETAILS:');
                            console.log('  - roleData from outer scope:', roleData);
                            console.log('  - data.role:', data.role);
                            console.log('  - roleMatch found:', roleMatch);
                            console.log('  - roleMatch?.cards:', roleMatch?.cards);
                            
                            console.log('[Card Roles Tooltip]', { 
                              label, 
                              cards, 
                              data, 
                              roleMatch, 
                              fallbackCards, 
                              finalCards 
                            });
                            
                            // Group and count cards
                            const counts = {};
                            finalCards.forEach(cardName => {
                              counts[cardName] = (counts[cardName] || 0) + 1;
                            });
                            const groupedCards = Object.entries(counts)
                              .sort((a, b) => a[0].localeCompare(b[0]))
                              .map(([name, count]) => (count > 1 ? `${count} - ${name}` : name));

                            return (
                              <div className="bg-[color:var(--panel-2)] border border-[color:var(--line-2)] rounded-lg shadow-lg p-3 max-w-sm">
                                <p className="text-[color:var(--text)] font-semibold mb-1">{label}: {payload[0].value} cards</p>
                                {finalCards.length > 0 ? (
                                  <>
                                    <div className="text-[color:var(--muted)] text-sm">Cards:</div>
                                    <div className="space-y-0.5 max-h-48 overflow-y-auto">
                                      {groupedCards.map((card, index) => (
                                        <p key={index} className="text-[color:var(--muted)] text-xs">{card}</p>
                                      ))}
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-[color:var(--ruby)] text-sm">No cards found in this role</div>
                                )}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>

                  {/* Synergies - Hidden per user request */}
                  {/* {synergies.length > 0 ? (
                    <div className="mt-4 bg-[color:var(--panel-2)] border border-[color:var(--line)] rounded-lg p-4">
                      <h5 className="font-semibold mb-2 text-center">Detected Synergies</h5>
                      <ul className="list-disc ml-6 text-sm space-y-1">
                        {synergies.map(s => <li key={s} className="text-[color:var(--muted)]">{s}</li>)}
                      </ul>
                    </div>
                  ) : (
                    <div className="mt-4 bg-[color:var(--panel-2)] border border-[color:var(--line)] rounded-lg p-4 text-center">
                      <p className="text-sm text-[color:var(--muted)]">No obvious synergies detected</p>
                    </div>
                  )} */}
                </div>

                {/* Meta Tools (stub) */}
                <div className="rounded-lg p-4 border" style={{ background: 'var(--panel-2)', borderColor: 'var(--line)' }}>
                  <h4 className="text-lg font-semibold mb-3 text-center">Meta Tools</h4>
                  <p className="text-sm text-[color:var(--muted)] mb-4 text-center">
                    Tag your deck against common archetypes and add matchup notes
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs uppercase text-[color:var(--faint)] mb-1">Archetype tags</label>
                      <input className="w-full bg-[color:var(--panel-2)] rounded px-3 py-2 text-sm text-[color:var(--text)] border border-[color:var(--line-2)]" placeholder="e.g., Amber/Amethyst Control, Ruby/Emerald Aggro" />
                    </div>
                    <div>
                      <label className="block text-xs uppercase text-[color:var(--faint)] mb-1">Tech slots (notes)</label>
                      <input className="w-full bg-[color:var(--panel-2)] rounded px-3 py-2 text-sm text-[color:var(--text)] border border-[color:var(--line-2)]" placeholder="e.g., +2 Banish; +1 Evasive hate" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-xs uppercase text-[color:var(--faint)] mb-1">Matchup notes</label>
                    <textarea rows={3} className="w-full bg-[color:var(--panel-2)] rounded px-3 py-2 text-sm text-[color:var(--text)] border border-[color:var(--line-2)]" placeholder="Vs. Amethyst/Sapphire: keep hand w/ draw + 2s; Songs overperform." />
                  </div>
                </div>
              </div>
            );
          })()}
        </div>}
        
        {/* Tournament Results Import & Management */}
        <div className="rounded-lg p-6 mt-6 border border-line bg-raised">
          <TournamentResultsSection 
            deckId={deck.id || 'temp-deck'} 
            deckName={deckName || deck.name}
          />
        </div>
        
        <DeckActionBar
          canSave={Boolean(deckName.trim())}
          onSave={() => { if (onSave && deckName.trim()) onSave(deckName.trim()) }}
          onDownloadImage={handleDownloadImage}
          isGeneratingImage={isGeneratingImage}
          onPrint={() => window.print()}
          onCopyDeckList={() => onCopyDreamborn(deck)}
          onCopyLorcanito={() => onExportLorcanito(deck)}
          onCopyStats={() => {
            const summary = [
              `Deck: ${deck.name}`,
              `Total Cards: ${totalCards}`,
              `Inkable: ${totalInkable} (${(inkableRatio * 100).toFixed(1)}%)`,
              `Uninkable: ${totalUninkable} (${(uninkableRatio * 100).toFixed(1)}%)`,
              `Average Cost: ${averageCost.toFixed(1)}`,
              `Most Expensive: ${mostExpensive?.card.name} (Cost ${getCost(mostExpensive?.card)})`,
              `Cheapest: ${cheapest?.card.name} (Cost ${getCost(cheapest?.card)})`,
            ].join('\n')
            navigator.clipboard.writeText(summary)
          }}
          teamHub={{
            hubs,
            selectedId: selectedHubId,
            onSelect: setSelectedHubId,
            onSave: handleSaveToHub,
            saving: savingToHub,
            loading: loadingHubs,
          }}
        />

          {/* Print Header */}
          <div className="hidden print:block text-center border-t pt-4 mt-4">
            <p className="text-sm text-[color:var(--muted)]">
              Generated by Lorcana Deck Builder • {new Date().toLocaleDateString()}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

