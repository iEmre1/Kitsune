"use client";

import { useCallback, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

type PendingConfirmation = Required<ConfirmOptions> & {
  resolve: (confirmed: boolean) => void;
};

export function useConfirmDialog(defaults: ConfirmOptions = {}) {
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const pendingRef = useRef<PendingConfirmation | null>(null);

  const close = useCallback((confirmed: boolean) => {
    const current = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    current?.resolve(confirmed);
  }, []);

  const confirm = useCallback(
    (options: ConfirmOptions = {}) =>
      new Promise<boolean>((resolve) => {
        const next: PendingConfirmation = {
          title: options.title || defaults.title || "Devam edilsin mi?",
          description:
            options.description ||
            defaults.description ||
            "Bu işlemi gerçekleştirmek istediğinizden emin misiniz?",
          confirmLabel: options.confirmLabel || defaults.confirmLabel || "Evet",
          cancelLabel: options.cancelLabel || defaults.cancelLabel || "Vazgeç",
          resolve,
        };
        pendingRef.current?.resolve(false);
        pendingRef.current = next;
        setPending(next);
      }),
    [defaults.cancelLabel, defaults.confirmLabel, defaults.description, defaults.title],
  );

  const dialog = (
    <Dialog open={Boolean(pending)} onOpenChange={(open) => !open && close(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{pending?.title}</DialogTitle>
          <DialogDescription>{pending?.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => close(false)}>
            {pending?.cancelLabel || "Vazgeç"}
          </Button>
          <Button type="button" onClick={() => close(true)}>
            {pending?.confirmLabel || "Evet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { confirm, dialog };
}
