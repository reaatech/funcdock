/**
 * Example Layer Function
 * Demonstrates usage of the shared-utils layer for validation, formatting, and utilities
 */

import {
  validateEmail,
  validatePhone,
  validateRequired,
  validateLength,
  formatPhone,
  formatCurrency,
  formatDate,
  sanitizeString,
  slugify,
  capitalize,
  successResponse,
  errorResponse,
  paginatedResponse,
  ValidationError,
  // AppError imported for reference but not used in this handler
  // AppError,
  handleError,
  getCurrentTimestamp,
  clamp,
  roundToDecimal,
  formatNumber,
} from 'shared-utils';

export default async function handler(req, res, _next) {
  const { method, path, query, body } = req;
  const { logger } = req;

  logger.info(`Request received: ${method} ${path}`, {
    query,
    hasBody: !!body,
  });

  try {
    // Route to appropriate handler based on path
    if (path === '/' || path === '') {
      return await handleRoot(req, res);
    } else if (path === '/validate') {
      return await handleValidate(req, res);
    } else if (path === '/format') {
      return await handleFormat(req, res);
    } else if (path === '/users') {
      return await handleUsers(req, res);
    } else if (path === '/utilities') {
      return await handleUtilities(req, res);
    } else {
      return res.status(404).json(errorResponse('Route not found', null, 404));
    }
  } catch (error) {
    logger.error('Handler error', { error: error.message, stack: error.stack });
    const errorData = handleError(error, logger);
    return res.status(error.statusCode || 500).json(errorData);
  }
}

/**
 * Root endpoint - demonstrates basic layer usage
 */
async function handleRoot(req, res) {
  const { logger } = req;

  logger.info('Root endpoint called');

  return res.status(200).json(
    successResponse(
      {
        message: 'Example Layer Function',
        description: 'This function demonstrates usage of the shared-utils layer',
        endpoints: {
          '/': 'This endpoint',
          '/validate': 'POST - Validate email, phone, and other data',
          '/format': 'POST - Format phone numbers, dates, currency',
          '/users': 'GET/POST - User management with validation',
          '/utilities': 'POST - String utilities and number helpers',
        },
        timestamp: getCurrentTimestamp(),
      },
      'Welcome to Example Layer Function'
    )
  );
}

/**
 * Validation endpoint - demonstrates validation utilities
 */
async function handleValidate(req, res) {
  const { method, body, logger } = req;

  if (method !== 'POST') {
    return res.status(405).json(errorResponse('Method not allowed. Use POST.', null, 405));
  }

  const { email, phone, name, age } = body || {};
  const errors = [];
  const results = {};

  // Validate email
  if (email !== undefined) {
    if (validateEmail(email)) {
      results.email = { valid: true, value: email };
    } else {
      errors.push({ field: 'email', error: 'Invalid email format' });
      results.email = { valid: false, value: email };
    }
  }

  // Validate phone
  if (phone !== undefined) {
    if (validatePhone(phone)) {
      results.phone = { valid: true, value: phone };
    } else {
      errors.push({ field: 'phone', error: 'Invalid phone number format' });
      results.phone = { valid: false, value: phone };
    }
  }

  // Validate name (required and length)
  if (name !== undefined) {
    const requiredCheck = validateRequired(name, 'Name');
    if (!requiredCheck.valid) {
      errors.push({ field: 'name', error: requiredCheck.error });
      results.name = { valid: false, value: name };
    } else {
      const lengthCheck = validateLength(name, 2, 50, 'Name');
      if (!lengthCheck.valid) {
        errors.push({ field: 'name', error: lengthCheck.error });
        results.name = { valid: false, value: name };
      } else {
        results.name = { valid: true, value: name };
      }
    }
  }

  // Validate age (if provided)
  if (age !== undefined) {
    const ageNum = parseInt(age);
    if (isNaN(ageNum) || ageNum < 0 || ageNum > 150) {
      errors.push({ field: 'age', error: 'Age must be a valid number between 0 and 150' });
      results.age = { valid: false, value: age };
    } else {
      results.age = { valid: true, value: ageNum };
    }
  }

  if (errors.length > 0) {
    return res.status(400).json(errorResponse('Validation failed', errors, 400));
  }

  logger.info('Validation successful', { results });

  return res.status(200).json(successResponse(results, 'All validations passed'));
}

/**
 * Format endpoint - demonstrates formatting utilities
 */
