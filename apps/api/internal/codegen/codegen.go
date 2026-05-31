package codegen

import (
	"archive/zip"
	"bytes"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"math"
	"regexp"
	"sort"
	"strings"
	"time"
)

type ProjectDoc struct {
	SchemaVersion int            `json:"schemaVersion"`
	ID            string         `json:"id"`
	Name          string         `json:"name"`
	Theme         string         `json:"theme"`
	Target        TargetConfig   `json:"target"`
	Screens       []ScreenNode   `json:"screens"`
	Assets        []AssetRef     `json:"assets"`
	Styles        []StyleDef     `json:"styles"`
	Events        []EventBinding `json:"events"`
	UpdatedAt     string         `json:"updatedAt"`
}

type TargetConfig struct {
	LvglVersion string `json:"lvglVersion"`
	DeviceName  string `json:"deviceName"`
	Width       int    `json:"width"`
	Height      int    `json:"height"`
	DPI         int    `json:"dpi"`
	ColorDepth  int    `json:"colorDepth"`
}

type ScreenNode struct {
	ID   string     `json:"id"`
	Name string     `json:"name"`
	Root WidgetNode `json:"root"`
}

type WidgetNode struct {
	ID       string         `json:"id"`
	Type     string         `json:"type"`
	Name     string         `json:"name"`
	ParentID *string        `json:"parentId"`
	Children []WidgetNode   `json:"children"`
	Layout   LayoutBox      `json:"layout"`
	Props    map[string]any `json:"props"`
	Style    WidgetStyle    `json:"style"`
	Locked   bool           `json:"locked"`
	Hidden   bool           `json:"hidden"`
}

type AssetRef struct {
	ID        string `json:"id"`
	ProjectID string `json:"projectId"`
	Name      string `json:"name"`
	Kind      string `json:"kind"`
	MimeType  string `json:"mimeType"`
	Width     int    `json:"width,omitempty"`
	Height    int    `json:"height,omitempty"`
	SizeBytes int    `json:"sizeBytes"`
	ObjectKey string `json:"objectKey"`
	CreatedAt string `json:"createdAt"`
	Data      []byte `json:"-"`
}

type EventBinding struct {
	ID          string `json:"id"`
	WidgetID    string `json:"widgetId"`
	Event       string `json:"event"`
	HandlerName string `json:"handlerName"`
}

type StyleDef struct {
	ID    string      `json:"id"`
	Name  string      `json:"name"`
	Style WidgetStyle `json:"style"`
}

type LayoutBox struct {
	X      int         `json:"x"`
	Y      int         `json:"y"`
	Width  int         `json:"width"`
	Height int         `json:"height"`
	Align  string      `json:"align,omitempty"`
	Flex   *FlexLayout `json:"flex,omitempty"`
}

type FlexLayout struct {
	Direction string `json:"direction"`
	Gap       int    `json:"gap"`
	Wrap      bool   `json:"wrap"`
}

type WidgetStyle struct {
	BgColor     string     `json:"bgColor,omitempty"`
	TextColor   string     `json:"textColor,omitempty"`
	BorderColor string     `json:"borderColor,omitempty"`
	Radius      int        `json:"radius,omitempty"`
	Opacity     *int       `json:"opacity,omitempty"`
	BlendMode   string     `json:"blendMode,omitempty"`
	Padding     PaddingBox `json:"padding,omitempty"`
	Font        string     `json:"font,omitempty"`
	LineSpace   int        `json:"lineSpace,omitempty"`
	LetterSpace int        `json:"letterSpace,omitempty"`
	Align       string     `json:"align,omitempty"`
}

type PaddingBox struct {
	Top    int `json:"top"`
	Right  int `json:"right"`
	Bottom int `json:"bottom"`
	Left   int `json:"left"`
}

type generatedFile struct {
	path    string
	content string
}

