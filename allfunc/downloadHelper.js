const { execSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');

// Helper to get temporary file path
function getTempPath(ext) {
  return path.join(os.tmpdir(), `ytdlp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`);
}

// Safe yt-dlp wrapper - returns null if yt-dlp is not available
function runYtDlp(args, timeout = 30000) {
  try {
    const cmd = `yt-dlp ${args}`;
    const result = execSync(cmd, {
      maxBuffer: 50 * 1024 * 1024,
      timeout: timeout,
      stdio: ['pipe', 'pipe', 'pipe']
    }).toString().trim();
    return result;
  } catch (e) {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// YouTube Video Download
// ═══════════════════════════════════════════════════════════
async function ytVideo(url) {
  // Try yt-dlp first
  try {
    const jsonStr = runYtDlp(`--dump-json --no-playlist "${url}"`, 30000);
    if (jsonStr) {
      const info = JSON.parse(jsonStr);
      const videoResult = runYtDlp(`-f "bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/best[ext=mp4][height<=720]/best[height<=720]" --get-url --no-playlist "${url}"`, 30000);
      
      if (videoResult) {
        const videoUrl = videoResult.split('\n')[0];
        return {
          success: true,
          title: info.title || 'YouTube Video',
          duration: info.duration || 0,
          thumbnail: info.thumbnail || '',
          uploader: info.uploader || '',
          viewCount: info.view_count || 0,
          videoUrl: videoUrl || ''
        };
      }
    }
  } catch (e) {
    // fallback
  }

  // Fallback: use cobalt API
  try {
    const res = await axios.post('https://api.cobalt.tools/api/json', {
      url: url,
      vCodec: 'h264',
      vQuality: '720',
      isAudioOnly: false
    }, {
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      timeout: 30000
    });
    
    if (res.data.url) {
      return {
        success: true,
        title: url,
        videoUrl: res.data.url
      };
    }
  } catch (e) {
    // fallback failed
  }

  return { success: false, error: 'YouTube video download failed. Please try again later.' };
}

// ═══════════════════════════════════════════════════════════
// YouTube Audio Download
// ═══════════════════════════════════════════════════════════
async function ytAudio(url) {
  // Try yt-dlp first
  try {
    const jsonStr = runYtDlp(`--dump-json --no-playlist "${url}"`, 30000);
    if (jsonStr) {
      const info = JSON.parse(jsonStr);
      const audioResult = runYtDlp(`-f "bestaudio[ext=m4a]/bestaudio" --get-url --no-playlist "${url}"`, 30000);
      
      if (audioResult) {
        return {
          success: true,
          title: info.title || 'YouTube Audio',
          duration: info.duration || 0,
          thumbnail: info.thumbnail || '',
          uploader: info.uploader || '',
          channelTitle: info.channel || '',
          audioUrl: audioResult || ''
        };
      }
    }
  } catch (e) {
    // fallback
  }

  // Fallback: use cobalt API
  try {
    const res = await axios.post('https://api.cobalt.tools/api/json', {
      url: url,
      isAudioOnly: true,
      aFormat: 'mp3'
    }, {
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      timeout: 30000
    });
    
    if (res.data.url) {
      return {
        success: true,
        title: url,
        audioUrl: res.data.url
      };
    }
  } catch (e) {
    // fallback failed
  }

  return { success: false, error: 'YouTube audio download failed. Please try again later.' };
}

// ═══════════════════════════════════════════════════════════
// YouTube Search
// ═══════════════════════════════════════════════════════════
async function ytSearch(query) {
  // Try yt-dlp first
  try {
    const jsonStr = runYtDlp(`"ytsearch1:${query}" --dump-json --no-playlist`, 30000);
    if (jsonStr) {
      const info = JSON.parse(jsonStr);
      return {
        success: true,
        title: info.title || query,
        duration: info.duration || 0,
        thumbnail: info.thumbnail || '',
        uploader: info.uploader || '',
        channelTitle: info.channel || '',
        url: info.webpage_url || info.url || ''
      };
    }
  } catch (e) {
    // fallback
  }

  // Fallback: use yts (yt-search npm package)
  try {
    const yts = require('yt-search');
    const result = await yts(query);
    if (result.videos && result.videos.length > 0) {
      const video = result.videos[0];
      return {
        success: true,
        title: video.title || query,
        duration: video.seconds || 0,
        thumbnail: video.thumbnail || '',
        uploader: video.author?.name || '',
        channelTitle: video.author?.name || '',
        url: video.url || ''
      };
    }
  } catch (e) {
    // fallback failed
  }

  return { success: false, error: 'YouTube search failed.' };
}

// ═══════════════════════════════════════════════════════════
// TikTok Download (already works - keep original + fix)
// ═══════════════════════════════════════════════════════════
async function tiktokDl(url) {
  // Try TikWM API first (more reliable)
  try {
    const res = await axios.get(`https://tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`);
    if (res.data.data && res.data.data.play) {
      return {
        success: true,
        title: res.data.data.title || 'TikTok Video',
        author: res.data.data.author?.nickname || '',
        videoUrl: res.data.data.hdplay || res.data.data.play,
        source: 'tikwm'
      };
    }
  } catch (e) {
    // tikwm failed
  }

  // Try yt-dlp as fallback
  try {
    const videoResult = runYtDlp(`-f "best[height<=720]" --get-url --no-playlist "${url}" 2>/dev/null`, 30000);
    if (videoResult && videoResult.includes('http')) {
      const jsonStr = runYtDlp(`--dump-json --no-playlist "${url}" 2>/dev/null`, 30000);
      const info = jsonStr ? JSON.parse(jsonStr) : {};
      return {
        success: true,
        title: info.description || 'TikTok Video',
        author: info.uploader || info.creator || '',
        videoUrl: videoResult,
        source: 'yt-dlp'
      };
    }
  } catch (e) {
    // yt-dlp failed
  }

  return { success: false, error: 'TikTok download failed. Please try again later.' };
}

// ═══════════════════════════════════════════════════════════
// Instagram Download - Fixed with multiple API fallbacks
// ═══════════════════════════════════════════════════════════
async function instagramDl(url) {
  // API fallback 1: snapinsta
  try {
    const res = await axios.get(`https://snapinsta.app/api/download`, {
      params: { url: url },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://snapinsta.app/'
      },
      timeout: 15000
    });
    
    if (res.data && (res.data.url || res.data.video || res.data.image)) {
      const mediaUrl = res.data.url || res.data.video || res.data.image;
      return {
        success: true,
        title: 'Instagram Media',
        mediaUrl: mediaUrl,
        isVideo: !!(res.data.video || (mediaUrl && mediaUrl.includes('.mp4'))),
        source: 'snapinsta'
      };
    }
  } catch (e) {
    // snapinsta failed
  }

  // API fallback 2: iGram
  try {
    const form = new URLSearchParams();
    form.append('url', url);
    const res = await axios.post('https://igram.world/wp-admin/admin-ajax.php', form, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest'
      },
      timeout: 15000
    });
    
    if (res.data && (res.data.items || res.data.url)) {
      const items = res.data.items || [{url: res.data.url}];
      if (items[0]) {
        return {
          success: true,
          title: 'Instagram Media',
          mediaUrl: items[0].url || items[0],
          isVideo: items[0].type === 'video' || (items[0].url && items[0].url.includes('.mp4')),
          source: 'igram'
        };
      }
    }
  } catch (e) {
    // igram failed
  }

  // API fallback 3: w3ads
  try {
    const res = await axios.get(`https://api.w3ads.com/instagram-dl`, {
      params: { url: url },
      timeout: 15000
    });
    
    if (res.data && res.data.data && res.data.data.url) {
      return {
        success: true,
        title: 'Instagram Media',
        mediaUrl: res.data.data.url,
        isVideo: res.data.data.type === 'video',
        source: 'w3ads'
      };
    }
  } catch (e) {
    // w3ads failed
  }

  // Fallback: scraper
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 15000
    });
    
    const $ = cheerio.load(res.data);
    const ogVideo = $('meta[property="og:video"]').attr('content');
    const ogImage = $('meta[property="og:image"]').attr('content');
    
    if (ogVideo) {
      return {
        success: true,
        title: 'Instagram Video',
        mediaUrl: ogVideo,
        isVideo: true,
        source: 'scraper'
      };
    } else if (ogImage) {
      return {
        success: true,
        title: 'Instagram Image',
        mediaUrl: ogImage,
        isVideo: false,
        source: 'scraper'
      };
    }
  } catch (e) {
    // scraping failed
  }

  return { success: false, error: 'Instagram download failed. Please try again later.' };
}

