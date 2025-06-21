import './style.css'
import { 
  S3Client, 
  ListObjectsV2Command, 
  GetObjectCommand, 
  PutObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { AWS_CONFIG, UPLOAD_CONFIG, API_CONFIG } from './config.js'
import { authManager } from './auth.js'
import { authUI } from './auth-ui.js'
import { adminUI } from './admin.js'

// ------------------------------------------------------------
// 0.  Detect device / network and tailor the uploader
// ------------------------------------------------------------
(function adaptUploadConfig () {
  const MB = 1024 * 1024

  // crude mobile test – swap in your preferred detection
  const isMobile =
      /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent)

  // optional: finer tuning via Network-Information API
  const netInfo = navigator.connection || navigator.mozConnection || navigator.webkitConnection
  const slowLink = netInfo && ['slow-2g', '2g', '3g'].includes(netInfo.effectiveType)

  if (isMobile || slowLink) {
    // mobile / slow network → smaller parts, fewer parallel sockets
    Object.assign(UPLOAD_CONFIG, {
      chunkSize:             8 * MB,   // 8 MB parts
      maxConcurrentUploads:  4,
      useTransferAcceleration: false   // TA often hurts on 4G/5G
    })
    console.log('[AdaptiveConfig] Mobile/slow network – using 8 MB parts, 3 parallel uploads')
  } else {
    // desktop / good link → keep original heavy settings
    console.log('[AdaptiveConfig] Desktop/fast network – keeping default multipart settings')
  }
})()

// Initialize S3 client with optional transfer acceleration
let s3Client = new S3Client({
  region: AWS_CONFIG.region,
  credentials: AWS_CONFIG.credentials,
  useAccelerateEndpoint: UPLOAD_CONFIG.useTransferAcceleration
})

// Fallback S3 client without acceleration for DNS issues
const s3ClientFallback = new S3Client({
  region: AWS_CONFIG.region,
  credentials: AWS_CONFIG.credentials,
  useAccelerateEndpoint: false
})

// Global variables
let videos = []
let currentUploadXHR = null
let uploadStartTime = null
let lastProgressTime = null
let lastProgressBytes = 0
let currentMultipartUpload = null
let uploadedParts = []
let chunkProgress = new Map() // Track individual chunk progress
let lastProgressUpdate = 0 // Throttle progress updates
let currentUser = null

// Application will be rendered dynamically based on auth state

// Event Listeners
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize authentication
  const isAuthenticated = await authManager.initialize()
  
  if (isAuthenticated) {
    // User is authenticated, show main app
    await initializeMainApp()
  } else {
    // User is not authenticated, show login
    authUI.show('login')
  }

  // Listen for auth state changes
  authManager.subscribe(async (authState) => {
    if (authState.isAuthenticated) {
      currentUser = authState.user
      await initializeMainApp()
    } else {
      currentUser = null
      authUI.show('login')
    }
  })
})

// Helper function to update currentUser from authManager
async function updateCurrentUserFromAuth() {
  try {
    const authUser = authManager.getCurrentUser();
    currentUser = authUser;
    console.log('Updated currentUser from authManager:', currentUser);
  } catch (error) {
    console.error('Error updating currentUser from authManager:', error);
  }
}

async function initializeMainApp() {
  // Re-render the main app HTML (in case we're coming from auth)
  renderMainApp()
  setupEventListeners()
  await updateUserInfo()
  
  // Small delay to ensure session is fully established
  setTimeout(() => {
    loadVideos()
  }, 500)
}

// Make functions globally available for admin module
window.initializeMainApp = initializeMainApp;
window.updateCurrentUserFromAuth = updateCurrentUserFromAuth;

function renderMainApp() {
  const appContainer = document.querySelector('#app')
  appContainer.innerHTML = getMainAppHTML()
}

