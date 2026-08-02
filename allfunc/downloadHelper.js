const axios = require('axios');
const cheerio = require('cheerio');
const ytdl = require('@distube/ytdl-core');
const yts = require('yt-search');
const DL = require('api-dylux');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Helper function for yt-dlp
async function ytdlpDl(url) {
  try {
    const { stdout } = await execPromise(`yt-dlp -j --no-check-certificate "${url}"`);
    const data = JSON.parse(stdout);
    return {
      success: true,
      title: data.title || 'Video',
      videoUrl: data.url,
      thumbnail: data.thumbnail || '',
      duration: data.duration || 0,
      source: 'yt-dlp'
    };
  } catch (e) {
    return { success: false, error: 'yt-dlp failed: ' + e.message };
  }
}

// ═══════════════════════════════════════════════════════════
// YouTube Search - Uses yt-search npm package
// ═══════════════════════════════════════════════════════════
async function ytSearch(query) {
  try {
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
    // failed
  }
  return { success: false, error: 'YouTube search failed.' };
}

// ═══════════════════════════════════════════════════════════
// YouTube Audio Download - Uses @distube/ytdl-core
// ═══════════════════════════════════════════════════════════
async function ytAudio(url) {
  try {
    const info = await ytdl.getInfo(url);
    const audioFormat = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });
    return {
      success: true,
      title: info.videoDetails.title || 'YouTube Audio',
      duration: info.videoDetails.lengthSeconds || 0,
      thumbnail: info.videoDetails.thumbnails?.[0]?.url || '',
      uploader: info.videoDetails.author?.name || '',
      channelTitle: info.videoDetails.author?.name || '',
      audioUrl: audioFormat.url || ''
    };
  } catch (e) {
    return { success: false, error: 'YouTube audio download failed. Please try again later.' };
  }
}

// ═══════════════════════════════════════════════════════════
// YouTube Video Download - Uses @distube/ytdl-core
// ═══════════════════════════════════════════════════════════
async function ytVideo(url) {
  try {
    const info = await ytdl.getInfo(url);
    const videoFormat = ytdl.chooseFormat(info.formats, {
      quality: '720',
      filter: 'videoandaudio'
    });
    
    let videoUrl = videoFormat.url;
    
    // If no single stream with audio, use best quality video
    if (!videoUrl) {
      const bestVideo = ytdl.chooseFormat(info.formats, { quality: 'highest' });
      videoUrl = bestVideo?.url || '';
    }
    
    return {
      success: true,
      title: info.videoDetails.title || 'YouTube Video',
      duration: info.videoDetails.lengthSeconds || 0,
      thumbnail: info.videoDetails.thumbnails?.[0]?.url || '',
      uploader: info.videoDetails.author?.name || '',
      viewCount: parseInt(info.videoDetails.viewCount) || 0,
      videoUrl: videoUrl || ''
    };
  } catch (e) {
    return { success: false, error: 'YouTube video download failed. Please try again later.' };
  }
}