// ═══════════════════════════════════════════════════════════
// Facebook Download - Fixed with multiple API fallbacks
// ═══════════════════════════════════════════════════════════
async function facebookDl(url) {
  // API fallback 1: snapinsta/facebook-dl
  try {
    const res = await axios.get(`https://api.fdown.net/`, {
      params: { url: url },
      timeout: 15000
    });
    
    if (res.data && (res.data.hd || res.data.sd || res.data.videoUrl)) {
      return {
        success: true,
        title: 'Facebook Video',
        videoUrl: res.data.hd || res.data.sd || res.data.videoUrl,
        source: 'fdown'
      };
    }
  } catch (e) {
    // fdown failed
  }

  // API fallback 2: w3ads
  try {
    const res = await axios.get(`https://api.w3ads.com/facebook-dl`, {
      params: { url: url },
      timeout: 15000
    });
    
    if (res.data && res.data.data && res.data.data.url) {
      return {
        success: true,
        title: 'Facebook Video',
        videoUrl: res.data.data.url,
        source: 'w3ads'
      };
    }
  } catch (e) {
    // w3ads failed
  }

  // API fallback 3: cobalt
  try {
    const res = await axios.post('https://api.cobalt.tools/api/json', {
      url: url,
      vCodec: 'h264',
      vQuality: '720'
    }, {
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      timeout: 30000
    });
    
    if (res.data.url) {
      return {
        success: true,
        title: 'Facebook Video',
        videoUrl: res.data.url,
        source: 'cobalt'
      };
    }
  } catch (e) {
    // cobalt failed
  }

  // Fallback: yt-dlp
  try {
    const videoResult = runYtDlp(`-f "best" --get-url --no-playlist "${url}" 2>/dev/null`, 30000);
    if (videoResult && videoResult.includes('http')) {
      const jsonStr = runYtDlp(`--dump-json --no-playlist "${url}" 2>/dev/null`, 30000);
      const info = jsonStr ? JSON.parse(jsonStr) : {};
      return {
        success: true,
        title: info.title || 'Facebook Video',
        videoUrl: videoResult,
        source: 'yt-dlp'
      };
    }
  } catch (e) {
    // yt-dlp failed
  }

  return { success: false, error: 'Facebook download failed. Please try again later.' };
}

