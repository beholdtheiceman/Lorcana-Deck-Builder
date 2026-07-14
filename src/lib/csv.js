function parseRecords(input) {
  const text = String(input ?? '').replace(/^\uFEFF/, '')
  if (!text) return []

  const records = []
  let record = []
  let field = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          quoted = false
        }
      } else {
        field += character
      }
      continue
    }

    if (character === '"' && field === '') {
      quoted = true
    } else if (character === ',') {
      record.push(field)
      field = ''
    } else if (character === '\n' || character === '\r') {
      record.push(field)
      records.push(record)
      record = []
      field = ''
      if (character === '\r' && text[index + 1] === '\n') index += 1
    } else {
      field += character
    }
  }

  if (field !== '' || record.length || !/[\r\n]$/.test(text)) {
    record.push(field)
    records.push(record)
  }
  return records
}

export function parseCsvRows(input) {
  return parseRecords(input)
}

export function parseCsv(input) {
  const records = parseRecords(input)
  if (!records.length) return []
  const headers = records[0].map((header) => String(header).trim())

  return records.slice(1)
    .filter((record) => record.some((value) => value !== ''))
    .map((record) => {
      const row = {}
      headers.forEach((header, index) => {
        if (header) row[header] = record[index] ?? ''
      })
      return row
    })
}

export const parseCSV = parseCsv

export default parseCsv
