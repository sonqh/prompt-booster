/**
 * Operation mode type definition
 */
export type OperationMode = "manual" | "realtime" | "file";

/**
 * Mode metadata for UI display
 */
export interface ModeMetadata {
  mode: OperationMode;
  icon: string;
  label: string;
  description: string;
}

/**
 * Mode definitions
 */
export const MODE_DEFINITIONS: Record<OperationMode, ModeMetadata> = {
  manual: {
    mode: "manual",
    icon: "🔧",
    label: "Manual",
    description: "Boost prompts on demand",
  },
  realtime: {
    mode: "realtime",
    icon: "⚡",
    label: "Real-time",
    description: "Auto-optimize with preview",
  },
  file: {
    mode: "file",
    icon: "📝",
    label: "File",
    description: "Generate editable prompt files",
  },
};
