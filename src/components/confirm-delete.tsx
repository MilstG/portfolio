import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

export function ConfirmDelete({
  open,
  title,
  body,
  onClose,
  onConfirm,
  pending,
}: {
  open: boolean;
  title: string;
  body: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  pending?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()} title={title} description={body}>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          variant="danger"
          disabled={pending}
          onClick={async () => {
            await onConfirm();
          }}
        >
          {pending ? "Eliminando…" : "Eliminar"}
        </Button>
      </div>
    </Dialog>
  );
}
