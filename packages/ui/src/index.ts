/**
 * @bnb-marketplace/ui — reusable, headless-ready design-system components.
 *
 * These components are styling-oriented primitives. They intentionally carry
 * no marketplace business logic; pages are styled and composed at the app
 * layer with Tailwind + the same design tokens.
 */

export * from "./lib/utils.js";
export { Button, buttonVariants } from "./components/button.js";
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from "./components/card.js";
export { Input } from "./components/input.js";
export { Badge, badgeVariants } from "./components/badge.js";
export { Avatar } from "./components/avatar.js";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/tabs.js";
export {
  Modal,
  ModalTrigger,
  ModalClose,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalTitle,
  ModalDescription,
} from "./components/modal.js";
export {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "./components/table.js";
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSubTrigger,
} from "./components/dropdown-menu.js";
export { Pagination } from "./components/pagination.js";
export { Skeleton } from "./components/skeleton.js";
export { Alert, AlertTitle, AlertDescription, alertVariants } from "./components/alert.js";
export { EmptyState } from "./components/empty-state.js";
export { LoadingSpinner } from "./components/loading-spinner.js";
export { AgentCard } from "./components/agent-card/index.js";
export { AgentCardCompact } from "./components/agent-card/agent-card-compact.js";
export { AgentCardStandard } from "./components/agent-card/agent-card-standard.js";
export { AgentCardDetailed } from "./components/agent-card/agent-card-detailed.js";
export {
  AgentBadge,
  RiskBadge,
  VerificationBadge,
  CapabilityTag,
  ProtocolChip,
} from "./components/agent-card/agent-badges.js";
export { RegistryStatus } from "./components/agent-card/registry-status.js";
export { FavoriteButton, CompareCheckbox } from "./components/agent-card/favorite-compare.js";
export {
  SkeletonAgentCard,
  AgentCardLoadingState,
  AgentCardEmptyState,
  PendingHint,
} from "./components/agent-card/states.js";
export type * from "./components/agent-card/types.js";

/* ------------------------------------------------------------------ *
 * Marketplace Design System.
 *
 * The full kit is available at the `@bnb-marketplace/ui/marketplace` subpath.
 * A curated selection is surfaced here too. The state-driven `VerificationBadge`
 * and `RiskBadge` are re-exported under `MarketplaceVerificationBadge` /
 * `MarketplaceRiskBadge` to avoid clashing with the agent-card badges above.
 * ------------------------------------------------------------------ */
export {
  // tokens
  VERIFICATION_TOKENS,
  REGISTRY_TOKENS,
  RISK_TOKENS,
  REPUTATION_TOKENS,
  ACTIVITY_TOKENS,
  BUILDER_TOKENS,
  AGENT_STATUS_TOKENS,
  PROTOCOL_TOKEN,
  STATE_TOKEN_REGISTRY,
  type StateToken,
  type VerificationState,
  type RegistryState,
  type ReputationLevel,
  type ActivityLevel,
  type BuilderStatus,
  type AgentStatus,
} from "./components/marketplace/tokens.js";
export {
  StateBadge,
  VerificationBadge as MarketplaceVerificationBadge,
  RiskBadge as MarketplaceRiskBadge,
  RegistryBadge,
  ActivityBadge,
  BuilderBadge,
  StatusBadge,
  ReputationBadge,
  ProtocolBadge,
} from "./components/marketplace/badges.js";
export {
  FilterSidebar,
  FilterSection,
  FilterGroup,
  FilterChip,
  FilterCheckbox,
  FilterRadio,
  FilterToggle,
} from "./components/marketplace/filters.js";
export {
  SearchToolbar,
  SearchInput,
  ResultCounter,
  SortDropdown,
  ViewToggle,
  GridToggle,
  FilterBadge,
  ResetFiltersButton,
  ActiveFilterBar,
  StickyToolbar,
} from "./components/marketplace/toolbar.js";
export {
  MarketplaceContainer,
  MarketplaceHeader,
  MarketplaceLayout,
  MarketplaceSidebar,
  MarketplaceContent,
  MarketplaceGrid,
  SectionDivider,
} from "./components/marketplace/layout.js";
export {
  MarketplaceEmptyState,
  NoSearchResults,
  NoAgents,
  RegistryOffline,
  LoadingRegistry,
  NoFavorites,
  ComingSoon,
  WaitingHint,
} from "./components/marketplace/empty-states.js";
export {
  SkeletonCard,
  SkeletonGrid,
  SkeletonFilters,
  SkeletonSidebar,
  SkeletonSearch,
  SkeletonToolbar,
  SkeletonPagination,
} from "./components/marketplace/loading.js";