func GenerateCZip(doc ProjectDoc) ([]byte, error) {
	files, err := GenerateC(doc)
	if err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	writer := zip.NewWriter(&buf)
	for _, file := range files {
		handle, err := writer.Create(file.path)
		if err != nil {
			return nil, err
		}
		if _, err := handle.Write([]byte(file.content)); err != nil {
			return nil, err
		}
	}
	if err := writer.Close(); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

func GenerateC(doc ProjectDoc) ([]generatedFile, error) {
	if err := validateProjectDoc(doc); err != nil {
		return nil, err
	}

	var uiCGlobals strings.Builder
	var uiCBody strings.Builder
	var uiH strings.Builder
	var assetsC strings.Builder
	var assetsH strings.Builder

	uiH.WriteString("#pragma once\n\n#include \"lvgl.h\"\n\n")
	assetsC.WriteString("#include \"assets.h\"\n\n")
	assetsH.WriteString("#pragma once\n\n#include \"lvgl.h\"\n\n")

	names := newNameRegistry()
	styleNames := newNameRegistry()
	screenSymbols := map[string]string{}
	assetSymbols := assetSymbolMap(doc.Assets)
	eventBindings := eventBindingMap(doc.Events)
	styleSymbols := styleSymbolMap(doc.Styles, styleNames)

	for _, asset := range doc.Assets {
		if asset.Kind == "image" {
			assetsH.WriteString(fmt.Sprintf("LV_IMG_DECLARE(%s);\n", assetSymbols[asset.ID]))
			writeImageAsset(&assetsC, assetSymbols[asset.ID], asset, doc.Target.ColorDepth)
		}
	}

	for _, screen := range doc.Screens {
		symbol := names.Symbol(screen.Name)
		screenSymbols[screen.Root.ID] = symbol
		uiH.WriteString(fmt.Sprintf("extern lv_obj_t * %s;\n", symbol))
		uiH.WriteString(fmt.Sprintf("void %s_screen_init(void);\n", symbol))
		uiCGlobals.WriteString(fmt.Sprintf("lv_obj_t * %s;\n\n", symbol))
	}

	uiH.WriteString("\n")

	writeReusableStyles(&uiCBody, doc.Styles, styleSymbols)

	for _, screen := range doc.Screens {
		symbol := screenSymbols[screen.Root.ID]
		uiCBody.WriteString(fmt.Sprintf("void %s_screen_init(void) {\n", symbol))
		if len(doc.Styles) > 0 {
			uiCBody.WriteString("    ui_init_styles();\n")
		}
		uiCBody.WriteString(fmt.Sprintf("    %s = lv_obj_create(NULL);\n", symbol))
		writeLayout(&uiCBody, symbol, screen.Root.Layout)
		writeStyle(&uiCBody, symbol, screen.Root.Style)
		writeEventBindings(&uiCBody, symbol, eventBindings[screen.Root.ID])
		for _, child := range screen.Root.Children {
			if err := writeWidget(&uiCBody, &uiCGlobals, &uiH, names, screenSymbols, assetSymbols, eventBindings, symbol, child); err != nil {
				return nil, err
			}
		}
		uiCBody.WriteString("}\n")
	}

	if err := validateEventBindings(doc.Events, screenSymbols, generatedCSymbols(doc, styleSymbols, assetSymbols)); err != nil {
		return nil, err
	}
	for _, callbackName := range uniqueEventCallbackNames(doc.Events) {
		uiH.WriteString(fmt.Sprintf("void %s(lv_event_t * e);\n", callbackName))
	}

	for _, callbackName := range uniqueEventCallbackNames(doc.Events) {
		uiCBody.WriteString(fmt.Sprintf("\nvoid %s(lv_event_t * e) {\n", callbackName))
		uiCBody.WriteString("    /* User code can be added here. */\n")
		uiCBody.WriteString("}\n")
	}

	uiC := "#include \"ui.h\"\n#include \"assets.h\"\n\n" + uiCGlobals.String() + uiCBody.String()

	files := []generatedFile{
		{path: "ui.c", content: uiC},
		{path: "ui.h", content: uiH.String()},
		{path: "assets.c", content: assetsC.String()},
		{path: "assets.h", content: assetsH.String()},
		{path: "README.md", content: exportReadme(doc)},
	}
	sort.Slice(files, func(i, j int) bool { return files[i].path < files[j].path })

	return files, nil
}

func writeWidget(
	uiC *strings.Builder,
	uiCGlobals *strings.Builder,
	uiH *strings.Builder,
	names *nameRegistry,
	symbols map[string]string,
	assetSymbols map[string]string,
	eventBindings map[string][]EventBinding,
	parentSymbol string,
	widget WidgetNode,
) error {
	createCall, err := lvglCreateCall(widget, parentSymbol)
	if err != nil {
		return err
	}

	symbol := names.Symbol(widget.Name)
	symbols[widget.ID] = symbol
	uiH.WriteString(fmt.Sprintf("extern lv_obj_t * %s;\n", symbol))
	uiCGlobals.WriteString(fmt.Sprintf("lv_obj_t * %s;\n\n", symbol))
	uiC.WriteString(fmt.Sprintf("    %s = %s;\n", symbol, createCall))
	uiC.WriteString(fmt.Sprintf("    lv_obj_set_pos(%s, %d, %d);\n", symbol, widget.Layout.X, widget.Layout.Y))
	uiC.WriteString(fmt.Sprintf("    lv_obj_set_size(%s, %d, %d);\n", symbol, widget.Layout.Width, widget.Layout.Height))
	writeLayout(uiC, symbol, widget.Layout)

	if text, ok := widget.Props["text"].(string); ok && widget.Type == "label" {
		uiC.WriteString(fmt.Sprintf("    lv_label_set_text(%s, %q);\n", symbol, text))
	}
	if text, ok := widget.Props["text"].(string); ok && widget.Type == "button" {
		labelSymbol := names.Symbol(widget.Name + "_Label")
		uiH.WriteString(fmt.Sprintf("extern lv_obj_t * %s;\n", labelSymbol))
		uiCGlobals.WriteString(fmt.Sprintf("lv_obj_t * %s;\n\n", labelSymbol))
		uiC.WriteString(fmt.Sprintf("    %s = lv_label_create(%s);\n", labelSymbol, symbol))
		uiC.WriteString(fmt.Sprintf("    lv_label_set_text(%s, %q);\n", labelSymbol, text))
		uiC.WriteString(fmt.Sprintf("    lv_obj_center(%s);\n", labelSymbol))
	}
	if assetID, ok := widget.Props["assetId"].(string); ok && widget.Type == "image" {
		assetSymbol, ok := assetSymbols[assetID]
		if !ok {
			return fmt.Errorf("image widget references missing asset: %s", assetID)
		}
		uiC.WriteString(fmt.Sprintf("    lv_img_set_src(%s, &%s);\n", symbol, assetSymbol))
	}
	writeWidgetProperties(uiC, symbol, widget)
	if widget.Hidden {
		uiC.WriteString(fmt.Sprintf("    lv_obj_add_flag(%s, LV_OBJ_FLAG_HIDDEN);\n", symbol))
	}
	writeStyle(uiC, symbol, widget.Style)
	writeEventBindings(uiC, symbol, eventBindings[widget.ID])

	for _, child := range widget.Children {
		if err := writeWidget(uiC, uiCGlobals, uiH, names, symbols, assetSymbols, eventBindings, symbol, child); err != nil {
			return err
		}
	}

	return nil
}

func writeEventBindings(uiC *strings.Builder, symbol string, events []EventBinding) {
	for _, event := range events {
		uiC.WriteString(fmt.Sprintf(
			"    lv_obj_add_event_cb(%s, %s, %s, NULL);\n",
			symbol,
			sanitizeIdentifier(event.HandlerName),
			event.Event,
		))
	}
}

func writeReusableStyles(uiC *strings.Builder, styles []StyleDef, styleSymbols map[string]string) {
	if len(styles) == 0 {
		return
	}
	for _, style := range styles {
		uiC.WriteString(fmt.Sprintf("static lv_style_t %s;\n", styleSymbols[style.ID]))
	}
	uiC.WriteString("\nstatic void ui_init_styles(void) {\n")
	uiC.WriteString("    static int initialized = 0;\n")
	uiC.WriteString("    if (initialized) {\n")
	uiC.WriteString("        return;\n")
	uiC.WriteString("    }\n")
	uiC.WriteString("    initialized = 1;\n")
	for _, style := range styles {
		symbol := styleSymbols[style.ID]
		uiC.WriteString(fmt.Sprintf("    lv_style_init(&%s);\n", symbol))
		writeReusableStyleProperties(uiC, symbol, style.Style)
	}
	uiC.WriteString("}\n\n")
}

func writeReusableStyleProperties(uiC *strings.Builder, symbol string, style WidgetStyle) {
	if color, ok := cleanHexColor(style.BgColor); ok {
		uiC.WriteString(fmt.Sprintf("    lv_style_set_bg_color(&%s, lv_color_hex(0x%s));\n", symbol, color))
	}
	if color, ok := cleanHexColor(style.TextColor); ok {
		uiC.WriteString(fmt.Sprintf("    lv_style_set_text_color(&%s, lv_color_hex(0x%s));\n", symbol, color))
	}
	if color, ok := cleanHexColor(style.BorderColor); ok {
		uiC.WriteString(fmt.Sprintf("    lv_style_set_border_color(&%s, lv_color_hex(0x%s));\n", symbol, color))
	}
	if style.Font != "" {
		writeReusableFontStyle(uiC, symbol, style.Font)
	}
	if style.Align != "" {
		uiC.WriteString(fmt.Sprintf("    lv_style_set_text_align(&%s, %s);\n", symbol, textAlignConstant(style.Align)))
	}
	if style.LetterSpace != 0 {
		uiC.WriteString(fmt.Sprintf("    lv_style_set_text_letter_space(&%s, %d);\n", symbol, style.LetterSpace))
	}
	if style.LineSpace != 0 {
		uiC.WriteString(fmt.Sprintf("    lv_style_set_text_line_space(&%s, %d);\n", symbol, style.LineSpace))
	}
	if style.Radius > 0 {
		uiC.WriteString(fmt.Sprintf("    lv_style_set_radius(&%s, %d);\n", symbol, style.Radius))
	}
	if style.Opacity != nil {
		uiC.WriteString(fmt.Sprintf("    lv_style_set_opa(&%s, %s);\n", symbol, opacityConstant(*style.Opacity)))
	}
	if style.BlendMode != "" && style.BlendMode != "normal" {
		uiC.WriteString(fmt.Sprintf("    lv_style_set_blend_mode(&%s, %s);\n", symbol, blendModeConstant(style.BlendMode)))
	}
	if style.Padding.Top != 0 {
		uiC.WriteString(fmt.Sprintf("    lv_style_set_pad_top(&%s, %d);\n", symbol, style.Padding.Top))
	}
	if style.Padding.Right != 0 {
		uiC.WriteString(fmt.Sprintf("    lv_style_set_pad_right(&%s, %d);\n", symbol, style.Padding.Right))
	}
	if style.Padding.Bottom != 0 {
		uiC.WriteString(fmt.Sprintf("    lv_style_set_pad_bottom(&%s, %d);\n", symbol, style.Padding.Bottom))
	}
	if style.Padding.Left != 0 {
		uiC.WriteString(fmt.Sprintf("    lv_style_set_pad_left(&%s, %d);\n", symbol, style.Padding.Left))
	}
}

func writeWidgetProperties(uiC *strings.Builder, symbol string, widget WidgetNode) {
	switch widget.Type {
	case "slider":
		writeRangeAndAnimatedValue(uiC, "lv_slider", symbol, widget.Props)
	case "bar":
		writeRangeAndAnimatedValue(uiC, "lv_bar", symbol, widget.Props)
	case "arc":
		min, hasMin := intProp(widget.Props, "min")
		max, hasMax := intProp(widget.Props, "max")
		if hasMin && hasMax {
			uiC.WriteString(fmt.Sprintf("    lv_arc_set_range(%s, %d, %d);\n", symbol, min, max))
		}
		if value, ok := intProp(widget.Props, "value"); ok {
			uiC.WriteString(fmt.Sprintf("    lv_arc_set_value(%s, %d);\n", symbol, value))
		}
	case "checkbox":
		if text, ok := widget.Props["text"].(string); ok {
			uiC.WriteString(fmt.Sprintf("    lv_checkbox_set_text(%s, %q);\n", symbol, text))
		}
		if checked, ok := widget.Props["checked"].(bool); ok && checked {
			uiC.WriteString(fmt.Sprintf("    lv_obj_add_state(%s, LV_STATE_CHECKED);\n", symbol))
		}
	case "switch":
		if checked, ok := widget.Props["checked"].(bool); ok && checked {
			uiC.WriteString(fmt.Sprintf("    lv_obj_add_state(%s, LV_STATE_CHECKED);\n", symbol))
		}
	case "dropdown":
		if text, ok := widget.Props["text"].(string); ok {
			uiC.WriteString(fmt.Sprintf("    lv_dropdown_set_text(%s, %q);\n", symbol, text))
		}
		if options, ok := widget.Props["options"].(string); ok {
			uiC.WriteString(fmt.Sprintf("    lv_dropdown_set_options(%s, %q);\n", symbol, options))
		}
		if selected, ok := intProp(widget.Props, "selected"); ok {
			uiC.WriteString(fmt.Sprintf("    lv_dropdown_set_selected(%s, %d);\n", symbol, selected))
		}
	case "line":
		pointsSymbol := fmt.Sprintf("%s_points", symbol)
		uiC.WriteString(fmt.Sprintf("    static lv_point_t %s[] = {{0, 0}, {%d, %d}};\n", pointsSymbol, widget.Layout.Width, widget.Layout.Height))
		uiC.WriteString(fmt.Sprintf("    lv_line_set_points(%s, %s, 2);\n", symbol, pointsSymbol))
	case "chart":
		min, hasMin := intProp(widget.Props, "min")
		max, hasMax := intProp(widget.Props, "max")
		if hasMin && hasMax {
			uiC.WriteString(fmt.Sprintf("    lv_chart_set_range(%s, LV_CHART_AXIS_PRIMARY_Y, %d, %d);\n", symbol, min, max))
		}
		pointCount := 8
		if nextPointCount, ok := intProp(widget.Props, "pointCount"); ok {
			pointCount = nextPointCount
			uiC.WriteString(fmt.Sprintf("    lv_chart_set_point_count(%s, %d);\n", symbol, pointCount))
		} else {
			uiC.WriteString(fmt.Sprintf("    lv_chart_set_point_count(%s, %d);\n", symbol, pointCount))
		}
		uiC.WriteString(fmt.Sprintf("    lv_chart_set_type(%s, LV_CHART_TYPE_LINE);\n", symbol))
		writeChartSeries(uiC, symbol, widget.Props, min, max, pointCount)
	}
}

func writeChartSeries(uiC *strings.Builder, symbol string, props map[string]any, min int, max int, pointCount int) {
	if pointCount <= 0 {
		pointCount = 1
	}
	if max <= min {
		min = 0
		max = 100
	}
	seriesSymbol := fmt.Sprintf("%s_series", symbol)
	uiC.WriteString(fmt.Sprintf("    lv_chart_series_t * %s = lv_chart_add_series(%s, lv_palette_main(LV_PALETTE_BLUE), LV_CHART_AXIS_PRIMARY_Y);\n", seriesSymbol, symbol))
	for _, value := range chartValues(props, min, max, pointCount) {
		uiC.WriteString(fmt.Sprintf("    lv_chart_set_next_value(%s, %s, %d);\n", symbol, seriesSymbol, value))
	}
	uiC.WriteString(fmt.Sprintf("    lv_chart_refresh(%s);\n", symbol))
}

func chartValues(props map[string]any, min int, max int, pointCount int) []int {
	if rawValues, ok := props["values"].([]any); ok && len(rawValues) > 0 {
		values := make([]int, 0, minInt(len(rawValues), pointCount))
		for index, rawValue := range rawValues {
			if index >= pointCount {
				break
			}
			value, ok := intValue(rawValue)
			if !ok {
				continue
			}
			values = append(values, clampInt(value, min, max))
		}
		if len(values) > 0 {
			return values
		}
	}
	values := make([]int, 0, pointCount)
	span := max - min
	for index := 0; index < pointCount; index += 1 {
		value := min + ((index*37 + 20) % (span + 1))
		values = append(values, value)
	}
	return values
}

func intValue(value any) (int, bool) {
	switch typed := value.(type) {
	case int:
		return typed, true
	case int32:
		return int(typed), true
	case int64:
		return int(typed), true
	case float64:
		return int(typed), true
	case float32:
		return int(typed), true
	default:
		return 0, false
	}
}

func clampInt(value int, min int, max int) int {
	if value < min {
		return min
	}
	if value > max {
		return max
	}
	return value
}

func minInt(left int, right int) int {
	if left < right {
		return left
	}
	return right
}

func writeLayout(uiC *strings.Builder, symbol string, layout LayoutBox) {
	if layout.Align != "" {
		uiC.WriteString(fmt.Sprintf("    lv_obj_align(%s, %s, %d, %d);\n", symbol, lvglAlignConstant(layout.Align), layout.X, layout.Y))
	}
	if layout.Flex != nil {
		uiC.WriteString(fmt.Sprintf("    lv_obj_set_layout(%s, LV_LAYOUT_FLEX);\n", symbol))
		uiC.WriteString(fmt.Sprintf("    lv_obj_set_flex_flow(%s, %s);\n", symbol, flexFlowConstant(*layout.Flex)))
		if layout.Flex.Gap != 0 {
			uiC.WriteString(fmt.Sprintf("    lv_obj_set_style_pad_row(%s, %d, LV_PART_MAIN | LV_STATE_DEFAULT);\n", symbol, layout.Flex.Gap))
			uiC.WriteString(fmt.Sprintf("    lv_obj_set_style_pad_column(%s, %d, LV_PART_MAIN | LV_STATE_DEFAULT);\n", symbol, layout.Flex.Gap))
		}
	}
}

func lvglAlignConstant(value string) string {
	switch strings.ToLower(value) {
	case "top-right":
		return "LV_ALIGN_TOP_RIGHT"
	case "center":
		return "LV_ALIGN_CENTER"
	case "bottom-left":
		return "LV_ALIGN_BOTTOM_LEFT"
	case "bottom-right":
		return "LV_ALIGN_BOTTOM_RIGHT"
	default:
		return "LV_ALIGN_TOP_LEFT"
	}
}

func flexFlowConstant(flex FlexLayout) string {
	direction := strings.ToLower(flex.Direction)
	if direction == "column" {
		if flex.Wrap {
			return "LV_FLEX_FLOW_COLUMN_WRAP"
		}
		return "LV_FLEX_FLOW_COLUMN"
	}
	if flex.Wrap {
		return "LV_FLEX_FLOW_ROW_WRAP"
	}
	return "LV_FLEX_FLOW_ROW"
}

func writeRangeAndAnimatedValue(uiC *strings.Builder, prefix string, symbol string, props map[string]any) {
	min, hasMin := intProp(props, "min")
	max, hasMax := intProp(props, "max")
	if hasMin && hasMax {
		uiC.WriteString(fmt.Sprintf("    %s_set_range(%s, %d, %d);\n", prefix, symbol, min, max))
	}
	if value, ok := intProp(props, "value"); ok {
		uiC.WriteString(fmt.Sprintf("    %s_set_value(%s, %d, LV_ANIM_OFF);\n", prefix, symbol, value))
	}
}

func intProp(props map[string]any, key string) (int, bool) {
	value, ok := props[key]
	if !ok {
		return 0, false
	}
	switch typed := value.(type) {
	case int:
		return typed, true
	case int32:
		return int(typed), true
	case int64:
		return int(typed), true
	case float64:
		return int(typed), true
	case float32:
		return int(typed), true
	default:
		return 0, false
	}
}

func writeStyle(uiC *strings.Builder, symbol string, style WidgetStyle) {
	if color, ok := cleanHexColor(style.BgColor); ok {
		uiC.WriteString(fmt.Sprintf(
			"    lv_obj_set_style_bg_color(%s, lv_color_hex(0x%s), LV_PART_MAIN | LV_STATE_DEFAULT);\n",
			symbol,
			color,
		))
	}
	if color, ok := cleanHexColor(style.TextColor); ok {
		uiC.WriteString(fmt.Sprintf(
			"    lv_obj_set_style_text_color(%s, lv_color_hex(0x%s), LV_PART_MAIN | LV_STATE_DEFAULT);\n",
			symbol,
			color,
		))
	}
	if color, ok := cleanHexColor(style.BorderColor); ok {
		uiC.WriteString(fmt.Sprintf(
			"    lv_obj_set_style_border_color(%s, lv_color_hex(0x%s), LV_PART_MAIN | LV_STATE_DEFAULT);\n",
			symbol,
			color,
		))
	}
	if style.Font != "" {
		writeObjectFontStyle(uiC, symbol, style.Font)
	}
	if style.Align != "" {
		uiC.WriteString(fmt.Sprintf(
			"    lv_obj_set_style_text_align(%s, %s, LV_PART_MAIN | LV_STATE_DEFAULT);\n",
			symbol,
			textAlignConstant(style.Align),
		))
	}
	if style.LetterSpace != 0 {
		uiC.WriteString(fmt.Sprintf("    lv_obj_set_style_text_letter_space(%s, %d, LV_PART_MAIN | LV_STATE_DEFAULT);\n", symbol, style.LetterSpace))
	}
	if style.LineSpace != 0 {
		uiC.WriteString(fmt.Sprintf("    lv_obj_set_style_text_line_space(%s, %d, LV_PART_MAIN | LV_STATE_DEFAULT);\n", symbol, style.LineSpace))
	}
	if style.Radius > 0 {
		uiC.WriteString(fmt.Sprintf(
			"    lv_obj_set_style_radius(%s, %d, LV_PART_MAIN | LV_STATE_DEFAULT);\n",
			symbol,
			style.Radius,
		))
	}
	if style.Opacity != nil {
		uiC.WriteString(fmt.Sprintf(
			"    lv_obj_set_style_opa(%s, %s, LV_PART_MAIN | LV_STATE_DEFAULT);\n",
			symbol,
			opacityConstant(*style.Opacity),
		))
	}
	if style.BlendMode != "" && style.BlendMode != "normal" {
		uiC.WriteString(fmt.Sprintf(
			"    lv_obj_set_style_blend_mode(%s, %s, LV_PART_MAIN | LV_STATE_DEFAULT);\n",
			symbol,
			blendModeConstant(style.BlendMode),
		))
	}
	if style.Padding.Top != 0 {
		uiC.WriteString(fmt.Sprintf("    lv_obj_set_style_pad_top(%s, %d, LV_PART_MAIN | LV_STATE_DEFAULT);\n", symbol, style.Padding.Top))
	}
	if style.Padding.Right != 0 {
		uiC.WriteString(fmt.Sprintf("    lv_obj_set_style_pad_right(%s, %d, LV_PART_MAIN | LV_STATE_DEFAULT);\n", symbol, style.Padding.Right))
	}
	if style.Padding.Bottom != 0 {
		uiC.WriteString(fmt.Sprintf("    lv_obj_set_style_pad_bottom(%s, %d, LV_PART_MAIN | LV_STATE_DEFAULT);\n", symbol, style.Padding.Bottom))
	}
	if style.Padding.Left != 0 {
		uiC.WriteString(fmt.Sprintf("    lv_obj_set_style_pad_left(%s, %d, LV_PART_MAIN | LV_STATE_DEFAULT);\n", symbol, style.Padding.Left))
	}
}

func writeImageAsset(assetsC *strings.Builder, symbol string, asset AssetRef, colorDepth int) {
	dataSymbol := symbol + "_data"
	data, colorFormat, width, height := lvglImageData(asset, colorDepth)
	if len(data) == 0 {
		data = []byte{0}
	}
	assetsC.WriteString(fmt.Sprintf("const uint8_t %s[] = {\n", dataSymbol))
	for index, value := range data {
		if index%12 == 0 {
			assetsC.WriteString("    ")
		}
		assetsC.WriteString(fmt.Sprintf("0x%02X", value))
		if index != len(data)-1 {
			assetsC.WriteString(", ")
		}
		if index%12 == 11 || index == len(data)-1 {
			assetsC.WriteString("\n")
		}
	}
	assetsC.WriteString("};\n\n")
	assetsC.WriteString(fmt.Sprintf("const lv_img_dsc_t %s = {\n", symbol))
	assetsC.WriteString(fmt.Sprintf("    .header.cf = %s,\n", colorFormat))
	assetsC.WriteString("    .header.always_zero = 0,\n")
	assetsC.WriteString("    .header.reserved = 0,\n")
	assetsC.WriteString(fmt.Sprintf("    .header.w = %d,\n", width))
	assetsC.WriteString(fmt.Sprintf("    .header.h = %d,\n", height))
	if len(data) == 1 && data[0] == 0 && len(asset.Data) == 0 {
		assetsC.WriteString("    .data_size = 0,\n")
	} else {
		assetsC.WriteString(fmt.Sprintf("    .data_size = sizeof(%s),\n", dataSymbol))
	}
	assetsC.WriteString(fmt.Sprintf("    .data = %s,\n", dataSymbol))
	assetsC.WriteString("};\n\n")
}

func lvglImageData(asset AssetRef, colorDepth int) ([]byte, string, int, int) {
	if len(asset.Data) == 0 {
		return nil, "LV_IMG_CF_TRUE_COLOR_ALPHA", asset.Width, asset.Height
	}
	img, _, err := image.Decode(bytes.NewReader(asset.Data))
	if err != nil {
		return asset.Data, "LV_IMG_CF_RAW", asset.Width, asset.Height
	}
	bounds := img.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()
	if width == 0 || height == 0 {
		return nil, "LV_IMG_CF_TRUE_COLOR_ALPHA", asset.Width, asset.Height
	}
	if colorDepth == 32 {
		data := make([]byte, 0, width*height*4)
		for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
			for x := bounds.Min.X; x < bounds.Max.X; x++ {
				r16, g16, b16, a16 := img.At(x, y).RGBA()
				data = append(data, uint8(b16>>8), uint8(g16>>8), uint8(r16>>8), uint8(a16>>8))
			}
		}
		return data, "LV_IMG_CF_TRUE_COLOR_ALPHA", width, height
	}
	data := make([]byte, 0, width*height*3)
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			r16, g16, b16, a16 := img.At(x, y).RGBA()
			r := uint8(r16 >> 8)
			g := uint8(g16 >> 8)
			b := uint8(b16 >> 8)
			rgb565 := uint16(r&0xF8)<<8 | uint16(g&0xFC)<<3 | uint16(b)>>3
			data = append(data, uint8(rgb565&0xFF), uint8(rgb565>>8), uint8(a16>>8))
		}
	}
	return data, "LV_IMG_CF_TRUE_COLOR_ALPHA", width, height
}

