### Synapse KMS (Knowledge Management System)

High-performance, enterprise-grade distributed knowledge management ecosystem built with a focus on strict low-level resource management, predictable data constraints, and high-concurrency architecture. 

### 🧠 Architectural Philosophy

`synapse-kms` targets optimal hardware utilization and microsecond-level runtime efficiency. The project intentionally eliminates redundant runtime abstractions in favor of direct, observable control over operating system processes, network sockets, and data persistence layers. 

### 🛠 Tech Stack (Production-Ready)

* **Backend:** Node.js Core, Fastify (TypeScript), Zod Validation, postgres native TCP driver.
* **Database:** PostgreSQL (with explicit strict normal forms, composite indexing, and transactional integrity).
* **Frontend:** React 19, TypeScript, TanStack Query (Server-state caching), Zustand (Ephemeric client UI state), SCSS Modules.
* **Infrastructure:** Docker, Docker Compose (multi-stage builds), Linux (Fedora Core CLI development), Bash scripting.

### 💾 Database Schema & Boundary Constraints

### Data Layout Configuration

The system relies exclusively on fully randomized **UUIDv4** keys to decouple database exposure from sequential predictable vulnerabilities (IDOR). 

```sql

-- Conceptual DDL Manifest
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    notes_count INT DEFAULT 0, -- Atomic flat counter for O(1) visibility optimization
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES folders(id) ON DELETE SET NULL, -- Soft detachment strategy
    title VARCHAR(255) NOT NULL,
    content TEXT,
    version INT DEFAULT 1, -- Optimistic concurrency control layer
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    CONSTRAINT unique_user_tag UNIQUE (user_id, name)
);

CREATE TABLE notes_tags (
    note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (note_id, tag_id) -- Auto-generated composite B-Tree Index
);


### Highload Query Optimization Design

* **One-to-Many Relationships:** Handled via deterministic references with `ON DELETE SET NULL` for clean folder-to-inbox automatic entity routing.
* **Many-to-Many Connections:** Structured via strict isolated Junction Table (`notes_tags`) mapping complex network structures with execution speeds scaling gracefully at 𝑂(log𝑁) via balanced B-Tree primary indexing.
* **Partial Functional Indexing:** `CREATE INDEX idx_notes_folder_id ON notes(folder_id) WHERE is_archived = FALSE;`
Ensures storage overhead optimization by restricting indexing structures from tracking inactive/dead rows.

### ⚡ Concurrency & Network Streaming Physics

### Read-Modify-Write Mitigation

To achieve high RPS (Requests Per Second) limits without bottlenecking hardware threads with blocking heavy locks (`FOR UPDATE`), the system implements **Optimistic Concurrency Control (OCC)**.
Mutations evaluate explicit states during ingestion: 

```sql

UPDATE notes SET title = $1, version = version + 1 WHERE id = $2 AND version = $3;
```

If `affectedRows === 0`, runtime captures conflicts gracefully without stalling pool connections at the Linux process level. 

### Buffer Streaming & Network Slices

The Node.js networking subsystem (`net.Socket`) fetches chunks aligned to operating system packets (MTU limits ~1.5 KB to 64 KB buffers). The underlying native TCP driver maps data streams precisely against PostgreSQL backend binary protocol markers (`DataRow` headers + message length specifications).
This enables true server-side memory profiling boundaries: 

* **Lazy List Loading:** Fetches descriptive items omitting note body properties. 50-row batch payloads scale at a lightweight ~75 KB threshold.
* **Targeted Document Parsing:** Resolves massive data structures (restricted up to a strict 5,000 UTF-16 character limit — ~10 KB memory space per active note body) over explicit 𝑂(log𝑁) index evaluation trees.

### 🎨 Client State Separation Architecture

1. **TanStack Query (Server State Cache):** Handles all asynchronous I/O with automatic Garbage Collection thresholds (`gcTime`), maintaining atomic client-side hash maps of server conditions. It enforces lazy fetching and automatic cache invalidation during state mutation.
2. **Zustand (Client Interface Coordinates):** Dedicated exclusively to temporary layout configurations (e.g., active theme states like `Tokyo Night` or navigation toggle markers), entirely separate from remote persistent definitions.
