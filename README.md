# Hansyashinkei

A 4-lane dodge game built with Three.js. Dodge the walls rushing toward you using J / K keys.

## How to Play

| Key | Action |
|-----|--------|
| `J` | Dodge left ball to the left (returns on release) |
| `K` | Dodge right ball to the right (returns on release) |
| `Space` / `Enter` | Start game / Retry |

- Walls spawn on 2 random lanes each wave
- Score = number of walls dodged
- Speed increases by x1.05 every 100 walls

## Tech Stack

- **Vite 8** + **TypeScript 5.9**
- **Three.js** (3D rendering)
- **Onion Architecture** — domain / application / infrastructure / presentation
- **State Machine** — Title → Playing → GameOver
- **Score persistence** — CBOR + AES-GCM (CryptoKey stored directly in IndexedDB, extractable=false)
- **Vitest 4** (unit testing)
- **ESLint 10** (flat config)
- **GitHub Actions** — CI + GitHub Pages deploy

## Development

```bash
pnpm install
pnpm dev        # Dev server
pnpm build      # Production build
pnpm test       # Run tests
pnpm typecheck  # Type check
pnpm lint       # Lint
```

## Architecture

```
src/
├── domain/           # Entities & repository interfaces (no dependencies)
│   ├── entities/     # StateMachine, GameWorld, Lane, Wall, Score
│   └── repositories/ # ScoreRepository (interface)
├── application/      # Use cases (depends on domain only)
│   └── usecases/     # ManageScore
├── infrastructure/   # External implementations (domain + browser APIs)
│   ├── crypto/       # DeviceKeyStore (Web Crypto + IndexedDB)
│   └── storage/      # IndexedDbScoreRepository (CBOR + AES-GCM)
└── presentation/     # UI (depends on domain + application only)
    ├── App.ts        # Game loop + State Machine integration
    ├── ThreeSceneAdapter.ts
    ├── GameRenderer.ts
    └── HUD.ts
```

## License

MIT
