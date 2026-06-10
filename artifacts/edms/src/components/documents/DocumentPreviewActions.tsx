import { ExternalLink, Eye } from "lucide-react";
import { useNavigate } from "react-router";
import { resolveDocumentPreviewPath } from "../../lib/documentPreview";
import { Button } from "../ui/Shared";

export function getDocumentContextAttributes(documentId: string, title?: string) {
  return {
    "data-document-id": documentId,
    "data-document-title": title ?? documentId,
  } as const;
}

interface DocumentPreviewButtonProps {
  documentId: string;
  title?: string;
  className?: string;
  label?: string;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary" | "ghost" | "danger" | "teal-outline";
  iconOnly?: boolean;
  stopPropagation?: boolean;
}

export function DocumentPreviewButton({
  documentId,
  title,
  className,
  label = "Preview",
  size = "sm",
  variant = "ghost",
  iconOnly = false,
  stopPropagation = true,
}: DocumentPreviewButtonProps) {
  const navigate = useNavigate();

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={className}
      title={title ? `Preview ${title}` : "Preview document"}
      onClick={(event) => {
        if (stopPropagation) {
          event.stopPropagation();
        }
        navigate(resolveDocumentPreviewPath(documentId));
      }}
    >
      <Eye className="h-3.5 w-3.5" />
      {!iconOnly && label}
    </Button>
  );
}

interface DocumentDetailsButtonProps {
  documentId: string;
  className?: string;
  label?: string;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary" | "ghost" | "danger" | "teal-outline";
  iconOnly?: boolean;
  stopPropagation?: boolean;
}

export function DocumentDetailsButton({
  documentId,
  className,
  label = "Open",
  size = "sm",
  variant = "ghost",
  iconOnly = false,
  stopPropagation = true,
}: DocumentDetailsButtonProps) {
  const navigate = useNavigate();

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={className}
      title="Open document details"
      onClick={(event) => {
        if (stopPropagation) {
          event.stopPropagation();
        }
        navigate(`/documents/${documentId}`);
      }}
    >
      <ExternalLink className="h-3.5 w-3.5" />
      {!iconOnly && label}
    </Button>
  );
}
