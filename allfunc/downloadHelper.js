const { execSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Helper to get temporary file path
function getTempPath(ext) {
  return path.join(os.tmpdir(), `ytdlp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`);
}

// Download YouTube video info and get URL
async function ytVideo(url) {
  try {
    const jsonStr = execSync(`yt-dlp --dump-json --no-playlist "${url}"`, {
      maxBuffer: 50 * 1024 * 1024,
      timeout: 30000,
      stdio: ['pipe', 'pipe', 'pipe']
    }).toString();
    
    const info = JSON.parse(jsonStr);
    
    // Get video URL directly
    const videoResult = execSync(
      `yt-dlp -f "bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/best[ext=mp4][height<=720]/best[height<=720]" --get-url --no-playlist "${url}"`,
      { maxBuffer: 10 * 1024 * 1024, timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] }
    ).toString().trim().split('\n');
    
    // Sometimes returns 2 URLs (video + audio), take the first (video)
    const videoUrl = videoResult[0];
    
    return {
      success: true,
      title: info.title || 'YouTube Video',
      duration: info.duration || 0,
      thumbnail: info.thumbnail || '',
      uploader: info.uploader || '',
      viewCount: info.view_count || 0,
      videoUrl: videoUrl || ''
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Download YouTube audio and get URL
async function ytAudio(url) {
  try {
    const jsonStr = execSync(`yt-dlp --dump-json --no-playlist "${url}"`, {
      maxBuffer: 50 * 1024 * 1024,
      timeout: 30000,
      stdio: ['pipe', 'pipe', 'pipe']
    }).toString();
    
    const info = JSON.parse(jsonStr);
    
    // Get audio URL directly
    const audioResult = execSync(
      `yt-dlp -f "bestaudio[ext=m4a]/bestaudio" --get-url --no-playlist "${url}"`,
      { maxBuffer: 10 * 1024 * 1024, timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] }
    ).toString().trim();
    
    return {
      success: true,
      title: info.title || 'YouTube Audio',
      duration: info.duration || 0,
      thumbnail: info.thumbnail || '',
      uploader: info.uploader || '',
      channelTitle: info.channel || '',
      audioUrl: audioResult || ''
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Download YouTube by search query (returns URL)
async function ytSearch(query) {
  try {
    const jsonStr = execSync(
      `yt-dlp "ytsearch1:${query}" --dump-json --no-playlist`,
      { maxBuffer: 50 * 1024 * 1024, timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] }
    ).toString();
    
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
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Download TikTok video using yt-dlp
async function tiktokDl(url) {
  try {
    // Try yt-dlp first
    try {
      const videoResult = execSync(
        `yt-dlp -f "best[height<=720]" --get-url --no-playlist "${url}" 2>/dev/null`,
        { maxBuffer: 10 * 1024 * 1024, timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] }
      ).toString().trim();
      
      if (videoResult && videoResult.includes('http')) {
        const jsonStr = execSync(
          `yt-dlp --dump-json --no-playlist "${url}" 2>/dev/null`,
          { maxBuffer: 50 * 1024 * 1024, timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] }
        ).toString();
        
        const info = JSON.parse(jsonStr);
        return {
          success: true,
          title: info.description || 'TikTok Video',
          author: info.uploader || info.creator || '',
          videoUrl: videoResult,
          source: 'yt-dlp'
        };
      }
    } catch (e) {
      // yt-dlp TikTok failed, try alternative
    }
    
    // Fallback: try TikWM API
    const axios = require('axios');
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
    } catch (e2) {
      // TikWM also failed
    }
    
    return { success: false, error: 'TikTok download failed. Please try again later.' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Download Instagram media using yt-dlp or API
async function instagramDl(url) {
  try {
    // Try yt-dlp first
    try {
      const jsonStr = execSync(
        `yt-dlp --dump-json --no-playlist "${url}" 2>/dev/null`,
        { maxBuffer: 50 * 1024 * 1024, timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] }
      ).toString();
      
      if (jsonStr.trim()) {
        const info = JSON.parse(jsonStr);
        const mediaUrl = info.url || '';
        
        return {
          success: true,
          title: info.title || info.description || 'Instagram Media',
          author: info.uploader || '',
          mediaUrl: mediaUrl,
          isVideo: info.ext ? info.ext.includes('video') || info.ext.includes('mp4') : false,
          source: 'yt-dlp'
        };
      }
    } catch (e) {
      // yt-dlp failed
    }
    
    // Fallback: use web scraper
    const axios = require('axios');
    const cheerio = require('cheerio');
    
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
    } catch (e2) {
      // Scraping failed
    }
    
    return { success: false, error: 'Instagram download failed. Please try again later.' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Download Facebook video
async function facebookDl(url) {
  try {
    // Try yt-dlp first
    try {
      const videoResult = execSync(
        `yt-dlp -f "best" --get-url --no-playlist "${url}" 2>/dev/null`,
        { maxBuffer: 10 * 1024 * 1024, timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] }
      ).toString().trim();
      
      if (videoResult && videoResult.includes('http')) {
        const jsonStr = execSync(
          `yt-dlp --dump-json --no-playlist "${url}" 2>/dev/null`,
          { maxBuffer: 50 * 1024 * 1024, timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] }
        ).toString();
        
        const info = JSON.parse(jsonStr);
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
    
    // Fallback: use FB scraper API
    const axios = require('axios');
    try {
      const res = await axios.get(`https://fbdown.online/api/download`, {
        params: { url: url },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://fbdown.online/'
        },
        timeout: 15000
      });
      
      if (res.data && (res.data.sd || res.data.hd)) {
        return {
          success: true,
          title: 'Facebook Video',
          videoUrl: res.data.hd || res.data.sd,
          source: 'fbdown'
        };
      }
    } catch (e2) {
      // fbdown failed
    }
    
    return { success: false, error: 'Facebook download failed. Please try again later.' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Download Twitter/X media
async function twitterDl(url) {
  try {
    // Try yt-dlp first
    try {
      const jsonStr = execSync(
        `yt-dlp --dump-json --no-playlist "${url}" 2>/dev/null`,
        { maxBuffer: 50 * 1024 * 1024, timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] }
      ).toString();
      
      if (jsonStr.trim()) {
        const info = JSON.parse(jsonStr);
        
        // Get video URL
        const videoResult = execSync(
          `yt-dlp -f "best" --get-url --no-playlist "${url}" 2>/dev/null`,
          { maxBuffer: 10 * 1024 * 1024, timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] }
        ).toString().trim();
        
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
    
    // Fallback: use nitter or similar
    const axios = require('axios');
    const cheerio = require('cheerio');
    
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
    } catch (e2) {
      // Scraping failed
    }
    
    return { success: false, error: 'Twitter/X download failed. Please try again later.' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Download Spotify track
async function spotifyDl(url) {
  const axios = require('axios');
  
  try {
    // Step 1: Get track info
    const getInfo = await axios.get(`https://api.fabdl.com/spotify/get?url=${encodeURIComponent(url)}`, {
      timeout: 15000
    });
    
    if (getInfo.data.result && getInfo.data.result.id) {
      const track = getInfo.data.result;
      
      // Step 2: Get download link
      const getDl = await axios.get(
        `https://api.fabdl.com/spotify/mp3-convert-task/${track.gid}/${track.id}`,
        { timeout: 30000 }
      );
      
      const dlData = getDl.data.result;
      
      if (dlData && dlData.download_url) {
        return {
          success: true,
          name: track.name,
          artists: track.artists,
          image: track.image,
          downloadUrl: dlData.download_url,
          source: 'fabdl'
        };
      }
    }
  } catch (e) {
    // fabdl failed, try alternative
  }
  
  // Fallback: search YouTube and get audio
  try {
    const searchResult = await ytSearch(url);
    if (searchResult.success && searchResult.url) {
      const audioResult = await ytAudio(searchResult.url);
      return audioResult;
    }
  } catch (e) {
    // fallback also failed
  }
  
  return { success: false, error: 'Spotify download failed. Please try again later.' };
}

// Download from MediaFire
async function mediafireDl(url) {
  const axios = require('axios');
  const cheerio = require('cheerio');
  
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 15000
    });
    
    const $ = cheerio.load(res.data);
    const downloadBtn = $('a#downloadButton');
    const downloadUrl = downloadBtn.attr('href');
    const filename = downloadBtn.text()?.trim();
    const size = $('.dl-info .details li').eq(1)?.text()?.trim();
    
    if (downloadUrl) {
      return {
        success: true,
        filename: filename || 'download',
        filesize: size || '',
        downloadUrl: downloadUrl
      };
    }
  } catch (e) {
    // failed
  }
  
  return { success: false, error: 'MediaFire download failed. Please try again later.' };
}

// Download APK
async function apkDl(query) {
  const axios = require('axios');
  const cheerio = require('cheerio');
  
  try {
    // Search APKPure
    const searchUrl = `https://apkpure.com/search?q=${encodeURIComponent(query)}`;
    const res = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 15000
    });
    
    const $ = cheerio.load(res.data);
    const firstResult = $('.search-result dl.search-result-dl dt a').first();
    const href = firstResult.attr('href');
    
    if (href) {
      const pkgUrl = href.startsWith('http') ? href : `https://apkpure.com${href}`;
      return {
        success: true,
        name: firstResult.attr('title') || query,
        pageUrl: pkgUrl,
        source: 'apkpure'
      };
    }
  } catch (e) {
    // failed
  }
  
  return { success: false, error: 'APK not found.' };
}

// Pinterest image search
async function pinterestSearch(query) {
  const axios = require('axios');
  const cheerio = require('cheerio');
  
  try {
    const res = await axios.get(`https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 15000
    });
    
    const $ = cheerio.load(res.data);
    const images = [];
    
    $('img[src]').each((i, el) => {
      const src = $(el).attr('src');
      if (src && src.includes('i.pinimg.com') && src.includes('originals')) {
        images.push(src);
      }
    });
    
    if (images.length > 0) {
      // Return unique images
      const unique = [...new Set(images)];
      return {
        success: true,
        images: unique.slice(0, 10)
      };
    }
  } catch (e) {
    // failed
  }
  
  return { success: false, error: 'Pinterest search failed.' };
}

// Threads download
async function threadsDl(url) {
  try {
    // Try yt-dlp (Threads is owned by Meta/Facebook)
    try {
      const videoResult = execSync(
        `yt-dlp -f "best" --get-url --no-playlist "${url}" 2>/dev/null`,
        { maxBuffer: 10 * 1024 * 1024, timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] }
      ).toString().trim();
      
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
    
    // Fallback: use threads scraper
    const axios = require('axios');
    const cheerio = require('cheerio');
    
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
    } catch (e2) {
      // scraping failed
    }
    
    return { success: false, error: 'Threads download failed. Please try again later.' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// CapCut download
async function capcutDl(url) {
  try {
    // Try yt-dlp first
    try {
      const videoResult = execSync(
        `yt-dlp -f "best" --get-url --no-playlist "${url}" 2>/dev/null`,
        { maxBuffer: 10 * 1024 * 1024, timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] }
      ).toString().trim();
      
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
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Pornhub download
async function pornhubDl(url) {
  try {
    // Try yt-dlp first (yt-dlp supports Pornhub)
    try {
      const jsonStr = execSync(
        `yt-dlp --dump-json --no-playlist "${url}" 2>/dev/null`,
        { maxBuffer: 50 * 1024 * 1024, timeout: 60000, stdio: ['pipe', 'pipe', 'pipe'] }
      ).toString();
      
      if (jsonStr.trim()) {
        const info = JSON.parse(jsonStr);
        const videoResult = execSync(
          `yt-dlp -f "best" --get-url --no-playlist "${url}" 2>/dev/null`,
          { maxBuffer: 10 * 1024 * 1024, timeout: 60000, stdio: ['pipe', 'pipe', 'pipe'] }
        ).toString().trim();
        
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
    
    // Fallback: use scraper
    const axios = require('axios');
    const cheerio = require('cheerio');
    
    try {
      const res = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
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
    } catch (e2) {
      // scraping failed
    }
    
    return { success: false, error: 'Pornhub download failed. Please try again later.' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// XNXX download
async function xnxxDl(url) {
  try {
    // Try yt-dlp first (yt-dlp supports xnxx)
    try {
      const jsonStr = execSync(
        `yt-dlp --dump-json --no-playlist "${url}" 2>/dev/null`,
        { maxBuffer: 50 * 1024 * 1024, timeout: 60000, stdio: ['pipe', 'pipe', 'pipe'] }
      ).toString();
      
      if (jsonStr.trim()) {
        const info = JSON.parse(jsonStr);
        const videoResult = execSync(
          `yt-dlp -f "best" --get-url --no-playlist "${url}" 2>/dev/null`,
          { maxBuffer: 10 * 1024 * 1024, timeout: 60000, stdio: ['pipe', 'pipe', 'pipe'] }
        ).toString().trim();
        
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
    
    // Fallback: use scraper
    const axios = require('axios');
    const cheerio = require('cheerio');
    
    try {
      const res = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
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
    } catch (e2) {
      // scraping failed
    }
    
    return { success: false, error: 'XNXX download failed. Please try again later.' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// XVideos download
async function xvideosDl(url) {
  try {
    // Try yt-dlp first (yt-dlp supports XVideos)
    try {
      const jsonStr = execSync(
        `yt-dlp --dump-json --no-playlist "${url}" 2>/dev/null`,
        { maxBuffer: 50 * 1024 * 1024, timeout: 60000, stdio: ['pipe', 'pipe', 'pipe'] }
      ).toString();
      
      if (jsonStr.trim()) {
        const info = JSON.parse(jsonStr);
        const videoResult = execSync(
          `yt-dlp -f "best" --get-url --no-playlist "${url}" 2>/dev/null`,
          { maxBuffer: 10 * 1024 * 1024, timeout: 60000, stdio: ['pipe', 'pipe', 'pipe'] }
        ).toString().trim();
        
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
    
    // Fallback: use scraper
    const axios = require('axios');
    const cheerio = require('cheerio');
    
    try {
      const res = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
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
    } catch (e2) {
      // scraping failed
    }
    
    return { success: false, error: 'XVideos download failed. Please try again later.' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// XHamster download
async function xhamsterDl(url) {
  try {
    // Try yt-dlp first (yt-dlp supports XHamster)
    try {
      const jsonStr = execSync(
        `yt-dlp --dump-json --no-playlist "${url}" 2>/dev/null`,
        { maxBuffer: 50 * 1024 * 1024, timeout: 60000, stdio: ['pipe', 'pipe', 'pipe'] }
      ).toString();
      
      if (jsonStr.trim()) {
        const info = JSON.parse(jsonStr);
        const videoResult = execSync(
          `yt-dlp -f "best" --get-url --no-playlist "${url}" 2>/dev/null`,
          { maxBuffer: 10 * 1024 * 1024, timeout: 60000, stdio: ['pipe', 'pipe', 'pipe'] }
        ).toString().trim();
        
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
    
    // Fallback: use scraper
    const axios = require('axios');
    const cheerio = require('cheerio');
    
    try {
      const res = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
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
    } catch (e2) {
      // scraping failed
    }
    
    return { success: false, error: 'XHamster download failed. Please try again later.' };
  } catch (e) {
    return { success: false, error: e.message };
  }
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
