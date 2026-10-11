"use client";

import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";

export function SignaturePad({
  onSubmit,
  submitting,
}: {
  onSubmit: (dataUrl: string) => Promise<void>;
  submitting?: boolean;
}) {
  const ref = useRef<SignatureCanvas>(null);
  const [preview, setPreview] = useState<string | null>(null);

  function clear() {
    ref.current?.clear();
    setPreview(null);
  }

  function review() {
    if (!ref.current || ref.current.isEmpty()) {
      alert("Please draw your signature first.");
      return;
    }
    setPreview(ref.current.getTrimmedCanvas().toDataURL("image/png"));
  }

  async function submit() {
    if (!preview) return;
    await onSubmit(preview);
  }

  return (
    <div className="space-y-3 rounded-xl border bg-white p-4">
      <h3 className="font-medium">Electronic signature</h3>
      <p className="text-sm text-muted-foreground">
        Draw your signature, review it, then submit. This is an application
        signature capture — not a legal validity claim.
      </p>
      {!preview ? (
        <>
          <div className="rounded-md border border-dashed bg-slate-50">
            <SignatureCanvas
              ref={ref}
              penColor="#0f172a"
              canvasProps={{
                className: "h-40 w-full",
              }}
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={clear}>
              Clear
            </Button>
            <Button type="button" onClick={review}>
              Review signature
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="rounded-md border bg-slate-50 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Signature preview"
              className="mx-auto max-h-32"
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={clear}>
              Redraw
            </Button>
            <Button type="button" onClick={submit} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit signed document"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
