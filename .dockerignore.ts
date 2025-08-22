# TypeScript Docker ignore file

# Node.js
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*

# TypeScript build artifacts
dist/
build/
*.tsbuildinfo

# Environment files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE and editor files
.vscode/
.idea/
*.swp
*.swo
*~

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Git
.git/
.gitignore

# Python artifacts (from original project)
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
env/
venv/
ENV/
env.bak/
venv.bak/

# Jupyter Notebooks
.ipynb_checkpoints

# Documentation
docs/
*.md
!README.md

# Test coverage
coverage/
.nyc_output/
.coverage

# Logs
logs/
*.log

# Runtime data
pids/
*.pid
*.seed
*.pid.lock

# Examples and development files
examples/
examples/
server/src/test/

# Docker files themselves
Dockerfile*
docker-compose*.yml
.dockerignore*