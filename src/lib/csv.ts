/**
 * Splits CSV text into rows of fields, honouring RFC 4180 quoting:
 *
 * - fields may be wrapped in double quotes
 * - a quoted field may contain commas and newlines
 * - `""` inside a quoted field is a literal double quote
 * - rows may end with LF or CRLF
 * - fully blank rows are dropped
 *
 * Whitespace surrounding a field is discarded, but whitespace *inside* quotes
 * and between words is preserved. This is done by buffering runs of unquoted
 * whitespace and only committing them once more content follows in the same
 * field, which trims both ends without a separate trim pass.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let pendingSpace = ''
  let inQuotes = false

  function endField() {
    row.push(field)
    field = ''
    pendingSpace = ''
  }

  function endRow() {
    endField()
    if (row.some(cell => cell !== '')) rows.push(row)
    row = []
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i]!

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      // Whitespace before an opening quote is not part of the value.
      inQuotes = true
      pendingSpace = ''
    } else if (char === ',') {
      endField()
    } else if (char === '\n' || char === '\r') {
      // Consume the LF of a CRLF pair so it does not start an empty row.
      if (char === '\r' && text[i + 1] === '\n') i++
      endRow()
    } else if (char === ' ' || char === '\t') {
      // Held back: only kept if real content follows in this field.
      if (field !== '') pendingSpace += char
    } else {
      field += pendingSpace + char
      pendingSpace = ''
    }
  }

  endRow()
  return rows
}
