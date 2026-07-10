// Image helpers extracted from App.jsx (Phase 5.3): image-URL generation
// (Lorcast/cards.lorcast.io), CORS-aware image load/preload helpers, canvas
// image generators, and the image-cache capacity constant. Moved verbatim.
import { LS_KEYS, loadLS, saveLS } from "./storage.js";

export const IMG_CACHE_CAP = 4000; // bound localStorage growth; each entry is a URL string

// Global image loading function for batch operations with CORS handling
export function tryLoadImage(imageUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timeout = setTimeout(() => {
      img.onload = null;
      img.onerror = null;
      console.warn(`[Image Load] Timeout for: ${imageUrl}`);
      reject(new Error('Image load timeout'));
    }, 5000); // Increased timeout
    
    img.onload = () => {
      clearTimeout(timeout);
      console.log(`[Image Load] Success: ${imageUrl}`);
      resolve(imageUrl);
    };
    
    img.onerror = () => {
      clearTimeout(timeout);
      console.warn(`[Image Load] Failed: ${imageUrl}`);
      reject(new Error('Image failed to load'));
    };
    
    // Simple CORS handling
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
  });
}

// Enhanced image loading with CORS fallback
export async function tryLoadImageWithCORSFallback(imageUrl, originalUrl = null) {
  try {
    // First try with the current URL (which might be proxied)
    return await tryLoadImage(imageUrl);
  } catch (error) {
    console.warn(`[CORS Fallback] Primary image load failed: ${imageUrl}`, error.message);
    
    // If we have an original URL and the current one is proxied, try the original
    if (originalUrl && imageUrl !== originalUrl) {
      try {
        console.log(`[CORS Fallback] Trying original URL: ${originalUrl}`);
        return await tryLoadImage(originalUrl);
      } catch (fallbackError) {
        console.warn(`[CORS Fallback] Original URL also failed: ${originalUrl}`, fallbackError.message);
      }
    }
    
    // If all else fails, try alternative CORS proxies
    const alternativeProxies = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(imageUrl)}`,
      `https://cors-anywhere.herokuapp.com/${imageUrl}`,
      `https://thingproxy.freeboard.io/fetch/${imageUrl}`
    ];
    
    for (const proxyUrl of alternativeProxies) {
      try {
        console.log(`[CORS Fallback] Trying alternative proxy: ${proxyUrl}`);
        return await tryLoadImage(proxyUrl);
      } catch (proxyError) {
        console.warn(`[CORS Fallback] Proxy failed: ${proxyUrl}`, proxyError.message);
      }
    }
    
    // If everything fails, throw the original error
    throw error;
  }
}

// Better CORS handling function
export async function tryLoadImageWithBetterCORS(imageUrl) {
  // Strategy 1: Try direct loading with crossOrigin
  try {
    console.log(`[CORS Strategy] Attempting direct load with crossOrigin: ${imageUrl}`);
    return await tryLoadImage(imageUrl);
  } catch (error) {
    console.warn(`[CORS Strategy] Direct load failed: ${imageUrl}`, error.message);
  }
  
  // Strategy 2: Try with a more reliable CORS proxy
  const reliableProxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(imageUrl)}`,
    `https://cors.bridged.cc/${imageUrl}`,
    `https://cors-anywhere.herokuapp.com/${imageUrl}`
  ];
  
  for (const proxyUrl of reliableProxies) {
    try {
      console.log(`[CORS Strategy] Trying reliable proxy: ${proxyUrl}`);
      return await tryLoadImage(proxyUrl);
    } catch (proxyError) {
      console.warn(`[CORS Strategy] Proxy failed: ${proxyUrl}`, proxyError.message);
    }
  }
  
  // Strategy 3: Try to fetch the image as a blob and create a local URL
  try {
    console.log(`[CORS Strategy] Attempting blob fetch: ${imageUrl}`);
    const response = await fetch(imageUrl, { 
      mode: 'cors',
      credentials: 'omit'
    });
    if (response.ok) {
      const blob = await response.blob();
      const localUrl = URL.createObjectURL(blob);
      console.log(`[CORS Strategy] Blob fetch successful, created local URL: ${localUrl}`);
      return localUrl;
    }
  } catch (blobError) {
    console.warn(`[CORS Strategy] Blob fetch failed: ${imageUrl}`, blobError.message);
  }
  
  // If all strategies fail, throw an error
  throw new Error(`All CORS strategies failed for: ${imageUrl}`);
}

