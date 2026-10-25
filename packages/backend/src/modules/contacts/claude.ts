import { InternalServerErrorException } from '@nestjs/common';

/** Chama o Claude (Anthropic) e devolve o texto da resposta. Erros viram 500 com mensagem legível. */
export async function askClaude(opts: { system: string; prompt: string; maxTokens: number; timeoutMs?: number }): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new InternalServerErrorException('IA não configurada: defina ANTHROPIC_API_KEY no servidor.');

  let res: Response;
  try {
    const base = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '');
    res = await fetch(`${base}/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
        max_tokens: opts.maxTokens,
        system: opts.system,
        messages: [{ role: 'user', content: opts.prompt }],
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 60000),
    });
  } catch (err: any) {
    throw new InternalServerErrorException(`Erro ao conectar na IA: ${err.message}`);
  }

  if (!res.ok) {
    const errBody = await res.text();
    throw new InternalServerErrorException(`IA retornou ${res.status}: ${errBody.slice(0, 300)}`);
  }

  const data: any = await res.json();
  return (data.content ?? [])
    .filter((c: any) => c.type === 'text')
    .map((c: any) => c.text)
    .join('')
    .trim();
}

/** Primeiro objeto JSON do texto, ou null. */
export function parseJsonObject(text: string): any | null {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch {
    return null;
  }
}
