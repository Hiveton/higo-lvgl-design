package codegen

import (
	"archive/zip"
	"bytes"
	"image"
	"image/color"
	"image/png"
	"strings"
	"testing"
)

func TestGenerateCZipIncludesLvglFilesAndLabelCode(t *testing.T) {
	doc := ProjectDoc{
		SchemaVersion: 1,
		ID:            "project-1",
		Name:          "My Watch UI",
		Theme:         "dark",
		UpdatedAt:     "2026-05-08T00:00:00Z",
		Styles:        []StyleDef{},
		Events:        []EventBinding{},
		Target: TargetConfig{
			LvglVersion: "8.3",
			DeviceName:  "ESP32-S3",
			Width:       480,
			Height:      480,
			DPI:         240,
			ColorDepth:  16,
		},
		Screens: []ScreenNode{
			{
				ID:   "screen-1",
				Name: "Screen_1",
				Root: WidgetNode{
					ID:       "root-screen-1",
					Type:     "screen",
					Name:     "Screen_1",
					ParentID: nil,
					Layout:   LayoutBox{X: 0, Y: 0, Width: 480, Height: 480},
					Style:    WidgetStyle{BgColor: "#101010"},
					Children: []WidgetNode{
						{
							ID:       "time-label",
							Type:     "label",
							Name:     "Time_Label",
							ParentID: ptr("root-screen-1"),
							Layout:   LayoutBox{X: 150, Y: 40, Width: 180, Height: 56},
							Props:    map[string]any{"text": "10:09"},
							Style: WidgetStyle{
								TextColor:   "#FFFFFF",
								BgColor:     "#101820",
								BorderColor: "#FFCC00",
								Radius:      12,
								Opacity:     intPtr(72),
								BlendMode:   "multiply",
								Padding:     PaddingBox{Top: 4, Right: 8, Bottom: 4, Left: 8},
								Font:        "lv_font_montserrat_48",
								Align:       "center",
								LetterSpace: 2,
								LineSpace:   4,
							},
						},
						{
							ID:       "container-1",
							Type:     "container",
							Name:     "Flex_Container",
							ParentID: ptr("root-screen-1"),
							Layout: LayoutBox{
								X:      20,
								Y:      30,
								Width:  200,
								Height: 120,
								Align:  "center",
								Flex:   &FlexLayout{Direction: "column", Gap: 8, Wrap: true},
							},
							Props: map[string]any{},
						},
					},
				},
			},
		},
	}

	archive, err := GenerateCZip(doc)
	if err != nil {
		t.Fatalf("GenerateCZip returned error: %v", err)
	}

	files := unzip(t, archive)

	for _, name := range []string{"ui.c", "ui.h", "assets.c", "assets.h", "README.md"} {
		if _, ok := files[name]; !ok {
			t.Fatalf("expected generated zip to contain %s", name)
		}
	}

	uiC := files["ui.c"]
	if !strings.Contains(uiC, `lv_label_set_text(ui_Time_Label, "10:09");`) {
		t.Fatalf("ui.c missing label text:\n%s", uiC)
	}
	if !strings.Contains(uiC, "lv_obj_t * ui_Time_Label;") {
		t.Fatalf("ui.c missing label global definition:\n%s", uiC)
	}
	if !strings.Contains(uiC, "lv_obj_set_pos(ui_Time_Label, 150, 40);") {
		t.Fatalf("ui.c missing label position:\n%s", uiC)
	}
	if !strings.Contains(uiC, "lv_obj_set_style_text_color(ui_Time_Label, lv_color_hex(0xFFFFFF)") {
		t.Fatalf("ui.c missing label text color:\n%s", uiC)
	}
	for _, expected := range []string{
		"lv_obj_set_style_bg_color(ui_Time_Label, lv_color_hex(0x101820)",
		"lv_obj_set_style_border_color(ui_Time_Label, lv_color_hex(0xFFCC00)",
		"lv_obj_set_style_text_font(ui_Time_Label, &lv_font_montserrat_48",
		"lv_obj_set_style_text_align(ui_Time_Label, LV_TEXT_ALIGN_CENTER",
		"lv_obj_set_style_text_letter_space(ui_Time_Label, 2",
		"lv_obj_set_style_text_line_space(ui_Time_Label, 4",
		"lv_obj_set_style_radius(ui_Time_Label, 12",
		"lv_obj_set_style_opa(ui_Time_Label, LV_OPA_70",
		"lv_obj_set_style_blend_mode(ui_Time_Label, LV_BLEND_MODE_MULTIPLY",
		"lv_obj_set_style_pad_top(ui_Time_Label, 4",
		"lv_obj_set_style_pad_right(ui_Time_Label, 8",
		"lv_obj_set_layout(ui_Flex_Container, LV_LAYOUT_FLEX);",
		"lv_obj_align(ui_Flex_Container, LV_ALIGN_CENTER, 20, 30);",
		"lv_obj_set_flex_flow(ui_Flex_Container, LV_FLEX_FLOW_COLUMN_WRAP);",
		"lv_obj_set_style_pad_row(ui_Flex_Container, 8",
		"lv_obj_set_style_pad_column(ui_Flex_Container, 8",
	} {
		if !strings.Contains(uiC, expected) {
			t.Fatalf("ui.c missing expected style call %q:\n%s", expected, uiC)
		}
	}
}

func TestGenerateCZipRejectsProjectDocProtocolFields(t *testing.T) {
	doc := minimalValidDoc()

	doc.SchemaVersion = 2
	if _, err := GenerateCZip(doc); err == nil || !strings.Contains(err.Error(), "unsupported ProjectDoc schemaVersion: 2") {
		t.Fatalf("expected unsupported schemaVersion error, got %v", err)
	}

	doc = minimalValidDoc()
	doc.Theme = "solarized"
	if _, err := GenerateCZip(doc); err == nil || !strings.Contains(err.Error(), "unsupported ProjectDoc theme: solarized") {
		t.Fatalf("expected unsupported theme error, got %v", err)
	}

	doc = minimalValidDoc()
	doc.UpdatedAt = ""
	if _, err := GenerateCZip(doc); err == nil || !strings.Contains(err.Error(), "ProjectDoc updatedAt is required") {
		t.Fatalf("expected missing updatedAt error, got %v", err)
	}

	doc = minimalValidDoc()
	doc.UpdatedAt = "yesterday"
	if _, err := GenerateCZip(doc); err == nil || !strings.Contains(err.Error(), "ProjectDoc updatedAt must be a UTC date-time string") {
		t.Fatalf("expected invalid updatedAt error, got %v", err)
	}

	doc = minimalValidDoc()
	doc.Assets = []AssetRef{{
		ID:        "asset-1",
		ProjectID: doc.ID,
		Name:      "icon.png",
		Kind:      "image",
		MimeType:  "image/png",
		Width:     16,
		Height:    16,
		SizeBytes: 128,
		ObjectKey: "projects/project-1/assets/asset-1/icon.png",
		CreatedAt: "2026-05-08 00:00:00",
	}}
	if _, err := GenerateCZip(doc); err == nil || !strings.Contains(err.Error(), "asset createdAt must be a UTC date-time string: asset-1") {
		t.Fatalf("expected invalid asset createdAt error, got %v", err)
	}
}

func TestGenerateCZipReadmeDescribesUserCodePreservation(t *testing.T) {
	archive, err := GenerateCZip(minimalValidDoc())
	if err != nil {
		t.Fatalf("GenerateCZip returned error: %v", err)
	}

	readme := unzip(t, archive)["README.md"]
	for _, expected := range []string{
		"Preserving user code",
		"generated files are overwritten on each export",
		"keep handwritten application logic outside `ui.c`",
		"implement event callbacks in separate source files",
	} {
		if !strings.Contains(readme, expected) {
			t.Fatalf("README.md missing user-code preservation guidance %q:\n%s", expected, readme)
		}
	}
}

func TestGenerateCZipReadmeListsEveryExportedFile(t *testing.T) {
	archive, err := GenerateCZip(minimalValidDoc())
	if err != nil {
		t.Fatalf("GenerateCZip returned error: %v", err)
	}

	readme := unzip(t, archive)["README.md"]
	for _, expected := range []string{"- ui.c", "- ui.h", "- assets.c", "- assets.h", "- README.md"} {
		if !strings.Contains(readme, expected) {
			t.Fatalf("README.md missing exported file %q:\n%s", expected, readme)
		}
	}
}

func TestGenerateCZipKeepsUploadedFontAssetsAsMetadataOnly(t *testing.T) {
	doc := minimalValidDoc()
	doc.Assets = []AssetRef{
		{
			ID:        "font-1",
			ProjectID: "project-1",
			Name:      "brand.ttf",
			Kind:      "font",
			MimeType:  "font/ttf",
			SizeBytes: 1200,
			ObjectKey: "projects/project-1/assets/font-1/brand.ttf",
			CreatedAt: "2026-05-08T00:00:00Z",
		},
	}
	doc.Screens[0].Root.Children = []WidgetNode{
		{
			ID:       "label-1",
			Type:     "label",
			Name:     "Label_1",
			ParentID: ptr("root-screen-1"),
			Layout:   LayoutBox{X: 0, Y: 0, Width: 120, Height: 32},
			Props:    map[string]any{"text": "Brand"},
			Style:    WidgetStyle{Font: "font-1"},
		},
	}

	archive, err := GenerateCZip(doc)
	if err != nil {
		t.Fatalf("GenerateCZip returned error: %v", err)
	}

	files := unzip(t, archive)
	if strings.Contains(files["ui.c"], "&font_1") {
		t.Fatalf("ui.c should not bind an unconverted font asset symbol:\n%s", files["ui.c"])
	}
	if !strings.Contains(files["ui.c"], "Font asset font-1 is registered as metadata only") {
		t.Fatalf("ui.c missing font metadata note:\n%s", files["ui.c"])
	}
	readme := files["README.md"]
	for _, expected := range []string{
		"Font assets",
		"brand.ttf",
		"`font-1`",
		"font/ttf",
		"1200 bytes",
		"Convert each uploaded font with the LVGL font converter",
	} {
		if !strings.Contains(readme, expected) {
			t.Fatalf("README.md missing font asset guidance %q:\n%s", expected, readme)
		}
	}
}

