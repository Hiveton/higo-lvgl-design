package server

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/hiveton/lvgl-online-editor/apps/api/internal/assets"
	"github.com/hiveton/lvgl-online-editor/apps/api/internal/auth"
	"github.com/hiveton/lvgl-online-editor/apps/api/internal/ids"
	"github.com/hiveton/lvgl-online-editor/apps/api/internal/jobs"
	"github.com/hiveton/lvgl-online-editor/apps/api/internal/projects"
	"github.com/hiveton/lvgl-online-editor/apps/api/internal/storage"
	"github.com/hiveton/lvgl-online-editor/apps/api/internal/users"
)

type RepositoryServer struct {
	router      chi.Router
	projectRepo projects.Repository
	assetRepo   assets.Repository
	jobRepo     jobs.Repository
	objectStore storage.Store
	jobRunner   JobRunner
	exporter    *ExportJobProcessor
	userRepo    users.Repository
	tokenSigner auth.TokenSigner
}

const (
	DemoUserID  = "00000000-0000-0000-0000-000000000001"
	OtherUserID = "00000000-0000-0000-0000-000000000002"
)

func NewRepositoryServer(projectRepo projects.Repository, assetRepo assets.Repository, jobRepo jobs.Repository) http.Handler {
	return NewRepositoryServerWithStorage(projectRepo, assetRepo, jobRepo, storage.NewMemoryStore())
}

func NewRepositoryServerWithStorage(projectRepo projects.Repository, assetRepo assets.Repository, jobRepo jobs.Repository, objectStore storage.Store) http.Handler {
	return NewRepositoryServerWithStorageAndRunner(projectRepo, assetRepo, jobRepo, objectStore, inlineJobRunner{})
}

func NewRepositoryServerWithStorageAndRunner(projectRepo projects.Repository, assetRepo assets.Repository, jobRepo jobs.Repository, objectStore storage.Store, jobRunner JobRunner) http.Handler {
	return NewRepositoryServerWithStorageRunnerAndUsers(projectRepo, assetRepo, jobRepo, objectStore, jobRunner, demoUserRepository(), auth.NewTokenSigner("", 24*time.Hour))
}

func NewRepositoryServerWithStorageRunnerAndUsers(projectRepo projects.Repository, assetRepo assets.Repository, jobRepo jobs.Repository, objectStore storage.Store, jobRunner JobRunner, userRepo users.Repository, tokenSigner auth.TokenSigner) http.Handler {
	server := &RepositoryServer{
		router:      chi.NewRouter(),
		projectRepo: projectRepo,
		assetRepo:   assetRepo,
		jobRepo:     jobRepo,
		objectStore: objectStore,
		jobRunner:   jobRunner,
		exporter:    NewExportJobProcessor(projectRepo, jobRepo, objectStore),
		userRepo:    userRepo,
		tokenSigner: tokenSigner,
	}
	server.routes()
	return server.router
}

func (server *RepositoryServer) routes() {
	server.router.Route("/api", func(router chi.Router) {
		router.Post("/auth/login", server.login)
		router.Get("/auth/me", server.me)
		router.Group(func(protected chi.Router) {
			protected.Use(server.requireAuth)
			protected.Get("/projects", server.listProjects)
			protected.Post("/projects", server.createProject)
			protected.Get("/projects/{projectId}", server.getProject)
			protected.Put("/projects/{projectId}/doc", server.saveProjectDoc)
			protected.Post("/projects/{projectId}/versions", server.createProjectVersion)
			protected.Post("/projects/{projectId}/assets", server.uploadAsset)
			protected.Get("/projects/{projectId}/assets", server.listAssets)
			protected.Get("/projects/{projectId}/assets/{assetId}/content", server.downloadAssetContent)
			protected.Delete("/projects/{projectId}/assets/{assetId}", server.deleteAsset)
			protected.Post("/projects/{projectId}/export/c", server.exportProjectC)
			protected.Get("/jobs/{jobId}", server.getJob)
			protected.Get("/jobs/{jobId}/download", server.downloadJobResult)
		})
	})
}

func (server *RepositoryServer) requireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if _, ok := server.userFromRequest(request); !ok {
			writeError(writer, http.StatusUnauthorized, "UNAUTHENTICATED", "missing or invalid token")
			return
		}
		next.ServeHTTP(writer, request)
	})
}