function getMainAppHTML() {
  return `
    <div class="container">
      <header class="header">
        <h1>🎥 Easy Video Share</h1>
        <p>Upload and share your videos easily</p>
      </header>

      <main class="main">
        <!-- User Info Section -->
        <div id="user-info" class="user-info">
          <div class="user-details">
            <div class="user-email" id="user-email">user@example.com</div>
            <div class="user-welcome">Welcome back!</div>
          </div>
          <div class="user-actions">
            <button id="admin-btn" class="admin-btn" style="display: none;">🔧 Admin</button>
            <button id="logout-btn" class="logout-btn">Logout</button>
          </div>
        </div>

        <!-- Upload Section -->
        <section class="upload-section">
          <h2>Upload Video</h2>
          <form id="upload-form" class="upload-form">
            <div class="form-group">
              <label for="video-title">Video Title</label>
              <input 
                type="text" 
                id="video-title" 
                name="title" 
                required 
                maxlength="100" 
                placeholder="Enter video title..."
              />
            </div>
            
            <div class="form-group">
              <label for="video-file">Select Video File</label>
              <input 
                type="file" 
                id="video-file" 
                name="videoFile" 
                accept="video/mp4,video/mov,video/avi,video/webm" 
                required
              />
              <small>Max size: 2GB. Supported formats: MP4, MOV, AVI, WebM</small>
            </div>

            <button type="submit" id="upload-btn" class="upload-btn">
              <span id="upload-text">Upload Video</span>
              <div id="upload-spinner" class="spinner hidden"></div>
            </button>
            
            <div id="upload-progress" class="progress-container enhanced hidden">
              <div class="progress-header">
                <span class="progress-title">Uploading: <span id="progress-filename"></span></span>
                <span id="progress-percentage">0%</span>
              </div>
              
              <div class="progress-bar">
                <div id="progress-fill" class="progress-fill"></div>
              </div>
              
              <div class="progress-stats">
                <span id="progress-bytes">0 MB / 0 MB</span>
                <span id="progress-speed">0 MB/s</span>
                <span id="progress-eta">--:--</span>
              </div>
              
              <div class="progress-actions">
                <button type="button" id="pause-btn" class="progress-btn">⏸️ Pause</button>
                <button type="button" id="cancel-btn" class="progress-btn">❌ Cancel</button>
              </div>
            </div>
          </form>
          
          <div id="upload-status" class="status-message"></div>
        </section>

        <!-- Video List Section -->
        <section class="video-section">
          <h2>My Videos</h2>
          <div id="video-list" class="video-list">
            <div class="loading">Loading videos...</div>
          </div>
        </section>
      </main>

      <!-- Video Modal -->
      <div id="video-modal" class="modal hidden">
        <div class="modal-content">
          <button class="modal-close" id="modal-close">&times;</button>
          <h3 id="modal-title">Video Title</h3>
          <video id="modal-video" controls>
            Your browser does not support the video tag.
          </video>
        </div>
      </div>
    </div>
  `
}


function setupEventListeners() {
  // Upload form
  const uploadForm = document.getElementById('upload-form')
  if (uploadForm) {
    uploadForm.addEventListener('submit', handleUpload)
  }

  // File input validation
  const fileInput = document.getElementById('video-file')
  if (fileInput) {
    fileInput.addEventListener('change', validateFile)
  }

  // Upload control buttons
  const pauseBtn = document.getElementById('pause-btn')
  const cancelBtn = document.getElementById('cancel-btn')
  
  if (pauseBtn) pauseBtn.addEventListener('click', pauseUpload)
  if (cancelBtn) cancelBtn.addEventListener('click', cancelUpload)

  // Logout button
  const logoutBtn = document.getElementById('logout-btn')
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout)
  }

  // Admin button
  const adminBtn = document.getElementById('admin-btn')
  if (adminBtn) {
    adminBtn.addEventListener('click', () => {
      adminUI.show()
    })
  }

  // Modal controls
  const modal = document.getElementById('video-modal')
  const modalClose = document.getElementById('modal-close')
  
  if (modalClose) modalClose.addEventListener('click', closeModal)
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal()
    })
  }
  
  // Escape key to close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal()
  })
}

async function updateUserInfo() {
  // Always get fresh user info from authManager
  const authUser = authManager.getCurrentUser();
  if (authUser && authManager.isUserAuthenticated()) {
    const userEmailElement = document.getElementById('user-email')
    if (userEmailElement) {
      try {
        // Get user attributes to access email
        const session = await authManager.getAccessToken()
        if (session) {
          // Try to get email from the JWT token claims
          const userAttributes = await authManager.getUserAttributes()
          const email = userAttributes?.email || authUser.username || 'User'
          userEmailElement.textContent = email
        } else {
          userEmailElement.textContent = authUser.username || 'User'
        }
      } catch (error) {
        console.error('Error getting user attributes:', error)
        userEmailElement.textContent = authUser.username || 'User'
      }
    }

    // Show/hide admin button based on user's admin status
    const adminBtn = document.getElementById('admin-btn')
    if (adminBtn) {
      if (authManager.isAdmin) {
        adminBtn.style.display = 'inline-block'
      } else {
        adminBtn.style.display = 'none'
      }
    }
  }
}

async function handleLogout() {
  const result = await authManager.logout()
  if (result.success) {
    // The auth state change will automatically show the login screen
    console.log('Logged out successfully')
  } else {
    console.error('Logout failed:', result.error)
    // Show logout anyway to prevent stuck state
    authUI.show('login')
  }
}