func TestGenerateCSanitizesHexColorsAndSkipsInvalidColors(t *testing.T) {
	doc := ProjectDoc{
		SchemaVersion: 1,
		ID:            "project-1",
		Name:          "Color UI",
		Theme:         "dark",
		UpdatedAt:     "2026-05-08T00:00:00Z",
		Styles:        []StyleDef{},
		Events:        []EventBinding{},
		Target:        TargetConfig{LvglVersion: "8.3", DeviceName: "ESP32-S3", Width: 480, Height: 480, DPI: 240, ColorDepth: 16},
		Screens: []ScreenNode{
			{
				ID:   "screen-1",
				Name: "Screen_1",
				Root: WidgetNode{
					ID:     "root-screen-1",
					Type:   "screen",
					Name:   "Screen_1",
					Layout: LayoutBox{X: 0, Y: 0, Width: 480, Height: 480},
					Children: []WidgetNode{
						{
							ID:       "label-1",
							Type:     "label",
							Name:     "Label_1",
							ParentID: ptr("root-screen-1"),
							Layout:   LayoutBox{X: 0, Y: 0, Width: 120, Height: 32},
							Props:    map[string]any{"text": "Hello"},
							Style: WidgetStyle{
								TextColor: "#abc",
							},
						},
					},
				},
			},
		},
	}

	files, err := GenerateC(doc)
	if err != nil {
		t.Fatalf("GenerateC returned error: %v", err)
	}
	uiC := generatedContent(files, "ui.c")
	if !strings.Contains(uiC, "lv_obj_set_style_text_color(ui_Label_1, lv_color_hex(0xAABBCC)") {
		t.Fatalf("ui.c missing expanded short hex color:\n%s", uiC)
	}
}

func TestGenerateCIncludesReusableStyleDefinitions(t *testing.T) {
	doc := ProjectDoc{
		SchemaVersion: 1,
		ID:            "project-1",
		Name:          "Styled UI",
		Theme:         "dark",
		UpdatedAt:     "2026-05-08T00:00:00Z",
		Events:        []EventBinding{},
		Target:        TargetConfig{LvglVersion: "8.3", DeviceName: "ESP32-S3", Width: 480, Height: 480, DPI: 240, ColorDepth: 16},
		Styles: []StyleDef{
			{
				ID:   "style-primary-button",
				Name: "Primary Button",
				Style: WidgetStyle{
					BgColor:   "#2FBF71",
					TextColor: "#FFFFFF",
					Radius:    12,
					BlendMode: "additive",
					Padding:   PaddingBox{Left: 8, Right: 8},
				},
			},
		},
		Screens: []ScreenNode{
			{
				ID:   "screen-1",
				Name: "Screen_1",
				Root: WidgetNode{
					ID:       "root-screen-1",
					Type:     "screen",
					Name:     "Screen_1",
					ParentID: nil,
					Layout:   LayoutBox{X: 0, Y: 0, Width: 480, Height: 480},
				},
			},
		},
	}

	files, err := GenerateC(doc)
	if err != nil {
		t.Fatalf("GenerateC returned error: %v", err)
	}
	uiC := generatedContent(files, "ui.c")

	for _, expected := range []string{
		"static lv_style_t ui_style_Primary_Button;",
		"static void ui_init_styles(void)",
		"lv_style_init(&ui_style_Primary_Button);",
		"lv_style_set_bg_color(&ui_style_Primary_Button, lv_color_hex(0x2FBF71));",
		"lv_style_set_text_color(&ui_style_Primary_Button, lv_color_hex(0xFFFFFF));",
		"lv_style_set_radius(&ui_style_Primary_Button, 12);",
		"lv_style_set_blend_mode(&ui_style_Primary_Button, LV_BLEND_MODE_ADDITIVE);",
		"lv_style_set_pad_left(&ui_style_Primary_Button, 8);",
		"lv_style_set_pad_right(&ui_style_Primary_Button, 8);",
		"ui_init_styles();",
	} {
		if !strings.Contains(uiC, expected) {
			t.Fatalf("ui.c missing reusable style output %q:\n%s", expected, uiC)
		}
	}
}

func TestGenerateCRejectsReusableStyleFontMissingAsset(t *testing.T) {
	doc := minimalValidDoc()
	doc.Styles = []StyleDef{
		{
			ID:    "style-brand",
			Name:  "Brand",
			Style: WidgetStyle{Font: "missing-font"},
		},
	}

	_, err := GenerateC(doc)
	if err == nil || !strings.Contains(err.Error(), "font style references missing asset: missing-font") {
		t.Fatalf("expected missing font asset error, got %v", err)
	}
}

func TestGenerateCEmitsExplicitTransparentOpacity(t *testing.T) {
	doc := ProjectDoc{
		SchemaVersion: 1,
		ID:            "project-1",
		Name:          "Opacity UI",
		Theme:         "dark",
		UpdatedAt:     "2026-05-08T00:00:00Z",
		Styles:        []StyleDef{},
		Events:        []EventBinding{},
		Target:        TargetConfig{LvglVersion: "8.3", DeviceName: "ESP32-S3", Width: 480, Height: 480, DPI: 240, ColorDepth: 16},
		Screens: []ScreenNode{
			{
				ID:   "screen-1",
				Name: "Screen_1",
				Root: WidgetNode{
					ID:     "root-screen-1",
					Type:   "screen",
					Name:   "Screen_1",
					Layout: LayoutBox{X: 0, Y: 0, Width: 480, Height: 480},
					Children: []WidgetNode{
						{
							ID:       "hidden-label",
							Type:     "label",
							Name:     "Hidden_Label",
							ParentID: ptr("root-screen-1"),
							Layout:   LayoutBox{X: 0, Y: 0, Width: 120, Height: 32},
							Props:    map[string]any{"text": "Transparent"},
							Style:    WidgetStyle{Opacity: intPtr(0)},
						},
					},
				},
			},
		},
	}

	files, err := GenerateC(doc)
	if err != nil {
		t.Fatalf("GenerateC returned error: %v", err)
	}
	uiC := generatedContent(files, "ui.c")
	if !strings.Contains(uiC, "lv_obj_set_style_opa(ui_Hidden_Label, LV_OPA_TRANSP") {
		t.Fatalf("ui.c missing transparent opacity:\n%s", uiC)
	}
}

