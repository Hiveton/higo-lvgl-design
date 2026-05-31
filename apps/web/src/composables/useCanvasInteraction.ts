import { ref, computed, type Ref } from "vue";
import type { LayoutBox, WidgetNode } from "@hiveton-lvgl/schema";

export function useCanvasInteraction(
  projectTarget: Ref<{ width: number; height: number }>,
  renderedWidgets: Ref<Array<{ widget: WidgetNode; x: number; y: number }>>,
  selectedWidget: Ref<WidgetNode | undefined>
) {
  const zoomPercent = ref(100);
  const gridEnabled = ref(true);
  const snapEnabled = ref(true);
  const spacePanActive = ref(false);
  const canvasPan = ref({ x: 0, y: 0 });
  const alignmentGuides = ref<{ vertical: number[]; horizontal: number[] }>({ vertical: [], horizontal: [] });
  const mouseCoordinates = ref({ x: 0, y: 0 });
  const interaction = ref<null | {
    mode: "move" | "resize" | "pan";
    widgetId: string;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    startLayout?: LayoutBox;
  }>(null);
  const keyboardNudge = ref<null | {
    widgetId: string;
    startLayout: LayoutBox;
  }>(null);

  const zoomLevels = [25, 50, 75, 100, 150, 200];

  const artboardStyle = computed(() => ({
    width: `${projectTarget.value.width}px`,
    height: `${projectTarget.value.height}px`,
    transform: `scale(${zoomPercent.value / 100})`
  }));

  const canvasPanStyle = computed(() => ({
    transform: `translate(${canvasPan.value.x}px, ${canvasPan.value.y}px)`
  }));

  const rulerTopStyle = computed(() => ({
    width: `${projectTarget.value.width}px`
  }));

  const rulerLeftStyle = computed(() => ({
    height: `${projectTarget.value.height}px`
  }));

  const rulerXTicks = computed(() => rulerTicks(projectTarget.value.width));
  const rulerYTicks = computed(() => rulerTicks(projectTarget.value.height));

  function fitCanvasToView(artboardRef: Ref<HTMLElement | null>): void {
    const stage = artboardRef.value?.closest(".canvas-stage");
    if (!stage) {
      return;
    }
    const bounds = stage.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) {
      return;
    }
    const fitPercent = Math.floor(Math.min(
      bounds.width / projectTarget.value.width,
      bounds.height / projectTarget.value.height
    ) * 100);
    const nextZoom = [...zoomLevels]
      .reverse()
      .find((level) => level <= fitPercent) ?? zoomLevels[0];
    zoomPercent.value = nextZoom;
    canvasPan.value = { x: 0, y: 0 };
  }

  function startCanvasPan(event: MouseEvent): void {
    if (event.button !== 1 && !event.shiftKey && !spacePanActive.value) {
      return;
    }
    event.preventDefault();
    interaction.value = {
      mode: "pan",
      widgetId: "canvas",
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: canvasPan.value.x,
      startY: canvasPan.value.y,
      startWidth: 0,
      startHeight: 0
    };
    document.addEventListener("mousemove", handleCanvasMouseMove);
    document.addEventListener("mouseup", endCanvasInteraction);
  }

  function handleCanvasMouseMove(event: MouseEvent): void {
    const session = interaction.value;
    if (!session) {
      return;
    }
    if (session.mode === "pan") {
      canvasPan.value = {
        x: session.startX + event.clientX - session.startClientX,
        y: session.startY + event.clientY - session.startClientY
      };
      return;
    }
    const scale = zoomPercent.value / 100;
    const deltaX = (event.clientX - session.startClientX) / scale;
    const deltaY = (event.clientY - session.startClientY) / scale;
    if (session.mode === "move") {
      const nextLayout = alignmentAdjustedLayout(session.widgetId, {
        x: snapCanvasValue(session.startX + deltaX),
        y: snapCanvasValue(session.startY + deltaY),
        width: session.startWidth,
        height: session.startHeight
      }, "move");
      // TODO: 应用布局更新
      return;
    }
    const nextLayout = alignmentAdjustedLayout(session.widgetId, {
      x: session.startX,
      y: session.startY,
      width: Math.max(1, snapCanvasValue(session.startWidth + deltaX)),
      height: Math.max(1, snapCanvasValue(session.startHeight + deltaY))
    }, "resize");
    // TODO: 应用布局更新
    return;
  }

  function snapCanvasValue(value: number): number {
    if (!snapEnabled.value) {
      return Math.round(value);
    }
    return Math.round(value / 8) * 8;
  }

  function alignmentAdjustedLayout(
    widgetId: string,
    layout: { x: number; y: number; width: number; height: number },
    mode: "move" | "resize"
  ): { x: number; y: number; width: number; height: number } {
    if (!snapEnabled.value) {
      alignmentGuides.value = { vertical: [], horizontal: [] };
      return layout;
    }
    const threshold = 4;
    const verticalTargets = alignmentTargets("x", widgetId);
    const horizontalTargets = alignmentTargets("y", widgetId);
    const verticalSnap = snapAxis(layout.x, layout.width, verticalTargets, threshold, mode);
    const horizontalSnap = snapAxis(layout.y, layout.height, horizontalTargets, threshold, mode);
    alignmentGuides.value = {
      vertical: verticalSnap.guide === null ? [] : [verticalSnap.guide],
      horizontal: horizontalSnap.guide === null ? [] : [horizontalSnap.guide]
    };
    return {
      x: mode === "move" ? verticalSnap.start : layout.x,
      y: mode === "move" ? horizontalSnap.start : layout.y,
      width: mode === "resize" ? Math.max(1, verticalSnap.size) : layout.width,
      height: mode === "resize" ? Math.max(1, horizontalSnap.size) : layout.height
    };
  }

  function alignmentTargets(axis: "x" | "y", excludedWidgetId: string): number[] {
    const targetSize = axis === "x" ? projectTarget.value.width : projectTarget.value.height;
    const targets = new Set<number>([0, Math.round(targetSize / 2), targetSize]);
    for (const item of renderedWidgets.value) {
      if (item.widget.id === excludedWidgetId) {
        continue;
      }
      const start = axis === "x" ? item.x : item.y;
      const size = axis === "x" ? item.widget.layout.width : item.widget.layout.height;
      targets.add(start);
      targets.add(Math.round(start + size / 2));
      targets.add(start + size);
    }
    return [...targets];
  }

  function snapAxis(
    start: number,
    size: number,
    targets: number[],
    threshold: number,
    mode: "move" | "resize"
  ): { start: number; size: number; guide: number | null } {
    const candidates = mode === "move"
      ? [
          { value: start, kind: "start" as const },
          { value: start + size / 2, kind: "center" as const },
          { value: start + size, kind: "end" as const }
        ]
      : [{ value: start + size, kind: "end" as const }];
    let best: { distance: number; target: number; kind: "start" | "center" | "end" } | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
      for (const target of targets) {
        const distance = Math.abs(candidate.value - target);
        const score = distance + (candidate.kind === "center" ? -2 : 0);
        if (distance <= threshold && score < bestScore) {
          bestScore = score;
          best = { distance, target, kind: candidate.kind };
        }
      }
    }
    if (!best) {
      return { start, size, guide: null };
    }
    if (mode === "resize") {
      return { start, size: best.target - start, guide: best.target };
    }
    if (best.kind === "center") {
      return { start: best.target - size / 2, size, guide: best.target };
    }
    if (best.kind === "end") {
      return { start: best.target - size, size, guide: best.target };
    }
    return { start: best.target, size, guide: best.target };
  }

  function endCanvasInteraction(): void {
    interaction.value = null;
    alignmentGuides.value = { vertical: [], horizontal: [] };
    document.removeEventListener("mousemove", handleCanvasMouseMove);
    document.removeEventListener("mouseup", endCanvasInteraction);
  }

  function updateMouseCoordinates(event: MouseEvent, artboardRef: Ref<HTMLElement | null>): void {
    const artboard = artboardRef.value;
    if (!artboard) {
      return;
    }
    const rect = artboard.getBoundingClientRect();
    const scale = zoomPercent.value / 100;
    mouseCoordinates.value = {
      x: Math.round((event.clientX - rect.left) / scale),
      y: Math.round((event.clientY - rect.top) / scale)
    };
  }

  function rulerTicks(length: number): number[] {
    const ticks: number[] = [];
    for (let tick = 0; tick <= length; tick += 80) {
      ticks.push(tick);
    }
    if (ticks[ticks.length - 1] !== length) {
      ticks.push(length);
    }
    return ticks;
  }

  function cloneLayout(layout: LayoutBox): LayoutBox {
    return {
      x: layout.x,
      y: layout.y,
      width: layout.width,
      height: layout.height,
      align: layout.align,
      flex: layout.flex ? { ...layout.flex } : undefined
    };
  }

  return {
    zoomPercent,
    gridEnabled,
    snapEnabled,
    spacePanActive,
    canvasPan,
    alignmentGuides,
    mouseCoordinates,
    interaction,
    keyboardNudge,
    zoomLevels,
    artboardStyle,
    canvasPanStyle,
    rulerTopStyle,
    rulerLeftStyle,
    rulerXTicks,
    rulerYTicks,
    fitCanvasToView,
    startCanvasPan,
    handleCanvasMouseMove,
    snapCanvasValue,
    alignmentAdjustedLayout,
    endCanvasInteraction,
    updateMouseCoordinates,
    cloneLayout
  };
}
