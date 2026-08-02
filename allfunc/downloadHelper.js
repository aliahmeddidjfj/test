const axios = require('axios');
const cheerio = require('cheerio');
const ytdl = require('@distube/ytdl-core');
const yts = require('yt-search');
const DL = require('api-dylux');

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
// Instagram Download - Uses direct scraping with multiple methods
// ═══════════════════════════════════════════════════════════
async function instagramDl(url) {
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

    // Try JSON-LD data from page
    const scriptData = $('script[type="application/ld+json"]').text();
    if (scriptData) {
      try {
        const data = JSON.parse(scriptData);
        if (data.video) {
          return {
            success: true,
            title: data.name || 'Instagram Video',
            mediaUrl: data.video.contentUrl || data.video.url,
            isVideo: true,
            source: 'jsonld'
          };
        }
      } catch (e) {
        // JSON parse failed
      }
    }

    // Try embedded data in __additionalData
    const match = html.match(/"video_url"\s*:\s*"([^"]+)"/);
    if (match && match[1]) {
      return {
        success: true,
        title: 'Instagram Video',
        mediaUrl: match[1].replace(/\\u0026/g, '&'),
        isVideo: true,
        source: 'regex'
      };
    }
  } catch (e) {
    // scraping failed
  }

  // Method 2: Try snapinsta API
  try {
    const res = await axios.post('https://snapinsta.app/action.php', 
      `url=${encodeURIComponent(url)}&submit=`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Origin': 'https://snapinsta.app',
          'Referer': 'https://snapinsta.app/'
        },
        timeout: 15000,
        maxRedirects: 5
      }
    );
    
    if (res.data) {
      const $ = cheerio.load(res.data);
      const downloadLink = $('a.download_link, a[href*="download"]').first().attr('href');
      if (downloadLink) {
        return {
          success: true,
          title: 'Instagram Media',
          mediaUrl: downloadLink,
          isVideo: true,
          source: 'snapinsta'
        };
      }
    }
  } catch (e) {
    // snapinsta failed
  }

  return { success: false, error: 'Instagram download failed. Please try again later.' };
}

// ═══════════════════════════════════════════════════════════
// Facebook Download - Uses direct scraping + og tags
// ═══════════════════════════════════════════════════════════
async function facebookDl(url) {
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
    const ogImage = $('meta[property="og:image"]').attr('content');
    
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
  // Extract track name from Spotify URL and search on YouTube
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 15000
    });
    
    const $ = cheerio.load(res.data);
    const title = $('meta[property="og:title"]').attr('content') || '';
    const artist = $('meta[property="og:description"]').attr('content') || '';
    const image = $('meta[property="og:image"]').attr('content') || '';
    
    // Build search query
    const query = `${title} ${artist}`.trim();
    const searchResult = await ytSearch(query);
    
    if (searchResult.success && searchResult.url) {
      const audioResult = await ytAudio(searchResult.url);
      audioResult.name = title;
      audioResult.artists = artist;
      audioResult.image = image;
      return audioResult;
    }
  } catch (e) {
    // failed
  }

  // Fallback: use track ID from URL
  try {
    const trackId = url.match(/track\/([a-zA-Z0-9]+)/);
    if (trackId) {
      const searchResult = await ytSearch(trackId[1]);
      if (searchResult.success && searchResult.url) {
        const audioResult = await ytAudio(searchResult.url);
        return audioResult;
      }
    }
  } catch (e) {
    // failed
  }

  return { success: false, error: 'Spotify download failed. Please try again later.' };
}