func lvglCreateCall(widget WidgetNode, parentSymbol string) (string, error) {
	switch widget.Type {
	case "container":
		return fmt.Sprintf("lv_obj_create(%s)", parentSymbol), nil
	case "button":
		return fmt.Sprintf("lv_btn_create(%s)", parentSymbol), nil
	case "label":
		return fmt.Sprintf("lv_label_create(%s)", parentSymbol), nil
	case "image":
		return fmt.Sprintf("lv_img_create(%s)", parentSymbol), nil
	case "arc":
		return fmt.Sprintf("lv_arc_create(%s)", parentSymbol), nil
	case "bar":
		return fmt.Sprintf("lv_bar_create(%s)", parentSymbol), nil
	case "line":
		return fmt.Sprintf("lv_line_create(%s)", parentSymbol), nil
	case "switch":
		return fmt.Sprintf("lv_switch_create(%s)", parentSymbol), nil
	case "slider":
		return fmt.Sprintf("lv_slider_create(%s)", parentSymbol), nil
	case "checkbox":
		return fmt.Sprintf("lv_checkbox_create(%s)", parentSymbol), nil
	case "dropdown":
		return fmt.Sprintf("lv_dropdown_create(%s)", parentSymbol), nil
	case "spinner":
		spinTime, ok := intProp(widget.Props, "spinTime")
		if !ok {
			spinTime = 1000
		}
		arcLength, ok := intProp(widget.Props, "arcLength")
		if !ok {
			arcLength = 60
		}
		return fmt.Sprintf("lv_spinner_create(%s, %d, %d)", parentSymbol, spinTime, arcLength), nil
	case "chart":
		return fmt.Sprintf("lv_chart_create(%s)", parentSymbol), nil
	default:
		return "", fmt.Errorf("unsupported widget type: %s", widget.Type)
	}
}