func TestGenerateCZipIncludesImageAssetAndEventCallback(t *testing.T) {
	doc := ProjectDoc{
		SchemaVersion: 1,
		ID:            "project-1",
		Name:          "My Watch UI",
		Theme:         "dark",
		UpdatedAt:     "2026-05-08T00:00:00Z",
		Styles:        []StyleDef{},
		Target:        TargetConfig{LvglVersion: "8.3", DeviceName: "ESP32-S3", Width: 480, Height: 480, DPI: 240, ColorDepth: 16},
		Assets: []AssetRef{
			{
				ID:        "asset-heart",
				ProjectID: "project-1",
				Name:      "icon_heart.png",
				Kind:      "image",
				MimeType:  "image/png",
				Width:     24,
				Height:    24,
				SizeBytes: 4,
				ObjectKey: "projects/project-1/assets/icon_heart.png",
				CreatedAt: "2026-05-08T00:00:00Z",
				Data:      onePixelPNG(t, color.RGBA{R: 0xF8, G: 0x10, B: 0x20, A: 0xFF}),
			},
		},
		Events: []EventBinding{
			{ID: "event-1", WidgetID: "start-button", Event: "LV_EVENT_CLICKED", HandlerName: "on_start_clicked"},
		},
		Screens: []ScreenNode{
			{
				ID:   "screen-1",
				Name: "Screen_1",
				Root: WidgetNode{
					ID:     "root-screen-1",
					Type:   "screen",
					Name:   "Screen_1",
					Layout: LayoutBox{X: 0, Y: 0, Width: 480, Height: 480},
					Children: []WidgetNode{
						{
							ID:       "heart-image",
							Type:     "image",
							Name:     "Heart_Icon",
							ParentID: ptr("root-screen-1"),
							Layout:   LayoutBox{X: 200, Y: 160, Width: 64, Height: 64},
							Props:    map[string]any{"assetId": "asset-heart"},
						},
						{
							ID:       "start-button",
							Type:     "button",
							Name:     "Start_Button",
							ParentID: ptr("root-screen-1"),
							Layout:   LayoutBox{X: 58, Y: 410, Width: 128, Height: 44},
						},
					},
				},
			},
		},
	}

	archive, err := GenerateCZip(doc)
	if err != nil {
		t.Fatalf("GenerateCZip returned error: %v", err)
	}
	files := unzip(t, archive)

	if !strings.Contains(files["ui.c"], "lv_img_set_src(ui_Heart_Icon, &ui_img_icon_heart_png);") {
		t.Fatalf("ui.c missing image asset src:\n%s", files["ui.c"])
	}
	if !strings.Contains(files["ui.c"], "#include \"assets.h\"") {
		t.Fatalf("ui.c must include assets.h when image assets are referenced:\n%s", files["ui.c"])
	}
	if !strings.Contains(files["assets.h"], "LV_IMG_DECLARE(ui_img_icon_heart_png);") {
		t.Fatalf("assets.h missing image declaration:\n%s", files["assets.h"])
	}
	if !strings.Contains(files["assets.c"], "const uint8_t ui_img_icon_heart_png_data[]") {
		t.Fatalf("assets.c missing image byte array:\n%s", files["assets.c"])
	}
	if strings.Contains(files["assets.c"], "0x89, 0x50, 0x4E, 0x47") {
		t.Fatalf("assets.c should convert PNG bytes instead of embedding the compressed PNG signature:\n%s", files["assets.c"])
	}
	if !strings.Contains(files["assets.c"], ".header.cf = LV_IMG_CF_TRUE_COLOR_ALPHA") {
		t.Fatalf("assets.c missing LVGL true-color image format:\n%s", files["assets.c"])
	}
	if !strings.Contains(files["assets.c"], "0x84, 0xF8, 0xFF") {
		t.Fatalf("assets.c missing RGB565+alpha pixel bytes:\n%s", files["assets.c"])
	}
	if !strings.Contains(files["assets.c"], "const lv_img_dsc_t ui_img_icon_heart_png") {
		t.Fatalf("assets.c missing image descriptor:\n%s", files["assets.c"])
	}
	if !strings.Contains(files["assets.c"], ".header.w = 1") || !strings.Contains(files["assets.c"], ".header.h = 1") {
		t.Fatalf("assets.c missing image dimensions:\n%s", files["assets.c"])
	}
	if !strings.Contains(files["ui.c"], "lv_obj_add_event_cb(ui_Start_Button, on_start_clicked, LV_EVENT_CLICKED, NULL);") {
		t.Fatalf("ui.c missing event binding:\n%s", files["ui.c"])
	}
	if !strings.Contains(files["ui.c"], "void on_start_clicked(lv_event_t * e)") {
		t.Fatalf("ui.c missing event callback stub:\n%s", files["ui.c"])
	}
	if !strings.Contains(files["ui.h"], "void on_start_clicked(lv_event_t * e);") {
		t.Fatalf("ui.h missing event callback declaration:\n%s", files["ui.h"])
	}
}

func TestGenerateCZipRejectsReferencedImageAssetWithoutData(t *testing.T) {
	doc := minimalValidDoc()
	doc.Assets = []AssetRef{
		{
			ID:        "asset-heart",
			ProjectID: doc.ID,
			Name:      "icon_heart.png",
			Kind:      "image",
			MimeType:  "image/png",
			Width:     24,
			Height:    24,
			SizeBytes: 128,
			ObjectKey: "projects/project-1/assets/asset-heart/icon_heart.png",
			CreatedAt: "2026-05-08T00:00:00Z",
		},
	}
	doc.Screens[0].Root.Children = []WidgetNode{
		{
			ID:       "heart-image",
			Type:     "image",
			Name:     "Heart_Icon",
			ParentID: ptr("root-screen-1"),
			Layout:   LayoutBox{X: 200, Y: 160, Width: 64, Height: 64},
			Props:    map[string]any{"assetId": "asset-heart"},
		},
	}

	_, err := GenerateCZip(doc)
	if err == nil || !strings.Contains(err.Error(), "image asset data is required: asset-heart") {
		t.Fatalf("expected referenced image data error, got %v", err)
	}
}

func TestGenerateCRejectsUnusedImageAssetsWithoutData(t *testing.T) {
	doc := minimalValidDoc()
	doc.Assets = []AssetRef{
		{
			ID:        "asset-unused",
			ProjectID: doc.ID,
			Name:      "unused_icon.png",
			Kind:      "image",
			MimeType:  "image/png",
			Width:     24,
			Height:    24,
			SizeBytes: 128,
			ObjectKey: "projects/project-1/assets/asset-unused/unused_icon.png",
			CreatedAt: "2026-05-08T00:00:00Z",
		},
	}

	_, err := GenerateC(doc)
	if err == nil || !strings.Contains(err.Error(), "image asset data is required: asset-unused") {
		t.Fatalf("expected unused image data error, got %v", err)
	}
}

func TestGenerateCRejectsRawImageAssetsWithoutDimensions(t *testing.T) {
	doc := minimalValidDoc()
	doc.Assets = []AssetRef{
		{
			ID:        "asset-raw",
			ProjectID: doc.ID,
			Name:      "raw_icon.bin",
			Kind:      "image",
			MimeType:  "image/png",
			SizeBytes: 4,
			ObjectKey: "projects/project-1/assets/asset-raw/raw_icon.bin",
			CreatedAt: "2026-05-08T00:00:00Z",
			Data:      []byte{0xDE, 0xAD, 0xBE, 0xEF},
		},
	}

	_, err := GenerateC(doc)
	if err == nil || !strings.Contains(err.Error(), "image asset width and height are required when raw data cannot be decoded: asset-raw") {
		t.Fatalf("expected raw image dimension error, got %v", err)
	}
}

func TestGenerateCZipIncludesScreenRootEventBinding(t *testing.T) {
	doc := ProjectDoc{
		SchemaVersion: 1,
		ID:            "project-1",
		Name:          "Screen Event UI",
		Theme:         "dark",
		UpdatedAt:     "2026-05-08T00:00:00Z",
		Styles:        []StyleDef{},
		Target:        TargetConfig{LvglVersion: "8.3", DeviceName: "ESP32-S3", Width: 480, Height: 480, DPI: 240, ColorDepth: 16},
		Events: []EventBinding{
			{ID: "event-screen-ready", WidgetID: "root-screen-1", Event: "LV_EVENT_READY", HandlerName: "on_screen_ready"},
		},
		Screens: []ScreenNode{
			{
				ID:   "screen-1",
				Name: "Screen_1",
				Root: WidgetNode{
					ID:     "root-screen-1",
					Type:   "screen",
					Name:   "Screen_1",
					Layout: LayoutBox{X: 0, Y: 0, Width: 480, Height: 480},
				},
			},
		},
	}

	archive, err := GenerateCZip(doc)
	if err != nil {
		t.Fatalf("GenerateCZip returned error: %v", err)
	}
	files := unzip(t, archive)

	if !strings.Contains(files["ui.c"], "lv_obj_add_event_cb(ui_Screen_1, on_screen_ready, LV_EVENT_READY, NULL);") {
		t.Fatalf("ui.c missing screen root event binding:\n%s", files["ui.c"])
	}
	if !strings.Contains(files["ui.c"], "void on_screen_ready(lv_event_t * e)") {
		t.Fatalf("ui.c missing screen root callback stub:\n%s", files["ui.c"])
	}
}

func TestGenerateCUsesUniqueSymbolsForDuplicateImageAssetNames(t *testing.T) {
	doc := minimalValidDoc()
	doc.Assets = []AssetRef{
		{ID: "asset-1", ProjectID: doc.ID, Name: "icon.png", Kind: "image", MimeType: "image/png", Width: 1, Height: 1, SizeBytes: 1, ObjectKey: "projects/project-1/assets/icon-1.png", CreatedAt: "2026-05-08T00:00:00Z", Data: onePixelPNG(t, color.RGBA{R: 0x10, G: 0x20, B: 0x30, A: 0xFF})},
		{ID: "asset-2", ProjectID: doc.ID, Name: "icon.png", Kind: "image", MimeType: "image/png", Width: 1, Height: 1, SizeBytes: 1, ObjectKey: "projects/project-1/assets/icon-2.png", CreatedAt: "2026-05-08T00:00:00Z", Data: onePixelPNG(t, color.RGBA{R: 0x40, G: 0x50, B: 0x60, A: 0xFF})},
	}
	doc.Screens[0].Root.Children = []WidgetNode{
		{
			ID:       "image-1",
			Type:     "image",
			Name:     "Image_1",
			ParentID: ptr("root-screen-1"),
			Layout:   LayoutBox{X: 0, Y: 0, Width: 32, Height: 32},
			Props:    map[string]any{"assetId": "asset-1"},
		},
		{
			ID:       "image-2",
			Type:     "image",
			Name:     "Image_2",
			ParentID: ptr("root-screen-1"),
			Layout:   LayoutBox{X: 40, Y: 0, Width: 32, Height: 32},
			Props:    map[string]any{"assetId": "asset-2"},
		},
	}

	files, err := GenerateC(doc)
	if err != nil {
		t.Fatalf("GenerateC returned error: %v", err)
	}
	uiC := generatedContent(files, "ui.c")
	assetsH := generatedContent(files, "assets.h")
	assetsC := generatedContent(files, "assets.c")

	for _, expected := range []string{
		"LV_IMG_DECLARE(ui_img_icon_png);",
		"LV_IMG_DECLARE(ui_img_icon_png_2);",
	} {
		if !strings.Contains(assetsH, expected) {
			t.Fatalf("assets.h missing unique asset symbol %q:\n%s", expected, assetsH)
		}
	}
	if !strings.Contains(uiC, "lv_img_set_src(ui_Image_1, &ui_img_icon_png);") {
		t.Fatalf("ui.c missing first image binding:\n%s", uiC)
	}
	if !strings.Contains(uiC, "lv_img_set_src(ui_Image_2, &ui_img_icon_png_2);") {
		t.Fatalf("ui.c missing suffixed second image binding:\n%s", uiC)
	}
	if strings.Count(assetsC, "const lv_img_dsc_t ui_img_icon_png") != 2 {
		t.Fatalf("assets.c should contain two unique image descriptors:\n%s", assetsC)
	}
}