// ═══════════════════════════════════════════════════════════
// Twitter/X Download - Fixed with API fallbacks
// ═══════════════════════════════════════════════════════════
async function twitterDl(url) {
  // API fallback 1: w3ads
  try {
    const res = await axios.get(`https://api.w3ads.com/twitter-dl`, {
      params: { url: url },
      timeout: 15000
    });
    
    if (res.data && res.data.data && res.data.data.url) {
      return {
        success: true,
        title: 'Twitter Video',
        videoUrl: res.data.data.url,
        isVideo: true,
        source: 'w3ads'
      };
    }
  } catch (e) {
    // w3ads failed
  }

  // API fallback 2: cobalt
  try {
    const res = await axios.post('https://api.cobalt.tools/api/json', {
      url: url,
      vCodec: 'h264',
      vQuality: '720'
    }, {
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      timeout: 30000
    });
    
    if (res.data.url) {
      return {
        success: true,
        title: 'Twitter Video',
        videoUrl: res.data.url,
        isVideo: true,
        source: 'cobalt'
      };
    }
  } catch (e) {
    // cobalt failed
  }

  // Fallback: yt-dlp
  try {
    const jsonStr = runYtDlp(`--dump-json --no-playlist "${url}" 2>/dev/null`, 30000);
    if (jsonStr) {
      const info = JSON.parse(jsonStr);
      const videoResult = runYtDlp(`-f "best" --get-url --no-playlist "${url}" 2>/dev/null`, 30000);
      
      if (videoResult && videoResult.includes('http')) {
        return {
          success: true,
          title: info.full_title || info.title || 'Twitter Video',
          videoUrl: videoResult,
          isVideo: true,
          source: 'yt-dlp'
        };
      }
    }
  } catch (e) {
    // yt-dlp failed
  }

  // Fallback: scraper
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml'
      },
      timeout: 15000
    });
    
    const $ = cheerio.load(res.data);
    const ogVideo = $('meta[property="og:video"]').attr('content');
    const ogImage = $('meta[property="og:image"]').attr('content');
    
    if (ogVideo) {
      return { success: true, title: 'Twitter Video', videoUrl: ogVideo, isVideo: true, source: 'scraper' };
    } else if (ogImage) {
      return { success: true, title: 'Twitter Image', mediaUrl: ogImage, isVideo: false, source: 'scraper' };
    }
  } catch (e) {
    // scraping failed
  }

  return { success: false, error: 'Twitter/X download failed. Please try again later.' };
}