async function handleFormat(req, res) {
  const { method, body, logger } = req;

  if (method !== 'POST') {
    return res.status(405).json(errorResponse('Method not allowed. Use POST.', null, 405));
  }

  const { phone, amount, currency, date, dateFormat } = body || {};
  const formatted = {};

  // Format phone number
  if (phone !== undefined) {
    formatted.phone = {
      original: phone,
      formatted: formatPhone(phone, 'US'),
    };
  }

  // Format currency
  if (amount !== undefined) {
    const amountNum = parseFloat(amount);
    if (!isNaN(amountNum)) {
      formatted.currency = {
        original: amountNum,
        formatted: formatCurrency(amountNum, currency || 'USD', 'en-US'),
      };
    }
  }

  // Format date
  if (date !== undefined) {
    const formattedDate = formatDate(date, dateFormat || 'iso');
    formatted.date = {
      original: date,
      formatted: formattedDate,
      format: dateFormat || 'iso',
    };
  }

  logger.info('Formatting completed', { formatted });

  return res.status(200).json(successResponse(formatted, 'Formatting completed'));
}

/**
 * Users endpoint - demonstrates validation and response formatting
 */
async function handleUsers(req, res) {
  const { method, body, query, logger } = req;

  // Mock users database
  const mockUsers = [
    { id: 1, name: 'John Doe', email: 'john@example.com', phone: '555-1234' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', phone: '555-5678' },
    { id: 3, name: 'Bob Johnson', email: 'bob@example.com', phone: '555-9012' },
  ];

  if (method === 'GET') {
    const page = parseInt(query.page) || 1;
    const pageSize = parseInt(query.pageSize) || 10;

    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedUsers = mockUsers.slice(startIndex, endIndex);

    logger.info('Users list requested', { page, pageSize, count: paginatedUsers.length });

    return res
      .status(200)
      .json(paginatedResponse(paginatedUsers, page, pageSize, mockUsers.length));
  }

  if (method === 'POST') {
    const { name, email, phone } = body || {};

    // Validate required fields
    const nameCheck = validateRequired(name, 'Name');
    if (!nameCheck.valid) {
      return res.status(400).json(errorResponse(nameCheck.error, null, 400));
    }

    const emailCheck = validateRequired(email, 'Email');
    if (!emailCheck.valid) {
      return res.status(400).json(errorResponse(emailCheck.error, null, 400));
    }

    // Validate email format
    if (!validateEmail(email)) {
      return res.status(400).json(errorResponse('Invalid email format', null, 400));
    }

    // Validate name length
    const lengthCheck = validateLength(name, 2, 100, 'Name');
    if (!lengthCheck.valid) {
      return res.status(400).json(errorResponse(lengthCheck.error, null, 400));
    }

    // Sanitize inputs
    const sanitizedName = sanitizeString(name, 100);
    const sanitizedEmail = email.toLowerCase().trim();
    const sanitizedPhone = phone ? sanitizeString(phone, 20) : null;

    // Create new user
    const newUser = {
      id: mockUsers.length + 1,
      name: sanitizedName,
      email: sanitizedEmail,
      phone: sanitizedPhone,
      createdAt: getCurrentTimestamp(),
    };

    logger.info('New user created', { userId: newUser.id, email: newUser.email });

    return res.status(201).json(successResponse(newUser, 'User created successfully', 201));
  }

  return res.status(405).json(errorResponse('Method not allowed', null, 405));
}

/**
 * Utilities endpoint - demonstrates string and number utilities
 */
async function handleUtilities(req, res) {
  const { method, body, logger } = req;

  if (method !== 'POST') {
    return res.status(405).json(errorResponse('Method not allowed. Use POST.', null, 405));
  }

  const { action, value, options = {} } = body || {};

  if (!action || !value) {
    return res.status(400).json(errorResponse('Action and value are required', null, 400));
  }

  const results = { action, original: value };

  try {
    switch (action) {
      case 'sanitize':
        results.result = sanitizeString(value, options.maxLength);
        break;

      case 'slugify':
        results.result = slugify(value);
        break;

      case 'capitalize':
        results.result = capitalize(value);
        break;

      case 'clamp':
        if (options.min === undefined || options.max === undefined) {
          throw new ValidationError('min and max are required for clamp', 'options');
        }
        results.result = clamp(parseFloat(value), options.min, options.max);
        break;

      case 'round': {
        const decimals = options.decimals !== undefined ? parseInt(options.decimals) : 2;
        results.result = roundToDecimal(parseFloat(value), decimals);
        break;
      }

      case 'formatNumber': {
        const formatDecimals = options.decimals !== undefined ? parseInt(options.decimals) : 0;
        results.result = formatNumber(parseFloat(value), formatDecimals);
        break;
      }

      default:
        return res.status(400).json(errorResponse(`Unknown action: ${action}`, null, 400));
    }

    logger.info('Utility operation completed', { action, result: results.result });

    return res.status(200).json(successResponse(results, 'Utility operation completed'));
  } catch (error) {
    const errorData = handleError(error, logger);
    return res.status(400).json(errorData);
  }
}
