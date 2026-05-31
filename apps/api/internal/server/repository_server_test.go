package server

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/hiveton/lvgl-online-editor/apps/api/internal/assets"
	"github.com/hiveton/lvgl-online-editor/apps/api/internal/jobs"
	"github.com/hiveton/lvgl-online-editor/apps/api/internal/projects"
	"github.com/hiveton/lvgl-online-editor/apps/api/internal/storage"
)

func TestRepositoryServerHealthEndpointDoesNotRequireAuth(t *testing.T) {
	handler := NewRepositoryServer(newFakeProjectRepo(), newFakeAssetRepo(), newFakeJobRepo())

	request := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("health status = %d, body = %s", response.Code, response.Body.String())
	}
	if !bytes.Contains(response.Body.Bytes(), []byte(`"ok":true`)) || !bytes.Contains(response.Body.Bytes(), []byte(`"service":"lvgl-online-editor-api"`)) {
		t.Fatalf("unexpected health response: %s", response.Body.String())
	}
}

func TestRepositoryServerLoginRejectsWrongPassword(t *testing.T) {
	handler := NewRepositoryServer(newFakeProjectRepo(), newFakeAssetRepo(), newFakeJobRepo())

	request := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewBufferString(`{
		"email":"demo@hiveton.dev",
		"password":"wrong-password"
	}`))
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	if response.Code != http.StatusUnauthorized {
		t.Fatalf("login status = %d, body = %s", response.Code, response.Body.String())
	}
	if !bytes.Contains(response.Body.Bytes(), []byte(`"code":"INVALID_CREDENTIALS"`)) {
		t.Fatalf("expected INVALID_CREDENTIALS error: %s", response.Body.String())
	}
}

func TestRepositoryServerLoginRejectsMissingCredentials(t *testing.T) {
	handler := NewRepositoryServer(newFakeProjectRepo(), newFakeAssetRepo(), newFakeJobRepo())

	request := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewBufferString(`{"password":"password"}`))
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	if response.Code != http.StatusBadRequest {
		t.Fatalf("login status = %d, body = %s", response.Code, response.Body.String())
	}
	if !bytes.Contains(response.Body.Bytes(), []byte(`"code":"INVALID_LOGIN_REQUEST"`)) {
		t.Fatalf("expected INVALID_LOGIN_REQUEST error: %s", response.Body.String())
	}
}

func TestRepositoryServerCreatesAndSavesProject(t *testing.T) {
	handler := NewRepositoryServer(newFakeProjectRepo(), newFakeAssetRepo(), newFakeJobRepo())
	token := loginToken(t, handler, "demo@hiveton.dev")

	createRequest := httptest.NewRequest(http.MethodPost, "/api/projects", bytes.NewBufferString(`{"name":"Repo UI"}`))
	createRequest.Header.Set("Authorization", "Bearer "+token)
	createResponse := httptest.NewRecorder()
	handler.ServeHTTP(createResponse, createRequest)
	if createResponse.Code != http.StatusCreated {
		t.Fatalf("create project status = %d, body = %s", createResponse.Code, createResponse.Body.String())
	}

	var createPayload struct {
		Project projectRecord `json:"project"`
	}
	if err := json.Unmarshal(createResponse.Body.Bytes(), &createPayload); err != nil {
		t.Fatal(err)
	}
	createPayload.Project.Doc["name"] = "Saved Repo UI"
	saveBody, err := json.Marshal(map[string]any{"doc": createPayload.Project.Doc})
	if err != nil {
		t.Fatal(err)
	}
	saveRequest := httptest.NewRequest(http.MethodPut, "/api/projects/"+createPayload.Project.ID+"/doc", bytes.NewReader(saveBody))
	saveRequest.Header.Set("Authorization", "Bearer "+token)
	saveResponse := httptest.NewRecorder()
	handler.ServeHTTP(saveResponse, saveRequest)
	if saveResponse.Code != http.StatusOK {
		t.Fatalf("save project status = %d, body = %s", saveResponse.Code, saveResponse.Body.String())
	}

	getRequest := httptest.NewRequest(http.MethodGet, "/api/projects/"+createPayload.Project.ID, nil)
	getRequest.Header.Set("Authorization", "Bearer "+token)
	getResponse := httptest.NewRecorder()
	handler.ServeHTTP(getResponse, getRequest)
	if getResponse.Code != http.StatusOK {
		t.Fatalf("get project status = %d, body = %s", getResponse.Code, getResponse.Body.String())
	}
	if !bytes.Contains(getResponse.Body.Bytes(), []byte("Saved Repo UI")) {
		t.Fatalf("saved project name not returned: %s", getResponse.Body.String())
	}
}

func TestRepositoryServerCreateRejectsInvalidTarget(t *testing.T) {
	handler := NewRepositoryServer(newFakeProjectRepo(), newFakeAssetRepo(), newFakeJobRepo())
	token := loginToken(t, handler, "demo@hiveton.dev")

	createRequest := httptest.NewRequest(http.MethodPost, "/api/projects", bytes.NewBufferString(`{
		"name":"Broken Repo UI",
		"target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":320.5,"height":240,"dpi":160,"colorDepth":16}
	}`))
	createRequest.Header.Set("Authorization", "Bearer "+token)
	createResponse := httptest.NewRecorder()
	handler.ServeHTTP(createResponse, createRequest)

	if createResponse.Code != http.StatusBadRequest {
		t.Fatalf("create project status = %d, body = %s", createResponse.Code, createResponse.Body.String())
	}
	if !bytes.Contains(createResponse.Body.Bytes(), []byte(`"code":"INVALID_PROJECT_DOC"`)) {
		t.Fatalf("expected invalid project doc error: %s", createResponse.Body.String())
	}
}

func TestRepositoryServerSaveMissingProjectReturnsNotFoundBeforeDocValidation(t *testing.T) {
	handler := NewRepositoryServer(newFakeProjectRepo(), newFakeAssetRepo(), newFakeJobRepo())
	token := loginToken(t, handler, "demo@hiveton.dev")

	saveRequest := httptest.NewRequest(http.MethodPut, "/api/projects/missing-project/doc", bytes.NewBufferString(`{"doc":{"id":"wrong"}}`))
	saveRequest.Header.Set("Authorization", "Bearer "+token)
	saveResponse := httptest.NewRecorder()
	handler.ServeHTTP(saveResponse, saveRequest)

	if saveResponse.Code != http.StatusNotFound {
		t.Fatalf("save missing project status = %d, body = %s", saveResponse.Code, saveResponse.Body.String())
	}
	if !bytes.Contains(saveResponse.Body.Bytes(), []byte(`"code":"PROJECT_NOT_FOUND"`)) {
		t.Fatalf("expected project not found error: %s", saveResponse.Body.String())
	}
}

