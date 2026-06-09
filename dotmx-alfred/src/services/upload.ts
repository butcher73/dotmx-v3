/**
 * Upload Service
 * 
 * Handles file uploads to the server
 */

export interface UploadResult {
  success: boolean;
  url?: string;
  optimizedUrl?: string;
  error?: string;
}

/**
 * Get authentication token from storage or environment
 */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  
  // Try localStorage first
  const storedToken = localStorage.getItem('alfred_auth_token');
  if (storedToken) return storedToken;
  
  // Fallback: use a dummy token for development
  return 'dev-token';
}

/**
 * Upload a file to the server
 */
export async function uploadFile(file: File): Promise<UploadResult> {
  const token = getAuthToken();
  
  if (!token) {
    throw new Error('Not authenticated');
  }
  
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch('/api/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  
  const result = await response.json();
  
  if (!response.ok) {
    throw new Error(result.error || 'Upload failed');
  }
  
  return result;
}

/**
 * Upload token icon
 */
export async function uploadTokenIcon(file: File): Promise<string> {
  // Validate file before upload
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
  const maxSize = 5 * 1024 * 1024; // 5MB
  
  if (!allowedTypes.includes(file.type)) {
    throw new Error(`Invalid file type. Allowed: PNG, JPEG, WebP, SVG`);
  }
  
  if (file.size > maxSize) {
    throw new Error(`File too large. Maximum size: 5MB`);
  }
  
  const result = await uploadFile(file);
  
  if (!result.success || !result.url) {
    throw new Error(result.error || 'Upload failed');
  }
  
  // Return the optimized URL if available, otherwise the original URL
  return result.optimizedUrl || result.url;
}
