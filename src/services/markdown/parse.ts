import { isSafeExternalUrl } from '../links'

export type InlineNode =
  | { type: 'text'; text: string }
  | { type: 'code'; text: string }
  | { type: 'strong'; children: InlineNode[] }
  | { type: 'em'; children: InlineNode[] }
  | { type: 'del'; children: InlineNode[] }
  | { type: 'link'; href: string; children: InlineNode[] }
  | { type: 'break' }

export type TableAlign = 'left' | 'center' | 'right' | null

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

export type BlockNode =
  | { type: 'paragraph'; children: InlineNode[] }
  | { type: 'heading'; level: HeadingLevel; children: InlineNode[] }
  | { type: 'code'; language: string; text: string; closed: boolean }
  | { type: 'list'; ordered: boolean; start: number; items: BlockNode[][] }
  | { type: 'blockquote'; children: BlockNode[] }
  | {
      type: 'table'
      align: TableAlign[]
      header: InlineNode[][]
      rows: InlineNode[][][]
    }
  | { type: 'rule' }

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})[ \t]*([^\s`]*)[^`]*$/
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/
const HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*#*[ \t]*$/
const RULE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/
const BLOCKQUOTE = /^ {0,3}> ?(.*)$/
const LIST_ITEM = /^( *)([-*+]|\d{1,9}[.)])(?:([ \t]+)(.*))?$/
const TABLE_DELIMITER = /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/
const ESCAPABLE = /[\\`*_{}[\]()#+\-.!|~<>]/
const AUTOLINK = /^https?:\/\/[^\s<>"]*[^\s<>"'.,;:!?)\]*_~]/
const ANGLE_AUTOLINK = /^<(https?:\/\/[^\s<>]+)>/
const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const

/**
 * Parses the Markdown subset that chat models produce into a plain tree.
 * Raw HTML is never interpreted: it stays text. Links survive only when
 * they point to http(s). Unfinished syntax (an open code fence while a
 * response is still streaming) degrades gracefully instead of throwing.
 */
export function parseMarkdown(source: string): BlockNode[] {
  const lines = source
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/^\t+/, (tabs) => '    '.repeat(tabs.length)))

  return parseBlocks(lines)
}

function isBlank(line: string): boolean {
  return line.trim() === ''
}

function leadingSpaces(line: string): number {
  return line.length - line.trimStart().length
}

function isTableStart(lines: string[], index: number): boolean {
  const line = lines[index]
  const next = lines[index + 1]

  if (!line?.includes('|') || next === undefined || !TABLE_DELIMITER.test(next)) {
    return false
  }

  return splitRow(line).length === splitRow(next).length
}

function startsBlock(lines: string[], index: number): boolean {
  const line = lines[index]
  return (
    FENCE_OPEN.test(line) ||
    HEADING.test(line) ||
    RULE.test(line) ||
    BLOCKQUOTE.test(line) ||
    LIST_ITEM.test(line) ||
    isTableStart(lines, index)
  )
}

function parseBlocks(lines: string[]): BlockNode[] {
  const blocks: BlockNode[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    if (isBlank(line)) {
      index += 1
      continue
    }

    const fence = FENCE_OPEN.exec(line)
    if (fence) {
      const marker = fence[1]
      const indent = leadingSpaces(line)
      const body: string[] = []
      let closed = false
      index += 1

      while (index < lines.length) {
        const candidate = lines[index]
        const closing = FENCE_CLOSE.exec(candidate)
        index += 1

        if (
          closing &&
          closing[1][0] === marker[0] &&
          closing[1].length >= marker.length
        ) {
          closed = true
          break
        }

        body.push(candidate.slice(Math.min(indent, leadingSpaces(candidate))))
      }

      blocks.push({
        type: 'code',
        language: fence[2] ?? '',
        text: body.join('\n'),
        closed,
      })
      continue
    }

    const heading = HEADING.exec(line)
    if (heading) {
      blocks.push({
        type: 'heading',
        level: HEADING_LEVELS[heading[1].length - 1],
        children: parseInline(heading[2] ?? ''),
      })
      index += 1
      continue
    }

    if (RULE.test(line)) {
      blocks.push({ type: 'rule' })
      index += 1
      continue
    }

    if (BLOCKQUOTE.test(line)) {
      const quoted: string[] = []

      while (index < lines.length && !isBlank(lines[index])) {
        const match = BLOCKQUOTE.exec(lines[index])

        if (match) {
          quoted.push(match[1])
        } else if (!startsBlock(lines, index)) {
          quoted.push(lines[index])
        } else {
          break
        }

        index += 1
      }

      blocks.push({ type: 'blockquote', children: parseBlocks(quoted) })
      continue
    }

    if (isTableStart(lines, index)) {
      const header = splitRow(line)
      const align = splitRow(lines[index + 1]).map(toAlign)
      const rows: InlineNode[][][] = []
      index += 2

      while (
        index < lines.length &&
        !isBlank(lines[index]) &&
        lines[index].includes('|')
      ) {
        const cells = splitRow(lines[index])
        rows.push(header.map((_, column) => parseInline(cells[column] ?? '')))
        index += 1
      }

      blocks.push({
        type: 'table',
        align,
        header: header.map(parseInline),
        rows,
      })
      continue
    }

    if (LIST_ITEM.test(line)) {
      const [list, next] = parseList(lines, index)
      blocks.push(list)
      index = next
      continue
    }

    const paragraph: string[] = [line.trim()]
    index += 1

    while (
      index < lines.length &&
      !isBlank(lines[index]) &&
      !startsBlock(lines, index)
    ) {
      paragraph.push(lines[index].trim())
      index += 1
    }

    blocks.push({ type: 'paragraph', children: parseInline(paragraph.join('\n')) })
  }

  return blocks
}

function parseList(lines: string[], start: number): [BlockNode, number] {
  const first = LIST_ITEM.exec(lines[start])
  const ordered = Boolean(first && /\d/.test(first[2]))
  const startNumber = ordered && first ? Number.parseInt(first[2], 10) : 1
  const items: string[][] = []
  let current: string[] | null = null
  let contentIndent = Number.POSITIVE_INFINITY
  let previousBlank = false
  let index = start

  while (index < lines.length) {
    const line = lines[index]

    if (isBlank(line)) {
      current?.push('')
      previousBlank = true
      index += 1
      continue
    }

    const indent = leadingSpaces(line)
    const item = LIST_ITEM.exec(line)

    if (item && indent < contentIndent) {
      if (/\d/.test(item[2]) !== ordered || RULE.test(line)) {
        break
      }

      if (current) {
        items.push(current)
      }

      const gap = item[3]?.length ?? 1
      contentIndent = item[1].length + item[2].length + (gap > 4 ? 1 : gap)
      current = [item[4] ?? '']
      previousBlank = false
      index += 1
      continue
    }

    if (indent >= contentIndent) {
      current?.push(line.slice(contentIndent))
      previousBlank = false
      index += 1
      continue
    }

    if (!previousBlank && !startsBlock(lines, index)) {
      current?.push(line.trim())
      index += 1
      continue
    }

    break
  }

  if (current) {
    items.push(current)
  }

  return [
    {
      type: 'list',
      ordered,
      start: startNumber,
      items: items.map((itemLines) => parseBlocks(trimTrailingBlanks(itemLines))),
    },
    index,
  ]
}

function trimTrailingBlanks(lines: string[]): string[] {
  let end = lines.length
  while (end > 0 && isBlank(lines[end - 1])) {
    end -= 1
  }
  return lines.slice(0, end)
}

function splitRow(line: string): string[] {
  let row = line.trim()
  if (row.startsWith('|')) {
    row = row.slice(1)
  }
  if (row.endsWith('|') && !row.endsWith('\\|')) {
    row = row.slice(0, -1)
  }

  const cells: string[] = []
  let cell = ''
  let inCode = false

  for (let index = 0; index < row.length; index += 1) {
    const char = row[index]

    if (char === '\\' && row[index + 1] === '|') {
      cell += '|'
      index += 1
    } else if (char === '`') {
      inCode = !inCode
      cell += char
    } else if (char === '|' && !inCode) {
      cells.push(cell.trim())
      cell = ''
    } else {
      cell += char
    }
  }

  cells.push(cell.trim())
  return cells
}

