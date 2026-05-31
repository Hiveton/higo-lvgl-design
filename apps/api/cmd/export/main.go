package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/hiveton/lvgl-online-editor/apps/api/internal/codegen"
)

type options struct {
	input     string
	output    string
	assetRoot string
}

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintf(os.Stderr, "export failed: %v\n", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	opts, err := parseOptions(args)
	if err != nil {
		return err
	}

	docContent, err := os.ReadFile(opts.input)
	if err != nil {
		return fmt.Errorf("read input: %w", err)
	}

	var doc codegen.ProjectDoc
	decoder := json.NewDecoder(bytes.NewReader(docContent))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&doc); err != nil {
		return fmt.Errorf("parse ProjectDoc JSON: %w", err)
	}

	if opts.assetRoot != "" {
		if err := hydrateAssets(opts.assetRoot, doc.Assets); err != nil {
			return err
		}
	}

	archive, err := codegen.GenerateCZip(doc)
	if err != nil {
		return fmt.Errorf("generate LVGL C zip: %w", err)
	}

	if err := os.MkdirAll(filepath.Dir(opts.output), 0o755); err != nil {
		return fmt.Errorf("create output directory: %w", err)
	}
	if err := os.WriteFile(opts.output, archive, 0o644); err != nil {
		return fmt.Errorf("write output: %w", err)
	}

	fmt.Printf("wrote %s\n", opts.output)
	return nil
}

func parseOptions(args []string) (options, error) {
	flags := flag.NewFlagSet("export", flag.ContinueOnError)
	flags.SetOutput(os.Stderr)

	var opts options
	flags.StringVar(&opts.input, "input", "", "ProjectDoc JSON input path")
	flags.StringVar(&opts.output, "output", "", "LVGL C zip output path")
	flags.StringVar(&opts.assetRoot, "asset-root", "", "optional local root for asset objectKey files")

	if err := flags.Parse(args); err != nil {
		return options{}, err
	}
	if opts.input == "" {
		return options{}, errors.New("missing required -input")
	}
	if opts.output == "" {
		return options{}, errors.New("missing required -output")
	}

	return opts, nil
}

func hydrateAssets(root string, assets []codegen.AssetRef) error {
	for index := range assets {
		if assets[index].Kind != "image" || assets[index].ObjectKey == "" {
			continue
		}
		if !strings.HasPrefix(assets[index].ObjectKey, fmt.Sprintf("projects/%s/assets/", assets[index].ProjectID)) {
			return fmt.Errorf("asset objectKey must be under project asset scope: %s", assets[index].ID)
		}
		path, err := assetPath(root, assets[index].ObjectKey)
		if err != nil {
			return err
		}
		content, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("read asset %s: %w", assets[index].ObjectKey, err)
		}
		assets[index].Data = content
	}
	return nil
}

func assetPath(root string, objectKey string) (string, error) {
	if strings.HasPrefix(objectKey, "local://") {
		return "", fmt.Errorf("local asset objectKey cannot be hydrated: %s", objectKey)
	}
	if filepath.IsAbs(objectKey) {
		return "", fmt.Errorf("invalid absolute asset objectKey: %s", objectKey)
	}
	cleanKey := filepath.Clean(filepath.FromSlash(objectKey))
	if cleanKey == "." || cleanKey == ".." || len(cleanKey) >= 3 && cleanKey[:3] == ".."+string(filepath.Separator) || filepath.IsAbs(cleanKey) {
		return "", fmt.Errorf("invalid asset objectKey: %s", objectKey)
	}
	return filepath.Join(root, cleanKey), nil
}
