/**
 * Document Adapter for Multi-Modal Processing
 * Handles document parsing, extraction, and document-language tasks
 */

import { Effect, Stream, Schema, pipe, Chunk } from 'effect'

// ============================================================================
// Document Types
// ============================================================================

export interface DocumentMetadata {
  readonly format: 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'html' | 'markdown' | 'txt' | 'rtf' | 'odt'
  readonly pageCount: number
  readonly wordCount: number
  readonly characterCount: number
  readonly language: string
  readonly createdAt?: Date
  readonly modifiedAt?: Date
  readonly author?: string
  readonly title?: string
  readonly subject?: string
  readonly keywords?: string[]
  readonly fileSize: number
  readonly hasImages: boolean
  readonly hasTables: boolean
  readonly hasFormFields: boolean
}

export interface DocumentContent {
  readonly text: string
  readonly pages: PageContent[]
  readonly sections: DocumentSection[]
  readonly paragraphs: Paragraph[]
  readonly tables: Table[]
  readonly images: EmbeddedImage[]
  readonly links: Hyperlink[]
  readonly footnotes: Footnote[]
  readonly headers: Header[]
  readonly formFields?: FormField[]
  readonly annotations?: Annotation[]
}

export interface PageContent {
  readonly pageNumber: number
  readonly text: string
  readonly boundingBox: BoundingBox
  readonly elements: PageElement[]
  readonly layout: PageLayout
}

export interface PageElement {
  readonly type: 'text' | 'image' | 'table' | 'shape' | 'chart'
  readonly content: any
  readonly position: Position
  readonly style?: ElementStyle
}

export interface Position {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly rotation?: number
}

export interface ElementStyle {
  readonly fontFamily?: string
  readonly fontSize?: number
  readonly fontWeight?: string
  readonly color?: string
  readonly backgroundColor?: string
  readonly alignment?: 'left' | 'center' | 'right' | 'justify'
}

export interface PageLayout {
  readonly columns: number
  readonly orientation: 'portrait' | 'landscape'
  readonly margins: {
    readonly top: number
    readonly bottom: number
    readonly left: number
    readonly right: number
  }
}

export interface DocumentSection {
  readonly id: string
  readonly title: string
  readonly level: number
  readonly content: string
  readonly startPage: number
  readonly endPage: number
  readonly subsections: DocumentSection[]
}

export interface Paragraph {
  readonly text: string
  readonly page: number
  readonly position: Position
  readonly style: ElementStyle
  readonly type: 'normal' | 'heading' | 'quote' | 'code' | 'list'
  readonly listLevel?: number
}

export interface Table {
  readonly rows: TableRow[]
  readonly headers: string[]
  readonly page: number
  readonly position: Position
  readonly caption?: string
}

export interface TableRow {
  readonly cells: TableCell[]
}

export interface TableCell {
  readonly value: string
  readonly colspan?: number
  readonly rowspan?: number
  readonly style?: ElementStyle
}

export interface EmbeddedImage {
  readonly id: string
  readonly page: number
  readonly position: Position
  readonly caption?: string
  readonly alt?: string
  readonly data?: Buffer
  readonly url?: string
}

export interface Hyperlink {
  readonly text: string
  readonly url: string
  readonly page: number
  readonly position: Position
  readonly type: 'internal' | 'external' | 'email' | 'phone'
}

export interface Footnote {
  readonly id: string
  readonly text: string
  readonly reference: string
  readonly page: number
}

export interface Header {
  readonly level: number
  readonly text: string
  readonly page: number
  readonly id: string
}

export interface FormField {
  readonly name: string
  readonly type: 'text' | 'checkbox' | 'radio' | 'dropdown' | 'signature'
  readonly value?: any
  readonly required: boolean
  readonly page: number
  readonly position: Position
}

export interface Annotation {
  readonly type: 'highlight' | 'underline' | 'strikethrough' | 'comment'
  readonly text: string
  readonly comment?: string
  readonly author?: string
  readonly timestamp?: Date
  readonly page: number
  readonly position: Position
}