function validateFile(event) {
  const file = event.target.files[0]
  
  if (!file) return
  
  // Size validation
  if (file.size > UPLOAD_CONFIG.maxFileSize) {
    showStatus('error', `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds 2GB limit`)
    event.target.value = ''
    return
  }
  
  // Type validation
  if (!UPLOAD_CONFIG.allowedTypes.includes(file.type)) {
    showStatus('error', 'Please select a valid video file (MP4, MOV, AVI, WebM)')
    event.target.value = ''
    return
  }
  
  showStatus('success', `File selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`)
}

async function handleUpload(event) {
  event.preventDefault()
  
  if (!authManager.isUserAuthenticated()) {
    showStatus('error', 'Please login to upload videos')
    return
  }
  
  const form = event.target
  const formData = new FormData(form)
  const title = formData.get('title').trim()
  const file = formData.get('videoFile')
  
  if (!title || !file) {
    showStatus('error', 'Please fill in all fields')
    return
  }
  
  try {
    setUploadState(true)
    showStatus('info', 'Preparing upload...')
    
    // Generate unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileExtension = file.name.split('.').pop()
    const fileName = `${timestamp}-${title.replace(/[^a-zA-Z0-9]/g, '-')}.${fileExtension}`
    const videoKey = `videos/${fileName}`
    
    // Choose upload method based on file size
    showStatus('info', 'Uploading video...')
    if (file.size > UPLOAD_CONFIG.multipartThreshold) {
      showStatus('info', `Large file detected (${(file.size / 1024 / 1024).toFixed(1)}MB). Using multipart upload for faster transfer...`)
      await uploadWithMultipart(file, videoKey)
    } else {
      await uploadWithPresignedUrl(file, videoKey)
    }
    
    // Create and upload metadata to S3
    showStatus('info', 'Saving metadata...')
    const metadata = {
      title: title,
      filename: fileName,
      originalName: file.name,
      uploadDate: new Date().toISOString(),
      fileSize: file.size,
      contentType: file.type,
      videoUrl: `https://${AWS_CONFIG.bucketName}.s3.amazonaws.com/${videoKey}`
    }
    
    const metadataKey = `metadata/${fileName.replace(/\.[^/.]+$/, '')}.json`
    await uploadMetadata(metadata, metadataKey)
    
    // Save metadata to DynamoDB via API
    showStatus('info', 'Saving to database...')
    await saveVideoMetadataToAPI({
      title: title,
      filename: fileName,
      bucketLocation: videoKey,
      fileSize: file.size,
      contentType: file.type
    })
    
    showStatus('success', `Video "${title}" uploaded successfully!`)
    form.reset()
    
    // Refresh video list
    setTimeout(() => {
      loadVideos()
    }, 1000)
    
  } catch (error) {
    console.error('Upload error:', error)
    showStatus('error', `Upload failed: ${error.message}`)
  } finally {
    setUploadState(false)
  }
}

