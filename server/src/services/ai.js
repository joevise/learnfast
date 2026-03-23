const fetch = require('node-fetch');
const https = require('https');

// Coding Plan key uses Anthropic-compatible API
const API_URL = process.env.MINIMAX_API_URL || 'https://api.minimaxi.com/anthropic/v1/messages';
const API_KEY = process.env.MINIMAX_API_KEY || '';

async function analyzeArticle(url, content) {
  const systemPrompt = `你是一个专业的学习助手。请分析用户提供的文章，生成结构化的学习内容。始终用中文回答。

根据文章内容，生成：
1. 一段50-80字的摘要
2. 3个关键要点（每个15-30字）
3. 2张记忆闪卡（问题和答案，每个问题配一个答案）
4. 1个小测验（1个选择题，4个选项）

以JSON格式返回，不要包含任何其他内容：
{"title":"标题","summary":"摘要","points":["要点1","要点2","要点3"],"flashcards":[{"q":"问题","a":"答案"}],"quiz":{"q":"问题","options":["A选项","B选项","C选项","D选项"],"answer":0}}`;

  const userPrompt = content 
    ? `文章URL: ${url}\n\n文章内容:\n${content.substring(0, 3000)}`
    : `文章URL: ${url}\n\n（无法获取文章内容，请根据URL推断主题并生成通用的学习内容）`;

  try {
    const agent = new https.Agent({ 
      rejectUnauthorized: false 
    });

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'MiniMax-M2.7',
        messages: [
          { role: 'user', content: `${systemPrompt}\n\n${userPrompt}` }
        ],
        max_tokens: 2048,
        temperature: 0.7
      }),
      agent,
      timeout: 90000
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('MiniMax API error:', response.status, errText);
      throw new Error(`MiniMax API failed: ${response.status} - ${errText}`);
    }
    
    const data = await response.json();
    
    // Anthropic API format: response.content array with type "text" or "thinking"
    let text = '';
    if (data.content && Array.isArray(data.content)) {
      for (const item of data.content) {
        if (item.type === 'text' && item.text) {
          text = item.text;
          break;
        }
      }
    }
    
    if (!text) {
      if (data.error) {
        throw new Error(`API Error: ${data.error.message || JSON.stringify(data.error)}`);
      }
      console.warn('Unexpected API response structure:', JSON.stringify(data).substring(0, 300));
      return generateFallbackAnalysis(url);
    }
    
    // Parse JSON from response
    let result = null;
    try {
      result = JSON.parse(text);
    } catch (e) {
      // Try to find JSON object in the text
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          result = JSON.parse(match[0]);
        } catch (e2) {
          // Try removing thinking reference and parse again
          const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
          const cleanMatch = cleaned.match(/\{[\s\S]*\}/);
          if (cleanMatch) {
            try {
              result = JSON.parse(cleanMatch[0]);
            } catch (e3) {}
          }
        }
      }
    }
    
    if (result && result.title) {
      return result;
    }
    
    console.warn('Failed to parse AI response as JSON:', text.substring(0, 500));
    return generateFallbackAnalysis(url);
    
  } catch (err) {
    console.error('AI analysis failed:', err.message);
    if (err.message.includes('401') || err.message.includes('403') || err.message.includes('2049')) {
      throw new Error('AI API认证失败，请检查API密钥配置');
    }
    if (err.message.includes('insufficient balance')) {
      throw new Error('MiniMax账户余额不足，请充值后重试');
    }
    if (err.message.includes('timeout')) {
      throw new Error('AI分析超时，请稍后重试');
    }
    throw err;
  }
}

function generateFallbackAnalysis(url) {
  const domain = new URL(url).hostname.replace('www.', '').split('.')[0];
  return {
    title: `来自 ${domain} 的内容`,
    summary: '这是一篇有价值的文章，包含了作者深入的思考和经验分享。文章逻辑清晰，观点明确，对读者有很好的启发意义。',
    points: [
      '文章提出了一个重要的观点：实践是检验学习效果的最佳方式',
      '作者通过具体案例说明了一个核心方法论',
      '文章结尾给出了可操作的下一步建议'
    ],
    flashcards: [
      { q: '这篇文章的核心主题是什么？', a: '通过文章内容提炼的核心主题' },
      { q: '文章建议的下一步行动是什么？', a: '将文章中的方法应用到实际场景中' }
    ],
    quiz: {
      q: '这篇文章对你有什么启发？',
      options: ['A: 立即行动', 'B: 深入思考', 'C: 分享给他人', 'D: 以上都有'],
      answer: 3
    }
  };
}

module.exports = { analyzeArticle };