func TestGenerateCZipIncludesButtonTextLabel(t *testing.T) {
	doc := ProjectDoc{
		SchemaVersion: 1,
		ID:            "project-1",
		Name:          "Button UI",
		Theme:         "dark",
		UpdatedAt:     "2026-05-08T00:00:00Z",
		Styles:        []StyleDef{},
		Events:        []EventBinding{},
		Target:        TargetConfig{LvglVersion: "8.3", DeviceName: "ESP32-S3", Width: 480, Height: 480, DPI: 240, ColorDepth: 16},
		Screens: []ScreenNode{
			{
				ID:   "screen-1",
				Name: "Screen_1",
				Root: WidgetNode{
					ID:     "root-screen-1",
					Type:   "screen",
					Name:   "Screen_1",
					Layout: LayoutBox{X: 0, Y: 0, Width: 480, Height: 480},
					Children: []WidgetNode{
						{
							ID:       "start-button",
							Type:     "button",
							Name:     "Start_Button",
							ParentID: ptr("root-screen-1"),
							Layout:   LayoutBox{X: 58, Y: 410, Width: 128, Height: 44},
							Props:    map[string]any{"text": "Start"},
						},
					},
				},
			},
		},
	}

	archive, err := GenerateCZip(doc)
	if err != nil {
		t.Fatalf("GenerateCZip returned error: %v", err)
	}
	files := unzip(t, archive)

	if !strings.Contains(files["ui.c"], "lv_label_create(ui_Start_Button);") {
		t.Fatalf("ui.c missing button child label:\n%s", files["ui.c"])
	}
	if !strings.Contains(files["ui.c"], "lv_obj_t * ui_Start_Button_Label;") {
		t.Fatalf("ui.c missing button label global definition:\n%s", files["ui.c"])
	}
	if !strings.Contains(files["ui.c"], `lv_label_set_text(ui_Start_Button_Label, "Start");`) {
		t.Fatalf("ui.c missing button label text:\n%s", files["ui.c"])
	}
	if !strings.Contains(files["ui.c"], "lv_obj_center(ui_Start_Button_Label);") {
		t.Fatalf("ui.c missing centered button label:\n%s", files["ui.c"])
	}
}

func TestGenerateCZipIncludesWidgetSpecificProperties(t *testing.T) {
	doc := ProjectDoc{
		SchemaVersion: 1,
		ID:            "project-1",
		Name:          "Control UI",
		Theme:         "dark",
		UpdatedAt:     "2026-05-08T00:00:00Z",
		Styles:        []StyleDef{},
		Events:        []EventBinding{},
		Target:        TargetConfig{LvglVersion: "8.3", DeviceName: "ESP32-S3", Width: 480, Height: 480, DPI: 240, ColorDepth: 16},
		Screens: []ScreenNode{
			{
				ID:   "screen-1",
				Name: "Screen_1",
				Root: WidgetNode{
					ID:     "root-screen-1",
					Type:   "screen",
					Name:   "Screen_1",
					Layout: LayoutBox{X: 0, Y: 0, Width: 480, Height: 480},
					Children: []WidgetNode{
						{
							ID:       "slider-1",
							Type:     "slider",
							Name:     "Brightness_Slider",
							ParentID: ptr("root-screen-1"),
							Layout:   LayoutBox{X: 20, Y: 40, Width: 180, Height: 24},
							Props:    map[string]any{"min": 0, "max": 100, "value": 64},
						},
						{
							ID:       "bar-1",
							Type:     "bar",
							Name:     "Battery_Bar",
							ParentID: ptr("root-screen-1"),
							Layout:   LayoutBox{X: 20, Y: 80, Width: 180, Height: 20},
							Props:    map[string]any{"min": 0, "max": 100, "value": 86},
						},
						{
							ID:       "arc-1",
							Type:     "arc",
							Name:     "Progress_Arc",
							ParentID: ptr("root-screen-1"),
							Layout:   LayoutBox{X: 20, Y: 120, Width: 96, Height: 96},
							Props:    map[string]any{"min": 0, "max": 100, "value": 72},
						},
						{
							ID:       "checkbox-1",
							Type:     "checkbox",
							Name:     "Enable_Checkbox",
							ParentID: ptr("root-screen-1"),
							Layout:   LayoutBox{X: 20, Y: 230, Width: 160, Height: 32},
							Props:    map[string]any{"text": "Enable logs", "checked": true},
						},
						{
							ID:       "dropdown-1",
							Type:     "dropdown",
							Name:     "Mode_Dropdown",
							ParentID: ptr("root-screen-1"),
							Layout:   LayoutBox{X: 20, Y: 270, Width: 160, Height: 36},
							Props:    map[string]any{"text": "Mode", "options": "Auto\nManual\nOff", "selected": 1},
						},
						{
							ID:       "switch-1",
							Type:     "switch",
							Name:     "Power_Switch",
							ParentID: ptr("root-screen-1"),
							Layout:   LayoutBox{X: 20, Y: 320, Width: 64, Height: 32},
							Props:    map[string]any{"checked": true},
						},
						{
							ID:       "spinner-1",
							Type:     "spinner",
							Name:     "Loading_Spinner",
							ParentID: ptr("root-screen-1"),
							Layout:   LayoutBox{X: 120, Y: 320, Width: 64, Height: 64},
							Props:    map[string]any{"spinTime": 900, "arcLength": 80},
						},
						{
							ID:       "line-1",
							Type:     "line",
							Name:     "Trend_Line",
							ParentID: ptr("root-screen-1"),
							Layout:   LayoutBox{X: 20, Y: 370, Width: 120, Height: 40},
							Props:    map[string]any{},
						},
						{
							ID:       "chart-1",
							Type:     "chart",
							Name:     "Telemetry_Chart",
							ParentID: ptr("root-screen-1"),
							Layout:   LayoutBox{X: 160, Y: 360, Width: 200, Height: 96},
							Props:    map[string]any{"min": 0, "max": 100, "pointCount": 8},
						},
						{
							ID:       "hidden-label-1",
							Type:     "label",
							Name:     "Hidden_Label",
							ParentID: ptr("root-screen-1"),
							Layout:   LayoutBox{X: 16, Y: 430, Width: 120, Height: 32},
							Props:    map[string]any{"text": "Hidden"},
							Hidden:   true,
						},
					},
				},
			},
		},
	}

	archive, err := GenerateCZip(doc)
	if err != nil {
		t.Fatalf("GenerateCZip returned error: %v", err)
	}
	uiC := unzip(t, archive)["ui.c"]

	for _, expected := range []string{
		"lv_slider_set_range(ui_Brightness_Slider, 0, 100);",
		"lv_slider_set_value(ui_Brightness_Slider, 64, LV_ANIM_OFF);",
		"lv_bar_set_range(ui_Battery_Bar, 0, 100);",
		"lv_bar_set_value(ui_Battery_Bar, 86, LV_ANIM_OFF);",
		"lv_arc_set_range(ui_Progress_Arc, 0, 100);",
		"lv_arc_set_value(ui_Progress_Arc, 72);",
		`lv_checkbox_set_text(ui_Enable_Checkbox, "Enable logs");`,
		"lv_obj_add_state(ui_Enable_Checkbox, LV_STATE_CHECKED);",
		`lv_dropdown_set_text(ui_Mode_Dropdown, "Mode");`,
		`lv_dropdown_set_options(ui_Mode_Dropdown, "Auto\nManual\nOff");`,
		"lv_dropdown_set_selected(ui_Mode_Dropdown, 1);",
		"lv_obj_add_state(ui_Power_Switch, LV_STATE_CHECKED);",
		"ui_Loading_Spinner = lv_spinner_create(ui_Screen_1, 900, 80);",
		"static lv_point_t ui_Trend_Line_points[] = {{0, 0}, {120, 40}};",
		"lv_line_set_points(ui_Trend_Line, ui_Trend_Line_points, 2);",
		"lv_chart_set_range(ui_Telemetry_Chart, LV_CHART_AXIS_PRIMARY_Y, 0, 100);",
		"lv_chart_set_point_count(ui_Telemetry_Chart, 8);",
		"lv_chart_set_type(ui_Telemetry_Chart, LV_CHART_TYPE_LINE);",
		"lv_chart_series_t * ui_Telemetry_Chart_series = lv_chart_add_series(ui_Telemetry_Chart, lv_palette_main(LV_PALETTE_BLUE), LV_CHART_AXIS_PRIMARY_Y);",
		"lv_chart_set_next_value(ui_Telemetry_Chart, ui_Telemetry_Chart_series, 20);",
		"lv_chart_refresh(ui_Telemetry_Chart);",
		"lv_obj_add_flag(ui_Hidden_Label, LV_OBJ_FLAG_HIDDEN);",
	} {
		if !strings.Contains(uiC, expected) {
			t.Fatalf("ui.c missing expected widget property call %q:\n%s", expected, uiC)
		}
	}
}

