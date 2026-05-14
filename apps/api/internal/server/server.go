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
	if err := json.NewDecoder(request.Body).Decode(&payload); err != nil {
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

func (server *Server) me(writer http.ResponseWriter, request *http.Request) {
	user, ok := server.userFromRequest(request)
	if !ok {
		writeError(writer, http.StatusUnauthorized, "UNAUTHENTICATED", "missing or invalid token")
		return
	}
	writeJSON(writer, http.StatusOK, user)
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
	if err := json.NewDecoder(request.Body).Decode(&payload); err != nil {
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
	project := projectRecord{
		ID:        id,
		OwnerID:   user.ID,
		Name:      payload.Name,
		Doc:       defaultProjectDoc(id, payload.Name, payload.Target, now),
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
	if err := json.NewDecoder(request.Body).Decode(&payload); err != nil {
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
		if err := json.NewDecoder(request.Body).Decode(&payload); err != nil && err != io.EOF {
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
				writeError(writer, http.StatusConflict, "ASSET_IN_USE", "asset is used by image widget")
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

	server.mu.Lock()
	defer server.mu.Unlock()

	project, ok := server.projects[projectID]
	if !ok || project.OwnerID != user.ID {
		writeError(writer, http.StatusNotFound, "PROJECT_NOT_FOUND", "project not found")
		return
	}
	server.snapshotProjectVersion(project, "Build snapshot")

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
	server.hydrateInMemoryAssetData(projectID, doc.Assets)
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
		"sizeBytes":   len(archive),
	}
	job.Archive = archive
	server.jobs[jobID] = job

	writeJSON(writer, http.StatusAccepted, map[string]any{"jobId": jobID})
}

func (server *Server) hydrateInMemoryAssetData(projectID string, assets []codegen.AssetRef) {
	assetsByObjectKey := map[string][]byte{}
	for _, asset := range server.assets[projectID] {
		assetsByObjectKey[asset.ObjectKey] = asset.Content
	}
	for index := range assets {
		if assets[index].ObjectKey == "" {
			continue
		}
		if content, ok := assetsByObjectKey[assets[index].ObjectKey]; ok {
			assets[index].Data = append([]byte(nil), content...)
		}
	}
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
	if len(job.Archive) == 0 {
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
	if err := validateProjectTarget(project.Target); err != nil {
		return err
	}
	if len(project.Screens) == 0 {
		return fmt.Errorf("ProjectDoc must contain at least one screen")
	}
	assetIDs, err := validateProjectAssets(doc, project.ID)
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
		names := map[string]struct{}{}
		ids := map[string]struct{}{}
		if err := validateWidgetTree(screen.Root, nil, names, ids, projectWidgetIDs, assetIDs); err != nil {
			return err
		}
	}
	if err := validateProjectStyles(project.Styles); err != nil {
		return err
	}
	if err := validateProjectEvents(project.Events, projectWidgetIDs); err != nil {
		return err
	}
	return nil
}

func validateProjectStyles(styles []codegen.StyleDef) error {
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
	}
	return nil
}

func validateProjectEvents(events []codegen.EventBinding, projectWidgetIDs map[string]struct{}) error {
	for _, event := range events {
		if strings.TrimSpace(event.ID) == "" {
			return fmt.Errorf("event id is required")
		}
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
	}
	return nil
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

func validateProjectAssets(doc map[string]any, projectID string) (map[string]struct{}, error) {
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
	assetIDs := map[string]struct{}{}
	for _, asset := range assets {
		if strings.TrimSpace(asset.ID) == "" {
			return nil, fmt.Errorf("asset id is required")
		}
		if _, ok := assetIDs[asset.ID]; ok {
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
		assetIDs[asset.ID] = struct{}{}
	}
	return assetIDs, nil
}

func validateWidgetTree(widget codegen.WidgetNode, expectedParentID *string, names map[string]struct{}, ids map[string]struct{}, projectWidgetIDs map[string]struct{}, assetIDs map[string]struct{}) error {
	if strings.TrimSpace(widget.ID) == "" {
		return fmt.Errorf("widget id is required")
	}
	if _, ok := ids[widget.ID]; ok {
		return fmt.Errorf("widget id must be unique within a screen: %s", widget.ID)
	}
	ids[widget.ID] = struct{}{}
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
	if _, ok := names[widget.Name]; ok {
		return fmt.Errorf("widget name must be unique within a screen: %s", widget.Name)
	}
	names[widget.Name] = struct{}{}
	if err := validateWidgetLayout(widget.ID, widget.Layout); err != nil {
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
			if _, exists := assetIDs[assetID]; !exists {
				return fmt.Errorf("image widget references missing asset: %s", assetID)
			}
		}
	}
	if widget.Style.Font != "" && !isBuiltInLvglFont(widget.Style.Font) {
		if _, exists := assetIDs[widget.Style.Font]; !exists {
			return fmt.Errorf("font style references missing asset: %s", widget.Style.Font)
		}
	}
	for _, child := range widget.Children {
		if err := validateWidgetTree(child, &widget.ID, names, ids, projectWidgetIDs, assetIDs); err != nil {
			return err
		}
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
		if err := validateChartValuesWidgetProp(widget); err != nil {
			return err
		}
	case "dropdown":
		if err := validateNonNegativeWidgetProp(widget, "selected"); err != nil {
			return err
		}
	case "slider", "bar", "arc":
		if err := validateNonNegativeWidgetProp(widget, "value"); err != nil {
			return err
		}
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

func validateWidgetLayout(widgetID string, layout codegen.LayoutBox) error {
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
	if style.Opacity != nil && (*style.Opacity < 0 || *style.Opacity > 100) {
		return fmt.Errorf("style opacity must be between 0 and 100: %s", widgetID)
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
