# Installation Guide

## System Requirements

### Minimum
- Node.js 18.0.0 or higher
- npm 9.0.0 or higher
- 100MB disk space

### Recommended
- Node.js 20.0.0 or higher
- npm 10.0.0 or higher
- 500MB disk space for development

---

## Installation Methods

### Method 1: KPM (Recommended)

KPM (Kim Package Manager) is the official package manager for FreeLang.

```bash
# Install @freelang/runtime from KPM
kpm install @freelang/runtime

# Verify installation
freelang --version
```

### Method 2: npm

```bash
# Install from npm registry
npm install @freelang/runtime

# Verify installation
npx freelang --version
```

### Method 3: Global Install

Install globally to use `freelang` command anywhere:

```bash
# Via KPM
kpm install -g @freelang/runtime

# Or via npm
npm install -g @freelang/runtime

# Verify
freelang --version
```

### Method 4: From Source

For development:

```bash
# Clone the repository
git clone https://gogs.dclub.kr/kim/freelang-runtime.git
cd freelang-runtime

# Install dependencies
npm install

# Build from source
npm run build

# Run tests
npm run test

# Use local version
node dist/cli/index.js run script.fl
```

---

## Verification

### Quick Test

Create a simple FreeLang file:

```bash
cat > test.fl << 'EOF'
fn main(): void {
  println("Hello from FreeLang!")
}
EOF

# Run it
freelang run test.fl
```

Expected output:
```
Hello from FreeLang!
```

### Detailed Verification

```bash
# Check version
freelang --version
# Output: FreeLang v2.2.0

# Run REPL
freelang
# > 10 + 20
# 30
# > exit

# Check CLI commands
freelang --help
```

---

## Troubleshooting

### Issue: "freelang command not found"

**Solution**: Make sure the package is installed:

```bash
# Check if installed
npm list -g @freelang/runtime

# Reinstall if needed
npm install -g @freelang/runtime

# For KPM
kpm install @freelang/runtime
```

### Issue: "Node.js version too old"

**Solution**: Update Node.js:

```bash
# Check current version
node --version

# Update Node.js (macOS with Homebrew)
brew upgrade node

# Or visit https://nodejs.org for other platforms
```

### Issue: Permission denied on bin/freelang

**Solution**: Fix permissions:

```bash
chmod +x ~/.npm/_npx/*/node_modules/@freelang/runtime/bin/freelang

# Or reinstall
npm install -g @freelang/runtime
```

### Issue: "Cannot find module" errors

**Solution**: Reinstall dependencies:

```bash
# Clear cache
npm cache clean --force

# Reinstall
npm install @freelang/runtime
```

---

## Getting Started

After installation, follow the [Quick Start](../README.md#-quick-start) guide to write your first FreeLang program.

### Next Steps

1. **Read the Language Guide**: [Language Guide](../README.md#-language-guide)
2. **Try Examples**: `freelang run examples/hello.fl`
3. **Explore More**: Check out `examples/` directory
4. **Build Projects**: Create your own FreeLang programs

---

## Development Setup

For contributors and developers:

```bash
# Clone and setup
git clone https://gogs.dclub.kr/kim/freelang-runtime.git
cd freelang-runtime

# Install dependencies
npm install

# Watch mode (auto-rebuild on changes)
npm run dev

# Run tests in watch mode
npm run test:watch

# Linting
npm run lint

# Build for production
npm run build
```

---

## Platform-Specific Notes

### macOS

```bash
# Install via Homebrew (if available)
# brew install freelang-runtime

# Or use npm/KPM
npm install -g @freelang/runtime
```

### Windows

```bash
# Use npm (recommended)
npm install -g @freelang/runtime

# Then use in Command Prompt or PowerShell
freelang run script.fl
```

### Linux

```bash
# Install via package manager (if available)
# sudo apt install freelang-runtime

# Or use npm/KPM
npm install -g @freelang/runtime

# May need to add npm global bin to PATH
export PATH=~/.npm/_npx/*/bin:$PATH
```

---

## Docker Support

If you prefer Docker:

```dockerfile
FROM node:20-alpine

RUN npm install -g @freelang/runtime

WORKDIR /app
COPY . .

CMD ["freelang", "run", "main.fl"]
```

Build and run:

```bash
docker build -t freelang-app .
docker run freelang-app
```

---

## Support

For installation issues:

- **Issues**: https://gogs.dclub.kr/kim/freelang-runtime/issues
- **KPM Registry**: https://kpm.dclub.kr/packages/@freelang/runtime
- **Documentation**: https://gogs.dclub.kr/kim/freelang-runtime