func writeReusableFontStyle(uiC *strings.Builder, symbol string, font string) {
	if isBuiltInLvglFont(font) {
		uiC.WriteString(fmt.Sprintf("    lv_style_set_text_font(&%s, &%s);\n", symbol, sanitizeIdentifier(font)))
		return
	}
	uiC.WriteString(fmt.Sprintf("    /* Font asset %s is registered as metadata only; convert it to an LVGL font symbol before binding. */\n", sanitizeCComment(font)))
}

func writeObjectFontStyle(uiC *strings.Builder, symbol string, font string) {
	if isBuiltInLvglFont(font) {
		uiC.WriteString(fmt.Sprintf(
			"    lv_obj_set_style_text_font(%s, &%s, LV_PART_MAIN | LV_STATE_DEFAULT);\n",
			symbol,
			sanitizeIdentifier(font),
		))
		return
	}
	uiC.WriteString(fmt.Sprintf("    /* Font asset %s is registered as metadata only; convert it to an LVGL font symbol before binding. */\n", sanitizeCComment(font)))
}

func isBuiltInLvglFont(font string) bool {
	if !strings.HasPrefix(font, "lv_font_montserrat_") {
		return false
	}
	size := strings.TrimPrefix(font, "lv_font_montserrat_")
	if size == "" {
		return false
	}
	for _, character := range size {
		if character < '0' || character > '9' {
			return false
		}
	}
	return true
}

