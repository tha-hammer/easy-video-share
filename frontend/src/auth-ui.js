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
      <div class="auth-container">
        <div class="auth-card">
          <div class="text-center mb-4">
            <h2 class="mb-3">
              <i class="bi bi-camera-video text-primary me-2"></i>
              Sign In to Easy Video Share
            </h2>
            <p class="text-muted">Welcome back! Please sign in to your account</p>
          </div>
          
          <!-- Passwordless Login Form -->
          <form id="passwordless-form" class="auth-form">
            <div class="form-group">
              <label class="form-label required" for="passwordless-email">
                <i class="bi bi-envelope me-1"></i>Email for Passwordless Login
              </label>
              <input 
                type="email" 
                id="passwordless-email" 
                name="email" 
                class="form-control"
                required 
                placeholder="Enter your email address"
              />
            </div>

            <button type="submit" class="btn btn-primary w-100 mb-3">
              <i class="bi bi-send me-2"></i>Send Login Code
            </button>
          </form>

          <!-- Verification Code Form (Hidden Initially) -->
          <form id="passwordless-verify-form" class="auth-form d-none">
            <div class="form-group">
              <label class="form-label required" for="passwordless-code">
                <i class="bi bi-shield-check me-1"></i>Verification Code
              </label>
              <input 
                type="text" 
                id="passwordless-code" 
                name="code" 
                class="form-control text-center"
                required 
                placeholder="Enter 6-digit code"
                maxlength="6"
                style="letter-spacing: 0.5rem; font-size: 1.2rem;"
              />
              <small class="form-text text-muted">
                <i class="bi bi-info-circle me-1"></i>Check your email for the verification code
              </small>
            </div>

            <button type="submit" class="btn btn-success w-100 mb-2">
              <i class="bi bi-check-circle me-2"></i>Verify & Sign In
            </button>
            <button type="button" id="back-to-passwordless" class="btn btn-light w-100">
              <i class="bi bi-arrow-left me-2"></i>Back to Send Code
            </button>
          </form>
          
          <div class="text-center mt-4">
            <p class="mb-2">Don't have an account?</p>
            <a href="#" id="show-register" class="btn btn-outline-primary">
              <i class="bi bi-person-plus me-2"></i>Create Account
            </a>
          </div>
          
          <div id="auth-status" class="status-message mt-3"></div>
        </div>
      </div>
    `;
  }

  // Generate register form HTML
  generateRegisterForm() {
    return `
      <div class="auth-container">
        <div class="auth-card">
          <div class="text-center mb-4">
            <h2 class="mb-3">
              <i class="bi bi-camera-video text-primary me-2"></i>
              Join Easy Video Share
            </h2>
            <p class="text-muted">Create your account to start sharing videos</p>
          </div>
          
          <form id="register-form" class="auth-form">
            <div class="form-group">
              <label class="form-label required" for="register-email">
                <i class="bi bi-envelope me-1"></i>Email Address
              </label>
              <input 
                type="email" 
                id="register-email" 
                name="email" 
                class="form-control"
                required 
                placeholder="Enter your email address"
              />
            </div>
            
            <div class="form-group">
              <label class="form-label required" for="register-password">
                <i class="bi bi-lock me-1"></i>Password
              </label>
              <input 
                type="password" 
                id="register-password" 
                name="password" 
                class="form-control"
                required 
                placeholder="Choose a strong password"
                minlength="8"
              />
              <div class="form-text">
                <small class="text-muted">
                  <i class="bi bi-info-circle me-1"></i>
                  Password must be at least 8 characters with uppercase, lowercase, number, and symbol
                </small>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="register-name">
                <i class="bi bi-person me-1"></i>Full Name (Optional)
              </label>
              <input 
                type="text" 
                id="register-name" 
                name="name" 
                class="form-control"
                placeholder="Your full name"
              />
            </div>

            <button type="submit" class="btn btn-primary w-100 mb-3">
              <i class="bi bi-person-plus me-2"></i>Create Account
            </button>
            
            <div class="text-center">
              <p class="mb-2">Already have an account?</p>
              <a href="#" id="show-login" class="btn btn-outline-primary">
                <i class="bi bi-box-arrow-in-right me-2"></i>Sign In
              </a>
            </div>
          </form>
          
          <div id="auth-status" class="status-message mt-3"></div>
        </div>
      </div>
    `;
  }

  // Generate verification form HTML
  generateVerificationForm() {
    return `
      <div class="auth-container">
        <div class="auth-card">
          <div class="text-center mb-4">
            <div class="mb-3">
              <i class="bi bi-envelope-check text-primary" style="font-size: 3rem;"></i>
            </div>
            <h2 class="mb-3">Verify Your Email</h2>
            <div class="alert alert-info border-0" role="alert">
              <i class="bi bi-info-circle me-2"></i>
              We've sent a verification code to <strong>${this.pendingEmail}</strong>
            </div>
          </div>
          
          <form id="verify-form" class="auth-form">
            <div class="form-group">
              <label class="form-label required" for="verification-code">
                <i class="bi bi-shield-check me-1"></i>Verification Code
              </label>
              <input 
                type="text" 
                id="verification-code" 
                name="code" 
                class="form-control text-center"
                required 
                placeholder="Enter 6-digit code"
                maxlength="6"
                style="letter-spacing: 0.5rem; font-size: 1.2rem;"
              />
            </div>

            <button type="submit" class="btn btn-success w-100 mb-3">
              <i class="bi bi-check-circle me-2"></i>Verify Email
            </button>
            
            <div class="text-center">
              <p class="mb-2">Didn't receive the code?</p>
              <a href="#" id="resend-code" class="btn btn-outline-secondary btn-sm me-2">
                <i class="bi bi-arrow-clockwise me-1"></i>Resend Code
              </a>
              <a href="#" id="back-to-login" class="btn btn-light btn-sm">
                <i class="bi bi-arrow-left me-1"></i>Back to Login
              </a>
            </div>
          </form>
          
          <div id="auth-status" class="status-message mt-3"></div>
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
    
    // Initialize Bootstrap tooltips if needed
    this.initializeBootstrapComponents();
  }

  // Initialize Bootstrap components
  initializeBootstrapComponents() {
    // Focus on first input
    const firstInput = document.querySelector('.auth-form input');
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 100);
    }
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

    // Auto-format verification code inputs
    const codeInputs = document.querySelectorAll('input[maxlength="6"]');
    codeInputs.forEach(input => {
      input.addEventListener('input', (e) => {
        // Auto-uppercase and filter only alphanumeric
        e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      });
    });
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
    this.setFormLoading(event.target, true);
    
    const result = await authManager.login(email, password);
    
    this.setFormLoading(event.target, false);
    
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
    this.setFormLoading(event.target, true);
    
    const result = await authManager.register(email, password, name || null);
    
    this.setFormLoading(event.target, false);
    
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
    this.setFormLoading(event.target, true);
    
    const result = await authManager.confirmRegistration(this.pendingEmail, code);
    
    this.setFormLoading(event.target, false);
    
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
    this.setFormLoading(event.target, true);
    
    const result = await authManager.startPasswordlessLogin(email);
    
    this.setFormLoading(event.target, false);
    
    if (result.success) {
      this.showStatus('success', result.message);
      this.pendingEmail = email;
      
      // Show verification form and hide passwordless form
      const passwordlessForm = document.getElementById('passwordless-form');
      const verifyForm = document.getElementById('passwordless-verify-form');
      
      if (passwordlessForm && verifyForm) {
        passwordlessForm.classList.add('d-none');
        verifyForm.classList.remove('d-none');
        
        // Focus on code input
        const codeInput = document.getElementById('passwordless-code');
        if (codeInput) {
          setTimeout(() => codeInput.focus(), 100);
        }
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
    this.setFormLoading(event.target, true);
    
    const result = await authManager.confirmPasswordlessLogin(code);
    
    this.setFormLoading(event.target, false);
    
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
      passwordlessForm.classList.remove('d-none');
      verifyForm.classList.add('d-none');
    }
    
    // Clear the verification code input
    const codeInput = document.getElementById('passwordless-code');
    if (codeInput) {
      codeInput.value = '';
    }
    
    // Clear status message
    this.showStatus('info', 'Enter your email to receive a new login code');
  }

  // Set form loading state
  setFormLoading(form, isLoading) {
    const submitBtn = form.querySelector('button[type="submit"]');
    const inputs = form.querySelectorAll('input, button');
    
    if (isLoading) {
      // Disable all inputs and buttons
      inputs.forEach(input => input.disabled = true);
      
      // Add loading spinner to submit button
      if (submitBtn) {
        const originalHTML = submitBtn.innerHTML;
        submitBtn.dataset.originalHTML = originalHTML;
        submitBtn.innerHTML = `
          <span class="spinner-border spinner-border-sm me-2" role="status"></span>
          Loading...
        `;
      }
    } else {
      // Re-enable all inputs and buttons
      inputs.forEach(input => input.disabled = false);
      
      // Restore submit button
      if (submitBtn && submitBtn.dataset.originalHTML) {
        submitBtn.innerHTML = submitBtn.dataset.originalHTML;
        delete submitBtn.dataset.originalHTML;
      }
    }
  }

  // Show status message
  showStatus(type, message) {
    const statusDiv = document.getElementById('auth-status');
    if (statusDiv) {
      statusDiv.className = `alert alert-${this.getBootstrapAlertClass(type)} border-0`;
      statusDiv.innerHTML = `
        <i class="bi ${this.getStatusIcon(type)} me-2"></i>
        ${message}
      `;
      statusDiv.style.display = 'block';
      
      // Auto-clear success messages
      if (type === 'success') {
        setTimeout(() => {
          statusDiv.style.display = 'none';
        }, 5000);
      }
    }
  }

  // Get Bootstrap alert class for status type
  getBootstrapAlertClass(type) {
    switch (type) {
      case 'success': return 'success';
      case 'error': return 'danger';
      case 'info': return 'info';
      default: return 'secondary';
    }
  }

  // Get icon for status type
  getStatusIcon(type) {
    switch (type) {
      case 'success': return 'bi-check-circle';
      case 'error': return 'bi-exclamation-triangle';
      case 'info': return 'bi-info-circle';
      default: return 'bi-info-circle';
    }
  }
}

// Export singleton instance
export const authUI = new AuthUI(); 