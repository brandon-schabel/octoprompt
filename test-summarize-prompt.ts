const prompt = `Summarize the following TypeScript code file. 
Focus on its main purpose, key components, and important patterns.

File: src/models/User.ts
Content:
export class User {
  constructor(
    public id: string,
    public name: string,
    public email: string,
    private password: string
  ) {}
  
  validatePassword(input: string): boolean {
    return this.password === input;
  }
  
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      email: this.email
    };
  }
}

export function createUser(data: any): User {
  return new User(data.id, data.name, data.email, data.password);
}

Provide a JSON response with this structure:
{
  "purpose": "Brief description of what this file does",
  "type": "The main type (class/function/module/interface/etc)",
  "exports": ["List of exported items"],
  "imports": ["List of imported items"],
  "dependencies": ["External dependencies"]
}`

async function test() {
  const response = await fetch('http://192.168.1.38:1234/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai/gpt-oss-20b',
      messages: [
        { role: 'system', content: 'You are a code analyzer. Always respond with valid JSON only, no additional text.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 500
    })
  })

  const data = await response.json()
  console.log('Response:', data.choices?.[0]?.message?.content)
}

test()