// Working solution: Try multiple image sources to find one that works
export async function getWorkingImageUrl(card) {
  if (!card) return null;
  
  // Strategy 1: Try to construct a working URL from the card data
  if (card.set && card.number) {
    const setCode = card.set.toString().toUpperCase();
    const cardNumber = card.number.toString().padStart(3, '0');
    
    // Try different URL patterns that might work
    const urlPatterns = [
      `https://api.lorcast.com/v0/cards/${setCode}/${cardNumber}/image`,
      `https://api.lorcast.com/v0/images/${setCode}/${cardNumber}.jpg`,
      `https://api.lorcast.com/v0/images/${setCode}-${cardNumber}.jpg`,
      `https://api.lorcast.com/v0/cards/${setCode}-${cardNumber}/image`
    ];
    
    for (const url of urlPatterns) {
      try {
        console.log(`[Image Source] Trying URL pattern: ${url}`);
        const response = await fetch(url, { method: 'HEAD' });
        if (response.ok) {
          console.log(`[Image Source] Found working URL: ${url}`);
          return url;
        }
      } catch (error) {
        console.warn(`[Image Source] URL pattern failed: ${url}`, error.message);
      }
    }
  }
  
  // Strategy 2: If we have an original image URL, try to use it with different approach
  if (card._originalImageUrl) {
    console.log(`[Image Source] Using original URL as fallback: ${card._originalImageUrl}`);
    return card._originalImageUrl;
  }
  
  // Strategy 3: Return null and let the component handle it with a placeholder
  console.warn(`[Image Source] No working image URL found for card: ${card.name}`);
  return null;
}

// HARDENED: Get card image URL - prefer canonical Lorcast ID, fallback to feed Image
export function getCardImageUrl(card) {
  // GUARD: Handle undefined/null cards gracefully
  if (!card) {
    console.warn(`[getCardImageUrl] No card provided, returning placeholder`);
    return "/img/placeholders/card.avif";
  }
  
  // PREFER: Canonical Lorcast ID (most reliable)
  if (card?.id?.startsWith("crd_")) {
    const url = `https://cards.lorcast.io/card/digital/large/${card.id}.avif`;
    console.log(`[getCardImageUrl] Using canonical Lorcast ID for ${card.name}:`, url);
    return url;
  }
  
  // FALLBACK: Accept either imageUrl or image_url (handle both field names)
  const direct = card.imageUrl || card.image_url;
  if (typeof direct === 'string' && direct) {
    console.log(`[getCardImageUrl] Using direct image for ${card.name}:`, direct);
    return direct;
  }
  
  // LAST RESORT: Generate URL only if absolutely necessary
  try {
    const generated = generateLorcastURL(card);
    console.log(`[getCardImageUrl] Generated fallback URL for ${card.name}:`, generated);
    return generated;
  } catch (error) {
    console.warn(`[getCardImageUrl] Failed to generate URL for ${card.name}:`, error);
    return "/img/placeholders/card.avif";
  }
}