export interface BoundingBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface StructuredData {
  readonly entities: Entity[]
  readonly relationships: Relationship[]
  readonly keyValuePairs: Map<string, any>
  readonly dates: DateReference[]
  readonly numbers: NumberReference[]
  readonly emails: string[]
  readonly urls: string[]
  readonly phoneNumbers: string[]
}

export interface Entity {
  readonly type: 'person' | 'organization' | 'location' | 'date' | 'money' | 'product' | 'event'
  readonly value: string
  readonly confidence: number
  readonly context: string
  readonly page?: number
}

export interface Relationship {
  readonly subject: Entity
  readonly predicate: string
  readonly object: Entity
  readonly confidence: number
}

export interface DateReference {
  readonly text: string
  readonly date: Date
  readonly format: string
  readonly page: number
}

export interface NumberReference {
  readonly text: string
  readonly value: number
  readonly unit?: string
  readonly type: 'currency' | 'percentage' | 'quantity' | 'ordinal'
  readonly page: number
}

export interface DocumentQuery {
  readonly document: Buffer
  readonly query: string
  readonly pageRange?: { start: number; end: number }
  readonly extractTables?: boolean
  readonly extractImages?: boolean
  readonly includeMetadata?: boolean
  readonly outputFormat?: 'text' | 'json' | 'structured' | 'markdown'
}

export interface DocumentSummaryOptions {
  readonly maxLength?: number
  readonly style?: 'bullet' | 'paragraph' | 'executive'
  readonly includeTables?: boolean
  readonly includeImages?: boolean
  readonly focusAreas?: string[]
}

export interface DocumentComparisonResult {
  readonly similarity: number
  readonly differences: DocumentDifference[]
  readonly additions: string[]
  readonly deletions: string[]
  readonly modifications: string[]
  readonly structuralChanges: string[]
}

export interface DocumentDifference {
  readonly type: 'addition' | 'deletion' | 'modification'
  readonly content: string
  readonly location: {
    readonly document1?: { page: number; position: Position }
    readonly document2?: { page: number; position: Position }
  }
}

// ============================================================================
// Document Adapter Implementation
// ============================================================================

export class DocumentAdapter {
  private config: {
    readonly maxDocumentSize: number
    readonly supportedFormats: string[]
    readonly enableOCR: boolean
    readonly enableFormExtraction: boolean
    readonly enableTableExtraction: boolean
    readonly enableImageExtraction: boolean
    readonly cacheResults: boolean
    readonly defaultLanguage: string
  }

  private cache: Map<string, DocumentContent> = new Map()

  constructor(config?: Partial<typeof DocumentAdapter.prototype.config>) {
    this.config = {
      maxDocumentSize: 50 * 1024 * 1024, // 50MB
      supportedFormats: ['pdf', 'docx', 'xlsx', 'pptx', 'html', 'markdown', 'txt', 'rtf'],
      enableOCR: true,
      enableFormExtraction: true,
      enableTableExtraction: true,
      enableImageExtraction: true,
      cacheResults: true,
      defaultLanguage: 'en',
      ...config
    }
  }

  /**
   * Parse a document and extract content
   */
  parseDocument(document: Buffer): Effect.Effect<DocumentContent, Error> {
    return Effect.gen(
      function* (_) {
        // Validate document size
        if (document.length > this.config.maxDocumentSize) {
          return yield* _(
            Effect.fail(new Error(`Document size ${document.length} exceeds maximum ${this.config.maxDocumentSize}`))
          )
        }

        // Check cache
        const cacheKey = this.getCacheKey(document)
        if (this.config.cacheResults && this.cache.has(cacheKey)) {
          return this.cache.get(cacheKey)!
        }

        // Extract metadata
        const metadata = yield* _(this.extractMetadata(document))

        // Validate format
        if (!this.config.supportedFormats.includes(metadata.format)) {
          return yield* _(Effect.fail(new Error(`Unsupported document format: ${metadata.format}`)))
        }

        // Parse document based on format
        const content = yield* _(this.parseByFormat(document, metadata))

        // Cache result
        if (this.config.cacheResults) {
          this.cache.set(cacheKey, content)
        }

        return content
      }.bind(this)
    )
  }

