import { describe, it, expect } from 'vitest'
import { extractHeadings, headingId } from './toc'

describe('headingId', () => {
  it('slugifies latin text', () => {
    expect(headingId('Getting Started')).toBe('getting-started')
  })

  it('keeps CJK, which would otherwise slugify to nothing', () => {
    expect(headingId('核心问题是什么')).toBe('核心问题是什么')
  })

  it('drops punctuation and inline markers', () => {
    expect(headingId('`startTransition` 的用法！')).toBe('starttransition-的用法')
  })

  it('falls back when nothing usable remains', () => {
    expect(headingId('---')).toBe('section')
  })
})

describe('extractHeadings', () => {
  it('collects headings with levels', () => {
    const md = '# 一级\n\n正文\n\n## 二级\n\n### 三级'
    expect(extractHeadings(md)).toEqual([
      { level: 1, text: '一级', id: '一级' },
      { level: 2, text: '二级', id: '二级' },
      { level: 3, text: '三级', id: '三级' },
    ])
  })

  it('ignores levels deeper than the limit', () => {
    expect(extractHeadings('#### 四级', 3)).toEqual([])
    expect(extractHeadings('#### 四级', 4)).toHaveLength(1)
  })

  // A `# comment` inside a code sample is not a heading.
  it('skips headings inside fenced code', () => {
    const md = ['# 真标题', '', '```bash', '# 这是注释', '```', '', '## 另一个真标题'].join('\n')
    expect(extractHeadings(md).map(h => h.text)).toEqual(['真标题', '另一个真标题'])
  })

  it('handles tilde fences too', () => {
    const md = ['~~~', '# 注释', '~~~', '## 真的'].join('\n')
    expect(extractHeadings(md).map(h => h.text)).toEqual(['真的'])
  })

  it('makes duplicate titles unique so anchors do not collide', () => {
    const md = '## 用法\n## 用法\n## 用法'
    expect(extractHeadings(md).map(h => h.id)).toEqual(['用法', '用法-2', '用法-3'])
  })

  it('strips trailing hashes', () => {
    expect(extractHeadings('## 标题 ##')[0]!.text).toBe('标题')
  })

  it('ignores a hash with no space', () => {
    expect(extractHeadings('#标签不是标题')).toEqual([])
  })

  it('returns nothing for a document without headings', () => {
    expect(extractHeadings('只是一段正文')).toEqual([])
  })
})
