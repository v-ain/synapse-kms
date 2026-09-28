import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Calendar } from 'lucide-react';
import type { NotePreview } from '@synapse-kms/shared';

interface NoteCardProps {
  note: NotePreview;
}

export function NoteCard({ note }: NoteCardProps) {
  return (
    <Card className="hover:shadow-md transition-all duration-200 border-slate-200/80 flex flex-col justify-between">
      <CardHeader className="space-y-1">
        <CardTitle className="text-base font-semibold tracking-tight text-slate-900 line-clamp-1">
          {note.title || 'Без названия'}
        </CardTitle>
        {note.createdAt && (
          <CardDescription className="flex items-center gap-1 text-xs">
            <Calendar className="h-3 w-3" />
            {note.createdAt}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="text-sm text-slate-600 space-y-2 flex-1">
        {note.preview && <p className="line-clamp-3">{note.preview}</p>}
      </CardContent>
    </Card>
  );
}