func TestRepositoryServerExportCreatesJobAndDownload(t *testing.T) {
	objectStore := storage.NewMemoryStore()
	handler := NewRepositoryServerWithStorage(newFakeProjectRepo(), newFakeAssetRepo(), newFakeJobRepo(), objectStore)
	token := loginToken(t, handler, "demo@hiveton.dev")

	createRequest := httptest.NewRequest(http.MethodPost, "/api/projects", bytes.NewBufferString(`{"name":"Export UI"}`))
	createRequest.Header.Set("Authorization", "Bearer "+token)
	createResponse := httptest.NewRecorder()
	handler.ServeHTTP(createResponse, createRequest)
	var createPayload struct {
		Project projectRecord `json:"project"`
	}
	if err := json.Unmarshal(createResponse.Body.Bytes(), &createPayload); err != nil {
		t.Fatal(err)
	}

	exportRequest := httptest.NewRequest(http.MethodPost, "/api/projects/"+createPayload.Project.ID+"/export/c", nil)
	exportRequest.Header.Set("Authorization", "Bearer "+token)
	exportResponse := httptest.NewRecorder()
	handler.ServeHTTP(exportResponse, exportRequest)
	if exportResponse.Code != http.StatusAccepted {
		t.Fatalf("export status = %d, body = %s", exportResponse.Code, exportResponse.Body.String())
	}

	var exportPayload struct {
		JobID string `json:"jobId"`
	}
	if err := json.Unmarshal(exportResponse.Body.Bytes(), &exportPayload); err != nil {
		t.Fatal(err)
	}

	jobRequest := httptest.NewRequest(http.MethodGet, "/api/jobs/"+exportPayload.JobID, nil)
	jobRequest.Header.Set("Authorization", "Bearer "+token)
	jobResponse := httptest.NewRecorder()
	handler.ServeHTTP(jobResponse, jobRequest)
	if jobResponse.Code != http.StatusOK || !bytes.Contains(jobResponse.Body.Bytes(), []byte("succeeded")) {
		t.Fatalf("job response = %d, body = %s", jobResponse.Code, jobResponse.Body.String())
	}

	downloadRequest := httptest.NewRequest(http.MethodGet, "/api/jobs/"+exportPayload.JobID+"/download", nil)
	downloadRequest.Header.Set("Authorization", "Bearer "+token)
	downloadResponse := httptest.NewRecorder()
	handler.ServeHTTP(downloadResponse, downloadRequest)
	if downloadResponse.Code != http.StatusOK || downloadResponse.Header().Get("Content-Type") != "application/zip" {
		t.Fatalf("download response = %d, content-type = %s", downloadResponse.Code, downloadResponse.Header().Get("Content-Type"))
	}
	if _, err := objectStore.Get(context.Background(), "jobs/"+exportPayload.JobID+"/lvgl-export.zip"); err != nil {
		t.Fatalf("export archive was not written to object storage: %v", err)
	}
}

func TestRepositoryServerJobDownloadRequiresSucceededStatus(t *testing.T) {
	objectStore := storage.NewMemoryStore()
	if err := objectStore.Put(context.Background(), "jobs/job-repo-1/lvgl-export.zip", []byte("zip bytes")); err != nil {
		t.Fatal(err)
	}
	jobRepo := newFakeJobRepo()
	jobRepo.jobs["job-repo-1"] = jobs.Job{
		ID:              "job-repo-1",
		OwnerID:         DemoUserID,
		ProjectID:       "project-repo-1",
		Kind:            "export_c",
		Status:          "running",
		Progress:        50,
		ResultObjectKey: "jobs/job-repo-1/lvgl-export.zip",
		CreatedAt:       time.Now().UTC(),
		UpdatedAt:       time.Now().UTC(),
	}
	handler := NewRepositoryServerWithStorage(newFakeProjectRepo(), newFakeAssetRepo(), jobRepo, objectStore)
	token := loginToken(t, handler, "demo@hiveton.dev")

	downloadRequest := httptest.NewRequest(http.MethodGet, "/api/jobs/job-repo-1/download", nil)
	downloadRequest.Header.Set("Authorization", "Bearer "+token)
	downloadResponse := httptest.NewRecorder()
	handler.ServeHTTP(downloadResponse, downloadRequest)

	if downloadResponse.Code != http.StatusNotFound {
		t.Fatalf("download status = %d, body = %s", downloadResponse.Code, downloadResponse.Body.String())
	}
	if !bytes.Contains(downloadResponse.Body.Bytes(), []byte(`"code":"JOB_RESULT_NOT_FOUND"`)) {
		t.Fatalf("expected missing result error: %s", downloadResponse.Body.String())
	}
}

func TestRepositoryServerProjectVersionAcceptsDocumentedName(t *testing.T) {
	projectRepo := newFakeProjectRepo()
	handler := NewRepositoryServer(projectRepo, newFakeAssetRepo(), newFakeJobRepo())
	token := loginToken(t, handler, "demo@hiveton.dev")

	createRequest := httptest.NewRequest(http.MethodPost, "/api/projects", bytes.NewBufferString(`{"name":"Versioned UI"}`))
	createRequest.Header.Set("Authorization", "Bearer "+token)
	createResponse := httptest.NewRecorder()
	handler.ServeHTTP(createResponse, createRequest)
	if createResponse.Code != http.StatusCreated {
		t.Fatalf("create project status = %d, body = %s", createResponse.Code, createResponse.Body.String())
	}
	var createPayload struct {
		Project projectRecord `json:"project"`
	}
	if err := json.Unmarshal(createResponse.Body.Bytes(), &createPayload); err != nil {
		t.Fatal(err)
	}

	versionRequest := httptest.NewRequest(http.MethodPost, "/api/projects/"+createPayload.Project.ID+"/versions", bytes.NewBufferString(`{"name":"Before Build"}`))
	versionRequest.Header.Set("Authorization", "Bearer "+token)
	versionResponse := httptest.NewRecorder()
	handler.ServeHTTP(versionResponse, versionRequest)
	if versionResponse.Code != http.StatusCreated {
		t.Fatalf("version status = %d, body = %s", versionResponse.Code, versionResponse.Body.String())
	}
	if len(projectRepo.versions) != 1 {
		t.Fatalf("expected one version, got %d", len(projectRepo.versions))
	}
	if projectRepo.versions[0].Name != "Before Build" {
		t.Fatalf("expected version name from request name, got %q", projectRepo.versions[0].Name)
	}
	if !bytes.Contains(versionResponse.Body.Bytes(), []byte(`"label":"Before Build"`)) {
		t.Fatalf("expected backward-compatible version label in response: %s", versionResponse.Body.String())
	}
}