func TestGenerateCZipIncludesScreenRootFlexLayout(t *testing.T) {
	doc := ProjectDoc{
		SchemaVersion: 1,
		ID:            "project-1",
		Name:          "Screen Flex UI",
		Theme:         "dark",
		UpdatedAt:     "2026-05-08T00:00:00Z",
		Styles:        []StyleDef{},
		Events:        []EventBinding{},
		Target:        TargetConfig{LvglVersion: "8.3", DeviceName: "ESP32-S3", Width: 480, Height: 480, DPI: 240, ColorDepth: 16},
		Screens: []ScreenNode{
			{
				ID:   "screen-1",
				Name: "Screen_1",
				Root: WidgetNode{
					ID:     "root-screen-1",
					Type:   "screen",
					Name:   "Screen_1",
					Layout: LayoutBox{X: 0, Y: 0, Width: 480, Height: 480, Flex: &FlexLayout{Direction: "column", Gap: 12, Wrap: true}},
				},
			},
		},
	}

	archive, err := GenerateCZip(doc)
	if err != nil {
		t.Fatalf("GenerateCZip returned error: %v", err)
	}
	uiC := unzip(t, archive)["ui.c"]

	for _, expected := range []string{
		"lv_obj_set_layout(ui_Screen_1, LV_LAYOUT_FLEX);",
		"lv_obj_set_flex_flow(ui_Screen_1, LV_FLEX_FLOW_COLUMN_WRAP);",
		"lv_obj_set_style_pad_row(ui_Screen_1, 12, LV_PART_MAIN | LV_STATE_DEFAULT);",
		"lv_obj_set_style_pad_column(ui_Screen_1, 12, LV_PART_MAIN | LV_STATE_DEFAULT);",
	} {
		if !strings.Contains(uiC, expected) {
			t.Fatalf("ui.c missing screen flex call %q:\n%s", expected, uiC)
		}
	}
}

func TestGenerateCOutputIsStableForSameDocument(t *testing.T) {
	doc := ProjectDoc{
		SchemaVersion: 1,
		ID:            "project-stable",
		Name:          "Stable UI",
		Theme:         "dark",
		UpdatedAt:     "2026-05-08T00:00:00Z",
		Styles:        []StyleDef{},
		Events:        []EventBinding{},
		Target:        TargetConfig{LvglVersion: "8.3", DeviceName: "ESP32-S3", Width: 480, Height: 480, DPI: 240, ColorDepth: 16},
		Screens: []ScreenNode{
			{
				ID:   "screen-1",
				Name: "Screen_1",
				Root: WidgetNode{
					ID:     "root-screen-1",
					Type:   "screen",
					Name:   "Screen_1",
					Layout: LayoutBox{X: 0, Y: 0, Width: 480, Height: 480},
					Children: []WidgetNode{
						{
							ID:       "label-1",
							Type:     "label",
							Name:     "Status Label",
							ParentID: ptr("root-screen-1"),
							Layout:   LayoutBox{X: 12, Y: 20, Width: 120, Height: 32},
							Props:    map[string]any{"text": "Ready"},
						},
						{
							ID:       "label-2",
							Type:     "label",
							Name:     "Status Label",
							ParentID: ptr("root-screen-1"),
							Layout:   LayoutBox{X: 12, Y: 60, Width: 120, Height: 32},
							Props:    map[string]any{"text": "Done"},
						},
					},
				},
			},
		},
	}

	first, err := GenerateC(doc)
	if err != nil {
		t.Fatalf("first GenerateC returned error: %v", err)
	}
	second, err := GenerateC(doc)
	if err != nil {
		t.Fatalf("second GenerateC returned error: %v", err)
	}
	if len(first) != len(second) {
		t.Fatalf("file count changed: %d != %d", len(first), len(second))
	}
	for index := range first {
		if first[index] != second[index] {
			t.Fatalf("generated file %d changed:\nfirst=%#v\nsecond=%#v", index, first[index], second[index])
		}
	}
	if !strings.Contains(first[0].content+first[1].content+first[2].content+first[3].content+first[4].content, "ui_Status_Label_2") {
		t.Fatalf("expected stable suffix for duplicate widget names")
	}
}

func TestGenerateCZipUsesChartValuesWhenProvided(t *testing.T) {
	doc := ProjectDoc{
		SchemaVersion: 1,
		ID:            "project-1",
		Name:          "Chart UI",
		Theme:         "dark",
		UpdatedAt:     "2026-05-08T00:00:00Z",
		Styles:        []StyleDef{},
		Events:        []EventBinding{},
		Target:        TargetConfig{LvglVersion: "8.3", DeviceName: "ESP32-S3", Width: 480, Height: 480, DPI: 240, ColorDepth: 16},
		Screens: []ScreenNode{
			{
				ID:   "screen-1",
				Name: "Screen_1",
				Root: WidgetNode{
					ID:     "root-screen-1",
					Type:   "screen",
					Name:   "Screen_1",
					Layout: LayoutBox{X: 0, Y: 0, Width: 480, Height: 480},
					Children: []WidgetNode{
						{
							ID:       "chart-1",
							Type:     "chart",
							Name:     "Telemetry_Chart",
							ParentID: ptr("root-screen-1"),
							Layout:   LayoutBox{X: 20, Y: 40, Width: 200, Height: 96},
							Props: map[string]any{
								"min":        10,
								"max":        90,
								"pointCount": 3,
								"values":     []any{5, 40, 120, 70},
							},
						},
					},
				},
			},
		},
	}

	archive, err := GenerateCZip(doc)
	if err != nil {
		t.Fatalf("GenerateCZip returned error: %v", err)
	}
	uiC := unzip(t, archive)["ui.c"]

	for _, expected := range []string{
		"lv_chart_set_next_value(ui_Telemetry_Chart, ui_Telemetry_Chart_series, 10);",
		"lv_chart_set_next_value(ui_Telemetry_Chart, ui_Telemetry_Chart_series, 40);",
		"lv_chart_set_next_value(ui_Telemetry_Chart, ui_Telemetry_Chart_series, 90);",
	} {
		if !strings.Contains(uiC, expected) {
			t.Fatalf("ui.c missing chart value call %q:\n%s", expected, uiC)
		}
	}
	if strings.Contains(uiC, "lv_chart_set_next_value(ui_Telemetry_Chart, ui_Telemetry_Chart_series, 70);") {
		t.Fatalf("ui.c should not emit values beyond pointCount:\n%s", uiC)
	}
}

