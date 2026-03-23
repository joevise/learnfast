const express = require('express');
const rateLimit = require('express-rate-limit');
const { extractContent } = require('../services/extractor');
const { analyzeArticle } = require('../services/ai');
const { saveAnalysis, getAnalysis, getRecentAnalyses, checkUserQuota, incrementUserQuota } = require('../db');

const router = express.Router();

// Rate limiting - 30 requests per hour per IP
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  message: { error: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
  }
});

router.use(limiter);

// Simple API key authentication middleware
// Frontend calls with a simple token, server validates
const API_TOKEN = process.env.API_TOKEN || 'learnfast-web-token-2024';

function validateApiToken(req, res, next) {
  // For now, allow all requests but log them
  // In production, use proper JWT or similar
  const token = req.headers['x-api-token'];
  
  // Allow requests without token but log them
  if (token && token !== API_TOKEN) {
    return res.status(401).json({ error: '无效的API令牌' });
  }
  
  next();
}

// URL validation - block private/internal URLs
function isValidUrl(url) {
  try {
    const parsed = new URL(url);
    
    // Block private/internal URLs
    const hostname = parsed.hostname.toLowerCase();
    
    // Block localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return { valid: false, reason: '不支持本地地址' };
    }
    
    // Block private IPs
    const privateIpPatterns = [
      /^10\./,           // 10.0.0.0/8
      /^172\.(1[6-9]|2\d|3[01])\./,  // 172.16.0.0/12
      /^192\.168\./,     // 192.168.0.0/16
      /^127\./,          // 127.0.0.0/8
      /^169\.254\./,     // Link-local
      /^0\./,            // Current network
    ];
    
    if (privateIpPatterns.some(pattern => pattern.test(hostname))) {
      return { valid: false, reason: '不支持内网地址' };
    }
    
    // Block internal hostnames
    if (hostname.includes('.local') || hostname.includes('.internal')) {
      return { valid: false, reason: '不支持内部网络地址' };
    }
    
    // Must be http or https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, reason: '只支持 HTTP/HTTPS 链接' };
    }
    
    return { valid: true };
  } catch (e) {
    return { valid: false, reason: '无效的URL格式' };
  }
}

// Get client IP
function getClientIp(req) {
  return req.ip || 
         req.headers['x-forwarded-for']?.split(',')[0] ||
         req.headers['x-real-ip'] ||
         'unknown';
}

// GET /api/health - Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// POST /api/analyze - Analyze a URL
router.post('/analyze', validateApiToken, async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: '缺少 url 参数' });
    }
    
    // Validate URL
    const urlCheck = isValidUrl(url);
    if (!urlCheck.valid) {
      return res.status(400).json({ error: urlCheck.reason });
    }
    
    const clientIp = getClientIp(req);
    
    // Check server-side quota (based on IP)
    const quotaCheck = checkUserQuota(clientIp);
    if (!quotaCheck.allowed) {
      return res.status(429).json({ 
        error: '今日分析次数已用完',
        resetAt: quotaCheck.resetAt
      });
    }
    
    console.log(`[Analyze] URL: ${url}, IP: ${clientIp}`);
    
    // Extract content
    const extractionStart = Date.now();
    const { title: extractedTitle, content, author, source } = await extractContent(url);
    console.log(`[Extract] Took ${Date.now() - extractionStart}ms, source: ${source}`);
    
    if (!content || content.length < 50) {
      console.warn(`[Extract] Content too short or empty for URL: ${url}`);
    }
    
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
    
    // Increment quota
    incrementUserQuota(clientIp);
    
    // Save to database
    const analysisId = saveAnalysis({
      url,
      title: analysis.title,
      summary: analysis.summary,
      points: analysis.points,
      flashcards: analysis.flashcards,
      quiz: analysis.quiz,
      userAgent: req.headers['user-agent'],
      ip: clientIp
    });
    
    console.log(`[Save] Analysis saved with ID: ${analysisId}`);
    
    res.json({
      success: true,
      id: analysisId,
      analysis,
      meta: {
        extracted: source !== 'unknown' && content.length > 50,
        source,
        quotaRemaining: quotaCheck.remaining - 1
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

// GET /api/quota - Get current quota status
router.get('/quota', (req, res) => {
  const clientIp = getClientIp(req);
  const quota = checkUserQuota(clientIp);
  res.json({
    success: true,
    quota: {
      remaining: quota.remaining,
      limit: 30,
      allowed: quota.allowed,
      resetAt: quota.resetAt
    }
  });
});

module.exports = router;