func TestRepositoryServerProjectVersionAcceptsLegacyLabel(t *testing.T) {
	projectRepo := newFakeProjectRepo()
	handler := NewRepositoryServer(projectRepo, newFakeAssetRepo(), newFakeJobRepo())
	token := loginToken(t, handler, "demo@hiveton.dev")

	createRequest := httptest.NewRequest(http.MethodPost, "/api/projects", bytes.NewBufferString(`{"name":"Legacy Versioned UI"}`))
	createRequest.Header.Set("Authorization", "Bearer "+token)
	createResponse := httptest.NewRecorder()
	handler.ServeHTTP(createResponse, createRequest)
	if createResponse.Code != http.StatusCreated {
		t.Fatalf("create project status = %d, body = %s", createResponse.Code, createResponse.Body.String())
	}
	var createPayload struct {
		Project projectRecord `json:"project"`
	}
	if err := json.Unmarshal(createResponse.Body.Bytes(), &createPayload); err != nil {
		t.Fatal(err)
	}

	versionRequest := httptest.NewRequest(http.MethodPost, "/api/projects/"+createPayload.Project.ID+"/versions", bytes.NewBufferString(`{"label":"Legacy Label"}`))
	versionRequest.Header.Set("Authorization", "Bearer "+token)
	versionResponse := httptest.NewRecorder()
	handler.ServeHTTP(versionResponse, versionRequest)
	if versionResponse.Code != http.StatusCreated {
		t.Fatalf("version status = %d, body = %s", versionResponse.Code, versionResponse.Body.String())
	}
	if projectRepo.versions[0].Name != "Legacy Label" {
		t.Fatalf("expected version name from request label, got %q", projectRepo.versions[0].Name)
	}
}

func TestRepositoryServerExportQueuesJobBeforeRunnerExecutes(t *testing.T) {
	objectStore := storage.NewMemoryStore()
	projectRepo := newFakeProjectRepo()
	jobRepo := newFakeJobRepo()
	runner := newCapturingJobRunner()
	handler := NewRepositoryServerWithStorageAndRunner(projectRepo, newFakeAssetRepo(), jobRepo, objectStore, runner)
	token := loginToken(t, handler, "demo@hiveton.dev")

	createRequest := httptest.NewRequest(http.MethodPost, "/api/projects", bytes.NewBufferString(`{"name":"Async Export UI"}`))
	createRequest.Header.Set("Authorization", "Bearer "+token)
	createResponse := httptest.NewRecorder()
	handler.ServeHTTP(createResponse, createRequest)
	var createPayload struct {
		Project projectRecord `json:"project"`
	}
	if err := json.Unmarshal(createResponse.Body.Bytes(), &createPayload); err != nil {
		t.Fatal(err)
	}

	exportRequest := httptest.NewRequest(http.MethodPost, "/api/projects/"+createPayload.Project.ID+"/export/c", nil)
	exportRequest.Header.Set("Authorization", "Bearer "+token)
	exportResponse := httptest.NewRecorder()
	handler.ServeHTTP(exportResponse, exportRequest)
	if exportResponse.Code != http.StatusAccepted {
		t.Fatalf("export status = %d, body = %s", exportResponse.Code, exportResponse.Body.String())
	}
	var exportPayload struct {
		JobID string `json:"jobId"`
	}
	if err := json.Unmarshal(exportResponse.Body.Bytes(), &exportPayload); err != nil {
		t.Fatal(err)
	}

	job, err := jobRepo.Get(context.Background(), DemoUserID, exportPayload.JobID)
	if err != nil {
		t.Fatal(err)
	}
	if job.Status != "queued" {
		t.Fatalf("job should remain queued before runner executes, got %#v", job)
	}
	if runner.Count() != 1 {
		t.Fatalf("expected one queued task, got %d", runner.Count())
	}

	runner.RunAll()
	job, err = jobRepo.Get(context.Background(), DemoUserID, exportPayload.JobID)
	if err != nil {
		t.Fatal(err)
	}
	if job.Status != "succeeded" || job.ResultObjectKey == "" {
		t.Fatalf("job should succeed after runner executes, got %#v", job)
	}
	if _, err := objectStore.Get(context.Background(), job.ResultObjectKey); err != nil {
		t.Fatalf("export archive missing after runner executes: %v", err)
	}
}

func TestRepositoryServerExportCanSkipVersionSnapshot(t *testing.T) {
	objectStore := storage.NewMemoryStore()
	projectRepo := newFakeProjectRepo()
	handler := NewRepositoryServerWithStorageAndRunner(projectRepo, newFakeAssetRepo(), newFakeJobRepo(), objectStore, newCapturingJobRunner())
	token := loginToken(t, handler, "demo@hiveton.dev")

	createRequest := httptest.NewRequest(http.MethodPost, "/api/projects", bytes.NewBufferString(`{"name":"No Snapshot Export UI"}`))
	createRequest.Header.Set("Authorization", "Bearer "+token)
	createResponse := httptest.NewRecorder()
	handler.ServeHTTP(createResponse, createRequest)
	var createPayload struct {
		Project projectRecord `json:"project"`
	}
	if err := json.Unmarshal(createResponse.Body.Bytes(), &createPayload); err != nil {
		t.Fatal(err)
	}

	exportRequest := httptest.NewRequest(http.MethodPost, "/api/projects/"+createPayload.Project.ID+"/export/c", bytes.NewBufferString(`{"createVersion":false}`))
	exportRequest.Header.Set("Authorization", "Bearer "+token)
	exportResponse := httptest.NewRecorder()
	handler.ServeHTTP(exportResponse, exportRequest)
	if exportResponse.Code != http.StatusAccepted {
		t.Fatalf("export status = %d, body = %s", exportResponse.Code, exportResponse.Body.String())
	}
	if len(projectRepo.versions) != 0 {
		t.Fatalf("expected no build snapshot when createVersion is false, got %d", len(projectRepo.versions))
	}
}