async function uploadWithPresignedUrl(file, key) {
  try {
    // Create presigned URL for upload
    const command = new PutObjectCommand({
      Bucket: AWS_CONFIG.bucketName,
      Key: key,
      ContentType: file.type,
      Metadata: {
        'original-name': file.name,
        'upload-timestamp': new Date().toISOString()
      }
    })
    
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 })
    
    // Reset progress tracking variables
    uploadStartTime = null
    lastProgressTime = null
    lastProgressBytes = 0
    
    // Set filename in progress display
    document.getElementById('progress-filename').textContent = file.name
    
    // Upload using XMLHttpRequest for progress tracking
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      currentUploadXHR = xhr
      
      // Track upload progress
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100)
          updateProgress(percentComplete, event.loaded, event.total)
        }
      })
      
      xhr.addEventListener('load', () => {
        currentUploadXHR = null
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr)
        } else {
          reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`))
        }
      })
      
      xhr.addEventListener('error', () => {
        currentUploadXHR = null
        reject(new Error('Network error during upload'))
      })
      
      xhr.addEventListener('abort', () => {
        currentUploadXHR = null
        reject(new Error('Upload aborted'))
      })
      
      xhr.open('PUT', presignedUrl)
      xhr.setRequestHeader('Content-Type', file.type)
      xhr.send(file)
    })
    
  } catch (error) {
    currentUploadXHR = null
    
    // Check if it's a DNS/network error and we should try fallback
    if (error.message.includes('Network error') && UPLOAD_CONFIG.useTransferAcceleration) {
      console.warn('Transfer acceleration failed for single upload, falling back to standard endpoint...')
      showStatus('info', 'Retrying with standard S3 endpoint...')
      
      // Switch to fallback client and retry
      s3Client = s3ClientFallback
      UPLOAD_CONFIG.useTransferAcceleration = false
      
      try {
        return await uploadWithPresignedUrl(file, key)
      } catch (retryError) {
        throw new Error(`Failed to upload video: ${retryError.message}`)
      }
    }
    
    throw new Error(`Failed to upload video: ${error.message}`)
  }
}

async function uploadWithMultipart(file, key) {
  const { bucketName } = AWS_CONFIG
  const { chunkSize, maxConcurrentUploads } = UPLOAD_CONFIG

  // 1. Create multipart upload
  const { UploadId: uploadId } = await s3Client.send(
    new CreateMultipartUploadCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: file.type,
      Metadata: {
        'original-name': file.name,
        'upload-timestamp': new Date().toISOString()
      }
    })
  )

  currentMultipartUpload = { uploadId, key }
  uploadedParts = []
  chunkProgress.clear()

  const totalParts = Math.ceil(file.size / chunkSize)
  const partQueue   = Array.from({ length: totalParts }, (_, i) => i + 1)
  const inFlight    = new Set()
  let finishUpload

  const startNext = async () => {
    if (partQueue.length === 0) return
    const partNumber = partQueue.shift()
    inFlight.add(partNumber)

    const start = (partNumber - 1) * chunkSize
    const end   = Math.min(start + chunkSize, file.size)
    const chunk = file.slice(start, end)
    console.log('🚚 part', partNumber, 'started; in-flight', inFlight.size)

    try {
      const result = await uploadChunkWithProgress(
        chunk, key, uploadId, partNumber, start, file.size, totalParts
      )
      uploadedParts.push(result)
    } finally {
      inFlight.delete(partNumber)
      console.log('🚚 part', partNumber, 'finished; in-flight', inFlight.size)
      // schedule another as soon as one finishes
      if (partQueue.length) startNext()
      // resolve when everything is done
      if (partQueue.length === 0 && inFlight.size === 0 && typeof finishUpload === 'function') {
        finishUpload()
      }
    }
  }

  // kick-off initial window
  Array.from({ length: Math.min(maxConcurrentUploads, partQueue.length) })
       .forEach(startNext)

  // wait here until `finishUpload` runs
  return new Promise((resolve, reject) => {
    finishUpload = async () => {
      try {
        // Sort by part number
        uploadedParts.sort((a, b) => a.PartNumber - b.PartNumber)
        const complete = await s3Client.send(
          new CompleteMultipartUploadCommand({
            Bucket: bucketName,
            Key: key,
            UploadId: uploadId,
            MultipartUpload: {
              Parts: uploadedParts.map(({ PartNumber, ETag }) => ({ PartNumber, ETag }))
            }
          })
        )
        currentMultipartUpload = null
        resolve(complete)
      } catch (err) {
        reject(err)
      }
    }
  })
}

async function uploadChunkWithProgress(chunk, key, uploadId, partNumber, startByte, totalFileSize, totalChunks) {
  try {
    // Create presigned URL for this chunk
    const command = new UploadPartCommand({
      Bucket: AWS_CONFIG.bucketName,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber
    })
    
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 })
    
    // Upload chunk using XMLHttpRequest for better browser compatibility
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      let chunkStartTime = Date.now()
      
      // Track individual chunk progress (throttled)
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          // Store this chunk's progress
          chunkProgress.set(partNumber, {
            loaded: event.loaded,
            total: event.total,
            startByte: startByte
          })
          
          // Only update UI every 500ms to avoid performance impact
          const now = Date.now()
          if (now - lastProgressUpdate > 500) {
            updateAggregatedProgress(totalFileSize, totalChunks)
            lastProgressUpdate = now
          }
        }
      })
      
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          // Extract ETag from response headers
          const etag = xhr.getResponseHeader('ETag')
          if (!etag) {
            reject(new Error(`No ETag received for part ${partNumber}`))
            return
          }
          
          // Remove completed chunk from progress tracking
          chunkProgress.delete(partNumber)
          
          resolve({
            ETag: etag,
            PartNumber: partNumber,
            size: chunk.size,
            uploadTime: Date.now() - chunkStartTime
          })
        } else {
          reject(new Error(`Upload failed for part ${partNumber}: ${xhr.status} ${xhr.statusText}`))
        }
      })
      
      xhr.addEventListener('error', () => {
        reject(new Error(`Network error uploading part ${partNumber}`))
      })
      
      xhr.addEventListener('abort', () => {
        reject(new Error(`Upload aborted for part ${partNumber}`))
      })
      
      xhr.open('PUT', presignedUrl)
      xhr.setRequestHeader('Content-Type', 'application/octet-stream')
      xhr.send(chunk)
    })
    
  } catch (error) {
    throw new Error(`Failed to upload chunk ${partNumber}: ${error.message}`)
  }
}

async function uploadMetadata(metadata, key) {
  try {
    // Create JSON string with proper encoding
    const jsonString = JSON.stringify(metadata, null, 2)
    const jsonBlob = new Blob([jsonString], { type: 'application/json; charset=utf-8' })
    
    const command = new PutObjectCommand({
      Bucket: AWS_CONFIG.bucketName,
      Key: key,
      Body: jsonString,
      ContentType: 'application/json; charset=utf-8'
    })
    
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 })
    
    const response = await fetch(presignedUrl, {
      method: 'PUT',
      body: jsonBlob,
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    })
    
    if (!response.ok) {
      throw new Error(`Metadata upload failed: ${response.status} ${response.statusText}`)
    }
    
    return response
  } catch (error) {
    throw new Error(`Failed to upload metadata: ${error.message}`)
  }
}

// API functions for DynamoDB integration
async function saveVideoMetadataToAPI(videoData) {
  try {
    const accessToken = await authManager.getAccessToken()
    if (!accessToken) {
      throw new Error('No authentication token available')
    }

    console.log('Making API call with token:', accessToken ? 'Token present' : 'No token')
    console.log('POST Token details:', {
      length: accessToken ? accessToken.length : 0,
      prefix: accessToken ? accessToken.substring(0, 50) + '...' : 'None'
    })

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    }
    
    console.log('POST Request headers:', headers)

    const response = await fetch(API_CONFIG.videosEndpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(videoData)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
    }

    const result = await response.json()
/*     console.log('Video metadata saved to database:', result)
 */    return result
  } catch (error) {
    console.error('Failed to save metadata to API:', error)
    throw new Error(`Failed to save to database: ${error.message}`)
  }
}

async function loadVideosFromAPI() {
  try {
    const accessToken = await authManager.getAccessToken()
    if (!accessToken) {
      throw new Error('No authentication token available')
    }

/*     console.log('Loading videos with token:', accessToken ? 'Token present' : 'No token')
    console.log('Token details:', {
      length: accessToken ? accessToken.length : 0,
      prefix: accessToken ? accessToken.substring(0, 50) + '...' : 'None'
    }) */

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    }
    
    //console.log('Request headers:', headers)

    const response = await fetch(API_CONFIG.videosEndpoint, {
      method: 'GET',
      headers: headers
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      console.error('API Error:', response.status, errorData)
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
    }

    const result = await response.json()
    // console.log('API Response:', result)
    return result.videos || []
  } catch (error) {
    console.error('Failed to load videos from API:', error)
    // DON'T fall back to S3 - that shows all videos, not user-specific videos
    // Instead, return empty array for authenticated users
    throw error
  }
}

async function loadVideos() {
  const videoListElement = document.getElementById('video-list')
  
  try {
    if (!authManager.isUserAuthenticated()) {
      videos = []
      displayVideoList(videos)
      return
    }

    // Show loading state
    if (videoListElement) {
      videoListElement.innerHTML = '<div class="loading">Loading your videos...</div>'
    }

    // Load from authenticated API only (no S3 fallback)
    const apiVideos = await loadVideosFromAPI()
    // console.log('Loaded videos from API:', apiVideos.length)
    
    // Transform API response to match existing format
    videos = apiVideos.map(video => ({
      title: video.title,
      filename: video.filename,
      uploadDate: video.upload_date,
      fileSize: video.file_size,
      contentType: video.content_type,
      videoUrl: `https://${AWS_CONFIG.bucketName}.s3.amazonaws.com/${video.bucket_location}`,
      userEmail: video.user_email || 'Unknown'
    }))
    
    displayVideoList(videos)
    
  } catch (error) {
    console.error('Error loading videos:', error)
    if (videoListElement) {
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        videoListElement.innerHTML = `
          <div class="error">
            Authentication failed. Please <a href="#" onclick="location.reload()">refresh the page</a> and try again.
          </div>
        `
      } else {
        videoListElement.innerHTML = `
          <div class="error">Error loading videos: ${error.message}</div>
        `
      }
    }
  }
}