  /**
   * Extract structured data from document
   */
  extractStructuredData(document: Buffer): Effect.Effect<StructuredData, Error> {
    return Effect.gen(
      function* (_) {
        const content = yield* _(this.parseDocument(document))

        // Extract entities
        const entities = yield* _(this.extractEntities(content.text))

        // Extract relationships
        const relationships = yield* _(this.extractRelationships(entities, content.text))

        // Extract key-value pairs
        const keyValuePairs = yield* _(this.extractKeyValuePairs(content))

        // Extract dates
        const dates = yield* _(this.extractDates(content))

        // Extract numbers
        const numbers = yield* _(this.extractNumbers(content))

        // Extract contact information
        const contacts = yield* _(this.extractContactInfo(content.text))

        return {
          entities,
          relationships,
          keyValuePairs,
          dates,
          numbers,
          emails: contacts.emails,
          urls: contacts.urls,
          phoneNumbers: contacts.phoneNumbers
        }
      }.bind(this)
    )
  }

  /**
   * Query a document with natural language
   */
  queryDocument(query: DocumentQuery): Effect.Effect<string, Error> {
    return Effect.gen(
      function* (_) {
        const content = yield* _(this.parseDocument(query.document))

        // Filter content by page range if specified
        let relevantContent = content
        if (query.pageRange) {
          relevantContent = this.filterByPageRange(content, query.pageRange)
        }

        // Process the query
        const response = yield* _(
          this.processDocumentQuery(relevantContent, query.query, {
            extractTables: query.extractTables ?? false,
            extractImages: query.extractImages ?? false,
            includeMetadata: query.includeMetadata ?? false
          })
        )

        // Format output
        return this.formatQueryResponse(response, query.outputFormat || 'text')
      }.bind(this)
    )
  }

  /**
   * Summarize a document
   */
  summarizeDocument(document: Buffer, options?: DocumentSummaryOptions): Effect.Effect<string, Error> {
    return Effect.gen(
      function* (_) {
        const content = yield* _(this.parseDocument(document))

        // Extract key information
        const keyInfo = yield* _(this.extractKeyInformation(content, options))

        // Generate summary based on style
        const summary = this.generateSummary(keyInfo, options?.style || 'paragraph')

        // Limit length if specified
        if (options?.maxLength) {
          return this.truncateSummary(summary, options.maxLength)
        }

        return summary
      }.bind(this)
    )
  }

  /**
   * Compare two documents
   */
  compareDocuments(document1: Buffer, document2: Buffer): Effect.Effect<DocumentComparisonResult, Error> {
    return Effect.gen(
      function* (_) {
        const [content1, content2] = yield* _(
          Effect.all([this.parseDocument(document1), this.parseDocument(document2)])
        )

        // Compare text content
        const textComparison = this.compareText(content1.text, content2.text)

        // Compare structure
        const structuralChanges = this.compareStructure(content1, content2)

        // Compare tables
        const tableChanges = this.compareTables(content1.tables, content2.tables)

        // Calculate overall similarity
        const similarity = this.calculateSimilarity(content1, content2)

        return {
          similarity,
          differences: textComparison.differences,
          additions: textComparison.additions,
          deletions: textComparison.deletions,
          modifications: textComparison.modifications,
          structuralChanges: [...structuralChanges, ...tableChanges]
        }
      }.bind(this)
    )
  }

  /**
   * Extract tables from document
   */
  extractTables(document: Buffer): Effect.Effect<Table[], Error> {
    return Effect.gen(
      function* (_) {
        if (!this.config.enableTableExtraction) {
          return yield* _(Effect.fail(new Error('Table extraction is disabled')))
        }

        const content = yield* _(this.parseDocument(document))
        return content.tables
      }.bind(this)
    )
  }

  /**
   * Extract images from document
   */
  extractImages(document: Buffer): Effect.Effect<EmbeddedImage[], Error> {
    return Effect.gen(
      function* (_) {
        if (!this.config.enableImageExtraction) {
          return yield* _(Effect.fail(new Error('Image extraction is disabled')))
        }

        const content = yield* _(this.parseDocument(document))
        return content.images
      }.bind(this)
    )
  }