func (server *RepositoryServer) login(writer http.ResponseWriter, request *http.Request) {
	var payload loginRequest
	if err := decodeJSON(request, &payload); err != nil {
		writeError(writer, http.StatusBadRequest, "INVALID_JSON", "invalid request body")
		return
	}
	user, err := server.userRepo.FindByEmail(request.Context(), payload.Email)
	if err != nil || !auth.VerifyPassword(user.PasswordHash, payload.Password) {
		writeError(writer, http.StatusUnauthorized, "UNAUTHENTICATED", "invalid email or password")
		return
	}

	token, err := server.tokenSigner.Issue(user.ID, user.Email, user.DisplayName, time.Now().UTC())
	if err != nil {
		writeError(writer, http.StatusInternalServerError, "TOKEN_ISSUE_FAILED", err.Error())
		return
	}
	writeJSON(writer, http.StatusOK, map[string]any{
		"token": token,
		"user":  userRecord{ID: user.ID, Email: user.Email, DisplayName: user.DisplayName},
	})
}

func (server *RepositoryServer) me(writer http.ResponseWriter, request *http.Request) {
	user, ok := server.userFromRequest(request)
	if !ok {
		writeError(writer, http.StatusUnauthorized, "UNAUTHENTICATED", "missing or invalid token")
		return
	}
	writeJSON(writer, http.StatusOK, user)
}

func (server *RepositoryServer) listProjects(writer http.ResponseWriter, request *http.Request) {
	user, _ := server.userFromRequest(request)
	projectsList, err := server.projectRepo.List(request.Context(), user.ID)
	if err != nil {
		writeError(writer, http.StatusInternalServerError, "PROJECT_LIST_FAILED", err.Error())
		return
	}
	writeJSON(writer, http.StatusOK, map[string]any{"projects": projectsList})
}

func (server *RepositoryServer) createProject(writer http.ResponseWriter, request *http.Request) {
	var payload createProjectRequest
	if err := decodeJSON(request, &payload); err != nil {
		writeError(writer, http.StatusBadRequest, "INVALID_JSON", "invalid request body")
		return
	}
	if strings.TrimSpace(payload.Name) == "" {
		writeError(writer, http.StatusBadRequest, "INVALID_PROJECT_NAME", "project name is required")
		return
	}
	user, _ := server.userFromRequest(request)
	doc := defaultProjectDoc("pending", payload.Name, payload.Target, time.Now().UTC().Format(time.RFC3339))
	project, err := server.projectRepo.Create(request.Context(), user.ID, payload.Name, doc)
	if err != nil {
		writeError(writer, http.StatusInternalServerError, "PROJECT_CREATE_FAILED", err.Error())
		return
	}
	project.Doc["id"] = project.ID
	project.Doc["updatedAt"] = project.UpdatedAt.UTC().Format(time.RFC3339)
	if err := server.projectRepo.SaveDoc(request.Context(), user.ID, project.ID, project.Name, project.Doc); err != nil {
		writeError(writer, http.StatusInternalServerError, "PROJECT_SAVE_FAILED", err.Error())
		return
	}
	writeJSON(writer, http.StatusCreated, map[string]any{"project": project})
}

func (server *RepositoryServer) getProject(writer http.ResponseWriter, request *http.Request) {
	user, _ := server.userFromRequest(request)
	project, err := server.projectRepo.Get(request.Context(), user.ID, chi.URLParam(request, "projectId"))
	if err != nil {
		writeRepositoryNotFound(writer, err, "PROJECT_NOT_FOUND", "project not found")
		return
	}
	writeJSON(writer, http.StatusOK, map[string]any{"project": project})
}

func (server *RepositoryServer) saveProjectDoc(writer http.ResponseWriter, request *http.Request) {
	var payload saveDocRequest
	if err := decodeJSON(request, &payload); err != nil {
		writeError(writer, http.StatusBadRequest, "INVALID_JSON", "invalid request body")
		return
	}
	if len(payload.Doc) == 0 {
		writeError(writer, http.StatusBadRequest, "INVALID_PROJECT_DOC", "doc is required")
		return
	}
	user, _ := server.userFromRequest(request)
	projectID := chi.URLParam(request, "projectId")
	if _, err := server.projectRepo.Get(request.Context(), user.ID, projectID); err != nil {
		writeRepositoryNotFound(writer, err, "PROJECT_NOT_FOUND", "project not found")
		return
	}
	if err := validateProjectDoc(payload.Doc, projectID); err != nil {
		writeError(writer, http.StatusBadRequest, "INVALID_PROJECT_DOC", err.Error())
		return
	}
	name := stringValue(payload.Doc["name"], "Untitled LVGL UI")
	if err := server.projectRepo.SaveDoc(request.Context(), user.ID, projectID, name, payload.Doc); err != nil {
		writeRepositoryNotFound(writer, err, "PROJECT_NOT_FOUND", "project not found")
		return
	}
	writeJSON(writer, http.StatusOK, map[string]any{
		"projectId": projectID,
		"updatedAt": time.Now().UTC().Format(time.RFC3339),
	})
}

