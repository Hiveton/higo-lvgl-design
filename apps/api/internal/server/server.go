package server

import (
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/hiveton/lvgl-online-editor/apps/api/internal/auth"
	"github.com/hiveton/lvgl-online-editor/apps/api/internal/codegen"
	"github.com/hiveton/lvgl-online-editor/apps/api/internal/users"
)

type Server struct {
	router        chi.Router
	mu            sync.RWMutex
	projects      map[string]projectRecord
	versions      map[string][]projectVersionRecord
	jobs          map[string]jobRecord
	assets        map[string][]assetRecord
	userRepo      users.Repository
	tokenSigner   auth.TokenSigner
	nextID        int
	nextVersionID int
	nextJobID     int
	nextAssetID   int
}

type projectRecord struct {
	ID        string         `json:"id"`
	OwnerID   string         `json:"-"`
	Name      string         `json:"name"`
	Doc       map[string]any `json:"doc"`
	CreatedAt string         `json:"createdAt"`
	UpdatedAt string         `json:"updatedAt"`
}

type createProjectRequest struct {
	Name   string         `json:"name"`
	Target map[string]any `json:"target"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type userRecord struct {
	ID          string `json:"id"`
	Email       string `json:"email"`
	DisplayName string `json:"displayName"`
}

type saveDocRequest struct {
	Doc map[string]any `json:"doc"`
}

type createVersionRequest struct {
	Name  string `json:"name"`
	Label string `json:"label"`
}

type exportProjectRequest struct {
	CreateVersion *bool `json:"createVersion"`
}

type projectVersionRecord struct {
	ID        string         `json:"id"`
	ProjectID string         `json:"projectId"`
	Name      string         `json:"name"`
	Label     string         `json:"label"`
	Doc       map[string]any `json:"doc"`
	CreatedAt string         `json:"createdAt"`
}

type jobRecord struct {
	ID       string         `json:"id"`
	OwnerID  string         `json:"-"`
	Kind     string         `json:"kind"`
	Status   string         `json:"status"`
	Progress int            `json:"progress"`
	Logs     []jobLog       `json:"logs"`
	Result   map[string]any `json:"result,omitempty"`
	Error    map[string]any `json:"error,omitempty"`
	Archive  []byte         `json:"-"`
}

type jobLog struct {
	Time    string `json:"time"`
	Level   string `json:"level"`
	Message string `json:"message"`
}

type assetRecord struct {
	ID        string `json:"id"`
	ProjectID string `json:"projectId"`
	Name      string `json:"name"`
	Kind      string `json:"kind"`
	MimeType  string `json:"mimeType"`
	Width     int    `json:"width,omitempty"`
	Height    int    `json:"height,omitempty"`
	SizeBytes int64  `json:"sizeBytes"`
	ObjectKey string `json:"objectKey"`
	CreatedAt string `json:"createdAt"`
	Content   []byte `json:"-"`
}

func NewInMemoryServer() http.Handler {
	server := &Server{
		router:        chi.NewRouter(),
		projects:      map[string]projectRecord{},
		versions:      map[string][]projectVersionRecord{},
		jobs:          map[string]jobRecord{},
		assets:        map[string][]assetRecord{},
		userRepo:      demoUserRepository(),
		tokenSigner:   auth.NewTokenSigner("", 24*time.Hour),
		nextID:        1,
		nextVersionID: 1,
		nextJobID:     1,
		nextAssetID:   1,
	}
	server.routes()
	return server.router
}

func (server *Server) routes() {
	server.router.Route("/api", func(router chi.Router) {
		router.Get("/health", health)
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

func (server *Server) requireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if _, ok := server.userFromRequest(request); !ok {
			writeError(writer, http.StatusUnauthorized, "UNAUTHENTICATED", "missing or invalid token")
			return
		}
		next.ServeHTTP(writer, request)
	})
}

func (server *Server) login(writer http.ResponseWriter, request *http.Request) {
	var payload loginRequest
	if err := decodeJSON(request, &payload); err != nil {
		writeError(writer, http.StatusBadRequest, "INVALID_JSON", "invalid request body")
		return
	}
	if err := validateLoginRequest(payload); err != nil {
		writeError(writer, http.StatusBadRequest, "INVALID_LOGIN_REQUEST", err.Error())
		return
	}
	user, err := server.userRepo.FindByEmail(request.Context(), payload.Email)
	if err != nil || !auth.VerifyPassword(user.PasswordHash, payload.Password) {
		writeError(writer, http.StatusUnauthorized, "INVALID_CREDENTIALS", "invalid email or password")
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

func (server *Server) me(writer http.ResponseWriter, request *http.Request) {
	user, ok := server.userFromRequest(request)
	if !ok {
		writeError(writer, http.StatusUnauthorized, "UNAUTHENTICATED", "missing or invalid token")
		return
	}
	writeJSON(writer, http.StatusOK, user)
}

func validateLoginRequest(payload loginRequest) error {
	if strings.TrimSpace(payload.Email) == "" {
		return fmt.Errorf("email is required")
	}
	if strings.TrimSpace(payload.Password) == "" {
		return fmt.Errorf("password is required")
	}
	return nil
}

func (server *Server) listProjects(writer http.ResponseWriter, request *http.Request) {
	user, _ := server.userFromRequest(request)
	server.mu.RLock()
	defer server.mu.RUnlock()

	projects := make([]projectRecord, 0, len(server.projects))
	for _, project := range server.projects {
		if project.OwnerID == user.ID {
			projects = append(projects, project)
		}
	}
	writeJSON(writer, http.StatusOK, map[string]any{"projects": projects})
}

func (server *Server) createProject(writer http.ResponseWriter, request *http.Request) {
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

	server.mu.Lock()
	defer server.mu.Unlock()

	id := fmt.Sprintf("project-%d", server.nextID)
	server.nextID++
	now := time.Now().UTC().Format(time.RFC3339)
	doc := defaultProjectDoc(id, payload.Name, payload.Target, now)
	if err := validateProjectDoc(doc, id); err != nil {
		writeError(writer, http.StatusBadRequest, "INVALID_PROJECT_DOC", err.Error())
		return
	}
	project := projectRecord{
		ID:        id,
		OwnerID:   user.ID,
		Name:      payload.Name,
		Doc:       doc,
		CreatedAt: now,
		UpdatedAt: now,
	}
	server.projects[id] = project

	writeJSON(writer, http.StatusCreated, map[string]any{"project": project})
}

func (server *Server) getProject(writer http.ResponseWriter, request *http.Request) {
	project, ok := server.findProjectForRequest(request, chi.URLParam(request, "projectId"))
	if !ok {
		writeError(writer, http.StatusNotFound, "PROJECT_NOT_FOUND", "project not found")
		return
	}
	writeJSON(writer, http.StatusOK, map[string]any{"project": project})
}

func (server *Server) saveProjectDoc(writer http.ResponseWriter, request *http.Request) {
	projectID := chi.URLParam(request, "projectId")
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

	server.mu.Lock()
	defer server.mu.Unlock()

	project, ok := server.projects[projectID]
	if !ok || project.OwnerID != user.ID {
		writeError(writer, http.StatusNotFound, "PROJECT_NOT_FOUND", "project not found")
		return
	}
	if err := validateProjectDoc(payload.Doc, projectID); err != nil {
		writeError(writer, http.StatusBadRequest, "INVALID_PROJECT_DOC", err.Error())
		return
	}
	now := time.Now().UTC().Format(time.RFC3339)
	project.Doc = payload.Doc
	project.UpdatedAt = now
	server.projects[projectID] = project

	writeJSON(writer, http.StatusOK, map[string]any{"projectId": projectID, "updatedAt": now})
}

func (server *Server) createProjectVersion(writer http.ResponseWriter, request *http.Request) {
	projectID := chi.URLParam(request, "projectId")
	var payload createVersionRequest
	if request.Body != nil {
		if err := decodeJSON(request, &payload); err != nil && err != io.EOF {
			writeError(writer, http.StatusBadRequest, "INVALID_JSON", "invalid request body")
			return
		}
	}
	user, _ := server.userFromRequest(request)

	server.mu.Lock()
	defer server.mu.Unlock()

	project, ok := server.projects[projectID]
	if !ok || project.OwnerID != user.ID {
		writeError(writer, http.StatusNotFound, "PROJECT_NOT_FOUND", "project not found")
		return
	}
	version := server.snapshotProjectVersion(project, payload.versionName())
	writeJSON(writer, http.StatusCreated, map[string]any{"version": version})
}

func (server *Server) uploadAsset(writer http.ResponseWriter, request *http.Request) {
	projectID := chi.URLParam(request, "projectId")
	user, _ := server.userFromRequest(request)

	server.mu.Lock()
	defer server.mu.Unlock()

	project, ok := server.projects[projectID]
	if !ok || project.OwnerID != user.ID {
		writeError(writer, http.StatusNotFound, "PROJECT_NOT_FOUND", "project not found")
		return
	}

	if err := request.ParseMultipartForm(5 << 20); err != nil {
		writeError(writer, http.StatusBadRequest, "INVALID_MULTIPART", "invalid multipart form")
		return
	}
	if err := validateAssetUploadMultipartForm(request); err != nil {
		writeError(writer, http.StatusBadRequest, "INVALID_MULTIPART", err.Error())
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

	assetID := fmt.Sprintf("asset-%d", server.nextAssetID)
	server.nextAssetID++
	now := time.Now().UTC().Format(time.RFC3339)
	asset := assetRecord{
		ID:        assetID,
		ProjectID: projectID,
		Name:      header.Filename,
		Kind:      kind,
		MimeType:  mimeType,
		Width:     width,
		Height:    height,
		SizeBytes: int64(len(content)),
		ObjectKey: fmt.Sprintf("projects/%s/assets/%s/%s", projectID, assetID, header.Filename),
		CreatedAt: now,
		Content:   append([]byte(nil), content...),
	}
	server.assets[projectID] = append(server.assets[projectID], asset)

	writeJSON(writer, http.StatusCreated, map[string]any{"asset": asset})
}

func (server *Server) listAssets(writer http.ResponseWriter, request *http.Request) {
	projectID := chi.URLParam(request, "projectId")
	user, _ := server.userFromRequest(request)

	server.mu.RLock()
	defer server.mu.RUnlock()

	project, ok := server.projects[projectID]
	if !ok || project.OwnerID != user.ID {
		writeError(writer, http.StatusNotFound, "PROJECT_NOT_FOUND", "project not found")
		return
	}
	assetsList := server.assets[projectID]
	if assetsList == nil {
		assetsList = []assetRecord{}
	}
	writeJSON(writer, http.StatusOK, map[string]any{"assets": assetsList})
}

func (server *Server) downloadAssetContent(writer http.ResponseWriter, request *http.Request) {
	projectID := chi.URLParam(request, "projectId")
	assetID := chi.URLParam(request, "assetId")
	user, _ := server.userFromRequest(request)

	server.mu.RLock()
	defer server.mu.RUnlock()

	project, ok := server.projects[projectID]
	if !ok || project.OwnerID != user.ID {
		writeError(writer, http.StatusNotFound, "PROJECT_NOT_FOUND", "project not found")
		return
	}
	for _, asset := range server.assets[projectID] {
		if asset.ID != assetID {
			continue
		}
		writer.Header().Set("Content-Type", asset.MimeType)
		writer.Header().Set("Content-Disposition", fmt.Sprintf(`inline; filename="%s"`, asset.Name))
		writer.WriteHeader(http.StatusOK)
		_, _ = writer.Write(asset.Content)
		return
	}
	writeError(writer, http.StatusNotFound, "ASSET_NOT_FOUND", "asset not found")
}

func (server *Server) deleteAsset(writer http.ResponseWriter, request *http.Request) {
	projectID := chi.URLParam(request, "projectId")
	assetID := chi.URLParam(request, "assetId")
	user, _ := server.userFromRequest(request)

	server.mu.Lock()
	defer server.mu.Unlock()

	project, ok := server.projects[projectID]
	if !ok || project.OwnerID != user.ID {
		writeError(writer, http.StatusNotFound, "PROJECT_NOT_FOUND", "project not found")
		return
	}
	assets := server.assets[projectID]
	for index, asset := range assets {
		if asset.ID == assetID {
			if projectDocReferencesAsset(project.Doc, assetID) {
				writeError(writer, http.StatusConflict, "ASSET_IN_USE", "asset is still referenced by ProjectDoc")
				return
			}
			server.assets[projectID] = append(assets[:index], assets[index+1:]...)
			writeJSON(writer, http.StatusOK, map[string]any{"deleted": true})
			return
		}
	}
	writeError(writer, http.StatusNotFound, "ASSET_NOT_FOUND", "asset not found")
}

func (server *Server) exportProjectC(writer http.ResponseWriter, request *http.Request) {
	projectID := chi.URLParam(request, "projectId")
	user, _ := server.userFromRequest(request)
	createVersion, err := shouldCreateExportVersion(request)
	if err != nil {
		writeError(writer, http.StatusBadRequest, "INVALID_JSON", "invalid request body")
		return
	}

	server.mu.Lock()
	defer server.mu.Unlock()

	project, ok := server.projects[projectID]
	if !ok || project.OwnerID != user.ID {
		writeError(writer, http.StatusNotFound, "PROJECT_NOT_FOUND", "project not found")
		return
	}
	if createVersion {
		server.snapshotProjectVersion(project, "Build snapshot")
	}

	jobID := fmt.Sprintf("job-%d", server.nextJobID)
	server.nextJobID++
	now := time.Now().UTC().Format(time.RFC3339)
	job := jobRecord{
		ID:       jobID,
		OwnerID:  user.ID,
		Kind:     "export_c",
		Status:   "running",
		Progress: 50,
		Logs: []jobLog{
			{Time: now, Level: "info", Message: "Build started"},
			{Time: now, Level: "info", Message: "Generating code"},
		},
	}

	doc, err := mapToCodegenProject(project.Doc)
	if err != nil {
		job.Status = "failed"
		job.Error = map[string]any{"code": "INVALID_PROJECT_DOC", "message": err.Error()}
		server.jobs[jobID] = job
		writeJSON(writer, http.StatusAccepted, map[string]any{"jobId": jobID})
		return
	}
	if err := server.hydrateInMemoryAssetData(projectID, doc.Assets); err != nil {
		job.Status = "failed"
		job.Progress = 100
		job.Error = map[string]any{"code": "ASSET_LOAD_FAILED", "message": err.Error()}
		job.Logs = append(job.Logs, jobLog{Time: now, Level: "error", Message: err.Error()})
		server.jobs[jobID] = job
		writeJSON(writer, http.StatusAccepted, map[string]any{"jobId": jobID})
		return
	}
	archive, err := codegen.GenerateCZip(doc)
	if err != nil {
		job.Status = "failed"
		job.Error = map[string]any{"code": "CODEGEN_FAILED", "message": err.Error()}
		server.jobs[jobID] = job
		writeJSON(writer, http.StatusAccepted, map[string]any{"jobId": jobID})
		return
	}

	job.Status = "succeeded"
	job.Progress = 100
	job.Logs = append(job.Logs, jobLog{Time: now, Level: "info", Message: "Build completed successfully"})
	job.Result = map[string]any{
		"downloadUrl": fmt.Sprintf("/api/jobs/%s/download", jobID),
	}
	job.Archive = archive
	server.jobs[jobID] = job

	writeJSON(writer, http.StatusAccepted, map[string]any{"jobId": jobID})
}

func (server *Server) hydrateInMemoryAssetData(projectID string, assets []codegen.AssetRef) error {
	assetsByObjectKey := map[string][]byte{}
	for _, asset := range server.assets[projectID] {
		assetsByObjectKey[asset.ObjectKey] = asset.Content
	}
	for index := range assets {
		if assets[index].Kind != "image" || assets[index].ObjectKey == "" {
			continue
		}
		if content, ok := assetsByObjectKey[assets[index].ObjectKey]; ok {
			assets[index].Data = append([]byte(nil), content...)
			continue
		}
		return fmt.Errorf("load asset %s: asset content not found", assets[index].Name)
	}
	return nil
}

func (server *Server) getJob(writer http.ResponseWriter, request *http.Request) {
	jobID := chi.URLParam(request, "jobId")
	user, _ := server.userFromRequest(request)

	server.mu.RLock()
	defer server.mu.RUnlock()

	job, ok := server.jobs[jobID]
	if !ok || job.OwnerID != user.ID {
		writeError(writer, http.StatusNotFound, "JOB_NOT_FOUND", "job not found")
		return
	}

	writeJSON(writer, http.StatusOK, map[string]any{"job": job})
}

func (server *Server) downloadJobResult(writer http.ResponseWriter, request *http.Request) {
	jobID := chi.URLParam(request, "jobId")
	user, _ := server.userFromRequest(request)

	server.mu.RLock()
	defer server.mu.RUnlock()

	job, ok := server.jobs[jobID]
	if !ok || job.OwnerID != user.ID {
		writeError(writer, http.StatusNotFound, "JOB_NOT_FOUND", "job not found")
		return
	}
	if job.Status != "succeeded" || len(job.Archive) == 0 {
		writeError(writer, http.StatusNotFound, "JOB_RESULT_NOT_FOUND", "job result not found")
		return
	}

	writer.Header().Set("Content-Type", "application/zip")
	writer.Header().Set("Content-Disposition", `attachment; filename="lvgl-export.zip"`)
	writer.WriteHeader(http.StatusOK)
	_, _ = writer.Write(job.Archive)
}

func (server *Server) findProjectForRequest(request *http.Request, id string) (projectRecord, bool) {
	user, _ := server.userFromRequest(request)
	server.mu.RLock()
	defer server.mu.RUnlock()
	project, ok := server.projects[id]
	if !ok || project.OwnerID != user.ID {
		return projectRecord{}, false
	}
	return project, true
}

func (server *Server) snapshotProjectVersion(project projectRecord, label string) projectVersionRecord {
	if strings.TrimSpace(label) == "" {
		label = "Snapshot"
	}
	version := projectVersionRecord{
		ID:        fmt.Sprintf("version-%d", server.nextVersionID),
		ProjectID: project.ID,
		Name:      label,
		Label:     label,
		Doc:       cloneMap(project.Doc),
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
	}
	server.nextVersionID++
	server.versions[project.ID] = append(server.versions[project.ID], version)
	return version
}

func (request createVersionRequest) versionName() string {
	if strings.TrimSpace(request.Name) != "" {
		return strings.TrimSpace(request.Name)
	}
	return strings.TrimSpace(request.Label)
}

func shouldCreateExportVersion(request *http.Request) (bool, error) {
	if request.Body == nil {
		return true, nil
	}
	defer request.Body.Close()
	var payload exportProjectRequest
	decoder := json.NewDecoder(request.Body)
	decoder.DisallowUnknownFields()
	if err := decodeSingleJSONValue(decoder, &payload); err != nil {
		if err == io.EOF {
			return true, nil
		}
		return false, err
	}
	if payload.CreateVersion == nil {
		return true, nil
	}
	return *payload.CreateVersion, nil
}

func (server *Server) userFromRequest(request *http.Request) (userRecord, bool) {
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

func cloneMap(value map[string]any) map[string]any {
	raw, err := json.Marshal(value)
	if err != nil {
		return map[string]any{}
	}
	var cloned map[string]any
	if err := json.Unmarshal(raw, &cloned); err != nil {
		return map[string]any{}
	}
	return cloned
}

func defaultProjectDoc(id string, name string, target map[string]any, updatedAt string) map[string]any {
	if target == nil {
		target = map[string]any{}
	}
	width := valueOrDefault(target, "width", 480)
	height := valueOrDefault(target, "height", 480)

	return map[string]any{
		"schemaVersion": 1,
		"id":            id,
		"name":          name,
		"target": map[string]any{
			"lvglVersion": valueOrDefault(target, "lvglVersion", "8.3"),
			"deviceName":  valueOrDefault(target, "deviceName", "ESP32-S3"),
			"width":       width,
			"height":      height,
			"dpi":         valueOrDefault(target, "dpi", 240),
			"colorDepth":  valueOrDefault(target, "colorDepth", 16),
		},
		"theme": "dark",
		"screens": []map[string]any{
			{
				"id":   "screen-1",
				"name": "Screen_1",
				"root": map[string]any{
					"id":       "root-screen-1",
					"type":     "screen",
					"name":     "Screen_1",
					"parentId": nil,
					"children": []any{},
					"layout": map[string]any{
						"x":      0,
						"y":      0,
						"width":  width,
						"height": height,
					},
					"props":  map[string]any{},
					"style":  map[string]any{"bgColor": "#101010"},
					"locked": false,
					"hidden": false,
				},
			},
		},
		"assets":    []any{},
		"styles":    []any{},
		"events":    []any{},
		"updatedAt": updatedAt,
	}
}

func valueOrDefault[T any](values map[string]any, key string, fallback T) any {
	value, ok := values[key]
	if !ok {
		return fallback
	}
	return value
}

func projectDocReferencesAsset(doc map[string]any, assetID string) bool {
	styles, _ := doc["styles"].([]any)
	for _, styleValue := range styles {
		styleDef, ok := styleValue.(map[string]any)
		if !ok {
			continue
		}
		style, _ := styleDef["style"].(map[string]any)
		if style != nil {
			if value, ok := style["font"].(string); ok && value == assetID {
				return true
			}
		}
	}
	screens, ok := doc["screens"].([]any)
	if !ok {
		return false
	}
	for _, screenValue := range screens {
		screen, ok := screenValue.(map[string]any)
		if !ok {
			continue
		}
		root, ok := screen["root"].(map[string]any)
		if ok && widgetReferencesAsset(root, assetID) {
			return true
		}
	}
	return false
}

func widgetReferencesAsset(widget map[string]any, assetID string) bool {
	props, _ := widget["props"].(map[string]any)
	if props != nil {
		if value, ok := props["assetId"].(string); ok && value == assetID {
			return true
		}
	}
	style, _ := widget["style"].(map[string]any)
	if style != nil {
		if value, ok := style["font"].(string); ok && value == assetID {
			return true
		}
	}
	children, _ := widget["children"].([]any)
	for _, childValue := range children {
		child, ok := childValue.(map[string]any)
		if ok && widgetReferencesAsset(child, assetID) {
			return true
		}
	}
	return false
}

func mapToCodegenProject(doc map[string]any) (codegen.ProjectDoc, error) {
	raw, err := json.Marshal(doc)
	if err != nil {
		return codegen.ProjectDoc{}, err
	}
	var project codegen.ProjectDoc
	if err := json.Unmarshal(raw, &project); err != nil {
		return codegen.ProjectDoc{}, err
	}
	return project, nil
}

func validateProjectDoc(doc map[string]any, expectedProjectID string) error {
	if err := validateRawProjectShapeFields(doc); err != nil {
		return err
	}
	if err := validateRawProjectIntegerFields(doc); err != nil {
		return err
	}
	project, err := mapToCodegenProject(doc)
	if err != nil {
		return err
	}
	if strings.TrimSpace(project.ID) == "" {
		return fmt.Errorf("ProjectDoc id is required")
	}
	if expectedProjectID != "" && project.ID != expectedProjectID {
		return fmt.Errorf("ProjectDoc id must match project id: %s", expectedProjectID)
	}
	if strings.TrimSpace(project.Name) == "" {
		return fmt.Errorf("ProjectDoc name is required")
	}
	if project.SchemaVersion != 1 {
		return fmt.Errorf("unsupported ProjectDoc schemaVersion: %d", project.SchemaVersion)
	}
	if project.Theme != "dark" && project.Theme != "light" {
		return fmt.Errorf("unsupported ProjectDoc theme: %s", project.Theme)
	}
	if strings.TrimSpace(project.UpdatedAt) == "" {
		return fmt.Errorf("ProjectDoc updatedAt is required")
	}
	if !isUTCDateTime(project.UpdatedAt) {
		return fmt.Errorf("ProjectDoc updatedAt must be a UTC date-time string")
	}
	if err := validateProjectTarget(project.Target); err != nil {
		return err
	}
	if len(project.Screens) == 0 {
		return fmt.Errorf("ProjectDoc must contain at least one screen")
	}
	assetKinds, err := validateProjectAssets(doc, project.ID)
	if err != nil {
		return err
	}
	if _, ok := doc["styles"]; !ok {
		return fmt.Errorf("ProjectDoc styles is required")
	}
	if _, ok := doc["events"]; !ok {
		return fmt.Errorf("ProjectDoc events is required")
	}
	projectWidgetIDs := map[string]struct{}{}
	screenIDs := map[string]struct{}{}
	for _, screen := range project.Screens {
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
		if err := validateWidgetTree(screen.Root, nil, ids, projectWidgetIDs, assetKinds); err != nil {
			return err
		}
	}
	if err := validateProjectStyles(project.Styles, assetKinds); err != nil {
		return err
	}
	if err := validateProjectEvents(project.Events, projectWidgetIDs); err != nil {
		return err
	}
	return nil
}

func validateRawProjectShapeFields(doc map[string]any) error {
	if err := validateAllowedRawFields(doc, "", "ProjectDoc", []string{"schemaVersion", "id", "name", "target", "theme", "screens", "assets", "styles", "events", "updatedAt"}); err != nil {
		return err
	}
	if target, ok := doc["target"].(map[string]any); ok {
		if err := validateAllowedRawFields(target, "", "target", []string{"lvglVersion", "deviceName", "width", "height", "dpi", "colorDepth"}); err != nil {
			return err
		}
	}
	for _, rawAsset := range rawArray(doc["assets"]) {
		asset, ok := rawAsset.(map[string]any)
		if !ok {
			continue
		}
		assetID := stringValue(asset["id"], "asset")
		if err := validateAllowedRawFields(asset, assetID, "asset", []string{"id", "projectId", "name", "kind", "mimeType", "width", "height", "sizeBytes", "objectKey", "createdAt"}); err != nil {
			return err
		}
	}
	for _, rawScreen := range rawArray(doc["screens"]) {
		screen, ok := rawScreen.(map[string]any)
		if !ok {
			continue
		}
		screenID := stringValue(screen["id"], "screen")
		if err := validateAllowedRawFields(screen, screenID, "screen", []string{"id", "name", "root"}); err != nil {
			return err
		}
		root, ok := screen["root"].(map[string]any)
		if !ok {
			continue
		}
		if err := validateRawWidgetShapeFields(root); err != nil {
			return err
		}
	}
	for _, rawStyle := range rawArray(doc["styles"]) {
		styleDef, ok := rawStyle.(map[string]any)
		if !ok {
			continue
		}
		styleID := stringValue(styleDef["id"], "style")
		if err := validateAllowedRawFields(styleDef, styleID, "style entry", []string{"id", "name", "style"}); err != nil {
			return err
		}
		style, ok := styleDef["style"].(map[string]any)
		if !ok {
			continue
		}
		if err := validateRawStyleShapeFields(style, styleID); err != nil {
			return err
		}
	}
	for _, rawEvent := range rawArray(doc["events"]) {
		event, ok := rawEvent.(map[string]any)
		if !ok {
			continue
		}
		eventID := stringValue(event["id"], "event")
		if err := validateAllowedRawFields(event, eventID, "event", []string{"id", "widgetId", "event", "handlerName"}); err != nil {
			return err
		}
	}
	return nil
}

func validateRawWidgetShapeFields(widget map[string]any) error {
	widgetID := stringValue(widget["id"], "widget")
	if err := validateAllowedRawFields(widget, widgetID, "widget", []string{"id", "type", "name", "parentId", "children", "layout", "props", "style", "locked", "hidden"}); err != nil {
		return err
	}
	if layout, ok := widget["layout"].(map[string]any); ok {
		if err := validateAllowedRawFields(layout, widgetID, "layout", []string{"x", "y", "width", "height", "align", "flex"}); err != nil {
			return err
		}
		if flex, ok := layout["flex"].(map[string]any); ok {
			if err := validateRawFlexShapeFields(flex, widgetID); err != nil {
				return err
			}
		}
	}
	if style, ok := widget["style"].(map[string]any); ok {
		if err := validateRawStyleShapeFields(style, widgetID); err != nil {
			return err
		}
	}
	for _, rawChild := range rawArray(widget["children"]) {
		child, ok := rawChild.(map[string]any)
		if !ok {
			continue
		}
		if err := validateRawWidgetShapeFields(child); err != nil {
			return err
		}
	}
	return nil
}

func validateAllowedRawFields(record map[string]any, ownerID string, label string, allowedFields []string) error {
	allowed := map[string]struct{}{}
	for _, field := range allowedFields {
		allowed[field] = struct{}{}
	}
	for field := range record {
		if _, ok := allowed[field]; ok {
			continue
		}
		if ownerID == "" {
			return fmt.Errorf("unsupported %s field %s", label, field)
		}
		return fmt.Errorf("unsupported %s field %s: %s", label, field, ownerID)
	}
	return nil
}

func validateRawFlexShapeFields(flex map[string]any, ownerID string) error {
	for field := range flex {
		if field != "direction" && field != "gap" && field != "wrap" {
			return fmt.Errorf("unsupported flex field %s: %s", field, ownerID)
		}
	}
	if value, ok := flex["wrap"]; ok {
		if _, ok := value.(bool); !ok {
			return fmt.Errorf("flex wrap must be a boolean: %s", ownerID)
		}
	}
	return nil
}

func validateRawStyleShapeFields(style map[string]any, ownerID string) error {
	for field := range style {
		switch field {
		case "opacity", "blendMode", "bgColor", "textColor", "borderColor", "radius", "padding", "font", "lineSpace", "letterSpace", "align":
		default:
			return fmt.Errorf("unsupported style field %s: %s", field, ownerID)
		}
	}
	padding, ok := style["padding"].(map[string]any)
	if !ok {
		return nil
	}
	for side := range padding {
		if side != "top" && side != "right" && side != "bottom" && side != "left" {
			return fmt.Errorf("unsupported style padding field %s: %s", side, ownerID)
		}
	}
	return nil
}

func validateRawProjectIntegerFields(doc map[string]any) error {
	if err := validateRawTargetIntegerFields(doc); err != nil {
		return err
	}
	for _, rawScreen := range rawArray(doc["screens"]) {
		screen, ok := rawScreen.(map[string]any)
		if !ok {
			continue
		}
		root, ok := screen["root"].(map[string]any)
		if !ok {
			continue
		}
		if err := validateRawWidgetIntegerFields(root); err != nil {
			return err
		}
	}
	for _, rawStyle := range rawArray(doc["styles"]) {
		styleDef, ok := rawStyle.(map[string]any)
		if !ok {
			continue
		}
		style, ok := styleDef["style"].(map[string]any)
		if !ok {
			continue
		}
		styleID := stringValue(styleDef["id"], "style")
		if err := validateRawStyleIntegerFields(style, styleID); err != nil {
			return err
		}
	}
	return validateRawAssetIntegerFields(doc)
}

func validateRawTargetIntegerFields(doc map[string]any) error {
	target, ok := doc["target"].(map[string]any)
	if !ok {
		return nil
	}
	for _, field := range []string{"width", "height", "dpi", "colorDepth"} {
		if err := validateRawIntegerField(target, field, fmt.Sprintf("target %s", field), ""); err != nil {
			return err
		}
	}
	return nil
}

func validateRawWidgetIntegerFields(widget map[string]any) error {
	widgetID := stringValue(widget["id"], "widget")
	if layout, ok := widget["layout"].(map[string]any); ok {
		for _, field := range []string{"x", "y", "width", "height"} {
			if err := validateRawIntegerField(layout, field, fmt.Sprintf("widget %s", field), widgetID); err != nil {
				return err
			}
		}
		if flex, ok := layout["flex"].(map[string]any); ok {
			if err := validateRawIntegerField(flex, "gap", "flex gap", widgetID); err != nil {
				return err
			}
		}
	}
	if style, ok := widget["style"].(map[string]any); ok {
		if err := validateRawStyleIntegerFields(style, widgetID); err != nil {
			return err
		}
	}
	for _, rawChild := range rawArray(widget["children"]) {
		child, ok := rawChild.(map[string]any)
		if !ok {
			continue
		}
		if err := validateRawWidgetIntegerFields(child); err != nil {
			return err
		}
	}
	return nil
}

func validateRawStyleIntegerFields(style map[string]any, ownerID string) error {
	for _, field := range []string{"opacity", "radius", "letterSpace", "lineSpace"} {
		if err := validateRawIntegerField(style, field, fmt.Sprintf("style %s", field), ownerID); err != nil {
			return err
		}
	}
	padding, ok := style["padding"].(map[string]any)
	if !ok {
		return nil
	}
	for _, side := range []string{"top", "right", "bottom", "left"} {
		if err := validateRawIntegerField(padding, side, "style padding", ownerID); err != nil {
			return err
		}
	}
	return nil
}

func validateRawAssetIntegerFields(doc map[string]any) error {
	rawAssets, ok := doc["assets"]
	if !ok {
		return nil
	}
	assets, ok := rawAssets.([]any)
	if !ok {
		return nil
	}
	for _, rawAsset := range assets {
		asset, ok := rawAsset.(map[string]any)
		if !ok {
			continue
		}
		assetID := stringValue(asset["id"], "asset")
		for _, field := range []string{"width", "height", "sizeBytes"} {
			if err := validateRawIntegerField(asset, field, fmt.Sprintf("asset %s", field), assetID); err != nil {
				return err
			}
		}
	}
	return nil
}

func validateRawIntegerField(record map[string]any, field string, label string, ownerID string) error {
	value, exists := record[field]
	if !exists {
		return nil
	}
	switch number := value.(type) {
	case float64:
		if math.Trunc(number) != number {
			return rawIntegerError(label, "integer", ownerID)
		}
	case float32:
		if math.Trunc(float64(number)) != float64(number) {
			return rawIntegerError(label, "integer", ownerID)
		}
	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
		return nil
	default:
		return rawIntegerError(label, "number", ownerID)
	}
	return nil
}

func rawIntegerError(label string, kind string, ownerID string) error {
	article := "a"
	if kind == "integer" {
		article = "an"
	}
	if ownerID == "" {
		return fmt.Errorf("%s must be %s %s", label, article, kind)
	}
	return fmt.Errorf("%s must be %s %s: %s", label, article, kind, ownerID)
}

func rawArray(value any) []any {
	items, ok := value.([]any)
	if !ok {
		return nil
	}
	return items
}

func validateProjectStyles(styles []codegen.StyleDef, assetKinds map[string]string) error {
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
		if err := validateWidgetStyle(style.ID, style.Style); err != nil {
			return err
		}
		if style.Style.Font != "" && !isBuiltInLvglFont(style.Style.Font) {
			if err := validateFontAssetKind(style.Style.Font, assetKinds); err != nil {
				return err
			}
		}
	}
	return nil
}

func validateProjectEvents(events []codegen.EventBinding, projectWidgetIDs map[string]struct{}) error {
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
		if _, ok := projectWidgetIDs[event.WidgetID]; !ok {
			return fmt.Errorf("event binding references missing widget: %s", event.WidgetID)
		}
		if _, ok := supportedEventTypes[event.Event]; !ok {
			return fmt.Errorf("unsupported event type: %s", event.Event)
		}
		if strings.TrimSpace(event.HandlerName) == "" {
			return fmt.Errorf("event handlerName is required: %s", event.ID)
		}
		handlerName := strings.TrimSpace(event.HandlerName)
		callbackName := eventCallbackSymbol(handlerName)
		if previousHandler, ok := callbackSymbols[callbackName]; ok && previousHandler != handlerName {
			return fmt.Errorf("event handlerName must generate a unique C callback symbol: %s", callbackName)
		}
		callbackSymbols[callbackName] = handlerName
	}
	return nil
}

func eventCallbackSymbol(name string) string {
	var builder strings.Builder
	previousWasSeparator := false
	for _, char := range name {
		if (char >= 'A' && char <= 'Z') || (char >= 'a' && char <= 'z') || (char >= '0' && char <= '9') {
			builder.WriteRune(char)
			previousWasSeparator = false
			continue
		}
		if !previousWasSeparator {
			builder.WriteByte('_')
			previousWasSeparator = true
		}
	}
	cleaned := strings.Trim(builder.String(), "_")
	if cleaned == "" {
		cleaned = "Widget"
	}
	if cleaned[0] >= '0' && cleaned[0] <= '9' {
		cleaned = "_" + cleaned
	}
	return cleaned
}

var supportedEventTypes = map[string]struct{}{
	"LV_EVENT_CLICKED":       {},
	"LV_EVENT_VALUE_CHANGED": {},
	"LV_EVENT_READY":         {},
	"LV_EVENT_CANCEL":        {},
}

func validateProjectTarget(target codegen.TargetConfig) error {
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

func validateProjectAssets(doc map[string]any, projectID string) (map[string]string, error) {
	rawAssets, ok := doc["assets"]
	if !ok {
		return nil, fmt.Errorf("ProjectDoc assets is required")
	}
	raw, err := json.Marshal(rawAssets)
	if err != nil {
		return nil, err
	}
	var assets []assetRecord
	if err := json.Unmarshal(raw, &assets); err != nil {
		return nil, err
	}
	assetKinds := map[string]string{}
	for _, asset := range assets {
		if strings.TrimSpace(asset.ID) == "" {
			return nil, fmt.Errorf("asset id is required")
		}
		if _, ok := assetKinds[asset.ID]; ok {
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
		assetKinds[asset.ID] = asset.Kind
	}
	return assetKinds, nil
}

func isUTCDateTime(value string) bool {
	if !strings.HasSuffix(value, "Z") {
		return false
	}
	_, err := time.Parse(time.RFC3339Nano, value)
	return err == nil
}

func validateWidgetTree(widget codegen.WidgetNode, expectedParentID *string, ids map[string]struct{}, projectWidgetIDs map[string]struct{}, assetKinds map[string]string) error {
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
	if _, err := lvglWidgetType(widget.Type); err != nil {
		return err
	}
	if strings.TrimSpace(widget.Name) == "" {
		return fmt.Errorf("widget name is required: %s", widget.ID)
	}
	if err := validateWidgetLayout(widget.ID, widget.Type, widget.Layout); err != nil {
		return err
	}
	if err := validateWidgetStyle(widget.ID, widget.Style); err != nil {
		return err
	}
	if err := validateWidgetProps(widget); err != nil {
		return err
	}
	if widget.Type == "image" {
		if assetID, ok := widget.Props["assetId"].(string); ok && assetID != "" {
			kind, exists := assetKinds[assetID]
			if !exists {
				return fmt.Errorf("image widget references missing asset: %s", assetID)
			}
			if kind != "image" {
				return fmt.Errorf("image widget must reference an image asset: %s", assetID)
			}
		}
	}
	if widget.Style.Font != "" && !isBuiltInLvglFont(widget.Style.Font) {
		if err := validateFontAssetKind(widget.Style.Font, assetKinds); err != nil {
			return err
		}
	}
	for _, child := range widget.Children {
		if err := validateWidgetTree(child, &widget.ID, ids, projectWidgetIDs, assetKinds); err != nil {
			return err
		}
	}
	return nil
}

func validateFontAssetKind(font string, assetKinds map[string]string) error {
	kind, exists := assetKinds[font]
	if !exists {
		return fmt.Errorf("font style references missing asset: %s", font)
	}
	if kind != "font" {
		return fmt.Errorf("font style must reference a font asset: %s", font)
	}
	return nil
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

func validateWidgetProps(widget codegen.WidgetNode) error {
	if err := validateWidgetPropTypes(widget); err != nil {
		return err
	}
	switch widget.Type {
	case "spinner":
		if err := validatePositiveWidgetProp(widget, "spinTime"); err != nil {
			return err
		}
		if err := validatePositiveWidgetProp(widget, "arcLength"); err != nil {
			return err
		}
	case "chart":
		if err := validatePositiveWidgetProp(widget, "pointCount"); err != nil {
			return err
		}
		if err := validateRangeWidgetProps(widget); err != nil {
			return err
		}
		if err := validateChartValuesWidgetProp(widget); err != nil {
			return err
		}
	case "dropdown":
		if err := validateNonNegativeWidgetProp(widget, "selected"); err != nil {
			return err
		}
		if err := validateDropdownSelectedWidgetProp(widget); err != nil {
			return err
		}
	case "slider", "bar", "arc":
		if err := validateNonNegativeWidgetProp(widget, "value"); err != nil {
			return err
		}
		if err := validateRangeWidgetProps(widget); err != nil {
			return err
		}
		if err := validateRangeValueWidgetProp(widget); err != nil {
			return err
		}
	}
	return nil
}

func validateWidgetPropTypes(widget codegen.WidgetNode) error {
	switch widget.Type {
	case "label", "button", "checkbox", "dropdown":
		if err := validateStringWidgetProp(widget, "text"); err != nil {
			return err
		}
	}
	switch widget.Type {
	case "checkbox", "switch":
		if err := validateBoolWidgetProp(widget, "checked"); err != nil {
			return err
		}
	case "image":
		if err := validateStringWidgetProp(widget, "assetId"); err != nil {
			return err
		}
	case "dropdown":
		if err := validateStringWidgetProp(widget, "options"); err != nil {
			return err
		}
		if err := validateNumberWidgetProp(widget, "selected"); err != nil {
			return err
		}
	case "spinner":
		if err := validateNumberWidgetProp(widget, "spinTime"); err != nil {
			return err
		}
		if err := validateNumberWidgetProp(widget, "arcLength"); err != nil {
			return err
		}
	case "chart":
		for _, propName := range []string{"min", "max", "pointCount"} {
			if err := validateNumberWidgetProp(widget, propName); err != nil {
				return err
			}
		}
	case "slider", "bar", "arc":
		for _, propName := range []string{"min", "max", "value"} {
			if err := validateNumberWidgetProp(widget, propName); err != nil {
				return err
			}
		}
	}
	return nil
}

func validateNumberWidgetProp(widget codegen.WidgetNode, propName string) error {
	if value, exists := widget.Props[propName]; exists && !isFiniteWidgetNumber(value) {
		return fmt.Errorf("widget prop %s must be a number: %s", propName, widget.ID)
	}
	if value, exists := widget.Props[propName]; exists && isFiniteWidgetNumber(value) && !isIntegerWidgetNumber(value) {
		return fmt.Errorf("widget prop %s must be an integer: %s", propName, widget.ID)
	}
	return nil
}

func validateStringWidgetProp(widget codegen.WidgetNode, propName string) error {
	if value, exists := widget.Props[propName]; exists {
		if _, ok := value.(string); !ok {
			return fmt.Errorf("widget prop %s must be a string: %s", propName, widget.ID)
		}
	}
	return nil
}

func validateBoolWidgetProp(widget codegen.WidgetNode, propName string) error {
	if value, exists := widget.Props[propName]; exists {
		if _, ok := value.(bool); !ok {
			return fmt.Errorf("widget prop %s must be a boolean: %s", propName, widget.ID)
		}
	}
	return nil
}

func validateDropdownSelectedWidgetProp(widget codegen.WidgetNode) error {
	selected, hasSelected := intWidgetProp(widget.Props, "selected")
	if !hasSelected || selected < 0 {
		return nil
	}
	options := dropdownWidgetOptions(widget.Props["options"])
	if len(options) > 0 && selected >= len(options) {
		return fmt.Errorf("widget prop selected must reference an available option: %s", widget.ID)
	}
	return nil
}

func dropdownWidgetOptions(raw any) []string {
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

func validateRangeWidgetProps(widget codegen.WidgetNode) error {
	min, hasMin := intWidgetProp(widget.Props, "min")
	max, hasMax := intWidgetProp(widget.Props, "max")
	if hasMin && hasMax && max <= min {
		return fmt.Errorf("widget prop max must be greater than min: %s", widget.ID)
	}
	return nil
}

func validateRangeValueWidgetProp(widget codegen.WidgetNode) error {
	value, hasValue := intWidgetProp(widget.Props, "value")
	if !hasValue {
		return nil
	}
	min := intWidgetPropOrDefault(widget.Props, "min", 0)
	max := intWidgetPropOrDefault(widget.Props, "max", 100)
	if max > min && (value < min || value > max) {
		return fmt.Errorf("widget prop value must be between min and max: %s", widget.ID)
	}
	return nil
}

func validateChartValuesWidgetProp(widget codegen.WidgetNode) error {
	rawValues, ok := widget.Props["values"]
	if !ok {
		return nil
	}
	values, ok := rawValues.([]any)
	if !ok {
		return fmt.Errorf("widget prop values must be an array of finite numbers: %s", widget.ID)
	}
	for _, value := range values {
		if !isFiniteWidgetNumber(value) {
			return fmt.Errorf("widget prop values must contain only finite numbers: %s", widget.ID)
		}
		if !isIntegerWidgetNumber(value) {
			return fmt.Errorf("widget prop values must contain only integers: %s", widget.ID)
		}
	}
	return nil
}

func isFiniteWidgetNumber(value any) bool {
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

func isIntegerWidgetNumber(value any) bool {
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

func intWidgetPropOrDefault(props map[string]any, name string, fallback int) int {
	if value, ok := intWidgetProp(props, name); ok {
		return value
	}
	return fallback
}

func validatePositiveWidgetProp(widget codegen.WidgetNode, propName string) error {
	value, ok := intWidgetProp(widget.Props, propName)
	if ok && value <= 0 {
		return fmt.Errorf("widget prop %s must be greater than 0: %s", propName, widget.ID)
	}
	return nil
}

func validateNonNegativeWidgetProp(widget codegen.WidgetNode, propName string) error {
	value, ok := intWidgetProp(widget.Props, propName)
	if ok && value < 0 {
		return fmt.Errorf("widget prop %s must be non-negative: %s", propName, widget.ID)
	}
	return nil
}

func intWidgetProp(props map[string]any, propName string) (int, bool) {
	value, ok := props[propName]
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
	case float32:
		return int(typed), true
	case float64:
		return int(typed), true
	default:
		return 0, false
	}
}

func validateWidgetLayout(widgetID string, widgetType string, layout codegen.LayoutBox) error {
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

func validateWidgetStyle(widgetID string, style codegen.WidgetStyle) error {
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
	if err := validateWidgetStyleColor(widgetID, "bgColor", style.BgColor); err != nil {
		return err
	}
	if err := validateWidgetStyleColor(widgetID, "textColor", style.TextColor); err != nil {
		return err
	}
	if err := validateWidgetStyleColor(widgetID, "borderColor", style.BorderColor); err != nil {
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

func validateWidgetStyleColor(widgetID string, fieldName string, value string) error {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	if !isWidgetStyleHexColor(value) {
		return fmt.Errorf("style %s must be a 3 or 6 digit hex color: %s", fieldName, widgetID)
	}
	return nil
}

func isWidgetStyleHexColor(value string) bool {
	cleaned := strings.TrimPrefix(strings.TrimSpace(value), "#")
	if len(cleaned) != 3 && len(cleaned) != 6 {
		return false
	}
	for _, char := range cleaned {
		if !((char >= '0' && char <= '9') || (char >= 'a' && char <= 'f') || (char >= 'A' && char <= 'F')) {
			return false
		}
	}
	return true
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

func lvglWidgetType(widgetType string) (string, error) {
	switch widgetType {
	case "screen", "container", "button", "label", "image", "arc", "bar", "line", "switch", "slider", "checkbox", "dropdown", "spinner", "chart":
		return widgetType, nil
	default:
		return "", fmt.Errorf("unsupported widget type: %s", widgetType)
	}
}

func writeJSON(writer http.ResponseWriter, status int, payload any) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(payload)
}

func writeError(writer http.ResponseWriter, status int, code string, message string) {
	writeJSON(writer, status, map[string]any{
		"error": map[string]string{
			"code":    code,
			"message": message,
		},
	})
}