  /**
   * Extract form fields from document
   */
  extractFormFields(document: Buffer): Effect.Effect<FormField[], Error> {
    return Effect.gen(
      function* (_) {
        if (!this.config.enableFormExtraction) {
          return yield* _(Effect.fail(new Error('Form extraction is disabled')))
        }

        const content = yield* _(this.parseDocument(document))
        return content.formFields || []
      }.bind(this)
    )
  }

  /**
   * Fill form fields in document
   */
  fillForm(document: Buffer, values: Map<string, any>): Effect.Effect<Buffer, Error> {
    return Effect.gen(
      function* (_) {
        const content = yield* _(this.parseDocument(document))

        if (!content.formFields || content.formFields.length === 0) {
          return yield* _(Effect.fail(new Error('No form fields found in document')))
        }

        // Fill form fields
        const filledForm = yield* _(this.applyFormValues(document, content.formFields, values))

        return filledForm
      }.bind(this)
    )
  }

  /**
   * Convert document to different format
   */
  convertDocument(document: Buffer, targetFormat: 'pdf' | 'html' | 'markdown' | 'txt'): Effect.Effect<Buffer, Error> {
    return Effect.gen(
      function* (_) {
        const content = yield* _(this.parseDocument(document))

        // Convert based on target format
        const converted = yield* _(this.convertToFormat(content, targetFormat))

        return converted
      }.bind(this)
    )
  }

  /**
   * Stream process multiple documents
   */
  streamProcessDocuments(documents: Stream.Stream<Buffer, never>): Stream.Stream<DocumentContent, Error> {
    return pipe(
      documents,
      Stream.mapEffect((doc) => this.parseDocument(doc))
    )
  }

  /**
   * Merge multiple documents
   */
  mergeDocuments(
    documents: Buffer[],
    options?: { preserveFormatting?: boolean; addPageBreaks?: boolean }
  ): Effect.Effect<Buffer, Error> {
    return Effect.gen(
      function* (_) {
        const contents = yield* _(Effect.all(documents.map((doc) => this.parseDocument(doc))))

        // Merge content
        const merged = this.mergeContent(contents, options)

        // Convert back to document
        const document = yield* _(this.contentToDocument(merged))

        return document
      }.bind(this)
    )
  }

  /**
   * Split document by pages
   */
  splitDocument(document: Buffer, ranges: Array<{ start: number; end: number }>): Effect.Effect<Buffer[], Error> {
    return Effect.gen(
      function* (_) {
        const content = yield* _(this.parseDocument(document))

        const splits = yield* _(Effect.all(ranges.map((range) => this.extractPageRange(document, content, range))))

        return splits
      }.bind(this)
    )
  }

  // Private helper methods

  private extractMetadata(document: Buffer): Effect.Effect<DocumentMetadata, Error> {
    // Simplified metadata extraction
    return Effect.succeed({
      format: 'pdf' as const,
      pageCount: 10,
      wordCount: 1500,
      characterCount: 8000,
      language: 'en',
      createdAt: new Date(),
      modifiedAt: new Date(),
      author: 'Sample Author',
      title: 'Sample Document',
      fileSize: document.length,
      hasImages: true,
      hasTables: true,
      hasFormFields: false
    })
  }

  private parseByFormat(document: Buffer, metadata: DocumentMetadata): Effect.Effect<DocumentContent, Error> {
    // Simplified parsing - would use pdf-parse, mammoth, etc. in production
    return Effect.succeed({
      text: 'This is the extracted text content from the document.',
      pages: this.createSamplePages(),
      sections: this.createSampleSections(),
      paragraphs: this.createSampleParagraphs(),
      tables: this.createSampleTables(),
      images: this.createSampleImages(),
      links: this.createSampleLinks(),
      footnotes: [],
      headers: this.createSampleHeaders(),
      formFields: [],
      annotations: []
    })
  }

