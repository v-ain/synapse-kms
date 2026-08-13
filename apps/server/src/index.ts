import Fastify from 'fastify';
import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

interface Folder {
  id: string;
  title: string;
  notes_count: number;
  created_at: Date;
}

interface Note {
  id: string;
  folder_id: string | null;
  title: string;
  content?: string;
  preview?: string;
  version: number;
  is_archived: boolean;
  created_at: Date;
  updated_at: Date;
}

interface Tag {
  id: string;
  name: string;
}

const fastify = Fastify({ logger: true });

// 🎯 Подключаемся к нашему Docker-контейнеру
const sql = postgres('postgres://admin:secret@localhost:5432/synapse_dev');

// Костыль для ES-модулей, чтобы читать файлы по относительному пути
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🎯 Функция автоматической инициализации схемы БД
async function initDatabase() {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const sqlScript = fs.readFileSync(schemaPath, 'utf8');

    // Отправляем весь SQL-скрипт в базу одной транзакцией
    await sql.unsafe(sqlScript);
    console.log('✅ Database Schema Initialized Successfully');
  } catch (err) {
    console.error('❌ Failed to initialize database schema:', err);
    process.exit(1);
  }
}

// Простейший роут, который сделает тестовый запрос к системным часам Postgres
fastify.get('/ping', async (request, reply) => {
  // Выполняем самый примитивный встроенный запрос в Postgres
  const result = await sql`SELECT NOW();`;
  return {
    status: 'connected',
    db_time: result[0].now,
  };
});

