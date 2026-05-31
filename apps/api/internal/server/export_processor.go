package server

import (
	"context"
	"fmt"
	"time"

	"github.com/hiveton/lvgl-online-editor/apps/api/internal/codegen"
	"github.com/hiveton/lvgl-online-editor/apps/api/internal/jobs"
	"github.com/hiveton/lvgl-online-editor/apps/api/internal/projects"
	"github.com/hiveton/lvgl-online-editor/apps/api/internal/storage"
)

type ExportJobProcessor struct {
	projectRepo projects.Repository
	jobRepo     jobs.Repository
	objectStore storage.Store
}

func NewExportJobProcessor(projectRepo projects.Repository, jobRepo jobs.Repository, objectStore storage.Store) *ExportJobProcessor {
	return &ExportJobProcessor{projectRepo: projectRepo, jobRepo: jobRepo, objectStore: objectStore}
}

func (processor *ExportJobProcessor) Run(ctx context.Context, ownerID string, jobID string) error {
	job, err := processor.jobRepo.Get(ctx, ownerID, jobID)
	if err != nil {
		return err
	}
	project, err := processor.projectRepo.Get(ctx, ownerID, job.ProjectID)
	if err != nil {
		processor.updateFailure(ctx, ownerID, job, "PROJECT_NOT_FOUND", err.Error())
		return err
	}

	now := time.Now().UTC().Format(time.RFC3339)
	job.Logs = append(job.Logs, jobs.LogEntry{Time: now, Level: "info", Message: "Job running"})
	_ = processor.jobRepo.Update(ctx, ownerID, job.ID, jobs.UpdateJobInput{
		Status:   "running",
		Progress: 25,
		Logs:     job.Logs,
	})

	if err := validateProjectDoc(project.Doc, project.ID); err != nil {
		processor.updateFailure(ctx, ownerID, job, "INVALID_PROJECT_DOC", err.Error())
		return err
	}
	doc, err := mapToCodegenProject(project.Doc)
	if err != nil {
		processor.updateFailure(ctx, ownerID, job, "INVALID_PROJECT_DOC", err.Error())
		return err
	}
	if err := processor.hydrateAssetData(ctx, doc.Assets); err != nil {
		processor.updateFailure(ctx, ownerID, job, "ASSET_LOAD_FAILED", err.Error())
		return err
	}
	archive, err := codegen.GenerateCZip(doc)
	if err != nil {
		processor.updateFailure(ctx, ownerID, job, "CODEGEN_FAILED", err.Error())
		return err
	}
	job.Logs = append(job.Logs, jobs.LogEntry{Time: now, Level: "info", Message: "Build completed successfully"})
	objectKey := fmt.Sprintf("jobs/%s/lvgl-export.zip", job.ID)
	if err := processor.objectStore.Put(ctx, objectKey, archive); err != nil {
		processor.updateFailure(ctx, ownerID, job, "OBJECT_STORE_FAILED", err.Error())
		return err
	}
	return processor.jobRepo.Update(ctx, ownerID, job.ID, jobs.UpdateJobInput{
		Status:          "succeeded",
		Progress:        100,
		Logs:            job.Logs,
		ResultObjectKey: objectKey,
	})
}

func (processor *ExportJobProcessor) hydrateAssetData(ctx context.Context, assets []codegen.AssetRef) error {
	for index := range assets {
		if assets[index].Kind != "image" || assets[index].ObjectKey == "" {
			continue
		}
		content, err := processor.objectStore.Get(ctx, assets[index].ObjectKey)
		if err != nil {
			return fmt.Errorf("load asset %s: %w", assets[index].Name, err)
		}
		assets[index].Data = content
	}
	return nil
}

func (processor *ExportJobProcessor) updateFailure(ctx context.Context, ownerID string, job jobs.Job, code string, message string) {
	job.Logs = append(job.Logs, jobs.LogEntry{Time: time.Now().UTC().Format(time.RFC3339), Level: "error", Message: message})
	_ = processor.jobRepo.Update(ctx, ownerID, job.ID, jobs.UpdateJobInput{
		Status:       "failed",
		Progress:     100,
		Logs:         job.Logs,
		ErrorCode:    code,
		ErrorMessage: message,
	})
}
