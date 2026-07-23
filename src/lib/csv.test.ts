import { describe, it, expect } from 'vitest'
import { csvField, parseCsv, serializeCsv } from './csv'

describe('parseCsv', () => {
  it('splits a plain row', () => {
    expect(parseCsv('2024-12-01,CA,CA981,PEK,NRT,2096,215,正常')).toEqual([
      ['2024-12-01', 'CA', 'CA981', 'PEK', 'NRT', '2096', '215', '正常'],
    ])
  })

  it('keeps commas inside quoted fields', () => {
    expect(parseCsv('2024-12-01,"Air China, Ltd",CA981')).toEqual([
      ['2024-12-01', 'Air China, Ltd', 'CA981'],
    ])
  })

  it('unescapes doubled quotes', () => {
    expect(parseCsv('a,"He said ""hi""",c')).toEqual([['a', 'He said "hi"', 'c']])
  })

  it('keeps newlines inside quoted fields', () => {
    expect(parseCsv('a,"line1\nline2",c')).toEqual([['a', 'line1\nline2', 'c']])
  })

  it('handles CRLF line endings', () => {
    expect(parseCsv('a,b\r\nc,d')).toEqual([['a', 'b'], ['c', 'd']])
  })

  it('drops blank rows', () => {
    expect(parseCsv('a,b\n\n\nc,d')).toEqual([['a', 'b'], ['c', 'd']])
  })

  it('keeps a header row for the caller to decide on', () => {
    expect(parseCsv('日期,航空公司\n2024-12-01,CA')).toEqual([
      ['日期', '航空公司'],
      ['2024-12-01', 'CA'],
    ])
  })

  it('trims unquoted fields but preserves spacing inside quotes', () => {
    expect(parseCsv('  a  , " b " ')).toEqual([['a', ' b ']])
  })

  it('preserves empty fields between separators', () => {
    expect(parseCsv('a,,c')).toEqual([['a', '', 'c']])
  })

  it('returns no rows for empty input', () => {
    expect(parseCsv('')).toEqual([])
    expect(parseCsv('\n\n')).toEqual([])
  })

  it('handles a trailing newline without emitting an extra row', () => {
    expect(parseCsv('a,b\n')).toEqual([['a', 'b']])
  })
})

describe('csvField — formula injection and quoting', () => {
  // A spreadsheet executes a cell that begins with these when the file opens.
  it('neutralises a formula trigger with a leading apostrophe', () => {
    expect(csvField('=1+1')).toBe("'=1+1")
    expect(csvField('+cmd')).toBe("'+cmd")
    expect(csvField('-2')).toBe("'-2")
    expect(csvField('@SUM(A1)')).toBe("'@SUM(A1)")
  })

  it('neutralises the classic RCE payload', () => {
    const payload = '=cmd|\'/c calc\'!A1'
    const out = csvField(payload)
    expect(out.startsWith("'")).toBe(true)
    // Still one CSV cell, not broken apart.
    expect(out).toContain(payload)
  })

  it('leaves an ordinary value alone', () => {
    expect(csvField('ANA')).toBe('ANA')
    expect(csvField('NH202')).toBe('NH202')
    expect(csvField(2096)).toBe('2096')
  })

  it('quotes a value with a comma, quote or newline', () => {
    expect(csvField('a,b')).toBe('"a,b"')
    expect(csvField('say "hi"')).toBe('"say ""hi"""')
    expect(csvField('line1\nline2')).toBe('"line1\nline2"')
  })

  it('quotes and neutralises together', () => {
    // A comma-containing formula needs both.
    expect(csvField('=a,b')).toBe('"\'=a,b"')
  })

  it('renders empty for null and undefined', () => {
    expect(csvField(null)).toBe('')
    expect(csvField(undefined)).toBe('')
  })
})

describe('serializeCsv round-trips through parseCsv', () => {
  it('a formula-laden grid survives and stays neutralised', () => {
    const grid = [['日期', '备注'], ['2024-01-01', '=danger']]
    const text = serializeCsv(grid)
    const parsed = parseCsv(text)
    expect(parsed[1]?.[1]).toBe("'=danger")
  })
})
