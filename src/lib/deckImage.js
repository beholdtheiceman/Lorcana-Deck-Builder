// Deck presentation image generation, extracted from App.jsx's AppInner
// (previously the closure `generateDeckImage(event)`). This is a pure function:
// no DOM button manipulation, no React state — callers own their own loading
// state around the awaited call and should catch/report errors themselves.

import { getWorkingImageUrl } from "./images.js";

// Normalize card types to handle Songs and other subtypes consistently.
// Mirrors the module-scope `normalizedType` in App.jsx.
function normalizedType(card) {
  const rawType =
    card.type ||
    card._raw?.type ||
    card._raw?.type_line ||
    "";

  const sub = (card.subtypes || card._raw?.subtypes || []).map(String);
  const kws = (card.keywords || card._raw?.keywords || []).map(String);

  const hay = `${rawType} ${sub.join(" ")} ${kws.join(" ")}`.toLowerCase();

  if (hay.includes("song")) return "Song";
  if (hay.includes("character")) return "Character";
  if (hay.includes("item")) return "Item";
  if (hay.includes("location")) return "Location";
  if (hay.includes("action")) return "Action";
  return card.type || "Other";
}

function getCost(card) {
  return card?.cost ?? card?.ink_cost ?? card?.inkCost ?? 0;
}

function proxyImageUrl(src) {
  if (!src) return null;
  return `https://images.weserv.nl/?url=${encodeURIComponent(String(src))}&output=jpg`;
}

/**
 * Renders the current deck to a canvas card-grid image and triggers a browser
 * download. Throws on failure — callers should wrap this in their own
 * try/catch/finally and manage their own loading-state UI.
 *
 * @param {object} deck - deck state, shape `{ name, entries: { [key]: { card, count } } }`
 * @param {Array} allCards - the full live card catalog (used to re-resolve dead image hosts)
 * @param {object} [options]
 * @param {string} [options.username] - label to print under the deck title (e.g. the logged-in user's email)
 */
