import { z } from 'zod'

const FileSummarySchema = z.object({
  purpose: z.string(),
  type: z.string(),
  exports: z.array(z.string()).optional(),
  imports: z.array(z.string()).optional(),
  dependencies: z.array(z.string()).optional()
})

async function testLMStudio() {
  const prompt = `Summarize this TypeScript file:
export class User {
  constructor(public name: string, public email: string) {}
  getName() { return this.name }
}

Respond with a JSON object matching this format:
{
  "purpose": "brief description",
  "type": "class/function/module/etc",
  "exports": ["list of exports"],
  "imports": ["list of imports"],
  "dependencies": ["list of dependencies"]
}`

  try {
    const response = await fetch('http://192.168.1.38:1234/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        messages: [
          { role: 'system', content: 'You are a code analyzer. Always respond with valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 500
      })
    })

    const data = await response.json()
    console.log('Raw response:', JSON.stringify(data, null, 2))
    
    if (data.choices?.[0]?.message?.content) {
      const content = data.choices[0].message.content
      console.log('\nContent:', content)
      
      // Try to extract JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const jsonStr = jsonMatch[0]
        console.log('\nExtracted JSON:', jsonStr)
        
        const parsed = JSON.parse(jsonStr)
        console.log('\nParsed:', parsed)
        
        const validated = FileSummarySchema.parse(parsed)
        console.log('\nValidated:', validated)
      }
    }
  } catch (error) {
    console.error('Error:', error)
  }
}

testLMStudio()
