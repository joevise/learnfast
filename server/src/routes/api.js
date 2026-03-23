const express = require('express');
const rateLimit = require('express-rate-limit');
const { extractContent } = require('../services/extractor');
const { analyzeArticle } = require('../services/ai');
const { saveAnalysis, getAnalysis, getRecentAnalyses } = require('../db');

const router = express.Router();

// Rate limiting - 30 requests per hour per IP
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  message: { error: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.headers['x-forwarded-for'] || 'unknown';
  }
});

router.use(limiter);

// Get client IP
function getClientIp(req) {
  return req.ip || 
         req.headers['x-forwarded-for']?.split(',')[0] ||
         req.headers['x-real-ip'] ||
         'unknown';
}

// POST /api/analyze - Analyze a URL
router.post('/analyze', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: '缺少 url 参数' });
    }
    
    // Validate URL
    try {
      new URL(url);
    } catch (e) {
      return res.status(400).json({ error: '无效的 URL 格式' });
    }
    
    console.log(`[Analyze] URL: ${url}, IP: ${getClientIp(req)}`);
    
    // Extract content
    const extractionStart = Date.now();
    const { title: extractedTitle, content, author, source } = await extractContent(url);
    console.log(`[Extract] Took ${Date.now() - extractionStart}ms, source: ${source}`);
    
    // Analyze with AI
    const aiStart = Date.now();
    const analysis = await analyzeArticle(url, content);
    console.log(`[AI] Took ${Date.now() - aiStart}ms`);
    
    // Use extracted title if available
    if (extractedTitle && !analysis.title.includes('来自')) {
      analysis.title = extractedTitle;
    }
    if (author) {
      analysis.author = author;
    }
    
    // Save to database
    const analysisId = saveAnalysis({
      url,
      title: analysis.title,
      summary: analysis.summary,
      points: analysis.points,
      flashcards: analysis.flashcards,
      quiz: analysis.quiz,
      userAgent: req.headers['user-agent'],
      ip: getClientIp(req)
    });
    
    console.log(`[Save] Analysis saved with ID: ${analysisId}`);
    
    res.json({
      success: true,
      id: analysisId,
      analysis,
      meta: {
        extracted: source !== 'unknown',
        source
      }
    });
    
  } catch (err) {
    console.error('[Analyze Error]', err.message);
    res.status(500).json({ 
      error: '分析失败', 
      message: err.message 
    });
  }
});

// GET /api/analysis/:id - Get a specific analysis
router.get('/analysis/:id', (req, res) => {
  try {
    const analysis = getAnalysis(req.params.id);
    if (!analysis) {
      return res.status(404).json({ error: '分析记录不存在' });
    }
    res.json({ success: true, analysis });
  } catch (err) {
    console.error('[Get Analysis Error]', err.message);
    res.status(500).json({ error: '获取失败' });
  }
});

// GET /api/recent - Get recent analyses
router.get('/recent', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = parseInt(req.query.offset) || 0;
    const analyses = getRecentAnalyses(limit, offset);
    res.json({ success: true, analyses });
  } catch (err) {
    console.error('[Get Recent Error]', err.message);
    res.status(500).json({ error: '获取失败' });
  }
});

// GET /api/health - Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
