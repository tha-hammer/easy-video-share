// Simple CSS import for custom auth styles only
import './style.css'

// Remove complex Metronic imports - will use pre-compiled assets instead
// import 'bootstrap/dist/js/bootstrap.bundle.min.js';
// import "@keenthemes/ktui/dist/ktui.js";
// import "./assets/metronic/core/index";
// import "./assets/metronic/app/layouts/demo1";

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
import { metronicManager } from './metronic-integration.js'

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

// Simple dropdown functionality
function initializeDropdowns() {
  // Handle user dropdown
  const userButton = document.querySelector('[data-kt-dropdown-toggle="true"]')
  const userDropdown = document.querySelector('.kt-dropdown-menu')
  
  if (userButton && userDropdown) {
    userButton.addEventListener('click', (e) => {
      e.preventDefault()
      if (userDropdown.style.display === 'block') {
        userDropdown.style.display = 'none'
      } else {
        userDropdown.style.display = 'block'
        userDropdown.style.zIndex = '9999'
        userDropdown.style.position = 'absolute'
      }
    })
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!userButton.contains(e.target) && !userDropdown.contains(e.target)) {
        userDropdown.style.display = 'none'
      }
    })
  }
  
  // Handle upload dropdown
  const uploadButton = document.querySelector('[data-kt-menu-toggle]')
  const uploadDropdown = document.querySelector('.kt-menu-dropdown')
  
  if (uploadButton && uploadDropdown) {
    uploadButton.addEventListener('click', (e) => {
      e.preventDefault()
      if (uploadDropdown.style.display === 'block') {
        uploadDropdown.style.display = 'none'
      } else {
        uploadDropdown.style.display = 'block'
        uploadDropdown.style.zIndex = '9999'
        uploadDropdown.style.position = 'absolute'
      }
    })
  }
}

function renderMainApp() {
  const appContainer = document.querySelector('#app')
  appContainer.innerHTML = getMainAppHTML()
  
  // Initialize simple dropdown functionality
  setTimeout(initializeDropdowns, 100)
}

