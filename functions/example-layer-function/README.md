# Example Layer Function

This function demonstrates how to use FuncDock's Lambda Layer system with the `shared-utils` layer. It showcases various utilities including validation, formatting, string manipulation, and response helpers.

## Overview

The `example-layer-function` uses the `shared-utils` layer to provide common functionality without duplicating code. This is a practical example of how layers can be used to share code across multiple functions.

## Layer Usage

This function references the `shared-utils` layer via `layers.json`:

```json
"shared-utils"
```

The layer provides:

- **Validation utilities**: Email, phone, required fields, length validation
- **Formatting utilities**: Phone numbers, currency, dates
- **String utilities**: Sanitization, slugification, capitalization
- **Response helpers**: Success/error responses, pagination
- **Error handling**: Custom error classes and handlers
- **Number utilities**: Clamping, rounding, formatting

## Endpoints

### GET `/example-layer-function/`

Returns information about the function and available endpoints.

**Response:**

```json
{
  "success": true,
  "message": "Welcome to Example Layer Function",
  "data": {
    "message": "Example Layer Function",
    "description": "This function demonstrates usage of the shared-utils layer",
    "endpoints": { ... },
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

### POST `/example-layer-function/validate`

Validates email, phone, name, and age fields using layer utilities.

**Request Body:**

```json
{
  "email": "user@example.com",
  "phone": "5551234567",
  "name": "John Doe",
  "age": 30
}
```

**Response (Success):**

```json
{
  "success": true,
  "message": "All validations passed",
  "data": {
    "email": { "valid": true, "value": "user@example.com" },
    "phone": { "valid": true, "value": "5551234567" },
    "name": { "valid": true, "value": "John Doe" },
    "age": { "valid": true, "value": 30 }
  }
}
```

**Response (Error):**

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [{ "field": "email", "error": "Invalid email format" }]
}
```

### POST `/example-layer-function/format`

Formats phone numbers, currency, and dates using layer utilities.

**Request Body:**

```json
{
  "phone": "5551234567",
  "amount": 1234.56,
  "currency": "USD",
  "date": "2024-01-01T00:00:00.000Z",
  "dateFormat": "iso"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Formatting completed",
  "data": {
    "phone": {
      "original": "5551234567",
      "formatted": "(555) 123-4567"
    },
    "currency": {
      "original": 1234.56,
      "formatted": "$1,234.56"
    },
    "date": {
      "original": "2024-01-01T00:00:00.000Z",
      "formatted": "2024-01-01T00:00:00.000Z",
      "format": "iso"
    }
  }
}
```

### GET `/example-layer-function/users`

Returns a paginated list of users.

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `pageSize` (optional): Items per page (default: 10)

**Response:**

```json
{
  "success": true,
  "data": [{ "id": 1, "name": "John Doe", "email": "john@example.com", "phone": "555-1234" }],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 3,
    "totalPages": 1,
    "hasMore": false
  }
}
```

### POST `/example-layer-function/users`

Creates a new user with validation.

**Request Body:**

```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "phone": "555-5678"
}
```

**Response:**

```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "id": 4,
    "name": "Jane Smith",
    "email": "jane@example.com",
    "phone": "555-5678",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### POST `/example-layer-function/utilities`

Performs various string and number utility operations.

**Request Body:**

```json
{
  "action": "sanitize",
  "value": "<script>alert('xss')</script>Hello",
  "options": { "maxLength": 100 }
}
```

**Available Actions:**

- `sanitize`: Remove HTML tags and dangerous characters
- `slugify`: Convert string to URL-friendly slug
- `capitalize`: Capitalize first letter
- `clamp`: Clamp number between min and max
- `round`: Round number to specified decimals
- `formatNumber`: Format number with specified decimals

**Response:**

```json
{
  "success": true,
  "message": "Utility operation completed",
  "data": {
    "action": "sanitize",
    "original": "<script>alert('xss')</script>Hello",
    "result": "Hello"
  }
}
```

## Testing

Run the tests with:

```bash
node scripts/test-function-in-docker.js --function=./functions/example-layer-function
```

Or use Jest directly:

```bash
cd functions/example-layer-function
npm test
```

## Layer Import Example

The function imports utilities from the layer like this:

```javascript
import {
  validateEmail,
  validatePhone,
  formatPhone,
  formatCurrency,
  successResponse,
  errorResponse,
  ValidationError,
  handleError,
} from 'shared-utils';
```

## Key Features Demonstrated

1. **Layer Import**: Shows how to import functions from a layer
2. **Validation**: Uses layer validation utilities for input validation
3. **Formatting**: Demonstrates phone, currency, and date formatting
4. **Error Handling**: Uses layer error classes and handlers
5. **Response Formatting**: Uses layer response helpers for consistent API responses
6. **String Utilities**: Shows sanitization, slugification, and capitalization
7. **Number Utilities**: Demonstrates clamping, rounding, and formatting

## Best Practices

1. **Validation**: Always validate user input using layer utilities
2. **Sanitization**: Sanitize user input before processing
3. **Error Handling**: Use layer error classes for consistent error handling
4. **Response Format**: Use layer response helpers for consistent API responses
5. **Logging**: Log important operations for debugging

## Dependencies

This function has no direct dependencies. All utilities come from the `shared-utils` layer.

## Related Documentation

- [LAYERS_README.md](../../docs/LAYERS_README.md) - Complete layer documentation
- [USAGE_README.md](../../docs/USAGE_README.md) - Function development guide
