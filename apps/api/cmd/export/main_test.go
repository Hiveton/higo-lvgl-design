package main

import (
	"archive/zip"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/hiveton/lvgl-online-editor/apps/api/internal/codegen"
)

func TestRunWritesLvglExportZip(t *testing.T) {
	dir := t.TempDir()
	input := filepath.Join(dir, "project.json")
	output := filepath.Join(dir, "export", "ui.zip")

	project := `{
		"schemaVersion": 1,
		"id": "project-1",
		"name": "CLI Export",
		"theme": "dark",
		"target": {
			"lvglVersion": "8.3",
			"deviceName": "Watch 480",
			"width": 480,
			"height": 480,
			"dpi": 326,
			"colorDepth": 16
		},
		"screens": [{
			"id": "screen-1",
			"name": "Screen_1",
			"root": {
				"id": "root-1",
				"type": "screen",
				"name": "Screen_1",
				"parentId": null,
				"children": [{
					"id": "label-1",
					"type": "label",
					"name": "Time_Label",
					"parentId": "root-1",
					"children": [],
					"layout": {"x": 150, "y": 40, "width": 180, "height": 56},
					"props": {"text": "10:09"},
					"style": {"textColor": "#F8FAFC"},
					"locked": false,
					"hidden": false
				}],
				"layout": {"x": 0, "y": 0, "width": 480, "height": 480},
				"props": {},
				"style": {"bgColor": "#111827"},
				"locked": false,
				"hidden": false
			}
		}],
		"assets": [],
		"styles": [],
		"events": [],
		"updatedAt": "2026-05-08T00:00:00Z"
	}`
	if err := os.WriteFile(input, []byte(project), 0o644); err != nil {
		t.Fatalf("write input: %v", err)
	}

	if err := run([]string{"-input", input, "-output", output}); err != nil {
		t.Fatalf("run returned error: %v", err)
	}

	reader, err := zip.OpenReader(output)
	if err != nil {
		t.Fatalf("open output zip: %v", err)
	}
	defer reader.Close()

	files := map[string]bool{}
	for _, file := range reader.File {
		files[file.Name] = true
	}
	for _, name := range []string{"ui.c", "ui.h", "assets.c", "assets.h", "README.md"} {
		if !files[name] {
			t.Fatalf("expected %s in output zip", name)
		}
	}
}

func TestRunRejectsMissingInputFlag(t *testing.T) {
	err := run([]string{"-output", filepath.Join(t.TempDir(), "ui.zip")})
	if err == nil || !strings.Contains(err.Error(), "missing required -input") {
		t.Fatalf("expected missing input error, got %v", err)
	}
}

func TestRunRejectsProjectDocMissingRequiredArrays(t *testing.T) {
	dir := t.TempDir()
	input := filepath.Join(dir, "project.json")
	output := filepath.Join(dir, "ui.zip")

	project := `{
		"schemaVersion": 1,
		"id": "project-1",
		"name": "CLI Export",
		"theme": "dark",
		"target": {"lvglVersion": "8.3", "deviceName": "Watch 480", "width": 480, "height": 480, "dpi": 326, "colorDepth": 16},
		"screens": [{"id": "screen-1", "name": "Screen_1", "root": {"id": "root-1", "type": "screen", "name": "Screen_1", "parentId": null, "children": [], "layout": {"x": 0, "y": 0, "width": 480, "height": 480}, "props": {}, "style": {}, "locked": false, "hidden": false}}],
		"assets": [],
		"updatedAt": "2026-05-08T00:00:00Z"
	}`
	if err := os.WriteFile(input, []byte(project), 0o644); err != nil {
		t.Fatalf("write input: %v", err)
	}

	err := run([]string{"-input", input, "-output", output})
	if err == nil || !strings.Contains(err.Error(), "ProjectDoc styles is required") {
		t.Fatalf("expected missing styles error, got %v", err)
	}
}

func TestRunRejectsUnknownProjectDocFields(t *testing.T) {
	dir := t.TempDir()
	input := filepath.Join(dir, "project.json")
	output := filepath.Join(dir, "ui.zip")

	project := `{
		"schemaVersion": 1,
		"id": "project-1",
		"name": "CLI Export",
		"theme": "dark",
		"target": {"lvglVersion": "8.3", "deviceName": "Watch 480", "width": 480, "height": 480, "dpi": 326, "colorDepth": 16},
		"screens": [{"id": "screen-1", "name": "Screen_1", "root": {"id": "root-1", "type": "screen", "name": "Screen_1", "parentId": null, "children": [], "layout": {"x": 0, "y": 0, "width": 480, "height": 480, "flex": {"direction": "row", "gap": 4, "wrap": false, "justify": "center"}}, "props": {}, "style": {"shadowColor": "#000000"}, "locked": false, "hidden": false}}],
		"assets": [],
		"styles": [],
		"events": [],
		"updatedAt": "2026-05-08T00:00:00Z"
	}`
	if err := os.WriteFile(input, []byte(project), 0o644); err != nil {
		t.Fatalf("write input: %v", err)
	}

	err := run([]string{"-input", input, "-output", output})
	if err == nil || !strings.Contains(err.Error(), "unknown field") {
		t.Fatalf("expected unknown field error, got %v", err)
	}
}

func TestAssetPathRejectsTraversal(t *testing.T) {
	_, err := assetPath(t.TempDir(), "../secret.png")
	if err == nil {
		t.Fatal("expected traversal object key to be rejected")
	}
}

func TestAssetPathRejectsLocalObjectKey(t *testing.T) {
	_, err := assetPath(t.TempDir(), "local://heart.png")
	if err == nil || !strings.Contains(err.Error(), "local asset objectKey cannot be hydrated") {
		t.Fatalf("expected local asset object key error, got %v", err)
	}
}

func TestHydrateAssetsRejectsObjectKeyOutsideAssetProject(t *testing.T) {
	err := hydrateAssets(t.TempDir(), []codegen.AssetRef{{
		ID:        "asset-1",
		ProjectID: "project-1",
		Name:      "icon.png",
		Kind:      "image",
		ObjectKey: "projects/project-2/assets/asset-1/icon.png",
	}})
	if err == nil || !strings.Contains(err.Error(), "asset objectKey must be under project asset scope") {
		t.Fatalf("expected project scoped object key error, got %v", err)
	}
}