func (server *RepositoryServer) createProjectVersion(writer http.ResponseWriter, request *http.Request) {
	var payload createVersionRequest
	if request.Body != nil {
		if err := decodeJSON(request, &payload); err != nil && !errors.Is(err, io.EOF) {
			writeError(writer, http.StatusBadRequest, "INVALID_JSON", "invalid request body")
			return
		}
	}
	user, _ := server.userFromRequest(request)
	projectID := chi.URLParam(request, "projectId")
	project, err := server.projectRepo.Get(request.Context(), user.ID, projectID)
	if err != nil {
		writeRepositoryNotFound(writer, err, "PROJECT_NOT_FOUND", "project not found")
		return
	}
	version, err := server.projectRepo.CreateVersion(request.Context(), user.ID, projectID, payload.versionName(), project.Doc)
	if err != nil {
		writeRepositoryNotFound(writer, err, "PROJECT_NOT_FOUND", "project not found")
		return
	}
	writeJSON(writer, http.StatusCreated, map[string]any{"version": version})
}

func (server *RepositoryServer) uploadAsset(writer http.ResponseWriter, request *http.Request) {
	user, _ := server.userFromRequest(request)
	projectID := chi.URLParam(request, "projectId")
	if _, err := server.projectRepo.Get(request.Context(), user.ID, projectID); err != nil {
		writeRepositoryNotFound(writer, err, "PROJECT_NOT_FOUND", "project not found")
		return
	}
	if err := request.ParseMultipartForm(5 << 20); err != nil {
		writeError(writer, http.StatusBadRequest, "INVALID_MULTIPART", "invalid multipart form")
		return
	}
	file, header, err := request.FormFile("file")
	if err != nil {
		writeError(writer, http.StatusBadRequest, "ASSET_FILE_REQUIRED", "asset file is required")
		return
	}
	defer file.Close()
	content, err := io.ReadAll(io.LimitReader(file, 5<<20+1))
	if err != nil {
		writeError(writer, http.StatusBadRequest, "ASSET_READ_FAILED", "asset file could not be read")
		return
	}
	if len(content) > 5<<20 {
		writeError(writer, http.StatusBadRequest, "ASSET_TOO_LARGE", "asset file is too large")
		return
	}
	kind, mimeType, supported := classifyUploadedAsset(header.Filename, request.FormValue("kind"), http.DetectContentType(content))
	if !supported {
		writeError(writer, http.StatusBadRequest, "UNSUPPORTED_ASSET_TYPE", "only PNG, JPG, TTF, OTF, WOFF and WOFF2 assets are supported")
		return
	}
	width, height := 0, 0
	if kind == "image" {
		width, height = imageDimensions(content)
	}
	objectKey := fmt.Sprintf("projects/%s/assets/%s/%s", projectID, ids.NewUUID(), header.Filename)
	if err := server.objectStore.Put(request.Context(), objectKey, content); err != nil {
		writeError(writer, http.StatusInternalServerError, "ASSET_STORE_FAILED", err.Error())
		return
	}
	asset, err := server.assetRepo.Create(request.Context(), assets.CreateAssetInput{
		ProjectID: projectID,
		OwnerID:   user.ID,
		Name:      header.Filename,
		Kind:      kind,
		MimeType:  mimeType,
		Width:     width,
		Height:    height,
		SizeBytes: int64(len(content)),
		ObjectKey: objectKey,
	})
	if err != nil {
		writeError(writer, http.StatusInternalServerError, "ASSET_CREATE_FAILED", err.Error())
		return
	}
	writeJSON(writer, http.StatusCreated, map[string]any{"asset": asset})
}

func (server *RepositoryServer) listAssets(writer http.ResponseWriter, request *http.Request) {
	user, _ := server.userFromRequest(request)
	projectID := chi.URLParam(request, "projectId")
	if _, err := server.projectRepo.Get(request.Context(), user.ID, projectID); err != nil {
		writeRepositoryNotFound(writer, err, "PROJECT_NOT_FOUND", "project not found")
		return
	}
	assetsList, err := server.assetRepo.List(request.Context(), user.ID, projectID)
	if err != nil {
		writeError(writer, http.StatusInternalServerError, "ASSET_LIST_FAILED", err.Error())
		return
	}
	if assetsList == nil {
		assetsList = []assets.Asset{}
	}
	writeJSON(writer, http.StatusOK, map[string]any{"assets": assetsList})
}

