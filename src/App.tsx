import { useEffect, useState } from 'react';
import {
  fetchDashboardData,
  getNetSuiteContext,
  updateOpportunityStatus,
  formatCurrency,
  type Opportunity
} from './services/api';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './App.css';

// Updated columns to match NetSuite's actual statuses
const STATUS_COLUMNS = [
  { key: 'qualified', label: 'Qualified', color: 'bg-blue-600', headerBg: 'bg-blue-50', borderColor: 'border-blue-200' },
  { key: 'in_discussion', label: 'In Discussion', color: 'bg-cyan-500', headerBg: 'bg-cyan-50', borderColor: 'border-cyan-200' },
  { key: 'proposal', label: 'Proposal', color: 'bg-amber-500', headerBg: 'bg-amber-50', borderColor: 'border-amber-200' },
  { key: 'in_negotiation', label: 'In Negotiation', color: 'bg-purple-600', headerBg: 'bg-purple-50', borderColor: 'border-purple-200' },
  { key: 'closed_won', label: 'Closed Won', color: 'bg-green-600', headerBg: 'bg-green-50', borderColor: 'border-green-200' },
];

// Draggable Card Component
function DraggableCard({ opportunity }: { opportunity: Opportunity }) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white rounded-lg p-3 hover:bg-gray-50 transition-all cursor-grab active:cursor-grabbing border border-gray-200 hover:border-gray-300 shadow-sm hover:shadow"
    >
      <h3
        className="text-blue-600 hover:text-blue-800 hover:underline font-medium text-sm leading-tight cursor-pointer"
        onClick={handleTitleClick}
        onPointerDown={(e) => e.stopPropagation()} // Prevent drag on title click
      >
        {opportunity.title}
      </h3>
      <p className="text-gray-500 text-xs mt-1">{opportunity.customer}</p>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
        <span className="text-green-600 font-semibold text-xs">
          {formatCurrency(opportunity.amount)}
        </span>
        <span className="text-gray-400 text-xs">
          {opportunity.probability}%
        </span>
      </div>
    </div>
  );
}

// Droppable Column Component
function DroppableColumn({
  column,
  opportunities,
  totalAmount,
}: {
  column: typeof STATUS_COLUMNS[0];
  opportunities: Opportunity[];
  totalAmount: number;
}) {
  const { setNodeRef } = useSortable({
    id: column.key,
    data: { type: 'column' },
  });

  return (
    <div ref={setNodeRef} className={`bg-gray-50 rounded-lg border ${column.borderColor} min-h-[400px] flex flex-col`}>
      {/* Column Header */}
      <div className={`flex items-center gap-2 p-3 ${column.headerBg} rounded-t-lg border-b ${column.borderColor}`}>
        <div className={`w-2.5 h-2.5 rounded-full ${column.color}`} />
        <h2 className="text-gray-700 font-semibold text-sm">{column.label}</h2>
        <span className="bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full ml-auto">
          {opportunities.length}
        </span>
      </div>

      {/* Column Total */}
      <div className="px-3 py-1.5 bg-gray-100 border-b border-gray-200">
        <span className="text-xs text-gray-500">Total: </span>
        <span className="text-xs font-semibold text-gray-700">{formatCurrency(totalAmount)}</span>
      </div>

      {/* Cards */}
      <SortableContext items={opportunities.map((opp) => opp.id)}>
        <div className="p-2 space-y-2 flex-1 overflow-y-auto">
          {opportunities.map((opp) => (
            <DraggableCard key={opp.id} opportunity={opp} />
          ))}
          {opportunities.length === 0 && (
            <div className="text-gray-400 text-xs text-center py-8">
              Drop items here
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function App() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const context = getNetSuiteContext();
  const isLocal = !context;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await fetchDashboardData();
        setOpportunities(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const getOpportunitiesByStatus = (status: string) => {
    return opportunities.filter((opp) => opp.status === status);
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

    const draggedOpportunity = opportunities.find((opp) => opp.id === draggedId);
    if (!draggedOpportunity) return;

    // Determine new status
    let newStatus: string;
    if (STATUS_COLUMNS.some((col) => col.key === overId)) {
      newStatus = overId;
    } else {
      const targetOpportunity = opportunities.find((opp) => opp.id === overId);
      if (!targetOpportunity) return;
      newStatus = targetOpportunity.status;
    }

    // Only update if status changed
    if (draggedOpportunity.status === newStatus) return;

    const oldStatus = draggedOpportunity.status;

    // Optimistic update
    setOpportunities((prev) =>
      prev.map((opp) =>
        opp.id === draggedId ? { ...opp, status: newStatus } : opp
      )
    );

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

  const displayedTotal = STATUS_COLUMNS.reduce((sum, col) => sum + getTotalByStatus(col.key), 0);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="bg-[#F5F5F5] min-h-screen" style={{ margin: '-10px', padding: '0' }}>
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-gray-800">
                Opportunity Pipeline
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {isLocal ? (
                  <span className="text-amber-600">⚠️ Local Dev Mode</span>
                ) : (
                  <span className="text-green-600">✓ Connected as {context.userName}</span>
                )}
                <span className="mx-2">|</span>
                <span>{opportunities.length} opportunities</span>
                <span className="mx-2">|</span>
                <span className="font-semibold">{formatCurrency(displayedTotal)} displayed</span>
              </p>
            </div>
            {updating && (
              <div className="text-xs text-blue-600 animate-pulse">
                Updating...
              </div>
            )}
          </div>
        </div>

        {/* Kanban Board */}
        <div className="p-4">
          <SortableContext items={STATUS_COLUMNS.map((col) => col.key)}>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {STATUS_COLUMNS.map((column) => (
                <DroppableColumn
                  key={column.key}
                  column={column}
                  opportunities={getOpportunitiesByStatus(column.key)}
                  totalAmount={getTotalByStatus(column.key)}
                />
              ))}
            </div>
          </SortableContext>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeOpportunity ? (
            <div className="bg-white rounded-lg p-3 border border-gray-300 shadow-lg">
              <h3 className="text-gray-800 font-medium text-sm">{activeOpportunity.title}</h3>
              <p className="text-gray-500 text-xs mt-1">{activeOpportunity.customer}</p>
              <div className="text-green-600 font-semibold text-xs mt-2">
                {formatCurrency(activeOpportunity.amount)}
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}

export default App;
