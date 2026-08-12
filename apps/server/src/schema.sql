-- Включаем расширение для UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Таблица папок
CREATE TABLE IF NOT EXISTS folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(100) NOT NULL,
    notes_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Таблица заметок (с оптимистичным версионированием)
CREATE TABLE IF NOT EXISTS notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    folder_id UUID REFERENCES folders(id) ON DELETE SET NULL, -- Твоя фича: улетают во входящие!
    title VARCHAR(255) NOT NULL,
    content TEXT,
    version INT DEFAULT 1, -- Оптимистичный замок
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Таблица тегов
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL
);

-- 4. Junction Table (Many-to-Many связка заметок и тегов)
CREATE TABLE IF NOT EXISTS notes_tags (
    note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (note_id, tag_id)
);

-- 🔍 Создаем частичный индекс, чтобы база летала на O(log N)
CREATE INDEX IF NOT EXISTS idx_notes_folder_id ON notes(folder_id) WHERE is_archived = FALSE;
