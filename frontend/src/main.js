import './style.css'
import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { AWS_CONFIG, UPLOAD_CONFIG } from './config.js'

// Initialize S3 client
const s3Client = new S3Client({
  region: AWS_CONFIG.region,
  credentials: AWS_CONFIG.credentials
})

// Global variables
let videos = []

// Main application HTML
document.querySelector('#app').innerHTML = `
  <div class="container">
    <header class="header">
      <h1>🎥 Easy Video Share</h1>
      <p>Upload and share your videos easily</p>
    </header>

    <main class="main">
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
          
          <div id="upload-progress" class="progress-container hidden">
            <div class="progress-bar">
              <div id="progress-fill" class="progress-fill"></div>
            </div>
            <span id="progress-text">0%</span>
          </div>
        </form>
        
        <div id="upload-status" class="status-message"></div>
      </section>

      <!-- Video List Section -->
      <section class="video-section">
        <h2>Uploaded Videos</h2>
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

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners()
  loadVideos()
})

function setupEventListeners() {
  // Upload form
  const uploadForm = document.getElementById('upload-form')
  uploadForm.addEventListener('submit', handleUpload)

  // File input validation
  const fileInput = document.getElementById('video-file')
  fileInput.addEventListener('change', validateFile)

  // Modal controls
  const modal = document.getElementById('video-modal')
  const modalClose = document.getElementById('modal-close')
  
  modalClose.addEventListener('click', closeModal)
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal()
  })
  
  // Escape key to close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal()
  })
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
    
    // Upload video using presigned URL (more browser-compatible)
    showStatus('info', 'Uploading video...')
    await uploadWithPresignedUrl(file, videoKey)
    
    // Create and upload metadata
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
    
    // Upload using fetch with presigned URL
    const response = await fetch(presignedUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type
      }
    })
    
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`)
    }
    
    return response
  } catch (error) {
    throw new Error(`Failed to upload video: ${error.message}`)
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

async function loadVideos() {
  try {
    const listCommand = new ListObjectsV2Command({
      Bucket: AWS_CONFIG.bucketName,
      Prefix: 'metadata/',
      MaxKeys: 50
    })
    
    const response = await s3Client.send(listCommand)
    
    if (!response.Contents || response.Contents.length === 0) {
      displayVideoList([])
      return
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
    videos = videoMetadata.filter(video => video !== null)
    
    // Sort by upload date (newest first)
    videos.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate))
    
    displayVideoList(videos)
    
  } catch (error) {
    console.error('Error loading videos:', error)
    document.getElementById('video-list').innerHTML = `
      <div class="error">Error loading videos: ${error.message}</div>
    `
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
  } else {
    uploadText.textContent = 'Upload Video'
    uploadSpinner.classList.add('hidden')
    progressContainer.classList.add('hidden')
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
    console.log('S3 Contents:', response.Contents)
    
    // Check each metadata file
    for (const object of response.Contents || []) {
      if (object.Key.endsWith('.json')) {
        const url = `https://${AWS_CONFIG.bucketName}.s3.amazonaws.com/${object.Key}`
        const fileResponse = await fetch(url)
        const text = await fileResponse.text()
        console.log(`File: ${object.Key}, Size: ${object.Size}, Content preview:`, text.substring(0, 100))
      }
    }
  } catch (error) {
    console.error('Debug error:', error)
  }
}

// Function to clean up corrupted metadata files
window.cleanupCorruptedFiles = async function() {
  try {
    console.log('Scanning for corrupted metadata files...')
    
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