func sanitizeCComment(value string) string {
	return strings.ReplaceAll(value, "*/", "* /")
}

func exportReadme(doc ProjectDoc) string {
	var readme strings.Builder
	readme.WriteString(fmt.Sprintf(`# %s LVGL Export

Generated for LVGL %s.

Files:
- ui.c
- ui.h
- assets.c
- assets.h
- README.md

Integrate these files into your LVGL project and call the generated screen init function.

## Preserving user code

These generated files are overwritten on each export; keep handwritten application logic outside %s, and implement event callbacks in separate source files or delegate from the generated callback stubs into your own functions before re-exporting.
`, doc.Name, doc.Target.LvglVersion, "`ui.c`"))
	fonts := fontAssets(doc.Assets)
	if len(fonts) > 0 {
		readme.WriteString("\n## Font assets\n\n")
		readme.WriteString("Uploaded font assets are exported as metadata only. Convert each uploaded font with the LVGL font converter, add the generated font source to your firmware project, then replace the font asset id referenced in `ui.c` with the generated LVGL font symbol.\n\n")
		for _, asset := range fonts {
			readme.WriteString(fmt.Sprintf("- `%s` %s (%s, %d bytes)\n", asset.ID, asset.Name, asset.MimeType, asset.SizeBytes))
		}
	}
	return readme.String()
}

func fontAssets(assets []AssetRef) []AssetRef {
	fonts := make([]AssetRef, 0)
	for _, asset := range assets {
		if asset.Kind == "font" {
			fonts = append(fonts, asset)
		}
	}
	sort.Slice(fonts, func(i, j int) bool {
		if fonts[i].Name == fonts[j].Name {
			return fonts[i].ID < fonts[j].ID
		}
		return fonts[i].Name < fonts[j].Name
	})
	return fonts
}

func cleanHexColor(value string) (string, bool) {
	cleaned := strings.ToUpper(strings.TrimPrefix(strings.TrimSpace(value), "#"))
	if len(cleaned) == 3 {
		cleaned = string([]byte{cleaned[0], cleaned[0], cleaned[1], cleaned[1], cleaned[2], cleaned[2]})
	}
	if len(cleaned) != 6 {
		return "", false
	}
	for _, char := range cleaned {
		if !((char >= '0' && char <= '9') || (char >= 'A' && char <= 'F')) {
			return "", false
		}
	}
	return cleaned, true
}

func opacityConstant(value int) string {
	switch {
	case value >= 100:
		return "LV_OPA_COVER"
	case value >= 90:
		return "LV_OPA_90"
	case value >= 80:
		return "LV_OPA_80"
	case value >= 70:
		return "LV_OPA_70"
	case value >= 60:
		return "LV_OPA_60"
	case value >= 50:
		return "LV_OPA_50"
	case value >= 40:
		return "LV_OPA_40"
	case value >= 30:
		return "LV_OPA_30"
	case value >= 20:
		return "LV_OPA_20"
	case value >= 10:
		return "LV_OPA_10"
	default:
		return "LV_OPA_TRANSP"
	}
}

func textAlignConstant(value string) string {
	switch strings.ToLower(value) {
	case "center":
		return "LV_TEXT_ALIGN_CENTER"
	case "right":
		return "LV_TEXT_ALIGN_RIGHT"
	default:
		return "LV_TEXT_ALIGN_LEFT"
	}
}

func blendModeConstant(value string) string {
	switch strings.ToLower(value) {
	case "additive":
		return "LV_BLEND_MODE_ADDITIVE"
	case "subtractive":
		return "LV_BLEND_MODE_SUBTRACTIVE"
	case "multiply":
		return "LV_BLEND_MODE_MULTIPLY"
	case "replace":
		return "LV_BLEND_MODE_REPLACE"
	default:
		return "LV_BLEND_MODE_NORMAL"
	}
}

func assetSymbolMap(assets []AssetRef) map[string]string {
	symbols := map[string]string{}
	names := newNameRegistry()
	for _, asset := range assets {
		symbols[asset.ID] = names.Symbol("img_" + asset.Name)
	}
	return symbols
}

func styleSymbolMap(styles []StyleDef, names *nameRegistry) map[string]string {
	symbols := map[string]string{}
	for _, style := range styles {
		symbols[style.ID] = names.Symbol("style_" + style.Name)
	}
	return symbols
}

func eventBindingMap(events []EventBinding) map[string][]EventBinding {
	bindings := map[string][]EventBinding{}
	for _, event := range events {
		bindings[event.WidgetID] = append(bindings[event.WidgetID], event)
	}
	return bindings
}

func validateEventBindings(events []EventBinding, symbols map[string]string, reservedSymbols map[string]struct{}) error {
	eventIDs := map[string]struct{}{}
	callbackSymbols := map[string]string{}
	for _, event := range events {
		if strings.TrimSpace(event.ID) == "" {
			return fmt.Errorf("event id is required")
		}
		if _, ok := eventIDs[event.ID]; ok {
			return fmt.Errorf("event id must be unique: %s", event.ID)
		}
		eventIDs[event.ID] = struct{}{}
		if strings.TrimSpace(event.WidgetID) == "" {
			return fmt.Errorf("event widgetId is required: %s", event.ID)
		}
		if _, ok := symbols[event.WidgetID]; !ok {
			return fmt.Errorf("event binding references missing widget: %s", event.WidgetID)
		}
		if _, ok := supportedEventTypes[event.Event]; !ok {
			return fmt.Errorf("unsupported event type: %s", event.Event)
		}
		if strings.TrimSpace(event.HandlerName) == "" {
			return fmt.Errorf("event handlerName is required: %s", event.ID)
		}
		handlerName := strings.TrimSpace(event.HandlerName)
		callbackName := sanitizeIdentifier(handlerName)
		if _, ok := reservedSymbols[callbackName]; ok {
			return fmt.Errorf("event handlerName collides with generated C symbol: %s", callbackName)
		}
		if previousHandler, ok := callbackSymbols[callbackName]; ok && previousHandler != handlerName {
			return fmt.Errorf("event handlerName must generate a unique C callback symbol: %s", callbackName)
		}
		callbackSymbols[callbackName] = handlerName
	}
	return nil
}

