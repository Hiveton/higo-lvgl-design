import { ref, computed, watch, type Ref } from "vue";
import type { ProjectDoc, AssetRef, WidgetNode } from "@hiveton-lvgl/schema";

type PreviewNameRegistry = {
  symbol(name: string): string;
};

export function useCodeGeneration(
  project: Ref<ProjectDoc>,
  activeScreen: Ref<{ name: string; root: WidgetNode } | undefined>,
  copy: Ref<any>
) {
  const codeCopyStatus = ref(copy.value.runtime.readyToCopy);

  const codePreview = computed(() => generateCodePreview());

  watch(codePreview, () => {
    codeCopyStatus.value = copy.value.runtime.readyToCopy;
  });

  function generateCodePreview(): string {
    const screen = activeScreen.value;
    if (!screen) {
      return "";
    }
    const assetIssues = findAssetReferenceIssues(screen.root, project.value.styles, project.value.assets);
    if (
      assetIssues.missingImageAssetIds.length
      || assetIssues.invalidImageAssetIds.length
      || assetIssues.missingFontAssetIds.length
      || assetIssues.invalidFontAssetIds.length
    ) {
      return [
        ...assetIssues.missingImageAssetIds.map((assetId) => `/* ${copy.value.runtime.codegenBlockedMissingAsset(assetId)} */`),
        ...assetIssues.invalidImageAssetIds.map((assetId) => `/* ${copy.value.runtime.codegenBlockedInvalidAssetKind(assetId)} */`),
        ...assetIssues.missingFontAssetIds.map((assetId) => `/* ${copy.value.runtime.codegenBlockedMissingFontAsset(assetId)} */`),
        ...assetIssues.invalidFontAssetIds.map((assetId) => `/* ${copy.value.runtime.codegenBlockedInvalidFontAssetKind(assetId)} */`)
      ].join("\n");
    }
    const names = createPreviewNameRegistry();
    const styleSymbols = reusableStyleSymbolMap(project.value.styles);
    const assetSymbols = assetSymbolMapForPreview(project.value.assets);
    const screenSymbol = names.symbol(screen.name);
    const globals = [`lv_obj_t * ${screenSymbol};`];
    const lines: string[] = [];
    appendReusableStylesPreview(lines, project.value.styles, styleSymbols);
    lines.push(`void ${screenSymbol}_screen_init(void) {`);
    if (project.value.styles.length > 0) {
      lines.push("    ui_init_styles();");
    }
    lines.push(`    ${screenSymbol} = lv_obj_create(NULL);`);
    appendLayoutPreview(lines, screenSymbol, screen.root.layout);
    appendStylePreview(lines, screenSymbol, screen.root);
    appendEventPreview(lines, screenSymbol, screen.root);
    for (const widget of screen.root.children) {
      appendWidgetPreview(globals, lines, names, assetSymbols, widget, screenSymbol);
    }
    lines.push("}");
    appendEventCallbackStubs(lines, screen.root);
    return [...globals, "", ...lines].join("\n");
  }

  async function copyGeneratedCode(): Promise<void> {
    const code = codePreview.value;
    if (!code.trim()) {
      codeCopyStatus.value = copy.value.runtime.noCodeToCopy;
      return;
    }
    codeCopyStatus.value = copy.value.runtime.copyingCode;
    try {
      await writeClipboardText(code);
      codeCopyStatus.value = copy.value.runtime.codeCopied;
    } catch (error) {
      codeCopyStatus.value = copy.value.runtime.codeCopyFailed;
    }
  }

  async function writeClipboardText(text: string): Promise<void> {
    if (navigator.clipboard?.writeText) {
      try {
        await Promise.race([
          navigator.clipboard.writeText(text),
          new Promise((_, reject) => {
            window.setTimeout(() => reject(new Error(copy.value.runtime.clipboardWriteTimedOut)), 1200);
          })
        ]);
        return;
      } catch (error) {
        if (copyTextWithSelection(text)) {
          return;
        }
        throw error;
      }
    }
    if (copyTextWithSelection(text)) {
      return;
    }
    throw new Error(copy.value.runtime.clipboardApiUnavailable);
  }

  function copyTextWithSelection(text: string): boolean {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.setAttribute("readonly", "true");
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.select();
    try {
      return document.execCommand("copy");
    } finally {
      textArea.remove();
    }
  }

  function reusableStyleSymbolMap(styles: ProjectDoc["styles"]): Map<string, string> {
    const names = createPreviewNameRegistry();
    return new Map(styles.map((style) => [style.id, names.symbol(`style_${style.name}`)]));
  }

  function assetSymbolMapForPreview(assets: AssetRef[]): Map<string, string> {
    const names = createPreviewNameRegistry();
    return new Map(assets.map((asset) => [asset.id, names.symbol(`img_${asset.name}`)]));
  }

  function appendReusableStylesPreview(lines: string[], styles: ProjectDoc["styles"], styleSymbols: Map<string, string>): void {
    if (styles.length === 0) {
      return;
    }
    for (const style of styles) {
      lines.push(`static lv_style_t ${styleSymbols.get(style.id)};`);
    }
    lines.push("");
    lines.push("static void ui_init_styles(void) {");
    lines.push("    static int initialized = 0;");
    lines.push("    if (initialized) {");
    lines.push("        return;");
    lines.push("    }");
    lines.push("    initialized = 1;");
    for (const style of styles) {
      const symbol = styleSymbols.get(style.id);
      if (!symbol) {
        continue;
      }
      lines.push(`    lv_style_init(&${symbol});`);
      appendReusableStylePropertiesPreview(lines, symbol, style.style);
    }
    lines.push("}");
    lines.push("");
  }

  function appendReusableStylePropertiesPreview(lines: string[], symbol: string, style: ProjectDoc["styles"][number]["style"]): void {
    const bgColor = cleanHexColorPreview(style.bgColor);
    const textColor = cleanHexColorPreview(style.textColor);
    const borderColor = cleanHexColorPreview(style.borderColor);
    if (bgColor) {
      lines.push(`    lv_style_set_bg_color(&${symbol}, lv_color_hex(0x${bgColor}));`);
    }
    if (textColor) {
      lines.push(`    lv_style_set_text_color(&${symbol}, lv_color_hex(0x${textColor}));`);
    }
    if (borderColor) {
      lines.push(`    lv_style_set_border_color(&${symbol}, lv_color_hex(0x${borderColor}));`);
    }
    if (style.font) {
      appendReusableFontStylePreview(lines, symbol, style.font);
    }
    if (style.align) {
      lines.push(`    lv_style_set_text_align(&${symbol}, ${textAlignConstant(style.align)});`);
    }
    if (typeof style.letterSpace === "number" && style.letterSpace !== 0) {
      lines.push(`    lv_style_set_text_letter_space(&${symbol}, ${style.letterSpace});`);
    }
    if (typeof style.lineSpace === "number" && style.lineSpace !== 0) {
      lines.push(`    lv_style_set_text_line_space(&${symbol}, ${style.lineSpace});`);
    }
    if (typeof style.radius === "number" && style.radius > 0) {
      lines.push(`    lv_style_set_radius(&${symbol}, ${style.radius});`);
    }
    if (typeof style.opacity === "number") {
      lines.push(`    lv_style_set_opa(&${symbol}, ${opacityConstantPreview(style.opacity)});`);
    }
    if (style.blendMode && style.blendMode !== "normal") {
      lines.push(`    lv_style_set_blend_mode(&${symbol}, ${blendModeConstant(style.blendMode)});`);
    }
    const padding = style.padding;
    if (padding) {
      if (padding.top !== 0) lines.push(`    lv_style_set_pad_top(&${symbol}, ${padding.top});`);
      if (padding.right !== 0) lines.push(`    lv_style_set_pad_right(&${symbol}, ${padding.right});`);
      if (padding.bottom !== 0) lines.push(`    lv_style_set_pad_bottom(&${symbol}, ${padding.bottom});`);
      if (padding.left !== 0) lines.push(`    lv_style_set_pad_left(&${symbol}, ${padding.left});`);
    }
  }

  function appendReusableFontStylePreview(lines: string[], symbol: string, font: string): void {
    if (isBuiltInLvglFont(font)) {
      lines.push(`    lv_style_set_text_font(&${symbol}, &${sanitizeCIdentifier(font)});`);
      return;
    }
    lines.push(`    /* Font asset ${sanitizeCComment(font)} is registered as metadata only; convert it to an LVGL font symbol before binding. */`);
  }

  function appendWidgetPreview(globals: string[], lines: string[], names: PreviewNameRegistry, assetSymbols: Map<string, string>, widget: WidgetNode, parentSymbol: string): void {
    const symbol = names.symbol(widget.name);
    globals.push(`lv_obj_t * ${symbol};`);
    lines.push(`    ${symbol} = ${createCallForPreview(widget, parentSymbol)};`);
    lines.push(`    lv_obj_set_pos(${symbol}, ${widget.layout.x}, ${widget.layout.y});`);
    lines.push(`    lv_obj_set_size(${symbol}, ${widget.layout.width}, ${widget.layout.height});`);
    appendLayoutPreview(lines, symbol, widget.layout);
    if (widget.type === "label" && typeof widget.props.text === "string") {
      lines.push(`    lv_label_set_text(${symbol}, ${JSON.stringify(widget.props.text)});`);
    }
    if (widget.type === "button" && typeof widget.props.text === "string") {
      const labelSymbol = names.symbol(`${widget.name}_Label`);
      globals.push(`lv_obj_t * ${labelSymbol};`);
      lines.push(`    ${labelSymbol} = lv_label_create(${symbol});`);
      lines.push(`    lv_label_set_text(${labelSymbol}, ${JSON.stringify(widget.props.text)});`);
      lines.push(`    lv_obj_center(${labelSymbol});`);
    }
    appendImagePreview(lines, symbol, widget, assetSymbols);
    appendWidgetPropertyPreview(lines, symbol, widget);
    appendStylePreview(lines, symbol, widget);
    appendEventPreview(lines, symbol, widget);
    if (widget.hidden) {
      lines.push(`    lv_obj_add_flag(${symbol}, LV_OBJ_FLAG_HIDDEN);`);
    }
    for (const child of widget.children) {
      appendWidgetPreview(globals, lines, names, assetSymbols, child, symbol);
    }
  }

  function appendLayoutPreview(lines: string[], symbol: string, layout: WidgetNode["layout"]): void {
    if (layout.align) {
      lines.push(`    lv_obj_align(${symbol}, ${lvglAlignConstant(layout.align)}, ${layout.x}, ${layout.y});`);
    }
    if (layout.flex) {
      lines.push(`    lv_obj_set_layout(${symbol}, LV_LAYOUT_FLEX);`);
      lines.push(`    lv_obj_set_flex_flow(${symbol}, ${lvglFlexFlowConstant(layout.flex)});`);
      if (layout.flex.gap !== 0) {
        lines.push(`    lv_obj_set_style_pad_row(${symbol}, ${layout.flex.gap}, LV_PART_MAIN | LV_STATE_DEFAULT);`);
        lines.push(`    lv_obj_set_style_pad_column(${symbol}, ${layout.flex.gap}, LV_PART_MAIN | LV_STATE_DEFAULT);`);
      }
    }
  }

  function appendImagePreview(lines: string[], symbol: string, widget: WidgetNode, assetSymbols: Map<string, string>): void {
    if (widget.type !== "image" || typeof widget.props.assetId !== "string") {
      return;
    }
    const assetSymbol = assetSymbols.get(widget.props.assetId);
    if (!assetSymbol) {
      return;
    }
    lines.push(`    lv_img_set_src(${symbol}, &${assetSymbol});`);
  }

  type AssetReferenceIssues = {
    missingImageAssetIds: string[];
    invalidImageAssetIds: string[];
    missingFontAssetIds: string[];
    invalidFontAssetIds: string[];
  };

  function findAssetReferenceIssues(widget: WidgetNode, styles: ProjectDoc["styles"], assets: AssetRef[]): AssetReferenceIssues {
    const assetKinds = new Map(assets.map((asset) => [asset.id, asset.kind]));
    const missingImageAssetIds = new Set<string>();
    const invalidImageAssetIds = new Set<string>();
    const missingFontAssetIds = new Set<string>();
    const invalidFontAssetIds = new Set<string>();
    for (const style of styles) {
      collectStyleFontAssetIssues(style.style, assetKinds, missingFontAssetIds, invalidFontAssetIds);
    }
    collectWidgetAssetIssues(widget, assetKinds, missingImageAssetIds, invalidImageAssetIds, missingFontAssetIds, invalidFontAssetIds);
    return {
      missingImageAssetIds: [...missingImageAssetIds],
      invalidImageAssetIds: [...invalidImageAssetIds],
      missingFontAssetIds: [...missingFontAssetIds],
      invalidFontAssetIds: [...invalidFontAssetIds]
    };
  }

  function collectWidgetAssetIssues(
    widget: WidgetNode,
    assetKinds: Map<string, AssetRef["kind"]>,
    missingImageAssetIds: Set<string>,
    invalidImageAssetIds: Set<string>,
    missingFontAssetIds: Set<string>,
    invalidFontAssetIds: Set<string>
  ): void {
    const assetId = widget.props.assetId;
    if (widget.type === "image" && typeof assetId === "string" && assetId) {
      const kind = assetKinds.get(assetId);
      if (!kind) {
        missingImageAssetIds.add(assetId);
      } else if (kind !== "image") {
        invalidImageAssetIds.add(assetId);
      }
    }
    collectStyleFontAssetIssues(widget.style, assetKinds, missingFontAssetIds, invalidFontAssetIds);
    for (const child of widget.children) {
      collectWidgetAssetIssues(child, assetKinds, missingImageAssetIds, invalidImageAssetIds, missingFontAssetIds, invalidFontAssetIds);
    }
  }

  function collectStyleFontAssetIssues(
    style: WidgetNode["style"],
    assetKinds: Map<string, AssetRef["kind"]>,
    missingFontAssetIds: Set<string>,
    invalidFontAssetIds: Set<string>
  ): void {
    const font = style.font;
    if (typeof font !== "string" || !font || isBuiltInLvglFont(font)) {
      return;
    }
    const kind = assetKinds.get(font);
    if (!kind) {
      missingFontAssetIds.add(font);
    } else if (kind !== "font") {
      invalidFontAssetIds.add(font);
    }
  }

  function appendWidgetPropertyPreview(lines: string[], symbol: string, widget: WidgetNode): void {
    switch (widget.type) {
      case "slider":
      case "bar":
        lines.push(`    lv_${widget.type}_set_range(${symbol}, ${numberProp(widget, "min", 0)}, ${numberProp(widget, "max", 100)});`);
        lines.push(`    lv_${widget.type}_set_value(${symbol}, ${numberProp(widget, "value", 0)}, LV_ANIM_OFF);`);
        break;
      case "arc":
        lines.push(`    lv_arc_set_range(${symbol}, ${numberProp(widget, "min", 0)}, ${numberProp(widget, "max", 100)});`);
        lines.push(`    lv_arc_set_value(${symbol}, ${numberProp(widget, "value", 0)});`);
        break;
      case "checkbox":
        if (typeof widget.props.text === "string") {
          lines.push(`    lv_checkbox_set_text(${symbol}, ${JSON.stringify(widget.props.text)});`);
        }
        if (widget.props.checked === true) {
          lines.push(`    lv_obj_add_state(${symbol}, LV_STATE_CHECKED);`);
        }
        break;
      case "switch":
        if (widget.props.checked === true) {
          lines.push(`    lv_obj_add_state(${symbol}, LV_STATE_CHECKED);`);
        }
        break;
      case "dropdown":
        if (typeof widget.props.text === "string") {
          lines.push(`    lv_dropdown_set_text(${symbol}, ${JSON.stringify(widget.props.text)});`);
        }
        if (typeof widget.props.options === "string") {
          lines.push(`    lv_dropdown_set_options(${symbol}, ${JSON.stringify(widget.props.options)});`);
        }
        lines.push(`    lv_dropdown_set_selected(${symbol}, ${numberProp(widget, "selected", 0)});`);
        break;
      case "line":
        lines.push(`    static lv_point_t ${symbol}_points[] = {{0, 0}, {${widget.layout.width}, ${widget.layout.height}}};`);
        lines.push(`    lv_line_set_points(${symbol}, ${symbol}_points, 2);`);
        break;
      case "chart":
        lines.push(`    lv_chart_set_range(${symbol}, LV_CHART_AXIS_PRIMARY_Y, ${numberProp(widget, "min", 0)}, ${numberProp(widget, "max", 100)});`);
        lines.push(`    lv_chart_set_point_count(${symbol}, ${numberProp(widget, "pointCount", 8)});`);
        lines.push(`    lv_chart_set_type(${symbol}, LV_CHART_TYPE_LINE);`);
        lines.push(`    lv_chart_series_t * ${symbol}_series = lv_chart_add_series(${symbol}, lv_palette_main(LV_PALETTE_BLUE), LV_CHART_AXIS_PRIMARY_Y);`);
        for (const value of chartValuesProp(widget)) {
          lines.push(`    lv_chart_set_next_value(${symbol}, ${symbol}_series, ${value});`);
        }
        lines.push(`    lv_chart_refresh(${symbol});`);
        break;
    }
  }

  function appendStylePreview(lines: string[], symbol: string, widget: WidgetNode): void {
    const bgColor = cleanHexColorPreview(widget.style.bgColor);
    const textColor = cleanHexColorPreview(widget.style.textColor);
    const borderColor = cleanHexColorPreview(widget.style.borderColor);
    if (bgColor) {
      lines.push(`    lv_obj_set_style_bg_color(${symbol}, lv_color_hex(0x${bgColor}), LV_PART_MAIN | LV_STATE_DEFAULT);`);
    }
    if (textColor) {
      lines.push(`    lv_obj_set_style_text_color(${symbol}, lv_color_hex(0x${textColor}), LV_PART_MAIN | LV_STATE_DEFAULT);`);
    }
    if (borderColor) {
      lines.push(`    lv_obj_set_style_border_color(${symbol}, lv_color_hex(0x${borderColor}), LV_PART_MAIN | LV_STATE_DEFAULT);`);
    }
    if (widget.style.font) {
      appendFontStylePreview(lines, symbol, widget.style.font);
    }
    if (widget.style.align) {
      lines.push(`    lv_obj_set_style_text_align(${symbol}, ${textAlignConstant(widget.style.align)}, LV_PART_MAIN | LV_STATE_DEFAULT);`);
    }
    if (typeof widget.style.letterSpace === "number" && widget.style.letterSpace !== 0) {
      lines.push(`    lv_obj_set_style_text_letter_space(${symbol}, ${widget.style.letterSpace}, LV_PART_MAIN | LV_STATE_DEFAULT);`);
    }
    if (typeof widget.style.lineSpace === "number" && widget.style.lineSpace !== 0) {
      lines.push(`    lv_obj_set_style_text_line_space(${symbol}, ${widget.style.lineSpace}, LV_PART_MAIN | LV_STATE_DEFAULT);`);
    }
    if (typeof widget.style.radius === "number") {
      lines.push(`    lv_obj_set_style_radius(${symbol}, ${widget.style.radius}, LV_PART_MAIN | LV_STATE_DEFAULT);`);
    }
    if (typeof widget.style.opacity === "number") {
      lines.push(`    lv_obj_set_style_opa(${symbol}, ${Math.round((Math.max(0, Math.min(100, widget.style.opacity)) * 255) / 100)}, LV_PART_MAIN | LV_STATE_DEFAULT);`);
    }
    if (widget.style.blendMode && widget.style.blendMode !== "normal") {
      lines.push(`    lv_obj_set_style_blend_mode(${symbol}, ${blendModeConstant(widget.style.blendMode)}, LV_PART_MAIN | LV_STATE_DEFAULT);`);
    }
    if (widget.style.padding) {
      const padding = widget.style.padding;
      if (padding.top !== 0) lines.push(`    lv_obj_set_style_pad_top(${symbol}, ${padding.top}, LV_PART_MAIN | LV_STATE_DEFAULT);`);
      if (padding.right !== 0) lines.push(`    lv_obj_set_style_pad_right(${symbol}, ${padding.right}, LV_PART_MAIN | LV_STATE_DEFAULT);`);
      if (padding.bottom !== 0) lines.push(`    lv_obj_set_style_pad_bottom(${symbol}, ${padding.bottom}, LV_PART_MAIN | LV_STATE_DEFAULT);`);
      if (padding.left !== 0) lines.push(`    lv_obj_set_style_pad_left(${symbol}, ${padding.left}, LV_PART_MAIN | LV_STATE_DEFAULT);`);
    }
  }

  function appendEventPreview(lines: string[], symbol: string, widget: WidgetNode): void {
    for (const event of project.value.events.filter((item) => item.widgetId === widget.id)) {
      lines.push(`    lv_obj_add_event_cb(${symbol}, ${sanitizeCIdentifier(event.handlerName)}, ${event.event}, NULL);`);
    }
  }

  function appendEventCallbackStubs(lines: string[], root: WidgetNode): void {
    const widgetIds = new Set<string>();
    collectWidgetIdsForPreview(root, widgetIds);
    const seen = new Set<string>();
    const callbackNames = project.value.events
      .filter((event) => widgetIds.has(event.widgetId))
      .map((event) => sanitizeCIdentifier(event.handlerName))
      .filter((handlerName) => {
        if (seen.has(handlerName)) {
          return false;
        }
        seen.add(handlerName);
        return true;
      });
    for (const callbackName of callbackNames) {
      lines.push("");
      lines.push(`void ${callbackName}(lv_event_t * e) {`);
      lines.push("    /* User code can be added here. */");
      lines.push("}");
    }
  }

  function collectWidgetIdsForPreview(widget: WidgetNode, result: Set<string>): void {
    result.add(widget.id);
    for (const child of widget.children) {
      collectWidgetIdsForPreview(child, result);
    }
  }

  function createCallForPreview(widget: WidgetNode, parentSymbol: string): string {
    if (widget.type === "spinner") {
      return `lv_spinner_create(${parentSymbol}, ${Number(widget.props.spinTime ?? 1000)}, ${Number(widget.props.arcLength ?? 60)})`;
    }
    const factories: Record<string, string> = {
      button: "lv_btn_create",
      label: "lv_label_create",
      image: "lv_img_create",
      container: "lv_obj_create",
      arc: "lv_arc_create",
      bar: "lv_bar_create",
      line: "lv_line_create",
      switch: "lv_switch_create",
      slider: "lv_slider_create",
      checkbox: "lv_checkbox_create",
      dropdown: "lv_dropdown_create",
      spinner: "lv_spinner_create",
      chart: "lv_chart_create"
    };
    return `${factories[widget.type] ?? "lv_obj_create"}(${parentSymbol})`;
  }

  function lvglAlignConstant(align: NonNullable<WidgetNode["layout"]["align"]>): string {
    const constants: Record<NonNullable<WidgetNode["layout"]["align"]>, string> = {
      "top-left": "LV_ALIGN_TOP_LEFT",
      "top-right": "LV_ALIGN_TOP_RIGHT",
      center: "LV_ALIGN_CENTER",
      "bottom-left": "LV_ALIGN_BOTTOM_LEFT",
      "bottom-right": "LV_ALIGN_BOTTOM_RIGHT"
    };
    return constants[align];
  }

  function lvglFlexFlowConstant(flex: NonNullable<WidgetNode["layout"]["flex"]>): string {
    if (flex.direction === "column") {
      return flex.wrap ? "LV_FLEX_FLOW_COLUMN_WRAP" : "LV_FLEX_FLOW_COLUMN";
    }
    return flex.wrap ? "LV_FLEX_FLOW_ROW_WRAP" : "LV_FLEX_FLOW_ROW";
  }

  function numberProp(widget: WidgetNode, key: string, fallback: number): number {
    const value = widget.props[key];
    return typeof value === "number" ? value : fallback;
  }

  function chartValuesProp(widget: WidgetNode): number[] {
    const values = widget.props.values;
    const min = numberProp(widget, "min", 0);
    const max = numberProp(widget, "max", 100);
    const pointCount = Math.max(1, Math.floor(numberProp(widget, "pointCount", 8)));
    if (Array.isArray(values) && values.length > 0) {
      const normalized = values
        .filter((value) => Number.isFinite(value))
        .slice(0, pointCount)
        .map((value) => Math.max(min, Math.min(max, value)));
      if (normalized.length > 0) {
        return normalized;
      }
    }
    const span = Math.max(0, max - min);
    return Array.from({ length: pointCount }, (_unused, index) => min + ((index * 37 + 20) % (span + 1)));
  }

  function createPreviewNameRegistry(): PreviewNameRegistry {
    const used: Record<string, number> = {};
    return {
      symbol(name: string): string {
        const base = `ui_${sanitizeCIdentifier(name)}`;
        const count = used[base] ?? 0;
        used[base] = count + 1;
        return count === 0 ? base : `${base}_${count + 1}`;
      }
    };
  }

  function sanitizeCIdentifier(value: string): string {
    const cleaned = value.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    if (!cleaned) {
      return "Widget";
    }
    return /^[0-9]/.test(cleaned) ? `_${cleaned}` : cleaned;
  }

  function appendFontStylePreview(lines: string[], symbol: string, font: string): void {
    if (isBuiltInLvglFont(font)) {
      lines.push(`    lv_obj_set_style_text_font(${symbol}, &${sanitizeCIdentifier(font)}, LV_PART_MAIN | LV_STATE_DEFAULT);`);
      return;
    }
    lines.push(`    /* Font asset ${sanitizeCComment(font)} is registered as metadata only; convert it to an LVGL font symbol before binding. */`);
  }

  function isBuiltInLvglFont(font: string): boolean {
    return /^lv_font_montserrat_\d+$/.test(font);
  }

  function sanitizeCComment(value: string): string {
    return value.replaceAll("*/", "* /");
  }

  function cleanHexColorPreview(value: string | undefined): string | null {
    let color = value?.trim().replace(/^#/, "") ?? "";
    if (/^[0-9a-fA-F]{3}$/.test(color)) {
      color = color.split("").map((char) => `${char}${char}`).join("");
    }
    return /^[0-9a-fA-F]{6}$/.test(color) ? color.toUpperCase() : null;
  }

  function textAlignConstant(align: NonNullable<WidgetNode["style"]["align"]>): string {
    const constants: Record<NonNullable<WidgetNode["style"]["align"]>, string> = {
      left: "LV_TEXT_ALIGN_LEFT",
      center: "LV_TEXT_ALIGN_CENTER",
      right: "LV_TEXT_ALIGN_RIGHT"
    };
    return constants[align];
  }

  function blendModeConstant(blendMode: NonNullable<WidgetNode["style"]["blendMode"]>): string {
    const constants: Record<NonNullable<WidgetNode["style"]["blendMode"]>, string> = {
      normal: "LV_BLEND_MODE_NORMAL",
      additive: "LV_BLEND_MODE_ADDITIVE",
      subtractive: "LV_BLEND_MODE_SUBTRACTIVE",
      multiply: "LV_BLEND_MODE_MULTIPLY",
      replace: "LV_BLEND_MODE_REPLACE"
    };
    return constants[blendMode];
  }

  function opacityConstantPreview(value: number): string {
    if (value >= 100) return "LV_OPA_COVER";
    if (value >= 90) return "LV_OPA_90";
    if (value >= 80) return "LV_OPA_80";
    if (value >= 70) return "LV_OPA_70";
    if (value >= 60) return "LV_OPA_60";
    if (value >= 50) return "LV_OPA_50";
    if (value >= 40) return "LV_OPA_40";
    if (value >= 30) return "LV_OPA_30";
    if (value >= 20) return "LV_OPA_20";
    if (value >= 10) return "LV_OPA_10";
    return "LV_OPA_TRANSP";
  }

  return { codePreview, codeCopyStatus, copyGeneratedCode };
}
