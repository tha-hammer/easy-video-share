// Authentication UI Components
import { authManager } from './auth.js';

export class AuthUI {
  constructor() {
    this.currentView = 'login'; // 'login', 'register', 'verify'
    this.pendingEmail = null;
    this.pendingUsername = null;
  }

  // Generate login form HTML
  generateLoginForm() {
    return `
      <div class="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4">
        <div class="card w-full max-w-md animate-fade-in">
          <div class="card-header text-center">
            <h2 class="text-2xl font-bold text-gray-900 mb-2">🎥 Easy Video Share</h2>
            <p class="text-gray-600">Sign in to your account</p>
          </div>
          
          <div class="card-body space-y-6">
            <!-- Password Login Form (Default) -->
            <form id="login-form" class="space-y-4">
              <div class="form-group">
                <label for="login-email" class="form-label">Email Address</label>
                <input 
                  type="email" 
                  id="login-email" 
                  name="email" 
                  class="form-input"
                  required 
                  placeholder="Enter your email"
                />
              </div>
              
              <div class="form-group">
                <label for="login-password" class="form-label">Password</label>
                <input 
                  type="password" 
                  id="login-password" 
                  name="password" 
                  class="form-input"
                  required 
                  placeholder="Enter your password"
                />
              </div>

              <button type="submit" class="btn btn-primary w-full">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m0 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"></path>
                </svg>
                Sign In with Password
              </button>
            </form>

            <!-- Divider -->
            <div class="relative">
              <div class="absolute inset-0 flex items-center">
                <div class="w-full border-t border-gray-300"></div>
              </div>
              <div class="relative flex justify-center text-sm">
                <span class="px-2 bg-white text-gray-500">OR</span>
              </div>
            </div>

            <!-- Passwordless Login Form -->
            <form id="passwordless-form" class="space-y-4">
              <div class="form-group">
                <label for="passwordless-email" class="form-label">Email for Passwordless Login</label>
                <input 
                  type="email" 
                  id="passwordless-email" 
                  name="email" 
                  class="form-input"
                  required 
                  placeholder="Enter your email"
                />
              </div>

              <button type="submit" class="btn btn-secondary w-full">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                </svg>
                Send Login Code
              </button>
            </form>

            <!-- Verification Code Form (Hidden Initially) -->
            <form id="passwordless-verify-form" class="space-y-4 hidden">
              <div class="form-group">
                <label for="passwordless-code" class="form-label">Verification Code</label>
                <input 
                  type="text" 
                  id="passwordless-code" 
                  name="code" 
                  class="form-input text-center text-lg tracking-widest"
                  required 
                  placeholder="000000"
                  maxlength="6"
                />
                <p class="text-xs text-gray-500 mt-1">Enter the 6-digit code sent to your email</p>
              </div>

              <div class="space-y-3">
                <button type="submit" class="btn btn-primary w-full">
                  <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  Verify & Sign In
                </button>
                <button type="button" id="back-to-passwordless" class="btn btn-secondary w-full">
                  <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                  </svg>
                  Back to Send Code
                </button>
              </div>
            </form>
            
            <div class="text-center">
              <p class="text-sm text-gray-600">
                Don't have an account? 
                <a href="#" id="show-register" class="text-primary-600 hover:text-primary-700 font-medium">Sign up here</a>
              </p>
            </div>
            
            <div id="auth-status" class=""></div>
          </div>
        </div>
      </div>
    `;
  }

  // Generate register form HTML
  generateRegisterForm() {
    return `
      <div class="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4">
        <div class="card w-full max-w-md animate-fade-in">
          <div class="card-header text-center">
            <h2 class="text-2xl font-bold text-gray-900 mb-2">🎥 Join Easy Video Share</h2>
            <p class="text-gray-600">Create your account</p>
          </div>
          
          <div class="card-body">
            <form id="register-form" class="space-y-4">
              <div class="form-group">
                <label for="register-email" class="form-label">Email Address</label>
                <input 
                  type="email" 
                  id="register-email" 
                  name="email" 
                  class="form-input"
                  required 
                  placeholder="Enter your email"
                />
              </div>
              
              <div class="form-group">
                <label for="register-password" class="form-label">Password</label>
                <input 
                  type="password" 
                  id="register-password" 
                  name="password" 
                  class="form-input"
                  required 
                  placeholder="Choose a strong password"
                  minlength="8"
                />
                <p class="text-xs text-gray-500 mt-1">
                  <svg class="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  Password must be at least 8 characters with uppercase, lowercase, number, and symbol
                </p>
              </div>

              <div class="form-group">
                <label for="register-name" class="form-label">Name (Optional)</label>
                <input 
                  type="text" 
                  id="register-name" 
                  name="name" 
                  class="form-input"
                  placeholder="Your name"
                />
              </div>

              <button type="submit" class="btn btn-primary w-full">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path>
                </svg>
                Create Account
              </button>
              
              <div class="text-center">
                <p class="text-sm text-gray-600">
                  Already have an account? 
                  <a href="#" id="show-login" class="text-primary-600 hover:text-primary-700 font-medium">Sign in here</a>
                </p>
              </div>
            </form>
            
            <div id="auth-status" class="mt-4"></div>
          </div>
        </div>
      </div>
    `;
  }

