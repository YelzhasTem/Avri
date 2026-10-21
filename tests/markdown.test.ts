import { describe, expect, it } from 'vitest'
import {
  parseInline,
  parseMarkdown,
  type BlockNode,
  type InlineNode,
} from '../src/services/markdown'

function textOf(nodes: InlineNode[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case 'text':
        case 'code':
          return node.text
        case 'break':
          return '\n'
        default:
          return textOf(node.children)
      }
    })
    .join('')
}

function findLinks(nodes: InlineNode[]): string[] {
  return nodes.flatMap((node) => {
    if (node.type === 'link') {
      return [node.href, ...findLinks(node.children)]
    }
    if (node.type === 'strong' || node.type === 'em' || node.type === 'del') {
      return findLinks(node.children)
    }
    return []
  })
}

function only<T extends BlockNode['type']>(
  blocks: BlockNode[],
  type: T,
): Extract<BlockNode, { type: T }> {
  expect(blocks).toHaveLength(1)
  expect(blocks[0].type).toBe(type)
  return blocks[0] as Extract<BlockNode, { type: T }>
}

describe('markdown blocks', () => {
  it('parses headings and paragraphs', () => {
    const blocks = parseMarkdown('## Plan\n\nFirst line\nsecond line')

    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toMatchObject({ type: 'heading', level: 2 })
    expect(blocks[1].type).toBe('paragraph')
    if (blocks[1].type === 'paragraph') {
      expect(textOf(blocks[1].children)).toBe('First line\nsecond line')
    }
  })

  it('does not treat a hashtag as a heading', () => {
    expect(only(parseMarkdown('#notaheading'), 'paragraph').type).toBe('paragraph')
  })

  it('parses a closed code fence with its language', () => {
    const code = only(parseMarkdown('```ts\nconst a = 1\n\nconsole.log(a)\n```'), 'code')

    expect(code.language).toBe('ts')
    expect(code.text).toBe('const a = 1\n\nconsole.log(a)')
    expect(code.closed).toBe(true)
  })

  it('keeps an unfinished code fence while a reply is streaming', () => {
    const code = only(parseMarkdown('```python\nprint("hi")'), 'code')

    expect(code.closed).toBe(false)
    expect(code.text).toBe('print("hi")')
  })

  it('does not read markdown inside code blocks', () => {
    const code = only(parseMarkdown('```\n**not bold** [x](https://a.com)\n```'), 'code')
    expect(code.text).toBe('**not bold** [x](https://a.com)')
  })

  it('parses bullet and numbered lists with nesting', () => {
    const list = only(
      parseMarkdown('1. Morning\n   - read\n   - code\n2. Evening'),
      'list',
    )

    expect(list.ordered).toBe(true)
    expect(list.start).toBe(1)
    expect(list.items).toHaveLength(2)
    expect(list.items[0][1]).toMatchObject({ type: 'list', ordered: false })
    if (list.items[0][1].type === 'list') {
      expect(list.items[0][1].items).toHaveLength(2)
    }
  })

  it('keeps the start number of an ordered list', () => {
    expect(only(parseMarkdown('3. third\n4. fourth'), 'list').start).toBe(3)
  })

  it('separates a list from the paragraph that follows a blank line', () => {
    const blocks = parseMarkdown('- one\n- two\n\nAfter the list')

    expect(blocks.map((block) => block.type)).toEqual(['list', 'paragraph'])
  })

  it('parses tables with alignment', () => {
    const table = only(
      parseMarkdown('| Name | Score |\n| :--- | ---: |\n| Avri | 10 |\n| Bot |'),
      'table',
    )

    expect(table.align).toEqual(['left', 'right'])
    expect(table.header.map(textOf)).toEqual(['Name', 'Score'])
    expect(table.rows).toHaveLength(2)
    expect(table.rows[1].map(textOf)).toEqual(['Bot', ''])
  })

  it('parses blockquotes and horizontal rules', () => {
    const blocks = parseMarkdown('> quoted\n> text\n\n---')

    expect(blocks.map((block) => block.type)).toEqual(['blockquote', 'rule'])
  })

  it('handles CRLF line endings and empty input', () => {
    expect(parseMarkdown('')).toEqual([])
    expect(parseMarkdown('a\r\nb')).toHaveLength(1)
  })
})

describe('markdown inline', () => {
  it('parses bold, italic, strikethrough and code', () => {
    const nodes = parseInline('**bold** and *italic* and ~~gone~~ and `code`')

    expect(nodes.map((node) => node.type)).toEqual([
      'strong',
      'text',
      'em',
      'text',
      'del',
      'text',
      'code',
    ])
  })

  it('leaves unfinished emphasis as plain text', () => {
    expect(parseInline('**still typing')).toEqual([
      { type: 'text', text: '**still typing' },
    ])
  })

  it('does not italicise snake_case or arithmetic', () => {
    expect(textOf(parseInline('use my_var_name and 2 * 3 * 4'))).toBe(
      'use my_var_name and 2 * 3 * 4',
    )
    expect(parseInline('use my_var_name')).toHaveLength(1)
  })

  it('handles bold italic', () => {
    const [node] = parseInline('***both***')

    expect(node.type).toBe('strong')
    if (node.type === 'strong') {
      expect(node.children[0].type).toBe('em')
    }
  })

  it('keeps http and https links', () => {
    expect(findLinks(parseInline('[docs](https://ai.google.dev) and http://a.com/x'))).toEqual([
      'https://ai.google.dev',
      'http://a.com/x',
    ])
  })

  it('drops trailing punctuation from bare links', () => {
    expect(findLinks(parseInline('See https://example.com/page.'))).toEqual([
      'https://example.com/page',
    ])
  })

  it.each([
    '[click](javascript:alert(1))',
    '[file](file:///etc/passwd)',
    '[data](data:text/html,<b>x</b>)',
    '[relative](/settings)',
  ])('turns unsafe links into plain text: %s', (source) => {
    const nodes = parseInline(source)

    expect(findLinks(nodes)).toEqual([])
    expect(textOf(nodes)).not.toContain('(')
  })

  it('never interprets raw HTML', () => {
    const source = '<script>alert("x")</script><img src=x onerror=alert(1)>'
    const blocks = parseMarkdown(source)
    const paragraph = only(blocks, 'paragraph')

    expect(paragraph.children).toEqual([{ type: 'text', text: source }])
  })

  it('supports backslash escapes', () => {
    expect(textOf(parseInline('\\*not italic\\*'))).toBe('*not italic*')
  })

  it('turns newlines into line breaks', () => {
    expect(parseInline('a\nb').map((node) => node.type)).toEqual([
      'text',
      'break',
      'text',
    ])
  })
})
