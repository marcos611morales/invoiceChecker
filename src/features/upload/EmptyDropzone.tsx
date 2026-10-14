"use client";

import { CloudUpload, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { es } from "@/lib/copy/es";
import { cn } from "cn";
import { useUpload } from "./UploadRoot";

/** Empty-screen dropzone card (D-09, D-24, D-25). The whole window is the drop target. */
export function EmptyDropzone() {
  const { openFiles, openFolder, processing, isDragGlobal } = useUpload();

  return (
    <Card
      data-testid="empty-dropzone"
      data-drag-over={isDragGlobal ? "true" : undefined}
      className={cn(
        "min-h-64 items-center justify-center gap-4 px-6 py-12 text-center ring-0",
        isDragGlobal
          ? "border border-solid border-primary bg-secondary"
          : "border border-dashed border-border",
      )}
    >
      <CloudUpload
        className="size-10 text-muted-foreground"
        aria-hidden="true"
      />
      <h2 className="text-[28px] leading-[1.2] font-semibold">
        {isDragGlobal ? es.empty.dragOver : es.empty.heading}
      </h2>
      <p className="text-sm">{es.empty.body}</p>
      <div className="flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
        <Button
          type="button"
          size="lg"
          disabled={processing}
          onClick={openFiles}
          className="max-sm:w-full"
        >
          {es.empty.selectFiles}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={processing}
          onClick={openFolder}
          className="max-sm:w-full"
        >
          {es.empty.selectFolder}
        </Button>
      </div>
      <div className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <ShieldCheck className="size-3" aria-hidden="true" />
          {es.global.privacyLine}
        </p>
        <p>{es.global.reloadNote}</p>
      </div>
    </Card>
  );
}