// ═══════════════════════════════════════════════════════════
// MediaFire Download - Direct scraping
// ═══════════════════════════════════════════════════════════
async function mediafireDl(url) {
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
    
    // Method 1: Direct download button
    let downloadUrl = $('a#downloadButton').attr('href');
    let filename = $('a#downloadButton').attr('title') || $('a#downloadButton').text()?.trim();
    
    // Method 2: Regex from page source
    if (!downloadUrl) {
      const match = html.match(/href="(https?:\/\/download\d+\.mediafire\.com[^"]+)"/);
      if (match) {
        downloadUrl = match[1];
      }
    }
    
    // Method 3: aria-label button
    if (!downloadUrl) {
      downloadUrl = $('a[aria-label*="Download"], a[aria-label*="download"]').attr('href');
    }
    
    // Get file info
    if (!filename) {
      const nameMatch = html.match(/File name.*?<span[^>]*>([^<]+)<\/span>/i);
      if (nameMatch) filename = nameMatch[1];
    }
    
    const sizeMatch = html.match(/File size.*?<span[^>]*>([^<]+)<\/span>/i);
    const size = sizeMatch ? sizeMatch[1] : '';
    
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
// APK Download - APKPure scraping
// ═══════════════════════════════════════════════════════════
async function apkDl(query) {
  try {
    const searchUrl = `https://apkpure.com/search?q=${encodeURIComponent(query)}`;
    const res = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 15000
    });
    
    const $ = cheerio.load(res.data);
    
    // Try multiple selectors
    let firstResult = $('.search-result dl.search-result-dl dt a').first();
    if (!firstResult.length) firstResult = $('a.result-link').first();
    if (!firstResult.length) firstResult = $('a[href*="/download/"]').first();
    if (!firstResult.length) firstResult = $('a[href*="apkpure.com"]').first();
    
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

  return { success: false, error: 'APK not found.' };
}

// ═══════════════════════════════════════════════════════════
// Pinterest Image Search - Direct scraping
// ═══════════════════════════════════════════════════════════
async function pinterestSearch(query) {
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
    
    $('img[src]').each((i, el) => {
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
    // failed
  }

  return { success: false, error: 'Pinterest search failed.' };
}

// ═══════════════════════════════════════════════════════════
// Threads Download - Direct scraping
// ═══════════════════════════════════════════════════════════
async function threadsDl(url) {
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
    const ogVideo = $('meta[property="og:video"]').attr('content');
    const ogImage = $('meta[property="og:image"]').attr('content');
    
    if (ogVideo) {
      return { success: true, videoUrl: ogVideo, source: 'scraper' };
    } else if (ogImage) {
      return { success: true, videoUrl: ogImage, source: 'scraper' };
    }
  } catch (e) {
    // failed
  }

  return { success: false, error: 'Threads download failed. Please try again later.' };
}

// ═══════════════════════════════════════════════════════════
// CapCut Download - Direct scraping
// ═══════════════════════════════════════════════════════════
async function capcutDl(url) {
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 15000,
      maxRedirects: 5
    });
    
    const $ = cheerio.load(res.data);
    const ogVideo = $('meta[property="og:video"]').attr('content');
    
    if (ogVideo) {
      return { success: true, videoUrl: ogVideo, source: 'scraper' };
    }
  } catch (e) {
    // failed
  }

  return { success: false, error: 'CapCut download failed. Please try again later.' };
}

// ═══════════════════════════════════════════════════════════
// Pornhub Download - Uses yt-dlp (installed on Railway)
// ═══════════════════════════════════════════════════════════
async function pornhubDl(url) {
  // Method 1: Direct scraping with og tags
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
// XNXX Download - Uses api-dylux sxnxx (search) + sxvideos
// ═══════════════════════════════════════════════════════════
async function xnxxDl(url) {
  // Method 1: Direct scraping with og tags
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
// XVideos Download - Uses api-dylux xvideos
// ═══════════════════════════════════════════════════════════
async function xvideosDl(url) {
  // Method 1: api-dylux xvideos
  try {
    const result = await DL.xvideos(url);
    if (result && result.url_dl) {
      return {
        success: true,
        title: result.title || 'XVideos Video',
        thumbnail: result.thumb || '',
        videoUrl: result.url_dl,
        source: 'dylux'
      };
    }
  } catch (e) {
    // dylux failed
  }

  // Method 2: Direct scraping
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
// XHamster Download - Direct scraping
// ═══════════════════════════════════════════════════════════
async function xhamsterDl(url) {
  // Method 1: Direct scraping with og tags
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