func generatedCSymbols(doc ProjectDoc, styleSymbols map[string]string, assetSymbols map[string]string) map[string]struct{} {
	reserved := map[string]struct{}{
		"ui_init_styles": {},
	}
	for _, symbol := range styleSymbols {
		reserved[symbol] = struct{}{}
	}
	for _, symbol := range assetSymbols {
		reserved[symbol] = struct{}{}
		reserved[symbol+"_data"] = struct{}{}
	}
	names := newNameRegistry()
	for _, screen := range doc.Screens {
		symbol := names.Symbol(screen.Name)
		reserved[symbol] = struct{}{}
		reserved[symbol+"_screen_init"] = struct{}{}
		for _, child := range screen.Root.Children {
			collectWidgetCSymbols(child, names, reserved)
		}
	}
	return reserved
}

func collectWidgetCSymbols(widget WidgetNode, names *nameRegistry, reserved map[string]struct{}) {
	symbol := names.Symbol(widget.Name)
	reserved[symbol] = struct{}{}
	if _, ok := widget.Props["text"].(string); ok && widget.Type == "button" {
		reserved[names.Symbol(widget.Name+"_Label")] = struct{}{}
	}
	if widget.Type == "line" {
		reserved[symbol+"_points"] = struct{}{}
	}
	if widget.Type == "chart" {
		reserved[symbol+"_series"] = struct{}{}
	}
	for _, child := range widget.Children {
		collectWidgetCSymbols(child, names, reserved)
	}
}

func validateProjectDoc(doc ProjectDoc) error {
	if doc.SchemaVersion != 1 {
		return fmt.Errorf("unsupported ProjectDoc schemaVersion: %d", doc.SchemaVersion)
	}
	if strings.TrimSpace(doc.ID) == "" {
		return fmt.Errorf("ProjectDoc id is required")
	}
	if strings.TrimSpace(doc.Name) == "" {
		return fmt.Errorf("ProjectDoc name is required")
	}
	if doc.Theme != "dark" && doc.Theme != "light" {
		return fmt.Errorf("unsupported ProjectDoc theme: %s", doc.Theme)
	}
	if strings.TrimSpace(doc.UpdatedAt) == "" {
		return fmt.Errorf("ProjectDoc updatedAt is required")
	}
	if !isUTCDateTime(doc.UpdatedAt) {
		return fmt.Errorf("ProjectDoc updatedAt must be a UTC date-time string")
	}
	if doc.Styles == nil {
		return fmt.Errorf("ProjectDoc styles is required")
	}
	if doc.Events == nil {
		return fmt.Errorf("ProjectDoc events is required")
	}
	if len(doc.Screens) == 0 {
		return fmt.Errorf("ProjectDoc must contain at least one screen")
	}
	if err := validateTarget(doc.Target); err != nil {
		return err
	}
	assetRefs, err := validateAssets(doc.ID, doc.Assets)
	if err != nil {
		return err
	}
	if err := validateStyles(doc.Styles, assetRefs); err != nil {
		return err
	}
	screenIDs := map[string]struct{}{}
	projectWidgetIDs := map[string]struct{}{}
	for _, screen := range doc.Screens {
		if strings.TrimSpace(screen.ID) == "" {
			return fmt.Errorf("screen id is required")
		}
		if _, ok := screenIDs[screen.ID]; ok {
			return fmt.Errorf("screen id must be unique: %s", screen.ID)
		}
		screenIDs[screen.ID] = struct{}{}
		if strings.TrimSpace(screen.Name) == "" {
			return fmt.Errorf("screen name is required: %s", screen.ID)
		}
		if screen.Root.Type != "screen" {
			return fmt.Errorf("screen root widget type must be screen")
		}
		ids := map[string]struct{}{}
		if err := validateWidgetTree(screen.Root, nil, ids, projectWidgetIDs, assetRefs); err != nil {
			return err
		}
	}
	return nil
}

func validateStyles(styles []StyleDef, assetRefs map[string]AssetRef) error {
	styleIDs := map[string]struct{}{}
	for _, style := range styles {
		if strings.TrimSpace(style.ID) == "" {
			return fmt.Errorf("style id is required")
		}
		if _, ok := styleIDs[style.ID]; ok {
			return fmt.Errorf("style id must be unique: %s", style.ID)
		}
		styleIDs[style.ID] = struct{}{}
		if strings.TrimSpace(style.Name) == "" {
			return fmt.Errorf("style name is required: %s", style.ID)
		}
		if err := validateStyle(style.ID, style.Style); err != nil {
			return err
		}
		if style.Style.Font != "" && !isBuiltInLvglFont(style.Style.Font) {
			if err := validateFontAssetKind(style.Style.Font, assetRefs); err != nil {
				return err
			}
		}
	}
	return nil
}

func validateTarget(target TargetConfig) error {
	if target.LvglVersion != "8.3" {
		return fmt.Errorf("unsupported LVGL version: %s", target.LvglVersion)
	}
	if strings.TrimSpace(target.DeviceName) == "" {
		return fmt.Errorf("target deviceName is required")
	}
	if target.Width <= 0 {
		return fmt.Errorf("target width must be greater than 0")
	}
	if target.Height <= 0 {
		return fmt.Errorf("target height must be greater than 0")
	}
	if target.DPI <= 0 {
		return fmt.Errorf("target dpi must be greater than 0")
	}
	if target.ColorDepth != 16 && target.ColorDepth != 32 {
		return fmt.Errorf("target colorDepth must be 16 or 32")
	}
	return nil
}

func validateAssets(projectID string, assets []AssetRef) (map[string]AssetRef, error) {
	assetRefs := map[string]AssetRef{}
	for _, asset := range assets {
		if strings.TrimSpace(asset.ID) == "" {
			return nil, fmt.Errorf("asset id is required")
		}
		if _, ok := assetRefs[asset.ID]; ok {
			return nil, fmt.Errorf("asset id must be unique: %s", asset.ID)
		}
		if strings.TrimSpace(asset.ProjectID) == "" {
			return nil, fmt.Errorf("asset projectId is required: %s", asset.ID)
		}
		if asset.ProjectID != projectID {
			return nil, fmt.Errorf("asset projectId must match project id: %s", asset.ID)
		}
		if strings.TrimSpace(asset.Name) == "" {
			return nil, fmt.Errorf("asset name is required: %s", asset.ID)
		}
		if asset.Kind != "image" && asset.Kind != "font" {
			return nil, fmt.Errorf("unsupported asset kind: %s", asset.Kind)
		}
		if strings.TrimSpace(asset.MimeType) == "" {
			return nil, fmt.Errorf("asset mimeType is required: %s", asset.ID)
		}
		if asset.Kind == "image" && !isSupportedImageMimeType(asset.MimeType) {
			return nil, fmt.Errorf("unsupported image asset mimeType: %s", asset.ID)
		}
		if asset.Kind == "font" && !isSupportedFontMimeType(asset.MimeType) {
			return nil, fmt.Errorf("unsupported font asset mimeType: %s", asset.ID)
		}
		if asset.Width < 0 {
			return nil, fmt.Errorf("asset width must be non-negative: %s", asset.ID)
		}
		if asset.Height < 0 {
			return nil, fmt.Errorf("asset height must be non-negative: %s", asset.ID)
		}
		if asset.SizeBytes < 0 {
			return nil, fmt.Errorf("asset sizeBytes must be non-negative: %s", asset.ID)
		}
		if strings.TrimSpace(asset.ObjectKey) == "" {
			return nil, fmt.Errorf("asset objectKey is required: %s", asset.ID)
		}
		if strings.TrimSpace(asset.CreatedAt) == "" {
			return nil, fmt.Errorf("asset createdAt is required: %s", asset.ID)
		}
		if !isUTCDateTime(asset.CreatedAt) {
			return nil, fmt.Errorf("asset createdAt must be a UTC date-time string: %s", asset.ID)
		}
		if asset.Kind == "image" && len(asset.Data) == 0 {
			return nil, fmt.Errorf("image asset data is required: %s", asset.ID)
		}
		if asset.Kind == "image" && len(asset.Data) > 0 {
			if _, _, err := image.DecodeConfig(bytes.NewReader(asset.Data)); err != nil && (asset.Width <= 0 || asset.Height <= 0) {
				return nil, fmt.Errorf("image asset width and height are required when raw data cannot be decoded: %s", asset.ID)
			}
		}
		assetRefs[asset.ID] = asset
	}
	return assetRefs, nil
}