  // Generate verification form HTML
  generateVerificationForm() {
    return `
      <div class="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4">
        <div class="card w-full max-w-md animate-fade-in">
          <div class="card-header text-center">
            <div class="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
              </svg>
            </div>
            <h2 class="text-2xl font-bold text-gray-900 mb-2">📧 Verify Your Email</h2>
            <p class="text-gray-600">We've sent a verification code to</p>
            <p class="text-primary-600 font-medium">${this.pendingEmail}</p>
          </div>
          
          <div class="card-body">
            <form id="verify-form" class="space-y-4">
              <div class="form-group">
                <label for="verification-code" class="form-label">Verification Code</label>
                <input 
                  type="text" 
                  id="verification-code" 
                  name="code" 
                  class="form-input text-center text-lg tracking-widest"
                  required 
                  placeholder="000000"
                  maxlength="6"
                />
                <p class="text-xs text-gray-500 mt-1 text-center">Enter the 6-digit code from your email</p>
              </div>

              <button type="submit" class="btn btn-primary w-full">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                Verify Email
              </button>
              
              <div class="space-y-2 text-center">
                <p class="text-sm text-gray-600">
                  Didn't receive the code? 
                  <a href="#" id="resend-code" class="text-primary-600 hover:text-primary-700 font-medium">Resend verification code</a>
                </p>
                <p class="text-sm text-gray-600">
                  <a href="#" id="back-to-login" class="text-gray-500 hover:text-gray-700">← Back to login</a>
                </p>
              </div>
            </form>
            
            <div id="auth-status" class="mt-4"></div>
          </div>
        </div>
      </div>
    `;
  }

  // Show authentication UI
  show(view = 'login') {
    this.currentView = view;
    const appContainer = document.querySelector('#app');
    
    let html = '';
    switch (view) {
      case 'register':
        html = this.generateRegisterForm();
        break;
      case 'verify':
        html = this.generateVerificationForm();
        break;
      default:
        html = this.generateLoginForm();
    }
    
    appContainer.innerHTML = html;
    this.setupEventListeners();
    
    // Import metronic integration here to initialize any components
    import('./metronic-integration.js').then(({ metronicManager }) => {
      setTimeout(() => {
        metronicManager.initContainer(appContainer);
      }, 100);
    });
  }