  private createSamplePages(): PageContent[] {
    return [
      {
        pageNumber: 1,
        text: 'Page 1 content',
        boundingBox: { x: 0, y: 0, width: 612, height: 792 },
        elements: [],
        layout: {
          columns: 1,
          orientation: 'portrait' as const,
          margins: { top: 72, bottom: 72, left: 72, right: 72 }
        }
      }
    ]
  }

  private createSampleSections(): DocumentSection[] {
    return [
      {
        id: 'section1',
        title: 'Introduction',
        level: 1,
        content: 'Introduction content',
        startPage: 1,
        endPage: 2,
        subsections: []
      }
    ]
  }

  private createSampleParagraphs(): Paragraph[] {
    return [
      {
        text: 'This is a sample paragraph.',
        page: 1,
        position: { x: 72, y: 100, width: 468, height: 20 },
        style: { fontSize: 12, fontFamily: 'Arial' },
        type: 'normal' as const
      }
    ]
  }

  private createSampleTables(): Table[] {
    return [
      {
        rows: [
          { cells: [{ value: 'Header 1' }, { value: 'Header 2' }] },
          { cells: [{ value: 'Cell 1' }, { value: 'Cell 2' }] }
        ],
        headers: ['Header 1', 'Header 2'],
        page: 2,
        position: { x: 72, y: 200, width: 468, height: 100 }
      }
    ]
  }

  private createSampleImages(): EmbeddedImage[] {
    return [
      {
        id: 'img1',
        page: 1,
        position: { x: 72, y: 300, width: 200, height: 150 },
        caption: 'Sample Image'
      }
    ]
  }

  private createSampleLinks(): Hyperlink[] {
    return [
      {
        text: 'Example Link',
        url: 'https://example.com',
        page: 1,
        position: { x: 72, y: 400, width: 100, height: 15 },
        type: 'external' as const
      }
    ]
  }

  private createSampleHeaders(): Header[] {
    return [
      {
        level: 1,
        text: 'Main Header',
        page: 1,
        id: 'header1'
      }
    ]
  }

  private extractEntities(text: string): Effect.Effect<Entity[], never> {
    // Simplified entity extraction
    return Effect.succeed([
      {
        type: 'person' as const,
        value: 'John Doe',
        confidence: 0.95,
        context: 'John Doe is the author',
        page: 1
      },
      {
        type: 'organization' as const,
        value: 'Example Corp',
        confidence: 0.88,
        context: 'Example Corp is mentioned',
        page: 2
      }
    ])
  }

  private extractRelationships(entities: Entity[], text: string): Effect.Effect<Relationship[], never> {
    // Simplified relationship extraction
    return Effect.succeed([
      {
        subject: entities[0],
        predicate: 'works_for',
        object: entities[1],
        confidence: 0.85
      }
    ])
  }

  private extractKeyValuePairs(content: DocumentContent): Effect.Effect<Map<string, any>, never> {
    // Simplified key-value extraction
    return Effect.succeed(
      new Map([
        ['Date', '2024-01-01'],
        ['Invoice Number', 'INV-001'],
        ['Total', '$1,234.56']
      ])
    )
  }

  private extractDates(content: DocumentContent): Effect.Effect<DateReference[], never> {
    // Simplified date extraction
    return Effect.succeed([
      {
        text: 'January 1, 2024',
        date: new Date('2024-01-01'),
        format: 'MMMM d, yyyy',
        page: 1
      }
    ])
  }

  private extractNumbers(content: DocumentContent): Effect.Effect<NumberReference[], never> {
    // Simplified number extraction
    return Effect.succeed([
      {
        text: '$1,234.56',
        value: 1234.56,
        unit: 'USD',
        type: 'currency' as const,
        page: 1
      }
    ])
  }

  private extractContactInfo(text: string): Effect.Effect<
    {
      emails: string[]
      urls: string[]
      phoneNumbers: string[]
    },
    never
  > {
    // Simplified contact extraction
    const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g
    const urlRegex = /https?:\/\/[^\s]+/g
    const phoneRegex = /[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4}/g

    return Effect.succeed({
      emails: text.match(emailRegex) || [],
      urls: text.match(urlRegex) || [],
      phoneNumbers: text.match(phoneRegex) || []
    })
  }