func isSupportedImageMimeType(mimeType string) bool {
	return mimeType == "image/png" || mimeType == "image/jpeg"
}

func isSupportedFontMimeType(mimeType string) bool {
	switch mimeType {
	case "font/ttf", "font/otf", "font/woff", "font/woff2":
		return true
	default:
		return false
	}
}

func isUTCDateTime(value string) bool {
	if !strings.HasSuffix(value, "Z") {
		return false
	}
	_, err := time.Parse(time.RFC3339Nano, value)
	return err == nil
}

func validateWidgetTree(widget WidgetNode, expectedParentID *string, ids map[string]struct{}, projectWidgetIDs map[string]struct{}, assetRefs map[string]AssetRef) error {
	if strings.TrimSpace(widget.ID) == "" {
		return fmt.Errorf("widget id is required")
	}
	if _, ok := ids[widget.ID]; ok {
		return fmt.Errorf("widget id must be unique within a screen: %s", widget.ID)
	}
	ids[widget.ID] = struct{}{}
	if _, ok := projectWidgetIDs[widget.ID]; ok {
		return fmt.Errorf("widget id must be unique across project: %s", widget.ID)
	}
	projectWidgetIDs[widget.ID] = struct{}{}
	if !sameParentID(widget.ParentID, expectedParentID) {
		return fmt.Errorf("widget parentId must be %s", parentIDLabel(expectedParentID))
	}
	if _, err := lvglCreateCallForType(widget.Type); err != nil {
		return err
	}
	if strings.TrimSpace(widget.Name) == "" {
		return fmt.Errorf("widget name is required: %s", widget.ID)
	}
	if err := validateLayout(widget.ID, widget.Type, widget.Layout); err != nil {
		return err
	}
	if err := validateStyle(widget.ID, widget.Style); err != nil {
		return err
	}
	if err := validateWidgetProps(widget); err != nil {
		return err
	}
	if widget.Type == "image" {
		if assetID, ok := widget.Props["assetId"].(string); ok && assetID != "" {
			asset, exists := assetRefs[assetID]
			if !exists {
				return fmt.Errorf("image widget references missing asset: %s", assetID)
			}
			if asset.Kind != "image" {
				return fmt.Errorf("image widget must reference an image asset: %s", assetID)
			}
			if len(asset.Data) == 0 {
				return fmt.Errorf("image asset data is required: %s", assetID)
			}
		}
	}
	if widget.Style.Font != "" && !isBuiltInLvglFont(widget.Style.Font) {
		if err := validateFontAssetKind(widget.Style.Font, assetRefs); err != nil {
			return err
		}
	}
	for _, child := range widget.Children {
		if err := validateWidgetTree(child, &widget.ID, ids, projectWidgetIDs, assetRefs); err != nil {
			return err
		}
	}
	return nil
}

func validateFontAssetKind(font string, assetRefs map[string]AssetRef) error {
	asset, exists := assetRefs[font]
	if !exists {
		return fmt.Errorf("font style references missing asset: %s", font)
	}
	if asset.Kind != "font" {
		return fmt.Errorf("font style must reference a font asset: %s", font)
	}
	return nil
}

func validateWidgetProps(widget WidgetNode) error {
	if err := validateWidgetPropTypes(widget); err != nil {
		return err
	}
	switch widget.Type {
	case "spinner":
		if err := validatePositiveProp(widget, "spinTime"); err != nil {
			return err
		}
		if err := validatePositiveProp(widget, "arcLength"); err != nil {
			return err
		}
	case "chart":
		if err := validatePositiveProp(widget, "pointCount"); err != nil {
			return err
		}
		if err := validateRangeProps(widget); err != nil {
			return err
		}
		if err := validateChartValuesProp(widget); err != nil {
			return err
		}
	case "dropdown":
		if err := validateNonNegativeProp(widget, "selected"); err != nil {
			return err
		}
		if err := validateDropdownSelectedProp(widget); err != nil {
			return err
		}
	case "slider", "bar", "arc":
		if err := validateNonNegativeProp(widget, "value"); err != nil {
			return err
		}
		if err := validateRangeProps(widget); err != nil {
			return err
		}
		if err := validateRangeValueProp(widget); err != nil {
			return err
		}
	}
	return nil
}

func validateWidgetPropTypes(widget WidgetNode) error {
	switch widget.Type {
	case "label", "button", "checkbox", "dropdown":
		if err := validateStringProp(widget, "text"); err != nil {
			return err
		}
	}
	switch widget.Type {
	case "checkbox", "switch":
		if err := validateBoolProp(widget, "checked"); err != nil {
			return err
		}
	case "image":
		if err := validateStringProp(widget, "assetId"); err != nil {
			return err
		}
	case "dropdown":
		if err := validateStringProp(widget, "options"); err != nil {
			return err
		}
		if err := validateNumberProp(widget, "selected"); err != nil {
			return err
		}
	case "spinner":
		if err := validateNumberProp(widget, "spinTime"); err != nil {
			return err
		}
		if err := validateNumberProp(widget, "arcLength"); err != nil {
			return err
		}
	case "chart":
		for _, propName := range []string{"min", "max", "pointCount"} {
			if err := validateNumberProp(widget, propName); err != nil {
				return err
			}
		}
	case "slider", "bar", "arc":
		for _, propName := range []string{"min", "max", "value"} {
			if err := validateNumberProp(widget, propName); err != nil {
				return err
			}
		}
	}
	return nil
}

func validateNumberProp(widget WidgetNode, propName string) error {
	if value, exists := widget.Props[propName]; exists && !isFiniteNumericValue(value) {
		return fmt.Errorf("widget prop %s must be a number: %s", propName, widget.ID)
	}
	if value, exists := widget.Props[propName]; exists && isFiniteNumericValue(value) && !isIntegerNumericValue(value) {
		return fmt.Errorf("widget prop %s must be an integer: %s", propName, widget.ID)
	}
	return nil
}

func validateStringProp(widget WidgetNode, propName string) error {
	if value, exists := widget.Props[propName]; exists {
		if _, ok := value.(string); !ok {
			return fmt.Errorf("widget prop %s must be a string: %s", propName, widget.ID)
		}
	}
	return nil
}

func validateBoolProp(widget WidgetNode, propName string) error {
	if value, exists := widget.Props[propName]; exists {
		if _, ok := value.(bool); !ok {
			return fmt.Errorf("widget prop %s must be a boolean: %s", propName, widget.ID)
		}
	}
	return nil
}

func validateDropdownSelectedProp(widget WidgetNode) error {
	selected, hasSelected := intProp(widget.Props, "selected")
	if !hasSelected || selected < 0 {
		return nil
	}
	options := dropdownOptionList(widget.Props["options"])
	if len(options) > 0 && selected >= len(options) {
		return fmt.Errorf("widget prop selected must reference an available option: %s", widget.ID)
	}
	return nil
}