function getMainAppHTML() {
  return `
    <div class="flex grow flex-col in-data-kt-[sticky-header=on]:pt-(--header-height)">
      <!-- Header -->
      <header class="flex items-center shrink-0 bg-background h-(--header-height)" data-kt-sticky="true" data-kt-sticky-class="transition-[height] fixed z-10 top-0 left-0 right-0 shadow-xs backdrop-blur-md bg-white/70 dark:bg-coal-500/70 dark:border-b dark:border-b-light" data-kt-sticky-name="header" data-kt-sticky-offset="100px" id="header">
        <!-- Container -->
        <div class="kt-container-fixed flex lg:justify-between items-center gap-2.5">
          <!-- Logo -->
          <div class="flex items-center gap-1 lg:w-[400px] grow lg:grow-0">
            <button class="kt-btn kt-btn-icon kt-btn-ghost -ms-2.5 lg:hidden" data-kt-drawer-toggle="#navbar">
              <i class="ki-filled ki-menu"></i>
            </button>
            <div class="flex items-center gap-2">
              <div class="flex items-center">
                <span class="text-2xl">🎥</span>
              </div>
              <h3 class="text-mono text-lg font-medium hidden md:block">Easy Video Share</h3>
            </div>
            <!-- Navs -->
            <div class="hidden lg:flex items-center">
              <div class="border-e border-border h-5 mx-4"></div>
              <!-- Nav -->
              <div class="kt-menu kt-menu-default" data-kt-menu="true">
                <div class="kt-menu-item kt-menu-item-dropdown" data-kt-menu-item-offset="0, 10px" data-kt-menu-item-placement="bottom-start" data-kt-menu-item-placement-rtl="bottom-end" data-kt-menu-item-toggle="dropdown" data-kt-menu-item-trigger="hover">
                  <button class="kt-menu-toggle text-mono text-sm font-medium">
                    My Videos
                    <span class="kt-menu-arrow">
                      <i class="ki-filled ki-down"></i>
                    </span>
                  </button>
                  <div class="kt-menu-dropdown w-48 py-2">
                    <div class="kt-menu-item">
                      <a class="kt-menu-link" href="#" onclick="loadVideos()">
                        <span class="kt-menu-icon">
                          <i class="ki-filled ki-video"></i>
                        </span>
                        <span class="kt-menu-title">All Videos</span>
                      </a>
                    </div>
                    <div class="kt-menu-item">
                      <a class="kt-menu-link" href="#" onclick="document.getElementById('video-file').click()">
                        <span class="kt-menu-icon">
                          <i class="ki-filled ki-cloud-upload"></i>
                        </span>
                        <span class="kt-menu-title">Upload New</span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
              <!-- End of Nav -->
            </div>
            <!-- End of Navs -->
          </div>
          <!-- End of Logo -->
          
          <div class="kt-input w-[36px] lg:w-60">
            <i class="ki-filled ki-magnifier"></i>
            <input class="min-w-0" placeholder="Search videos..." type="text" value="" id="video-search">
            <span class="text-xs text-secondary-foreground text-nowrap hidden lg:inline">ctrl + /</span>
          </div>
          
          <!-- Topbar -->
          <div class="flex items-center gap-2 lg:gap-3.5 lg:w-[400px] justify-end">
            <div class="flex items-center gap-2 me-0.5">
              <!-- User -->
              <div data-kt-dropdown="true" data-kt-dropdown-offset="10px, 10px" data-kt-dropdown-offset-rtl="-20px, 10px" data-kt-dropdown-placement="bottom-end" data-kt-dropdown-placement-rtl="bottom-start" data-kt-dropdown-trigger="click">
                <button class="kt-btn kt-btn-ghost kt-btn-icon size-9 rounded-full hover:bg-transparent hover:[&_i]:text-primary" data-kt-dropdown-toggle="true">
                  <div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-semibold text-sm">
                    <span id="user-initials-header">U</span>
                  </div>
                </button>
                <div class="kt-dropdown-menu w-[280px]" data-kt-dropdown-menu="true">
                  <div class="flex items-center justify-between px-2.5 py-1.5 gap-1.5">
                    <div class="flex items-center gap-2">
                      <div class="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white font-semibold border-2 border-green-500">
                        <span id="user-initials-dropdown">U</span>
                      </div>
                      <div class="flex flex-col gap-1.5">
                        <span class="text-sm text-foreground font-semibold leading-none" id="user-name-dropdown">User</span>
                        <span class="text-xs text-secondary-foreground hover:text-primary font-medium leading-none" id="user-email-dropdown">user@example.com</span>
                      </div>
                    </div>
                    <span class="kt-badge kt-badge-sm kt-badge-primary kt-badge-outline">Pro</span>
                  </div>
                  
                  <ul class="kt-dropdown-menu-sub">
                    <li><div class="kt-dropdown-menu-separator"></div></li>
                    
                    <li>
                      <a class="kt-dropdown-menu-link" href="#" onclick="loadVideos()">
                        <i class="ki-filled ki-video"></i>
                        My Videos
                      </a>
                    </li>
                    
                    <li>
                      <a class="kt-dropdown-menu-link" href="#" onclick="document.getElementById('upload-form').scrollIntoView()">
                        <i class="ki-filled ki-cloud-upload"></i>
                        Upload Video
                      </a>
                    </li>
                    
                    <li id="admin-main-menu-item" style="display: none;">
                      <a class="kt-dropdown-menu-link" href="#" id="admin-btn-main">
                        <i class="ki-filled ki-shield-tick"></i>
                        Admin Panel
                      </a>
                    </li>
                    
                    <li data-kt-dropdown="true" data-kt-dropdown-placement="right-start" data-kt-dropdown-trigger="hover">
                      <button class="kt-dropdown-menu-toggle" data-kt-dropdown-toggle="true">
                        <i class="ki-filled ki-setting-2"></i>
                        Settings
                        <span class="kt-dropdown-menu-indicator">
                          <i class="ki-filled ki-right text-xs"></i>
                        </span>
                      </button>
                      <div class="kt-dropdown-menu w-[220px]" data-kt-dropdown-menu="true">
                        <ul class="kt-dropdown-menu-sub">
                          <li>
                            <a class="kt-dropdown-menu-link" href="#" onclick="loadVideos()">
                              <i class="ki-filled ki-video"></i>
                              Video Library
                            </a>
                          </li>
                          <li>
                            <a class="kt-dropdown-menu-link" href="#" onclick="document.getElementById('video-search').focus()">
                              <i class="ki-filled ki-magnifier"></i>
                              Search Videos
                            </a>
                          </li>
                          <li id="admin-dropdown-item" style="display: none;">
                            <a class="kt-dropdown-menu-link" href="#" id="admin-btn-dropdown">
                              <i class="ki-filled ki-shield-tick"></i>
                              Admin Panel
                            </a>
                          </li>
                        </ul>
                      </div>
                    </li>
                    
                    <li><div class="kt-dropdown-menu-separator"></div></li>
                  </ul>
                  
                  <div class="px-2.5 pt-1.5 mb-2.5 flex flex-col gap-3.5">
                    <div class="flex items-center gap-2 justify-between">
                      <span class="flex items-center gap-2">
                        <i class="ki-filled ki-moon text-base text-muted-foreground"></i>
                        <span class="font-medium text-2sm">Dark Mode</span>
                      </span>
                      <input class="kt-switch" data-kt-theme-switch-state="dark" data-kt-theme-switch-toggle="true" name="check" type="checkbox" value="1">
                    </div>
                    <button class="kt-btn kt-btn-outline justify-center w-full" id="logout-btn-dropdown">
                      Log out
                    </button>
                  </div>
                </div>
              </div>
              <!-- End of User -->
              
              <div class="border-e border-border h-5"></div>
              
              <div class="kt-menu" data-kt-menu="true">
                <div class="kt-menu-item kt-menu-item-dropdown" data-kt-menu-item-offset="0, 10px" data-kt-menu-item-placement="bottom-end" data-kt-menu-item-placement-rtl="bottom-start" data-kt-menu-item-toggle="dropdown" data-kt-menu-item-trigger="click">
                  <button class="kt-menu-toggle kt-btn kt-btn-primary">
                    <i class="ki-filled ki-plus text-sm mr-1"></i>
                    Upload
                  </button>
                  <div class="kt-menu-dropdown kt-menu-default w-full max-w-[200px]" data-kt-menu-dismiss="true">
                    <div class="kt-menu-item">
                      <a class="kt-menu-link" href="#" onclick="document.getElementById('video-file').click()">
                        <span class="kt-menu-icon">
                          <i class="ki-filled ki-cloud-upload"></i>
                        </span>
                        <span class="kt-menu-title">Upload Video</span>
                      </a>
                    </div>
                    <div class="kt-menu-item">
                      <a class="kt-menu-link" href="#" onclick="document.getElementById('upload-form').scrollIntoView()">
                        <span class="kt-menu-icon">
                          <i class="ki-filled ki-scroll"></i>
                        </span>
                        <span class="kt-menu-title">Go to Upload Form</span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <!-- End of Topbar -->
          </div>
          <!-- End of Container -->
        </div>
      </header>

      <!-- Main Content -->
      <div class="flex grow flex-col bg-muted/25">
        <div class="kt-container-fixed py-5 lg:py-7.5">
          <!-- Main Grid -->
          <div class="grid grid-cols-1 xl:grid-cols-2 gap-5 lg:gap-7.5">
            
            <!-- Upload Card -->
            <div class="kt-card kt-card-grid">
              <div class="kt-card-header py-5 flex-wrap">
                <h3 class="kt-card-title flex items-center gap-2">
                  <i class="ki-filled ki-cloud-upload text-xl text-primary"></i>
                  Upload Video
                </h3>
                <div class="text-sm text-muted-foreground">Share your videos securely</div>
              </div>
              <div class="kt-card-content">
                <form id="upload-form" class="space-y-5">
                  <div>
                    <label for="video-title" class="kt-label required">Video Title</label>
                    <input 
                      type="text" 
                      id="video-title" 
                      name="title" 
                      class="kt-input"
                      required 
                      maxlength="100" 
                      placeholder="Enter a descriptive title for your video..."
                    />
                  </div>
                  
                  <div>
                    <label for="video-file" class="kt-label required">Select Video File</label>
                    <input 
                      type="file" 
                      id="video-file" 
                      name="videoFile" 
                      class="kt-input"
                      accept="video/mp4,video/mov,video/avi,video/webm" 
                      required
                    />
                    <div class="text-sm text-muted-foreground mt-1">Max size: 2GB. Supported formats: MP4, MOV, AVI, WebM</div>
                  </div>

                  <button type="submit" id="upload-btn" class="kt-btn kt-btn-primary w-full">
                    <span id="upload-text" class="flex items-center gap-2">
                      <i class="ki-filled ki-cloud-upload text-lg"></i>
                      Upload Video
                    </span>
                    <span id="upload-spinner" class="hidden">
                      <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    </span>
                  </button>
                  
                  <!-- Enhanced Progress Section -->
                  <div id="upload-progress" class="kt-card border border-primary mt-5 hidden">
                    <div class="kt-card-content p-5">
                      <div class="flex justify-between items-center mb-3">
                        <span class="text-sm font-medium text-muted-foreground">
                          Uploading: <span id="progress-filename" class="text-primary font-semibold"></span>
                        </span>
                        <span id="progress-percentage" class="text-sm font-bold text-foreground">0%</span>
                      </div>
                      
                      <div class="w-full bg-muted rounded-full h-3 mb-4">
                        <div id="progress-fill" class="bg-primary h-3 rounded-full transition-all duration-300" style="width: 0%"></div>
                      </div>
                      
                      <div class="grid grid-cols-3 gap-4 mb-4">
                        <div>
                          <div class="text-xs font-medium text-muted-foreground">Progress</div>
                          <div id="progress-bytes" class="text-sm font-semibold">0 MB / 0 MB</div>
                        </div>
                        <div>
                          <div class="text-xs font-medium text-muted-foreground">Speed</div>
                          <div id="progress-speed" class="text-sm font-semibold">0 MB/s</div>
                        </div>
                        <div>
                          <div class="text-xs font-medium text-muted-foreground">ETA</div>
                          <div id="progress-eta" class="text-sm font-semibold">--:--</div>
                        </div>
                      </div>
                      
                      <div class="flex justify-end gap-2">
                        <button type="button" id="pause-btn" class="kt-btn kt-btn-outline kt-btn-sm">
                          <i class="ki-filled ki-pause text-sm"></i>
                          Pause
                        </button>
                        <button type="button" id="cancel-btn" class="kt-btn kt-btn-outline kt-btn-sm">
                          <i class="ki-filled ki-cross text-sm"></i>
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
                
                <div id="upload-status" class="mt-4"></div>
              </div>
            </div>

            <!-- Video List Card -->
            <div class="kt-card kt-card-grid">
              <div class="kt-card-header py-5 flex-wrap">
                <h3 class="kt-card-title flex items-center gap-2">
                  <i class="ki-filled ki-video text-xl text-primary"></i>
                  My Videos
                </h3>
                <div class="text-sm text-muted-foreground">Your uploaded content</div>
              </div>
              <div class="kt-card-content">
                <div id="video-list" class="space-y-3 max-h-96 overflow-y-auto">
                  <div class="flex items-center justify-center py-10">
                    <div class="text-center">
                      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                      <div class="text-muted-foreground text-sm mt-2">Loading videos...</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Video Modal -->
      <div class="kt-modal" data-kt-modal="true" id="video-modal">
        <div class="kt-modal-content w-[95%] sm:w-[90%] lg:w-[85%] max-w-6xl max-h-[90vh] top-[5%] mx-auto my-[5vh] flex flex-col">
          <div class="kt-modal-header flex-shrink-0 px-4 py-3 border-b border-border">
            <h3 class="kt-modal-title text-base font-semibold" id="modal-title">
              Video Player
            </h3>
            <button class="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost shrink-0" data-kt-modal-dismiss="true">
              <i class="ki-filled ki-cross"></i>
            </button>
          </div>
          <div class="kt-modal-body p-0 flex-1 min-h-0 bg-black">
            <video id="modal-video" controls preload="metadata" class="w-full h-full object-contain">
              Your browser does not support the video tag.
            </video>
          </div>
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

  // Logout buttons (multiple in dropdowns)
  const logoutBtns = document.querySelectorAll('#logout-btn-dropdown')
  logoutBtns.forEach(btn => {
    if (btn) {
      btn.addEventListener('click', handleLogout)
    }
  })

  // Admin buttons (multiple in dropdowns)
  const adminBtns = document.querySelectorAll('#admin-btn-dropdown, #admin-btn-main')
  adminBtns.forEach(btn => {
    if (btn) {
      btn.addEventListener('click', () => {
        adminUI.show()
      })
    }
  })

  // Search functionality
  const searchInput = document.getElementById('video-search')
  if (searchInput) {
    searchInput.addEventListener('input', handleVideoSearch)
    // Handle Ctrl+/ shortcut
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault()
        searchInput.focus()
      }
    })
  }

  // Modal controls
  const modal = document.getElementById('video-modal')
  const modalClose = document.querySelector('[data-kt-modal-dismiss="true"]')
  
  if (modalClose) modalClose.addEventListener('click', closeModal)
  if (modal) {
    modal.addEventListener('click', (e) => {
      // Close modal when clicking on backdrop (not the modal content)
      if (e.target === modal) {
        closeModal()
      }
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
    let email = 'User'
    let displayName = 'User'
    
    try {
      // Get user attributes to access email
      const session = await authManager.getAccessToken()
      if (session) {
        // Try to get email from the JWT token claims
        const userAttributes = await authManager.getUserAttributes()
        email = userAttributes?.email || authUser.username || 'User'
        displayName = userAttributes?.name || email.split('@')[0] || 'User'
      } else {
        email = authUser.username || 'User'
        displayName = email.split('@')[0] || 'User'
      }
    } catch (error) {
      console.error('Error getting user attributes:', error)
      email = authUser.username || 'User'
      displayName = email.split('@')[0] || 'User'
    }

    // Update all email elements
    const emailElements = document.querySelectorAll('#user-email-dropdown')
    emailElements.forEach(el => {
      if (el) el.textContent = email
    })

    // Update display name elements
    const nameElements = document.querySelectorAll('#user-name-dropdown')
    nameElements.forEach(el => {
      if (el) el.textContent = displayName
    })

    // Show/hide admin button based on user's admin status
    const adminMenuItems = document.querySelectorAll('#admin-dropdown-item, #admin-main-menu-item')
    adminMenuItems.forEach(item => {
      if (item) {
        if (authManager.isAdmin) {
          item.style.display = 'block'
        } else {
          item.style.display = 'none'
        }
      }
    })
    
    // Update user initials in all avatars
    const initials = email.split('@')[0].substring(0, 2).toUpperCase()
    const initialsElements = document.querySelectorAll('#user-initials-header, #user-initials-dropdown')
    initialsElements.forEach(el => {
      if (el) el.textContent = initials
    })
  }
}

// Add video search functionality
function handleVideoSearch(event) {
  const searchTerm = event.target.value.toLowerCase().trim()
  const videoItems = document.querySelectorAll('#video-list .kt-card')
  
  videoItems.forEach(item => {
    const title = item.querySelector('.font-semibold')?.textContent?.toLowerCase() || ''
    const email = item.querySelector('.truncate')?.textContent?.toLowerCase() || ''
    
    if (searchTerm === '' || title.includes(searchTerm) || email.includes(searchTerm)) {
      item.style.display = 'block'
    } else {
      item.style.display = 'none'
    }
  })
  
  // Show "no results" message if no videos are visible
  const visibleItems = Array.from(videoItems).filter(item => item.style.display !== 'none')
  const videoList = document.getElementById('video-list')
  
  if (searchTerm && visibleItems.length === 0 && videoItems.length > 0) {
    const noResultsMsg = document.createElement('div')
    noResultsMsg.className = 'text-center py-8 text-muted-foreground'
    noResultsMsg.innerHTML = `
      <div class="text-lg mb-2">No videos found</div>
      <div class="text-sm">Try adjusting your search terms</div>
    `
    noResultsMsg.id = 'no-results'
    
    // Remove existing no-results message
    const existing = document.getElementById('no-results')
    if (existing) existing.remove()
    
    videoList.appendChild(noResultsMsg)
  } else {
    // Remove no-results message if search is cleared or results found
    const existing = document.getElementById('no-results')
    if (existing) existing.remove()
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
      <div class="flex flex-col items-center justify-center py-10 px-5">
        <div class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <i class="ki-filled ki-video text-2xl text-primary"></i>
        </div>
        <h3 class="text-lg font-semibold text-foreground mb-2">No videos yet</h3>
        <div class="text-sm text-muted-foreground text-center">Upload your first video to get started!</div>
      </div>
    `
    return
  }
  
  const videoItems = videoList.map(video => `
    <div class="kt-card border border-border rounded-lg p-4 hover:shadow-sm transition-shadow" data-video-url="${video.videoUrl}" data-title="${video.title}">
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <i class="ki-filled ki-video text-xl text-primary"></i>
        </div>
        <div class="flex-grow min-w-0">
          <div class="font-semibold text-foreground mb-1 truncate">${video.title}</div>
          <div class="flex items-center gap-4 text-xs text-muted-foreground">
            <div class="flex items-center gap-1">
              <i class="ki-filled ki-profile-circle text-xs"></i>
              <span class="truncate">${video.userEmail}</span>
            </div>
            <div class="flex items-center gap-1">
              <i class="ki-filled ki-calendar text-xs"></i>
              <span>${new Date(video.uploadDate).toLocaleDateString()}</span>
            </div>
            <div class="flex items-center gap-1">
              <i class="ki-filled ki-document text-xs"></i>
              <span>${(video.fileSize / 1024 / 1024).toFixed(1)} MB</span>
            </div>
          </div>
        </div>
        <div class="flex-shrink-0">
          <button 
            class="kt-btn kt-btn-primary kt-btn-sm" 
            onclick="openVideoModal('${video.videoUrl}', '${video.title}')"
          >
            <i class="ki-filled ki-play text-sm"></i>
            Play
          </button>
        </div>
      </div>
    </div>
  `).join('')
  
  listContainer.innerHTML = videoItems
}

