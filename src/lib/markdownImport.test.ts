import { describe, it, expect } from 'vitest'
import { parseMarkdownFile, validateMarkdownFile } from './markdownImport'

describe('parseMarkdownFile', () => {
  it('takes the title from a leading H1 and removes it from the body', () => {
    const result = parseMarkdownFile('note.md', '# 我的标题\n\n正文第一段。')
    expect(result.title).toBe('我的标题')
    expect(result.body).toBe('正文第一段。')
  })

  it('reads front-matter title, tags and summary', () => {
    const md = [
      '---',
      'title: 前端笔记',
      'tags: React, 前端',
      'summary: 一些实践记录',
      '---',
      '',
      '正文内容',
    ].join('\n')
    const result = parseMarkdownFile('whatever.md', md)
    expect(result.title).toBe('前端笔记')
    expect(result.tags).toEqual(['React', '前端'])
    expect(result.summary).toBe('一些实践记录')
    expect(result.body).toBe('正文内容')
  })

  it('accepts a bracketed tag list', () => {
    const md = '---\ntags: [a, b, c]\n---\n正文'
    expect(parseMarkdownFile('x.md', md).tags).toEqual(['a', 'b', 'c'])
  })

  it('prefers front-matter over a leading heading', () => {
    const md = '---\ntitle: 来自 front-matter\n---\n# 来自标题\n正文'
    const result = parseMarkdownFile('x.md', md)
    expect(result.title).toBe('来自 front-matter')
    // The H1 stays in the body because it was not used as the title.
    expect(result.body).toContain('# 来自标题')
  })

  it('falls back to the filename', () => {
    const result = parseMarkdownFile('my-first_note.md', '没有标题的正文')
    expect(result.title).toBe('my first note')
  })

  it('derives a summary from the first prose line', () => {
    const result = parseMarkdownFile('x.md', '# 标题\n\n> 引用\n\n这是第一段正文。')
    expect(result.summary).toBe('这是第一段正文。')
  })

  it('keeps the whole body when there is no heading or front-matter', () => {
    const result = parseMarkdownFile('x.md', '第一行\n第二行')
    expect(result.body).toBe('第一行\n第二行')
  })

  it('handles CRLF line endings', () => {
    const result = parseMarkdownFile('x.md', '# 标题\r\n\r\n正文')
    expect(result.title).toBe('标题')
    expect(result.body).toBe('正文')
  })

  it('strips a BOM', () => {
    const result = parseMarkdownFile('x.md', '﻿# 标题\n正文')
    expect(result.title).toBe('标题')
  })

  it('never returns an empty title', () => {
    expect(parseMarkdownFile('.md', '').title).toBe('未命名')
  })
})

describe('validateMarkdownFile', () => {
  it('accepts .md and .markdown', () => {
    expect(validateMarkdownFile({ name: 'a.md', size: 10 })).toBeNull()
    expect(validateMarkdownFile({ name: 'a.markdown', size: 10 })).toBeNull()
  })

  it('rejects other extensions', () => {
    expect(validateMarkdownFile({ name: 'a.txt', size: 10 })).toMatch(/只支持/)
    expect(validateMarkdownFile({ name: 'a.md.exe', size: 10 })).toMatch(/只支持/)
  })

  it('rejects oversized files', () => {
    expect(validateMarkdownFile({ name: 'a.md', size: 5 * 1024 * 1024 })).toMatch(/不能超过/)
  })
})
