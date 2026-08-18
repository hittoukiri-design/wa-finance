const DEFAULT_AI_MODEL = 'openai/gpt-oss-120b';

const AI_MODELS = [
    {
        id: 'openai/gpt-oss-120b',
        label: 'GPT OSS 120B',
        status: 'production',
    },
    {
        id: 'openai/gpt-oss-20b',
        label: 'GPT OSS 20B',
        status: 'production',
    },
    {
        id: 'qwen/qwen3.6-27b',
        label: 'Qwen3.6 27B',
        status: 'preview',
    },
];

const DEPRECATED_MODEL_REPLACEMENTS = {
    'llama-3.3-70b-versatile': DEFAULT_AI_MODEL,
    'llama-3.1-8b-instant': 'openai/gpt-oss-20b',
};

function normalizeAiModel(value) {
    const model = String(value || '').trim();
    if (!model) return DEFAULT_AI_MODEL;
    return DEPRECATED_MODEL_REPLACEMENTS[model] || model;
}

module.exports = {
    AI_MODELS,
    DEFAULT_AI_MODEL,
    DEPRECATED_MODEL_REPLACEMENTS,
    normalizeAiModel,
};
