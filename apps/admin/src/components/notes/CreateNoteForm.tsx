import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Link2 } from 'lucide-react';

export const CreateNoteForm = () => {
  const [newUrl, setNewUrl] = useState('');

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardContent className="pt-6">
        <form className="flex gap-3">
          <div className="relative flex-1">
            <Link2 className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Вставьте ссылку, чтобы открыть её на другом устройстве..."
              className="pl-9"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
            />
          </div>
          <Button type="submit">Поиск</Button>
        </form>
      </CardContent>
    </Card>
  );
};