func TestRepositoryServerExportFailsWhenVersionSnapshotFails(t *testing.T) {
	projectRepo := newFakeProjectRepo()
	projectRepo.createVersionErr = errors.New("version insert failed")
	jobRepo := newFakeJobRepo()
	runner := newCapturingJobRunner()
	handler := NewRepositoryServerWithStorageAndRunner(projectRepo, newFakeAssetRepo(), jobRepo, storage.NewMemoryStore(), runner)
	token := loginToken(t, handler, "demo@hiveton.dev")

	createRequest := httptest.NewRequest(http.MethodPost, "/api/projects", bytes.NewBufferString(`{"name":"Snapshot Failure UI"}`))
	createRequest.Header.Set("Authorization", "Bearer "+token)
	createResponse := httptest.NewRecorder()
	handler.ServeHTTP(createResponse, createRequest)
	var createPayload struct {
		Project projectRecord `json:"project"`
	}
	if err := json.Unmarshal(createResponse.Body.Bytes(), &createPayload); err != nil {
		t.Fatal(err)
	}

	exportRequest := httptest.NewRequest(http.MethodPost, "/api/projects/"+createPayload.Project.ID+"/export/c", bytes.NewBufferString(`{"createVersion":true}`))
	exportRequest.Header.Set("Authorization", "Bearer "+token)
	exportResponse := httptest.NewRecorder()
	handler.ServeHTTP(exportResponse, exportRequest)
	if exportResponse.Code != http.StatusInternalServerError {
		t.Fatalf("export status = %d, body = %s", exportResponse.Code, exportResponse.Body.String())
	}
	if !bytes.Contains(exportResponse.Body.Bytes(), []byte(`"code":"PROJECT_VERSION_CREATE_FAILED"`)) {
		t.Fatalf("expected version create failure: %s", exportResponse.Body.String())
	}
	if len(jobRepo.jobs) != 0 {
		t.Fatalf("expected no export job when snapshot fails, got %d", len(jobRepo.jobs))
	}
	if runner.Count() != 0 {
		t.Fatalf("expected no queued export when snapshot fails, got %d", runner.Count())
	}
}

func TestRepositoryServerExportMarksAssetLoadFailures(t *testing.T) {
	handler := NewRepositoryServerWithStorage(newFakeProjectRepo(), newFakeAssetRepo(), newFakeJobRepo(), storage.NewMemoryStore())
	token := loginToken(t, handler, "demo@hiveton.dev")

	createRequest := httptest.NewRequest(http.MethodPost, "/api/projects", bytes.NewBufferString(`{"name":"Broken Export UI"}`))
	createRequest.Header.Set("Authorization", "Bearer "+token)
	createResponse := httptest.NewRecorder()
	handler.ServeHTTP(createResponse, createRequest)
	var createPayload struct {
		Project projectRecord `json:"project"`
	}
	if err := json.Unmarshal(createResponse.Body.Bytes(), &createPayload); err != nil {
		t.Fatal(err)
	}

	createPayload.Project.Doc["assets"] = []any{
		map[string]any{
			"id":        "missing-asset",
			"projectId": createPayload.Project.ID,
			"name":      "missing.png",
			"kind":      "image",
			"mimeType":  "image/png",
			"sizeBytes": 12,
			"objectKey": "projects/" + createPayload.Project.ID + "/assets/missing.png",
			"createdAt": time.Now().UTC().Format(time.RFC3339),
		},
	}
	createPayload.Project.Doc["screens"] = []any{
		map[string]any{
			"id":   "screen-1",
			"name": "Screen_1",
			"root": map[string]any{
				"id":       "root-screen-1",
				"type":     "screen",
				"name":     "Screen_1",
				"parentId": nil,
				"children": []any{
					map[string]any{
						"id":       "image-1",
						"type":     "image",
						"name":     "Image_1",
						"parentId": "root-screen-1",
						"children": []any{},
						"layout":   map[string]any{"x": 0, "y": 0, "width": 96, "height": 96},
						"props":    map[string]any{"assetId": "missing-asset"},
						"style":    map[string]any{},
						"locked":   false,
						"hidden":   false,
					},
				},
				"layout": map[string]any{"x": 0, "y": 0, "width": 480, "height": 480},
				"props":  map[string]any{},
				"style":  map[string]any{},
				"locked": false,
				"hidden": false,
			},
		},
	}
	saveBody, err := json.Marshal(map[string]any{"doc": createPayload.Project.Doc})
	if err != nil {
		t.Fatal(err)
	}
	saveRequest := httptest.NewRequest(http.MethodPut, "/api/projects/"+createPayload.Project.ID+"/doc", bytes.NewReader(saveBody))
	saveRequest.Header.Set("Authorization", "Bearer "+token)
	saveResponse := httptest.NewRecorder()
	handler.ServeHTTP(saveResponse, saveRequest)
	if saveResponse.Code != http.StatusOK {
		t.Fatalf("save status = %d, body = %s", saveResponse.Code, saveResponse.Body.String())
	}

	exportRequest := httptest.NewRequest(http.MethodPost, "/api/projects/"+createPayload.Project.ID+"/export/c", nil)
	exportRequest.Header.Set("Authorization", "Bearer "+token)
	exportResponse := httptest.NewRecorder()
	handler.ServeHTTP(exportResponse, exportRequest)
	if exportResponse.Code != http.StatusAccepted {
		t.Fatalf("export status = %d, body = %s", exportResponse.Code, exportResponse.Body.String())
	}
	var exportPayload struct {
		JobID string `json:"jobId"`
	}
	if err := json.Unmarshal(exportResponse.Body.Bytes(), &exportPayload); err != nil {
		t.Fatal(err)
	}

	jobRequest := httptest.NewRequest(http.MethodGet, "/api/jobs/"+exportPayload.JobID, nil)
	jobRequest.Header.Set("Authorization", "Bearer "+token)
	jobResponse := httptest.NewRecorder()
	handler.ServeHTTP(jobResponse, jobRequest)
	if jobResponse.Code != http.StatusOK {
		t.Fatalf("job status = %d, body = %s", jobResponse.Code, jobResponse.Body.String())
	}
	body := jobResponse.Body.String()
	if !strings.Contains(body, `"status":"failed"`) || !strings.Contains(body, `"code":"ASSET_LOAD_FAILED"`) {
		t.Fatalf("expected asset load failure job, body = %s", body)
	}
}

func TestRepositoryServerExportRejectsLegacyInvalidProjectDoc(t *testing.T) {
	projectRepo := newFakeProjectRepo()
	jobRepo := newFakeJobRepo()
	handler := NewRepositoryServerWithStorage(projectRepo, newFakeAssetRepo(), jobRepo, storage.NewMemoryStore())
	token := loginToken(t, handler, "demo@hiveton.dev")

	createRequest := httptest.NewRequest(http.MethodPost, "/api/projects", bytes.NewBufferString(`{"name":"Legacy Invalid UI"}`))
	createRequest.Header.Set("Authorization", "Bearer "+token)
	createResponse := httptest.NewRecorder()
	handler.ServeHTTP(createResponse, createRequest)
	var createPayload struct {
		Project projectRecord `json:"project"`
	}
	if err := json.Unmarshal(createResponse.Body.Bytes(), &createPayload); err != nil {
		t.Fatal(err)
	}

	project := projectRepo.projects[createPayload.Project.ID]
	project.Doc["extraRoot"] = true
	projectRepo.projects[createPayload.Project.ID] = project

	exportRequest := httptest.NewRequest(http.MethodPost, "/api/projects/"+createPayload.Project.ID+"/export/c", bytes.NewBufferString(`{"createVersion":false}`))
	exportRequest.Header.Set("Authorization", "Bearer "+token)
	exportResponse := httptest.NewRecorder()
	handler.ServeHTTP(exportResponse, exportRequest)
	if exportResponse.Code != http.StatusBadRequest {
		t.Fatalf("export status = %d, body = %s", exportResponse.Code, exportResponse.Body.String())
	}
	if !bytes.Contains(exportResponse.Body.Bytes(), []byte(`"code":"INVALID_PROJECT_DOC"`)) {
		t.Fatalf("expected invalid ProjectDoc error: %s", exportResponse.Body.String())
	}
	if !bytes.Contains(exportResponse.Body.Bytes(), []byte(`unsupported ProjectDoc field extraRoot`)) {
		t.Fatalf("expected invalid ProjectDoc details: %s", exportResponse.Body.String())
	}
	if len(projectRepo.versions) != 0 {
		t.Fatalf("expected no snapshot for invalid ProjectDoc, got %d", len(projectRepo.versions))
	}
	if len(jobRepo.jobs) != 0 {
		t.Fatalf("expected no job for invalid ProjectDoc, got %d", len(jobRepo.jobs))
	}
}