// ═══════════════════════════════════════════════════════════
// TikTok Download - Uses TikWM API + api-dylux fallback
// ═══════════════════════════════════════════════════════════
async function tiktokDl(url) {
  // Primary: TikWM API
  try {
    const res = await axios.get(`https://tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`, {
      timeout: 15000
    });
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

  // Fallback: api-dylux
  try {
    const result = await DL.tiktok(url);
    if (result && (result.video || result.url || result.hdplay)) {
      return {
        success: true,
        title: result.title || 'TikTok Video',
        author: result.author || '',
        videoUrl: result.hdplay || result.video || result.url,
        source: 'dylux'
      };
    }
  } catch (e) {
    // dylux failed
  }

  return { success: false, error: 'TikTok download failed. Please try again later.' };
}

// ═══════════════════════════════════════════════════════════
// Instagram Download - Uses multiple APIs for reliability
// ═══════════════════════════════════════════════════════════
async function instagramDl(url) {
  // Try Ryzendesu API (Reliable for IG)
  try {
    const res = await axios.get(`https://api.ryzendesu.vip/api/downloader/igdl?url=${encodeURIComponent(url)}`);
    if (res.data && res.data.data && res.data.data.length > 0) {
      const media = res.data.data[0];
      return {
        success: true,
        title: 'Instagram Media',
        mediaUrl: media.url,
        isVideo: true, // Prioritize video
        source: 'ryzendesu'
      };
    }
  } catch (e) {}

  // Try Agatz API
  try {
    const res = await axios.get(`https://api.agatz.xyz/api/instagram?url=${encodeURIComponent(url)}`);
    if (res.data && res.data.data && (res.data.data.url || res.data.data[0]?.url)) {
      const mediaUrl = res.data.data.url || res.data.data[0]?.url;
      return {
        success: true,
        title: 'Instagram Media',
        mediaUrl: mediaUrl,
        isVideo: true,
        source: 'agatz'
      };
    }
  } catch (e) {}

  // Try yt-dlp
  const ytResult = await ytdlpDl(url);
  if (ytResult.success && ytResult.videoUrl) return ytResult;

  // Method 1: Direct page scraping with og tags
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'cross-site'
      },
      timeout: 15000,
      maxRedirects: 5
    });
    
    const html = res.data;
    const $ = cheerio.load(html);
    
    // Try og:video
    const ogVideo = $('meta[property="og:video"]').attr('content') || $('meta[property="og:video:secure_url"]').attr('content');
    if (ogVideo) {
      return {
        success: true,
        title: $('meta[property="og:title"]').attr('content') || 'Instagram Video',
        mediaUrl: ogVideo,
        isVideo: true,
        source: 'scraper'
      };
    }
    
    // Try og:image
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage) {
      return {
        success: true,
        title: $('meta[property="og:title"]').attr('content') || 'Instagram Image',
        mediaUrl: ogImage,
        isVideo: false,
        source: 'scraper'
      };
    }
  } catch (e) {}

  return { success: false, error: 'Instagram download failed. Please try again later.' };
}

// ═══════════════════════════════════════════════════════════
// Facebook Download - Uses direct scraping + og tags
// ═══════════════════════════════════════════════════════════
async function facebookDl(url) {
  // Try Agatz API
  try {
    const res = await axios.get(`https://api.agatz.xyz/api/facebook?url=${encodeURIComponent(url)}`);
    if (res.data && res.data.data && res.data.data.url) {
      return {
        success: true,
        title: 'Facebook Video',
        videoUrl: res.data.data.url,
        source: 'agatz'
      };
    }
  } catch (e) {}

  // Try yt-dlp first
  const ytResult = await ytdlpDl(url);
  if (ytResult.success && ytResult.videoUrl) return ytResult;

  // Method 1: Direct scraping with og tags
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      timeout: 15000,
      maxRedirects: 5
    });
    
    const html = res.data;
    const $ = cheerio.load(html);
    
    // Try og:video
    const ogVideo = $('meta[property="og:video"]').attr('content') || 
                    $('meta[property="og:video:secure_url"]').attr('content') ||
                    $('meta[property="og:video:url"]').attr('content');
    
    if (ogVideo) {
      return {
        success: true,
        title: $('meta[property="og:title"]').attr('content') || 'Facebook Video',
        videoUrl: ogVideo,
        source: 'scraper'
      };
    }

    // Try meta video content
    const videoMeta = $('meta[property="al:ios:url"]').attr('content');
    if (videoMeta && videoMeta.includes('video')) {
      return {
        success: true,
        title: 'Facebook Video',
        videoUrl: videoMeta,
        source: 'meta'
      };
    }

    // Try regex for video src
    const videoMatch = html.match(/"browser_native_sd_url"\s*:\s*"([^"]+)"/);
    if (videoMatch && videoMatch[1]) {
      return {
        success: true,
        title: 'Facebook Video',
        videoUrl: videoMatch[1],
        source: 'regex'
      };
    }
  } catch (e) {
    // scraping failed
  }

  // Method 2: Try fdown.net
  try {
    const form = new URLSearchParams();
    form.append('URLz', url);
    const res = await axios.post('https://fdown.net/download.php', form, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': 'https://fdown.net',
        'Referer': 'https://fdown.net/'
      },
      timeout: 15000,
      maxRedirects: 5
    });
    
    if (res.data) {
      const $ = cheerio.load(res.data);
      const hdLink = $('a[href*="mp4"]').first().attr('href');
      if (hdLink) {
        return {
          success: true,
          title: 'Facebook Video',
          videoUrl: hdLink,
          source: 'fdown'
        };
      }
    }
  } catch (e) {
    // fdown failed
  }

  return { success: false, error: 'Facebook download failed. Please try again later.' };
}

