# Security Policy

## 🔒 Supported Versions

We release patches for security vulnerabilities for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 2.0.x   | :white_check_mark: |
| 1.0.x   | :x:                |

## 🐛 Reporting a Vulnerability

**Please DO NOT report security vulnerabilities through public GitHub issues.**

### How to Report

If you discover a security vulnerability, please report it by:

1. **Email**: Send details to [security@aifiles.dev](mailto:security@aifiles.dev)
2. **GitHub Security Advisory**: Use [GitHub's private vulnerability reporting](https://github.com/jjuliano/aifiles/security/advisories/new)

### What to Include

Please include the following information in your report:

- **Type of vulnerability** (e.g., XSS, SQL injection, path traversal)
- **Full paths** of source file(s) related to the issue
- **Location** of the affected source code (tag/branch/commit or direct URL)
- **Step-by-step instructions** to reproduce the issue
- **Proof-of-concept or exploit code** (if possible)
- **Impact** of the issue, including how an attacker might exploit it

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Depends on severity
  - Critical: 1-7 days
  - High: 7-30 days
  - Medium: 30-90 days
  - Low: Best effort

## 🛡️ Security Best Practices

When using AIFiles, follow these security guidelines:

### API Key Management

**DO:**
- ✅ Store API keys in `~/.aifiles` with proper file permissions
- ✅ Use environment variables for automation
- ✅ Rotate API keys periodically
- ✅ Use different API keys for development and production

**DON'T:**
- ❌ Commit API keys to version control
- ❌ Share API keys in public forums or issues
- ❌ Include API keys in screenshots or logs
- ❌ Use the same key across multiple applications

### File Path Security

**DO:**
- ✅ Validate file paths before processing
- ✅ Use absolute paths when possible
- ✅ Ensure proper file permissions
- ✅ Check file types and sizes

**DON'T:**
- ❌ Process files from untrusted sources without validation
- ❌ Allow arbitrary file path input
- ❌ Ignore file permission errors
- ❌ Process files outside intended directories

### Configuration Security

**DO:**
- ✅ Set proper file permissions on `~/.aifiles` (chmod 600)
- ✅ Review configuration before using untrusted templates
- ✅ Validate configuration values
- ✅ Keep configuration files backed up securely

**DON'T:**
- ❌ Make configuration files world-readable
- ❌ Store sensitive data in template descriptions
- ❌ Use configuration from untrusted sources
- ❌ Leave default/example API keys in configuration

### Network Security

**DO:**
- ✅ Use HTTPS for all API calls
- ✅ Verify SSL certificates
- ✅ Use secure local LLMs when privacy is critical
- ✅ Monitor network traffic for anomalies

**DON'T:**
- ❌ Disable SSL verification
- ❌ Send sensitive files to cloud APIs without encryption
- ❌ Trust unverified API endpoints
- ❌ Ignore certificate warnings

### GUI Security (Tauri)

**DO:**
- ✅ Keep Tauri updated to latest version
- ✅ Use context isolation
- ✅ Sanitize all user inputs
- ✅ Validate all IPC messages

**DON'T:**
- ❌ Disable web security features
- ❌ Use `nodeIntegration: true` in renderer
- ❌ Execute untrusted code
- ❌ Load remote content without validation

## 🔍 Security Features

AIFiles includes the following security features:

### Built-in Protections

1. **Path Traversal Prevention**
   - Validates all file paths
   - Prevents access to parent directories
   - Rejects suspicious patterns

2. **API Key Protection**
   - Never logs API keys
   - Redacts keys in error messages
   - Validates key formats before use

3. **Input Validation**
   - Validates configuration values
   - Sanitizes user inputs
   - Checks file types and sizes

4. **Sandboxed Execution**
   - Tauri renderer process is sandboxed
   - Context isolation enabled
   - No arbitrary code execution

### Recommended Additional Measures

1. **File Permissions**
   ```bash
   chmod 600 ~/.aifiles
   chmod 600 ~/.aifiles.json
   chmod 700 ~/.aifiles-templates.json
   ```

2. **Network Isolation** (for maximum privacy)
   ```bash
   # Use Ollama for 100% local processing
   LLM_PROVIDER=ollama
   LLM_MODEL=llama3.2
   ```

3. **Audit Logging** (optional)
   ```bash
   # Enable debug logging for audit trail
   export DEBUG=aifiles:*
   aifiles file.pdf 2>&1 | tee -a ~/aifiles-audit.log
   ```

## 🚨 Known Security Considerations

### API Providers

When using cloud-based AI providers:
- Files are sent to third-party APIs
- Content may be used for model training (check provider ToS)
- Metadata may be logged by providers
- Network traffic may be intercepted

**Mitigation**: Use local LLMs (Ollama) for sensitive data.

### Temporary Files

During processing:
- Temporary files may be created
- File content is stored in memory
- Intermediate results may be cached

**Mitigation**: Process sensitive files on encrypted drives.

### Desktop Notifications

File notifications may include:
- File names
- Partial content summaries
- Template information

**Mitigation**: Disable notifications for sensitive workflows.

## 📋 Security Checklist

Before using AIFiles in production:

- [ ] API keys are properly secured
- [ ] Configuration files have correct permissions
- [ ] Using appropriate LLM provider for data sensitivity
- [ ] File paths are validated
- [ ] GUI is running latest version
- [ ] System dependencies are up to date
- [ ] Network security is configured
- [ ] Audit logging is enabled (if required)
- [ ] Team members are trained on security practices

## 🔄 Security Updates

Security updates are released as:
- **Patch versions** for security fixes (e.g., 2.0.1)
- **Security advisories** for critical issues
- **Changelog entries** marked with [SECURITY]

Subscribe to:
- GitHub Security Advisories
- Release notifications
- Project discussions

## 📞 Contact

- **Security Email**: [security@aifiles.dev](mailto:security@aifiles.dev)
- **General Issues**: [GitHub Issues](https://github.com/jjuliano/aifiles/issues)
- **Security Advisories**: [GitHub Security](https://github.com/jjuliano/aifiles/security)

## 🏆 Security Acknowledgments

We appreciate responsible disclosure. Security researchers who report valid vulnerabilities will be:
- Acknowledged in release notes (unless anonymity is requested)
- Listed in SECURITY_HALL_OF_FAME.md
- Given credit in security advisories

## 📚 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Tauri Security](https://tauri.app/v1/guides/security/)
- [GitHub Security Features](https://docs.github.com/en/code-security)

---

**Last Updated**: January 2025
**Next Review**: July 2025

Thank you for helping keep AIFiles and our users safe! 🔒
