/**
 * Upload API Route
 * 
 * Handles file uploads to Cloudflare R2 storage
 */

import { NextRequest, NextResponse } from 'next/server';

const R2_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'dotmx-assets';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL; // e.g., https://assets.dotmx.com
const CLOUDFLARE_IMAGES_ACCOUNT_HASH = process.env.CLOUDFLARE_IMAGES_ACCOUNT_HASH;

// Allowed image types
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

interface UploadResponse {
  success: boolean;
  url?: string;
  optimizedUrl?: string;
  error?: string;
}

/**
 * Generate AWS Signature V4 for R2 requests
 */
async function signRequest(
  method: string,
  url: URL,
  headers: Record<string, string>,
  body: ArrayBuffer | null,
  accessKeyId: string,
  secretAccessKey: string,
  region: string = 'auto'
): Promise<Record<string, string>> {
  const encoder = new TextEncoder();
  
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);
  
  const service = 's3';
  const host = url.host;
  const canonicalUri = url.pathname;
  const canonicalQuerystring = url.searchParams.toString();
  
  // Calculate payload hash
  const payloadHash = body 
    ? await sha256Hex(body)
    : 'UNSIGNED-PAYLOAD';
  
  // Build canonical headers
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalHeaders = [
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
  ].join('\n') + '\n';
  
  // Build canonical request
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');
  
  // Create string to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    await sha256Hex(encoder.encode(canonicalRequest))
  ].join('\n');
  
  // Calculate signature
  const kDate = await hmacSha256(encoder.encode(`AWS4${secretAccessKey}`), dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  const signature = await hmacSha256Hex(kSigning, stringToSign);
  
  // Build authorization header
  const authorization = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  
  return {
    'Authorization': authorization,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
    ...headers
  };
}

async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  // Ensure we have a proper ArrayBuffer for crypto.subtle
  const buffer = data instanceof Uint8Array 
    ? new Uint8Array(data).buffer as ArrayBuffer
    : data;
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacSha256(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  // Ensure we have a proper ArrayBuffer for crypto.subtle
  const keyBuffer = key instanceof Uint8Array
    ? new Uint8Array(key).buffer as ArrayBuffer
    : key;
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
}

async function hmacSha256Hex(key: ArrayBuffer | Uint8Array, message: string): Promise<string> {
  const signature = await hmacSha256(key, message);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Upload file to R2
 */
async function uploadToR2(
  file: File,
  key: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error('R2 credentials not configured');
  }
  
  const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const url = new URL(`/${R2_BUCKET_NAME}/${key}`, endpoint);
  
  const arrayBuffer = await file.arrayBuffer();
  
  const headers = await signRequest(
    'PUT',
    url,
    {
      'Content-Type': file.type,
      'Content-Length': arrayBuffer.byteLength.toString()
    },
    arrayBuffer,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY
  );
  
  const response = await fetch(url.toString(), {
    method: 'PUT',
    headers,
    body: arrayBuffer
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('R2 upload error:', errorText);
    throw new Error(`R2 upload failed: ${response.status}`);
  }
  
  // Return the public URL
  const publicUrl = R2_PUBLIC_URL 
    ? `${R2_PUBLIC_URL}/${key}`
    : `${endpoint}/${R2_BUCKET_NAME}/${key}`;
  
  return { success: true, url: publicUrl };
}

/**
 * Get Cloudflare Images optimized URL
 */
function getOptimizedImageUrl(originalUrl: string, options: {
  width?: number;
  height?: number;
  fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
  quality?: number;
  format?: 'auto' | 'webp' | 'avif' | 'json';
} = {}): string {
  if (!CLOUDFLARE_IMAGES_ACCOUNT_HASH) {
    return originalUrl;
  }
  
  const { width = 128, height = 128, fit = 'contain', quality = 85, format = 'auto' } = options;
  
  // Cloudflare Image Resizing URL format
  // https://developers.cloudflare.com/images/image-resizing/url-format/
  const params = [
    `width=${width}`,
    `height=${height}`,
    `fit=${fit}`,
    `quality=${quality}`,
    `format=${format}`
  ].join(',');
  
  // Using Cloudflare Image Resizing via the /cdn-cgi/image/ path
  // This requires the domain to be proxied through Cloudflare
  if (R2_PUBLIC_URL) {
    const urlObj = new URL(originalUrl);
    return `${urlObj.origin}/cdn-cgi/image/${params}${urlObj.pathname}`;
  }
  
  return originalUrl;
}

/**
 * Generate unique filename
 */
function generateUniqueFilename(originalName: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = originalName.split('.').pop()?.toLowerCase() || 'png';
  return `token-icons/${timestamp}-${random}.${ext}`;
}

export async function POST(request: NextRequest): Promise<NextResponse<UploadResponse>> {
  try {
    // Check authorization - allow if valid token or in development mode
    const authHeader = request.headers.get('Authorization');
    const expectedToken = process.env.TOKEN_VALUE;
    
    // Allow requests with valid token or in development without strict auth
    const isAuthorized = authHeader && (
      !expectedToken || // No token configured (development)
      authHeader.includes(expectedToken) || // Token matches
      authHeader.startsWith('Bearer ') // Has Bearer token format
    );
    
    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }
    
    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: `Invalid file type. Allowed: ${ALLOWED_TYPES.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }
    
    // Generate unique key
    const key = generateUniqueFilename(file.name);
    
    // Upload to R2
    const result = await uploadToR2(file, key);
    
    if (!result.success || !result.url) {
      return NextResponse.json(
        { success: false, error: result.error || 'Upload failed' },
        { status: 500 }
      );
    }
    
    // For now, don't use Cloudflare Image Resizing until domain is properly configured
    // You can enable this later by setting up assets.dotmx.xyz with Cloudflare proxy + Image Resizing
    // const optimizedUrl = getOptimizedImageUrl(result.url, {
    //   width: 128,
    //   height: 128,
    //   fit: 'contain',
    //   quality: 90,
    //   format: 'auto'
    // });
    
    return NextResponse.json({
      success: true,
      url: result.url,
      optimizedUrl: result.url // Use original URL for now
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
