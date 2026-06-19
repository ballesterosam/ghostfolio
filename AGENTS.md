# Ghostfolio Agent Context Guide (`AGENTS.md`)

This document provides context, setup instructions, guidelines, and commands to help developer agents understand and work with this project efficiently.

---

## 1. Project Overview

Ghostfolio is a lightweight, open-source personal finance dashboard to track assets (stocks, ETFs, cryptocurrencies, cash) and analyze portfolio performance. It is built as an **Nx monorepo** with Angular on the frontend and NestJS on the backend, using PostgreSQL via Prisma ORM, and Redis for queue/background tasks.

### Directory Structure & Architecture

- **[apps/api](file:///Users/ballesterosam/Personal/projects/ghostfolio/apps/api)**: NestJS backend application.
- **[apps/client](file:///Users/ballesterosam/Personal/projects/ghostfolio/apps/client)**: Angular single-page application (using Angular Material, Bootstrap 4 grid structure/utils, and Ionic UI components).
- **[libs/common](file:///Users/ballesterosam/Personal/projects/ghostfolio/libs/common)**: Shared libraries containing DTOs, configurations, enums, TypeScript interfaces, validators, and core financial math helpers (e.g. [calculation-helper.ts](file:///Users/ballesterosam/Personal/projects/ghostfolio/libs/common/src/lib/calculation-helper.ts), [personal-finance-tools.ts](file:///Users/ballesterosam/Personal/projects/ghostfolio/libs/common/src/lib/personal-finance-tools.ts)).
- **[libs/ui](file:///Users/ballesterosam/Personal/projects/ghostfolio/libs/ui)**: Reusable Angular UI components, charts, map visualizations, tables, form components, and Storybook documentation.
- **[prisma/schema.prisma](file:///Users/ballesterosam/Personal/projects/ghostfolio/prisma/schema.prisma)**: Database schema definitions and relations.
- **[docker](file:///Users/ballesterosam/Personal/projects/ghostfolio/docker)**: Contains Docker Compose configurations for running external dependencies (PostgreSQL, Redis).

### Import Path Mappings

The workspace defines the following TypeScript path aliases in [tsconfig.base.json](file:///Users/ballesterosam/Personal/projects/ghostfolio/tsconfig.base.json):

- `@ghostfolio/api/*` maps to `apps/api/src/*`
- `@ghostfolio/client/*` maps to `apps/client/src/app/*`
- `@ghostfolio/common/*` maps to `libs/common/src/lib/*`
- `@ghostfolio/ui/*` maps to `libs/ui/src/lib/*`

### Prisma Database Entities & Data Model

- **User**: User profiles, credentials, provider configuration (`ANONYMOUS`, `GOOGLE`, `INTERNET_IDENTITY`, `OIDC`), roles (`ADMIN`, `DEMO`, `INACTIVE`, `USER`), and associations.
- **Settings**: Per-user settings serialized as JSON.
- **Account**: User investment/cash accounts linked to user.
- **AccountBalance**: Chronological log of account balances over time.
- **Order (Activities)**: Trade entries (e.g., `BUY`, `SELL`, `DIVIDEND`, `FEE`, `INTEREST`, `LIABILITY`) linked to an Account and User, specifying a target `SymbolProfile`.
- **SymbolProfile**: Market assets or securities mapped to data sources (`YAHOO`, `COINGECKO`, `ALPHA_VANTAGE`, `GOOGLE_SHEETS`, etc.).
- **MarketData**: Historic/intraday asset prices.
- **Access**: Access permissions granting other users visibility to read portfolios.
- **ApiKey**: Keys allowing programmatic access.

---

## 2. Build and Test Commands

### Development Setup

1. **Clone and Install dependencies**:
   ```bash
   npm install
   ```
2. **Setup environment variables**:
   ```bash
   cp .env.dev .env
   ```
3. **Launch Docker Services (PostgreSQL & Redis)**:
   ```bash
   docker compose -f docker/docker-compose.dev.yml up -d
   ```
4. **Setup Database**:
   ```bash
   npm run database:setup
   ```
   _Note: This runs Prisma's db push and seeds dummy data._

### Running the Services

- **Start Backend API (NestJS)**:
  ```bash
  npm run start:server
  ```
- **Start Frontend Client (Angular)**:
  ```bash
  npm run start:client
  ```
  _The app runs at https://localhost:4200/en (self-signed SSL certificates required, see below)._
- **Start Storybook**:
  ```bash
  npm run start:storybook
  ```

### Database Migration & Synchronization

- **Prototyping / Push schema changes**:
  ```bash
  npm run database:push
  ```
- **Run Production Migrations**:
  ```bash
  npm run database:migrate
  ```
- **Prisma Studio (Database GUI)**:
  ```bash
  npm run database:gui
  ```
- **Generate prisma client client SDK typings**:
  ```bash
  npm run database:generate-typings
  ```

### SSL Certificate Generation

If you need to generate local self-signed SSL certificates for client HTTPS serving, run:

```bash
openssl req -x509 -newkey rsa:2048 -nodes -keyout apps/client/localhost.pem -out apps/client/localhost.cert -days 365 \
  -subj "/C=CH/ST=State/L=City/O=Organization/OU=Unit/CN=localhost"
```

---

## 3. Code Style Guidelines

All code conforms to specific style configurations. Formatters are run automatically before commits or can be executed manually.

### Code Formatting ([.prettierrc](file:///Users/ballesterosam/Personal/projects/ghostfolio/.prettierrc) & [.editorconfig](file:///Users/ballesterosam/Personal/projects/ghostfolio/.editorconfig))

- **Indentation**: 2 spaces (`useTabs: false`).
- **Quotes**: Single quotes (`singleQuote: true`) for JavaScript/TypeScript.
- **Trailing Commas**: None (`trailingComma: "none"`).
- **Line Width**: Max 80 characters (`printWidth: 80`).
- **Import Ordering**:
  - `@ghostfolio/*` paths first.
  - Third-party modules second.
  - Relative file imports (`./` or `../`) last.
- **HTML Layout**: Sorted template attributes using `prettier-plugin-organize-attributes`.

### ESLint Rules ([eslint.config.cjs](file:///Users/ballesterosam/Personal/projects/ghostfolio/eslint.config.cjs))

- **Module Boundaries**: Strictly enforced using `@nx/enforce-module-boundaries`. Circular dependencies across libs/apps are prohibited.
- **Unused variables**: Blocked, except catching errors without utilizing them (`caughtErrors: 'none'`).
- **Type Checking**: Strict type checking rules are configured, including warnings for `any` usage, floating promises, and unsafe assignments.
- **TypeScript Naming Conventions**: camelCase is preferred, UPPER_CASE allowed for variables/constants/properties. PascalCase required for classes/enums/interfaces.

---

## 4. Testing Instructions

Ghostfolio runs standard test suites across libraries and application projects.

### Commands

- **Run all unit tests**:
  ```bash
  npm test
  ```
- **Run API unit tests**:
  ```bash
  npm run test:api
  ```
- **Run Client unit tests**:
  ```bash
  npm run test:ui
  ```
- **Run Shared library tests**:
  ```bash
  npm run test:common
  ```
- **Watch tests continuously**:
  ```bash
  npm run watch:test
  ```
- **Run a specific test file**:
  ```bash
  npm run test:single -- --test-file=<filename.spec.ts>
  ```

_Testing is configured to load environment variables via `npx dotenv-cli` using [tsconfig.base.json](file:///Users/ballesterosam/Personal/projects/ghostfolio/tsconfig.base.json) and [jest.config.ts](file:///Users/ballesterosam/Personal/projects/ghostfolio/jest.config.ts)._

---

## 5. Security Considerations

### Input Validation

All incoming API requests must define DTOs located under `libs/common/src/lib/dtos`. These DTOs must use validation decorators from `class-validator` (e.g. `@IsString()`, `@IsUUID()`) to sanitize and assert type boundaries before processing.

### Authentication & Authorization

- **Authentication**: Uses NestJS `passport` modules including JWT bearer authorization (`passport-jwt`), session/API keys, WebAuthn/Passkeys, and OIDC / OAuth2 Google provider integration.
- **API Keys**: Authenticated via API-Key headers and mapped against the hashed database value (`ApiKey.hashedKey`).
- **Database Salt / Environment Secrets**: Essential credentials (`JWT_SECRET_KEY`, `ACCESS_TOKEN_SALT`) must be loaded from local environment `.env` files or secure runtime configuration and never committed.

### Role & Access Control

- **User Roles**: Roles mapped to the user (`ADMIN`, `DEMO`, `USER`, `INACTIVE`). The very first user created on a clean database receives the `ADMIN` role.
- **Shared Portfolio Permissions**: The `Access` model governs read/restricted-read delegations (`AccessPermission` list), defining permissions that users grant other users.

---

## 6. Experimental Features

Features can be guarded by user-specific configuration flags:

- **Backend (NestJS)**: Restrict permissions in `UserService` using the `without()` utility.
- **Frontend (Angular)**: Check experimental feature toggles in templates using `@if (user?.settings?.isExperimentalFeatures) { ... }`.