// New approach: Generate local placeholder images with card data
export function generateLocalCardImage(card) {
  if (!card || typeof card !== 'object') return null;
  
  try {
    // Create a canvas-based image with card information
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size (standard card dimensions)
    canvas.width = 300;
    canvas.height = 420;
    
    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(1, '#16213e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Card border
    ctx.strokeStyle = '#4a90e2';
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
    
    // Card name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Arial, sans-serif';
    ctx.textAlign = 'center';
    
    // Wrap text if too long
    const maxWidth = canvas.width - 40;
    const words = (card.name || 'Unknown Card').split(' ');
    let line = '';
    let y = 80;
    
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, canvas.width / 2, y);
        line = words[n] + ' ';
        y += 25;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, canvas.width / 2, y);
    
    // Card details
    y += 40;
    ctx.font = '14px Arial, sans-serif';
    ctx.fillStyle = '#cccccc';
    
    if (card.set) {
      ctx.fillText(`Set: ${card.set}`, canvas.width / 2, y);
      y += 20;
    }
    
    if (card.number) {
      ctx.fillText(`#${card.number}`, canvas.width / 2, y);
      y += 20;
    }
    
    if (card.type) {
      ctx.fillText(`Type: ${card.type}`, canvas.width / 2, y);
      y += 20;
    }
    
    if (card.cost !== undefined) {
      ctx.fillText(`Cost: ${card.cost}`, canvas.width / 2, y);
      y += 20;
    }
    
    // Convert canvas to data URL
    const dataUrl = canvas.toDataURL('image/png');
    console.log(`[Local Image] Generated local image for ${card.name}`);
    
    return dataUrl;
    
  } catch (error) {
    console.error(`[Local Image] Failed to generate local image for ${card.name}:`, error);
    return null;
  }
}

// Simple fallback image generator for when the main one fails
export function createSimpleCardImage(card) {
  if (!card || typeof card !== 'object') return null;
  
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = 300;
    canvas.height = 420;
    
    // Simple background
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Simple border
    ctx.strokeStyle = '#718096';
    ctx.lineWidth = 2;
    ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
    
    // Card name (simple)
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(card.name || 'Card', canvas.width / 2, canvas.height / 2);
    
    const dataUrl = canvas.toDataURL('image/png');
    console.log(`[Simple Image] Generated simple image for ${card.name}`);
    
    return dataUrl;
    
  } catch (error) {
    console.error(`[Simple Image] Failed to generate simple image for ${card.name}:`, error);
    return null;
  }
}

// Working CORS solution: Use a reliable CORS proxy service
export function getCORSProxyUrl(originalUrl) {
  if (!originalUrl || !originalUrl.includes('cards.lorcast.io')) {
    return originalUrl;
  }
  
  // Use a reliable CORS proxy service
  // This will fetch the image server-side and serve it with proper CORS headers
  const proxyUrl = `https://cors.bridged.cc/${originalUrl}`;
  
  console.log(`[CORS Proxy] Converting URL: ${originalUrl} -> ${proxyUrl}`);
  return proxyUrl;
}

// Alternative CORS proxy if the first one fails
export function getAlternativeCORSProxyUrl(originalUrl) {
  if (!originalUrl || !originalUrl.includes('cards.lorcast.io')) {
    return originalUrl;
  }
  
  // Alternative proxy services
  const proxyServices = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(originalUrl)}`,
    `https://cors-anywhere.herokuapp.com/${originalUrl}`,
    `https://thingproxy.freeboard.io/fetch/${originalUrl}`
  ];
  
  // Return the first one for now - the image component can try others if it fails
  const proxyUrl = proxyServices[0];
  
  console.log(`[CORS Proxy] Using alternative proxy: ${originalUrl} -> ${proxyUrl}`);
  return proxyUrl;
}

// Alternative approach: Create a canvas-based image to bypass CORS
export function createCanvasImage(imageUrl) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        // Convert canvas to blob URL
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            console.log(`[Canvas CORS] Successfully created canvas image: ${url}`);
            resolve(url);
          } else {
            reject(new Error('Failed to create blob from canvas'));
          }
        }, 'image/jpeg', 0.9);
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image into canvas'));
    };
    
    img.src = imageUrl;
  });
}