function openVideoModal(videoUrl, title) {
  const modal = document.getElementById('video-modal')
  const modalTitle = document.getElementById('modal-title')
  const modalVideo = document.getElementById('modal-video')
  
  if (!modal || !modalTitle || !modalVideo) {
    console.error('Modal elements not found')
    return
  }
  
  modalTitle.textContent = title
  modalVideo.src = videoUrl
  
  // Show modal using Metronic's modal system
  // Add the modal-open class to trigger Metronic CSS animations
  modal.setAttribute('data-kt-modal-show', 'true')
  modal.style.display = 'flex'
  document.body.classList.add('modal-open')
  
  // Auto-focus on video for keyboard controls
  setTimeout(() => modalVideo.focus(), 100)
}

function closeModal() {
  const modal = document.getElementById('video-modal')
  const modalVideo = document.getElementById('modal-video')
  
  if (!modal || !modalVideo) {
    console.error('Modal elements not found')
    return
  }
  
  modalVideo.pause()
  modalVideo.src = ''
  
  // Hide modal using Metronic's modal system
  modal.removeAttribute('data-kt-modal-show')
  modal.style.display = 'none'
  document.body.classList.remove('modal-open')
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
  
  // Update progress bar and percentage with smooth animation
  const progressFill = document.getElementById('progress-fill')
  const progressPercentage = document.getElementById('progress-percentage')
  
  if (progressFill && progressPercentage) {
    progressFill.style.width = `${percentage}%`
    progressPercentage.textContent = `${percentage}%`
  }
  
  // Update bytes transferred
  const loadedMB = (loaded / 1024 / 1024).toFixed(1)
  const totalMB = (total / 1024 / 1024).toFixed(1)
  const progressBytes = document.getElementById('progress-bytes')
  if (progressBytes) {
    progressBytes.textContent = `${loadedMB} MB / ${totalMB} MB`
  }
  
  // Calculate and display upload speed every second
  const timeDiff = (now - lastProgressTime) / 1000 // seconds
  if (timeDiff >= 1) {
    const bytesDiff = loaded - lastProgressBytes
    const speedBytesPerSecond = bytesDiff / timeDiff
    const speedMBPerSecond = (speedBytesPerSecond / 1024 / 1024).toFixed(1)
    
    const progressSpeed = document.getElementById('progress-speed')
    if (progressSpeed) {
      progressSpeed.textContent = `${speedMBPerSecond} MB/s`
    }
    
    // Calculate ETA
    if (speedBytesPerSecond > 0) {
      const remainingBytes = total - loaded
      const etaSeconds = Math.round(remainingBytes / speedBytesPerSecond)
      const etaMinutes = Math.floor(etaSeconds / 60)
      const etaSecondsRemainder = etaSeconds % 60
      const etaDisplay = `${etaMinutes}:${etaSecondsRemainder.toString().padStart(2, '0')}`
      const progressEta = document.getElementById('progress-eta')
      if (progressEta) {
        progressEta.textContent = etaDisplay
      }
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
    uploadText.innerHTML = `
      <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
      Uploading...
    `
    uploadSpinner.classList.remove('hidden')
    progressContainer.classList.remove('hidden')
    
    // Reset progress display
    document.getElementById('progress-fill').style.width = '0%'
    document.getElementById('progress-percentage').textContent = '0%'
    document.getElementById('progress-bytes').textContent = '0 MB / 0 MB'
    document.getElementById('progress-speed').textContent = '0 MB/s'
    document.getElementById('progress-eta').textContent = '--:--'
  } else {
    uploadText.innerHTML = `
      <i class="ki-filled ki-cloud-upload text-lg mr-2"></i>
      Upload Video
    `
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
  
  let alertClass = 'flex items-center gap-3 p-4 rounded-lg border'
  let icon = ''
  
  switch(type) {
    case 'success':
      alertClass += ' bg-green-50 border-green-200 text-green-800'
      icon = `<i class="ki-filled ki-check-circle text-xl text-green-600"></i>`
      break
    case 'error':
      alertClass += ' bg-red-50 border-red-200 text-red-800'
      icon = `<i class="ki-filled ki-cross-circle text-xl text-red-600"></i>`
      break
    case 'warning':
      alertClass += ' bg-yellow-50 border-yellow-200 text-yellow-800'
      icon = `<i class="ki-filled ki-warning text-xl text-yellow-600"></i>`
      break
    case 'info':
      alertClass += ' bg-blue-50 border-blue-200 text-blue-800'
      icon = `<i class="ki-filled ki-information text-xl text-blue-600"></i>`
      break
    default:
      alertClass += ' bg-blue-50 border-blue-200 text-blue-800'
      icon = `<i class="ki-filled ki-information text-xl text-blue-600"></i>`
  }
  
  statusDiv.className = alertClass
  statusDiv.innerHTML = `
    ${icon}
    <div class="flex-grow text-sm font-medium">${message}</div>
  `
  
  // Auto-clear success messages
  if (type === 'success') {
    setTimeout(() => {
      statusDiv.innerHTML = ''
      statusDiv.className = ''
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
