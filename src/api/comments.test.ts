import { describe, it, expect, beforeEach } from 'vitest'
import { listComments, addComment, removeComment } from './comments'
import { createPkm, publishAsArticle, revertToNote, updatePkm } from './pkm'
import { articleComments } from '../mockData'

function draft(title: string) {
  return {
    title,
    body: '正文',
    contentKind: 'note' as const,
    visibility: 'public' as const,
    tagNames: [],
    folderIds: [],
    seriesIds: [],
  }
}

async function anArticle(author = 'euan') {
  const note = await createPkm(author, draft('一篇文章'))
  return publishAsArticle(note.id, author)
}

beforeEach(() => {
  articleComments.length = 0
})

describe('posting', () => {
  it('accepts a comment on an article with comments on', async () => {
    const article = await anArticle()
    const posted = await addComment(article.id, 'alice', '写得好')

    expect(posted.author).toBe('alice')
    expect(await listComments(article.id)).toHaveLength(1)
  })

  it('rejects an empty comment', async () => {
    const article = await anArticle()
    await expect(addComment(article.id, 'alice', '   ')).rejects.toThrow('请先写下评论内容')
  })

  it('trims the body', async () => {
    const article = await anArticle()
    const posted = await addComment(article.id, 'alice', '  有空格  ')
    expect(posted.body).toBe('有空格')
  })

  // 需求 10.1: comments belong to articles, not notes.
  it('rejects a comment on a note', async () => {
    const note = await createPkm('euan', draft('笔记'))
    await expect(addComment(note.id, 'alice', '你好')).rejects.toThrow('这篇内容没有开启评论')
  })

  it('rejects a comment once the author switches comments off', async () => {
    const article = await anArticle()
    await updatePkm(article.id, 'euan', { allowComments: false })
    await expect(addComment(article.id, 'alice', '你好')).rejects.toThrow('这篇内容没有开启评论')
  })

  // Isolates the form check from the flag: a note carrying allowComments must
  // still be refused, so the two conditions are not redundant.
  it('rejects a comment on a note even if the flag says otherwise', async () => {
    const article = await anArticle()
    await updatePkm(article.id, 'euan', { contentKind: 'note', allowComments: true })
    await expect(addComment(article.id, 'alice', '你好')).rejects.toThrow('这篇内容没有开启评论')
  })

  // The flag alone is not enough: reverting must stop new comments even if the
  // stored flag were left on.
  it('rejects a comment after the article is reverted to a note', async () => {
    const article = await anArticle()
    await revertToNote(article.id, 'euan')
    await expect(addComment(article.id, 'alice', '你好')).rejects.toThrow('这篇内容没有开启评论')
  })
})

describe('removing', () => {
  it('lets a commenter delete their own', async () => {
    const article = await anArticle()
    const posted = await addComment(article.id, 'alice', '写得好')

    await removeComment(article.id, posted.id, 'alice')
    expect(await listComments(article.id)).toHaveLength(0)
  })

  it('lets the content author remove any comment on their content', async () => {
    const article = await anArticle('euan')
    const posted = await addComment(article.id, 'alice', '写得好')

    await removeComment(article.id, posted.id, 'euan')
    expect(await listComments(article.id)).toHaveLength(0)
  })

  it('refuses a stranger, and says nothing about the comment existing', async () => {
    const article = await anArticle('euan')
    const posted = await addComment(article.id, 'alice', '写得好')

    await expect(removeComment(article.id, posted.id, 'bob')).rejects.toThrow('评论不存在')
    expect(await listComments(article.id)).toHaveLength(1)
  })

  it('does not delete across content, even for the right comment id', async () => {
    const one = await anArticle('euan')
    const two = await anArticle('euan')
    const posted = await addComment(one.id, 'alice', '写得好')

    await expect(removeComment(two.id, posted.id, 'alice')).rejects.toThrow('评论不存在')
    expect(await listComments(one.id)).toHaveLength(1)
  })
})

describe('listing', () => {
  it('returns comments oldest first', async () => {
    const article = await anArticle()
    const first = await addComment(article.id, 'alice', '第一条')
    const second = await addComment(article.id, 'bob', '第二条')

    const rows = await listComments(article.id)
    expect(rows.map(c => c.id)).toEqual([first.id, second.id])
  })

  it('keeps each article to its own comments', async () => {
    const one = await anArticle('euan')
    const two = await anArticle('euan')
    await addComment(one.id, 'alice', '给第一篇')

    expect(await listComments(two.id)).toHaveLength(0)
  })
})
