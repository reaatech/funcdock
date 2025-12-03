/**
 * Shared Utils Layer
 * Common validation, formatting, and helper functions for FuncDock functions
 */

// Validation utilities
export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

export function validatePhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return false;
  }
  // Remove common formatting characters
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  // Check if it's a valid phone number (10-15 digits)
  return /^\+?[1-9]\d{9,14}$/.test(cleaned);
}

export function validateRequired(value, fieldName = 'Field') {
  if (value === null || value === undefined || value === '') {
    return { valid: false, error: `${fieldName} is required` };
  }
  return { valid: true };
}

export function validateLength(value, min, max, fieldName = 'Field') {
  if (typeof value !== 'string') {
    return { valid: false, error: `${fieldName} must be a string` };
  }
  if (value.length < min) {
    return { valid: false, error: `${fieldName} must be at least ${min} characters` };
  }
  if (max && value.length > max) {
    return { valid: false, error: `${fieldName} must be no more than ${max} characters` };
  }
  return { valid: true };
}

// Formatting utilities
export function formatPhone(phone, format = 'US') {
  if (!phone || typeof phone !== 'string') {
    return phone;
  }
  
  const cleaned = phone.replace(/\D/g, '');
  
  if (format === 'US' && cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  
  if (format === 'US' && cleaned.length === 11 && cleaned[0] === '1') {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  
  // Default: return cleaned with + prefix if international
  if (cleaned.length > 10) {
    return `+${cleaned}`;
  }
  
  return cleaned;
}

export function formatCurrency(amount, currency = 'USD', locale = 'en-US') {
  if (typeof amount !== 'number') {
    return amount;
  }
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency
  }).format(amount);
}

export function formatDate(date, format = 'iso') {
  if (!date) {
    return null;
  }
  
  const d = date instanceof Date ? date : new Date(date);
  
  if (isNaN(d.getTime())) {
    return null;
  }
  
  if (format === 'iso') {
    return d.toISOString();
  }
  
  if (format === 'date') {
    return d.toLocaleDateString();
  }
  
  if (format === 'datetime') {
    return d.toLocaleString();
  }
  
  return d.toISOString();
}

// String utilities
export function sanitizeString(str, maxLength = null) {
  if (typeof str !== 'string') {
    return '';
  }
  
  // Remove potentially dangerous characters
  let sanitized = str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
  
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized;
}

export function slugify(str) {
  if (typeof str !== 'string') {
    return '';
  }
  
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function capitalize(str) {
  if (typeof str !== 'string' || str.length === 0) {
    return str;
  }
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// Response formatting helpers
export function successResponse(data, message = 'Success', statusCode = 200) {
  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  };
}

export function errorResponse(message, errors = null, statusCode = 400) {
  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString()
  };
  
  if (errors) {
    response.errors = Array.isArray(errors) ? errors : [errors];
  }
  
  return response;
}

export function paginatedResponse(data, page = 1, pageSize = 10, total = null) {
  const response = {
    success: true,
    data,
    pagination: {
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      total: total !== null ? parseInt(total) : data.length
    },
    timestamp: new Date().toISOString()
  };
  
  if (total !== null) {
    response.pagination.totalPages = Math.ceil(total / pageSize);
    response.pagination.hasMore = page * pageSize < total;
  }
  
  return response;
}

// Error handling utilities
export class ValidationError extends Error {
  constructor(message, field = null, code = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.code = code;
  }
}

export class AppError extends Error {
  constructor(message, code = 'APP_ERROR', statusCode = 500) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function handleError(error, logger = null) {
  if (logger) {
    logger.error('Error occurred', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
  }
  
  if (error instanceof ValidationError) {
    return {
      success: false,
      error: error.message,
      field: error.field,
      code: error.code
    };
  }
  
  if (error instanceof AppError) {
    return {
      success: false,
      error: error.message,
      code: error.code
    };
  }
  
  return {
    success: false,
    error: 'An unexpected error occurred',
    code: 'INTERNAL_ERROR'
  };
}

// Date/time utilities
export function getCurrentTimestamp() {
  return new Date().toISOString();
}

export function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function addHours(date, hours) {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
}

export function isDateInFuture(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.getTime() > Date.now();
}

export function isDateInPast(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.getTime() < Date.now();
}

// Number utilities
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function roundToDecimal(value, decimals = 2) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function formatNumber(value, decimals = 0) {
  if (typeof value !== 'number') {
    return value;
  }
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
}