// ═══════════════════════════════════════════════════════════
// Spotify Download - Fixed with API fallbacks
// ═══════════════════════════════════════════════════════════
async function spotifyDl(url) {
  // Fallback 1: convert to YouTube search
  try {
    const searchResult = await ytSearch(url);
    if (searchResult.success && searchResult.url) {
      const audioResult = await ytAudio(searchResult.url);
      return audioResult;
    }
  } catch (e) {
    // fallback failed
  }

  // Fallback 2: direct API
  try {
    const res = await axios.get(`https://api.w3ads.com/spotify-dl`, {
      params: { url: url },
      timeout: 30000
    });
    
    if (res.data && res.data.data && res.data.data.url) {
      return {
        success: true,
        name: res.data.data.title || url,
        audioUrl: res.data.data.url,
        source: 'w3ads'
      };
    }
  } catch (e) {
    // w3ads failed
  }

  return { success: false, error: 'Spotify download failed. Please try again later.' };
}

// ═══════════════════════════════════════════════════════════
// MediaFire Download - Fixed scraper
// ═══════════════════════════════════════════════════════════
async function mediafireDl(url) {
  // Fallback 1: w3ads API
  try {
    const res = await axios.get(`https://api.w3ads.com/mediafire-dl`, {
      params: { url: url },
      timeout: 30000
    });
    
    if (res.data && res.data.data && res.data.data.url) {
      return {
        success: true,
        filename: res.data.data.filename || 'download',
        filesize: res.data.data.size || '',
        downloadUrl: res.data.data.url,
        source: 'w3ads'
      };
    }
  } catch (e) {
    // w3ads failed
  }

  // Fallback 2: direct scraping with proper parsing
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 15000,
      maxRedirects: 5
    });
    
    const $ = cheerio.load(res.data);
    
    // Try multiple selectors for MediaFire download button
    let downloadUrl = null;
    let filename = 'download';
    let size = '';
    
    // Method 1: direct download button
    const downloadBtn = $('a#downloadButton, a.download_link, a[href*="mediafire.com/download"]');
    downloadUrl = downloadBtn.attr('href');
    filename = downloadBtn.attr('title') || downloadBtn.text()?.trim() || 'download';
    
    // Method 2: aria label
    if (!downloadUrl) {
      const ariaBtn = $('a[aria-label*="Download"]');
      downloadUrl = ariaBtn.attr('href');
      filename = ariaBtn.attr('title') || 'download';
    }
    
    // Method 3: regex from script
    if (!downloadUrl) {
      const html = res.data;
      const match = html.match(/href="(https?:\/\/download\d+\.mediafire\.com[^"]+)"/);
      if (match) {
        downloadUrl = match[1];
      }
    }
    
    // Get file size
    const sizeMatch = res.data.match(/File name.*?<span[^>]*>([^<]+)<\/span>/i);
    if (sizeMatch) filename = sizeMatch[1];
    const sizeM = res.data.match(/File size.*?<span[^>]*>([^<]+)<\/span>/i);
    if (sizeM) size = sizeM[1];
    
    if (downloadUrl) {
      return {
        success: true,
        filename: filename || 'download',
        filesize: size || '',
        downloadUrl: downloadUrl,
        source: 'scraper'
      };
    }
  } catch (e) {
    // failed
  }

  return { success: false, error: 'MediaFire download failed. Please try again later.' };
}