func TestRepositoryServerExportRejectsLegacyInvalidProjectDocBeforeSnapshot(t *testing.T) {
	projectRepo := newFakeProjectRepo()
	jobRepo := newFakeJobRepo()
	runner := newCapturingJobRunner()
	handler := NewRepositoryServerWithStorageAndRunner(projectRepo, newFakeAssetRepo(), jobRepo, storage.NewMemoryStore(), runner)
	token := loginToken(t, handler, "demo@hiveton.dev")

	createRequest := httptest.NewRequest(http.MethodPost, "/api/projects", bytes.NewBufferString(`{"name":"Invalid Snapshot UI"}`))
	createRequest.Header.Set("Authorization", "Bearer "+token)
	createResponse := httptest.NewRecorder()
	handler.ServeHTTP(createResponse, createRequest)
	var createPayload struct {
		Project projectRecord `json:"project"`
	}
	if err := json.Unmarshal(createResponse.Body.Bytes(), &createPayload); err != nil {
		t.Fatal(err)
	}

	project := projectRepo.projects[createPayload.Project.ID]
	project.Doc["extraRoot"] = true
	projectRepo.projects[createPayload.Project.ID] = project

	exportRequest := httptest.NewRequest(http.MethodPost, "/api/projects/"+createPayload.Project.ID+"/export/c", nil)
	exportRequest.Header.Set("Authorization", "Bearer "+token)
	exportResponse := httptest.NewRecorder()
	handler.ServeHTTP(exportResponse, exportRequest)

	if exportResponse.Code != http.StatusBadRequest {
		t.Fatalf("export status = %d, body = %s", exportResponse.Code, exportResponse.Body.String())
	}
	if !bytes.Contains(exportResponse.Body.Bytes(), []byte(`"code":"INVALID_PROJECT_DOC"`)) {
		t.Fatalf("expected invalid ProjectDoc error: %s", exportResponse.Body.String())
	}
	if len(projectRepo.versions) != 0 {
		t.Fatalf("expected no snapshot for invalid ProjectDoc, got %d", len(projectRepo.versions))
	}
	if len(jobRepo.jobs) != 0 {
		t.Fatalf("expected no job for invalid ProjectDoc, got %d", len(jobRepo.jobs))
	}
	if runner.Count() != 0 {
		t.Fatalf("expected no queued export for invalid ProjectDoc, got %d", runner.Count())
	}
}

func TestRepositoryServerUploadAssetWritesObjectStorage(t *testing.T) {
	objectStore := storage.NewMemoryStore()
	assetRepo := newFakeAssetRepo()
	handler := NewRepositoryServerWithStorage(newFakeProjectRepo(), assetRepo, newFakeJobRepo(), objectStore)
	token := loginToken(t, handler, "demo@hiveton.dev")

	createRequest := httptest.NewRequest(http.MethodPost, "/api/projects", bytes.NewBufferString(`{"name":"Asset UI"}`))
	createRequest.Header.Set("Authorization", "Bearer "+token)
	createResponse := httptest.NewRecorder()
	handler.ServeHTTP(createResponse, createRequest)
	var createPayload struct {
		Project projectRecord `json:"project"`
	}
	if err := json.Unmarshal(createResponse.Body.Bytes(), &createPayload); err != nil {
		t.Fatal(err)
	}

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	file, err := writer.CreateFormFile("file", "pixel.png")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := file.Write(tinyPNG()); err != nil {
		t.Fatal(err)
	}
	if err := writer.WriteField("kind", "image"); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}

	uploadRequest := httptest.NewRequest(http.MethodPost, "/api/projects/"+createPayload.Project.ID+"/assets", &body)
	uploadRequest.Header.Set("Authorization", "Bearer "+token)
	uploadRequest.Header.Set("Content-Type", writer.FormDataContentType())
	uploadResponse := httptest.NewRecorder()
	handler.ServeHTTP(uploadResponse, uploadRequest)
	if uploadResponse.Code != http.StatusCreated {
		t.Fatalf("upload status = %d, body = %s", uploadResponse.Code, uploadResponse.Body.String())
	}

	var payload struct {
		Asset assets.Asset `json:"asset"`
	}
	if err := json.Unmarshal(uploadResponse.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	content, err := objectStore.Get(context.Background(), payload.Asset.ObjectKey)
	if err != nil {
		t.Fatalf("asset object missing: %v", err)
	}
	if !bytes.Equal(content, tinyPNG()) {
		t.Fatalf("asset object content changed")
	}

	contentRequest := httptest.NewRequest(http.MethodGet, "/api/projects/"+createPayload.Project.ID+"/assets/"+payload.Asset.ID+"/content", nil)
	contentRequest.Header.Set("Authorization", "Bearer "+token)
	contentResponse := httptest.NewRecorder()
	handler.ServeHTTP(contentResponse, contentRequest)
	if contentResponse.Code != http.StatusOK {
		t.Fatalf("content status = %d, body = %s", contentResponse.Code, contentResponse.Body.String())
	}
	if contentResponse.Header().Get("Content-Type") != "image/png" {
		t.Fatalf("unexpected content-type: %s", contentResponse.Header().Get("Content-Type"))
	}
	if !bytes.Equal(contentResponse.Body.Bytes(), tinyPNG()) {
		t.Fatalf("asset content response changed")
	}
}

