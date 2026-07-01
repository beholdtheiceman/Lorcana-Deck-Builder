export function getCost(card) {
  return card?.cost ?? card?.ink_cost ?? card?.inkCost ?? 0;
}

export function groupBy(arr, keyFn) {
  return arr.reduce((acc, item) => {
    const k = keyFn(item);
    (acc[k] ||= []).push(item);
    return acc;
  }, {});
}

export function generateTextExport(deck) {
  const lines = [
    `${deck.name}`,
    `Format: ${deck.format}`,
    `Created: ${new Date(deck.createdAt).toLocaleDateString()}`,
    `Updated: ${new Date(deck.updatedAt).toLocaleDateString()}`,
    `Total Cards: ${deck.total}`,
    '',
    'Cards:',
    '',
  ];
  const entries = Object.values(deck.entries).filter(e => e.count > 0);
  const groupedByCost = groupBy(entries, e => getCost(e.card));
  Object.keys(groupedByCost)
    .sort((a, b) => parseInt(a) - parseInt(b))
    .forEach(cost => {
      lines.push(`Cost ${cost}:`);
      groupedByCost[cost].forEach(entry => {
        lines.push(`  ${entry.count}x ${entry.card.name} (${entry.card.set} #${entry.card.number})`);
      });
      lines.push('');
    });
  return lines.join('\n');
}

export function generateSimpleTextExport(deck) {
  return Object.values(deck.entries)
    .filter(e => e.count > 0)
    .sort((a, b) => a.card.name.localeCompare(b.card.name))
    .map(e => `${e.count} ${e.card.name}`)
    .join('\n');
}

export function generateCSVExport(deck) {
  const lines = ['Name,Set,Number,Cost,Type,Rarity,Count'];
  Object.values(deck.entries)
    .filter(e => e.count > 0)
    .forEach(({ card, count }) => {
      lines.push(`"${card.name}","${card.set}","${card.number}","${getCost(card)}","${card.type}","${card.rarity}","${count}"`);
    });
  return lines.join('\n');
}

export function exportDeck(deck, format = 'json') {
  switch (format) {
    case 'txt':        return generateTextExport(deck);
    case 'simple-txt': return generateSimpleTextExport(deck);
    case 'csv':        return generateCSVExport(deck);
    default:           return JSON.stringify(deck, null, 2);
  }
}