func (server *RepositoryServer) downloadAssetContent(writer http.ResponseWriter, request *http.Request) {
	user, _ := server.userFromRequest(request)
	projectID := chi.URLParam(request, "projectId")
	if _, err := server.projectRepo.Get(request.Context(), user.ID, projectID); err != nil {
		writeRepositoryNotFound(writer, err, "PROJECT_NOT_FOUND", "project not found")
		return
	}
	assetID := chi.URLParam(request, "assetId")
	assetsList, err := server.assetRepo.List(request.Context(), user.ID, projectID)
	if err != nil {
		writeError(writer, http.StatusInternalServerError, "ASSET_LIST_FAILED", err.Error())
		return
	}
	for _, asset := range assetsList {
		if asset.ID != assetID {
			continue
		}
		content, err := server.objectStore.Get(request.Context(), asset.ObjectKey)
		if err != nil {
			writeRepositoryNotFound(writer, err, "ASSET_CONTENT_NOT_FOUND", "asset content not found")
			return
		}
		writer.Header().Set("Content-Type", asset.MimeType)
		writer.Header().Set("Content-Disposition", fmt.Sprintf(`inline; filename="%s"`, asset.Name))
		writer.WriteHeader(http.StatusOK)
		_, _ = writer.Write(content)
		return
	}
	writeError(writer, http.StatusNotFound, "ASSET_NOT_FOUND", "asset not found")
}

func (server *RepositoryServer) deleteAsset(writer http.ResponseWriter, request *http.Request) {
	user, _ := server.userFromRequest(request)
	projectID := chi.URLParam(request, "projectId")
	if _, err := server.projectRepo.Get(request.Context(), user.ID, projectID); err != nil {
		writeRepositoryNotFound(writer, err, "PROJECT_NOT_FOUND", "project not found")
		return
	}
	assetID := chi.URLParam(request, "assetId")
	assetsList, err := server.assetRepo.List(request.Context(), user.ID, projectID)
	if err != nil {
		writeError(writer, http.StatusInternalServerError, "ASSET_LIST_FAILED", err.Error())
		return
	}
	var objectKey string
	for _, asset := range assetsList {
		if asset.ID == assetID {
			objectKey = asset.ObjectKey
			break
		}
	}
	project, err := server.projectRepo.Get(request.Context(), user.ID, projectID)
	if err != nil {
		writeRepositoryNotFound(writer, err, "PROJECT_NOT_FOUND", "project not found")
		return
	}
	if projectDocReferencesAsset(project.Doc, assetID) {
		writeError(writer, http.StatusConflict, "ASSET_IN_USE", "asset is used by image widget")
		return
	}
	if err := server.assetRepo.Delete(request.Context(), user.ID, projectID, assetID); err != nil {
		writeRepositoryNotFound(writer, err, "ASSET_NOT_FOUND", "asset not found")
		return
	}
	if objectKey != "" {
		_ = server.objectStore.Delete(request.Context(), objectKey)
	}
	writeJSON(writer, http.StatusOK, map[string]any{"deleted": true})
}

func (server *RepositoryServer) exportProjectC(writer http.ResponseWriter, request *http.Request) {
	user, _ := server.userFromRequest(request)
	projectID := chi.URLParam(request, "projectId")
	project, err := server.projectRepo.Get(request.Context(), user.ID, projectID)
	if err != nil {
		writeRepositoryNotFound(writer, err, "PROJECT_NOT_FOUND", "project not found")
		return
	}
	_, _ = server.projectRepo.CreateVersion(request.Context(), user.ID, projectID, "Build snapshot", project.Doc)
	now := time.Now().UTC().Format(time.RFC3339)
	job, err := server.jobRepo.Create(request.Context(), jobs.CreateJobInput{
		OwnerID:   user.ID,
		ProjectID: projectID,
		Kind:      "export_c",
		Logs: []jobs.LogEntry{
			{Time: now, Level: "info", Message: "Build started"},
			{Time: now, Level: "info", Message: "Generating code"},
		},
	})
	if err != nil {
		writeError(writer, http.StatusInternalServerError, "JOB_CREATE_FAILED", err.Error())
		return
	}

	if err := server.jobRunner.EnqueueExport(user.ID, job.ID, func() {
		_ = server.exporter.Run(context.Background(), user.ID, job.ID)
	}); err != nil {
		server.exporter.updateFailure(context.Background(), user.ID, job, "JOB_QUEUE_FAILED", err.Error())
		writeJSON(writer, http.StatusAccepted, map[string]any{"jobId": job.ID})
		return
	}

	writeJSON(writer, http.StatusAccepted, map[string]any{"jobId": job.ID})
}