func TestRepositoryServerUploadAssetUsesUniqueObjectKeyForSameFilename(t *testing.T) {
	objectStore := storage.NewMemoryStore()
	handler := NewRepositoryServerWithStorage(newFakeProjectRepo(), newFakeAssetRepo(), newFakeJobRepo(), objectStore)
	token := loginToken(t, handler, "demo@hiveton.dev")

	createRequest := httptest.NewRequest(http.MethodPost, "/api/projects", bytes.NewBufferString(`{"name":"Duplicate Asset UI"}`))
	createRequest.Header.Set("Authorization", "Bearer "+token)
	createResponse := httptest.NewRecorder()
	handler.ServeHTTP(createResponse, createRequest)
	var createPayload struct {
		Project projectRecord `json:"project"`
	}
	if err := json.Unmarshal(createResponse.Body.Bytes(), &createPayload); err != nil {
		t.Fatal(err)
	}

	firstAsset := uploadRepositoryTestAsset(t, handler, token, createPayload.Project.ID, "icon.png", tinyPNG())
	secondAsset := uploadRepositoryTestAsset(t, handler, token, createPayload.Project.ID, "icon.png", []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x01})

	if firstAsset.ObjectKey == secondAsset.ObjectKey {
		t.Fatalf("same filename uploads reused object key %q", firstAsset.ObjectKey)
	}
	firstContent, err := objectStore.Get(context.Background(), firstAsset.ObjectKey)
	if err != nil {
		t.Fatalf("first asset object missing: %v", err)
	}
	secondContent, err := objectStore.Get(context.Background(), secondAsset.ObjectKey)
	if err != nil {
		t.Fatalf("second asset object missing: %v", err)
	}
	if bytes.Equal(firstContent, secondContent) {
		t.Fatalf("same filename uploads should keep independent object content")
	}
}

func TestRepositoryServerUploadFontAssetWritesMetadata(t *testing.T) {
	objectStore := storage.NewMemoryStore()
	handler := NewRepositoryServerWithStorage(newFakeProjectRepo(), newFakeAssetRepo(), newFakeJobRepo(), objectStore)
	token := loginToken(t, handler, "demo@hiveton.dev")

	createRequest := httptest.NewRequest(http.MethodPost, "/api/projects", bytes.NewBufferString(`{"name":"Font Asset UI"}`))
	createRequest.Header.Set("Authorization", "Bearer "+token)
	createResponse := httptest.NewRecorder()
	handler.ServeHTTP(createResponse, createRequest)
	var createPayload struct {
		Project projectRecord `json:"project"`
	}
	if err := json.Unmarshal(createResponse.Body.Bytes(), &createPayload); err != nil {
		t.Fatal(err)
	}

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	file, err := writer.CreateFormFile("file", "brand.ttf")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := file.Write([]byte("ttf font bytes")); err != nil {
		t.Fatal(err)
	}
	if err := writer.WriteField("kind", "font"); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}

	uploadRequest := httptest.NewRequest(http.MethodPost, "/api/projects/"+createPayload.Project.ID+"/assets", &body)
	uploadRequest.Header.Set("Authorization", "Bearer "+token)
	uploadRequest.Header.Set("Content-Type", writer.FormDataContentType())
	uploadResponse := httptest.NewRecorder()
	handler.ServeHTTP(uploadResponse, uploadRequest)
	if uploadResponse.Code != http.StatusCreated {
		t.Fatalf("upload status = %d, body = %s", uploadResponse.Code, uploadResponse.Body.String())
	}

	var payload struct {
		Asset assets.Asset `json:"asset"`
	}
	if err := json.Unmarshal(uploadResponse.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload.Asset.Kind != "font" || payload.Asset.MimeType != "font/ttf" {
		t.Fatalf("unexpected font asset metadata: %#v", payload.Asset)
	}
	if payload.Asset.Width != 0 || payload.Asset.Height != 0 {
		t.Fatalf("font asset should not have image dimensions: %#v", payload.Asset)
	}
	content, err := objectStore.Get(context.Background(), payload.Asset.ObjectKey)
	if err != nil {
		t.Fatalf("font object missing: %v", err)
	}
	if !bytes.Equal(content, []byte("ttf font bytes")) {
		t.Fatalf("font object content changed")
	}
}

func TestRepositoryServerDeleteReferencedFontAssetReturnsGenericReferenceMessage(t *testing.T) {
	objectStore := storage.NewMemoryStore()
	handler := NewRepositoryServerWithStorage(newFakeProjectRepo(), newFakeAssetRepo(), newFakeJobRepo(), objectStore)
	token := loginToken(t, handler, "demo@hiveton.dev")

	createRequest := httptest.NewRequest(http.MethodPost, "/api/projects", bytes.NewBufferString(`{"name":"Referenced Font UI"}`))
	createRequest.Header.Set("Authorization", "Bearer "+token)
	createResponse := httptest.NewRecorder()
	handler.ServeHTTP(createResponse, createRequest)
	var createPayload struct {
		Project projectRecord `json:"project"`
	}
	if err := json.Unmarshal(createResponse.Body.Bytes(), &createPayload); err != nil {
		t.Fatal(err)
	}

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	file, err := writer.CreateFormFile("file", "brand.ttf")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := file.Write([]byte("ttf font bytes")); err != nil {
		t.Fatal(err)
	}
	if err := writer.WriteField("kind", "font"); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}

	uploadRequest := httptest.NewRequest(http.MethodPost, "/api/projects/"+createPayload.Project.ID+"/assets", &body)
	uploadRequest.Header.Set("Authorization", "Bearer "+token)
	uploadRequest.Header.Set("Content-Type", writer.FormDataContentType())
	uploadResponse := httptest.NewRecorder()
	handler.ServeHTTP(uploadResponse, uploadRequest)
	if uploadResponse.Code != http.StatusCreated {
		t.Fatalf("upload status = %d, body = %s", uploadResponse.Code, uploadResponse.Body.String())
	}
	var uploadPayload struct {
		Asset assets.Asset `json:"asset"`
	}
	if err := json.Unmarshal(uploadResponse.Body.Bytes(), &uploadPayload); err != nil {
		t.Fatal(err)
	}

	assetRaw, err := json.Marshal(uploadPayload.Asset)
	if err != nil {
		t.Fatal(err)
	}
	var assetDoc map[string]any
	if err := json.Unmarshal(assetRaw, &assetDoc); err != nil {
		t.Fatal(err)
	}
	createPayload.Project.Doc["assets"] = []any{assetDoc}
	createPayload.Project.Doc["styles"] = []any{
		map[string]any{
			"id":    "style-brand",
			"name":  "Brand",
			"style": map[string]any{"font": uploadPayload.Asset.ID},
		},
	}
	saveBody, err := json.Marshal(map[string]any{"doc": createPayload.Project.Doc})
	if err != nil {
		t.Fatal(err)
	}
	saveRequest := httptest.NewRequest(http.MethodPut, "/api/projects/"+createPayload.Project.ID+"/doc", bytes.NewReader(saveBody))
	saveRequest.Header.Set("Authorization", "Bearer "+token)
	saveResponse := httptest.NewRecorder()
	handler.ServeHTTP(saveResponse, saveRequest)
	if saveResponse.Code != http.StatusOK {
		t.Fatalf("save status = %d, body = %s", saveResponse.Code, saveResponse.Body.String())
	}

	deleteRequest := httptest.NewRequest(http.MethodDelete, "/api/projects/"+createPayload.Project.ID+"/assets/"+uploadPayload.Asset.ID, nil)
	deleteRequest.Header.Set("Authorization", "Bearer "+token)
	deleteResponse := httptest.NewRecorder()
	handler.ServeHTTP(deleteResponse, deleteRequest)
	if deleteResponse.Code != http.StatusConflict {
		t.Fatalf("delete status = %d, body = %s", deleteResponse.Code, deleteResponse.Body.String())
	}
	if !bytes.Contains(deleteResponse.Body.Bytes(), []byte(`"code":"ASSET_IN_USE"`)) {
		t.Fatalf("expected ASSET_IN_USE: %s", deleteResponse.Body.String())
	}
	if !bytes.Contains(deleteResponse.Body.Bytes(), []byte(`"message":"asset is still referenced by ProjectDoc"`)) {
		t.Fatalf("expected generic asset reference message: %s", deleteResponse.Body.String())
	}
}

