import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  fetchDashboardData,
  getNetSuiteContext,
  updateOpportunityStatus,
  formatCurrency,
  fetchSalesReps,
  type Opportunity,
  type SalesRep
} from './services/api';
import { OodaAnalysisPage } from './components/OodaAnalysisPage';
import { BusinessCardUploadModal } from './components/BusinessCardUploadModal';
import { MultiSelectCheckbox } from './components/MultiSelectCheckbox'; // Import new component
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './App.css';

// Color palette for dynamic status columns
const COLUMN_COLORS = [
  { color: 'bg-blue-600', headerBg: 'bg-blue-50', borderColor: 'border-blue-200' },
  { color: 'bg-cyan-500', headerBg: 'bg-cyan-50', borderColor: 'border-cyan-200' },
  { color: 'bg-amber-500', headerBg: 'bg-amber-50', borderColor: 'border-amber-200' },
  { color: 'bg-purple-600', headerBg: 'bg-purple-50', borderColor: 'border-purple-200' },
  { color: 'bg-green-600', headerBg: 'bg-green-50', borderColor: 'border-green-200' },
  { color: 'bg-rose-500', headerBg: 'bg-rose-50', borderColor: 'border-rose-200' },
  { color: 'bg-indigo-500', headerBg: 'bg-indigo-50', borderColor: 'border-indigo-200' },
  { color: 'bg-orange-500', headerBg: 'bg-orange-50', borderColor: 'border-orange-200' },
  { color: 'bg-teal-500', headerBg: 'bg-teal-50', borderColor: 'border-teal-200' },
  { color: 'bg-pink-500', headerBg: 'bg-pink-50', borderColor: 'border-pink-200' },
];

interface StatusColumn {
  key: string;
  label: string;
  color: string;
  headerBg: string;
  borderColor: string;
}

// Draggable Card Component
function DraggableCard({ opportunity, onOodaClick }: { opportunity: Opportunity; onOodaClick: (opp: Opportunity) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: opportunity.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Generate NetSuite Opportunity URL
  const opportunityUrl = `/app/accounting/transactions/opprtnty.nl?id=${opportunity.id}`;

  // Handle title click - open in new tab
  const handleTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent drag from triggering
    e.preventDefault();
    window.open(opportunityUrl, '_blank');
  };

  // Handle OODA button click
  const handleOodaClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onOodaClick(opportunity);
  };

  const probClass =
    opportunity.probability >= 75 ? 'is-high'
      : opportunity.probability >= 40 ? 'is-mid'
        : 'is-low';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="jira-card"
    >
      <button
        className="ooda-btn"
        onClick={handleOodaClick}
        onPointerDown={(e) => e.stopPropagation()}
        title="OODA 分析"
      >
        O
      </button>
      <h3
        className="jira-card-title"
        onClick={handleTitleClick}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {opportunity.title}
      </h3>
      {opportunity.customer && (
        <p className="jira-card-customer">{opportunity.customer}</p>
      )}
      <div className="jira-card-footer">
        <span className="jira-card-amount">
          {formatCurrency(opportunity.amount)}
        </span>
        <span className={`jira-card-probability ${probClass}`}>
          {opportunity.probability}%
        </span>
      </div>
    </div>
  );
}

