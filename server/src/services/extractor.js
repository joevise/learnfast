const cheerio = require('cheerio');
const fetch = require('node-fetch');

// Extract content from a URL
async function extractContent(url) {
  // Check if it's a WeChat article
  if (isWeChatArticle(url)) {
    return await extractWeChatArticle(url);
  }
  
  // Regular article extraction via proxy
  return await extractRegularArticle(url);
}

function isWeChatArticle(url) {
  return url.includes('mp.weixin.qq.com/s') || url.includes('mp.weixin.qq.com/s/');
}

async function extractWeChatArticle(url) {
  // Try multiple wechat article extraction services
  const services = [
    `https://api.moeyy.cn/wechat-article?url=${encodeURIComponent(url)}`,
    `https://r.ikuniverse.com/api/wxarticle?url=${encodeURIComponent(url)}`,
  ];
  
  for (const serviceUrl of services) {
    try {
      const response = await fetch(serviceUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.content || data.text || data.html) {
          return {
            title: data.title || extractTitle(data.content || data.html),
            content: data.content || data.text || cleanHtml(data.html || ''),
            author: data.author || '',
            source: 'wechat'
          };
        }
      }
    } catch (e) {
      console.warn(`WeChat extraction service failed: ${serviceUrl}`, e.message);
    }
  }
  
  // Fallback: try direct fetch with cheerio
  return await extractViaCheerio(url);
}

async function extractRegularArticle(url) {
  // Use allorigins.win proxy to bypass CORS
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  
  try {
    const response = await fetch(proxyUrl, { timeout: 15000 });
    const html = await response.text();
    return parseHtml(html, url);
  } catch (e) {
    console.warn('allorigins proxy failed, trying direct fetch:', e.message);
    return await extractViaCheerio(url);
  }
}

async function extractViaCheerio(url) {
  try {
    const response = await fetch(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    return parseHtml(html, url);
  } catch (e) {
    console.warn('Direct fetch failed:', e.message);
    return { title: '', content: '', author: '', source: 'direct' };
  }
}

function parseHtml(html, url) {
  const $ = cheerio.load(html);
  
  // Remove unwanted elements
  $('script, style, nav, header, footer, aside, .ad, .advertisement, .social-share, .comments, .sidebar').remove();
  
  // Try to find main content
  let content = '';
  let title = '';
  
  // Title
  title = $('h1').first().text().trim() || 
          $('article h1').first().text().trim() ||
          $('meta[property="og:title"]').attr('content') ||
          $('title').text().trim();
  
  // Content - try common selectors
  const contentSelectors = [
    'article',
    '[role="main"]',
    'main',
    '.post-content',
    '.article-content',
    '.entry-content',
    '.content',
    '#content',
    '.post-body',
    '.article-body'
  ];
  
  for (const selector of contentSelectors) {
    const el = $(selector);
    if (el.length) {
      content = el.text().trim();
      if (content.length > 200) break;
    }
  }
  
  // Fallback to body
  if (!content || content.length < 200) {
    content = $('body').text().trim();
  }
  
  // Clean content
  content = cleanHtml(content);
  
  // Author
  const author = $('meta[name="author"]').attr('content') ||
                 $('meta[property="article:author"]').attr('content') ||
                 $('.author').first().text().trim() ||
                 '';
  
  return {
    title: title.substring(0, 200),
    content: content.substring(0, 8000),
    author: author.substring(0, 100),
    source: 'web'
  };
}

function extractTitle(content) {
  const $ = cheerio.load(content);
  return $('h1, h2').first().text().trim().substring(0, 200) || '';
}

function cleanHtml(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim()
    .substring(0, 10000);
}

module.exports = { extractContent, isWeChatArticle };