function toAlign(cell: string): TableAlign {
  const value = cell.trim()
  const left = value.startsWith(':')
  const right = value.endsWith(':')

  if (left && right) {
    return 'center'
  }
  if (right) {
    return 'right'
  }
  if (left) {
    return 'left'
  }
  return null
}

function pushText(nodes: InlineNode[], text: string): void {
  if (!text) {
    return
  }

  const last = nodes[nodes.length - 1]
  if (last?.type === 'text') {
    last.text += text
  } else {
    nodes.push({ type: 'text', text })
  }
}

function isWhitespace(char: string | undefined): boolean {
  return char === undefined || /\s/.test(char)
}

function isWordChar(char: string | undefined): boolean {
  return char !== undefined && /[\p{L}\p{N}]/u.test(char)
}

export function parseInline(source: string): InlineNode[] {
  const nodes: InlineNode[] = []
  let buffer = ''
  let index = 0

  const flush = () => {
    pushText(nodes, buffer)
    buffer = ''
  }

  while (index < source.length) {
    const char = source[index]

    if (char === '\\' && ESCAPABLE.test(source[index + 1] ?? '')) {
      buffer += source[index + 1]
      index += 2
      continue
    }

    if (char === '\n') {
      buffer = buffer.replace(/[ \t]+$/, '')
      flush()
      nodes.push({ type: 'break' })
      index += 1
      continue
    }

    if (char === '`') {
      const run = countRun(source, index, '`')
      const close = findRun(source, index + run, '`', run)

      if (close !== -1) {
        let text = source.slice(index + run, close).replace(/\n/g, ' ')
        if (text.length > 2 && text.startsWith(' ') && text.endsWith(' ') && text.trim()) {
          text = text.slice(1, -1)
        }
        flush()
        nodes.push({ type: 'code', text })
        index = close + run
        continue
      }

      buffer += '`'.repeat(run)
      index += run
      continue
    }

    if (char === '[' || (char === '!' && source[index + 1] === '[')) {
      const link = matchLink(source, char === '!' ? index + 1 : index)

      if (link) {
        const children = parseInline(link.text)
        flush()

        if (isSafeExternalUrl(link.href)) {
          nodes.push({
            type: 'link',
            href: link.href,
            children: children.length ? children : [{ type: 'text', text: link.href }],
          })
        } else {
          for (const child of children) {
            if (child.type === 'text') {
              pushText(nodes, child.text)
            } else {
              nodes.push(child)
            }
          }
        }

        index = link.end
        continue
      }
    }

    if (char === '<') {
      const match = ANGLE_AUTOLINK.exec(source.slice(index))
      if (match && isSafeExternalUrl(match[1])) {
        flush()
        nodes.push({ type: 'link', href: match[1], children: [{ type: 'text', text: match[1] }] })
        index += match[0].length
        continue
      }
    }

    if (char === 'h' && !isWordChar(source[index - 1])) {
      const match = AUTOLINK.exec(source.slice(index))
      if (match && isSafeExternalUrl(match[0])) {
        flush()
        nodes.push({ type: 'link', href: match[0], children: [{ type: 'text', text: match[0] }] })
        index += match[0].length
        continue
      }
    }

    if (char === '*' || char === '_' || char === '~') {
      const emphasis = matchEmphasis(source, index)
      if (emphasis) {
        flush()
        nodes.push(emphasis.node)
        index = emphasis.end
        continue
      }
    }

    buffer += char
    index += 1
  }

  flush()
  return nodes
}

