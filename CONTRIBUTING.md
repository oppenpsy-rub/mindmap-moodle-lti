# Contributing to MindMap Moodle LTI Tool

Thank you for your interest in contributing! 🎉

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourname/mindmap-moodle-lti.git`
3. Create a feature branch: `git checkout -b feature/my-feature`
4. Make your changes
5. Push to your fork: `git push origin feature/my-feature`
6. Open a Pull Request

## Development Setup

```bash
# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Copy environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Start development servers
docker-compose up -d
```

## Code Style

- **JavaScript**: Use ESLint (configured in project)
- **Commits**: Use descriptive messages (`feat: add X`, `fix: resolve Y`)
- **Comments**: Document complex logic

## Testing

Before submitting PR:

```bash
# Backend
cd backend && npm test

# Frontend
cd frontend && npm test

# E2E (manual)
# Open 2 browser tabs and verify real-time sync
```

## Issues & Discussions

- **Bug reports**: Open a GitHub issue with reproduction steps
- **Feature requests**: Discuss in issues first
- **Questions**: Use GitHub Discussions

## License

By contributing, you agree that your code is licensed under MIT.

Thank you! ❤️
