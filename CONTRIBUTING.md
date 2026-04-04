# Contributing

Thanks for your interest in contributing!

## Getting Started

```bash
git clone https://github.com/EdamAme-x/hansyashinkei.git
cd hansyashinkei
pnpm install
pnpm dev
```

## Development

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server |
| `pnpm build` | Production build |
| `pnpm test` | Run tests |
| `pnpm typecheck` | Type check |
| `pnpm lint` | Lint |

Git hooks run automatically:
- **pre-commit**: typecheck + lint
- **pre-push**: test + build

## Versioning

Every commit must bump `version` in `package.json` and include the bump in the commit message:

| Change | Bump | Example |
|--------|------|---------|
| Breaking / major feature | `x.0.0` | `feat(bump 2.0.0): redesign game` |
| New feature / enhancement | `x.y.0` | `feat(bump 1.1.0): add replay` |
| Bug fix / tweak | `x.y.z` | `fix(bump 1.0.1): fix collision` |

## Pull Requests

1. Fork the repo
2. Create a branch (`git checkout -b feat/my-feature`)
3. Make your changes
4. Bump version in `package.json`
5. Ensure `pnpm typecheck && pnpm lint && pnpm test && pnpm build` passes
6. Commit and push
7. Open a PR

## Architecture

This project uses **Onion Architecture** with strict dependency direction:

```
domain → application → infrastructure → presentation
```

- **domain**: Pure game logic, no external deps
- **application**: Use cases
- **infrastructure**: IndexedDB, Web Crypto, CBOR, pako
- **presentation**: Three.js, DOM, input handling

Do not introduce dependency violations (e.g. domain importing from infrastructure).

## Issues

- Use the issue templates provided
- Bug reports: include browser, OS, and steps to reproduce
- Feature requests: describe the use case