  private filterByPageRange(content: DocumentContent, range: { start: number; end: number }): DocumentContent {
    return {
      ...content,
      pages: content.pages.filter((p) => p.pageNumber >= range.start && p.pageNumber <= range.end),
      paragraphs: content.paragraphs.filter((p) => p.page >= range.start && p.page <= range.end),
      tables: content.tables.filter((t) => t.page >= range.start && t.page <= range.end)
    }
  }

  private processDocumentQuery(content: DocumentContent, query: string, options: any): Effect.Effect<any, never> {
    // Simplified query processing
    const lowerQuery = query.toLowerCase()

    if (lowerQuery.includes('table')) {
      return Effect.succeed(content.tables)
    }

    if (lowerQuery.includes('image')) {
      return Effect.succeed(content.images)
    }

    if (lowerQuery.includes('summary')) {
      return Effect.succeed(content.text.substring(0, 200) + '...')
    }

    return Effect.succeed(content.text)
  }

  private formatQueryResponse(response: any, format: string): string {
    switch (format) {
      case 'json':
        return JSON.stringify(response, null, 2)

      case 'markdown':
        return this.convertToMarkdown(response)

      case 'structured':
        return this.formatStructured(response)

      default:
        return typeof response === 'string' ? response : String(response)
    }
  }

  private extractKeyInformation(content: DocumentContent, options?: DocumentSummaryOptions): Effect.Effect<any, never> {
    // Extract key information for summary
    return Effect.succeed({
      title: content.sections[0]?.title || 'Document',
      mainPoints: content.paragraphs.slice(0, 5).map((p) => p.text),
      tables: options?.includeTables ? content.tables : [],
      conclusion: content.paragraphs[content.paragraphs.length - 1]?.text
    })
  }

  private generateSummary(keyInfo: any, style: string): string {
    switch (style) {
      case 'bullet':
        return keyInfo.mainPoints.map((p: string) => `• ${p}`).join('\n')

      case 'executive':
        return `Executive Summary:\n\n${keyInfo.title}\n\n${keyInfo.mainPoints.join(' ')}`

      default:
        return keyInfo.mainPoints.join(' ')
    }
  }

  private truncateSummary(summary: string, maxLength: number): string {
    if (summary.length <= maxLength) return summary
    return summary.substring(0, maxLength - 3) + '...'
  }

  private compareText(
    text1: string,
    text2: string
  ): {
    differences: DocumentDifference[]
    additions: string[]
    deletions: string[]
    modifications: string[]
  } {
    // Simplified text comparison
    const words1 = text1.split(/\s+/)
    const words2 = text2.split(/\s+/)

    const additions = words2.filter((w) => !words1.includes(w))
    const deletions = words1.filter((w) => !words2.includes(w))

    return {
      differences: [],
      additions,
      deletions,
      modifications: []
    }
  }

  private compareStructure(content1: DocumentContent, content2: DocumentContent): string[] {
    const changes: string[] = []

    if (content1.pages.length !== content2.pages.length) {
      changes.push(`Page count changed: ${content1.pages.length} → ${content2.pages.length}`)
    }

    if (content1.sections.length !== content2.sections.length) {
      changes.push(`Section count changed: ${content1.sections.length} → ${content2.sections.length}`)
    }

    return changes
  }

  private compareTables(tables1: Table[], tables2: Table[]): string[] {
    const changes: string[] = []

    if (tables1.length !== tables2.length) {
      changes.push(`Table count changed: ${tables1.length} → ${tables2.length}`)
    }

    return changes
  }

  private calculateSimilarity(content1: DocumentContent, content2: DocumentContent): number {
    // Simplified similarity calculation
    const words1 = new Set(content1.text.toLowerCase().split(/\s+/))
    const words2 = new Set(content2.text.toLowerCase().split(/\s+/))

    const intersection = new Set([...words1].filter((x) => words2.has(x)))
    const union = new Set([...words1, ...words2])

    return intersection.size / union.size
  }

  private applyFormValues(
    document: Buffer,
    fields: FormField[],
    values: Map<string, any>
  ): Effect.Effect<Buffer, never> {
    // Simplified form filling - would use pdf-lib or similar
    return Effect.succeed(document)
  }

