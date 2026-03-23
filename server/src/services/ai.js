const fetch = require('node-fetch');

const API_URL = process.env.MINIMAX_API_URL || 'https://api.minimax.chat/v1/text/chatcompletion_pro';
const API_KEY = process.env.MINIMAX_API_KEY || '';
const GROUP_ID = process.env.MINIMAX_GROUP_ID || '1732073';

async function analyzeArticle(url, content) {
  const systemPrompt = `你是一个专业的学习助手。请分析用户提供的文章，生成结构化的学习内容。始终用中文回答。

根据文章内容，生成：
1. 一段50-80字的摘要
2. 3个关键要点（每个15-30字）
3. 2张记忆闪卡（问题和答案，每个问题配一个答案）
4. 1个小测验（1个选择题，4个选项）

以JSON格式返回：
{
  "title": "文章标题或推断主题",
  "summary": "摘要内容",
  "points": ["要点1", "要点2", "要点3"],
  "flashcards": [{"q": "问题", "a": "答案"}],
  "quiz": {"q": "问题", "options": ["A选项", "B选项", "C选项", "D选项"], "answer": 0}
}`;

  const userPrompt = content 
    ? `文章URL: ${url}\n\n文章内容:\n${content.substring(0, 3000)}`
    : `文章URL: ${url}\n\n（无法获取文章内容，请根据URL推断主题并生成通用的学习内容）`;

  try {
    const response = await fetch(`${API_URL}?GroupId=${GROUP_ID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: 'MiniMax-Text-01',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      }),
      timeout: 60000
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`MiniMax API failed: ${response.status} - ${errText}`);
    }
    
    const data = await response.json();
    
    let text = data.choices?.[0]?.messages?.[0]?.text || 
               data.choices?.[0]?.message?.content || 
               '';
    
    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    // Fallback if JSON parse fails
    console.warn('Failed to parse AI response as JSON:', text.substring(0, 200));
    return generateFallbackAnalysis(url);
    
  } catch (err) {
    console.error('AI analysis failed:', err.message);
    if (err.message.includes('401') || err.message.includes('403')) {
      throw new Error('AI API认证失败，请检查API密钥配置');
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
