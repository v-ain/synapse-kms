import type { Folder } from '@synapse-kms/shared';

export class FoldersController {
  constructor(
    private sql: any,
    private log: any
  ) {}

  // Получить список папок с сортировкой по времени создания
  async getFolders(): Promise<Folder[]> {
    return this.sql<Folder[]>`
      SELECT id, title, notes_count, created_at 
      FROM folders 
      WHERE is_deleted = FALSE -- Отсекаем удаленные папки!
      ORDER BY created_at DESC;
    `;
  }

  // Создать новую папку
  async createFolder(title: string): Promise<Folder> {
    const [folder] = await this.sql<Folder[]>`
      INSERT INTO folders (title) 
      VALUES (${title.trim()}) 
      RETURNING id, title, notes_count, created_at;
    `;
    return folder;
  }

  // ENTERPRISE SOFT DELETE ПАПКИ
  async deleteFolder(id: string): Promise<void> {
    // Запускаем ACID транзакцию
    await this.sql.begin(async (sql: any) => {
      // 1. Мягко удаляем саму папку
      await sql`
        UPDATE folders 
        SET is_deleted = TRUE 
        WHERE id = ${id};
      `;

      // 2. Имитируем каскад: переносим все ЖИВЫЕ заметки из этой папки во Входящие (NULL)
      // Попутно инкрементируем их версии, так как метаданные заметок изменились!
      await sql`
        UPDATE notes 
        SET 
          folder_id = NULL,
          version = version + 1,
          updated_at = CURRENT_TIMESTAMP
        WHERE folder_id = ${id} AND is_deleted = FALSE;
      `;
    });
  }
}
