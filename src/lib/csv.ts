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

/**
 * Escapes one value for writing into a CSV cell.
 *
 * Two separate concerns:
 *
 * 1. **RFC 4180 quoting** — a value containing a comma, quote or newline is
 *    wrapped in quotes with inner quotes doubled.
 * 2. **Formula injection** — a spreadsheet treats a cell beginning with
 *    `= + - @` (or a tab/CR before one) as a formula and *executes* it when
 *    the file is opened. `=cmd|'/c calc'!A1` in an exported cell is a real
 *    remote-code path on the machine that opens it. A leading apostrophe
 *    forces the cell to be read as text, which is the standard defence.
 *
 * There is no CSV export yet; this exists so the one the spec calls for
 * (§14.5, §19) cannot be written without it.
 */
export function csvField(value: unknown): string {
  let text = value == null ? '' : String(value)

  // Neutralise a leading formula trigger before anything else looks at it.
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`
  }

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

/** Joins a grid into CSV text, every cell escaped. */
export function serializeCsv(rows: readonly (readonly unknown[])[]): string {
  return rows.map(row => row.map(csvField).join(',')).join('\r\n')
}