async function loadVideosFromS3() {
  try {
    const listCommand = new ListObjectsV2Command({
      Bucket: AWS_CONFIG.bucketName,
      Prefix: 'metadata/',
      MaxKeys: 50
    })
    
    const response = await s3Client.send(listCommand)
    
    if (!response.Contents || response.Contents.length === 0) {
      return []
    }
    
    // Filter out directories and fetch metadata for each video file
    const metadataFiles = response.Contents.filter(object => 
      object.Key.endsWith('.json') && object.Size > 0
    )
    
    const videoPromises = metadataFiles.map(async (object) => {
      try {
        const metadataUrl = `https://${AWS_CONFIG.bucketName}.s3.amazonaws.com/${object.Key}`
        const response = await fetch(metadataUrl)
        
        if (!response.ok) {
          console.warn(`Failed to fetch metadata: ${object.Key} (${response.status})`)
          return null
        }
        
        const metadataText = await response.text()
        
        // Validate JSON before parsing
        if (!metadataText.trim() || metadataText.includes('�')) {
          console.warn(`Corrupted metadata file: ${object.Key}`)
          return null
        }
        
        return JSON.parse(metadataText)
      } catch (error) {
        console.error(`Error loading metadata for ${object.Key}:`, error)
        return null
      }
    })
    
    const videoMetadata = await Promise.all(videoPromises)
    const filteredVideos = videoMetadata.filter(video => video !== null)
    
    // Sort by upload date (newest first)
    filteredVideos.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate))
    
    return filteredVideos
    
  } catch (error) {
    console.error('Error loading videos from S3:', error)
    throw error
  }
}