// Простейший роут для проверки структуры
fastify.get('/db-status', async (request, reply) => {
  // Запрашиваем у системного каталога Postgres список созданных нами таблиц
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public';
  `;
  return { tables: tables.map((t) => t.table_name) };
});

// Эндпоинт создания папки
fastify.post<{ Body: { title: string } }>(
  '/folders',
  async (request, reply) => {
    const { title } = request.body;

    // Базовая Fail-Fast проверка на уровне JS
    if (!title || title.trim() === '') {
      return reply.status(400).send({ error: 'Title is required' });
    }

    try {
      // Проверяем, нет ли уже папки с таким именем (защита от дубликатов)
      const existing = await sql<
        Folder[]
      >`SELECT id FROM folders WHERE title = ${title.trim()}`;
      if (existing.length > 0) {
        return reply
          .status(409)
          .send({ error: 'Folder with this title already exists' });
      }

      // Делаем INSERT. Поле ID база сгенерирует сама через uuid_generate_v4()!
      // Через RETURNING * мы сразу возвращаем созданную строку из базы
      const [newFolder] = await sql<Folder[]>`
      INSERT INTO folders (title) 
      VALUES (${title.trim()}) 
      RETURNING *;
    `;

      return reply.status(201).send(newFolder);
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  }
);

// Эндпоинт создания заметки внутри конкретной папки
fastify.post<{
  Body: { title: string; content: string; folder_id: string | null };
}>('/notes', async (request, reply) => {
  const { title, content, folder_id } = request.body;

  // 1. Fail-Fast валидация входных данных
  if (!title || title.trim() === '') {
    return reply.status(400).send({ error: 'Title is required for a note' });
  }

  // Ограничение из твоей арифметики: максимум 5000 символов в теле
  if (content && content.length > 5000) {
    return reply
      .status(400)
      .send({ error: 'Note content exceeds the 5000 character limit' });
  }

  try {
    // 2. Если folder_id передан, проверяем, существует ли вообще такая папка
    if (folder_id) {
      const [folder] =
        await sql`SELECT id FROM folders WHERE id = ${folder_id}`;
      if (!folder) {
        return reply.status(404).send({ error: 'Target folder not found' });
      }
    }

    // Атомарная транзакция ACID
    const [newNote] = await sql.begin(async (sql) => {
      // Шаг А: Вставляем заметку. Если folder_id равен null, она улетит во "Входящие"
      // INSERT возвращает только метаданные (без content) для экономии RAM сокетов!
      const [note] = await sql<Note[]>`
        INSERT INTO notes (title, content, folder_id)
        VALUES (${title.trim()}, ${content || ''}, ${folder_id || null})
        RETURNING id, folder_id, title, version, is_archived, created_at, updated_at, substring(content from 1 for 150) as preview;; 
      `;

      // Шаг Б: Если заметка создана внутри папки, атомарно инкрементируем счетчик папки
      if (folder_id) {
        await sql`
          UPDATE folders 
          SET notes_count = notes_count + 1 
          WHERE id = ${folder_id};
        `;
      }

      return [note]; // Возвращаем созданную заметку наружу из транзакции
    });

    return reply.status(201).send(newNote);
  } catch (err) {
    fastify.log.error(err);
    return reply
      .status(500)
      .send({ error: 'Internal Server Error during note creation' });
  }
});

// Эндпоинт получения всех папок (Тот самый O(1) плоский список)
fastify.get('/folders', async (request, reply) => {
  try {
    // Просто вытаскиваем все папки, сортируя по дате создания
    const allFolders = await sql<Folder[]>`
      SELECT id, title, notes_count, created_at 
      FROM folders 
      ORDER BY created_at DESC;
    `;
    return allFolders;
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Internal Server Error' });
  }
});

// РОУТ: Ленточное получение заметок с пагинацией (Lazy Fetching)
fastify.get<{
  Querystring: {
    folder_id?: string;
    filter?: 'all' | 'inbox' | 'folder';
    limit?: string;
    offset?: string;
  };
}>('/notes', async (request, reply) => {
  const { folder_id, filter = 'all', limit, offset } = request.query;

  const parsedLimit = Math.min(parseInt(limit || '20', 10), 50);
  const parsedOffset = parseInt(offset || '0', 10);

  try {
    // Формируем динамическое условие WHERE, учитывая алиас таблицы 'n'
    let folderCondition = sql``;
    if (filter === 'inbox') {
      folderCondition = sql`AND n.folder_id IS NULL`;
    } else if (filter === 'folder' && folder_id) {
      folderCondition = sql`AND n.folder_id = ${folder_id}`;
    } else if (filter === 'folder' && !folder_id) {
      return reply
        .status(400)
        .send({ error: 'folder_id is required for "folder" filter' });
    }

    // 🎯 ХАРДКОРНЫЙ ПРОМЫШЛЕННЫЙ SQL С АГРЕГАЦИЕЙ ТЕГОВ
    const notes = await sql<Note[]>`
      SELECT 
        n.id, 
        n.folder_id, 
        n.title, 
        n.version, 
        n.is_archived, 
        n.created_at, 
        n.updated_at,
        substring(n.content from 1 for 150) as preview,
        -- Магия Postgres: собираем имена тегов из таблицы связей в один чистый массив JSON.
        -- COALESCE нужен, чтобы вернуть пустой массив [], а не NULL, если тегов нет.
        COALESCE(
          json_agg(t.name) FILTER (WHERE t.name IS NOT NULL), 
          '[]'::json
        ) as tags
      FROM notes n
      LEFT JOIN notes_tags nt ON n.id = nt.note_id
      LEFT JOIN tags t ON nt.tag_id = t.id
      WHERE n.is_archived = FALSE ${folderCondition}
      GROUP BY n.id -- Группируем по ID заметки, чтобы схлопнуть дубликаты строк!
      ORDER BY n.updated_at DESC
      LIMIT ${parsedLimit}
      OFFSET ${parsedOffset};
    `;

    return notes;
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Internal Server Error' });
  }
});

// РОУТ: Создание уникального тега
fastify.post<{ Body: { name: string } }>('/tags', async (request, reply) => {
  const { name } = request.body;

  if (!name || name.trim() === '') {
    return reply.status(400).send({ error: 'Tag name is required' });
  }

  try {
    // Чистим имя от пробелов и переводим в нижний регистр (стандарт для тегов #crypto, #sql)
    const cleanName = name.trim().toLowerCase();

    // Проверяем дубликаты
    const existing = await sql<
      Tag[]
    >`SELECT id FROM tags WHERE name = ${cleanName}`;
    if (existing.length > 0) {
      return reply.status(409).send({ error: 'Tag already exists' });
    }

    const [newTag] = await sql<Tag[]>`
      INSERT INTO tags (name) VALUES (${cleanName}) RETURNING *;
    `;
    return reply.status(201).send(newTag);
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Internal Server Error' });
  }
});

// РОУТ: Привязка тега к заметке (Запись в Junction Table)
// 🏷️ ОБНОВЛЕННЫЙ РОУТ: Атомарное создание + привязка тега по имени за один запрос!
fastify.post<{
  Body: { note_id: string; tag_name: string }; // 🎯 Принимаем имя, а не ID!
}>('/notes/attach-tag', async (request, reply) => {
  const { note_id, tag_name } = request.body;

  if (!note_id || !tag_name || tag_name.trim().length === 0) {
    return reply
      .status(400)
      .send({ error: 'Both note_id and tag_name are required' });
  }

  const cleanTagName = tag_name.trim().toLowerCase(); // Приводим к нижнему регистру для порядка

  try {
    await sql.begin(async (sql) => {
      // 💥 ШАГ А: Магия Postgres. Создаем тег. Если он уже есть — ON CONFLICT вернет его ID!
      const [tag] = await sql<{ id: string }[]>`
        INSERT INTO tags (name) 
        VALUES (${cleanTagName})
        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name -- Фиктивный апдейт ради RETURNING
        RETURNING id;
      `;

      // ШАГ Б: Связываем тег и заметку в Junction Table
      // Используем ON CONFLICT DO NOTHING на случай, если этот тег уже привязан к заметке
      await sql`
        INSERT INTO notes_tags (note_id, tag_id)
        VALUES (${note_id}, ${tag.id})
        ON CONFLICT DO NOTHING;
      `;
    });

    return { success: true, message: 'Tag successfully created and attached.' };
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Internal Server Error' });
  }
});

// РОУТ: Получение полного контента конкретной заметки по UUID
fastify.get<{
  Params: { id: string };
}>('/notes/:id', async (request, reply) => {
  const { id } = request.params;

  // Проверяем UUID на примитивном уровне (длина) перед походом в базу
  if (!id || id.length !== 36) {
    return reply.status(400).send({ error: 'Invalid UUID format' });
  }

  try {
    // Вытаскиваем строго одну запись. И вот тут мы запрашиваем поле 'content'!
    const [note] = await sql<Note[]>`
      SELECT id, folder_id, title, content, version, is_archived, created_at, updated_at
      FROM notes
      WHERE id = ${id} AND is_archived = FALSE;
    `;

    // Fail-Fast: Если заметка не найдена или заархивирована — отдаём 404
    if (!note) {
      return reply.status(404).send({ error: 'Note not found' });
    }

    return note;
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Internal Server Error' });
  }
});

// РОУТ: Удаление папки с автоматическим переводом заметок во "Входящие"
fastify.delete<{
  Params: { id: string };
}>('/folders/:id', async (request, reply) => {
  const { id } = request.params;

  if (!id || id.length !== 36) {
    return reply.status(400).send({ error: 'Invalid UUID format' });
  }

  try {
    // Проверяем, существует ли вообще папка
    const [folder] = await sql`SELECT id FROM folders WHERE id = ${id}`;
    if (!folder) {
      return reply.status(404).send({ error: 'Folder not found' });
    }

    // 🎯 ВЫПОЛНЯЕМ УДАЛЕНИЕ
    // Благодаря нашему DDL-правилу 'ON DELETE SET NULL', база сама обнулит folder_id у всех дочерних заметок!
    await sql`DELETE FROM folders WHERE id = ${id};`;

    return {
      success: true,
      message: 'Folder deleted successfully. All notes moved to Inbox.',
    };
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Internal Server Error' });
  }
});

// РОУТ: Высоконагруженное редактирование заметки (Оптимистичный замок + CTE Агрегация тегов)
fastify.put<{
  Params: { id: string };
  Body: {
    title: string;
    content: string;
    version: number;
  };
}>('/notes/:id', async (request, reply) => {
  const { id } = request.params;
  const { title, content, version } = request.body;

  if (!id || id.length !== 36 || version === undefined) {
    return reply
      .status(400)
      .send({ error: 'Invalid parameters or missing version' });
  }

  try {
    // 🎯 ВЫЖИМАЕМ МАКСИМУМ ИЗ ПОСТГРЕСА: Атомарный UPDATE + LEFT JOIN в один сетевой запрос
    const updatedNotes = await sql<Note[]>`
      WITH updated_note AS (
        UPDATE notes
        SET 
          title = ${title.trim()},
          content = ${content || ''},
          version = version + 1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id} AND version = ${version} -- Проверяем, что никто не переписал данные
        RETURNING id, folder_id, title, version, is_archived, created_at, updated_at, content
      )
      SELECT 
        un.id, 
        un.folder_id, 
        un.title, 
        un.version, 
        un.is_archived, 
        un.created_at, 
        un.updated_at,
        substring(un.content from 1 for 150) as preview, -- Ленивое превью для кэша списка
        COALESCE(
          json_agg(t.name) FILTER (WHERE t.name IS NOT NULL), 
          '[]'::json
        ) as tags -- Агрегируем теги в плоский массив JSON
      FROM updated_note un
      LEFT JOIN notes_tags nt ON un.id = nt.note_id
      LEFT JOIN tags t ON nt.tag_id = t.id
      GROUP BY un.id, un.folder_id, un.title, un.version, un.is_archived, un.created_at, un.updated_at, un.content;
    `;

    // Если оптимистичный замок сработал (версии не совпали) — отдаём 409 Conflict
    if (updatedNotes.length === 0) {
      return reply.status(409).send({
        error:
          'Conflict! This note has been modified by another process. Please pull latest changes.',
      });
    }

    // Возвращаем на фронтенд идеальный монолитный объект
    return updatedNotes;
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Internal Server Error' });
  }
});

// РОУТ: Мягкое удаление (Архивация заметки) с пересчётом счётчика папки O(1)
fastify.patch<{
  Params: { id: string };
}>('/notes/:id/archive', async (request, reply) => {
  const { id } = request.params;

  if (!id || id.length !== 36) {
    return reply.status(400).send({ error: 'Invalid UUID format' });
  }

  try {
    // Запускаем атомарную транзакцию
    const result = await sql.begin(async (sql) => {
      // Шаг А: Проверяем, существует ли активная заметка и привязана ли она к папке
      const [note] = await sql`
        SELECT folder_id, is_archived FROM notes WHERE id = ${id};
      `;

      if (!note) {
        return { status: 404, error: 'Note not found' };
      }

      if (note.is_archived) {
        return { status: 400, error: 'Note is already archived' };
      }

      // Шаг Б: Выставляем флаг мягкого удаления
      await sql`
        UPDATE notes 
        SET is_archived = TRUE, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ${id};
      `;

      // Шаг В: Если она лежала в папке, атомарно уменьшаем счётчик активных заметок папки
      if (note.folder_id) {
        await sql`
          UPDATE folders 
          SET notes_count = notes_count - 1 
          WHERE id = ${note.folder_id};
        `;
      }

      return { status: 200, success: true };
    });

    if (result.error) {
      return reply.status(result.status).send({ error: result.error });
    }

    return { success: true, message: 'Note successfully archived.' };
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Internal Server Error' });
  }
});

// РОУТ: Пакетное перемещение с жестким контролем версий строк!
fastify.post<{
  Body: {
    items: { id: string; version: number }[];
    target_folder_id: string | null;
  };
}>('/notes/bulk-move', async (request, reply) => {
  const { items, target_folder_id } = request.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return reply
      .status(400)
      .send({ error: 'Array of items [{id, version}] is required' });
  }

  // Вытаскиваем массив ID для удобства подзапросов
  const noteIds = items.map((i) => i.id);

  try {
    const conflictDetected = await sql.begin(async (sql) => {
      // Шаг А: Запоминаем, где сейчас лежат заметки (для будущих счетчиков)
      const sourceFolders = await sql<{ folder_id: string | null }[]>`
        SELECT folder_id FROM notes WHERE id = ANY(${noteIds}) AND folder_id IS NOT NULL;
      `;

      // Шаг Б: Пакетный UPDATE с проверкой ИНДИВИДУАЛЬНОЙ версии каждой заметки!
      // Мы разворачиваем присланный JS-массив в виртуальную таблицу данных v(id, version)
      const updated = await sql`
        UPDATE notes n
        SET 
          folder_id = ${target_folder_id || null},
          version = n.version + 1, -- Инкрементируем версию при перемещении!
          updated_at = CURRENT_TIMESTAMP
        FROM (
          VALUES ${sql(items.map((i) => [i.id, i.version]))}
        ) AS v(id, version)
        WHERE n.id = v.id::uuid AND n.version = v.version::integer -- Проверяем замок!
        RETURNING n.id;
      `;

      // 🚨 Если количество обновленных строк МЕНЬШЕ, чем прислал фронтенд — значит какая-то заметка уже изменена!
      if (updated.length !== items.length) {
        return true; // Сигнализируем о конфликте
      }

      // Шаг В: Если всё ок — пересчитываем счетчики старых папок
      if (sourceFolders.length > 0) {
        const uniqueOldFolderIds = [
          ...new Set(sourceFolders.map((f) => f.folder_id)),
        ];
        await sql`
          UPDATE folders f
          SET notes_count = (SELECT COUNT(*) FROM notes WHERE folder_id = f.id AND is_archived = FALSE)
          WHERE f.id = ANY(${uniqueOldFolderIds});
        `;
      }

      // Шаг Г: Пересчитываем счетчик новой целевой папки
      if (target_folder_id) {
        await sql`
          UPDATE folders f
          SET notes_count = (SELECT COUNT(*) FROM notes WHERE folder_id = f.id AND is_archived = FALSE)
          WHERE f.id = ${target_folder_id};
        `;
      }

      return false;
    });

    if (conflictDetected) {
      return reply.status(409).send({
        error:
          'Conflict! One or more notes have been modified or moved by another process.',
      });
    }

    return {
      success: true,
      message: `Successfully moved ${items.length} notes.`,
    };
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Internal Server Error' });
  }
});

// РОУТ: Пакетная архивация заметок за один SQL-запрос
fastify.post<{
  Body: { note_ids: string[] };
}>('/notes/bulk-archive', async (request, reply) => {
  const { note_ids } = request.body;

  if (!note_ids || !Array.isArray(note_ids) || note_ids.length === 0) {
    return reply.status(400).send({ error: 'Array of note_ids is required' });
  }

  try {
    await sql.begin(async (sql) => {
      // Шаг А: Узнаем, в каких папках лежали эти заметки перед удалением
      const affectedFolders = await sql<{ folder_id: string }[]>`
        SELECT DISTINCT folder_id FROM notes WHERE id = ANY(${note_ids}) AND folder_id IS NOT NULL;
      `;

      // Шаг Б: Одним махом архивируем все выбранные заметки
      await sql`
        UPDATE notes 
        SET is_archived = TRUE, updated_at = CURRENT_TIMESTAMP
        WHERE id = ANY(${note_ids});
      `;

      // Шаг В: Если заметки лежали в папках, обновляем счетчики этих папок
      if (affectedFolders.length > 0) {
        const folderIds = affectedFolders.map((f) => f.folder_id);
        await sql`
          UPDATE folders f
          SET notes_count = (SELECT COUNT(*) FROM notes WHERE folder_id = f.id AND is_archived = FALSE)
          WHERE f.id = ANY(${folderIds});
        `;
      }
    });

    return {
      success: true,
      message: `Successfully archived ${note_ids.length} notes.`,
    };
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Internal Server Error' });
  }
});

// РОУТ: Отвязка тега от заметки (Удаление связи из Junction Table)
fastify.post<{
  Body: { note_id: string; tag_id: string };
}>('/notes/detach-tag', async (request, reply) => {
  const { note_id, tag_id } = request.body;

  if (!note_id || !tag_id) {
    return reply
      .status(400)
      .send({ error: 'Both note_id and tag_id are required' });
  }

  try {
    // Просто вырезаем строку связи Many-to-Many.
    // Сама заметка и сам тег остаются абсолютно целыми в своих таблицах!
    const result = await sql`
      DELETE FROM notes_tags 
      WHERE note_id = ${note_id} AND tag_id = ${tag_id}
      RETURNING note_id;
    `;

    // Fail-Fast: Если связи и не было, возвращаем 404
    if (result.length === 0) {
      return reply
        .status(404)
        .send({ error: 'Relation between this Note and Tag not found' });
    }

    return { success: true, message: 'Tag successfully detached from note.' };
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Internal Server Error' });
  }
});

// РОУТ: Получение списка вообще всех существующих тегов (Для панели фильтров)
fastify.get('/tags', async () => {
  try {
    return await sql<Tag[]>`
      SELECT id, name 
      FROM tags 
      ORDER BY name ASC;
    `;
  } catch (err) {
    fastify.log.error(err);
    throw err;
  }
});

const start = async () => {
  try {
    // Сначала инициализируем базу, затем поднимаем сеть
    await initDatabase();
    await fastify.listen({ port: 3000 });
    console.log('🚀 Synapse Server running at http://localhost:3000');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