// ═══════════════════════════════════════════════════════════
// APK Download - Fixed APKPure scraper
// ═══════════════════════════════════════════════════════════
async function apkDl(query) {
  // Method 1: APKPure search
  try {
    const searchUrl = `https://apkpure.com/search?q=${encodeURIComponent(query)}`;
    const res = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml'
      },
      timeout: 15000
    });
    
    const $ = cheerio.load(res.data);
    
    // Try multiple selectors
    let firstResult = $('.search-result dl.search-result-dl dt a').first();
    if (!firstResult.length) {
      firstResult = $('.search-result a').first();
    }
    if (!firstResult.length) {
      firstResult = $('a[href*="/download/"]').first();
    }
    
    const href = firstResult.attr('href');
    
    if (href) {
      const pkgUrl = href.startsWith('http') ? href : `https://apkpure.com${href}`;
      return {
        success: true,
        name: firstResult.attr('title') || firstResult.text()?.trim() || query,
        pageUrl: pkgUrl,
        source: 'apkpure'
      };
    }
  } catch (e) {
    // failed
  }

  // Method 2: w3ads API
  try {
    const res = await axios.get(`https://api.w3ads.com/apk-dl`, {
      params: { q: query },
      timeout: 15000
    });
    
    if (res.data && res.data.data && res.data.data.url) {
      return {
        success: true,
        name: res.data.data.name || query,
        pageUrl: res.data.data.url,
        source: 'w3ads'
      };
    }
  } catch (e) {
    // failed
  }

  return { success: false, error: 'APK not found.' };
}

// ═══════════════════════════════════════════════════════════
// Pinterest Image Search - Fixed
// ═══════════════════════════════════════════════════════════
async function pinterestSearch(query) {
  // Method 1: w3ads API
  try {
    const res = await axios.get(`https://api.w3ads.com/pinterest-search`, {
      params: { q: query },
      timeout: 15000
    });
    
    if (res.data && res.data.data && res.data.data.images && res.data.data.images.length > 0) {
      return {
        success: true,
        images: res.data.data.images.slice(0, 10),
        source: 'w3ads'
      };
    }
  } catch (e) {
    // w3ads failed
  }

  // Method 2: direct scraping with proper headers
  try {
    const res = await axios.get(`https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      timeout: 15000
    });
    
    const $ = cheerio.load(res.data);
    const images = [];
    
    // Try multiple image selectors
    $('img[src]').each((i, el) => {
      const src = $(el).attr('src');
      if (src && src.includes('i.pinimg.com')) {
        images.push(src);
      }
    });
    
    // Also try data attributes
    $('img[data-test-id]').each((i, el) => {
      const src = $(el).attr('src');
      if (src && src.includes('i.pinimg.com')) {
        images.push(src);
      }
    });
    
    if (images.length > 0) {
      const unique = [...new Set(images)];
      return {
        success: true,
        images: unique.slice(0, 10),
        source: 'scraper'
      };
    }
  } catch (e) {
    // scraping failed
  }

  return { success: false, error: 'Pinterest search failed.' };
}

// ═══════════════════════════════════════════════════════════
// Threads Download - Fixed with API fallbacks
// ═══════════════════════════════════════════════════════════
async function threadsDl(url) {
  // API fallback 1: w3ads
  try {
    const res = await axios.get(`https://api.w3ads.com/threads-dl`, {
      params: { url: url },
      timeout: 15000
    });
    
    if (res.data && res.data.data && res.data.data.url) {
      return {
        success: true,
        videoUrl: res.data.data.url,
        source: 'w3ads'
      };
    }
  } catch (e) {
    // w3ads failed
  }

  // API fallback 2: cobalt
  try {
    const res = await axios.post('https://api.cobalt.tools/api/json', {
      url: url,
      vCodec: 'h264',
      vQuality: '720'
    }, {
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      timeout: 30000
    });
    
    if (res.data.url) {
      return {
        success: true,
        videoUrl: res.data.url,
        source: 'cobalt'
      };
    }
  } catch (e) {
    // cobalt failed
  }

  // Fallback: yt-dlp
  try {
    const videoResult = runYtDlp(`-f "best" --get-url --no-playlist "${url}" 2>/dev/null`, 30000);
    if (videoResult && videoResult.includes('http')) {
      return {
        success: true,
        videoUrl: videoResult,
        source: 'yt-dlp'
      };
    }
  } catch (e) {
    // yt-dlp failed
  }

  // Fallback: scraper
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml'
      },
      timeout: 15000
    });
    
    const $ = cheerio.load(res.data);
    const ogVideo = $('meta[property="og:video"]').attr('content');
    
    if (ogVideo) {
      return { success: true, videoUrl: ogVideo, source: 'scraper' };
    }
  } catch (e) {
    // scraping failed
  }

  return { success: false, error: 'Threads download failed. Please try again later.' };
}

