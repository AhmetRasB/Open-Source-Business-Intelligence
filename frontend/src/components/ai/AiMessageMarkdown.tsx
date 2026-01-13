import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import { TypographyStylesProvider } from '@mantine/core'

function toSafeHtmlWithMentions(md: string) {
  // Convert @mentions to span tags so we can style them green.
  // Then allow only safe tags via rehype-sanitize below.
  return md.replace(/@([A-Za-z0-9_.]+)/g, '<span class="mention">@$1</span>')
}

const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    span: [...(defaultSchema.attributes?.span ?? []), ['className', 'mention'], ['class', 'mention']],
  },
}

export function AiMessageMarkdown({ text }: { text: string }) {
  const prepared = useMemo(() => toSafeHtmlWithMentions(text), [text])

  return (
    <TypographyStylesProvider
      style={{
        fontSize: 13,
        lineHeight: 1.4,
      }}
    >
      <div
        className="ai-md"
        style={{
          wordBreak: 'break-word',
        }}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[[rehypeRaw], [rehypeSanitize, schema]]}
        >
          {prepared}
        </ReactMarkdown>
      </div>
      <style>
        {`
          .ai-md .mention {
            color: var(--mantine-color-green-7);
            font-weight: 700;
          }
        `}
      </style>
    </TypographyStylesProvider>
  )
}


