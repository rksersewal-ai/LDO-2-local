import { AlertTriangle, Check } from "lucide-react";
import { Badge } from "./Shared";
import { Spinner } from "./spinner";

interface OcrStatusBadgeProps {
  status: string;
  confidence?: number | null;
  failureReason?: string;
}

/**
 * OcrStatusBadge - Renders OCR status with appropriate icon and animation.
 *
 * - Processing: blue spinner + "OCR Processing" with pulse animation
 * - Completed: green checkmark + confidence percentage
 * - Failed: red warning + "OCR Failed"
 * - Pending/Not Required: gray neutral badge
 */
export function OcrStatusBadge({ status, confidence, failureReason }: OcrStatusBadgeProps) {
  const normalized = status?.toLowerCase() ?? "";

  if (normalized === "processing") {
    return (
      <Badge variant="processing" size="sm" className="inline-flex items-center gap-1">
        <Spinner className="size-3" />
        <span>OCR Processing</span>
      </Badge>
    );
  }

  if (normalized === "completed") {
    return (
      <Badge variant="success" size="sm" className="inline-flex items-center gap-1">
        <Check className="w-3 h-3" />
        <span>{confidence != null ? `${confidence}%` : "Completed"}</span>
      </Badge>
    );
  }

  if (normalized === "failed") {
    return (
      <Badge
        variant="danger"
        size="sm"
        className="inline-flex items-center gap-1"
      >
        <AlertTriangle className="w-3 h-3" />
        <span title={failureReason ?? "OCR processing failed"}>OCR Failed</span>
      </Badge>
    );
  }

  // Pending / Not Required / unknown
  return (
    <Badge variant="default" size="sm">
      {status || "Not Required"}
    </Badge>
  );
}
