"use client";

import type { ReactNode } from "react";
import { Drawer } from "@/components/ui/Drawer";

export interface DetailDrawerProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title?: ReactNode;
  readonly children?: ReactNode;
  readonly footer?: ReactNode;
}

/**
 * The row-detail affordance (WD §3.6): a right-hand drawer that shows a
 * resource's details in place, without leaving the list. For full pages,
 * navigate to a `[id]` DetailShell instead.
 */
export function DetailDrawer({ open, onClose, title, children, footer }: DetailDrawerProps) {
  return (
    <Drawer open={open} onClose={onClose} title={title} footer={footer} side="right" width="30rem">
      {children}
    </Drawer>
  );
}