  // Setup event listeners for auth forms
  setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', this.handleLogin.bind(this));
    }

    // Passwordless form
    const passwordlessForm = document.getElementById('passwordless-form');
    if (passwordlessForm) {
      passwordlessForm.addEventListener('submit', this.handlePasswordlessLogin.bind(this));
    }

    // Passwordless verification form
    const passwordlessVerifyForm = document.getElementById('passwordless-verify-form');
    if (passwordlessVerifyForm) {
      passwordlessVerifyForm.addEventListener('submit', this.handlePasswordlessVerification.bind(this));
    }

    // Register form
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
      registerForm.addEventListener('submit', this.handleRegister.bind(this));
    }

    // Verification form
    const verifyForm = document.getElementById('verify-form');
    if (verifyForm) {
      verifyForm.addEventListener('submit', this.handleVerification.bind(this));
    }

    // Navigation links
    const showRegister = document.getElementById('show-register');
    if (showRegister) {
      showRegister.addEventListener('click', (e) => {
        e.preventDefault();
        this.show('register');
      });
    }

    const showLogin = document.getElementById('show-login');
    if (showLogin) {
      showLogin.addEventListener('click', (e) => {
        e.preventDefault();
        this.show('login');
      });
    }

    const backToLogin = document.getElementById('back-to-login');
    if (backToLogin) {
      backToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        this.show('login');
      });
    }

    const resendCode = document.getElementById('resend-code');
    if (resendCode) {
      resendCode.addEventListener('click', this.handleResendCode.bind(this));
    }

    // Back to passwordless button
    const backToPasswordless = document.getElementById('back-to-passwordless');
    if (backToPasswordless) {
      backToPasswordless.addEventListener('click', this.handleBackToPasswordless.bind(this));
    }
  }

  // Handle login form submission
  async handleLogin(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const email = formData.get('email').trim();
    const password = formData.get('password');
    
    if (!email || !password) {
      this.showStatus('error', 'Please fill in all fields');
      return;
    }

    this.showStatus('info', 'Signing in...');
    
    const result = await authManager.login(email, password);
    
    if (result.success) {
      this.showStatus('success', result.message);
      // The main app will handle the redirect via auth state change
    } else if (result.needsVerification) {
      this.pendingEmail = email;
      this.show('verify');
      this.showStatus('error', result.error);
    } else {
      this.showStatus('error', result.error);
    }
  }

  // Handle register form submission
  async handleRegister(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const email = formData.get('email').trim();
    const password = formData.get('password');
    const name = formData.get('name').trim();
    
    if (!email || !password) {
      this.showStatus('error', 'Please fill in all required fields');
      return;
    }

    this.showStatus('info', 'Creating account...');
    
    const result = await authManager.register(email, password, name || null);
    
    if (result.success) {
      this.pendingEmail = email;
      this.pendingUsername = result.username; // Store the generated username
      this.show('verify');
      this.showStatus('success', result.message);
    } else {
      this.showStatus('error', result.error);
    }
  }

  // Handle verification form submission
  async handleVerification(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const code = formData.get('code').trim();
    
    if (!code) {
      this.showStatus('error', 'Please enter the verification code');
      return;
    }

    this.showStatus('info', 'Verifying...');
    
    const result = await authManager.confirmRegistration(this.pendingEmail, code);
    
    if (result.success) {
      this.showStatus('success', result.message);
      setTimeout(() => {
        this.show('login');
      }, 2000);
    } else {
      this.showStatus('error', result.error);
    }
  }

  // Handle resend verification code
  async handleResendCode(event) {
    event.preventDefault();
    
    this.showStatus('info', 'Sending verification code...');
    
    const result = await authManager.resendConfirmationCode(this.pendingEmail);
    
    if (result.success) {
      this.showStatus('success', result.message);
    } else {
      this.showStatus('error', result.error);
    }
  }

  // Handle passwordless login form submission
  async handlePasswordlessLogin(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const email = formData.get('email').trim();
    
    if (!email) {
      this.showStatus('error', 'Please enter your email');
      return;
    }

    this.showStatus('info', 'Sending login code...');
    
    const result = await authManager.startPasswordlessLogin(email);
    
    if (result.success) {
      this.showStatus('success', result.message);
      this.pendingEmail = email;
      
      // Show verification form and hide passwordless form
      const passwordlessForm = document.getElementById('passwordless-form');
      const verifyForm = document.getElementById('passwordless-verify-form');
      
      if (passwordlessForm && verifyForm) {
        passwordlessForm.classList.add('hidden');
        verifyForm.classList.remove('hidden');
      }
    } else {
      this.showStatus('error', result.error);
    }
  }

  // Handle passwordless verification form submission
  async handlePasswordlessVerification(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const code = formData.get('code').trim();
    
    if (!code) {
      this.showStatus('error', 'Please enter the verification code');
      return;
    }

    this.showStatus('info', 'Verifying code...');
    
    const result = await authManager.confirmPasswordlessLogin(code);
    
    if (result.success) {
      this.showStatus('success', result.message);
      // The main app will handle the redirect via auth state change
    } else {
      this.showStatus('error', result.error);
    }
  }

  // Handle back to passwordless button
  handleBackToPasswordless(event) {
    event.preventDefault();
    
    // Hide verification form and show passwordless form
    const passwordlessForm = document.getElementById('passwordless-form');
    const verifyForm = document.getElementById('passwordless-verify-form');
    
    if (passwordlessForm && verifyForm) {
      passwordlessForm.classList.remove('hidden');
      verifyForm.classList.add('hidden');
    }
    
    // Clear the verification code input
    const codeInput = document.getElementById('passwordless-code');
    if (codeInput) {
      codeInput.value = '';
    }
    
    // Clear status message
    this.showStatus('info', 'Enter your email to receive a new login code');
  }

  // Show status message
  showStatus(type, message) {
    const statusDiv = document.getElementById('auth-status');
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
          alertClass += ' alert-info';
          icon = `<svg class="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                 </svg>`;
          break;
        default:
          alertClass += ' alert-info';
      }
      
      statusDiv.className = alertClass;
      statusDiv.innerHTML = `
        <div class="flex items-start">
          ${icon}
          <div class="flex-1">${message}</div>
        </div>
      `;
      
      // Auto-clear success messages
      if (type === 'success') {
        setTimeout(() => {
          statusDiv.innerHTML = '';
          statusDiv.className = '';
        }, 5000);
      }
    }
  }
}

// Export singleton instance
export const authUI = new AuthUI(); 