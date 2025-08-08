import ReactMarkdown, { type Components } from 'react-markdown'
import { LightAsync as SyntaxHighlighter } from 'react-syntax-highlighter'
import ts from 'react-syntax-highlighter/dist/esm/languages/hljs/typescript'
import js from 'react-syntax-highlighter/dist/esm/languages/hljs/javascript'
// @ts-ignore
import * as languages from 'react-syntax-highlighter/dist/esm/languages/hljs'
import { useMemo } from 'react'
import * as themes from 'react-syntax-highlighter/dist/esm/styles/hljs'

Object.entries(languages).forEach(([name, lang]) => {
  SyntaxHighlighter.registerLanguage(name, lang)
})

// Associate the languages with tsx and jsx
SyntaxHighlighter.registerLanguage('jsx', js)
SyntaxHighlighter.registerLanguage('tsx', ts)

export type MarkdownRendererProps = {
  content: string
  copyToClipboard?: (text: string) => void
  isDarkMode?: boolean
  codeTheme?: string
}

export function MarkdownRenderer({
  content,
  copyToClipboard,
  isDarkMode = false,
  codeTheme = 'atomOneLight'
}: MarkdownRendererProps) {
  const selectedSyntaxTheme = useMemo(() => {
    // @ts-ignore
    return themes[codeTheme] ?? themes.atomOneLight
  }, [codeTheme])

  const components: Components = {
    code: ({ className, children, ...rest }: any) => {
      const inline = rest.inline
      const match = /language-(\w+)/.exec(className || '')
      const codeString = String(children).replace(/\n$/, '')

      if (!inline && match) {
        return (
          <div className='relative my-2 overflow-x-auto break-words'>
            {copyToClipboard && (
              <button
                onClick={() => copyToClipboard(codeString)}
                className={`
                  absolute top-2 right-2 text-xs px-2 py-1 border rounded shadow
                  ${
                    isDarkMode
                      ? 'bg-neutral-800 text-neutral-100 hover:bg-neutral-700'
                      : 'bg-neutral-50 text-neutral-900 hover:bg-neutral-200'
                  }
                `}
                title='Copy code'
              >
                Copy
              </button>
            )}
            {/* @ts-ignore */}
            <SyntaxHighlighter language={match[1]} style={selectedSyntaxTheme} showLineNumbers wrapLongLines>
              {codeString}
            </SyntaxHighlighter>
          </div>
        )
      }

      return (
        <code className={className} {...rest}>
          {children}
        </code>
      )
    }
  }

  return <ReactMarkdown components={components}>{content}</ReactMarkdown>
}