// ═══════════════════════════════════════════════════════════
// CapCut Download - Fixed with API fallbacks
// ═══════════════════════════════════════════════════════════
async function capcutDl(url) {
  // API fallback 1: w3ads
  try {
    const res = await axios.get(`https://api.w3ads.com/capcut-dl`, {
      params: { url: url },
      timeout: 15000
    });
    
    if (res.data && res.data.data && res.data.data.url) {
      return {
        success: true,
        videoUrl: res.data.data.url,
        source: 'w3ads'
      };
    }
  } catch (e) {
    // w3ads failed
  }

  // API fallback 2: cobalt
  try {
    const res = await axios.post('https://api.cobalt.tools/api/json', {
      url: url,
      vCodec: 'h264',
      vQuality: '720'
    }, {
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      timeout: 30000
    });
    
    if (res.data.url) {
      return {
        success: true,
        videoUrl: res.data.url,
        source: 'cobalt'
      };
    }
  } catch (e) {
    // cobalt failed
  }

  // Fallback: yt-dlp
  try {
    const videoResult = runYtDlp(`-f "best" --get-url --no-playlist "${url}" 2>/dev/null`, 30000);
    if (videoResult && videoResult.includes('http')) {
      return {
        success: true,
        videoUrl: videoResult,
        source: 'yt-dlp'
      };
    }
  } catch (e) {
    // yt-dlp failed
  }

  return { success: false, error: 'CapCut download failed. Please try again later.' };
}

// ═══════════════════════════════════════════════════════════
// Pornhub Download - Fixed with API + scraper
// ═══════════════════════════════════════════════════════════
async function pornhubDl(url) {
  // Fallback: yt-dlp
  try {
    const jsonStr = runYtDlp(`--dump-json --no-playlist "${url}" 2>/dev/null`, 60000);
    if (jsonStr) {
      const info = JSON.parse(jsonStr);
      const videoResult = runYtDlp(`-f "best" --get-url --no-playlist "${url}" 2>/dev/null`, 60000);
      
      if (videoResult && videoResult.includes('http')) {
        return {
          success: true,
          title: info.title || 'Pornhub Video',
          duration: info.duration || 0,
          thumbnail: info.thumbnail || '',
          uploader: info.uploader || '',
          videoUrl: videoResult,
          source: 'yt-dlp'
        };
      }
    }
  } catch (e) {
    // yt-dlp failed
  }

  // Fallback: scraper with og tags
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 20000
    });
    
    const $ = cheerio.load(res.data);
    const ogVideo = $('meta[property="og:video:url"]').attr('content') || $('meta[property="og:video"]').attr('content');
    const ogTitle = $('meta[property="og:title"]').attr('content');
    const ogImage = $('meta[property="og:image"]').attr('content');
    const ogDuration = $('meta[property="video:duration"]').attr('content');
    
    if (ogVideo) {
      return {
        success: true,
        title: ogTitle || 'Pornhub Video',
        duration: parseInt(ogDuration) || 0,
        thumbnail: ogImage || '',
        videoUrl: ogVideo,
        source: 'scraper'
      };
    }
  } catch (e) {
    // scraping failed
  }

  return { success: false, error: 'Pornhub download failed. Please try again later.' };
}

// ═══════════════════════════════════════════════════════════
// XNXX Download - Fixed
// ═══════════════════════════════════════════════════════════
async function xnxxDl(url) {
  // Fallback: yt-dlp
  try {
    const jsonStr = runYtDlp(`--dump-json --no-playlist "${url}" 2>/dev/null`, 60000);
    if (jsonStr) {
      const info = JSON.parse(jsonStr);
      const videoResult = runYtDlp(`-f "best" --get-url --no-playlist "${url}" 2>/dev/null`, 60000);
      
      if (videoResult && videoResult.includes('http')) {
        return {
          success: true,
          title: info.title || 'XNXX Video',
          duration: info.duration || 0,
          thumbnail: info.thumbnail || '',
          uploader: info.uploader || '',
          videoUrl: videoResult,
          source: 'yt-dlp'
        };
      }
    }
  } catch (e) {
    // yt-dlp failed
  }

  // Fallback: scraper
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 20000
    });
    
    const $ = cheerio.load(res.data);
    const ogVideo = $('meta[property="og:video:url"]').attr('content') || $('meta[property="og:video"]').attr('content');
    const ogTitle = $('meta[property="og:title"]').attr('content');
    const ogImage = $('meta[property="og:image"]').attr('content');
    const ogDuration = $('meta[property="video:duration"]').attr('content');
    
    if (ogVideo) {
      return {
        success: true,
        title: ogTitle || 'XNXX Video',
        duration: parseInt(ogDuration) || 0,
        thumbnail: ogImage || '',
        videoUrl: ogVideo,
        source: 'scraper'
      };
    }
  } catch (e) {
    // scraping failed
  }

  return { success: false, error: 'XNXX download failed. Please try again later.' };
}

