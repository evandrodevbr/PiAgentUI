import { describe, expect, it } from 'vitest'
import { formatOpenRouterPricePerMillion, selectOpenRouterModel } from './openRouterModelMetadata'

const catalog = [
  {
    id: 'deepseek/deepseek-v4-flash:free',
    name: 'DeepSeek: DeepSeek V4 Flash (free)',
    context_length: 1048576,
    top_provider: { max_completion_tokens: 384000 },
    architecture: { input_modalities: ['text'], output_modalities: ['text'], modality: 'text->text' },
    pricing: { prompt: '0', completion: '0' },
    supported_parameters: ['tools'],
  },
  {
    id: 'deepseek/deepseek-v4-flash',
    name: 'DeepSeek: DeepSeek V4 Flash',
    context_length: 1048576,
    top_provider: { max_completion_tokens: 131072 },
    architecture: { input_modalities: ['text'], output_modalities: ['text'], modality: 'text->text' },
    pricing: { prompt: '0.0000002', completion: '0.0000008' },
    supported_parameters: ['tools', 'reasoning'],
  },
  {
    id: 'openai/gpt-5.2',
    name: 'OpenAI: GPT-5.2',
    context_length: 400000,
    top_provider: { max_completion_tokens: 128000 },
    architecture: { input_modalities: ['text', 'image'], output_modalities: ['text'], modality: 'text+image->text' },
    pricing: { prompt: '0.00000175', completion: '0.000014' },
    supported_parameters: ['response_format', 'structured_outputs'],
  },
]

describe('openRouterModelMetadata', () => {
  it('matches Pi model ids against OpenRouter ids even when provider ids differ', () => {
    const match = selectOpenRouterModel(catalog, {
      modelID: 'deepseek-v4-flash',
      providerID: 'opencode-go',
      contextWindow: 1048576,
    })

    expect(match?.id).toBe('deepseek/deepseek-v4-flash')
  })

  it('prefers exact full id matches', () => {
    const match = selectOpenRouterModel(catalog, {
      modelID: 'gpt-5.2',
      providerID: 'openai',
      contextWindow: 400000,
    })

    expect(match?.id).toBe('openai/gpt-5.2')
  })

  it('formats token prices as dollars per million tokens', () => {
    expect(formatOpenRouterPricePerMillion('0.00000175')).toBe('$1.75/M')
    expect(formatOpenRouterPricePerMillion('0')).toBe('$0/M')
    expect(formatOpenRouterPricePerMillion(undefined)).toBe('—')
  })
})