// ═══════════════════════════════════════════════════════════
// Twitter/X Download - Uses direct scraping + og tags
// ═══════════════════════════════════════════════════════════
async function twitterDl(url) {
  // Method 1: Direct scraping with og tags
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 15000,
      maxRedirects: 5
    });
    
    const html = res.data;
    const $ = cheerio.load(html);
    
    // Try og:video
    const ogVideo = $('meta[property="og:video"]').attr('content') || 
                    $('meta[property="og:video:secure_url"]').attr('content');
    
    if (ogVideo) {
      return {
        success: true,
        title: $('meta[property="og:title"]').attr('content') || 'Twitter Video',
        videoUrl: ogVideo,
        isVideo: true,
        source: 'scraper'
      };
    }
    
    // Try og:image (for image tweets)
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage) {
      return {
        success: true,
        title: $('meta[property="og:title"]').attr('content') || 'Twitter Image',
        mediaUrl: ogImage,
        isVideo: false,
        source: 'scraper'
      };
    }
  } catch (e) {
    // scraping failed
  }

  // Method 2: Try nitter scraper
  try {
    const res = await axios.get(`https://nitter.net/${url.split('/')[3]}/status/${url.split('/').pop()}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 15000,
      maxRedirects: 5
    });
    
    const $ = cheerio.load(res.data);
    const videoSource = $('video source').first().attr('src');
    
    if (videoSource) {
      return {
        success: true,
        title: 'Twitter Video',
        videoUrl: videoSource.startsWith('http') ? videoSource : `https://nitter.net${videoSource}`,
        isVideo: true,
        source: 'nitter'
      };
    }
  } catch (e) {
    // nitter failed
  }

  return { success: false, error: 'Twitter/X download failed. Please try again later.' };
}

// ═══════════════════════════════════════════════════════════
// Spotify Download - Converts to YouTube search + download
// ═══════════════════════════════════════════════════════════
async function spotifyDl(url) {
  try {
    const res = await axios.get(`https://api.agatz.xyz/api/spotify?url=${encodeURIComponent(url)}`);
    if (res.data && res.data.data && res.data.data.url) {
      return {
        success: true,
        title: res.data.data.title || 'Spotify Track',
        audioUrl: res.data.data.url,
        image: res.data.data.thumbnail || '',
        artists: res.data.data.artist || '',
        source: 'agatz'
      };
    }
  } catch (e) {}

  return { success: false, error: 'Spotify download failed. Please try again later.' };
}

// ═══════════════════════════════════════════════════════════
// MediaFire Download - Direct scraping
// ═══════════════════════════════════════════════════════════
async function mediafireDl(url) {
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 15000
    });
    
    const html = res.data;
    const $ = cheerio.load(html);
    
    // Method 1: Direct download button
    let downloadUrl = $('a#downloadButton').attr('href');
    let filename = $('a#downloadButton').attr('title') || $('a#downloadButton').text()?.trim();
    
    if (downloadUrl) {
      return {
        success: true,
        filename: filename || 'download',
        downloadUrl: downloadUrl,
        source: 'scraper'
      };
    }
  } catch (e) {}

  return { success: false, error: 'MediaFire download failed. Please try again later.' };
}