func uploadRepositoryTestAsset(t *testing.T, handler http.Handler, token string, projectID string, filename string, content []byte) assets.Asset {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	file, err := writer.CreateFormFile("file", filename)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := file.Write(content); err != nil {
		t.Fatal(err)
	}
	if err := writer.WriteField("kind", "image"); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}

	uploadRequest := httptest.NewRequest(http.MethodPost, "/api/projects/"+projectID+"/assets", &body)
	uploadRequest.Header.Set("Authorization", "Bearer "+token)
	uploadRequest.Header.Set("Content-Type", writer.FormDataContentType())
	uploadResponse := httptest.NewRecorder()
	handler.ServeHTTP(uploadResponse, uploadRequest)
	if uploadResponse.Code != http.StatusCreated {
		t.Fatalf("upload status = %d, body = %s", uploadResponse.Code, uploadResponse.Body.String())
	}
	var payload struct {
		Asset assets.Asset `json:"asset"`
	}
	if err := json.Unmarshal(uploadResponse.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	return payload.Asset
}

func TestRepositoryServerExportEmbedsUploadedImageAssetBytes(t *testing.T) {
	objectStore := storage.NewMemoryStore()
	handler := NewRepositoryServerWithStorage(newFakeProjectRepo(), newFakeAssetRepo(), newFakeJobRepo(), objectStore)
	token := loginToken(t, handler, "demo@hiveton.dev")

	createRequest := httptest.NewRequest(http.MethodPost, "/api/projects", bytes.NewBufferString(`{"name":"Image Export UI"}`))
	createRequest.Header.Set("Authorization", "Bearer "+token)
	createResponse := httptest.NewRecorder()
	handler.ServeHTTP(createResponse, createRequest)
	var createPayload struct {
		Project projectRecord `json:"project"`
	}
	if err := json.Unmarshal(createResponse.Body.Bytes(), &createPayload); err != nil {
		t.Fatal(err)
	}

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	file, err := writer.CreateFormFile("file", "pixel.png")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := file.Write(tinyPNG()); err != nil {
		t.Fatal(err)
	}
	if err := writer.WriteField("kind", "image"); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	uploadRequest := httptest.NewRequest(http.MethodPost, "/api/projects/"+createPayload.Project.ID+"/assets", &body)
	uploadRequest.Header.Set("Authorization", "Bearer "+token)
	uploadRequest.Header.Set("Content-Type", writer.FormDataContentType())
	uploadResponse := httptest.NewRecorder()
	handler.ServeHTTP(uploadResponse, uploadRequest)
	if uploadResponse.Code != http.StatusCreated {
		t.Fatalf("upload status = %d, body = %s", uploadResponse.Code, uploadResponse.Body.String())
	}
	var uploadPayload struct {
		Asset assets.Asset `json:"asset"`
	}
	if err := json.Unmarshal(uploadResponse.Body.Bytes(), &uploadPayload); err != nil {
		t.Fatal(err)
	}

	assetRaw, err := json.Marshal(uploadPayload.Asset)
	if err != nil {
		t.Fatal(err)
	}
	var assetDoc map[string]any
	if err := json.Unmarshal(assetRaw, &assetDoc); err != nil {
		t.Fatal(err)
	}
	createPayload.Project.Doc["assets"] = []any{assetDoc}
	saveBody, err := json.Marshal(map[string]any{"doc": createPayload.Project.Doc})
	if err != nil {
		t.Fatal(err)
	}
	saveRequest := httptest.NewRequest(http.MethodPut, "/api/projects/"+createPayload.Project.ID+"/doc", bytes.NewReader(saveBody))
	saveRequest.Header.Set("Authorization", "Bearer "+token)
	saveResponse := httptest.NewRecorder()
	handler.ServeHTTP(saveResponse, saveRequest)
	if saveResponse.Code != http.StatusOK {
		t.Fatalf("save status = %d, body = %s", saveResponse.Code, saveResponse.Body.String())
	}

	exportRequest := httptest.NewRequest(http.MethodPost, "/api/projects/"+createPayload.Project.ID+"/export/c", nil)
	exportRequest.Header.Set("Authorization", "Bearer "+token)
	exportResponse := httptest.NewRecorder()
	handler.ServeHTTP(exportResponse, exportRequest)
	if exportResponse.Code != http.StatusAccepted {
		t.Fatalf("export status = %d, body = %s", exportResponse.Code, exportResponse.Body.String())
	}
	var exportPayload struct {
		JobID string `json:"jobId"`
	}
	if err := json.Unmarshal(exportResponse.Body.Bytes(), &exportPayload); err != nil {
		t.Fatal(err)
	}
	downloadRequest := httptest.NewRequest(http.MethodGet, "/api/jobs/"+exportPayload.JobID+"/download", nil)
	downloadRequest.Header.Set("Authorization", "Bearer "+token)
	downloadResponse := httptest.NewRecorder()
	handler.ServeHTTP(downloadResponse, downloadRequest)
	if downloadResponse.Code != http.StatusOK {
		t.Fatalf("download status = %d, body = %s", downloadResponse.Code, downloadResponse.Body.String())
	}
	files := unzipArchive(t, downloadResponse.Body.Bytes())
	if strings.Contains(files["assets.c"], "0x89, 0x50, 0x4E, 0x47") {
		t.Fatalf("assets.c should contain converted LVGL pixels instead of the compressed PNG signature:\n%s", files["assets.c"])
	}
	if !strings.Contains(files["assets.c"], ".header.cf = LV_IMG_CF_TRUE_COLOR_ALPHA") {
		t.Fatalf("assets.c missing true-color LVGL image descriptor:\n%s", files["assets.c"])
	}
}

