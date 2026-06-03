"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

/**
 * Responsive modal that renders a bottom Drawer on mobile
 * and a centered Dialog on desktop.
 *
 * Automatically switches between vaul Drawer (mobile) and
 * Radix Dialog (desktop) based on the current viewport width.
 */
export function ResponsiveModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          className={cn(
            "max-h-[92dvh] overflow-y-auto px-4 pb-8 pt-2",
            "safe-area-bottom",
            className,
          )}
        >
          <DrawerHeader className="px-0 text-left">
            <DrawerTitle className="text-[16px]">{title}</DrawerTitle>
            {description && (
              <DrawerDescription className="text-[12px]">{description}</DrawerDescription>
            )}
          </DrawerHeader>
          {children}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("max-h-[92dvh] overflow-y-auto", className)}
        aria-describedby={description ? undefined : undefined}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