  private convertToFormat(content: DocumentContent, format: string): Effect.Effect<Buffer, never> {
    // Simplified format conversion
    let result = ''

    switch (format) {
      case 'txt':
        result = content.text
        break

      case 'markdown':
        result = this.convertToMarkdown(content)
        break

      case 'html':
        result = this.convertToHTML(content)
        break

      default:
        result = content.text
    }

    return Effect.succeed(Buffer.from(result))
  }

  private convertToMarkdown(content: any): string {
    if (typeof content === 'string') return content

    if (content.text) {
      return `# Document\n\n${content.text}`
    }

    return JSON.stringify(content, null, 2)
  }

  private convertToHTML(content: DocumentContent): string {
    return `<!DOCTYPE html>
<html>
<head><title>Document</title></head>
<body>
${content.sections.map((s) => `<h${s.level}>${s.title}</h${s.level}>`).join('\n')}
${content.paragraphs.map((p) => `<p>${p.text}</p>`).join('\n')}
</body>
</html>`
  }

  private formatStructured(response: any): string {
    if (typeof response === 'string') return response

    if (Array.isArray(response)) {
      return response.map((item, i) => `${i + 1}. ${String(item)}`).join('\n')
    }

    return Object.entries(response)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n')
  }

  private mergeContent(
    contents: DocumentContent[],
    options?: { preserveFormatting?: boolean; addPageBreaks?: boolean }
  ): DocumentContent {
    return {
      text: contents.map((c) => c.text).join('\n\n'),
      pages: contents.flatMap((c) => c.pages),
      sections: contents.flatMap((c) => c.sections),
      paragraphs: contents.flatMap((c) => c.paragraphs),
      tables: contents.flatMap((c) => c.tables),
      images: contents.flatMap((c) => c.images),
      links: contents.flatMap((c) => c.links),
      footnotes: contents.flatMap((c) => c.footnotes),
      headers: contents.flatMap((c) => c.headers)
    }
  }

  private contentToDocument(content: DocumentContent): Effect.Effect<Buffer, never> {
    // Convert content back to document format
    return Effect.succeed(Buffer.from(content.text))
  }

  private extractPageRange(
    document: Buffer,
    content: DocumentContent,
    range: { start: number; end: number }
  ): Effect.Effect<Buffer, never> {
    // Extract specific page range
    const filtered = this.filterByPageRange(content, range)
    return this.contentToDocument(filtered)
  }

  private getCacheKey(document: Buffer): string {
    // Simple hash for caching
    return `doc-${document.length}-${document[0]}-${document[document.length - 1]}`
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create default document adapter
 */
export function createDocumentAdapter(config?: Partial<DocumentAdapter['config']>): DocumentAdapter {
  return new DocumentAdapter(config)
}

/**
 * Create production document adapter
 */
export function createProductionDocumentAdapter(): DocumentAdapter {
  return new DocumentAdapter({
    maxDocumentSize: 100 * 1024 * 1024, // 100MB
    enableOCR: true,
    enableFormExtraction: true,
    enableTableExtraction: true,
    enableImageExtraction: true,
    cacheResults: true
  })
}

/**
 * Create minimal document adapter
 */
export function createMinimalDocumentAdapter(): DocumentAdapter {
  return new DocumentAdapter({
    enableOCR: false,
    enableFormExtraction: false,
    enableTableExtraction: false,
    enableImageExtraction: false,
    cacheResults: false
  })
}

/**
 * Create OCR-focused adapter
 */
export function createOCRAdapter(): DocumentAdapter {
  return new DocumentAdapter({
    enableOCR: true,
    enableFormExtraction: false,
    enableTableExtraction: false,
    enableImageExtraction: false,
    cacheResults: true
  })
}

/**
 * Create data extraction adapter
 */
export function createDataExtractionAdapter(): DocumentAdapter {
  return new DocumentAdapter({
    enableOCR: true,
    enableFormExtraction: true,
    enableTableExtraction: true,
    enableImageExtraction: false,
    cacheResults: true
  })
}