// ═══════════════════════════════════════════════════════════
// APK Download - APKPure scraping
// ═══════════════════════════════════════════════════════════
async function apkDl(query) {
  try {
    const searchUrl = `https://apkpure.com/search?q=${encodeURIComponent(query)}`;
    const res = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 15000
    });
    
    const $ = cheerio.load(res.data);
    let firstResult = $('.search-result dl.search-result-dl dt a').first();
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
  } catch (e) {}

  return { success: false, error: 'APK not found.' };
}

// ═══════════════════════════════════════════════════════════
// Pinterest Image Search - Direct scraping
// ═══════════════════════════════════════════════════════════
async function pinterestSearch(query) {
  try {
    const res = await axios.get(`https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 15000
    });
    
    const $ = cheerio.load(res.data);
    const images = [];
    $('img[src]').each((i, el) => {
      const src = $(el).attr('src');
      if (src && src.includes('i.pinimg.com')) images.push(src);
    });
    
    if (images.length > 0) {
      return {
        success: true,
        images: [...new Set(images)].slice(0, 10),
        source: 'scraper'
      };
    }
  } catch (e) {}

  return { success: false, error: 'Pinterest search failed.' };
}

// ═══════════════════════════════════════════════════════════
// Threads Download - Direct scraping
// ═══════════════════════════════════════════════════════════
async function threadsDl(url) {
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 15000,
      maxRedirects: 5
    });
    
    const $ = cheerio.load(res.data);
    const ogVideo = $('meta[property="og:video"]').attr('content');
    if (ogVideo) return { success: true, videoUrl: ogVideo, source: 'scraper' };
  } catch (e) {}

  return { success: false, error: 'Threads download failed. Please try again later.' };
}

// ═══════════════════════════════════════════════════════════
// CapCut Download - Direct scraping
// ═══════════════════════════════════════════════════════════
async function capcutDl(url) {
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 15000
    });
    
    const $ = cheerio.load(res.data);
    const ogVideo = $('meta[property="og:video"]').attr('content');
    if (ogVideo) return { success: true, videoUrl: ogVideo, source: 'scraper' };
  } catch (e) {}

  return { success: false, error: 'CapCut download failed. Please try again later.' };
}

// ═══════════════════════════════════════════════════════════
// Pornhub Download - Uses Agatz API + Fallback
// ═══════════════════════════════════════════════════════════
async function pornhubDl(url) {
  // Try Agatz API
  try {
    const res = await axios.get(`https://api.agatz.xyz/api/pornhub?url=${encodeURIComponent(url)}`);
    if (res.data && res.data.data && res.data.data.url) {
      return {
        success: true,
        title: res.data.data.title || 'Pornhub Video',
        duration: res.data.data.duration || 0,
        thumbnail: res.data.data.thumb || '',
        videoUrl: res.data.data.url,
        source: 'agatz'
      };
    }
  } catch (e) {}

  // Try yt-dlp
  const ytResult = await ytdlpDl(url);
  if (ytResult.success && ytResult.videoUrl) return ytResult;

  // Method 1: Direct scraping with og tags
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 20000
    });
    
    const $ = cheerio.load(res.data);
    const ogVideo = $('meta[property="og:video:url"]').attr('content') || $('meta[property="og:video"]').attr('content');
    if (ogVideo) {
      return {
        success: true,
        title: $('meta[property="og:title"]').attr('content') || 'Pornhub Video',
        videoUrl: ogVideo,
        source: 'scraper'
      };
    }
  } catch (e) {}

  return { success: false, error: 'Pornhub download failed. Please try again later.' };
}

