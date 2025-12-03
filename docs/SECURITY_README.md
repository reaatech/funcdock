# 🔒 FuncDock — Security Guide

Security is a top priority for FuncDock. This guide covers security features, best practices, and how to report vulnerabilities.

## Index
- [Security Features](#security-features)
- [Security Configuration](#security-configuration)
- [Best Practices](#best-practices)
- [Function Security](#function-security)
- [Deployment Security](#deployment-security)
- [Network Security](#network-security)
- [Responsible Disclosure](#responsible-disclosure)
- [Reporting Vulnerabilities](#reporting-vulnerabilities)
- [Security Checklist](#security-checklist)
- [Security FAQ](#security-faq)

---

## Security Features

FuncDock includes multiple layers of security to protect your functions and data:

### Platform-Level Security

**1. Route Conflict Prevention**
- Automatic detection of conflicting route patterns
- Prevents deployment of routes that would conflict
- Protects against accidental route overwrites

**2. Security Headers (Helmet.js)**
- Content Security Policy (CSP) configured
- XSS protection enabled
- MIME type sniffing prevention
- Clickjacking protection
- HSTS support (when using HTTPS)

**3. Rate Limiting**
- API endpoints protected with rate limiting
- Default: 100 requests per 15 minutes per IP
- Configurable limits per endpoint
- Prevents abuse and DDoS attacks

**4. CORS Protection**
- Configurable Cross-Origin Resource Sharing
- Default allows all origins (configure for production)
- Prevents unauthorized cross-origin requests

**5. Function Isolation**
- Functions run in isolated directories
- No cross-function file access
- Environment variables are function-specific
- Prevents function-to-function data leakage

**6. Authentication & Authorization**
- JWT-based authentication for dashboard and API
- Bcrypt password hashing
- Token-based API access
- Configurable admin credentials

**7. Webhook Signature Validation**
- GitHub webhook signature verification
- Stripe webhook signature validation
- Prevents unauthorized webhook calls
- Configurable validation per webhook type

**8. Input Validation**
- Express-validator for request validation
- JSON payload size limits (10MB default)
- URL-encoded payload limits
- Prevents injection attacks

---

## Security Configuration

### Environment Variables

**Critical Security Variables:**

```bash
# JWT Secret (REQUIRED in production)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Admin Credentials (REQUIRED in production)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password

# Server Port
PORT=3000

# OAuth Credentials (for GitHub/Bitbucket integration)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
BITBUCKET_CLIENT_ID=your_bitbucket_client_id
BITBUCKET_CLIENT_SECRET=your_bitbucket_client_secret
```

**⚠️ Production Security Checklist:**
- [ ] Change `JWT_SECRET` to a strong, random value
- [ ] Change `ADMIN_USERNAME` and `ADMIN_PASSWORD`
- [ ] Use environment variables, never commit secrets
- [ ] Enable HTTPS/TLS in production
- [ ] Configure CORS for specific origins
- [ ] Review and adjust rate limiting
- [ ] Set up proper firewall rules

### Rate Limiting Configuration

Rate limiting is configured in `server.js`:

```javascript
const limiter = rateLimit({
  windowMs: 15 * * 1000, // 15 minutes
  max: 100, // requests per window
  message: 'Too many requests from this IP'
});
```

**To customize:**
- Adjust `windowMs` for time window
- Adjust `max` for request limit
- Add per-endpoint limits if needed

### CORS Configuration

Default CORS allows all origins. For production:

```javascript
// In server.js, replace:
app.use(cors());

// With:
app.use(cors({
  origin: ['https://yourdomain.com', 'https://app.yourdomain.com'],
  credentials: true
}));
```

---

## Best Practices

### Secrets Management

**✅ DO:**
- Use environment variables for all secrets
- Store secrets in `.env` file (not committed to Git)
- Use different secrets for dev/staging/production
- Rotate secrets regularly
- Use secret management services in production (AWS Secrets Manager, HashiCorp Vault, etc.)

**❌ DON'T:**
- Hardcode secrets in code
- Commit `.env` files to Git
- Share secrets via insecure channels
- Use default credentials in production

### Dependency Security

**✅ DO:**
- Keep dependencies up to date
- Regularly run `npm audit`
- Review dependency changes before updating
- Use `npm audit fix` for known vulnerabilities
- Monitor security advisories

```bash
# Check for vulnerabilities
npm audit

# Fix automatically fixable issues
npm audit fix

# Review detailed report
npm audit --json
```

### Function Security

**✅ DO:**
- Validate all input data
- Sanitize user input
- Use parameterized queries (if using databases)
- Handle errors gracefully (don't expose internals)
- Log security events
- Implement proper authentication in functions

**❌ DON'T:**
- Trust user input
- Expose sensitive data in error messages
- Use `eval()` or similar dangerous functions
- Store secrets in function code
- Skip input validation

---

## Function Security

### Input Validation

Always validate and sanitize input:

```javascript
export default async function handler(req, res) {
  const { body, query } = req;
  
  // Validate required fields
  if (!body.email || !isValidEmail(body.email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }
  
  // Sanitize input
  const sanitizedEmail = body.email.toLowerCase().trim();
  
  // Process request...
}
```

### Error Handling

Don't expose sensitive information in errors:

```javascript
// ❌ Bad - exposes internal details
try {
  await database.query(sql);
} catch (error) {
  res.status(500).json({ error: error.message }); // May expose DB structure
}

// ✅ Good - generic error message
try {
  await database.query(sql);
} catch (error) {
  logger.error('Database error', { error: error.message });
  res.status(500).json({ error: 'Internal server error' });
}
```

### Authentication in Functions

Implement authentication for sensitive endpoints:

```javascript
export default async function handler(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  
  if (!token || !isValidToken(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Process authenticated request...
}
```

---

## Deployment Security

### Git Credentials

**✅ Recommended: Host-based Deployment**
- Uses your existing Git credentials
- No credentials stored in containers
- Supports SSH keys (most secure)

```bash
# Use host-based deployment
make deploy-host-git REPO=https://github.com/user/repo.git NAME=my-function
```

**SSH Key Setup:**
```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "your.email@example.com"

# Add to GitHub/Bitbucket
# Use SSH URLs for deployment
make deploy-host-git REPO=git@github.com:user/repo.git NAME=my-function
```

### Container Security

**✅ DO:**
- Use official base images
- Keep images updated
- Run containers as non-root user
- Limit container resources
- Use read-only file systems where possible
- Scan images for vulnerabilities

### Network Security

**✅ DO:**
- Use HTTPS/TLS in production
- Configure firewall rules
- Limit exposed ports
- Use VPN for internal services
- Implement network segmentation
- Monitor network traffic

---

## Network Security

### HTTPS/TLS Configuration

**Using Caddy (Recommended):**

The `Caddyfile` includes HTTPS configuration:

```caddy
yourdomain.com {
    reverse_proxy localhost:3000
    encode gzip
}
```

Caddy automatically:
- Obtains SSL certificates (Let's Encrypt)
- Renews certificates automatically
- Redirects HTTP to HTTPS

### Firewall Configuration

**Recommended Rules:**
- Allow only necessary ports (80, 443, 22)
- Block all other incoming connections
- Use fail2ban for SSH protection
- Implement DDoS protection

### API Security

**Authentication Required:**
- Dashboard access requires JWT token
- API endpoints require authentication token
- WebSocket connections authenticated

**Token Management:**
- Tokens expire (configure JWT expiration)
- Refresh tokens for long-lived sessions
- Revoke tokens on logout

---

## Responsible Disclosure

### If You Find a Vulnerability

We take security seriously and appreciate responsible disclosure.

**What to Do:**
1. **Do not** create a public GitHub issue
2. **Do not** discuss publicly until resolved
3. Email security details to: **security@funcdock.dev**
4. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if you have one)

**What to Expect:**
- Acknowledgment within 48 hours
- Regular updates on fix progress
- Credit in security advisories (if desired)
- Public disclosure after fix is released

---

## Reporting Vulnerabilities

### Security Contact

**Email:** security@funcdock.dev

**Private GitHub Issue:**
- Create a private security advisory on GitHub
- Include all relevant details
- We'll respond promptly

### What to Include

**Essential Information:**
- Vulnerability type (XSS, injection, etc.)
- Affected components/versions
- Steps to reproduce
- Potential impact
- Suggested remediation

**Optional but Helpful:**
- Proof of concept code
- Screenshots/videos
- Suggested fix
- References to similar vulnerabilities

### Vulnerability Severity

We use the following severity levels:

- **Critical** - Remote code execution, data breach
- **High** - Authentication bypass, privilege escalation
- **Medium** - Information disclosure, CSRF
- **Low** - Minor information leaks, denial of service

---

## Security Checklist

### Pre-Deployment

- [ ] All secrets in environment variables
- [ ] Default credentials changed
- [ ] Dependencies updated and audited
- [ ] HTTPS/TLS configured
- [ ] CORS configured for specific origins
- [ ] Rate limiting configured appropriately
- [ ] Firewall rules configured
- [ ] Logging and monitoring enabled
- [ ] Backup strategy in place
- [ ] Security headers verified

### Ongoing Maintenance

- [ ] Regular dependency updates
- [ ] Security audit runs (`npm audit`)
- [ ] Log review for suspicious activity
- [ ] Access control review
- [ ] Secret rotation schedule
- [ ] Security patch monitoring
- [ ] Incident response plan ready

### Function Development

- [ ] Input validation implemented
- [ ] Error handling doesn't expose internals
- [ ] Authentication for sensitive endpoints
- [ ] Secrets not hardcoded
- [ ] SQL injection prevention (if using DB)
- [ ] XSS prevention
- [ ] CSRF protection (if needed)
- [ ] Rate limiting considered

---

## Security FAQ

### Q: Is FuncDock secure for production use?

A: FuncDock includes multiple security features, but you must:
- Configure environment variables properly
- Use HTTPS in production
- Keep dependencies updated
- Follow security best practices
- Review and customize security settings

### Q: How do I secure the dashboard?

A: 
- Change default admin credentials
- Use strong JWT secret
- Enable authentication
- Configure CORS for specific origins
- Use HTTPS
- Implement IP whitelisting if needed

### Q: Are functions isolated from each other?

A: Yes. Functions run in separate directories with:
- Isolated file systems
- Separate environment variables
- No cross-function access
- Independent dependency management

### Q: How do I validate webhook signatures?

A: FuncDock includes webhook validation for GitHub and Stripe. See example functions in `functions/webhook-handler/` for implementation patterns.

### Q: What if I find a security vulnerability?

A: Please report it responsibly:
- Email: security@funcdock.dev
- Include details and steps to reproduce
- Allow time for fix before public disclosure

### Q: How often should I update dependencies?

A: 
- Check weekly: `npm audit`
- Update monthly or when vulnerabilities are found
- Test updates in staging before production
- Review changelogs for breaking changes

### Q: Can I use FuncDock behind a reverse proxy?

A: Yes. FuncDock works well with:
- Caddy (included in docker-compose)
- Nginx
- Apache
- Cloudflare
- AWS ALB

Configure `trust proxy` and ensure proper headers are forwarded.

---

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [TROUBLESHOOTING_README.md](TROUBLESHOOTING_README.md) - Security-related troubleshooting

---

**Remember:** Security is a shared responsibility. Follow best practices, keep systems updated, and report vulnerabilities responsibly.

For security concerns, contact: **security@funcdock.dev** 