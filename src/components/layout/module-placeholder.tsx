import { Badge } from "@/components/ui/badge";

type Props = {
  title: string;
  description: string;
  milestone: number;
};

export function ModulePlaceholder({ title, description, milestone }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <p className="board-header">Módulo</p>
        <h1 className="font-display text-3xl font-bold text-foreground">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="board-panel flex flex-col items-start gap-3 p-8">
        <Badge variant="warn">Milestone {milestone}</Badge>
        <p className="text-sm text-foreground/80">
          Esta sección tiene ruta, navegación y control de acceso por rol activos. La lógica de
          negocio se implementará en el milestone indicado.
        </p>
      </div>
    </div>
  );
}