func TestGenerateCZipRejectsDocumentWithoutScreens(t *testing.T) {
	_, err := GenerateCZip(ProjectDoc{SchemaVersion: 1, ID: "project-1", Name: "Broken", Theme: "dark", UpdatedAt: "2026-05-08T00:00:00Z", Styles: []StyleDef{}, Events: []EventBinding{}})
	if err == nil {
		t.Fatal("expected error for document without screens")
	}
	if !strings.Contains(err.Error(), "at least one screen") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestGenerateCRejectsInvalidTargetConfig(t *testing.T) {
	doc := minimalValidDoc()
	doc.Target.ColorDepth = 24

	_, err := GenerateC(doc)
	if err == nil || !strings.Contains(err.Error(), "target colorDepth must be 16 or 32") {
		t.Fatalf("expected invalid target error, got %v", err)
	}
}

func TestGenerateCRejectsInvalidWidgetLayout(t *testing.T) {
	doc := minimalValidDoc()
	doc.Screens[0].Root.Children = []WidgetNode{
		{
			ID:       "label-1",
			Type:     "label",
			Name:     "Label_1",
			ParentID: ptr("root-screen-1"),
			Layout:   LayoutBox{X: 0, Y: 0, Width: 0, Height: 32},
			Props:    map[string]any{"text": "Broken"},
		},
	}

	_, err := GenerateC(doc)
	if err == nil || !strings.Contains(err.Error(), "widget width must be greater than 0: label-1") {
		t.Fatalf("expected invalid layout error, got %v", err)
	}
}

func TestGenerateCRejectsInvalidWidgetStyle(t *testing.T) {
	doc := minimalValidDoc()
	doc.Screens[0].Root.Children = []WidgetNode{
		{
			ID:       "label-1",
			Type:     "label",
			Name:     "Label_1",
			ParentID: ptr("root-screen-1"),
			Layout:   LayoutBox{X: 0, Y: 0, Width: 120, Height: 32},
			Props:    map[string]any{"text": "Broken"},
			Style:    WidgetStyle{Opacity: intPtr(120)},
		},
	}

	_, err := GenerateC(doc)
	if err == nil || !strings.Contains(err.Error(), "style opacity must be between 0 and 100: label-1") {
		t.Fatalf("expected invalid style error, got %v", err)
	}

	doc = minimalValidDoc()
	doc.Screens[0].Root.Style = WidgetStyle{LetterSpace: -1, LineSpace: -2}

	_, err = GenerateC(doc)
	if err == nil || !strings.Contains(err.Error(), "style letterSpace must be non-negative: root-screen-1") {
		t.Fatalf("expected invalid inline style spacing error, got %v", err)
	}

	doc = minimalValidDoc()
	doc.Styles = []StyleDef{
		{ID: "style-bad", Name: "Bad", Style: WidgetStyle{LetterSpace: -1, LineSpace: -2}},
	}

	_, err = GenerateC(doc)
	if err == nil || !strings.Contains(err.Error(), "style letterSpace must be non-negative: style-bad") {
		t.Fatalf("expected invalid reusable style spacing error, got %v", err)
	}
}

func TestGenerateCRejectsInvalidWidgetSpecificProps(t *testing.T) {
	for _, testCase := range []struct {
		name        string
		widget      WidgetNode
		expectedErr string
	}{
		{
			name: "spinner spin time",
			widget: WidgetNode{
				ID:       "spinner-1",
				Type:     "spinner",
				Name:     "Spinner_1",
				ParentID: ptr("root-screen-1"),
				Layout:   LayoutBox{X: 0, Y: 0, Width: 64, Height: 64},
				Props:    map[string]any{"spinTime": 0},
			},
			expectedErr: "widget prop spinTime must be greater than 0: spinner-1",
		},
		{
			name: "chart point count",
			widget: WidgetNode{
				ID:       "chart-1",
				Type:     "chart",
				Name:     "Chart_1",
				ParentID: ptr("root-screen-1"),
				Layout:   LayoutBox{X: 0, Y: 0, Width: 160, Height: 96},
				Props:    map[string]any{"pointCount": 0},
			},
			expectedErr: "widget prop pointCount must be greater than 0: chart-1",
		},
		{
			name: "chart values",
			widget: WidgetNode{
				ID:       "chart-1",
				Type:     "chart",
				Name:     "Chart_1",
				ParentID: ptr("root-screen-1"),
				Layout:   LayoutBox{X: 0, Y: 0, Width: 160, Height: 96},
				Props:    map[string]any{"pointCount": 3, "values": []any{10, "bad", 30}},
			},
			expectedErr: "widget prop values must contain only finite numbers: chart-1",
		},
		{
			name: "chart values fractional",
			widget: WidgetNode{
				ID:       "chart-2",
				Type:     "chart",
				Name:     "Chart_2",
				ParentID: ptr("root-screen-1"),
				Layout:   LayoutBox{X: 0, Y: 0, Width: 160, Height: 96},
				Props:    map[string]any{"pointCount": 3, "values": []any{10, 20.5, 30}},
			},
			expectedErr: "widget prop values must contain only integers: chart-2",
		},
		{
			name: "dropdown selected",
			widget: WidgetNode{
				ID:       "dropdown-1",
				Type:     "dropdown",
				Name:     "Dropdown_1",
				ParentID: ptr("root-screen-1"),
				Layout:   LayoutBox{X: 0, Y: 0, Width: 160, Height: 36},
				Props:    map[string]any{"selected": -1},
			},
			expectedErr: "widget prop selected must be non-negative: dropdown-1",
		},
		{
			name: "dropdown selected option",
			widget: WidgetNode{
				ID:       "dropdown-2",
				Type:     "dropdown",
				Name:     "Dropdown_2",
				ParentID: ptr("root-screen-1"),
				Layout:   LayoutBox{X: 0, Y: 0, Width: 160, Height: 36},
				Props:    map[string]any{"options": "One\nTwo", "selected": 2},
			},
			expectedErr: "widget prop selected must reference an available option: dropdown-2",
		},
		{
			name: "range bounds",
			widget: WidgetNode{
				ID:       "slider-1",
				Type:     "slider",
				Name:     "Slider_1",
				ParentID: ptr("root-screen-1"),
				Layout:   LayoutBox{X: 0, Y: 0, Width: 160, Height: 24},
				Props:    map[string]any{"min": 100, "max": 10},
			},
			expectedErr: "widget prop max must be greater than min: slider-1",
		},
		{
			name: "range value",
			widget: WidgetNode{
				ID:       "bar-1",
				Type:     "bar",
				Name:     "Bar_1",
				ParentID: ptr("root-screen-1"),
				Layout:   LayoutBox{X: 0, Y: 0, Width: 160, Height: 24},
				Props:    map[string]any{"min": 10, "max": 20, "value": 24},
			},
			expectedErr: "widget prop value must be between min and max: bar-1",
		},
		{
			name: "default range value",
			widget: WidgetNode{
				ID:       "arc-1",
				Type:     "arc",
				Name:     "Arc_1",
				ParentID: ptr("root-screen-1"),
				Layout:   LayoutBox{X: 0, Y: 0, Width: 80, Height: 80},
				Props:    map[string]any{"value": 120},
			},
			expectedErr: "widget prop value must be between min and max: arc-1",
		},
		{
			name: "range value type",
			widget: WidgetNode{
				ID:       "slider-2",
				Type:     "slider",
				Name:     "Slider_2",
				ParentID: ptr("root-screen-1"),
				Layout:   LayoutBox{X: 0, Y: 0, Width: 160, Height: 24},
				Props:    map[string]any{"value": "50"},
			},
			expectedErr: "widget prop value must be a number: slider-2",
		},
		{
			name: "range value fractional",
			widget: WidgetNode{
				ID:       "slider-3",
				Type:     "slider",
				Name:     "Slider_3",
				ParentID: ptr("root-screen-1"),
				Layout:   LayoutBox{X: 0, Y: 0, Width: 160, Height: 24},
				Props:    map[string]any{"value": 50.5},
			},
			expectedErr: "widget prop value must be an integer: slider-3",
		},
		{
			name: "switch checked type",
			widget: WidgetNode{
				ID:       "switch-1",
				Type:     "switch",
				Name:     "Switch_1",
				ParentID: ptr("root-screen-1"),
				Layout:   LayoutBox{X: 0, Y: 0, Width: 64, Height: 32},
				Props:    map[string]any{"checked": "true"},
			},
			expectedErr: "widget prop checked must be a boolean: switch-1",
		},
		{
			name: "label text type",
			widget: WidgetNode{
				ID:       "label-2",
				Type:     "label",
				Name:     "Label_2",
				ParentID: ptr("root-screen-1"),
				Layout:   LayoutBox{X: 0, Y: 0, Width: 120, Height: 32},
				Props:    map[string]any{"text": 123},
			},
			expectedErr: "widget prop text must be a string: label-2",
		},
		{
			name: "image asset id type",
			widget: WidgetNode{
				ID:       "image-2",
				Type:     "image",
				Name:     "Image_2",
				ParentID: ptr("root-screen-1"),
				Layout:   LayoutBox{X: 0, Y: 0, Width: 96, Height: 96},
				Props:    map[string]any{"assetId": 123},
			},
			expectedErr: "widget prop assetId must be a string: image-2",
		},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			doc := minimalValidDoc()
			doc.Screens[0].Root.Children = []WidgetNode{testCase.widget}

			_, err := GenerateC(doc)
			if err == nil || !strings.Contains(err.Error(), testCase.expectedErr) {
				t.Fatalf("expected invalid prop error %q, got %v", testCase.expectedErr, err)
			}
		})
	}
}

func TestGenerateCRejectsFlexLayoutOnNonContainerWidgets(t *testing.T) {
	doc := minimalValidDoc()
	doc.Screens[0].Root.Children = []WidgetNode{{
		ID:       "label-1",
		Type:     "label",
		Name:     "Label_1",
		ParentID: ptr("root-screen-1"),
		Layout: LayoutBox{
			X: 0, Y: 0, Width: 120, Height: 32,
			Flex: &FlexLayout{Direction: "row", Gap: 4, Wrap: false},
		},
		Props: map[string]any{"text": "Label"},
	}}

	_, err := GenerateC(doc)
	if err == nil || !strings.Contains(err.Error(), "widget flex layout is only supported on screen and container widgets: label-1") {
		t.Fatalf("expected invalid flex owner error, got %v", err)
	}
}

func TestGenerateCRejectsInvalidAssetMetadata(t *testing.T) {
	doc := minimalValidDoc()
	doc.Assets = []AssetRef{
		{ID: "asset-1", ProjectID: doc.ID, Name: "icon.png", Kind: "image", MimeType: "image/png", SizeBytes: 120, ObjectKey: "projects/project-1/assets/icon.png", CreatedAt: "2026-05-08T00:00:00Z", Data: onePixelPNG(t, color.RGBA{R: 0x10, G: 0x20, B: 0x30, A: 0xFF})},
		{ID: "asset-1", ProjectID: "other-project", Kind: "audio", Width: -1, Height: -2, SizeBytes: -1},
	}

	_, err := GenerateC(doc)
	if err == nil || !strings.Contains(err.Error(), "asset id must be unique: asset-1") {
		t.Fatalf("expected invalid asset metadata error, got %v", err)
	}
}

func TestGenerateCRejectsNegativeAssetDimensions(t *testing.T) {
	doc := minimalValidDoc()
	doc.Assets = []AssetRef{
		{ID: "asset-1", ProjectID: doc.ID, Name: "icon.png", Kind: "image", MimeType: "image/png", Width: -1, Height: -2, SizeBytes: 120, ObjectKey: "projects/project-1/assets/icon.png", CreatedAt: "2026-05-08T00:00:00Z"},
	}

	_, err := GenerateC(doc)
	if err == nil || !strings.Contains(err.Error(), "asset width must be non-negative: asset-1") {
		t.Fatalf("expected negative asset dimension error, got %v", err)
	}
}

func TestGenerateCRejectsUnsupportedImageAssetMimeType(t *testing.T) {
	doc := minimalValidDoc()
	doc.Assets = []AssetRef{
		{
			ID:        "asset-gif",
			ProjectID: doc.ID,
			Name:      "animated.gif",
			Kind:      "image",
			MimeType:  "image/gif",
			Width:     16,
			Height:    16,
			SizeBytes: 4,
			ObjectKey: "projects/project-1/assets/asset-gif/animated.gif",
			CreatedAt: "2026-05-08T00:00:00Z",
			Data:      []byte{0x47, 0x49, 0x46, 0x38},
		},
	}

	_, err := GenerateC(doc)
	if err == nil || !strings.Contains(err.Error(), "unsupported image asset mimeType: asset-gif") {
		t.Fatalf("expected unsupported image mimeType error, got %v", err)
	}
}

