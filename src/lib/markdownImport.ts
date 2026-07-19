export interface ImportedMarkdown {
  title: string
  body: string
  tags: string[]
  summary: string
}

/** Strips a .md/.markdown extension and tidies separators for use as a title. */
function titleFromFilename(filename: string): string {
  return filename
    .replace(/\.(md|markdown|mdown|mkd)$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim()
}

function splitList(value: string): string[] {
  return value
    .replace(/^\[|\]$/g, '')
    .split(/[,，]/)
    .map(v => v.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean)
}

/**
 * Parses an uploaded Markdown file into the fields the editor expects.
 *
 * Understands an optional YAML-ish front-matter block (title, tags, summary,
 * description). Failing that, a leading `# Heading` becomes the title and is
 * removed from the body; failing that, the filename is used. The body is
 * always returned so nothing the user wrote is silently dropped.
 */
export function parseMarkdownFile(filename: string, text: string): ImportedMarkdown {
  let rest = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  let title = ''
  let summary = ''
  let tags: string[] = []

  const frontMatter = rest.match(/^---\n([\s\S]*?)\n---\n?/)
  if (frontMatter) {
    rest = rest.slice(frontMatter[0].length)
    for (const line of frontMatter[1]!.split('\n')) {
      const match = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/)
      if (!match) continue
      const key = match[1]!.toLowerCase()
      const value = match[2]!.trim().replace(/^["']|["']$/g, '')
      if (!value) continue
      if (key === 'title') title = value
      else if (key === 'summary' || key === 'description') summary = value
      else if (key === 'tags' || key === 'keywords') tags = splitList(value)
    }
  }

  rest = rest.replace(/^\n+/, '')

  // A leading H1 is the document title; keep it out of the body so it is not
  // rendered twice above the page heading.
  if (!title) {
    const heading = rest.match(/^#[ \t]+([^\n]+)\n?/)
    if (heading) {
      title = heading[1]!.trim()
      rest = rest.slice(heading[0].length).replace(/^\n+/, '')
    }
  }

  if (!title) title = titleFromFilename(filename) || '未命名'

  const body = rest.trimEnd()

  if (!summary) {
    const firstText = body
      .split('\n')
      .find(line => line.trim() && !/^[#>\-*`|]/.test(line.trim()))
    summary = (firstText ?? '').trim().slice(0, 80)
  }

  return { title, body, tags, summary }
}

const ALLOWED_EXTENSIONS = /\.(md|markdown|mdown|mkd)$/i
const MAX_BYTES = 2 * 1024 * 1024

/** Returns an error message when the file is not an acceptable Markdown upload. */
export function validateMarkdownFile(file: { name: string; size: number }): string | null {
  if (!ALLOWED_EXTENSIONS.test(file.name)) return '只支持 .md 或 .markdown 文件'
  if (file.size > MAX_BYTES) return `文件不能超过 2 MB（当前 ${(file.size / 1024 / 1024).toFixed(1)} MB）`
  return null
}
