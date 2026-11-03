import { extractText, getDocumentProxy } from 'unpdf'
import mammoth from 'mammoth'

export interface Extracted {
  fileName: string
  name: string
  text: string
  pages: number | null
  words: number
}

function tidy(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

/** The first short line that looks like a person's name. */
function guessName(text: string, fileName: string): string {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 8)
  const looksLikeName = (l: string) =>
    l.length >= 4 && l.length <= 40 && /^[\p{L}][\p{L}'’.\- ]+$/u.test(l) && l.split(/\s+/).length <= 4 &&
    !/curriculum|resume|résumé|cv\b/i.test(l)
  const hit = lines.find(looksLikeName)
  if (hit) return hit.replace(/\b\p{L}+/gu, (w) => (w === w.toUpperCase() ? w[0] + w.slice(1).toLowerCase() : w))
  return fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')
}

export async function extractCv(file: File): Promise<Extracted> {
  const buf = new Uint8Array(await file.arrayBuffer())
  const lower = file.name.toLowerCase()
  let text: string
  let pages: number | null = null

  if (file.type === 'application/pdf' || lower.endsWith('.pdf')) {
    const pdf = await getDocumentProxy(buf)
    const out = await extractText(pdf, { mergePages: false })
    pages = out.totalPages
    text = (out.text as Array<string>).join('\n\n')
  } else if (lower.endsWith('.docx')) {
    const out = await mammoth.extractRawText({ buffer: Buffer.from(buf) })
    text = out.value
  } else if (file.type.startsWith('text/') || /\.(txt|md)$/.test(lower)) {
    text = new TextDecoder().decode(buf)
  } else {
    throw new Error('Use a PDF, DOCX, TXT or MD file')
  }

  text = tidy(text)
  if (text.length < 80) throw new Error('No readable text found. Is this a scanned PDF?')
  return {
    fileName: file.name,
    name: guessName(text, file.name),
    text,
    pages,
    words: text.split(/\s+/).length,
  }
}
