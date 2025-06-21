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
        <header class="admin-header">
          <h1>🔧 Admin Dashboard</h1>
          <div class="admin-nav">
            <button id="admin-users-tab" class="admin-tab active">Users</button>
            <button id="admin-videos-tab" class="admin-tab">All Videos</button>
            <button id="back-to-app" class="back-btn">← Back to App</button>
            <button id="admin-logout" class="logout-btn">Logout</button>
          </div>
        </header>

        <main class="admin-main">
          <div id="admin-users-view" class="admin-view active">
            <div class="view-header">
              <h2>User Management</h2>
              <div class="view-stats">
                <span id="users-count">0 users</span>
              </div>
            </div>
            <div id="users-list" class="users-list">
              <div class="loading">Loading users...</div>
            </div>
          </div>

          <div id="admin-videos-view" class="admin-view">
            <div class="view-header">
              <h2>All Videos</h2>
              <div class="view-stats">
                <span id="videos-count">0 videos</span>
              </div>
            </div>
            <div id="videos-list" class="videos-list">
              <div class="loading">Loading videos...</div>
            </div>
          </div>

          <div id="user-videos-view" class="admin-view">
            <div class="view-header">
              <div class="view-title-section">
                <h2 id="user-videos-title">User Videos</h2>
                <button id="back-to-users" class="back-btn">← Back to Users</button>
              </div>
              <div class="view-stats">
                <span id="user-videos-count">0 videos</span>
              </div>
            </div>
            <div id="user-videos-list" class="videos-list">
              <div class="loading">Loading user videos...</div>
            </div>
          </div>
        </main>

        <div id="admin-status" class="admin-status"></div>

        <!-- Video Modal (shared with main app) -->
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
      container.innerHTML = '<div class="empty-state">No users found</div>';
      return;
    }

    const html = users.map(user => `
      <div class="user-card">
        <div class="user-info">
          <div class="user-email">${user.email || 'N/A'}</div>
          <div class="user-details">
            <span class="user-status status-${user.status?.toLowerCase()}">${user.status}</span>
            <span class="user-created">Created: ${this.adminManager.formatDate(user.created)}</span>
          </div>
        </div>
        <div class="user-actions">
          <button class="view-videos-btn" onclick="adminUI.viewUserVideos('${user.userId}', '${user.email}')">
            View Videos
          </button>
        </div>
      </div>
    `).join('');

    container.innerHTML = html;
  }

  // Render all videos list
  renderAllVideos(videos) {
    const container = document.getElementById('videos-list');
    
    if (videos.length === 0) {
      container.innerHTML = '<div class="empty-state">No videos found</div>';
      return;
    }

    const html = videos.map(video => `
      <div class="video-card">
        <div class="video-info">
          <div class="video-title">${video.title}</div>
          <div class="video-details">
            <span class="video-user">User: ${video.user_email || video.user_id}</span>
            <span class="video-date">Uploaded: ${this.adminManager.formatDate(video.upload_date)}</span>
            <span class="video-size">Size: ${this.adminManager.formatFileSize(video.file_size)}</span>
          </div>
        </div>
        <div class="video-actions">
          <button class="play-btn" onclick="adminUI.playVideo('${video.bucket_location}', '${video.title}')">
            ▶️ Play
          </button>
          <button class="delete-btn" onclick="adminUI.deleteVideo('${video.video_id}', '${video.bucket_location}', '${video.title}')">
            🗑️ Delete
          </button>
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
      container.innerHTML = '<div class="empty-state">No videos found for this user</div>';
      return;
    }

    const html = videos.map(video => `
      <div class="video-card">
        <div class="video-info">
          <div class="video-title">${video.title}</div>
          <div class="video-details">
            <span class="video-date">Uploaded: ${this.adminManager.formatDate(video.upload_date)}</span>
            <span class="video-size">Size: ${this.adminManager.formatFileSize(video.file_size)}</span>
          </div>
        </div>
        <div class="video-actions">
          <button class="play-btn" onclick="adminUI.playVideo('${video.bucket_location}', '${video.title}')">
            ▶️ Play
          </button>
          <button class="delete-btn" onclick="adminUI.deleteVideo('${video.video_id}', '${video.bucket_location}', '${video.title}')">
            🗑️ Delete
          </button>
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
  backToMainApp() {
    // Re-initialize main app
    if (typeof initializeMainApp === 'function') {
      initializeMainApp();
    } else {
      // Fallback - reload page
      window.location.reload();
    }
  }

  // Show status message
  showStatus(message, type = 'info') {
    const statusEl = document.getElementById('admin-status');
    statusEl.textContent = message;
    statusEl.className = `admin-status ${type}`;
    statusEl.style.display = 'block';
    
    setTimeout(() => {
      statusEl.style.display = 'none';
    }, 3000);
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