func dropdownOptionList(raw any) []string {
	options, ok := raw.(string)
	if !ok {
		return nil
	}
	lines := strings.Split(strings.ReplaceAll(options, "\r\n", "\n"), "\n")
	result := make([]string, 0, len(lines))
	for _, line := range lines {
		if trimmed := strings.TrimSpace(line); trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

func validateRangeProps(widget WidgetNode) error {
	min, hasMin := intProp(widget.Props, "min")
	max, hasMax := intProp(widget.Props, "max")
	if hasMin && hasMax && max <= min {
		return fmt.Errorf("widget prop max must be greater than min: %s", widget.ID)
	}
	return nil
}

func validateRangeValueProp(widget WidgetNode) error {
	value, hasValue := intProp(widget.Props, "value")
	if !hasValue {
		return nil
	}
	min := intPropOrDefault(widget.Props, "min", 0)
	max := intPropOrDefault(widget.Props, "max", 100)
	if max > min && (value < min || value > max) {
		return fmt.Errorf("widget prop value must be between min and max: %s", widget.ID)
	}
	return nil
}

func validateChartValuesProp(widget WidgetNode) error {
	rawValues, ok := widget.Props["values"]
	if !ok {
		return nil
	}
	values, ok := rawValues.([]any)
	if !ok {
		return fmt.Errorf("widget prop values must be an array of finite numbers: %s", widget.ID)
	}
	for _, value := range values {
		if !isFiniteNumericValue(value) {
			return fmt.Errorf("widget prop values must contain only finite numbers: %s", widget.ID)
		}
		if !isIntegerNumericValue(value) {
			return fmt.Errorf("widget prop values must contain only integers: %s", widget.ID)
		}
	}
	return nil
}

func isFiniteNumericValue(value any) bool {
	switch typed := value.(type) {
	case int, int32, int64:
		return true
	case float32:
		return !math.IsNaN(float64(typed)) && !math.IsInf(float64(typed), 0)
	case float64:
		return !math.IsNaN(typed) && !math.IsInf(typed, 0)
	default:
		return false
	}
}

func isIntegerNumericValue(value any) bool {
	switch typed := value.(type) {
	case int, int32, int64:
		return true
	case float32:
		return !math.IsNaN(float64(typed)) && !math.IsInf(float64(typed), 0) && math.Trunc(float64(typed)) == float64(typed)
	case float64:
		return !math.IsNaN(typed) && !math.IsInf(typed, 0) && math.Trunc(typed) == typed
	default:
		return false
	}
}

func intPropOrDefault(props map[string]any, name string, fallback int) int {
	if value, ok := intProp(props, name); ok {
		return value
	}
	return fallback
}

func validatePositiveProp(widget WidgetNode, propName string) error {
	value, ok := intProp(widget.Props, propName)
	if ok && value <= 0 {
		return fmt.Errorf("widget prop %s must be greater than 0: %s", propName, widget.ID)
	}
	return nil
}

func validateNonNegativeProp(widget WidgetNode, propName string) error {
	value, ok := intProp(widget.Props, propName)
	if ok && value < 0 {
		return fmt.Errorf("widget prop %s must be non-negative: %s", propName, widget.ID)
	}
	return nil
}

func validateLayout(widgetID string, widgetType string, layout LayoutBox) error {
	if layout.Width <= 0 {
		return fmt.Errorf("widget width must be greater than 0: %s", widgetID)
	}
	if layout.Height <= 0 {
		return fmt.Errorf("widget height must be greater than 0: %s", widgetID)
	}
	if layout.Align != "" {
		if _, ok := supportedAlignValues[layout.Align]; !ok {
			return fmt.Errorf("unsupported widget align: %s", layout.Align)
		}
	}
	if layout.Flex != nil {
		if widgetType != "screen" && widgetType != "container" {
			return fmt.Errorf("widget flex layout is only supported on screen and container widgets: %s", widgetID)
		}
		if _, ok := supportedFlexDirections[layout.Flex.Direction]; !ok {
			return fmt.Errorf("unsupported flex direction: %s", layout.Flex.Direction)
		}
		if layout.Flex.Gap < 0 {
			return fmt.Errorf("flex gap must be non-negative: %s", widgetID)
		}
	}
	return nil
}

func validateStyle(widgetID string, style WidgetStyle) error {
	if style.Radius < 0 {
		return fmt.Errorf("style radius must be non-negative: %s", widgetID)
	}
	if style.LetterSpace < 0 {
		return fmt.Errorf("style letterSpace must be non-negative: %s", widgetID)
	}
	if style.LineSpace < 0 {
		return fmt.Errorf("style lineSpace must be non-negative: %s", widgetID)
	}
	if style.Opacity != nil && (*style.Opacity < 0 || *style.Opacity > 100) {
		return fmt.Errorf("style opacity must be between 0 and 100: %s", widgetID)
	}
	if style.BlendMode != "" {
		if _, ok := supportedBlendModeValues[style.BlendMode]; !ok {
			return fmt.Errorf("unsupported blend mode: %s", style.BlendMode)
		}
	}
	if err := validateStyleColor(widgetID, "bgColor", style.BgColor); err != nil {
		return err
	}
	if err := validateStyleColor(widgetID, "textColor", style.TextColor); err != nil {
		return err
	}
	if err := validateStyleColor(widgetID, "borderColor", style.BorderColor); err != nil {
		return err
	}
	if style.Padding.Top < 0 || style.Padding.Right < 0 || style.Padding.Bottom < 0 || style.Padding.Left < 0 {
		return fmt.Errorf("style padding must be non-negative: %s", widgetID)
	}
	if style.Align != "" {
		if _, ok := supportedTextAlignValues[style.Align]; !ok {
			return fmt.Errorf("unsupported text align: %s", style.Align)
		}
	}
	return nil
}

func validateStyleColor(widgetID string, fieldName string, value string) error {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	if _, ok := cleanHexColor(value); !ok {
		return fmt.Errorf("style %s must be a 3 or 6 digit hex color: %s", fieldName, widgetID)
	}
	return nil
}

func lvglCreateCallForType(widgetType string) (string, error) {
	if widgetType == "screen" {
		return "lv_obj_create(NULL)", nil
	}
	return lvglCreateCall(WidgetNode{Type: widgetType}, "parent")
}

func sameParentID(got *string, want *string) bool {
	if got == nil || want == nil {
		return got == nil && want == nil
	}
	return *got == *want
}

func parentIDLabel(parentID *string) string {
	if parentID == nil {
		return "null"
	}
	return *parentID
}

var supportedAlignValues = map[string]struct{}{
	"top-left":     {},
	"top-right":    {},
	"center":       {},
	"bottom-left":  {},
	"bottom-right": {},
}

var supportedFlexDirections = map[string]struct{}{
	"row":    {},
	"column": {},
}

var supportedTextAlignValues = map[string]struct{}{
	"left":   {},
	"center": {},
	"right":  {},
}

var supportedBlendModeValues = map[string]struct{}{
	"normal":      {},
	"additive":    {},
	"subtractive": {},
	"multiply":    {},
	"replace":     {},
}

var supportedEventTypes = map[string]struct{}{
	"LV_EVENT_CLICKED":       {},
	"LV_EVENT_VALUE_CHANGED": {},
	"LV_EVENT_READY":         {},
	"LV_EVENT_CANCEL":        {},
}

func uniqueEventCallbackNames(events []EventBinding) []string {
	callbacks := make([]string, 0, len(events))
	seen := map[string]bool{}
	for _, event := range events {
		callbackName := sanitizeIdentifier(event.HandlerName)
		if seen[callbackName] {
			continue
		}
		seen[callbackName] = true
		callbacks = append(callbacks, callbackName)
	}
	return callbacks
}

type nameRegistry struct {
	used map[string]int
}

func newNameRegistry() *nameRegistry {
	return &nameRegistry{used: map[string]int{}}
}

func (registry *nameRegistry) Symbol(name string) string {
	base := "ui_" + sanitizeIdentifier(name)
	count := registry.used[base]
	registry.used[base] = count + 1
	if count == 0 {
		return base
	}
	return fmt.Sprintf("%s_%d", base, count+1)
}

var nonIdentifier = regexp.MustCompile(`[^A-Za-z0-9]+`)

func sanitizeIdentifier(name string) string {
	cleaned := strings.Trim(nonIdentifier.ReplaceAllString(name, "_"), "_")
	if cleaned == "" {
		cleaned = "Widget"
	}
	if cleaned[0] >= '0' && cleaned[0] <= '9' {
		cleaned = "_" + cleaned
	}
	return cleaned
}