func (server *RepositoryServer) getJob(writer http.ResponseWriter, request *http.Request) {
	user, _ := server.userFromRequest(request)
	job, err := server.jobRepo.Get(request.Context(), user.ID, chi.URLParam(request, "jobId"))
	if err != nil {
		writeRepositoryNotFound(writer, err, "JOB_NOT_FOUND", "job not found")
		return
	}
	writeJSON(writer, http.StatusOK, map[string]any{"job": repositoryJobResponse(job)})
}

func (server *RepositoryServer) downloadJobResult(writer http.ResponseWriter, request *http.Request) {
	user, _ := server.userFromRequest(request)
	jobID := chi.URLParam(request, "jobId")
	job, err := server.jobRepo.Get(request.Context(), user.ID, jobID)
	if err != nil {
		writeRepositoryNotFound(writer, err, "JOB_NOT_FOUND", "job not found")
		return
	}
	if job.ResultObjectKey == "" {
		writeError(writer, http.StatusNotFound, "JOB_RESULT_NOT_FOUND", "job result not found")
		return
	}
	archive, err := server.objectStore.Get(request.Context(), job.ResultObjectKey)
	if err != nil {
		writeRepositoryNotFound(writer, err, "JOB_RESULT_NOT_FOUND", "job result not found")
		return
	}
	writer.Header().Set("Content-Type", "application/zip")
	writer.Header().Set("Content-Disposition", `attachment; filename="lvgl-export.zip"`)
	writer.WriteHeader(http.StatusOK)
	_, _ = writer.Write(archive)
}

func (server *RepositoryServer) userFromRequest(request *http.Request) (userRecord, bool) {
	header := request.Header.Get("Authorization")
	token, ok := strings.CutPrefix(header, "Bearer ")
	if !ok || token == "" {
		return userRecord{}, false
	}
	claims, err := server.tokenSigner.Verify(token, time.Now().UTC())
	if err != nil {
		return userRecord{}, false
	}
	return userRecord{ID: claims.ID, Email: claims.Email, DisplayName: claims.DisplayName}, true
}

func repositoryJobResponse(job jobs.Job) map[string]any {
	response := map[string]any{
		"id":        job.ID,
		"projectId": job.ProjectID,
		"kind":      job.Kind,
		"status":    job.Status,
		"progress":  job.Progress,
		"logs":      job.Logs,
	}
	if job.ResultObjectKey != "" {
		response["result"] = map[string]any{
			"downloadUrl": fmt.Sprintf("/api/jobs/%s/download", job.ID),
		}
	}
	if job.ErrorCode != "" || job.ErrorMessage != "" {
		response["error"] = map[string]any{
			"code":    job.ErrorCode,
			"message": job.ErrorMessage,
		}
	}
	return response
}

func imageDimensions(content []byte) (int, int) {
	config, _, err := image.DecodeConfig(bytes.NewReader(content))
	if err != nil {
		return 0, 0
	}
	return config.Width, config.Height
}

func classifyUploadedAsset(filename string, requestedKind string, detectedMimeType string) (string, string, bool) {
	if detectedMimeType == "image/png" || detectedMimeType == "image/jpeg" {
		return "image", detectedMimeType, true
	}
	if strings.TrimSpace(requestedKind) == "font" {
		if mimeType, ok := fontMimeTypeForName(filename); ok {
			return "font", mimeType, true
		}
	}
	return "", "", false
}

func fontMimeTypeForName(filename string) (string, bool) {
	name := strings.ToLower(filename)
	switch {
	case strings.HasSuffix(name, ".ttf"):
		return "font/ttf", true
	case strings.HasSuffix(name, ".otf"):
		return "font/otf", true
	case strings.HasSuffix(name, ".woff"):
		return "font/woff", true
	case strings.HasSuffix(name, ".woff2"):
		return "font/woff2", true
	default:
		return "", false
	}
}

func decodeJSON(request *http.Request, target any) error {
	return json.NewDecoder(request.Body).Decode(target)
}

func stringValue(value any, fallback string) string {
	text, ok := value.(string)
	if !ok || strings.TrimSpace(text) == "" {
		return fallback
	}
	return text
}

func writeRepositoryNotFound(writer http.ResponseWriter, err error, code string, message string) {
	if errors.Is(err, projects.ErrNotFound) || errors.Is(err, assets.ErrNotFound) || errors.Is(err, jobs.ErrNotFound) || errors.Is(err, storage.ErrNotFound) {
		writeError(writer, http.StatusNotFound, code, message)
		return
	}
	writeError(writer, http.StatusInternalServerError, code, err.Error())
}