function displayVideoList(videoList) {
  const listContainer = document.getElementById('video-list')
  
  if (videoList.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <p>No videos uploaded yet.</p>
        <p>Upload your first video above!</p>
      </div>
    `
    return
  }
  
  const videoItems = videoList.map(video => `
    <div class="video-item" data-video-url="${video.videoUrl}" data-title="${video.title}">
      <div class="video-info">
        <h3 class="video-title">${video.title}</h3>
        <div class="video-meta">
          <span class="user-email">👤 ${video.userEmail}</span>
          <span class="upload-date">${new Date(video.uploadDate).toLocaleDateString()}</span>
          <span class="file-size">${(video.fileSize / 1024 / 1024).toFixed(2)} MB</span>
        </div>
      </div>
      <button class="play-btn" onclick="openVideoModal('${video.videoUrl}', '${video.title}')">
        ▶️ Play
      </button>
    </div>
  `).join('')
  
  listContainer.innerHTML = videoItems
}

function openVideoModal(videoUrl, title) {
  const modal = document.getElementById('video-modal')
  const modalTitle = document.getElementById('modal-title')
  const modalVideo = document.getElementById('modal-video')
  
  modalTitle.textContent = title
  modalVideo.src = videoUrl
  modal.classList.remove('hidden')
  
  // Auto-focus on video for keyboard controls
  modalVideo.focus()
}

function closeModal() {
  const modal = document.getElementById('video-modal')
  const modalVideo = document.getElementById('modal-video')
  
  modalVideo.pause()
  modalVideo.src = ''
  modal.classList.add('hidden')
}

// Make modal functions globally available for admin module
window.openVideoModal = openVideoModal;
window.closeModal = closeModal;

function updateProgress(percentage, loaded, total) {
  const now = Date.now()
  
  // Initialize timing on first progress event
  if (!uploadStartTime) {
    uploadStartTime = now
    lastProgressTime = now
    lastProgressBytes = loaded
  }
  
  // Update progress bar and percentage
  document.getElementById('progress-fill').style.width = `${percentage}%`
  document.getElementById('progress-percentage').textContent = `${percentage}%`
  
  // Update bytes transferred
  const loadedMB = (loaded / 1024 / 1024).toFixed(1)
  const totalMB = (total / 1024 / 1024).toFixed(1)
  document.getElementById('progress-bytes').textContent = `${loadedMB} MB / ${totalMB} MB`
  
  // Calculate and display upload speed every second
  const timeDiff = (now - lastProgressTime) / 1000 // seconds
  if (timeDiff >= 1) {
    const bytesDiff = loaded - lastProgressBytes
    const speedBytesPerSecond = bytesDiff / timeDiff
    const speedMBPerSecond = (speedBytesPerSecond / 1024 / 1024).toFixed(1)
    
    document.getElementById('progress-speed').textContent = `${speedMBPerSecond} MB/s`
    
    // Calculate ETA
    if (speedBytesPerSecond > 0) {
      const remainingBytes = total - loaded
      const etaSeconds = Math.round(remainingBytes / speedBytesPerSecond)
      const etaMinutes = Math.floor(etaSeconds / 60)
      const etaSecondsRemainder = etaSeconds % 60
      const etaDisplay = `${etaMinutes}:${etaSecondsRemainder.toString().padStart(2, '0')}`
      document.getElementById('progress-eta').textContent = etaDisplay
    }
    
    lastProgressTime = now
    lastProgressBytes = loaded
  }
}

function updateMultipartProgress(percentage, loaded, total, completedChunks, totalChunks) {
  const now = Date.now()
  
  // Initialize timing on first progress event
  if (!uploadStartTime) {
    uploadStartTime = now
    lastProgressTime = now
    lastProgressBytes = 0
  }
  
  // Update progress bar and percentage
  document.getElementById('progress-fill').style.width = `${percentage}%`
  document.getElementById('progress-percentage').textContent = `${percentage}% (${completedChunks}/${totalChunks} chunks)`
  
  // Update bytes transferred
  const loadedMB = (loaded / 1024 / 1024).toFixed(1)
  const totalMB = (total / 1024 / 1024).toFixed(1)
  document.getElementById('progress-bytes').textContent = `${loadedMB} MB / ${totalMB} MB`
  
  // Calculate and display upload speed
  const totalTime = (now - uploadStartTime) / 1000 // total seconds since start
  if (totalTime > 0) {
    const averageSpeedBytesPerSecond = loaded / totalTime
    const speedMBPerSecond = (averageSpeedBytesPerSecond / 1024 / 1024).toFixed(1)
    
    document.getElementById('progress-speed').textContent = `${speedMBPerSecond} MB/s (avg)`
    
    // Calculate ETA based on average speed
    if (averageSpeedBytesPerSecond > 0) {
      const remainingBytes = total - loaded
      const etaSeconds = Math.round(remainingBytes / averageSpeedBytesPerSecond)
      const etaMinutes = Math.floor(etaSeconds / 60)
      const etaSecondsRemainder = etaSeconds % 60
      const etaDisplay = `${etaMinutes}:${etaSecondsRemainder.toString().padStart(2, '0')}`
      document.getElementById('progress-eta').textContent = etaDisplay
    }
  }
}

function updateAggregatedProgress(totalFileSize, totalChunks) {
  const now = Date.now()
  // Initialise timing on first call
  if (!uploadStartTime) {
    uploadStartTime = now
    lastProgressTime = now
    lastProgressBytes = 0
  }

  // Bytes from parts that have already completed
  const completedBytes = uploadedParts.reduce((sum, p) => sum + (p.size || 0), 0)

  // Bytes from parts that are still in-flight (chunkProgress)
  let activeBytes = 0
  let activeChunks = 0
  for (const progress of chunkProgress.values()) {
    activeBytes += progress.loaded
    activeChunks++
  }

  const totalBytesUploaded = completedBytes + activeBytes
  const overallProgress = Math.round((totalBytesUploaded / totalFileSize) * 100)

  // UI updates
  document.getElementById('progress-fill').style.width = `${overallProgress}%`
  document.getElementById('progress-percentage').textContent = `${overallProgress}% (${activeChunks} active)`

  const loadedMB = (totalBytesUploaded / 1024 / 1024).toFixed(1)
  const totalMB = (totalFileSize / 1024 / 1024).toFixed(1)
  document.getElementById('progress-bytes').textContent = `${loadedMB} MB / ${totalMB} MB`

  const totalTime = (now - uploadStartTime) / 1000
  if (totalTime > 0) {
    const averageSpeedBytesPerSecond = totalBytesUploaded / totalTime
    const speedMBPerSecond = (averageSpeedBytesPerSecond / 1024 / 1024).toFixed(1)
    document.getElementById('progress-speed').textContent = `${speedMBPerSecond} MB/s`

    if (averageSpeedBytesPerSecond > 0) {
      const remainingBytes = totalFileSize - totalBytesUploaded
      const etaSeconds = Math.round(remainingBytes / averageSpeedBytesPerSecond)
      const etaMinutes = Math.floor(etaSeconds / 60)
      const etaSecondsRemainder = etaSeconds % 60
      const etaDisplay = `${etaMinutes}:${etaSecondsRemainder.toString().padStart(2, '0')}`
      document.getElementById('progress-eta').textContent = etaDisplay
    }
  }
}

async function pauseUpload() {
  if (currentUploadXHR) {
    currentUploadXHR.abort()
    showStatus('info', 'Upload paused')
  } else if (currentMultipartUpload) {
    // For multipart uploads, we'll abort the current upload
    // In a more advanced implementation, you could save progress and resume later
    await cancelUpload()
  }
}

async function cancelUpload() {
  if (currentUploadXHR) {
    currentUploadXHR.abort()
    setUploadState(false)
    showStatus('error', 'Upload cancelled')
  } else if (currentMultipartUpload) {
    try {
      showStatus('info', 'Cancelling multipart upload...')
      
      const abortCommand = new AbortMultipartUploadCommand({
        Bucket: AWS_CONFIG.bucketName,
        Key: currentMultipartUpload.key,
        UploadId: currentMultipartUpload.uploadId
      })
      
      await s3Client.send(abortCommand)
      currentMultipartUpload = null
      uploadedParts = []
      chunkProgress.clear()
      setUploadState(false)
      showStatus('error', 'Upload cancelled')
    } catch (error) {
      console.error('Error cancelling multipart upload:', error)
      showStatus('error', `Failed to cancel upload: ${error.message}`)
    }
  }
}

function setUploadState(isUploading) {
  const uploadBtn = document.getElementById('upload-btn')
  const uploadText = document.getElementById('upload-text')
  const uploadSpinner = document.getElementById('upload-spinner')
  const progressContainer = document.getElementById('upload-progress')
  
  uploadBtn.disabled = isUploading
  
  if (isUploading) {
    uploadText.textContent = 'Uploading...'
    uploadSpinner.classList.remove('hidden')
    progressContainer.classList.remove('hidden')
    
    // Reset progress display
    document.getElementById('progress-fill').style.width = '0%'
    document.getElementById('progress-percentage').textContent = '0%'
    document.getElementById('progress-bytes').textContent = '0 MB / 0 MB'
    document.getElementById('progress-speed').textContent = '0 MB/s'
    document.getElementById('progress-eta').textContent = '--:--'
  } else {
    uploadText.textContent = 'Upload Video'
    uploadSpinner.classList.add('hidden')
    progressContainer.classList.add('hidden')
    
    // Clear progress tracking
    currentUploadXHR = null
    currentMultipartUpload = null
    uploadedParts = []
    chunkProgress.clear()
    lastProgressUpdate = 0
    uploadStartTime = null
    lastProgressTime = null
    lastProgressBytes = 0
  }
}

function showStatus(type, message) {
  const statusDiv = document.getElementById('upload-status')
  statusDiv.className = `status-message ${type}`
  statusDiv.textContent = message
  
  // Auto-clear success messages
  if (type === 'success') {
    setTimeout(() => {
      statusDiv.textContent = ''
      statusDiv.className = 'status-message'
    }, 5000)
  }
}

// Make openVideoModal available globally for onclick handlers
window.openVideoModal = openVideoModal

// Debug function to check S3 contents
window.debugS3 = async function() {
  try {
    const listCommand = new ListObjectsV2Command({
      Bucket: AWS_CONFIG.bucketName,
      Prefix: 'metadata/',
      MaxKeys: 50
    })
    
    const response = await s3Client.send(listCommand)
    // console.log('S3 Contents:', response.Contents)
    
    // Check each metadata file
    for (const object of response.Contents || []) {
      if (object.Key.endsWith('.json')) {
        const url = `https://${AWS_CONFIG.bucketName}.s3.amazonaws.com/${object.Key}`
        const fileResponse = await fetch(url)
        const text = await fileResponse.text()
        // console.log(`File: ${object.Key}, Size: ${object.Size}, Content preview:`, text.substring(0, 100))
      }
    }
  } catch (error) {
    console.error('Debug error:', error)
  }
}