// Droppable Column Component with drag handle for reordering
function DroppableColumn({
  column,
  opportunities,
  totalAmount,
  onOodaClick,
}: {
  column: StatusColumn;
  opportunities: Opportunity[];
  totalAmount: number;
  onOodaClick: (opp: Opportunity) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: `column-${column.key}`,
    data: { type: 'column', column },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="jira-column">
      <div
        {...attributes}
        {...listeners}
        className="jira-column-header"
      >
        <div className="jira-column-title-group">
          <span className="jira-column-drag-handle" aria-hidden="true">
            <svg width="10" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="9" cy="5" r="2" /><circle cx="15" cy="5" r="2" />
              <circle cx="9" cy="12" r="2" /><circle cx="15" cy="12" r="2" />
              <circle cx="9" cy="19" r="2" /><circle cx="15" cy="19" r="2" />
            </svg>
          </span>
          <div className={`w-2 h-2 rounded-full ${column.color}`} style={{ flexShrink: 0 }} />
          <h2 className="jira-column-label">{column.label}</h2>
          <span className="jira-column-count">{opportunities.length}</span>
        </div>
      </div>
      {totalAmount > 0 && (
        <div className="jira-column-total">
          {formatCurrency(totalAmount)}
        </div>
      )}

      <SortableContext items={opportunities.map((opp) => opp.id)}>
        <div className="jira-cards">
          {opportunities.map((opp) => (
            <DraggableCard key={opp.id} opportunity={opp} onOodaClick={onOodaClick} />
          ))}
          {opportunities.length === 0 && (
            <div className="jira-empty-drop">Drop items here</div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function App() {
  const context = getNetSuiteContext();

  // ROUTING LOGIC: Check for Standalone OCR Mode
  if (context?.pageType === 'ocr_standalone') {
    return (
      <div className="standalone-app">
        <BusinessCardUploadModal onClose={() => { }} isStandalone={true} />
      </div>
    );
  }

  // == EXISTING KANBAN BOARD LOGIC ==
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  // Removed showOCRModal state as user requested separation
  const [columnOrder, setColumnOrder] = useState<string[]>([]);

  // Filter states
  // Filter states - Initialize from localStorage
  const [salesRepOptions, setSalesRepOptions] = useState<SalesRep[]>([]);
  const [dateRangeType, setDateRangeType] = useState<'quarter' | 'month' | 'year' | 'all' | 'custom'>('quarter');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');

  // Persistent Filters
  const [selectedSalesReps, setSelectedSalesReps] = useState<string[]>(() => {
    const saved = localStorage.getItem('kanban-filter-reps');
    return saved ? JSON.parse(saved) : [];
  });

  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(() => {
    const saved = localStorage.getItem('kanban-filter-status');
    return saved ? JSON.parse(saved) : [];
  });

  // Save filters to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('kanban-filter-reps', JSON.stringify(selectedSalesReps));
  }, [selectedSalesReps]);

  useEffect(() => {
    localStorage.setItem('kanban-filter-status', JSON.stringify(selectedStatuses));
  }, [selectedStatuses]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Get current quarter date range
  const getQuarterDateRange = useCallback(() => {
    const now = new Date();
    const quarter = Math.floor(now.getMonth() / 3);
    const startMonth = quarter * 3;
    const start = new Date(now.getFullYear(), startMonth, 1);
    const end = new Date(now.getFullYear(), startMonth + 3, 0);
    return { start, end };
  }, []);

  // Get current month date range
  const getMonthDateRange = useCallback(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start, end };
  }, []);

  // Get current year date range
  const getYearDateRange = useCallback(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31);
    return { start, end };
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [oppData, salesRepData] = await Promise.all([
          fetchDashboardData(),
          fetchSalesReps()
        ]);
        setOpportunities(oppData);
        if (salesRepData.success) {
          setSalesRepOptions([
            { id: '', name: '未指派 (Unassigned)', entityId: '' },
            ...salesRepData.salesReps
          ]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Dynamically derive status columns from available statuses (backend provided) or opportunities data (fallback)
  const baseStatusColumns: StatusColumn[] = useMemo(() => {
    // 1. Try to get all statuses from global NetSuite data injected by Suitelet
    const nsData = (window as any).NETSUITE_DATA;
    if (nsData && nsData.allStatuses && Array.isArray(nsData.allStatuses) && nsData.allStatuses.length > 0) {
      return nsData.allStatuses.map((status: { id: string; name: string }, index: number) => {
        const key = status.name.toLowerCase().replace(/\s+/g, '_');
        return {
          key,
          label: status.name,
          ...COLUMN_COLORS[index % COLUMN_COLORS.length]
        };
      });
    }

    // 2. Fallback: Extract unique statuses from loaded opportunities (original logic)
    const statusMap = new Map<string, string>();
    opportunities.forEach(opp => {
      if (opp.status && !statusMap.has(opp.status)) {
        statusMap.set(opp.status, opp.statusText || opp.status);
      }
    });

    // Convert to array and assign colors
    return Array.from(statusMap.entries()).map(([key, label], index) => ({
      key,
      label,
      ...COLUMN_COLORS[index % COLUMN_COLORS.length]
    }));
  }, [opportunities]);

  // Load saved column order from localStorage once base columns are available
  useEffect(() => {
    if (baseStatusColumns.length > 0 && columnOrder.length === 0) {
      const savedOrder = localStorage.getItem('kanban-column-order');
      if (savedOrder) {
        try {
          const parsed = JSON.parse(savedOrder);
          // Filter to only include existing columns
          const validOrder = parsed.filter((key: string) =>
            baseStatusColumns.some(col => col.key === key)
          );
          // Add any new columns not in saved order
          const newColumns = baseStatusColumns
            .filter(col => !validOrder.includes(col.key))
            .map(col => col.key);
          setColumnOrder([...validOrder, ...newColumns]);
        } catch {
          setColumnOrder(baseStatusColumns.map(col => col.key));
        }
      } else {
        setColumnOrder(baseStatusColumns.map(col => col.key));
      }
    }
  }, [baseStatusColumns, columnOrder.length]);

  // Sorted and filtered columns based on user's preferred order and status filter
  const statusColumns: StatusColumn[] = useMemo(() => {
    let columns = baseStatusColumns;

    // If column order is set, sort columns
    if (columnOrder.length > 0) {
      columns = columnOrder
        .map(key => baseStatusColumns.find(col => col.key === key))
        .filter((col): col is StatusColumn => col !== undefined);
    }

    // If status filter is active, only show selected status columns
    if (selectedStatuses.length > 0) {
      columns = columns.filter(col => selectedStatuses.includes(col.key));
    }

    return columns;
  }, [baseStatusColumns, columnOrder, selectedStatuses]);

  // Filter opportunities based on selected filters
  const filteredOpportunities = useMemo(() => {
    return opportunities.filter(opp => {
      // Date range filter
      if (dateRangeType !== 'all' && opp.closeDate) {
        const closeDate = new Date(opp.closeDate);
        let dateRange: { start: Date; end: Date } | null = null;

        if (dateRangeType === 'quarter') {
          dateRange = getQuarterDateRange();
        } else if (dateRangeType === 'month') {
          dateRange = getMonthDateRange();
        } else if (dateRangeType === 'year') {
          dateRange = getYearDateRange();
        } else if (dateRangeType === 'custom' && customDateStart && customDateEnd) {
          dateRange = { start: new Date(customDateStart), end: new Date(customDateEnd) };
        }

        if (dateRange && (closeDate < dateRange.start || closeDate > dateRange.end)) {
          return false;
        }
      }

      // Sales rep filter
      const isAllRepsSelected = selectedSalesReps.length === salesRepOptions.length;
      if (!isAllRepsSelected && selectedSalesReps.length > 0 && !selectedSalesReps.includes(opp.salesRepId)) {
        return false;
      }

      // Status filter
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(opp.status)) {
        return false;
      }

      return true;
    });
  }, [opportunities, dateRangeType, customDateStart, customDateEnd, selectedSalesReps, selectedStatuses, getQuarterDateRange, getMonthDateRange, getYearDateRange]);

  const getOpportunitiesByStatus = (status: string) => {
    return filteredOpportunities.filter((opp) => opp.status === status);
  };

  const getTotalByStatus = (status: string) => {
    return getOpportunitiesByStatus(status).reduce((sum, opp) => sum + opp.amount, 0);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const draggedId = active.id as string;
    const overId = over.id as string;

    // Check if this is a column being dragged
    if (draggedId.startsWith('column-') && overId.startsWith('column-')) {
      const draggedKey = draggedId.replace('column-', '');
      const overKey = overId.replace('column-', '');

      if (draggedKey !== overKey) {
        const oldIndex = columnOrder.indexOf(draggedKey);
        const newIndex = columnOrder.indexOf(overKey);

        if (oldIndex !== -1 && newIndex !== -1) {
          const newOrder = arrayMove(columnOrder, oldIndex, newIndex);
          setColumnOrder(newOrder);
          localStorage.setItem('kanban-column-order', JSON.stringify(newOrder));
        }
      }
      return;
    }

    const draggedOpportunity = opportunities.find((opp) => opp.id === draggedId);
    if (!draggedOpportunity) return;

    // Determine new status and target position
    let newStatus: string;
    let targetIndex = -1; // Index where we want to insert

    // Check if dropped on a column
    const targetColumnKey = overId.startsWith('column-') ? overId.replace('column-', '') : null;
    if (targetColumnKey && statusColumns.some((col: StatusColumn) => col.key === targetColumnKey)) {
      // Dropped on a column (empty area) - add to end of that column
      newStatus = targetColumnKey;
    } else if (statusColumns.some((col: StatusColumn) => col.key === overId)) {
      // Dropped on a column (old format)
      newStatus = overId;
    } else {
      // Dropped on another card
      const targetOpportunity = opportunities.find((opp) => opp.id === overId);
      if (!targetOpportunity) return;
      newStatus = targetOpportunity.status;

      // Find the position of the target card within its column
      const columnOpps = opportunities.filter((opp) => opp.status === newStatus);
      targetIndex = columnOpps.findIndex((opp) => opp.id === overId);
    }

    const oldStatus = draggedOpportunity.status;
    const statusChanged = draggedOpportunity.status !== newStatus;

    // Calculate new order
    setOpportunities((prev) => {
      // Remove the dragged item first
      const withoutDragged = prev.filter((opp) => opp.id !== draggedId);
      const updatedDraggedOpp = { ...draggedOpportunity, status: newStatus };

      if (targetIndex === -1) {
        // Dropped on column (empty area) - add at the end
        return [...withoutDragged, updatedDraggedOpp];
      }

      // Find where to insert in the full array
      // Get all items in the target column (after removing dragged)
      const targetColumnOpps = withoutDragged.filter((opp) => opp.status === newStatus);

      if (targetIndex >= targetColumnOpps.length) {
        // Insert at the end of the column
        return [...withoutDragged, updatedDraggedOpp];
      }

      // Find the actual index in the full array where we need to insert
      const targetOppId = targetColumnOpps[targetIndex]?.id;
      const insertAtIndex = withoutDragged.findIndex((opp) => opp.id === targetOppId);

      if (insertAtIndex === -1) {
        return [...withoutDragged, updatedDraggedOpp];
      }

      // Insert at the correct position
      const result = [...withoutDragged];
      result.splice(insertAtIndex, 0, updatedDraggedOpp);
      return result;
    });

    // Only call API if status changed
    if (!statusChanged) return;

    // Call API to update in NetSuite
    setUpdating(draggedId);
    const result = await updateOpportunityStatus(draggedId, newStatus);
    setUpdating(null);

    if (!result.success) {
      // Rollback on failure
      setOpportunities((prev) =>
        prev.map((opp) =>
          opp.id === draggedId ? { ...opp, status: oldStatus } : opp
        )
      );
      alert(`Failed to update: ${result.error}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading opportunities...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  const activeOpportunity = activeId
    ? opportunities.find((opp) => opp.id === activeId)
    : null;



  return (
    <>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="jira-shell" style={{ margin: '-10px', padding: '0' }}>


          {/* Filter Bar */}
          <div className="jira-filter-bar">
            <div className="flex items-center justify-between w-full">

              {/* Left-Aligned Filters */}
              <div className="flex flex-nowrap gap-6 items-end">

                {/* 1. Total Estimated Amount (First) */}
                <div className="jira-kpi">
                  <span className="jira-kpi-label">預估專案總金額</span>
                  <span className="jira-kpi-value">
                    {formatCurrency(filteredOpportunities.reduce((sum, opp) => sum + opp.amount, 0))}
                  </span>
                </div>

                {/* 2. Date Range Filter */}
                <div className="flex flex-col items-start">
                  <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1 ml-1">預計結單日期</label>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <select
                        value={dateRangeType}
                        onChange={(e) => setDateRangeType(e.target.value as 'quarter' | 'month' | 'year' | 'all' | 'custom')}
                        className="text-sm text-left font-medium border border-gray-300 rounded-md px-4 py-1 bg-white min-w-[110px] appearance-none cursor-pointer hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm"
                      >
                        <option value="quarter">本季</option>
                        <option value="month">本月</option>
                        <option value="year">今年</option>
                        <option value="all">全部</option>
                        <option value="custom">自訂</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                        <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    {dateRangeType === 'custom' && (
                      <>
                        <input
                          type="date"
                          value={customDateStart}
                          onChange={(e) => setCustomDateStart(e.target.value)}
                          className="text-sm border border-gray-300 rounded px-2 py-1"
                        />
                        <span className="text-base text-gray-500">至</span>
                        <input
                          type="date"
                          value={customDateEnd}
                          onChange={(e) => setCustomDateEnd(e.target.value)}
                          className="text-sm border border-gray-300 rounded px-2 py-1"
                        />
                      </>
                    )}
                  </div>
                </div>

                {/* 3. Sales Rep Filter */}
                <div className="flex flex-col items-start">
                  <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1 ml-1">業務員</label>
                  <MultiSelectCheckbox
                    options={salesRepOptions.map(rep => ({ label: rep.name, value: rep.id }))}
                    selectedValues={selectedSalesReps}
                    onChange={setSelectedSalesReps}
                    placeholder="全部業務員"
                  />
                </div>

                {/* 4. Status Filter */}
                <div className="flex flex-col items-start">
                  <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1 ml-1">狀態</label>
                  <MultiSelectCheckbox
                    options={baseStatusColumns.map(col => ({ label: col.label, value: col.key }))}
                    selectedValues={selectedStatuses}
                    onChange={setSelectedStatuses}
                    placeholder="全部狀態"
                  />
                </div>
              </div>

              {/* Count Info - Right Aligned via justify-between */}
              <div className="flex items-center gap-3">
                {updating && (
                  <div className="text-xs text-blue-600 animate-pulse">
                    Updating...
                  </div>
                )}
                <div className="text-xs text-gray-500 whitespace-nowrap">
                  顯示 <span className="font-bold text-gray-700">{filteredOpportunities.length}</span> / {opportunities.length} 筆
                </div>
              </div>
            </div>
          </div>

          {/* Kanban Board */}
          <SortableContext
            items={statusColumns.map((col: StatusColumn) => `column-${col.key}`)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="jira-board">
              {statusColumns.map((column: StatusColumn) => (
                <DroppableColumn
                  key={column.key}
                  column={column}
                  opportunities={getOpportunitiesByStatus(column.key)}
                  totalAmount={getTotalByStatus(column.key)}
                  onOodaClick={setSelectedOpportunity}
                />
              ))}
            </div>
          </SortableContext>

          {/* Drag Overlay */}
          <DragOverlay>
            {activeOpportunity ? (
              <div
                className="jira-card"
                style={{ boxShadow: '0 8px 16px rgba(9,30,66,0.25), 0 0 1px rgba(9,30,66,0.31)', cursor: 'grabbing' }}
              >
                <h3 className="jira-card-title" style={{ pointerEvents: 'none' }}>
                  {activeOpportunity.title}
                </h3>
                {activeOpportunity.customer && (
                  <p className="jira-card-customer">{activeOpportunity.customer}</p>
                )}
                <div className="jira-card-footer">
                  <span className="jira-card-amount">
                    {formatCurrency(activeOpportunity.amount)}
                  </span>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </div>
      </DndContext >

      {/* OODA Analysis Modal */}
      {
        selectedOpportunity && (
          <OodaAnalysisPage
            opportunity={selectedOpportunity}
            onClose={() => setSelectedOpportunity(null)}
          />
        )
      }
    </>
  );
}

export default App;