func TestGenerateCRejectsUnsupportedFontAssetMimeType(t *testing.T) {
	doc := minimalValidDoc()
	doc.Assets = []AssetRef{
		{
			ID:        "font-asset",
			ProjectID: doc.ID,
			Name:      "brand.bin",
			Kind:      "font",
			MimeType:  "application/octet-stream",
			SizeBytes: 4,
			ObjectKey: "projects/project-1/assets/font-asset/brand.bin",
			CreatedAt: "2026-05-08T00:00:00Z",
		},
	}

	_, err := GenerateC(doc)
	if err == nil || !strings.Contains(err.Error(), "unsupported font asset mimeType: font-asset") {
		t.Fatalf("expected unsupported font mimeType error, got %v", err)
	}
}

func TestGenerateCRejectsAssetKindMismatches(t *testing.T) {
	doc := minimalValidDoc()
	doc.Assets = []AssetRef{
		{ID: "font-asset", ProjectID: doc.ID, Name: "brand.ttf", Kind: "font", MimeType: "font/ttf", SizeBytes: 2048, ObjectKey: "projects/project-1/assets/brand.ttf", CreatedAt: "2026-05-08T00:00:00Z"},
	}
	doc.Screens[0].Root.Children = []WidgetNode{
		{
			ID:       "image-1",
			Type:     "image",
			Name:     "Image_1",
			ParentID: ptr("root-screen-1"),
			Layout:   LayoutBox{X: 0, Y: 0, Width: 96, Height: 96},
			Props:    map[string]any{"assetId": "font-asset"},
		},
	}

	_, err := GenerateC(doc)
	if err == nil || !strings.Contains(err.Error(), "image widget must reference an image asset: font-asset") {
		t.Fatalf("expected image asset kind error, got %v", err)
	}

	doc = minimalValidDoc()
	doc.Assets = []AssetRef{
		{ID: "image-asset", ProjectID: doc.ID, Name: "icon.png", Kind: "image", MimeType: "image/png", Width: 32, Height: 32, SizeBytes: 128, ObjectKey: "projects/project-1/assets/icon.png", CreatedAt: "2026-05-08T00:00:00Z", Data: onePixelPNG(t, color.RGBA{R: 0x10, G: 0x20, B: 0x30, A: 0xFF})},
	}
	doc.Screens[0].Root.Style.Font = "image-asset"

	_, err = GenerateC(doc)
	if err == nil || !strings.Contains(err.Error(), "font style must reference a font asset: image-asset") {
		t.Fatalf("expected font asset kind error, got %v", err)
	}
}

func TestGenerateCRejectsInvalidStyleColors(t *testing.T) {
	doc := minimalValidDoc()
	doc.Screens[0].Root.Style.BgColor = "red"

	_, err := GenerateC(doc)
	if err == nil || !strings.Contains(err.Error(), "style bgColor must be a 3 or 6 digit hex color: root-screen-1") {
		t.Fatalf("expected invalid style color error, got %v", err)
	}

	doc = minimalValidDoc()
	doc.Styles = []StyleDef{
		{ID: "style-accent", Name: "Accent", Style: WidgetStyle{TextColor: "#12xx56"}},
	}

	_, err = GenerateC(doc)
	if err == nil || !strings.Contains(err.Error(), "style textColor must be a 3 or 6 digit hex color: style-accent") {
		t.Fatalf("expected invalid reusable style color error, got %v", err)
	}
}

func TestGenerateCRejectsDuplicateWidgetID(t *testing.T) {
	doc := minimalValidDoc()
	doc.Screens[0].Root.Children = []WidgetNode{
		{
			ID:       "duplicate-label",
			Type:     "label",
			Name:     "Label_1",
			ParentID: ptr("root-screen-1"),
			Layout:   LayoutBox{X: 0, Y: 0, Width: 120, Height: 32},
			Props:    map[string]any{"text": "One"},
		},
		{
			ID:       "duplicate-label",
			Type:     "label",
			Name:     "Label_2",
			ParentID: ptr("root-screen-1"),
			Layout:   LayoutBox{X: 0, Y: 40, Width: 120, Height: 32},
			Props:    map[string]any{"text": "Two"},
		},
	}

	_, err := GenerateC(doc)
	if err == nil || !strings.Contains(err.Error(), "widget id must be unique within a screen: duplicate-label") {
		t.Fatalf("expected duplicate widget id error, got %v", err)
	}
}

func TestGenerateCRejectsDuplicateWidgetIDAcrossScreens(t *testing.T) {
	doc := minimalValidDoc()
	doc.Screens = append(doc.Screens, ScreenNode{
		ID:   "screen-2",
		Name: "Screen_2",
		Root: WidgetNode{
			ID:     "root-screen-2",
			Type:   "screen",
			Name:   "Screen_2",
			Layout: LayoutBox{X: 0, Y: 0, Width: 480, Height: 480},
			Children: []WidgetNode{
				{
					ID:       "root-screen-1",
					Type:     "label",
					Name:     "Label_1",
					ParentID: ptr("root-screen-2"),
					Layout:   LayoutBox{X: 0, Y: 0, Width: 120, Height: 32},
					Props:    map[string]any{"text": "Duplicate"},
				},
			},
		},
	})

	_, err := GenerateC(doc)
	if err == nil || !strings.Contains(err.Error(), "widget id must be unique across project: root-screen-1") {
		t.Fatalf("expected duplicate project widget id error, got %v", err)
	}
}

func TestGenerateCRejectsMissingWidgetParentID(t *testing.T) {
	doc := minimalValidDoc()
	doc.Screens[0].Root.Children = []WidgetNode{
		{
			ID:     "label-1",
			Type:   "label",
			Name:   "Label_1",
			Layout: LayoutBox{X: 0, Y: 0, Width: 120, Height: 32},
			Props:  map[string]any{"text": "Broken"},
		},
	}

	_, err := GenerateC(doc)
	if err == nil || !strings.Contains(err.Error(), "widget parentId must be root-screen-1") {
		t.Fatalf("expected missing parentId error, got %v", err)
	}
}

func TestGenerateCRejectsImageWidgetWithMissingAsset(t *testing.T) {
	doc := minimalValidDoc()
	doc.Screens[0].Root.Children = []WidgetNode{
		{
			ID:       "image-1",
			Type:     "image",
			Name:     "Image_1",
			ParentID: ptr("root-screen-1"),
			Layout:   LayoutBox{X: 0, Y: 0, Width: 64, Height: 64},
			Props:    map[string]any{"assetId": "missing-asset"},
		},
	}

	_, err := GenerateC(doc)
	if err == nil || !strings.Contains(err.Error(), "image widget references missing asset: missing-asset") {
		t.Fatalf("expected missing image asset error, got %v", err)
	}
}

func TestGenerateCRejectsFontStyleWithMissingAsset(t *testing.T) {
	doc := minimalValidDoc()
	doc.Screens[0].Root.Children = []WidgetNode{
		{
			ID:       "label-1",
			Type:     "label",
			Name:     "Label_1",
			ParentID: ptr("root-screen-1"),
			Layout:   LayoutBox{X: 0, Y: 0, Width: 120, Height: 32},
			Props:    map[string]any{"text": "Broken"},
			Style:    WidgetStyle{Font: "missing-font"},
		},
	}

	_, err := GenerateC(doc)
	if err == nil || !strings.Contains(err.Error(), "font style references missing asset: missing-font") {
		t.Fatalf("expected missing font asset error, got %v", err)
	}
}

func TestGenerateCRejectsUnsupportedLvglFontSymbol(t *testing.T) {
	doc := minimalValidDoc()
	doc.Screens[0].Root.Children = []WidgetNode{
		{
			ID:       "label-1",
			Type:     "label",
			Name:     "Label_1",
			ParentID: ptr("root-screen-1"),
			Layout:   LayoutBox{X: 0, Y: 0, Width: 120, Height: 32},
			Props:    map[string]any{"text": "Broken"},
			Style:    WidgetStyle{Font: "lv_font_custom_24"},
		},
	}

	_, err := GenerateC(doc)
	if err == nil || !strings.Contains(err.Error(), "font style references missing asset: lv_font_custom_24") {
		t.Fatalf("expected unsupported LVGL font symbol error, got %v", err)
	}
}

func TestGenerateCRejectsEventBindingToMissingWidget(t *testing.T) {
	doc := ProjectDoc{
		SchemaVersion: 1,
		ID:            "project-1",
		Name:          "Broken Event UI",
		Theme:         "dark",
		UpdatedAt:     "2026-05-08T00:00:00Z",
		Styles:        []StyleDef{},
		Target:        TargetConfig{LvglVersion: "8.3", DeviceName: "ESP32-S3", Width: 480, Height: 480, DPI: 240, ColorDepth: 16},
		Events: []EventBinding{
			{ID: "event-1", WidgetID: "missing-widget", Event: "LV_EVENT_CLICKED", HandlerName: "on_missing_clicked"},
		},
		Screens: []ScreenNode{
			{
				ID:   "screen-1",
				Name: "Screen_1",
				Root: WidgetNode{
					ID:     "root-screen-1",
					Type:   "screen",
					Name:   "Screen_1",
					Layout: LayoutBox{X: 0, Y: 0, Width: 480, Height: 480},
				},
			},
		},
	}

	_, err := GenerateC(doc)
	if err == nil || !strings.Contains(err.Error(), "event binding references missing widget: missing-widget") {
		t.Fatalf("expected missing event target error, got %v", err)
	}
}