function countRun(source: string, start: number, char: string): number {
  let end = start
  while (source[end] === char) {
    end += 1
  }
  return end - start
}

function findRun(source: string, from: number, char: string, length: number): number {
  let index = from

  while (index < source.length) {
    if (source[index] === char) {
      const run = countRun(source, index, char)
      if (run === length) {
        return index
      }
      index += run
    } else {
      index += 1
    }
  }

  return -1
}

function findMatching(source: string, start: number, open: string, close: string): number {
  let depth = 0

  for (let index = start; index < source.length; index += 1) {
    const char = source[index]

    if (char === '\\') {
      index += 1
    } else if (char === open) {
      depth += 1
    } else if (char === close) {
      depth -= 1
      if (depth === 0) {
        return index
      }
    }
  }

  return -1
}

function matchLink(
  source: string,
  start: number,
): { text: string; href: string; end: number } | null {
  const textEnd = findMatching(source, start, '[', ']')
  if (textEnd === -1 || source[textEnd + 1] !== '(') {
    return null
  }

  const targetEnd = findMatching(source, textEnd + 1, '(', ')')
  if (targetEnd === -1) {
    return null
  }

  const target = source.slice(textEnd + 2, targetEnd).trim()
  const href = (/^<([^>]*)>/.exec(target)?.[1] ?? target.split(/\s+/)[0] ?? '').trim()

  return { text: source.slice(start + 1, textEnd), href, end: targetEnd + 1 }
}

function matchEmphasis(
  source: string,
  start: number,
): { node: InlineNode; end: number } | null {
  const char = source[start]

  if (char === '~') {
    if (source[start + 1] !== '~' || isWhitespace(source[start + 2])) {
      return null
    }
    const close = source.indexOf('~~', start + 2)
    if (close === -1 || isWhitespace(source[close - 1])) {
      return null
    }
    return {
      node: { type: 'del', children: parseInline(source.slice(start + 2, close)) },
      end: close + 2,
    }
  }

  if (char === '_' && isWordChar(source[start - 1])) {
    return null
  }

  const double = source[start + 1] === char
  const width = double ? 2 : 1
  const delimiter = char.repeat(width)

  if (isWhitespace(source[start + width]) || (!double && source[start + 1] === char)) {
    return null
  }

  let search = start + width
  while (search < source.length) {
    let close = source.indexOf(delimiter, search)
    if (close === -1) {
      return null
    }

    while (double && source[close + 2] === char) {
      close += 1
    }

    const before = source[close - 1]
    const after = source[close + width]
    const validClose =
      close > start + width &&
      !isWhitespace(before) &&
      (double || after !== char) &&
      (char !== '_' || !isWordChar(after))

    if (validClose) {
      const inner = source.slice(start + width, close)
      return {
        node: {
          type: double ? 'strong' : 'em',
          children: parseInline(inner),
        },
        end: close + width,
      }
    }

    search = close + width
  }

  return null
}