// ═══════════════════════════════════════════════════════════
// XVideos Download - Fixed
// ═══════════════════════════════════════════════════════════
async function xvideosDl(url) {
  // Fallback: yt-dlp
  try {
    const jsonStr = runYtDlp(`--dump-json --no-playlist "${url}" 2>/dev/null`, 60000);
    if (jsonStr) {
      const info = JSON.parse(jsonStr);
      const videoResult = runYtDlp(`-f "best" --get-url --no-playlist "${url}" 2>/dev/null`, 60000);
      
      if (videoResult && videoResult.includes('http')) {
        return {
          success: true,
          title: info.title || 'XVideos Video',
          duration: info.duration || 0,
          thumbnail: info.thumbnail || '',
          uploader: info.uploader || '',
          videoUrl: videoResult,
          source: 'yt-dlp'
        };
      }
    }
  } catch (e) {
    // yt-dlp failed
  }

  // Fallback: scraper
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 20000
    });
    
    const $ = cheerio.load(res.data);
    const ogVideo = $('meta[property="og:video:url"]').attr('content') || $('meta[property="og:video"]').attr('content');
    const ogTitle = $('meta[property="og:title"]').attr('content');
    const ogImage = $('meta[property="og:image"]').attr('content');
    const ogDuration = $('meta[property="video:duration"]').attr('content');
    
    if (ogVideo) {
      return {
        success: true,
        title: ogTitle || 'XVideos Video',
        duration: parseInt(ogDuration) || 0,
        thumbnail: ogImage || '',
        videoUrl: ogVideo,
        source: 'scraper'
      };
    }
  } catch (e) {
    // scraping failed
  }

  return { success: false, error: 'XVideos download failed. Please try again later.' };
}

// ═══════════════════════════════════════════════════════════
// XHamster Download - Fixed
// ═══════════════════════════════════════════════════════════
async function xhamsterDl(url) {
  // Fallback: yt-dlp
  try {
    const jsonStr = runYtDlp(`--dump-json --no-playlist "${url}" 2>/dev/null`, 60000);
    if (jsonStr) {
      const info = JSON.parse(jsonStr);
      const videoResult = runYtDlp(`-f "best" --get-url --no-playlist "${url}" 2>/dev/null`, 60000);
      
      if (videoResult && videoResult.includes('http')) {
        return {
          success: true,
          title: info.title || 'XHamster Video',
          duration: info.duration || 0,
          thumbnail: info.thumbnail || '',
          uploader: info.uploader || '',
          videoUrl: videoResult,
          source: 'yt-dlp'
        };
      }
    }
  } catch (e) {
    // yt-dlp failed
  }

  // Fallback: scraper
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 20000
    });
    
    const $ = cheerio.load(res.data);
    const ogVideo = $('meta[property="og:video:url"]').attr('content') || $('meta[property="og:video"]').attr('content');
    const ogTitle = $('meta[property="og:title"]').attr('content');
    const ogImage = $('meta[property="og:image"]').attr('content');
    const ogDuration = $('meta[property="video:duration"]').attr('content');
    
    if (ogVideo) {
      return {
        success: true,
        title: ogTitle || 'XHamster Video',
        duration: parseInt(ogDuration) || 0,
        thumbnail: ogImage || '',
        videoUrl: ogVideo,
        source: 'scraper'
      };
    }
  } catch (e) {
    // scraping failed
  }

  return { success: false, error: 'XHamster download failed. Please try again later.' };
}

module.exports = {
  ytVideo,
  ytAudio,
  ytSearch,
  tiktokDl,
  instagramDl,
  facebookDl,
  twitterDl,
  spotifyDl,
  mediafireDl,
  apkDl,
  pinterestSearch,
  threadsDl,
  capcutDl,
  pornhubDl,
  xnxxDl,
  xvideosDl,
  xhamsterDl
};