func TestGenerateCRejectsUnsupportedEventType(t *testing.T) {
	doc := ProjectDoc{
		SchemaVersion: 1,
		ID:            "project-1",
		Name:          "Broken Event UI",
		Theme:         "dark",
		UpdatedAt:     "2026-05-08T00:00:00Z",
		Styles:        []StyleDef{},
		Target:        TargetConfig{LvglVersion: "8.3", DeviceName: "ESP32-S3", Width: 480, Height: 480, DPI: 240, ColorDepth: 16},
		Events: []EventBinding{
			{ID: "event-1", WidgetID: "root-screen-1", Event: "LV_EVENT_DELETE", HandlerName: "on_delete"},
		},
		Screens: []ScreenNode{
			{
				ID:   "screen-1",
				Name: "Screen_1",
				Root: WidgetNode{
					ID:     "root-screen-1",
					Type:   "screen",
					Name:   "Screen_1",
					Layout: LayoutBox{X: 0, Y: 0, Width: 480, Height: 480},
				},
			},
		},
	}

	_, err := GenerateC(doc)
	if err == nil || !strings.Contains(err.Error(), "unsupported event type: LV_EVENT_DELETE") {
		t.Fatalf("expected unsupported event error, got %v", err)
	}
}

func TestGenerateCRejectsEmptyEventHandler(t *testing.T) {
	doc := ProjectDoc{
		SchemaVersion: 1,
		ID:            "project-1",
		Name:          "Broken Event UI",
		Theme:         "dark",
		UpdatedAt:     "2026-05-08T00:00:00Z",
		Styles:        []StyleDef{},
		Target:        TargetConfig{LvglVersion: "8.3", DeviceName: "ESP32-S3", Width: 480, Height: 480, DPI: 240, ColorDepth: 16},
		Events: []EventBinding{
			{ID: "event-1", WidgetID: "root-screen-1", Event: "LV_EVENT_CLICKED", HandlerName: "  "},
		},
		Screens: []ScreenNode{
			{
				ID:   "screen-1",
				Name: "Screen_1",
				Root: WidgetNode{
					ID:     "root-screen-1",
					Type:   "screen",
					Name:   "Screen_1",
					Layout: LayoutBox{X: 0, Y: 0, Width: 480, Height: 480},
				},
			},
		},
	}

	_, err := GenerateC(doc)
	if err == nil || !strings.Contains(err.Error(), "event handlerName is required: event-1") {
		t.Fatalf("expected empty event handler error, got %v", err)
	}
}

func TestGenerateCRejectsDuplicateEventIDs(t *testing.T) {
	doc := minimalValidDoc()
	doc.Events = []EventBinding{
		{ID: "event-1", WidgetID: "root-screen-1", Event: "LV_EVENT_READY", HandlerName: "on_screen_ready"},
		{ID: "event-1", WidgetID: "root-screen-1", Event: "LV_EVENT_CLICKED", HandlerName: "on_screen_clicked"},
	}

	_, err := GenerateC(doc)
	if err == nil || !strings.Contains(err.Error(), "event id must be unique: event-1") {
		t.Fatalf("expected duplicate event id error, got %v", err)
	}
}

func TestGenerateCRejectsDuplicateEventCallbackSymbols(t *testing.T) {
	doc := minimalValidDoc()
	doc.Events = []EventBinding{
		{ID: "event-1", WidgetID: "root-screen-1", Event: "LV_EVENT_READY", HandlerName: "on-ready"},
		{ID: "event-2", WidgetID: "root-screen-1", Event: "LV_EVENT_CLICKED", HandlerName: "on_ready"},
	}

	_, err := GenerateC(doc)
	if err == nil || !strings.Contains(err.Error(), "event handlerName must generate a unique C callback symbol: on_ready") {
		t.Fatalf("expected duplicate event callback symbol error, got %v", err)
	}
}

func TestGenerateCRejectsEventCallbackSymbolCollidingWithWidgetSymbol(t *testing.T) {
	doc := minimalValidDoc()
	doc.Screens[0].Root.Children = []WidgetNode{
		{
			ID:       "button-1",
			Type:     "button",
			Name:     "Start_Button",
			ParentID: ptr("root-screen-1"),
			Layout:   LayoutBox{X: 0, Y: 0, Width: 120, Height: 48},
			Props:    map[string]any{"text": "Start"},
			Style:    WidgetStyle{},
		},
	}
	doc.Events = []EventBinding{
		{ID: "event-1", WidgetID: "button-1", Event: "LV_EVENT_CLICKED", HandlerName: "ui_Start_Button"},
	}

	_, err := GenerateC(doc)
	if err == nil || !strings.Contains(err.Error(), "event handlerName collides with generated C symbol: ui_Start_Button") {
		t.Fatalf("expected event callback symbol collision error, got %v", err)
	}
}

func TestGenerateCRejectsEventCallbackSymbolCollidingWithScreenInitSymbol(t *testing.T) {
	doc := minimalValidDoc()
	doc.Events = []EventBinding{
		{ID: "event-1", WidgetID: "root-screen-1", Event: "LV_EVENT_READY", HandlerName: "ui_Screen_1_screen_init"},
	}

	_, err := GenerateC(doc)
	if err == nil || !strings.Contains(err.Error(), "event handlerName collides with generated C symbol: ui_Screen_1_screen_init") {
		t.Fatalf("expected screen init callback symbol collision error, got %v", err)
	}
}

func TestGenerateCRejectsEventCallbackSymbolCollidingWithWidgetHelperSymbol(t *testing.T) {
	testCases := []struct {
		name        string
		widget      WidgetNode
		handlerName string
	}{
		{
			name: "line points",
			widget: WidgetNode{
				ID:       "line-1",
				Type:     "line",
				Name:     "Trend_Line",
				ParentID: ptr("root-screen-1"),
				Layout:   LayoutBox{X: 0, Y: 0, Width: 120, Height: 4},
				Props:    map[string]any{},
				Style:    WidgetStyle{},
			},
			handlerName: "ui_Trend_Line_points",
		},
		{
			name: "chart series",
			widget: WidgetNode{
				ID:       "chart-1",
				Type:     "chart",
				Name:     "Telemetry_Chart",
				ParentID: ptr("root-screen-1"),
				Layout:   LayoutBox{X: 0, Y: 0, Width: 160, Height: 100},
				Props:    map[string]any{"min": 0, "max": 100, "pointCount": 3, "values": []any{10, 20, 30}},
				Style:    WidgetStyle{},
			},
			handlerName: "ui_Telemetry_Chart_series",
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			doc := minimalValidDoc()
			doc.Screens[0].Root.Children = []WidgetNode{testCase.widget}
			doc.Events = []EventBinding{
				{ID: "event-1", WidgetID: testCase.widget.ID, Event: "LV_EVENT_READY", HandlerName: testCase.handlerName},
			}

			_, err := GenerateC(doc)
			if err == nil || !strings.Contains(err.Error(), "event handlerName collides with generated C symbol: "+testCase.handlerName) {
				t.Fatalf("expected helper callback symbol collision error, got %v", err)
			}
		})
	}
}

func ptr(value string) *string {
	return &value
}

func intPtr(value int) *int {
	return &value
}

func minimalValidDoc() ProjectDoc {
	return ProjectDoc{
		SchemaVersion: 1,
		ID:            "project-1",
		Name:          "Valid UI",
		Theme:         "dark",
		UpdatedAt:     "2026-05-08T00:00:00Z",
		Styles:        []StyleDef{},
		Events:        []EventBinding{},
		Target:        TargetConfig{LvglVersion: "8.3", DeviceName: "ESP32-S3", Width: 480, Height: 480, DPI: 240, ColorDepth: 16},
		Screens: []ScreenNode{
			{
				ID:   "screen-1",
				Name: "Screen_1",
				Root: WidgetNode{
					ID:     "root-screen-1",
					Type:   "screen",
					Name:   "Screen_1",
					Layout: LayoutBox{X: 0, Y: 0, Width: 480, Height: 480},
				},
			},
		},
	}
}

func onePixelPNG(t *testing.T, pixel color.RGBA) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 1, 1))
	img.SetRGBA(0, 0, pixel)
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatalf("encode png: %v", err)
	}
	return buf.Bytes()
}

func generatedContent(files []generatedFile, path string) string {
	for _, file := range files {
		if file.path == path {
			return file.content
		}
	}
	return ""
}

func unzip(t *testing.T, archive []byte) map[string]string {
	t.Helper()

	reader, err := zip.NewReader(bytes.NewReader(archive), int64(len(archive)))
	if err != nil {
		t.Fatalf("invalid zip: %v", err)
	}

	files := map[string]string{}
	for _, file := range reader.File {
		handle, err := file.Open()
		if err != nil {
			t.Fatalf("open zip file %s: %v", file.Name, err)
		}
		buf := new(bytes.Buffer)
		if _, err := buf.ReadFrom(handle); err != nil {
			t.Fatalf("read zip file %s: %v", file.Name, err)
		}
		if err := handle.Close(); err != nil {
			t.Fatalf("close zip file %s: %v", file.Name, err)
		}
		files[file.Name] = buf.String()
	}

	return files
}
