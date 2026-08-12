/**
 * @bnb-marketplace/ui — Marketplace Design System.
 *
 * Reusable, page-agnostic building blocks for every marketplace-style screen
 * (Marketplace, Categories, Dashboard, Compare, Search, Favorites, Admin).
 *
 * Nothing here fetches data or embeds page logic; each component is controlled
 * and composed at the app layer.
 */

/* Data-state design tokens (visual language). */
export * from "./tokens.js";

/* Badge system. */
export {
  StateBadge,
  VerificationBadge,
  RiskBadge,
  RegistryBadge,
  ActivityBadge,
  BuilderBadge,
  StatusBadge,
  ReputationBadge,
  ProtocolBadge,
  type BadgeSize,
  type BadgeVariant,
  type BadgeBaseProps,
  type StateBadgeProps,
} from "./badges.js";

/* Filters. */
export {
  FilterSidebar,
  FilterSection,
  FilterGroup,
  FilterChip,
  FilterCheckbox,
  FilterRadio,
  FilterToggle,
  type FilterSidebarProps,
  type FilterSectionProps,
  type FilterGroupProps,
  type FilterChipProps,
  type FilterCheckboxProps,
  type FilterRadioProps,
  type FilterToggleProps,
} from "./filters.js";

/* Toolbar. */
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
  type SearchToolbarProps,
  type SearchInputProps,
  type ResultCounterProps,
  type SortOption,
  type SortDropdownProps,
  type ViewMode,
  type ViewToggleProps,
  type GridDensity as ToolbarGridDensity,
  type GridToggleProps,
  type FilterBadgeProps,
  type ResetFiltersButtonProps,
  type ActiveFilterBarProps,
  type StickyToolbarProps,
} from "./toolbar.js";

/* Layout. */
export {
  MarketplaceContainer,
  MarketplaceHeader,
  MarketplaceLayout,
  MarketplaceSidebar,
  MarketplaceContent,
  MarketplaceGrid,
  SectionDivider,
  type MarketplaceContainerProps,
  type MarketplaceHeaderProps,
  type MarketplaceLayoutProps,
  type MarketplaceSidebarProps,
  type MarketplaceContentProps,
  type MarketplaceGridProps,
  type GridDensity,
  type SectionDividerProps,
} from "./layout.js";

/* Empty states. */
export {
  MarketplaceEmptyState,
  NoSearchResults,
  NoAgents,
  RegistryOffline,
  LoadingRegistry,
  NoFavorites,
  ComingSoon,
  WaitingHint,
  type MarketplaceEmptyStateProps,
} from "./empty-states.js";

/* Loading skeletons. */
export {
  SkeletonCard,
  SkeletonGrid,
  SkeletonFilters,
  SkeletonSidebar,
  SkeletonSearch,
  SkeletonToolbar,
  SkeletonPagination,
  type SkeletonGridProps,
} from "./loading.js";

/* Pagination — re-exported from the shared primitive for a complete kit. */
export { Pagination, type PaginationProps } from "../pagination.js";
