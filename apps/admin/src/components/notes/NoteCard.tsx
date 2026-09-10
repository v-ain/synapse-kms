import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, Calendar } from 'lucide-react'; // npm i lucide-react (иконки)

interface NoteCardProps {
  note: {
    id: string | number;
    title: string;
    url?: string;
    content?: string;
    createdAt?: string;
  };
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

        {note.url || (
          <div className="pt-2">
            <a
              href={note.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline break-all"
            >
              <span>{'note.url'}</span>
              <ExternalLink className="h-3 w-3 flex-shrink-0" />
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