// New function: Generate clean Lorcast URLs from card data - UPDATED for transformed cards
export function generateLorcastURL(card) {
  console.log(`[generateLorcastURL] Called with card:`, { 
    name: card?.name, 
    id: card?.id, 
    setId: card?.setId, 
    cardNum: card?.cardNum,
    imageUrl: card?.imageUrl 
  });
  
  if (!card || typeof card !== 'object') {
    console.warn(`[URL Generation] Invalid card object:`, card);
    return null;
  }
  
  // PREFER: Use existing imageUrl from transformed card data
  if (card.imageUrl && typeof card.imageUrl === 'string' && card.imageUrl.startsWith('http')) {
    console.log(`[URL Generation] Using existing imageUrl for ${card.name}:`, card.imageUrl);
    return String(card.imageUrl);
  }
  
  // FALLBACK: Generate URL using card ID or set/number
  if (card.id) {
    const imageUrl = `https://cards.lorcast.io/card/digital/large/${card.id}.avif`;
    console.log(`[URL Generation] Generated image URL using card ID for ${card.name}:`, imageUrl);
    return String(imageUrl);
  }
  
  // LAST RESORT: Try to construct URL using set and number
  if (card.setId && card.cardNum) {
    const setCode = card.setId.toString().toUpperCase();
    const cardNumber = card.cardNum.toString().padStart(3, '0');
    
    const imageUrl = `https://cards.lorcast.io/card/digital/large/crd_${setCode}_${cardNumber}.avif`;
    console.log(`[URL Generation] Generated fallback URL using set/number for ${card.name}:`, imageUrl);
    return String(imageUrl);
  }
  
  console.warn(`[URL Generation] Could not generate URL for card: ${card.name}`, card);
  return null;
}

// Enhanced function to generate multiple alternative image URLs
export function generateAlternativeImageUrls(card) {
  if (!card || typeof card !== 'object') {
    return [];
  }
  
  const urls = [];
  
  // If we have an existing image URL, add it first
  if (card._imageFromAPI && typeof card._imageFromAPI === 'string' && card._imageFromAPI.startsWith('http')) {
    urls.push(card._imageFromAPI);
  }
  
  // Generate URLs based on card data using the correct Lorcast API structure
  if (card.set && card.number) {
    const setCode = card.set.toString().toUpperCase();
    const cardNumber = card.number.toString().padStart(3, '0');
    
    // Multiple URL patterns to try using the correct API structure
    const patterns = [
      // Primary: Use card ID if available (most reliable)
      card.id ? `https://cards.lorcast.io/card/digital/large/${card.id}.avif` : null,
      card.id ? `https://cards.lorcast.io/card/digital/normal/${card.id}.avif` : null,
      card.id ? `https://cards.lorcast.io/card/digital/small/${card.id}.avif` : null,
      
      // Fallback: Construct URLs using set and number
      `https://cards.lorcast.io/card/digital/large/crd_${setCode}_${cardNumber}.avif`,
      `https://cards.lorcast.io/card/digital/normal/crd_${setCode}_${cardNumber}.avif`,
      `https://cards.lorcast.io/card/digital/small/crd_${setCode}_${cardNumber}.avif`,
      
      // Alternative domains (if main domain fails)
      `https://api.lorcast.com/v0/cards/${setCode}/${cardNumber}/image`,
      `https://lorcast.com/images/${setCode}/${cardNumber}.jpg`
    ].filter(Boolean); // Remove null values
    
    urls.push(...patterns);
  }
  
  // Remove duplicates and invalid URLs
  const uniqueUrls = [...new Set(urls)].filter(url => 
    url && typeof url === 'string' && url.startsWith('http')
  );
  
  console.log(`[Alternative URLs] Generated ${uniqueUrls.length} URLs for ${card.name}:`, uniqueUrls);
  return uniqueUrls;
}

// New function: Reset failed image cache entries
export function resetFailedImageCache() {
  try {
    const cache = loadLS(LS_KEYS.CACHE_IMG, {});
    let resetCount = 0;
    
    // Find and remove all 'FAILED' entries
    Object.keys(cache).forEach(key => {
      if (cache[key] === 'FAILED') {
        delete cache[key];
        resetCount++;
      }
    });
    
    // Save the cleaned cache
    saveLS(LS_KEYS.CACHE_IMG, cache);
    
    console.log(`[Cache Reset] Reset ${resetCount} failed image cache entries`);
    return resetCount;
  } catch (error) {
    console.error('[Cache Reset] Error resetting failed cache:', error);
    return 0;
  }
}