func loginToken(t *testing.T, handler http.Handler, email string) string {
	t.Helper()
	request := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewBufferString(`{"email":"`+email+`","password":"password"}`))
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("login status = %d, body = %s", response.Code, response.Body.String())
	}
	var payload struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	return payload.Token
}

type fakeProjectRepo struct {
	projects         map[string]projects.Project
	versions         []projects.ProjectVersion
	next             int
	createVersionErr error
}

func newFakeProjectRepo() *fakeProjectRepo {
	return &fakeProjectRepo{projects: map[string]projects.Project{}, next: 1}
}

func (repo *fakeProjectRepo) Create(_ context.Context, ownerID string, name string, doc map[string]any) (projects.Project, error) {
	now := time.Now().UTC()
	project := projects.Project{ID: "project-repo-1", OwnerID: ownerID, Name: name, Doc: doc, CreatedAt: now, UpdatedAt: now}
	repo.projects[project.ID] = project
	return project, nil
}

func (repo *fakeProjectRepo) Get(_ context.Context, ownerID string, projectID string) (projects.Project, error) {
	project, ok := repo.projects[projectID]
	if !ok || project.OwnerID != ownerID {
		return projects.Project{}, projects.ErrNotFound
	}
	return project, nil
}

func (repo *fakeProjectRepo) List(_ context.Context, ownerID string) ([]projects.Project, error) {
	result := []projects.Project{}
	for _, project := range repo.projects {
		if project.OwnerID == ownerID {
			result = append(result, project)
		}
	}
	return result, nil
}

func (repo *fakeProjectRepo) SaveDoc(_ context.Context, ownerID string, projectID string, name string, doc map[string]any) error {
	project, ok := repo.projects[projectID]
	if !ok || project.OwnerID != ownerID {
		return projects.ErrNotFound
	}
	project.Name = name
	project.Doc = doc
	project.UpdatedAt = time.Now().UTC()
	repo.projects[projectID] = project
	return nil
}

func (repo *fakeProjectRepo) CreateVersion(ctx context.Context, ownerID string, projectID string, name string, doc map[string]any) (projects.ProjectVersion, error) {
	if _, err := repo.Get(ctx, ownerID, projectID); err != nil {
		return projects.ProjectVersion{}, err
	}
	if repo.createVersionErr != nil {
		return projects.ProjectVersion{}, repo.createVersionErr
	}
	version := projects.ProjectVersion{ID: "version-repo-1", ProjectID: projectID, OwnerID: ownerID, Name: name, Label: name, Doc: doc, CreatedAt: time.Now().UTC()}
	repo.versions = append(repo.versions, version)
	return version, nil
}

type fakeAssetRepo struct {
	assets map[string]assets.Asset
}

func newFakeAssetRepo() *fakeAssetRepo { return &fakeAssetRepo{assets: map[string]assets.Asset{}} }

func (repo *fakeAssetRepo) Create(_ context.Context, input assets.CreateAssetInput) (assets.Asset, error) {
	asset := assets.Asset{
		ID:        "asset-repo-1",
		ProjectID: input.ProjectID,
		OwnerID:   input.OwnerID,
		Name:      input.Name,
		Kind:      input.Kind,
		MimeType:  input.MimeType,
		SizeBytes: input.SizeBytes,
		ObjectKey: input.ObjectKey,
		CreatedAt: time.Now().UTC(),
	}
	repo.assets[asset.ID] = asset
	return asset, nil
}

func (repo *fakeAssetRepo) List(_ context.Context, ownerID string, projectID string) ([]assets.Asset, error) {
	result := []assets.Asset{}
	for _, asset := range repo.assets {
		if asset.OwnerID == ownerID && asset.ProjectID == projectID {
			result = append(result, asset)
		}
	}
	return result, nil
}

func (repo *fakeAssetRepo) Delete(_ context.Context, ownerID string, projectID string, assetID string) error {
	asset, ok := repo.assets[assetID]
	if ok && asset.OwnerID == ownerID && asset.ProjectID == projectID {
		delete(repo.assets, assetID)
		return nil
	}
	return assets.ErrNotFound
}

type fakeJobRepo struct {
	jobs map[string]jobs.Job
}

func newFakeJobRepo() *fakeJobRepo { return &fakeJobRepo{jobs: map[string]jobs.Job{}} }

func (repo *fakeJobRepo) Create(_ context.Context, input jobs.CreateJobInput) (jobs.Job, error) {
	now := time.Now().UTC()
	job := jobs.Job{ID: "job-repo-1", OwnerID: input.OwnerID, ProjectID: input.ProjectID, Kind: input.Kind, Status: "queued", Logs: input.Logs, CreatedAt: now, UpdatedAt: now}
	repo.jobs[job.ID] = job
	return job, nil
}

func (repo *fakeJobRepo) Get(_ context.Context, ownerID string, jobID string) (jobs.Job, error) {
	job, ok := repo.jobs[jobID]
	if !ok || job.OwnerID != ownerID {
		return jobs.Job{}, jobs.ErrNotFound
	}
	return job, nil
}

func (repo *fakeJobRepo) Update(_ context.Context, ownerID string, jobID string, input jobs.UpdateJobInput) error {
	job, ok := repo.jobs[jobID]
	if !ok || job.OwnerID != ownerID {
		return jobs.ErrNotFound
	}
	job.Status = input.Status
	job.Progress = input.Progress
	job.Logs = input.Logs
	job.ResultObjectKey = input.ResultObjectKey
	job.ErrorCode = input.ErrorCode
	job.ErrorMessage = input.ErrorMessage
	job.UpdatedAt = time.Now().UTC()
	repo.jobs[jobID] = job
	return nil
}

func unzipArchive(t *testing.T, archive []byte) map[string]string {
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
		content := new(bytes.Buffer)
		if _, err := content.ReadFrom(handle); err != nil {
			t.Fatalf("read zip file %s: %v", file.Name, err)
		}
		if err := handle.Close(); err != nil {
			t.Fatalf("close zip file %s: %v", file.Name, err)
		}
		files[file.Name] = content.String()
	}
	return files
}

type capturingJobRunner struct {
	tasks []func()
}

func newCapturingJobRunner() *capturingJobRunner {
	return &capturingJobRunner{}
}

func (runner *capturingJobRunner) EnqueueExport(_ string, _ string, fallback func()) error {
	runner.tasks = append(runner.tasks, fallback)
	return nil
}

func (runner *capturingJobRunner) Count() int {
	return len(runner.tasks)
}

func (runner *capturingJobRunner) RunAll() {
	tasks := runner.tasks
	runner.tasks = nil
	for _, task := range tasks {
		task()
	}
}

func tinyPNG() []byte {
	return []byte{
		0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
		0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
		0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
		0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
		0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
		0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
		0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
		0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
		0x42, 0x60, 0x82,
	}
}