// ═══════════════════════════════════════════════════════════
// XNXX Download - Uses Agatz API + Fallback
// ═══════════════════════════════════════════════════════════
async function xnxxDl(url) {
  // Try Agatz API
  try {
    const res = await axios.get(`https://api.agatz.xyz/api/xnxx?url=${encodeURIComponent(url)}`);
    if (res.data && res.data.data && res.data.data.files) {
      return {
        success: true,
        title: res.data.data.title || 'XNXX Video',
        videoUrl: res.data.data.files.high || res.data.data.files.low,
        duration: res.data.data.duration || 0,
        source: 'agatz'
      };
    }
  } catch (e) {}

  // Try yt-dlp
  const ytResult = await ytdlpDl(url);
  if (ytResult.success && ytResult.videoUrl) return ytResult;

  // Method 1: Direct scraping with og tags
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 20000
    });
    
    const $ = cheerio.load(res.data);
    const ogVideo = $('meta[property="og:video:url"]').attr('content') || $('meta[property="og:video"]').attr('content');
    if (ogVideo) {
      return {
        success: true,
        title: $('meta[property="og:title"]').attr('content') || 'XNXX Video',
        videoUrl: ogVideo,
        source: 'scraper'
      };
    }
  } catch (e) {}

  return { success: false, error: 'XNXX download failed. Please try again later.' };
}

// ═══════════════════════════════════════════════════════════
// XVideos Download - Uses Agatz API + Fallback
// ═══════════════════════════════════════════════════════════
async function xvideosDl(url) {
  // Try Agatz API
  try {
    const res = await axios.get(`https://api.agatz.xyz/api/xvideos?url=${encodeURIComponent(url)}`);
    if (res.data && res.data.data && res.data.data.url) {
      return {
        success: true,
        title: res.data.data.title || 'XVideos Video',
        duration: res.data.data.duration || 0,
        thumbnail: res.data.data.thumb || '',
        videoUrl: res.data.data.url,
        source: 'agatz'
      };
    }
  } catch (e) {}

  // Try yt-dlp
  const ytResult = await ytdlpDl(url);
  if (ytResult.success && ytResult.videoUrl) return ytResult;

  // Method 1: api-dylux xvideos
  try {
    const result = await DL.xvideos(url);
    if (result && result.url_dl) {
      return {
        success: true,
        title: result.title || 'XVideos Video',
        videoUrl: result.url_dl,
        source: 'dylux'
      };
    }
  } catch (e) {}

  return { success: false, error: 'XVideos download failed. Please try again later.' };
}

// ═══════════════════════════════════════════════════════════
// XHamster Download - Uses Agatz API + Fallback
// ═══════════════════════════════════════════════════════════
async function xhamsterDl(url) {
  // Try Agatz API
  try {
    const res = await axios.get(`https://api.agatz.xyz/api/xhamster?url=${encodeURIComponent(url)}`);
    if (res.data && res.data.data && res.data.data.url) {
      return {
        success: true,
        title: res.data.data.title || 'XHamster Video',
        duration: res.data.data.duration || 0,
        thumbnail: res.data.data.thumb || '',
        videoUrl: res.data.data.url,
        source: 'agatz'
      };
    }
  } catch (e) {}

  // Try yt-dlp
  const ytResult = await ytdlpDl(url);
  if (ytResult.success && ytResult.videoUrl) return ytResult;

  // Method 1: Direct scraping with og tags
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 20000
    });
    
    const $ = cheerio.load(res.data);
    const ogVideo = $('meta[property="og:video:url"]').attr('content') || $('meta[property="og:video"]').attr('content');
    if (ogVideo) {
      return {
        success: true,
        title: $('meta[property="og:title"]').attr('content') || 'XHamster Video',
        videoUrl: ogVideo,
        source: 'scraper'
      };
    }
  } catch (e) {}

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
