import type { Folder } from '@synapse-kms/shared';

export class FoldersController {
  constructor(
    private sql: any,
    private log: any
  ) {}

  // Получить список папок с сортировкой по времени создания
  async getFolders(userId: string): Promise<Folder[]> {
    return this.sql<Folder[]>`
      SELECT id, title, notes_count, created_at 
      FROM folders 
      WHERE is_deleted = FALSE AND user_id = ${userId} -- segmetation
      ORDER BY created_at DESC;
    `;
  }

  // Создать новую папку
  async createFolder(title: string, userId: string): Promise<Folder> {
    const [folder] = await this.sql<Folder[]>`
      INSERT INTO folders (title, user_id) -- Записываем владельца!
      VALUES (${title.trim()}, ${userId}) 
      RETURNING id, title, notes_count, created_at;
    `;
    return folder;
  }

  // SOFT DELETE ПАПКИ
  async deleteFolder(id: string, userId: string): Promise<void> {
    await this.sql.begin(async (sql: any) => {
      // Защита: удалить можно только СВОЮ папку
      await sql`UPDATE folders SET is_deleted = TRUE WHERE id = ${id} AND user_id = ${userId};`;
      await sql`UPDATE notes SET folder_id = NULL, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE folder_id = ${id} AND user_id = ${userId} AND is_deleted = FALSE;`;
    });
  }
}
