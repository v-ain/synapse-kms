# 🧠 Synapse KMS (Knowledge Management System)

High-performance, distributed knowledge management ecosystem.

### 🚀 Architectural Philosophy

`synapse-kms` targets optimal hardware utilization and microsecond-level runtime efficiency. The project intentionally eliminates redundant runtime abstractions in favor of direct, observable control over operating system processes, network sockets, and data persistence layers. 

This production-ready monorepo is built for maximum performance, strict type-safety, and independent deployment. It bypasses the overhead of heavy frameworks like Next.js/Nest.js in favor of a lightning-fast **Fastify** backend and a clean **React SPA** powered by **TanStack Query**.

---

## 🛠️ Tech Stack

- **Monorepo Architecture:** `npm workspaces` (No Turborepo/Nx overhead)
- **Backend:** [Fastify](https://fastify.dev) (High-performance Node.js framework)
- **Frontend:** [React](https://react.dev) + [TanStack Query](https://tanstack.com) (Lean Single Page Application)
- **API Layer:** [tRPC](https://trpc.io) + [Zod](https://zod.dev) (End-to-End type-safety without code generation)
- **Database & ORM:** [PostgreSQL](https://postgresql.org) + [Drizzle ORM](https://drizzle.team)

---

## 🏗️ Architecture & Package Breakdown

The project is structured to keep strict separation of concerns while maintaining seamless type synchronization between client and server via **TS Path Aliases** (zero manual build steps required during dev mode).

```text
├── apps/
│   ├── client/          # React SPA (Vite, pure TS/JS, no UI-library locks)
│   └── server/          # Fastify App (Node.js backend, tRPC plugin runner)
├── packages/
│   ├── shared/          # Shared types, Zod schemas, schema definitions (The Core)
│   ├── trpc/            # Pure tRPC Routers
│   └── db-scripts/      # Drizzle ORM setup,  and PG pool instance
├── docker-compose.yml
└── package.json
```

### ⚡ Key Architectural Features

1. **End-to-End Type-Safety:** Any change in the database schema or Zod validators instantly updates the frontend autocomplete and throws compile-time errors in React components if mismatched.
2. **Optimized Serialization:** Solved the common tRPC/Drizzle type-degradation issue with JavaScript `Date` objects by utilizing Drizzle's `timestamp(..., { mode: 'string' })`. This keeps the data transport lightweight, shifts validation to Zod (`z.string().datetime()`), and speeds up server responses by avoiding CPU-heavy Date parsing.
3. **High-Performance UI Rendering:** Heavy text editing components are engineered around native DOM nodes (`defaultValue`) and memory-backed refs. This isolates continuous typing inputs from React's VDOM, completely eliminating interface lag on large-scale notes.
4. **Independent Deployment:** The backend (`apps/server`) can be easily containerized via Docker and deployed to any VPS, while the frontend (`apps/client`) can be shipped to cheap static hosting (S3, Vercel, Netlify).

---

## 🔄 Concurrency & Concurrency Control (v0.5.0)

Synapse KMS utilizes a lock-free **Last-Write-Wins (LWW)** conflict resolution strategy backed by microsecond-precision client timestamps, replacing fragile sequential version-increment checks.

```text
┌────────────────────────┐         tRPC Mutation          ┌────────────────────────┐
│  Client (NoteEditor)   │ ─────────────────────────────> │   Postgres Database    │
│  [currentTextRef] LWW  │ <───────────────────────────── │ client_updated_at Check│
└────────────────────────┘    Atomic SQL Confirmation     └────────────────────────┘
```

- **Derived Sync States:** The client architecture leverages a strict state machine (`saved` | `dirty` | `saving` | `error`) computed on the fly to provide instant layout updates without cascading VDOM re-renders.
- **Atomic SQL Enforcement:** Database updates perform conditional downstream writes (`lt(notesTable.clientUpdatedAt, payload.clientUpdatedAt)`), ensuring out-of-order network packets never corrupt the knowledge graph.
- **Resilient Synapses:** Mutation bindings include built-in network retries with exponential backoff, making text synchronization immune to short-term connection drops.

---
## 🚀 Quick Start & Development Guide

### Prerequisites
Ensure you have the following installed on your host machine:
* **Node.js** (v20+ recommended)
* **npm** (v10+ with native workspaces support)
* **Docker** or **Podman** (with `docker-compose` plugin)


### 1. Environment Configuration
The monorepo shares environments via localized `.env` definitions. Copy the example templates in the root directory:

```bash
# Copy and configure environment variables
cp .env.example .env
```

### 2. Infrastructure Setup (Database)
Spin up the isolated PostgreSQL container using your container runtime engine:

```bash
# Start PostgreSQL via Docker Compose
docker compose up -d
```

### 3. Dependency Installation & Migrations
Install all monorepo dependencies at once using native npm workspaces. The system will automatically map local package path aliases without external build tooling.

```bash
# Install everything from the root directory
npm install

# Runs existing SQL migrations
npm run db:migrate
```

### 4. Running the Application
Launch both the Fastify backend and the React Vite SPA concurrently under a unified terminal stream:

```bash
# Starts apps/server and apps/client simultaneously in development mode
npm run dev
```

* **Frontend SPA** will be accessible at: `http://localhost:5173`
* **tRPC/Fastify API** runner will listen at: `http://localhost:3037`

### 5. Executing the Test Suite
Run the high-performance Vitest integration suite running over the lightweight `happy-dom` isolation layer:

```bash
# Run all workspace test specifications
npm run test
```

### ⚡ Concurrency & Network Streaming Physics

#### Read-Modify-Write Mitigation (LWW Conflict Resolution)
To achieve extreme RPS (Requests Per Second) throughput without bottlenecking database threads with blocking heavy raw locks (`FOR UPDATE`), the system implements a lock-free **Last-Write-Wins (LWW)** methodology. 
Mutations evaluate concurrent mutations on ingestion using microsecond-precision client timestamps (`client_updated_at`). Atomic database writes execution checks are performed downstream (`lt(notesTable.clientUpdatedAt, payload.clientUpdatedAt)`), ensuring out-of-order network packets never corrupt or rollback more recent knowledge definitions.

#### Buffer Streaming & Network Slices
The Node.js networking subsystem (`net.Socket`) fetches chunks aligned to operating system packets (MTU limits ~1.5 KB to 64 KB buffers). The underlying native TCP driver maps data streams precisely against PostgreSQL backend binary protocol markers (DataRow headers + message length specifications). This enables true server-side memory profiling boundaries: 

* **Lazy List Loading:** Fetches descriptive items omitting note body properties. 50-row batch payloads scale at a lightweight ~75 KB threshold.
* **Targeted Document Parsing:** Resolves massive data structures (restricted up to a strict 5,000 UTF-16 character limit — ~10 KB memory space per active note body) over explicit \(O(\log N)\) index evaluation trees.

#### 🎨 Client State Separation Architecture
* **TanStack Query (Server State Cache):** Handles all asynchronous I/O with automatic Garbage Collection thresholds (`gcTime`), maintaining atomic client-side hash maps of server conditions. It enforces lazy fetching and automatic cache invalidation during state mutation.
* **Zustand (Client Interface Coordinates):** Dedicated exclusively to temporary layout configurations (e.g., active note selection layout tracking or navigation toggle markers), entirely separate from remote persistent definitions.