// Function to clean up corrupted metadata files
window.cleanupCorruptedFiles = async function() {
  try {
   // console.log('Scanning for corrupted metadata files...')
    
    const listCommand = new ListObjectsV2Command({
      Bucket: AWS_CONFIG.bucketName,
      Prefix: 'metadata/',
      MaxKeys: 50
    })
    
    const response = await s3Client.send(listCommand)
    const corruptedFiles = []
    
    // Check each metadata file for corruption
    for (const object of response.Contents || []) {
      if (object.Key.endsWith('.json') && object.Size > 0) {
        try {
          const url = `https://${AWS_CONFIG.bucketName}.s3.amazonaws.com/${object.Key}`
          const fileResponse = await fetch(url)
          const text = await fileResponse.text()
          
          if (text.includes('�') || !text.trim()) {
            corruptedFiles.push(object.Key)
          } else {
            // Try to parse JSON
            JSON.parse(text)
          }
        } catch (error) {
          corruptedFiles.push(object.Key)
        }
      }
    }
    
    if (corruptedFiles.length > 0) {
      console.log(`Found ${corruptedFiles.length} corrupted files:`, corruptedFiles)
      console.log('To clean up, run this AWS CLI command:')
      console.log(`aws s3 rm s3://${AWS_CONFIG.bucketName}/metadata/ --recursive`)
      console.log('Then reload the page and upload a new test video.')
    } else {
      console.log('No corrupted files found!')
    }
    
    return corruptedFiles
  } catch (error) {
    console.error('Cleanup scan error:', error)
  }
}
