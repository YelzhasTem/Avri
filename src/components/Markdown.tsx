import { Check, Copy } from 'lucide-react'
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  parseMarkdown,
  type BlockNode,
  type InlineNode,
} from '../services/markdown'

const HEADING_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    return
  } catch {
    // Fall back to a hidden textarea when the async clipboard is unavailable.
  }

  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  document.execCommand('copy')
  area.remove()
}

function CodeBlock({ language, text }: { language: string; text: string }) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  const copy = async () => {
    await copyText(text)
    setCopied(true)
    window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => setCopied(false), 1_600)
  }

  return (
    <div className="avri-md-code">
      <div className="avri-md-code-header">
        <span>{language || 'code'}</span>
        <button
          type="button"
          className="avri-md-copy"
          aria-label={copied ? 'Copied' : 'Copy code'}
          onClick={() => void copy()}
        >
          {copied ? (
            <Check size={13} strokeWidth={2} aria-hidden="true" />
          ) : (
            <Copy size={13} strokeWidth={1.8} aria-hidden="true" />
          )}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre>
        <code>{text}</code>
      </pre>
    </div>
  )
}

function renderInline(nodes: InlineNode[]): ReactNode[] {
  return nodes.map((node, index) => {
    switch (node.type) {
      case 'text':
        return node.text
      case 'code':
        return <code key={index}>{node.text}</code>
      case 'strong':
        return <strong key={index}>{renderInline(node.children)}</strong>
      case 'em':
        return <em key={index}>{renderInline(node.children)}</em>
      case 'del':
        return <del key={index}>{renderInline(node.children)}</del>
      case 'link':
        return (
          <a key={index} href={node.href} target="_blank" rel="noreferrer noopener" title={node.href}>
            {renderInline(node.children)}
          </a>
        )
      case 'break':
        return <br key={index} />
    }
  })
}

function renderBlocks(blocks: BlockNode[]): ReactNode[] {
  return blocks.map((block, index) => {
    switch (block.type) {
      case 'paragraph':
        return <p key={index}>{renderInline(block.children)}</p>
      case 'heading': {
        const Tag = HEADING_TAGS[block.level - 1]
        return <Tag key={index}>{renderInline(block.children)}</Tag>
      }
      case 'code':
        return <CodeBlock key={index} language={block.language} text={block.text} />
      case 'list': {
        const items = block.items.map((item, itemIndex) => (
          <li key={itemIndex}>{renderBlocks(item)}</li>
        ))
        return block.ordered ? (
          <ol key={index} start={block.start === 1 ? undefined : block.start}>
            {items}
          </ol>
        ) : (
          <ul key={index}>{items}</ul>
        )
      }
      case 'blockquote':
        return <blockquote key={index}>{renderBlocks(block.children)}</blockquote>
      case 'table':
        return (
          <div key={index} className="avri-md-table">
            <table>
              <thead>
                <tr>
                  {block.header.map((cell, column) => (
                    <th key={column} style={{ textAlign: block.align[column] ?? undefined }}>
                      {renderInline(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, column) => (
                      <td key={column} style={{ textAlign: block.align[column] ?? undefined }}>
                        {renderInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      case 'rule':
        return <hr key={index} />
    }
  })
}

/**
 * Renders model output as Markdown. The parser never produces raw HTML and
 * keeps only http(s) links, so no dangerouslySetInnerHTML is involved.
 */
export const Markdown = memo(function Markdown({ content }: { content: string }) {
  const blocks = useMemo(() => parseMarkdown(content), [content])
  return <div className="avri-md">{renderBlocks(blocks)}</div>
})
