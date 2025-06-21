// Admin module for managing users and videos
import { API_CONFIG } from './config.js';
import { authManager } from './auth.js';

class AdminManager {
  constructor() {
    this.users = [];
    this.allVideos = [];
    this.selectedUserId = null;
    this.selectedUserVideos = [];
  }

  // Make authenticated API request
  async makeAdminRequest(url, options = {}) {
    try {
      const idToken = authManager.idToken;
      if (!idToken) {
        throw new Error('No authentication token available');
      }

      const headers = {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json',
        ...options.headers
      };

      const response = await fetch(url, {
        ...options,
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Admin API request failed:', error);
      throw error;
    }
  }

  // Fetch all users
  async fetchUsers() {
    try {
      const data = await this.makeAdminRequest(API_CONFIG.adminUsersEndpoint);
      this.users = data.users || [];
      return this.users;
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  }

  // Fetch all videos
  async fetchAllVideos() {
    try {
      const data = await this.makeAdminRequest(API_CONFIG.adminVideosEndpoint);
      this.allVideos = data.videos || [];
      return this.allVideos;
    } catch (error) {
      console.error('Error fetching all videos:', error);
      throw error;
    }
  }

  // Fetch videos for a specific user
  async fetchUserVideos(userId) {
    try {
      const url = `${API_CONFIG.adminUsersEndpoint}/${userId}/videos`;
      const data = await this.makeAdminRequest(url);
      this.selectedUserId = userId;
      this.selectedUserVideos = data.videos || [];
      return this.selectedUserVideos;
    } catch (error) {
      console.error('Error fetching user videos:', error);
      throw error;
    }
  }

  // Delete a video
  async deleteVideo(videoId, bucketLocation) {
    try {
      const data = await this.makeAdminRequest(API_CONFIG.adminVideosEndpoint, {
        method: 'DELETE',
        body: JSON.stringify({
          videoId: videoId,
          bucketLocation: bucketLocation
        })
      });
      
      // Remove from local arrays
      this.allVideos = this.allVideos.filter(v => v.video_id !== videoId);
      this.selectedUserVideos = this.selectedUserVideos.filter(v => v.video_id !== videoId);
      
      return data;
    } catch (error) {
      console.error('Error deleting video:', error);
      throw error;
    }
  }

  // Get user by ID
  getUserById(userId) {
    return this.users.find(user => user.userId === userId);
  }

  // Format date for display
  formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return dateString;
    }
  }

  // Format file size
  formatFileSize(bytes) {
    if (!bytes) return 'N/A';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
}

// Admin UI Manager
class AdminUI {
  constructor() {
    this.adminManager = new AdminManager();
    this.currentView = 'users'; // 'users', 'videos', 'user-videos'
  }

  // Show admin dashboard
  async show() {
    try {
      // Verify admin access
      if (!authManager.isAdmin) {
        throw new Error('Admin access required');
      }

      // Render admin UI
      this.renderAdminDashboard();
      
      // Load initial data
      await this.loadUsers();
      await this.loadAllVideos();
      
    } catch (error) {
      console.error('Error showing admin dashboard:', error);
      this.showError(error.message);
    }
  }

  // Render the admin dashboard HTML
  renderAdminDashboard() {
    const appContainer = document.querySelector('#app');
    appContainer.innerHTML = this.getAdminHTML();
    this.setupEventListeners();
  }

  // Get admin dashboard HTML
  getAdminHTML() {
    return `
      <div class="admin-container">
        <!-- Header -->
        <header class="header bg-primary text-white">
          <div class="container-fluid">
            <div class="d-flex justify-content-between align-items-center">
              <h1 class="mb-0">
                <i class="bi bi-gear me-2"></i>Admin Dashboard
              </h1>
              <div class="d-flex gap-2">
                <button id="admin-users-tab" class="btn btn-outline-light btn-sm active">
                  <i class="bi bi-people me-1"></i>Users
                </button>
                <button id="admin-videos-tab" class="btn btn-outline-light btn-sm">
                  <i class="bi bi-collection-play me-1"></i>All Videos
                </button>
                <button id="back-to-app" class="btn btn-light btn-sm">
                  <i class="bi bi-arrow-left me-1"></i>Back to App
                </button>
                <button id="admin-logout" class="btn btn-danger btn-sm">
                  <i class="bi bi-box-arrow-right me-1"></i>Logout
                </button>
              </div>
            </div>
          </div>
        </header>

        <!-- Main Content -->
        <main class="container-fluid py-4">
          <!-- Users View -->
          <div id="admin-users-view" class="admin-view active">
            <div class="d-flex justify-content-between align-items-center mb-4">
              <h2 class="mb-0">
                <i class="bi bi-people me-2"></i>User Management
              </h2>
              <div class="badge bg-primary fs-6" id="users-count">0 users</div>
            </div>
            <div id="users-list" class="row g-3">
              <div class="col-12 text-center py-5">
                <div class="spinner-border text-primary" role="status">
                  <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2 text-muted">Loading users...</p>
              </div>
            </div>
          </div>

          <!-- All Videos View -->
          <div id="admin-videos-view" class="admin-view">
            <div class="d-flex justify-content-between align-items-center mb-4">
              <h2 class="mb-0">
                <i class="bi bi-collection-play me-2"></i>All Videos
              </h2>
              <div class="badge bg-primary fs-6" id="videos-count">0 videos</div>
            </div>
            <div id="videos-list" class="row g-3">
              <div class="col-12 text-center py-5">
                <div class="spinner-border text-primary" role="status">
                  <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2 text-muted">Loading videos...</p>
              </div>
            </div>
          </div>

          <!-- User Videos View -->
          <div id="user-videos-view" class="admin-view">
            <div class="d-flex justify-content-between align-items-center mb-4">
              <div class="d-flex align-items-center gap-3">
                <h2 class="mb-0" id="user-videos-title">User Videos</h2>
                <button id="back-to-users" class="btn btn-outline-secondary btn-sm">
                  <i class="bi bi-arrow-left me-1"></i>Back to Users
                </button>
              </div>
              <div class="badge bg-primary fs-6" id="user-videos-count">0 videos</div>
            </div>
            <div id="user-videos-list" class="row g-3">
              <div class="col-12 text-center py-5">
                <div class="spinner-border text-primary" role="status">
                  <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2 text-muted">Loading user videos...</p>
              </div>
            </div>
          </div>
        </main>

        <!-- Status Alert -->
        <div id="admin-status" class="position-fixed bottom-0 start-50 translate-middle-x mb-3" style="z-index: 1050; display: none;">
        </div>

                 <!-- Video Modal -->
         <div class="modal fade" id="video-modal" tabindex="-1" aria-labelledby="video-modal-title" aria-hidden="true">
           <div class="modal-dialog modal-dialog-centered" style="max-width: 90vw; max-height: 90vh;">
             <div class="modal-content" style="max-height: 90vh; overflow: hidden;">
               <div class="modal-header">
                 <h5 class="modal-title" id="modal-title">
                   <i class="bi bi-play-circle me-2"></i>Video Player
                 </h5>
                 <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
               </div>
               <div class="modal-body p-0" style="max-height: calc(90vh - 60px); overflow: hidden;">
                 <div class="modal-video-container" style="position: relative; width: 100%;">
                   <video id="modal-video" controls preload="metadata" 
                          style="width: 100%; max-width: 100%; max-height: calc(90vh - 60px); object-fit: contain; background: #000; display: block;">
                     Your browser does not support the video tag.
                   </video>
                 </div>
               </div>
             </div>
           </div>
         </div>
      </div>
    `;
  }

  // Setup event listeners
  setupEventListeners() {
    // Tab navigation
    document.getElementById('admin-users-tab').addEventListener('click', () => {
      this.switchView('users');
    });
    
    document.getElementById('admin-videos-tab').addEventListener('click', () => {
      this.switchView('videos');
    });

    // Back to app
    document.getElementById('back-to-app').addEventListener('click', () => {
      this.backToMainApp();
    });

    // Back to users from user videos
    document.getElementById('back-to-users').addEventListener('click', () => {
      this.switchView('users');
    });

    // Logout
    document.getElementById('admin-logout').addEventListener('click', () => {
      authManager.logout();
    });

    // Modal controls (reuse from main app)
    const modal = document.getElementById('video-modal');
    const modalClose = document.getElementById('modal-close');
    
    if (modalClose) modalClose.addEventListener('click', () => {
      if (typeof window.closeModal === 'function') {
        window.closeModal();
      }
    });
    
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal && typeof window.closeModal === 'function') {
          window.closeModal();
        }
      });
    }
  }

  // Switch between views
  switchView(view) {
    // Hide all views
    document.querySelectorAll('.admin-view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));

    // Show selected view
    if (view === 'users') {
      document.getElementById('admin-users-view').classList.add('active');
      document.getElementById('admin-users-tab').classList.add('active');
      this.currentView = 'users';
    } else if (view === 'videos') {
      document.getElementById('admin-videos-view').classList.add('active');
      document.getElementById('admin-videos-tab').classList.add('active');
      this.currentView = 'videos';
    } else if (view === 'user-videos') {
      document.getElementById('user-videos-view').classList.add('active');
      this.currentView = 'user-videos';
    }
  }

  // Load users data
  async loadUsers() {
    try {
      const users = await this.adminManager.fetchUsers();
      this.renderUsers(users);
      document.getElementById('users-count').textContent = `${users.length} users`;
    } catch (error) {
      this.showError('Failed to load users: ' + error.message);
      document.getElementById('users-list').innerHTML = '<div class="error">Failed to load users</div>';
    }
  }

  // Load all videos data
  async loadAllVideos() {
    try {
      const videos = await this.adminManager.fetchAllVideos();
      this.renderAllVideos(videos);
      document.getElementById('videos-count').textContent = `${videos.length} videos`;
    } catch (error) {
      this.showError('Failed to load videos: ' + error.message);
      document.getElementById('videos-list').innerHTML = '<div class="error">Failed to load videos</div>';
    }
  }

  // Render users list
  renderUsers(users) {
    const container = document.getElementById('users-list');
    
    if (users.length === 0) {
      container.innerHTML = `
        <div class="col-12">
          <div class="text-center py-5">
            <i class="bi bi-people display-1 text-muted"></i>
            <h4 class="mt-3 text-muted">No users found</h4>
            <p class="text-muted">Users will appear here once they register</p>
          </div>
        </div>
      `;
      return;
    }

    const html = users.map(user => `
      <div class="col-12 col-md-6 col-lg-4">
        <div class="card h-100">
          <div class="card-body">
            <div class="d-flex align-items-center mb-3">
              <div class="flex-shrink-0">
                <i class="bi bi-person-circle display-6 text-primary"></i>
              </div>
              <div class="flex-grow-1 ms-3">
                <h5 class="card-title mb-1">${user.email || 'N/A'}</h5>
                <span class="badge bg-${user.status?.toLowerCase() === 'confirmed' ? 'success' : 'warning'} mb-1">
                  ${user.status || 'Unknown'}
                </span>
              </div>
            </div>
            <p class="card-text">
              <small class="text-muted">
                <i class="bi bi-calendar me-1"></i>
                Created: ${this.adminManager.formatDate(user.created)}
              </small>
            </p>
          </div>
          <div class="card-footer bg-transparent">
            <button class="btn btn-primary btn-sm w-100" onclick="adminUI.viewUserVideos('${user.userId}', '${user.email}')">
              <i class="bi bi-collection-play me-1"></i>View Videos
            </button>
          </div>
        </div>
      </div>
    `).join('');

    container.innerHTML = html;
  }

  // Render all videos list
  renderAllVideos(videos) {
    const container = document.getElementById('videos-list');
    
    if (videos.length === 0) {
      container.innerHTML = `
        <div class="col-12">
          <div class="text-center py-5">
            <i class="bi bi-collection-play display-1 text-muted"></i>
            <h4 class="mt-3 text-muted">No videos found</h4>
            <p class="text-muted">Videos will appear here once users start uploading</p>
          </div>
        </div>
      `;
      return;
    }

    const html = videos.map(video => `
      <div class="col-12 col-md-6 col-lg-4">
        <div class="card h-100">
          <div class="card-body">
            <div class="d-flex align-items-start mb-3">
              <div class="flex-shrink-0">
                <i class="bi bi-play-circle-fill display-6 text-primary"></i>
              </div>
              <div class="flex-grow-1 ms-3">
                <h5 class="card-title">${video.title}</h5>
                <p class="card-text text-muted mb-2">
                  <i class="bi bi-person me-1"></i>${video.user_email || video.user_id}
                </p>
                <div class="d-flex flex-wrap gap-2">
                  <small class="text-muted">
                    <i class="bi bi-calendar me-1"></i>
                    ${this.adminManager.formatDate(video.upload_date)}
                  </small>
                  <small class="text-muted">
                    <i class="bi bi-hdd me-1"></i>
                    ${this.adminManager.formatFileSize(video.file_size)}
                  </small>
                </div>
              </div>
            </div>
          </div>
          <div class="card-footer bg-transparent">
            <div class="d-flex gap-2">
              <button class="btn btn-success btn-sm flex-fill" onclick="adminUI.playVideo('${video.bucket_location}', '${video.title}')">
                <i class="bi bi-play me-1"></i>Play
              </button>
              <button class="btn btn-danger btn-sm" onclick="adminUI.deleteVideo('${video.video_id}', '${video.bucket_location}', '${video.title}')">
                <i class="bi bi-trash me-1"></i>Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    `).join('');

    container.innerHTML = html;
  }

  // View videos for a specific user
  async viewUserVideos(userId, userEmail) {
    try {
      this.switchView('user-videos');
      document.getElementById('user-videos-title').textContent = `Videos by ${userEmail}`;
      
      const videos = await this.adminManager.fetchUserVideos(userId);
      this.renderUserVideos(videos);
      document.getElementById('user-videos-count').textContent = `${videos.length} videos`;
    } catch (error) {
      this.showError('Failed to load user videos: ' + error.message);
      document.getElementById('user-videos-list').innerHTML = '<div class="error">Failed to load user videos</div>';
    }
  }

  // Render user videos (same as all videos but without user info)
  renderUserVideos(videos) {
    const container = document.getElementById('user-videos-list');
    
    if (videos.length === 0) {
      container.innerHTML = `
        <div class="col-12">
          <div class="text-center py-5">
            <i class="bi bi-collection-play display-1 text-muted"></i>
            <h4 class="mt-3 text-muted">No videos found</h4>
            <p class="text-muted">This user hasn't uploaded any videos yet</p>
          </div>
        </div>
      `;
      return;
    }

    const html = videos.map(video => `
      <div class="col-12 col-md-6 col-lg-4">
        <div class="card h-100">
          <div class="card-body">
            <div class="d-flex align-items-start mb-3">
              <div class="flex-shrink-0">
                <i class="bi bi-play-circle-fill display-6 text-primary"></i>
              </div>
              <div class="flex-grow-1 ms-3">
                <h5 class="card-title">${video.title}</h5>
                <div class="d-flex flex-wrap gap-2">
                  <small class="text-muted">
                    <i class="bi bi-calendar me-1"></i>
                    ${this.adminManager.formatDate(video.upload_date)}
                  </small>
                  <small class="text-muted">
                    <i class="bi bi-hdd me-1"></i>
                    ${this.adminManager.formatFileSize(video.file_size)}
                  </small>
                </div>
              </div>
            </div>
          </div>
          <div class="card-footer bg-transparent">
            <div class="d-flex gap-2">
              <button class="btn btn-success btn-sm flex-fill" onclick="adminUI.playVideo('${video.bucket_location}', '${video.title}')">
                <i class="bi bi-play me-1"></i>Play
              </button>
              <button class="btn btn-danger btn-sm" onclick="adminUI.deleteVideo('${video.video_id}', '${video.bucket_location}', '${video.title}')">
                <i class="bi bi-trash me-1"></i>Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    `).join('');

    container.innerHTML = html;
  }

  // Play video (reuse existing modal functionality)
  playVideo(bucketLocation, title) {
    // Convert bucket location to proper HTTPS URL
    let playableUrl = bucketLocation;
    
    // If it's already a full URL, use as-is
    if (bucketLocation.startsWith('http://') || bucketLocation.startsWith('https://')) {
      playableUrl = bucketLocation;
    } 
    // If it's an S3 path like "videos/filename.mp4", construct the full URL
    else if (!bucketLocation.includes('://')) {
      // Get bucket name from config
      const bucketName = import.meta.env.VITE_AWS_BUCKET_NAME;
      playableUrl = `https://${bucketName}.s3.amazonaws.com/${bucketLocation}`;
    }
    // If it's s3:// format, convert to HTTPS
    else if (bucketLocation.startsWith('s3://')) {
      const s3Path = bucketLocation.replace('s3://', '');
      const parts = s3Path.split('/');
      const bucket = parts[0];
      const key = parts.slice(1).join('/');
      playableUrl = `https://${bucket}.s3.amazonaws.com/${key}`;
    }
    
    console.log('Playing video:', { bucketLocation, playableUrl });
    
    // Use existing modal function if available
    if (typeof window.openVideoModal === 'function') {
      window.openVideoModal(playableUrl, title);
    } else {
      // Fallback - open in new tab
      window.open(playableUrl, '_blank');
    }
  }

  // Delete video with confirmation
  async deleteVideo(videoId, bucketLocation, title) {
    if (!confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
      return;
    }

    try {
      this.showStatus('Deleting video...', 'info');
      
      await this.adminManager.deleteVideo(videoId, bucketLocation);
      
      this.showStatus('Video deleted successfully', 'success');
      
      // Refresh current view
      if (this.currentView === 'videos') {
        await this.loadAllVideos();
      } else if (this.currentView === 'user-videos') {
        await this.viewUserVideos(this.adminManager.selectedUserId, 'User');
      }
      
    } catch (error) {
      this.showError('Failed to delete video: ' + error.message);
    }
  }

  // Back to main app
  async backToMainApp() {
    try {
      // Re-initialize main app
      if (typeof window.initializeMainApp === 'function') {
        await window.initializeMainApp();
        
        // Ensure user state is properly restored
        // Force update of currentUser variable in main.js
        if (typeof window.updateCurrentUserFromAuth === 'function') {
          await window.updateCurrentUserFromAuth();
        }
      } else {
        // Fallback - reload page
        window.location.reload();
      }
    } catch (error) {
      console.error('Error returning to main app:', error);
      // Fallback - reload page
      window.location.reload();
    }
  }

  // Show status message
  showStatus(message, type = 'info') {
    const statusEl = document.getElementById('admin-status');
    
    const alertClass = type === 'error' ? 'danger' : type;
    const iconClass = type === 'success' ? 'check-circle' : 
                     type === 'error' ? 'exclamation-triangle' : 
                     'info-circle';
    
    statusEl.innerHTML = `
      <div class="alert alert-${alertClass} alert-dismissible fade show" role="alert">
        <i class="bi bi-${iconClass} me-2"></i>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>
    `;
    statusEl.style.display = 'block';
    
    // Auto-hide after 4 seconds
    setTimeout(() => {
      const alert = statusEl.querySelector('.alert');
      if (alert) {
        alert.classList.remove('show');
        setTimeout(() => {
          statusEl.style.display = 'none';
          statusEl.innerHTML = '';
        }, 150);
      }
    }, 4000);
  }

  // Show error message
  showError(message) {
    this.showStatus(message, 'error');
  }
}

// Create global instances
export const adminManager = new AdminManager();
export const adminUI = new AdminUI();

// Make adminUI globally available for onclick handlers
window.adminUI = adminUI; 