export async function generateDeckImagePNG(deck, allCards, options = {}) {
  const { username: usernameOverride } = options;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  // Layout constants - tune these for the exact look you want
  const posterW = 1400; // Fixed width like your clean mock
  const columns = 8; // 8 across for more compact layout
  const gap = 16; // Space between cards
  const margin = 32; // Outer edge margin
  const headerH = 120; // Title band height
  const cardAR = 63 / 88; // Lorcana card aspect ratio

  // Calculate card size from width/columns (no dead space)
  const cardWidth = Math.floor((posterW - margin * 2 - gap * (columns - 1)) / columns);
  const cardHeight = Math.floor(cardWidth / cardAR);
  const cardsPerRow = columns;

  // Get deck entries
  const entries = Object.values(deck.entries || {}).filter((e) => e.count > 0);

  // Decks saved by older builds carry card objects whose image hosts are
  // dead (cards.lorcast.io crd_* returns 404). Re-resolve each card against
  // the live catalog by setCode+number so their current image URL is tried first.
  const liveBySetNum = new Map();
  for (const c of allCards || []) {
    if (c?.setCode != null && c?.number != null) {
      const k = `${String(c.setCode).toUpperCase()}-${String(c.number)}`;
      if (!liveBySetNum.has(k)) liveBySetNum.set(k, c);
    }
  }

  // Simple grouping for deck image generation
  const groupedEntries = [
    { entries: entries.filter((e) => normalizedType(e.card) === "Character") },
    { entries: entries.filter((e) => normalizedType(e.card) === "Action") },
    { entries: entries.filter((e) => normalizedType(e.card) === "Song") },
    { entries: entries.filter((e) => normalizedType(e.card) === "Item") },
    { entries: entries.filter((e) => normalizedType(e.card) === "Location") },
    {
      entries: entries.filter(
        (e) => !["Character", "Action", "Song", "Item", "Location"].includes(normalizedType(e.card))
      ),
    },
  ];

  // Flatten all entries into one continuous list, maintaining order
  const allEntries = [];
  try {
    for (const { entries: list } of groupedEntries) {
      // Sort each group by cost, then by name for consistent ordering
      const sortedList = [...list].sort((a, b) => {
        const costA = getCost(a.card) ?? 0;
        const costB = getCost(b.card) ?? 0;
        if (costA !== costB) {
          return costA - costB; // Sort by cost first
        }
        // If costs are equal, sort by name
        return a.card.name.localeCompare(b.card.name);
      });
      allEntries.push(...sortedList);
    }
  } catch (sortError) {
    console.error(`[Deck Image] Error sorting entries:`, sortError);
    // Fallback: just use the original entries without sorting
    for (const { entries: list } of groupedEntries) {
      allEntries.push(...list);
    }
  }

  // Calculate exact grid dimensions (no dead space)
  const totalRows = Math.ceil(allEntries.length / cardsPerRow);
  const gridHeight = totalRows * cardHeight + (totalRows - 1) * gap;

  // Compute exact poster height (no hard-coded values)
  const posterH = headerH + margin + gridHeight + margin;

  // Set canvas dimensions exactly
  canvas.width = posterW;
  canvas.height = posterH;

  // Background
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Title and username on same row, centered
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 56px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(deck.name || "Untitled Deck", canvas.width / 2, margin);

  // Username on same row, centered below title
  ctx.font = "500 32px Inter, system-ui, sans-serif";
  ctx.fillStyle = "#cdd2e0";
  const username = usernameOverride || deck.createdBy || deck.username || "Unknown User";
  ctx.fillText(`by ${username}`, canvas.width / 2, margin + 70);

  // Draw cards in grid - one continuous grid without section breaks
  let currentRow = 0;
  let currentCol = 0;
  const yOffset = headerH + margin;

  // Draw all cards in one continuous grid
  for (const entry of allEntries) {
    const x = margin + currentCol * (cardWidth + gap);
    const y = yOffset + currentRow * (cardHeight + gap);

    // Draw card background
    ctx.fillStyle = "#2d3748";
    ctx.fillRect(x, y, cardWidth, cardHeight);
    ctx.strokeStyle = "#718096";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, cardWidth, cardHeight);

    // Draw card image if available - try multiple image sources
    const card = entry.card;
    let imageDrawn = false;

    // Try multiple image sources in order of preference. The live-catalog
    // image comes first: legacy card objects have dead image_url hosts.
    const liveSetKey =
      (card.setCode ?? card.set) != null && card.number != null
        ? `${String(card.setCode ?? card.set).toUpperCase()}-${String(card.number)}`
        : null;
    const liveCard = liveSetKey ? liveBySetNum.get(liveSetKey) : null;
    const imageSources = [
      liveCard?.image,
      card.image,
      card.image_url,
      card._imageFromAPI,
      card._raw?.image_uris?.digital?.large,
      card._raw?.image_uris?.digital?.normal,
      card._raw?.image_uris?.large,
      card._raw?.image_uris?.normal,
      // Try to generate Lorcast URLs if we have set/number
      card.set && card.number
        ? `https://cards.lorcast.io/card/digital/large/crd_${card.set}_${card.number.toString().padStart(3, "0")}.avif`
        : null,
      card.set && card.number ? `https://api.lorcast.com/v0/cards/${card.set}/${card.number}/image` : null,
    ].filter(Boolean);

    for (const imageSrc of imageSources) {
      if (imageSrc && !imageDrawn) {
        try {
          const img = new Image();
          img.crossOrigin = "anonymous";

          // Try to use proxy for CORS issues
          let finalImageSrc = imageSrc;
          if (imageSrc.includes("cards.lorcast.io") || imageSrc.includes("api.lorcast.com")) {
            finalImageSrc = proxyImageUrl(imageSrc);
          }

          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("Image load timeout")), 5000);
            img.onload = () => {
              clearTimeout(timeout);
              resolve();
            };
            img.onerror = () => {
              clearTimeout(timeout);
              reject(new Error("Image failed to load"));
            };
            img.src = finalImageSrc;
          });

          // Draw image maintaining aspect ratio
          const imgAspect = img.width / img.height;
          const cardAspect = cardWidth / cardHeight;

          let drawWidth = cardWidth;
          let drawHeight = cardHeight;
          let drawX = x;
          let drawY = y;

          if (imgAspect > cardAspect) {
            drawHeight = cardWidth / imgAspect;
            drawY = y + (cardHeight - drawHeight) / 2;
          } else {
            drawWidth = cardHeight * imgAspect;
            drawX = x + (cardWidth - drawWidth) / 2;
          }

          ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
          imageDrawn = true;
          break; // Successfully drew image, stop trying other sources
        } catch (error) {
          continue; // Try next image source
        }
      }
    }

    // If no image was drawn, try one more approach with existing functions
    if (!imageDrawn) {
      try {
        const workingUrl = await getWorkingImageUrl(card);
        if (workingUrl) {
          const img = new Image();
          img.crossOrigin = "anonymous";

          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("Image load timeout")), 3000);
            img.onload = resolve;
            img.onerror = reject;
            img.src = workingUrl;
          });

          const imgAspect = img.width / img.height;
          const cardAspect = cardWidth / cardHeight;

          let drawWidth = cardWidth;
          let drawHeight = cardHeight;
          let drawX = x;
          let drawY = y;

          if (imgAspect > cardAspect) {
            drawHeight = cardWidth / imgAspect;
            drawY = y + (cardHeight - drawHeight) / 2;
          } else {
            drawWidth = cardHeight * imgAspect;
            drawX = x + (cardWidth - drawWidth) / 2;
          }

          ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
          imageDrawn = true;
        }
      } catch (error) {
        // fall through to the next attempt
      }
    }

    // If still no image was drawn, try one more time with a simpler approach
    if (!imageDrawn) {
      try {
        const simpleImageSrc = card.image_url || card.image || card._imageFromAPI;
        if (simpleImageSrc) {
          const img = new Image();
          img.crossOrigin = "anonymous";

          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("Image load timeout")), 3000);
            img.onload = () => {
              clearTimeout(timeout);
              resolve();
            };
            img.onerror = () => {
              clearTimeout(timeout);
              reject(new Error("Image failed to load"));
            };
            img.src = simpleImageSrc;
          });

          const imgAspect = img.width / img.height;
          const cardAspect = cardWidth / cardHeight;

          let drawWidth = cardWidth;
          let drawHeight = cardHeight;
          let drawX = x;
          let drawY = y;

          if (imgAspect > cardAspect) {
            drawHeight = cardWidth / imgAspect;
            drawY = y + (cardHeight - drawHeight) / 2;
          } else {
            drawWidth = cardHeight * imgAspect;
            drawX = x + (cardWidth - drawWidth) / 2;
          }

          ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
          imageDrawn = true;
        }
      } catch (error) {
        // fall through to fallback drawing
      }
    }

    // If still no image was drawn, use fallback
    if (!imageDrawn) {
      // Draw fallback card content
      ctx.fillStyle = "#1a202c";
      ctx.fillRect(x, y, cardWidth, cardHeight);

      // Card border
      ctx.strokeStyle = "#4a5568";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, cardWidth, cardHeight);

      // Card name
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 12px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const nameLines = card.name.split(" ").reduce(
        (lines, word) => {
          const testLine = lines[lines.length - 1] + (lines[lines.length - 1] ? " " : "") + word;
          ctx.font = "bold 12px Arial, sans-serif";
          const metrics = ctx.measureText(testLine);
          if (metrics.width > cardWidth - 8) {
            lines.push(word);
          } else {
            lines[lines.length - 1] = testLine;
          }
          return lines;
        },
        [""]
      );

      const lineHeight = 14;
      const startY = y + cardHeight / 2 - ((nameLines.length - 1) * lineHeight) / 2;
      nameLines.forEach((line, i) => {
        ctx.fillText(line, x + cardWidth / 2, startY + i * lineHeight);
      });
    }

    // Draw count indicator - Rounded bubble positioned exactly on card corner
    if (entry.count > 1) {
      const bubbleSize = 20;
      const bubbleX = x + cardWidth - bubbleSize;
      const bubbleY = y;
      const bubbleRadius = bubbleSize / 2;

      // Draw rounded rectangle (bubble) with fallback for older browsers
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(bubbleX, bubbleY, bubbleSize, bubbleSize, bubbleRadius);
      } else {
        ctx.arc(bubbleX + bubbleRadius, bubbleY + bubbleRadius, bubbleRadius, 0, 2 * Math.PI);
      }
      ctx.fillStyle = "#10b981"; // emerald-600
      ctx.fill();

      // Draw border
      ctx.strokeStyle = "#047857"; // emerald-700
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw count text
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 12px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(entry.count.toString(), bubbleX + bubbleRadius, bubbleY + bubbleRadius);
    }

    // Move to next position
    currentCol++;
    if (currentCol >= cardsPerRow) {
      currentCol = 0;
      currentRow++;
    }
  }

  // Convert to blob and download
  await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to generate image blob"));
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${deck.name || "deck"}_${new Date().toISOString().split("T")[0]}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      resolve();
    }, "image/png");
  });
}
