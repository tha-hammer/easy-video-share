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
      
      // Initialize with users view
      this.switchView('users');
      
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
    console.log('Rendering admin dashboard...', appContainer);
    appContainer.innerHTML = this.getAdminHTML();
    console.log('Admin HTML rendered, setting up event listeners...');
    this.setupEventListeners();
    console.log('Admin dashboard ready');
  }

  // Get admin dashboard HTML
  getAdminHTML() {
    return `
      <div class="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <!-- Top Navigation -->
        <nav class="bg-white shadow-soft border-b border-gray-100">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between items-center h-16">
              <div class="flex items-center space-x-4">
                <div class="flex-shrink-0">
                  <h1 class="text-xl font-bold text-gradient">🔧 Admin Dashboard</h1>
                </div>
              </div>
              
              <div class="flex items-center space-x-4">
                <div class="flex items-center space-x-2">
                  <button id="admin-users-tab" class="btn btn-primary btn-sm admin-tab">
                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"></path>
                    </svg>
                    Users
                  </button>
                  <button id="admin-videos-tab" class="btn btn-secondary btn-sm admin-tab">
                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                    </svg>
                    All Videos
                  </button>
                  <button id="back-to-app" class="btn btn-secondary btn-sm">
                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                    </svg>
                    Back to App
                  </button>
                  <button id="admin-logout" class="btn btn-danger btn-sm">
                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                    </svg>
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </nav>

        <!-- Main Content -->
        <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <!-- Users View -->
          <div id="admin-users-view" class="admin-view block">
            <div class="card">
              <div class="card-header">
                <div class="flex justify-between items-center">
                  <div>
                    <h2 class="text-lg font-semibold text-gray-900 flex items-center">
                      <svg class="w-5 h-5 mr-2 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"></path>
                      </svg>
                      User Management
                    </h2>
                  </div>
                  <div class="badge badge-primary">
                    <span id="users-count">0 users</span>
                  </div>
                </div>
              </div>
              <div class="card-body p-0">
                <div id="users-list" class="divide-y divide-gray-100">
                  <div class="flex items-center justify-center py-12">
                    <div class="text-center">
                      <div class="spinner w-8 h-8 mx-auto mb-4"></div>
                      <p class="text-gray-500">Loading users...</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Videos View -->
          <div id="admin-videos-view" class="admin-view hidden">
            <div class="card">
              <div class="card-header">
                <div class="flex justify-between items-center">
                  <div>
                    <h2 class="text-lg font-semibold text-gray-900 flex items-center">
                      <svg class="w-5 h-5 mr-2 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                      </svg>
                      All Videos
                    </h2>
                  </div>
                  <div class="badge badge-primary">
                    <span id="videos-count">0 videos</span>
                  </div>
                </div>
              </div>
              <div class="card-body p-0">
                <div id="videos-list" class="divide-y divide-gray-100">
                  <div class="flex items-center justify-center py-12">
                    <div class="text-center">
                      <div class="spinner w-8 h-8 mx-auto mb-4"></div>
                      <p class="text-gray-500">Loading videos...</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- User Videos View -->
          <div id="user-videos-view" class="admin-view hidden">
            <div class="card">
              <div class="card-header">
                <div class="flex justify-between items-center">
                  <div>
                    <h2 class="text-lg font-semibold text-gray-900 flex items-center">
                      <svg class="w-5 h-5 mr-2 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                      </svg>
                      <span id="user-videos-title">User Videos</span>
                    </h2>
                  </div>
                  <div class="flex items-center space-x-2">
                    <div class="badge badge-primary">
                      <span id="user-videos-count">0 videos</span>
                    </div>
                    <button id="back-to-users" class="btn btn-secondary btn-sm">
                      <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                      </svg>
                      Back to Users
                    </button>
                  </div>
                </div>
              </div>
              <div class="card-body p-0">
                <div id="user-videos-list" class="divide-y divide-gray-100">
                  <div class="flex items-center justify-center py-12">
                    <div class="text-center">
                      <div class="spinner w-8 h-8 mx-auto mb-4"></div>
                      <p class="text-gray-500">Loading user videos...</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Admin Status Messages -->
          <div id="admin-status" class="mt-6"></div>
        </main>

        <!-- Video Modal -->
        <div id="video-modal" class="modal-overlay hidden">
          <div class="modal-container flex items-center justify-center px-4">
            <div class="modal-content w-full max-w-4xl">
              <div class="flex justify-between items-center p-6 border-b border-gray-200">
                <h3 id="modal-title" class="text-lg font-semibold text-gray-900">Video Title</h3>
                <button id="modal-close" class="text-gray-400 hover:text-gray-600 transition-colors">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
              <div class="p-6">
                <div class="aspect-video bg-black rounded-lg overflow-hidden">
                  <video id="modal-video" controls preload="metadata" class="w-full h-full">
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
    console.log('Switching to view:', view);
    
    // Hide all views
    const adminViews = document.querySelectorAll('.admin-view');
    console.log('Found admin views:', adminViews.length);
    adminViews.forEach(v => {
      v.classList.add('hidden');
      v.style.display = 'none'; // Fallback for CSS issues
    });
    
    // Reset tab styles
    document.querySelectorAll('.admin-tab').forEach(t => {
      t.classList.remove('btn-primary');
      t.classList.add('btn-secondary');
    });

    // Show selected view and update tab
    if (view === 'users') {
      const usersView = document.getElementById('admin-users-view');
      console.log('Users view element:', usersView);
      if (usersView) {
        usersView.classList.remove('hidden');
        usersView.style.display = 'block'; // Fallback for CSS issues
      }
      const usersTab = document.getElementById('admin-users-tab');
      if (usersTab) {
        usersTab.classList.remove('btn-secondary');
        usersTab.classList.add('btn-primary');
      }
      this.currentView = 'users';
    } else if (view === 'videos') {
      const videosView = document.getElementById('admin-videos-view');
      console.log('Videos view element:', videosView);
      if (videosView) {
        videosView.classList.remove('hidden');
        videosView.style.display = 'block'; // Fallback for CSS issues
      }
      const videosTab = document.getElementById('admin-videos-tab');
      if (videosTab) {
        videosTab.classList.remove('btn-secondary');
        videosTab.classList.add('btn-primary');
      }
      this.currentView = 'videos';
    } else if (view === 'user-videos') {
      const userVideosView = document.getElementById('user-videos-view');
      console.log('User videos view element:', userVideosView);
      if (userVideosView) {
        userVideosView.classList.remove('hidden');
        userVideosView.style.display = 'block'; // Fallback for CSS issues
      }
      this.currentView = 'user-videos';
    }
    
    console.log('Current view set to:', this.currentView);
  }

  // Load users data
  async loadUsers() {
    try {
      const users = await this.adminManager.fetchUsers();
      this.renderUsers(users);
      document.getElementById('users-count').textContent = `${users.length} users`;
    } catch (error) {
      this.showError('Failed to load users: ' + error.message);
      document.getElementById('users-list').innerHTML = `
        <div class="flex flex-col items-center justify-center py-12 px-6">
          <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <svg class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <h3 class="text-lg font-medium text-gray-900 mb-2">Failed to load users</h3>
          <p class="text-gray-500 text-center">There was an error loading the user list. Please try again.</p>
        </div>
      `;
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
      document.getElementById('videos-list').innerHTML = `
        <div class="flex flex-col items-center justify-center py-12 px-6">
          <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <svg class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <h3 class="text-lg font-medium text-gray-900 mb-2">Failed to load videos</h3>
          <p class="text-gray-500 text-center">There was an error loading the video list. Please try again.</p>
        </div>
      `;
    }
  }

  // Render users list
  renderUsers(users) {
    const container = document.getElementById('users-list');
    
    if (users.length === 0) {
      container.innerHTML = `
        <div class="flex flex-col items-center justify-center py-12 px-6">
          <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"></path>
            </svg>
          </div>
          <h3 class="text-lg font-medium text-gray-900 mb-2">No users found</h3>
          <p class="text-gray-500 text-center">There are no registered users in the system yet.</p>
        </div>
      `;
      return;
    }

    const html = users.map(user => `
      <div class="flex items-center justify-between p-6 hover:bg-gray-50 transition-colors duration-150">
        <div class="flex items-center space-x-4 flex-1">
          <div class="flex-shrink-0">
            <div class="w-12 h-12 bg-gradient-to-br from-primary-100 to-primary-200 rounded-full flex items-center justify-center">
              <svg class="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
              </svg>
            </div>
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="text-sm font-semibold text-gray-900 truncate">${user.email || user.username || 'N/A'}</h3>
            <div class="mt-1 flex items-center space-x-4 text-xs text-gray-500">
              <span class="flex items-center ${this.getStatusColor(user.status)}">
                <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <circle cx="10" cy="10" r="3"></circle>
                </svg>
                ${user.status || 'Unknown'}
              </span>
              <span class="flex items-center">
                <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
                ${this.adminManager.formatDate(user.created)}
              </span>
            </div>
          </div>
        </div>
        <div class="flex-shrink-0">
          <button 
            class="btn btn-primary btn-sm" 
            onclick="adminUI.viewUserVideos('${user.userId}', '${user.email || user.username}')"
          >
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
            </svg>
            View Videos
          </button>
        </div>
      </div>
    `).join('');

    container.innerHTML = html;
  }

  // Get status color based on user status
  getStatusColor(status) {
    switch(status?.toLowerCase()) {
      case 'confirmed':
      case 'enabled':
        return 'text-green-600';
      case 'unconfirmed':
      case 'disabled':
        return 'text-red-600';
      case 'force_change_password':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  }

  // Render all videos list
  renderAllVideos(videos) {
    const container = document.getElementById('videos-list');
    
    if (videos.length === 0) {
      container.innerHTML = `
        <div class="flex flex-col items-center justify-center py-12 px-6">
          <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
            </svg>
          </div>
          <h3 class="text-lg font-medium text-gray-900 mb-2">No videos found</h3>
          <p class="text-gray-500 text-center">There are no videos uploaded to the system yet.</p>
        </div>
      `;
      return;
    }

    const html = videos.map(video => `
      <div class="flex items-center justify-between p-6 hover:bg-gray-50 transition-colors duration-150">
        <div class="flex items-center space-x-4 flex-1">
          <div class="flex-shrink-0">
            <div class="w-12 h-12 bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg flex items-center justify-center">
              <svg class="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
              </svg>
            </div>
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="text-sm font-semibold text-gray-900 truncate">${video.title}</h3>
            <div class="mt-1 flex items-center space-x-4 text-xs text-gray-500">
              <span class="flex items-center">
                <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                </svg>
                ${video.user_email || video.user_id}
              </span>
              <span class="flex items-center">
                <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
                ${this.adminManager.formatDate(video.upload_date)}
              </span>
              <span class="flex items-center">
                <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
                </svg>
                ${this.adminManager.formatFileSize(video.file_size)}
              </span>
            </div>
          </div>
        </div>
        <div class="flex-shrink-0">
          <div class="flex items-center space-x-2">
            <button 
              class="btn btn-primary btn-sm" 
              onclick="adminUI.playVideo('${video.bucket_location}', '${video.title}')"
            >
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M15 14h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              Play
            </button>
            <button 
              class="btn btn-danger btn-sm" 
              onclick="adminUI.deleteVideo('${video.video_id}', '${video.bucket_location}', '${video.title}')"
            >
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
              Delete
            </button>
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
      document.getElementById('user-videos-list').innerHTML = `
        <div class="flex flex-col items-center justify-center py-12 px-6">
          <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <svg class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <h3 class="text-lg font-medium text-gray-900 mb-2">Failed to load user videos</h3>
          <p class="text-gray-500 text-center">There was an error loading this user's videos. Please try again.</p>
        </div>
      `;
    }
  }

  // Render user videos (same as all videos but without user info)
  renderUserVideos(videos) {
    const container = document.getElementById('user-videos-list');
    
    if (videos.length === 0) {
      container.innerHTML = `
        <div class="flex flex-col items-center justify-center py-12 px-6">
          <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
            </svg>
          </div>
          <h3 class="text-lg font-medium text-gray-900 mb-2">No videos found</h3>
          <p class="text-gray-500 text-center">This user hasn't uploaded any videos yet.</p>
        </div>
      `;
      return;
    }

    const html = videos.map(video => `
      <div class="flex items-center justify-between p-6 hover:bg-gray-50 transition-colors duration-150">
        <div class="flex items-center space-x-4 flex-1">
          <div class="flex-shrink-0">
            <div class="w-12 h-12 bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg flex items-center justify-center">
              <svg class="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
              </svg>
            </div>
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="text-sm font-semibold text-gray-900 truncate">${video.title}</h3>
            <div class="mt-1 flex items-center space-x-4 text-xs text-gray-500">
              <span class="flex items-center">
                <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
                ${this.adminManager.formatDate(video.upload_date)}
              </span>
              <span class="flex items-center">
                <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
                </svg>
                ${this.adminManager.formatFileSize(video.file_size)}
              </span>
            </div>
          </div>
        </div>
        <div class="flex-shrink-0">
          <div class="flex items-center space-x-2">
            <button 
              class="btn btn-primary btn-sm" 
              onclick="adminUI.playVideo('${video.bucket_location}', '${video.title}')"
            >
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M15 14h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              Play
            </button>
            <button 
              class="btn btn-danger btn-sm" 
              onclick="adminUI.deleteVideo('${video.video_id}', '${video.bucket_location}', '${video.title}')"
            >
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
              Delete
            </button>
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
    const statusDiv = document.getElementById('admin-status');
    if (statusDiv) {
      let alertClass = 'alert animate-slide-up';
      let icon = '';
      
      switch(type) {
        case 'success':
          alertClass += ' alert-success';
          icon = `<svg class="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                 </svg>`;
          break;
        case 'error':
          alertClass += ' alert-danger';
          icon = `<svg class="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                 </svg>`;
          break;
        case 'warning':
          alertClass += ' alert-warning';
          icon = `<svg class="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.268 16c-.77.833.192 2.5 1.732 2.5z"></path>
                 </svg>`;
          break;
        case 'info':
        default:
          alertClass += ' alert-info';
          icon = `<svg class="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                 </svg>`;
          break;
      }
      
      statusDiv.className = alertClass;
      statusDiv.innerHTML = `
        <div class="flex items-start">
          ${icon}
          <div class="flex-1">${message}</div>
        </div>
      `;
      
      setTimeout(() => {
        statusDiv.innerHTML = '';
        statusDiv.className = '';
      }, 5000);
    }
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