/**
 * ProofChain UI kit barrel — the design-system primitive library (WD §4).
 * Page teams import everything from here:
 *   import { Button, DataTable, TxButton, StatusBadge } from "@/components/ui";
 *
 * Never import bespoke styling — compose these primitives + tokens only.
 */

// Buttons & actions
export { Button, type ButtonProps } from "./Button";
export { IconButton, type IconButtonProps } from "./IconButton";
export { CopyButton, type CopyButtonProps } from "./CopyButton";
export { TxButton, type TxButtonProps } from "./TxButton";
export { WalletButton, type WalletButtonProps } from "./WalletButton";
export { ThemeToggle } from "./ThemeToggle";

// Inputs & forms
export { Field, Input, Textarea } from "./Field";
export { Select, type SelectOption, type SelectProps } from "./Select";
export { Combobox, type ComboboxOption, type ComboboxProps } from "./Combobox";
export { Checkbox, type CheckboxProps } from "./Checkbox";
export { Switch, type SwitchProps } from "./Switch";
export { RadioGroup, type RadioOption, type RadioGroupProps } from "./RadioGroup";
export { Slider, type SliderProps } from "./Slider";
export { FileDropzone, type FileDropzoneProps } from "./FileDropzone";
export { FormLayout, FormSection, FormActions } from "./Form";

// Badges & identity
export { Badge } from "./Badge";
export { StatusBadge, type SemanticStatus, type StatusBadgeProps } from "./StatusBadge";
export { Tag, type TagProps } from "./Tag";
export { Avatar, type AvatarProps } from "./Avatar";
export { AddressBadge } from "./AddressBadge";

// Overlays
export { Tooltip, type TooltipProps } from "./Tooltip";
export { Popover, type PopoverProps } from "./Popover";
export { Dropdown, type DropdownItem, type DropdownProps } from "./Dropdown";
export { Tabs, type TabItem, type TabsProps } from "./Tabs";
export { Accordion, type AccordionItem, type AccordionProps } from "./Accordion";
export { Dialog, type DialogProps } from "./Dialog";
export { Drawer, type DrawerProps } from "./Drawer";
export { Toaster, toast } from "./Toast";

// Feedback & progress
export { Spinner } from "./Spinner";
export { Skeleton, SkeletonText, type SkeletonProps } from "./Skeleton";
export { Progress, type ProgressProps } from "./Progress";
export { Meter, type MeterProps } from "./Meter";
export { Callout, type CalloutProps, type CalloutTone } from "./Callout";
export { LoadingState, EmptyState, ErrorState } from "./States";

// Navigation
export { Breadcrumbs, type Crumb, type BreadcrumbsProps } from "./Breadcrumbs";
export { Pagination } from "./Pagination";
export { Stepper, type Step, type StepperProps } from "./Stepper";

// Layout & content
export { Card, CardHeader } from "./Card";
export { Divider, type DividerProps } from "./Divider";
export { CodeBlock, type CodeBlockProps } from "./CodeBlock";
export { JsonViewer, type JsonViewerProps } from "./JsonViewer";
export { Icon, type IconName, type IconProps } from "./Icon";

// Data display
export { DataTable, type Column } from "./DataTable";
export { CardGrid } from "./CardGrid";
export { StatCard } from "./StatCard";
export { KpiRow, type Kpi, type KpiRowProps } from "./KpiRow";
export { Timeline, type TimelineEvent, type TimelineProps } from "./Timeline";
export {
  Sparkline,
  LineChart,
  AreaChart,
  BarChart,
  DonutChart,
  type SeriesPoint,
  type DonutSlice,
} from "./Charts";
export { MapPreview, type MapPoint, type MapPreviewProps } from "./MapPreview";

// Web3
export { NetworkGuard, type NetworkGuardProps } from "./NetworkGuard";

// Explorer links (legacy helpers)
export { TxLink, AddressLink } from "./TxLink";

// Theme
export { ThemeProvider, useTheme, themeInitScript, type Theme } from "./theme";
