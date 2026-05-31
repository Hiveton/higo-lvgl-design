package server

import (
	"bytes"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/hiveton/lvgl-online-editor/apps/api/internal/auth"
)

func TestHealthEndpointDoesNotRequireAuth(t *testing.T) {
	app := NewInMemoryServer()

	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	res := httptest.NewRecorder()
	app.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("health status = %d body=%s", res.Code, res.Body.String())
	}
	if !bytes.Contains(res.Body.Bytes(), []byte(`"ok":true`)) || !bytes.Contains(res.Body.Bytes(), []byte(`"service":"lvgl-online-editor-api"`)) {
		t.Fatalf("unexpected health response: %s", res.Body.String())
	}
}

func TestProjectCreateGetAndSaveDoc(t *testing.T) {
	app := NewInMemoryServer()
	token := loginTestUser(t, app)

	createBody := bytes.NewBufferString(`{
		"name":"My Watch UI",
		"target":{
			"lvglVersion":"8.3",
			"deviceName":"ESP32-S3",
			"width":480,
			"height":480,
			"dpi":240,
			"colorDepth":16
		}
	}`)
	createReq := httptest.NewRequest(http.MethodPost, "/api/projects", createBody)
	authorize(createReq, token)
	createRes := httptest.NewRecorder()
	app.ServeHTTP(createRes, createReq)

	if createRes.Code != http.StatusCreated {
		t.Fatalf("create project status = %d body=%s", createRes.Code, createRes.Body.String())
	}

	var createPayload struct {
		Project struct {
			ID   string         `json:"id"`
			Name string         `json:"name"`
			Doc  map[string]any `json:"doc"`
		} `json:"project"`
	}
	if err := json.Unmarshal(createRes.Body.Bytes(), &createPayload); err != nil {
		t.Fatalf("decode create response: %v", err)
	}
	if createPayload.Project.ID == "" {
		t.Fatal("expected project id")
	}
	if createPayload.Project.Doc["schemaVersion"].(float64) != 1 {
		t.Fatalf("expected default ProjectDoc schemaVersion 1: %#v", createPayload.Project.Doc)
	}

	getReq := httptest.NewRequest(http.MethodGet, "/api/projects/"+createPayload.Project.ID, nil)
	authorize(getReq, token)
	getRes := httptest.NewRecorder()
	app.ServeHTTP(getRes, getReq)
	if getRes.Code != http.StatusOK {
		t.Fatalf("get project status = %d body=%s", getRes.Code, getRes.Body.String())
	}

	saveBody := bytes.NewBufferString(`{"doc":{"schemaVersion":1,"id":"` + createPayload.Project.ID + `","name":"Saved","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`)
	saveReq := httptest.NewRequest(http.MethodPut, "/api/projects/"+createPayload.Project.ID+"/doc", saveBody)
	authorize(saveReq, token)
	saveRes := httptest.NewRecorder()
	app.ServeHTTP(saveRes, saveReq)
	if saveRes.Code != http.StatusOK {
		t.Fatalf("save project status = %d body=%s", saveRes.Code, saveRes.Body.String())
	}
}

func TestProjectCreateRejectsInvalidTarget(t *testing.T) {
	app := NewInMemoryServer()
	token := loginTestUser(t, app)

	createBody := bytes.NewBufferString(`{
		"name":"Broken Target",
		"target":{"lvglVersion":"9.0","deviceName":"ESP32-S3","width":320.5,"height":240,"dpi":160,"colorDepth":16}
	}`)
	createReq := httptest.NewRequest(http.MethodPost, "/api/projects", createBody)
	authorize(createReq, token)
	createRes := httptest.NewRecorder()
	app.ServeHTTP(createRes, createReq)

	if createRes.Code != http.StatusBadRequest {
		t.Fatalf("create project status = %d body=%s", createRes.Code, createRes.Body.String())
	}
	if !bytes.Contains(createRes.Body.Bytes(), []byte(`"code":"INVALID_PROJECT_DOC"`)) {
		t.Fatalf("expected invalid project doc error: %s", createRes.Body.String())
	}
}

func TestProjectSaveRejectsUnsupportedWidgetType(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	saveBody := bytes.NewBufferString(`{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[{"id":"bad-widget","type":"video","name":"Video_1","parentId":"root-screen-1","children":[],"layout":{"x":0,"y":0,"width":100,"height":100},"props":{},"style":{},"locked":false,"hidden":false}],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`)
	saveReq := httptest.NewRequest(http.MethodPut, "/api/projects/"+projectID+"/doc", saveBody)
	authorize(saveReq, token)
	saveRes := httptest.NewRecorder()
	app.ServeHTTP(saveRes, saveReq)

	if saveRes.Code != http.StatusBadRequest {
		t.Fatalf("save invalid project status = %d body=%s", saveRes.Code, saveRes.Body.String())
	}
	if !bytes.Contains(saveRes.Body.Bytes(), []byte(`"code":"INVALID_PROJECT_DOC"`)) {
		t.Fatalf("expected invalid project doc error: %s", saveRes.Body.String())
	}
}

func TestProjectSaveRejectsInvalidProjectDocProtocolFields(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	cases := []struct {
		name      string
		body      string
		wantError string
	}{
		{
			name:      "schemaVersion",
			body:      `{"doc":{"schemaVersion":2,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`,
			wantError: "unsupported ProjectDoc schemaVersion: 2",
		},
		{
			name:      "theme",
			body:      `{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"solarized","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`,
			wantError: "unsupported ProjectDoc theme: solarized",
		},
		{
			name:      "updatedAt",
			body:      `{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[],"events":[],"updatedAt":""}}`,
			wantError: "ProjectDoc updatedAt is required",
		},
		{
			name:      "name",
			body:      `{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":" ","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`,
			wantError: "ProjectDoc name is required",
		},
		{
			name:      "styles",
			body:      `{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`,
			wantError: "ProjectDoc styles is required",
		},
		{
			name:      "events",
			body:      `{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[],"updatedAt":"2026-05-08T00:00:00Z"}}`,
			wantError: "ProjectDoc events is required",
		},
		{
			name:      "unknown ProjectDoc field",
			body:      `{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z","extraRoot":true}}`,
			wantError: "unsupported ProjectDoc field extraRoot",
		},
		{
			name:      "unknown target field",
			body:      `{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16,"rotation":90},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`,
			wantError: "unsupported target field rotation",
		},
		{
			name:      "unknown asset field",
			body:      `{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[{"id":"asset-1","projectId":"` + projectID + `","name":"icon.png","kind":"image","mimeType":"image/png","width":16,"height":16,"sizeBytes":128,"objectKey":"projects/` + projectID + `/assets/icon.png","createdAt":"2026-05-08T00:00:00Z","checksum":"sha256:bad"}],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`,
			wantError: "unsupported asset field checksum: asset-1",
		},
		{
			name:      "unknown style entry field",
			body:      `{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[{"id":"style-1","name":"Style_1","style":{},"description":"extra"}],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`,
			wantError: "unsupported style entry field description: style-1",
		},
		{
			name:      "unknown event field",
			body:      `{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[],"events":[{"id":"event-1","widgetId":"root-screen-1","event":"LV_EVENT_CLICKED","handlerName":"on_clicked","once":true}],"updatedAt":"2026-05-08T00:00:00Z"}}`,
			wantError: "unsupported event field once: event-1",
		},
		{
			name:      "unknown screen field",
			body:      `{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","order":1,"root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`,
			wantError: "unsupported screen field order: screen-1",
		},
		{
			name:      "unknown widget field",
			body:      `{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false,"zIndex":1}}],"assets":[],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`,
			wantError: "unsupported widget field zIndex: root-screen-1",
		},
		{
			name:      "unknown layout field",
			body:      `{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[],"layout":{"x":0,"y":0,"width":480,"height":480,"rotation":15},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`,
			wantError: "unsupported layout field rotation: root-screen-1",
		},
		{
			name:      "unknown inline style field",
			body:      `{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{"shadowColor":"#000000"},"locked":false,"hidden":false}}],"assets":[],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`,
			wantError: "unsupported style field shadowColor: root-screen-1",
		},
		{
			name:      "unknown reusable style field",
			body:      `{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[{"id":"style-1","name":"Style_1","style":{"shadowColor":"#000000"}}],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`,
			wantError: "unsupported style field shadowColor: style-1",
		},
		{
			name:      "unknown flex field",
			body:      `{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[],"layout":{"x":0,"y":0,"width":480,"height":480,"flex":{"direction":"row","gap":4,"wrap":false,"justify":"center"}},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`,
			wantError: "unsupported flex field justify: root-screen-1",
		},
		{
			name:      "non-boolean flex wrap",
			body:      `{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[],"layout":{"x":0,"y":0,"width":480,"height":480,"flex":{"direction":"row","gap":4,"wrap":"yes"}},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`,
			wantError: "flex wrap must be a boolean: root-screen-1",
		},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			saveReq := httptest.NewRequest(http.MethodPut, "/api/projects/"+projectID+"/doc", bytes.NewBufferString(testCase.body))
			authorize(saveReq, token)
			saveRes := httptest.NewRecorder()
			app.ServeHTTP(saveRes, saveReq)

			if saveRes.Code != http.StatusBadRequest {
				t.Fatalf("save invalid project status = %d body=%s", saveRes.Code, saveRes.Body.String())
			}
			if !bytes.Contains(saveRes.Body.Bytes(), []byte(testCase.wantError)) {
				t.Fatalf("expected %q error: %s", testCase.wantError, saveRes.Body.String())
			}
		})
	}
}

func TestProjectSaveRejectsInvalidWidgetTreeIdentity(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	saveBody := bytes.NewBufferString(`{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[{"id":"label-1","type":"label","name":"Label_1","parentId":"wrong-parent","children":[],"layout":{"x":0,"y":0,"width":100,"height":100},"props":{"text":"A"},"style":{},"locked":false,"hidden":false}],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`)
	saveReq := httptest.NewRequest(http.MethodPut, "/api/projects/"+projectID+"/doc", saveBody)
	authorize(saveReq, token)
	saveRes := httptest.NewRecorder()
	app.ServeHTTP(saveRes, saveReq)

	if saveRes.Code != http.StatusBadRequest {
		t.Fatalf("save invalid project status = %d body=%s", saveRes.Code, saveRes.Body.String())
	}
	if !bytes.Contains(saveRes.Body.Bytes(), []byte(`widget parentId must be root-screen-1`)) {
		t.Fatalf("expected parentId validation error: %s", saveRes.Body.String())
	}
}

func TestProjectSaveRejectsInvalidTargetConfig(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	saveBody := bytes.NewBufferString(`{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":0,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`)
	saveReq := httptest.NewRequest(http.MethodPut, "/api/projects/"+projectID+"/doc", saveBody)
	authorize(saveReq, token)
	saveRes := httptest.NewRecorder()
	app.ServeHTTP(saveRes, saveReq)

	if saveRes.Code != http.StatusBadRequest {
		t.Fatalf("save invalid project status = %d body=%s", saveRes.Code, saveRes.Body.String())
	}
	if !bytes.Contains(saveRes.Body.Bytes(), []byte(`target width must be greater than 0`)) {
		t.Fatalf("expected target validation error: %s", saveRes.Body.String())
	}
}

func TestProjectSaveRejectsInvalidWidgetLayout(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	saveBody := bytes.NewBufferString(`{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[{"id":"label-1","type":"label","name":"Label_1","parentId":"root-screen-1","children":[],"layout":{"x":0,"y":0,"width":0,"height":32},"props":{"text":"A"},"style":{},"locked":false,"hidden":false}],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`)
	saveReq := httptest.NewRequest(http.MethodPut, "/api/projects/"+projectID+"/doc", saveBody)
	authorize(saveReq, token)
	saveRes := httptest.NewRecorder()
	app.ServeHTTP(saveRes, saveReq)

	if saveRes.Code != http.StatusBadRequest {
		t.Fatalf("save invalid project status = %d body=%s", saveRes.Code, saveRes.Body.String())
	}
	if !bytes.Contains(saveRes.Body.Bytes(), []byte(`widget width must be greater than 0: label-1`)) {
		t.Fatalf("expected layout validation error: %s", saveRes.Body.String())
	}
}

func TestProjectSaveRejectsInvalidWidgetFlagTypes(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	saveBody := bytes.NewBufferString(`{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[{"id":"label-1","type":"label","name":"Label_1","parentId":"root-screen-1","children":[],"layout":{"x":0,"y":0,"width":120,"height":32},"props":{"text":"A"},"style":{},"locked":"false","hidden":false}],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`)
	saveReq := httptest.NewRequest(http.MethodPut, "/api/projects/"+projectID+"/doc", saveBody)
	authorize(saveReq, token)
	saveRes := httptest.NewRecorder()
	app.ServeHTTP(saveRes, saveReq)

	if saveRes.Code != http.StatusBadRequest {
		t.Fatalf("save invalid project status = %d body=%s", saveRes.Code, saveRes.Body.String())
	}
	if !bytes.Contains(saveRes.Body.Bytes(), []byte(`cannot unmarshal string into Go struct field WidgetNode.screens.root.children.locked of type bool`)) {
		t.Fatalf("expected locked type validation error: %s", saveRes.Body.String())
	}
}

func TestProjectSaveRejectsDuplicateWidgetIDAcrossScreens(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	saveBody := bytes.NewBufferString(`{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}},{"id":"screen-2","name":"Screen_2","root":{"id":"root-screen-2","type":"screen","name":"Screen_2","parentId":null,"children":[{"id":"root-screen-1","type":"label","name":"Label_1","parentId":"root-screen-2","children":[],"layout":{"x":0,"y":0,"width":120,"height":32},"props":{"text":"Duplicate"},"style":{},"locked":false,"hidden":false}],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`)
	saveReq := httptest.NewRequest(http.MethodPut, "/api/projects/"+projectID+"/doc", saveBody)
	authorize(saveReq, token)
	saveRes := httptest.NewRecorder()
	app.ServeHTTP(saveRes, saveReq)

	if saveRes.Code != http.StatusBadRequest {
		t.Fatalf("save invalid project status = %d body=%s", saveRes.Code, saveRes.Body.String())
	}
	if !bytes.Contains(saveRes.Body.Bytes(), []byte(`widget id must be unique across project: root-screen-1`)) {
		t.Fatalf("expected duplicate project widget id validation error: %s", saveRes.Body.String())
	}
}

func TestProjectSaveRejectsInvalidWidgetSpecificProps(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	saveBody := bytes.NewBufferString(`{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[{"id":"dropdown-1","type":"dropdown","name":"Dropdown_1","parentId":"root-screen-1","children":[],"layout":{"x":0,"y":0,"width":160,"height":36},"props":{"options":"One\nTwo","selected":2},"style":{},"locked":false,"hidden":false}],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`)
	saveReq := httptest.NewRequest(http.MethodPut, "/api/projects/"+projectID+"/doc", saveBody)
	authorize(saveReq, token)
	saveRes := httptest.NewRecorder()
	app.ServeHTTP(saveRes, saveReq)

	if saveRes.Code != http.StatusBadRequest {
		t.Fatalf("save invalid project status = %d body=%s", saveRes.Code, saveRes.Body.String())
	}
	if !bytes.Contains(saveRes.Body.Bytes(), []byte(`widget prop selected must reference an available option: dropdown-1`)) {
		t.Fatalf("expected widget prop validation error: %s", saveRes.Body.String())
	}

	saveBody = bytes.NewBufferString(`{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[{"id":"bar-1","type":"bar","name":"Bar_1","parentId":"root-screen-1","children":[],"layout":{"x":0,"y":0,"width":160,"height":24},"props":{"min":10,"max":20,"value":24},"style":{},"locked":false,"hidden":false}],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`)
	saveReq = httptest.NewRequest(http.MethodPut, "/api/projects/"+projectID+"/doc", saveBody)
	authorize(saveReq, token)
	saveRes = httptest.NewRecorder()
	app.ServeHTTP(saveRes, saveReq)

	if saveRes.Code != http.StatusBadRequest {
		t.Fatalf("save invalid project status = %d body=%s", saveRes.Code, saveRes.Body.String())
	}
	if !bytes.Contains(saveRes.Body.Bytes(), []byte(`widget prop value must be between min and max: bar-1`)) {
		t.Fatalf("expected widget range value validation error: %s", saveRes.Body.String())
	}

	saveBody = bytes.NewBufferString(`{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[{"id":"slider-1","type":"slider","name":"Slider_1","parentId":"root-screen-1","children":[],"layout":{"x":0,"y":0,"width":160,"height":24},"props":{"value":"50"},"style":{},"locked":false,"hidden":false}],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`)
	saveReq = httptest.NewRequest(http.MethodPut, "/api/projects/"+projectID+"/doc", saveBody)
	authorize(saveReq, token)
	saveRes = httptest.NewRecorder()
	app.ServeHTTP(saveRes, saveReq)

	if saveRes.Code != http.StatusBadRequest {
		t.Fatalf("save invalid project status = %d body=%s", saveRes.Code, saveRes.Body.String())
	}
	if !bytes.Contains(saveRes.Body.Bytes(), []byte(`widget prop value must be a number: slider-1`)) {
		t.Fatalf("expected widget prop type validation error: %s", saveRes.Body.String())
	}

	saveBody = bytes.NewBufferString(`{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[{"id":"slider-1","type":"slider","name":"Slider_1","parentId":"root-screen-1","children":[],"layout":{"x":0,"y":0,"width":160,"height":24},"props":{"value":50.5},"style":{},"locked":false,"hidden":false}],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`)
	saveReq = httptest.NewRequest(http.MethodPut, "/api/projects/"+projectID+"/doc", saveBody)
	authorize(saveReq, token)
	saveRes = httptest.NewRecorder()
	app.ServeHTTP(saveRes, saveReq)

	if saveRes.Code != http.StatusBadRequest {
		t.Fatalf("save invalid project status = %d body=%s", saveRes.Code, saveRes.Body.String())
	}
	if !bytes.Contains(saveRes.Body.Bytes(), []byte(`widget prop value must be an integer: slider-1`)) {
		t.Fatalf("expected widget prop integer validation error: %s", saveRes.Body.String())
	}
}

func TestProjectSaveRejectsFractionalProjectDocIntegerFields(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	cases := []struct {
		name      string
		body      string
		wantError string
	}{
		{
			name:      "target width",
			body:      `{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480.5,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`,
			wantError: "target width must be an integer",
		},
		{
			name:      "layout x",
			body:      `{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[{"id":"label-1","type":"label","name":"Label_1","parentId":"root-screen-1","children":[],"layout":{"x":10.5,"y":0,"width":120,"height":32},"props":{"text":"Label"},"style":{},"locked":false,"hidden":false}],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`,
			wantError: "widget x must be an integer: label-1",
		},
		{
			name:      "flex gap",
			body:      `{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[],"layout":{"x":0,"y":0,"width":480,"height":480,"flex":{"direction":"row","gap":4.5,"wrap":false}},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`,
			wantError: "flex gap must be an integer: root-screen-1",
		},
		{
			name:      "inline style radius",
			body:      `{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[{"id":"label-1","type":"label","name":"Label_1","parentId":"root-screen-1","children":[],"layout":{"x":0,"y":0,"width":120,"height":32},"props":{"text":"Label"},"style":{"radius":2.5},"locked":false,"hidden":false}],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`,
			wantError: "style radius must be an integer: label-1",
		},
		{
			name:      "reusable style opacity",
			body:      `{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[{"id":"style-1","name":"Style_1","style":{"opacity":80.5}}],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`,
			wantError: "style opacity must be an integer: style-1",
		},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			saveReq := httptest.NewRequest(http.MethodPut, "/api/projects/"+projectID+"/doc", bytes.NewBufferString(testCase.body))
			authorize(saveReq, token)
			saveRes := httptest.NewRecorder()
			app.ServeHTTP(saveRes, saveReq)

			if saveRes.Code != http.StatusBadRequest {
				t.Fatalf("save invalid project status = %d body=%s", saveRes.Code, saveRes.Body.String())
			}
			if !bytes.Contains(saveRes.Body.Bytes(), []byte(testCase.wantError)) {
				t.Fatalf("expected %q validation error: %s", testCase.wantError, saveRes.Body.String())
			}
		})
	}
}

func TestProjectSaveRejectsFlexLayoutOnNonContainerWidgets(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	saveBody := bytes.NewBufferString(`{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[{"id":"label-1","type":"label","name":"Label_1","parentId":"root-screen-1","children":[],"layout":{"x":0,"y":0,"width":120,"height":32,"flex":{"direction":"row","gap":4,"wrap":false}},"props":{"text":"Label"},"style":{},"locked":false,"hidden":false}],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`)
	saveReq := httptest.NewRequest(http.MethodPut, "/api/projects/"+projectID+"/doc", saveBody)
	authorize(saveReq, token)
	saveRes := httptest.NewRecorder()
	app.ServeHTTP(saveRes, saveReq)

	if saveRes.Code != http.StatusBadRequest {
		t.Fatalf("save invalid project status = %d body=%s", saveRes.Code, saveRes.Body.String())
	}
	if !bytes.Contains(saveRes.Body.Bytes(), []byte(`widget flex layout is only supported on screen and container widgets: label-1`)) {
		t.Fatalf("expected invalid flex owner validation error: %s", saveRes.Body.String())
	}
}

func TestProjectSaveAllowsDuplicateWidgetNames(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	saveBody := bytes.NewBufferString(`{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Duplicate Names","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[{"id":"label-1","type":"label","name":"Status_Label","parentId":"root-screen-1","children":[],"layout":{"x":0,"y":0,"width":120,"height":32},"props":{"text":"Ready"},"style":{},"locked":false,"hidden":false},{"id":"label-2","type":"label","name":"Status_Label","parentId":"root-screen-1","children":[],"layout":{"x":0,"y":40,"width":120,"height":32},"props":{"text":"Done"},"style":{},"locked":false,"hidden":false}],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`)
	saveReq := httptest.NewRequest(http.MethodPut, "/api/projects/"+projectID+"/doc", saveBody)
	authorize(saveReq, token)
	saveRes := httptest.NewRecorder()
	app.ServeHTTP(saveRes, saveReq)

	if saveRes.Code != http.StatusOK {
		t.Fatalf("save duplicate widget names status = %d body=%s", saveRes.Code, saveRes.Body.String())
	}
}

func TestProjectSaveRejectsInvalidReusableStyles(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	saveBody := bytes.NewBufferString(`{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[{"id":"style-primary","name":"Primary","style":{"opacity":120}},{"id":"style-primary","name":"Primary Copy","style":{}}],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`)
	saveReq := httptest.NewRequest(http.MethodPut, "/api/projects/"+projectID+"/doc", saveBody)
	authorize(saveReq, token)
	saveRes := httptest.NewRecorder()
	app.ServeHTTP(saveRes, saveReq)

	if saveRes.Code != http.StatusBadRequest {
		t.Fatalf("save invalid project status = %d body=%s", saveRes.Code, saveRes.Body.String())
	}
	if !bytes.Contains(saveRes.Body.Bytes(), []byte(`style opacity must be between 0 and 100: style-primary`)) {
		t.Fatalf("expected style validation error: %s", saveRes.Body.String())
	}
}

func TestProjectSaveRejectsInvalidStyleSpacing(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	saveBody := bytes.NewBufferString(`{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{"letterSpace":-1,"lineSpace":-2},"locked":false,"hidden":false}}],"assets":[],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`)
	saveReq := httptest.NewRequest(http.MethodPut, "/api/projects/"+projectID+"/doc", saveBody)
	authorize(saveReq, token)
	saveRes := httptest.NewRecorder()
	app.ServeHTTP(saveRes, saveReq)

	if saveRes.Code != http.StatusBadRequest {
		t.Fatalf("save invalid project status = %d body=%s", saveRes.Code, saveRes.Body.String())
	}
	if !bytes.Contains(saveRes.Body.Bytes(), []byte(`style letterSpace must be non-negative: root-screen-1`)) {
		t.Fatalf("expected invalid style spacing validation error: %s", saveRes.Body.String())
	}

	saveBody = bytes.NewBufferString(`{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[{"id":"style-primary","name":"Primary","style":{"letterSpace":-1,"lineSpace":-2}}],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`)
	saveReq = httptest.NewRequest(http.MethodPut, "/api/projects/"+projectID+"/doc", saveBody)
	authorize(saveReq, token)
	saveRes = httptest.NewRecorder()
	app.ServeHTTP(saveRes, saveReq)

	if saveRes.Code != http.StatusBadRequest {
		t.Fatalf("save invalid project status = %d body=%s", saveRes.Code, saveRes.Body.String())
	}
	if !bytes.Contains(saveRes.Body.Bytes(), []byte(`style letterSpace must be non-negative: style-primary`)) {
		t.Fatalf("expected invalid reusable style spacing validation error: %s", saveRes.Body.String())
	}
}

func TestProjectSaveRejectsInvalidStyleColors(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	saveBody := bytes.NewBufferString(`{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{"bgColor":"red"},"locked":false,"hidden":false}}],"assets":[],"styles":[{"id":"style-accent","name":"Accent","style":{"textColor":"#12xx56"}}],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`)
	saveReq := httptest.NewRequest(http.MethodPut, "/api/projects/"+projectID+"/doc", saveBody)
	authorize(saveReq, token)
	saveRes := httptest.NewRecorder()
	app.ServeHTTP(saveRes, saveReq)

	if saveRes.Code != http.StatusBadRequest {
		t.Fatalf("save invalid project status = %d body=%s", saveRes.Code, saveRes.Body.String())
	}
	if !bytes.Contains(saveRes.Body.Bytes(), []byte(`style bgColor must be a 3 or 6 digit hex color: root-screen-1`)) {
		t.Fatalf("expected invalid style color validation error: %s", saveRes.Body.String())
	}
}

func TestProjectSaveRejectsAssetKindMismatches(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	saveBody := bytes.NewBufferString(`{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[{"id":"image-1","type":"image","name":"Image_1","parentId":"root-screen-1","children":[],"layout":{"x":0,"y":0,"width":96,"height":96},"props":{"assetId":"font-asset"},"style":{},"locked":false,"hidden":false}],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[{"id":"font-asset","projectId":"` + projectID + `","name":"brand.ttf","kind":"font","mimeType":"font/ttf","sizeBytes":2048,"objectKey":"projects/` + projectID + `/assets/font-asset/brand.ttf","createdAt":"2026-05-08T00:00:00Z"}],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`)
	saveReq := httptest.NewRequest(http.MethodPut, "/api/projects/"+projectID+"/doc", saveBody)
	authorize(saveReq, token)
	saveRes := httptest.NewRecorder()
	app.ServeHTTP(saveRes, saveReq)

	if saveRes.Code != http.StatusBadRequest {
		t.Fatalf("save invalid project status = %d body=%s", saveRes.Code, saveRes.Body.String())
	}
	if !bytes.Contains(saveRes.Body.Bytes(), []byte(`image widget must reference an image asset: font-asset`)) {
		t.Fatalf("expected image asset kind validation error: %s", saveRes.Body.String())
	}

	saveBody = bytes.NewBufferString(`{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{"font":"image-asset"},"locked":false,"hidden":false}}],"assets":[{"id":"image-asset","projectId":"` + projectID + `","name":"icon.png","kind":"image","mimeType":"image/png","width":32,"height":32,"sizeBytes":128,"objectKey":"projects/` + projectID + `/assets/image-asset/icon.png","createdAt":"2026-05-08T00:00:00Z"}],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`)
	saveReq = httptest.NewRequest(http.MethodPut, "/api/projects/"+projectID+"/doc", saveBody)
	authorize(saveReq, token)
	saveRes = httptest.NewRecorder()
	app.ServeHTTP(saveRes, saveReq)

	if saveRes.Code != http.StatusBadRequest {
		t.Fatalf("save invalid project status = %d body=%s", saveRes.Code, saveRes.Body.String())
	}
	if !bytes.Contains(saveRes.Body.Bytes(), []byte(`font style must reference a font asset: image-asset`)) {
		t.Fatalf("expected font asset kind validation error: %s", saveRes.Body.String())
	}
}

func TestProjectSaveRejectsEventBindingToMissingWidget(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	saveBody := bytes.NewBufferString(`{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[],"events":[{"id":"event-1","widgetId":"missing-widget","event":"LV_EVENT_CLICKED","handlerName":"on_missing_clicked"}],"updatedAt":"2026-05-08T00:00:00Z"}}`)
	saveReq := httptest.NewRequest(http.MethodPut, "/api/projects/"+projectID+"/doc", saveBody)
	authorize(saveReq, token)
	saveRes := httptest.NewRecorder()
	app.ServeHTTP(saveRes, saveReq)

	if saveRes.Code != http.StatusBadRequest {
		t.Fatalf("save invalid project status = %d body=%s", saveRes.Code, saveRes.Body.String())
	}
	if !bytes.Contains(saveRes.Body.Bytes(), []byte(`event binding references missing widget: missing-widget`)) {
		t.Fatalf("expected missing event target validation error: %s", saveRes.Body.String())
	}
}

func TestProjectSaveRejectsUnsupportedEventType(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	saveBody := bytes.NewBufferString(`{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[],"events":[{"id":"event-1","widgetId":"root-screen-1","event":"LV_EVENT_DELETE","handlerName":"on_delete"}],"updatedAt":"2026-05-08T00:00:00Z"}}`)
	saveReq := httptest.NewRequest(http.MethodPut, "/api/projects/"+projectID+"/doc", saveBody)
	authorize(saveReq, token)
	saveRes := httptest.NewRecorder()
	app.ServeHTTP(saveRes, saveReq)

	if saveRes.Code != http.StatusBadRequest {
		t.Fatalf("save invalid project status = %d body=%s", saveRes.Code, saveRes.Body.String())
	}
	if !bytes.Contains(saveRes.Body.Bytes(), []byte(`unsupported event type: LV_EVENT_DELETE`)) {
		t.Fatalf("expected unsupported event validation error: %s", saveRes.Body.String())
	}
}

func TestProjectSaveRejectsEmptyEventHandler(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	saveBody := bytes.NewBufferString(`{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[],"events":[{"id":"event-1","widgetId":"root-screen-1","event":"LV_EVENT_CLICKED","handlerName":"   "}],"updatedAt":"2026-05-08T00:00:00Z"}}`)
	saveReq := httptest.NewRequest(http.MethodPut, "/api/projects/"+projectID+"/doc", saveBody)
	authorize(saveReq, token)
	saveRes := httptest.NewRecorder()
	app.ServeHTTP(saveRes, saveReq)

	if saveRes.Code != http.StatusBadRequest {
		t.Fatalf("save invalid project status = %d body=%s", saveRes.Code, saveRes.Body.String())
	}
	if !bytes.Contains(saveRes.Body.Bytes(), []byte(`event handlerName is required: event-1`)) {
		t.Fatalf("expected empty handler validation error: %s", saveRes.Body.String())
	}
}

func TestProjectSaveRejectsDuplicateEventIDs(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	saveBody := bytes.NewBufferString(`{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[],"events":[{"id":"event-1","widgetId":"root-screen-1","event":"LV_EVENT_READY","handlerName":"on_screen_ready"},{"id":"event-1","widgetId":"root-screen-1","event":"LV_EVENT_CLICKED","handlerName":"on_screen_clicked"}],"updatedAt":"2026-05-08T00:00:00Z"}}`)
	saveReq := httptest.NewRequest(http.MethodPut, "/api/projects/"+projectID+"/doc", saveBody)
	authorize(saveReq, token)
	saveRes := httptest.NewRecorder()
	app.ServeHTTP(saveRes, saveReq)

	if saveRes.Code != http.StatusBadRequest {
		t.Fatalf("save invalid project status = %d body=%s", saveRes.Code, saveRes.Body.String())
	}
	if !bytes.Contains(saveRes.Body.Bytes(), []byte(`event id must be unique: event-1`)) {
		t.Fatalf("expected duplicate event id validation error: %s", saveRes.Body.String())
	}
}

func TestProjectSaveRejectsDuplicateEventCallbackSymbols(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	saveBody := bytes.NewBufferString(`{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[],"events":[{"id":"event-1","widgetId":"root-screen-1","event":"LV_EVENT_READY","handlerName":"on-ready"},{"id":"event-2","widgetId":"root-screen-1","event":"LV_EVENT_CLICKED","handlerName":"on_ready"}],"updatedAt":"2026-05-08T00:00:00Z"}}`)
	saveReq := httptest.NewRequest(http.MethodPut, "/api/projects/"+projectID+"/doc", saveBody)
	authorize(saveReq, token)
	saveRes := httptest.NewRecorder()
	app.ServeHTTP(saveRes, saveReq)

	if saveRes.Code != http.StatusBadRequest {
		t.Fatalf("save invalid project status = %d body=%s", saveRes.Code, saveRes.Body.String())
	}
	if !bytes.Contains(saveRes.Body.Bytes(), []byte(`event handlerName must generate a unique C callback symbol: on_ready`)) {
		t.Fatalf("expected duplicate event callback symbol validation error: %s", saveRes.Body.String())
	}
}

func TestProjectSaveRejectsImageWidgetWithMissingAsset(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	saveBody := bytes.NewBufferString(`{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[{"id":"image-1","type":"image","name":"Image_1","parentId":"root-screen-1","children":[],"layout":{"x":0,"y":0,"width":96,"height":96},"props":{"assetId":"missing-asset"},"style":{},"locked":false,"hidden":false}],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`)
	saveReq := httptest.NewRequest(http.MethodPut, "/api/projects/"+projectID+"/doc", saveBody)
	authorize(saveReq, token)
	saveRes := httptest.NewRecorder()
	app.ServeHTTP(saveRes, saveReq)

	if saveRes.Code != http.StatusBadRequest {
		t.Fatalf("save invalid project status = %d body=%s", saveRes.Code, saveRes.Body.String())
	}
	if !bytes.Contains(saveRes.Body.Bytes(), []byte(`image widget references missing asset: missing-asset`)) {
		t.Fatalf("expected missing asset validation error: %s", saveRes.Body.String())
	}
}

func TestProjectSaveRejectsFontStyleWithMissingAsset(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	saveBody := bytes.NewBufferString(`{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[{"id":"label-1","type":"label","name":"Label_1","parentId":"root-screen-1","children":[],"layout":{"x":0,"y":0,"width":120,"height":32},"props":{"text":"A"},"style":{"font":"missing-font"},"locked":false,"hidden":false}],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`)
	saveReq := httptest.NewRequest(http.MethodPut, "/api/projects/"+projectID+"/doc", saveBody)
	authorize(saveReq, token)
	saveRes := httptest.NewRecorder()
	app.ServeHTTP(saveRes, saveReq)

	if saveRes.Code != http.StatusBadRequest {
		t.Fatalf("save invalid project status = %d body=%s", saveRes.Code, saveRes.Body.String())
	}
	if !bytes.Contains(saveRes.Body.Bytes(), []byte(`font style references missing asset: missing-font`)) {
		t.Fatalf("expected missing font asset validation error: %s", saveRes.Body.String())
	}
}

func TestProjectSaveRejectsReusableStyleFontWithMissingAsset(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	saveBody := bytes.NewBufferString(`{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[{"id":"style-brand","name":"Brand","style":{"font":"missing-font"}}],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`)
	saveReq := httptest.NewRequest(http.MethodPut, "/api/projects/"+projectID+"/doc", saveBody)
	authorize(saveReq, token)
	saveRes := httptest.NewRecorder()
	app.ServeHTTP(saveRes, saveReq)

	if saveRes.Code != http.StatusBadRequest {
		t.Fatalf("save invalid project status = %d body=%s", saveRes.Code, saveRes.Body.String())
	}
	if !bytes.Contains(saveRes.Body.Bytes(), []byte(`font style references missing asset: missing-font`)) {
		t.Fatalf("expected reusable style missing font asset validation error: %s", saveRes.Body.String())
	}
}

func TestProjectSaveRejectsUnsupportedLvglFontSymbol(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	saveBody := bytes.NewBufferString(`{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[{"id":"label-1","type":"label","name":"Label_1","parentId":"root-screen-1","children":[],"layout":{"x":0,"y":0,"width":120,"height":32},"props":{"text":"A"},"style":{"font":"lv_font_custom_24"},"locked":false,"hidden":false}],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`)
	saveReq := httptest.NewRequest(http.MethodPut, "/api/projects/"+projectID+"/doc", saveBody)
	authorize(saveReq, token)
	saveRes := httptest.NewRecorder()
	app.ServeHTTP(saveRes, saveReq)

	if saveRes.Code != http.StatusBadRequest {
		t.Fatalf("save invalid project status = %d body=%s", saveRes.Code, saveRes.Body.String())
	}
	if !bytes.Contains(saveRes.Body.Bytes(), []byte(`font style references missing asset: lv_font_custom_24`)) {
		t.Fatalf("expected unsupported LVGL font validation error: %s", saveRes.Body.String())
	}
}

func TestProjectSaveRejectsIncompleteAssetMetadata(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	saveBody := bytes.NewBufferString(`{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[{"id":"asset-1","name":"icon.png","kind":"image","mimeType":"image/png","objectKey":"projects/project-doc/assets/icon.png"}],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`)
	saveReq := httptest.NewRequest(http.MethodPut, "/api/projects/"+projectID+"/doc", saveBody)
	authorize(saveReq, token)
	saveRes := httptest.NewRecorder()
	app.ServeHTTP(saveRes, saveReq)

	if saveRes.Code != http.StatusBadRequest {
		t.Fatalf("save invalid project status = %d body=%s", saveRes.Code, saveRes.Body.String())
	}
	if !bytes.Contains(saveRes.Body.Bytes(), []byte(`asset projectId is required: asset-1`)) {
		t.Fatalf("expected incomplete asset validation error: %s", saveRes.Body.String())
	}
}

func TestProjectSaveRejectsNegativeAssetDimensions(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	saveBody := bytes.NewBufferString(`{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[{"id":"asset-1","projectId":"` + projectID + `","name":"icon.png","kind":"image","mimeType":"image/png","width":-1,"height":-2,"sizeBytes":12,"objectKey":"projects/` + projectID + `/assets/icon.png","createdAt":"2026-05-08T00:00:00Z"}],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`)
	saveReq := httptest.NewRequest(http.MethodPut, "/api/projects/"+projectID+"/doc", saveBody)
	authorize(saveReq, token)
	saveRes := httptest.NewRecorder()
	app.ServeHTTP(saveRes, saveReq)

	if saveRes.Code != http.StatusBadRequest {
		t.Fatalf("save invalid project status = %d body=%s", saveRes.Code, saveRes.Body.String())
	}
	if !bytes.Contains(saveRes.Body.Bytes(), []byte(`asset width must be non-negative: asset-1`)) {
		t.Fatalf("expected negative asset dimension validation error: %s", saveRes.Body.String())
	}
}

func TestProjectSaveRejectsUnsupportedImageAssetMimeType(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	saveBody := bytes.NewBufferString(`{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken Mime","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[{"id":"asset-1","projectId":"` + projectID + `","name":"animated.gif","kind":"image","mimeType":"image/gif","width":16,"height":16,"sizeBytes":128,"objectKey":"projects/` + projectID + `/assets/animated.gif","createdAt":"2026-05-08T00:00:00Z"}],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`)
	saveReq := httptest.NewRequest(http.MethodPut, "/api/projects/"+projectID+"/doc", saveBody)
	authorize(saveReq, token)
	saveRes := httptest.NewRecorder()
	app.ServeHTTP(saveRes, saveReq)

	if saveRes.Code != http.StatusBadRequest {
		t.Fatalf("save invalid project status = %d body=%s", saveRes.Code, saveRes.Body.String())
	}
	if !bytes.Contains(saveRes.Body.Bytes(), []byte(`unsupported image asset mimeType: asset-1`)) {
		t.Fatalf("expected unsupported image asset mimeType validation error: %s", saveRes.Body.String())
	}
}

func TestProjectSaveRejectsUnsupportedFontAssetMimeType(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	saveBody := bytes.NewBufferString(`{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken Font Mime","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[{"id":"font-asset","projectId":"` + projectID + `","name":"brand.bin","kind":"font","mimeType":"application/octet-stream","sizeBytes":128,"objectKey":"projects/` + projectID + `/assets/brand.bin","createdAt":"2026-05-08T00:00:00Z"}],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`)
	saveReq := httptest.NewRequest(http.MethodPut, "/api/projects/"+projectID+"/doc", saveBody)
	authorize(saveReq, token)
	saveRes := httptest.NewRecorder()
	app.ServeHTTP(saveRes, saveReq)

	if saveRes.Code != http.StatusBadRequest {
		t.Fatalf("save invalid project status = %d body=%s", saveRes.Code, saveRes.Body.String())
	}
	if !bytes.Contains(saveRes.Body.Bytes(), []byte(`unsupported font asset mimeType: font-asset`)) {
		t.Fatalf("expected unsupported font asset mimeType validation error: %s", saveRes.Body.String())
	}
}

func TestProjectSaveRejectsFractionalAssetMetadata(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	saveBody := bytes.NewBufferString(`{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[{"id":"asset-1","projectId":"` + projectID + `","name":"icon.png","kind":"image","mimeType":"image/png","width":16.5,"height":24.5,"sizeBytes":128.5,"objectKey":"projects/` + projectID + `/assets/icon.png","createdAt":"2026-05-08T00:00:00Z"}],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`)
	saveReq := httptest.NewRequest(http.MethodPut, "/api/projects/"+projectID+"/doc", saveBody)
	authorize(saveReq, token)
	saveRes := httptest.NewRecorder()
	app.ServeHTTP(saveRes, saveReq)

	if saveRes.Code != http.StatusBadRequest {
		t.Fatalf("save invalid project status = %d body=%s", saveRes.Code, saveRes.Body.String())
	}
	if !bytes.Contains(saveRes.Body.Bytes(), []byte(`asset width must be an integer: asset-1`)) {
		t.Fatalf("expected fractional asset metadata validation error: %s", saveRes.Body.String())
	}
}

func TestProjectSaveRejectsInvalidTimestamps(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	saveBody := bytes.NewBufferString(`{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken Time","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[{"id":"asset-1","projectId":"` + projectID + `","name":"icon.png","kind":"image","mimeType":"image/png","width":16,"height":16,"sizeBytes":128,"objectKey":"projects/` + projectID + `/assets/icon.png","createdAt":"2026-05-08 00:00:00"}],"styles":[],"events":[],"updatedAt":"yesterday"}}`)
	saveReq := httptest.NewRequest(http.MethodPut, "/api/projects/"+projectID+"/doc", saveBody)
	authorize(saveReq, token)
	saveRes := httptest.NewRecorder()
	app.ServeHTTP(saveRes, saveReq)

	if saveRes.Code != http.StatusBadRequest {
		t.Fatalf("save invalid project status = %d body=%s", saveRes.Code, saveRes.Body.String())
	}
	if !bytes.Contains(saveRes.Body.Bytes(), []byte(`ProjectDoc updatedAt must be a UTC date-time string`)) {
		t.Fatalf("expected invalid updatedAt validation error: %s", saveRes.Body.String())
	}
}

func TestProjectSaveRejectsMismatchedProjectDocID(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	saveBody := bytes.NewBufferString(`{"doc":{"schemaVersion":1,"id":"different-project","name":"Wrong Project","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`)
	saveReq := httptest.NewRequest(http.MethodPut, "/api/projects/"+projectID+"/doc", saveBody)
	authorize(saveReq, token)
	saveRes := httptest.NewRecorder()
	app.ServeHTTP(saveRes, saveReq)

	if saveRes.Code != http.StatusBadRequest {
		t.Fatalf("save mismatched project status = %d body=%s", saveRes.Code, saveRes.Body.String())
	}
	if !bytes.Contains(saveRes.Body.Bytes(), []byte(`ProjectDoc id must match project id: `+projectID)) {
		t.Fatalf("expected project id validation error: %s", saveRes.Body.String())
	}
}

func TestProjectVersionSnapshot(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	versionReq := httptest.NewRequest(http.MethodPost, "/api/projects/"+projectID+"/versions", bytes.NewBufferString(`{
		"name":"Before build"
	}`))
	authorize(versionReq, token)
	versionRes := httptest.NewRecorder()
	app.ServeHTTP(versionRes, versionReq)

	if versionRes.Code != http.StatusCreated {
		t.Fatalf("version status = %d body=%s", versionRes.Code, versionRes.Body.String())
	}
	if !bytes.Contains(versionRes.Body.Bytes(), []byte(`"projectId":"`+projectID+`"`)) {
		t.Fatalf("expected project id in version response: %s", versionRes.Body.String())
	}
	if !bytes.Contains(versionRes.Body.Bytes(), []byte(`"name":"Before build"`)) {
		t.Fatalf("expected version name: %s", versionRes.Body.String())
	}
	if !bytes.Contains(versionRes.Body.Bytes(), []byte(`"label":"Before build"`)) {
		t.Fatalf("expected backward-compatible version label: %s", versionRes.Body.String())
	}
}

func TestLoginAndMe(t *testing.T) {
	app := NewInMemoryServer()

	loginReq := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewBufferString(`{
		"email":"demo@hiveton.dev",
		"password":"password"
	}`))
	loginRes := httptest.NewRecorder()
	app.ServeHTTP(loginRes, loginReq)
	if loginRes.Code != http.StatusOK {
		t.Fatalf("login status = %d body=%s", loginRes.Code, loginRes.Body.String())
	}

	var loginPayload struct {
		Token string `json:"token"`
		User  struct {
			Email string `json:"email"`
		} `json:"user"`
	}
	if err := json.Unmarshal(loginRes.Body.Bytes(), &loginPayload); err != nil {
		t.Fatalf("decode login response: %v", err)
	}
	if loginPayload.Token == "" {
		t.Fatal("expected token")
	}
	if loginPayload.User.Email != "demo@hiveton.dev" {
		t.Fatalf("unexpected user email: %s", loginPayload.User.Email)
	}

	meReq := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	meReq.Header.Set("Authorization", "Bearer "+loginPayload.Token)
	meRes := httptest.NewRecorder()
	app.ServeHTTP(meRes, meReq)
	if meRes.Code != http.StatusOK {
		t.Fatalf("me status = %d body=%s", meRes.Code, meRes.Body.String())
	}
	if !bytes.Contains(meRes.Body.Bytes(), []byte(`"email":"demo@hiveton.dev"`)) {
		t.Fatalf("expected current user response: %s", meRes.Body.String())
	}
}

func TestLoginRejectsWrongPassword(t *testing.T) {
	app := NewInMemoryServer()

	loginReq := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewBufferString(`{
		"email":"demo@hiveton.dev",
		"password":"wrong-password"
	}`))
	loginRes := httptest.NewRecorder()
	app.ServeHTTP(loginRes, loginReq)

	if loginRes.Code != http.StatusUnauthorized {
		t.Fatalf("login status = %d body=%s", loginRes.Code, loginRes.Body.String())
	}
	if !bytes.Contains(loginRes.Body.Bytes(), []byte(`"code":"INVALID_CREDENTIALS"`)) {
		t.Fatalf("expected INVALID_CREDENTIALS error: %s", loginRes.Body.String())
	}
}

func TestLoginRejectsMissingCredentials(t *testing.T) {
	app := NewInMemoryServer()

	loginReq := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewBufferString(`{"email":"demo@hiveton.dev"}`))
	loginRes := httptest.NewRecorder()
	app.ServeHTTP(loginRes, loginReq)

	if loginRes.Code != http.StatusBadRequest {
		t.Fatalf("login status = %d body=%s", loginRes.Code, loginRes.Body.String())
	}
	if !bytes.Contains(loginRes.Body.Bytes(), []byte(`"code":"INVALID_LOGIN_REQUEST"`)) {
		t.Fatalf("expected INVALID_LOGIN_REQUEST error: %s", loginRes.Body.String())
	}
}

func TestLoginRejectsTrailingJSON(t *testing.T) {
	app := NewInMemoryServer()

	loginReq := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewBufferString(`{"email":"demo@hiveton.dev","password":"demo1234"}{"email":"demo@hiveton.dev","password":"demo1234"}`))
	loginRes := httptest.NewRecorder()
	app.ServeHTTP(loginRes, loginReq)

	if loginRes.Code != http.StatusBadRequest {
		t.Fatalf("login status = %d body=%s", loginRes.Code, loginRes.Body.String())
	}
	if !bytes.Contains(loginRes.Body.Bytes(), []byte(`"code":"INVALID_JSON"`)) {
		t.Fatalf("expected INVALID_JSON error: %s", loginRes.Body.String())
	}
}

func TestLoginRejectsUnknownRequestFields(t *testing.T) {
	app := NewInMemoryServer()

	loginReq := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewBufferString(`{"email":"demo@hiveton.dev","password":"demo1234","rememberMe":true}`))
	loginRes := httptest.NewRecorder()
	app.ServeHTTP(loginRes, loginReq)

	if loginRes.Code != http.StatusBadRequest {
		t.Fatalf("login status = %d body=%s", loginRes.Code, loginRes.Body.String())
	}
	if !bytes.Contains(loginRes.Body.Bytes(), []byte(`"code":"INVALID_JSON"`)) {
		t.Fatalf("expected INVALID_JSON error: %s", loginRes.Body.String())
	}
}

func TestMeRejectsMissingToken(t *testing.T) {
	app := NewInMemoryServer()

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	res := httptest.NewRecorder()
	app.ServeHTTP(res, req)

	if res.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d body=%s", res.Code, res.Body.String())
	}
	if !bytes.Contains(res.Body.Bytes(), []byte(`"code":"UNAUTHENTICATED"`)) {
		t.Fatalf("expected UNAUTHENTICATED error: %s", res.Body.String())
	}
}

func TestMissingProjectReturnsJsonError(t *testing.T) {
	app := NewInMemoryServer()
	token := loginTestUser(t, app)

	req := httptest.NewRequest(http.MethodGet, "/api/projects/missing", nil)
	authorize(req, token)
	res := httptest.NewRecorder()
	app.ServeHTTP(res, req)

	if res.Code != http.StatusNotFound {
		t.Fatalf("status = %d body=%s", res.Code, res.Body.String())
	}
	if !bytes.Contains(res.Body.Bytes(), []byte(`"code":"PROJECT_NOT_FOUND"`)) {
		t.Fatalf("expected PROJECT_NOT_FOUND error: %s", res.Body.String())
	}
}

func TestProjectRoutesRejectMissingToken(t *testing.T) {
	app := NewInMemoryServer()

	req := httptest.NewRequest(http.MethodGet, "/api/projects", nil)
	res := httptest.NewRecorder()
	app.ServeHTTP(res, req)

	if res.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d body=%s", res.Code, res.Body.String())
	}
	if !bytes.Contains(res.Body.Bytes(), []byte(`"code":"UNAUTHENTICATED"`)) {
		t.Fatalf("expected UNAUTHENTICATED error: %s", res.Body.String())
	}
}

func TestProjectRoutesEnforceOwner(t *testing.T) {
	app := NewInMemoryServer()
	projectID, ownerToken := createTestProject(t, app)
	otherToken := loginTestUserAs(t, app, "other@hiveton.dev")

	getReq := httptest.NewRequest(http.MethodGet, "/api/projects/"+projectID, nil)
	authorize(getReq, otherToken)
	getRes := httptest.NewRecorder()
	app.ServeHTTP(getRes, getReq)
	if getRes.Code != http.StatusNotFound {
		t.Fatalf("get as other user status = %d body=%s", getRes.Code, getRes.Body.String())
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/projects", nil)
	authorize(listReq, otherToken)
	listRes := httptest.NewRecorder()
	app.ServeHTTP(listRes, listReq)
	if listRes.Code != http.StatusOK {
		t.Fatalf("list as other user status = %d body=%s", listRes.Code, listRes.Body.String())
	}
	if bytes.Contains(listRes.Body.Bytes(), []byte(projectID)) {
		t.Fatalf("other user should not see owner project: %s", listRes.Body.String())
	}

	ownerReq := httptest.NewRequest(http.MethodGet, "/api/projects/"+projectID, nil)
	authorize(ownerReq, ownerToken)
	ownerRes := httptest.NewRecorder()
	app.ServeHTTP(ownerRes, ownerReq)
	if ownerRes.Code != http.StatusOK {
		t.Fatalf("get as owner status = %d body=%s", ownerRes.Code, ownerRes.Body.String())
	}
}

func TestExportCreatesSucceededJobWithDownloadResult(t *testing.T) {
	app := NewInMemoryServer()
	token := loginTestUser(t, app)
	createBody := bytes.NewBufferString(`{
		"name":"My Watch UI",
		"target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16}
	}`)
	createReq := httptest.NewRequest(http.MethodPost, "/api/projects", createBody)
	authorize(createReq, token)
	createRes := httptest.NewRecorder()
	app.ServeHTTP(createRes, createReq)

	var createPayload struct {
		Project struct {
			ID string `json:"id"`
		} `json:"project"`
	}
	if err := json.Unmarshal(createRes.Body.Bytes(), &createPayload); err != nil {
		t.Fatalf("decode create response: %v", err)
	}

	exportReq := httptest.NewRequest(http.MethodPost, "/api/projects/"+createPayload.Project.ID+"/export/c", bytes.NewBufferString(`{"createVersion":true}`))
	authorize(exportReq, token)
	exportRes := httptest.NewRecorder()
	app.ServeHTTP(exportRes, exportReq)

	if exportRes.Code != http.StatusAccepted {
		t.Fatalf("export status = %d body=%s", exportRes.Code, exportRes.Body.String())
	}

	var exportPayload struct {
		JobID string `json:"jobId"`
	}
	if err := json.Unmarshal(exportRes.Body.Bytes(), &exportPayload); err != nil {
		t.Fatalf("decode export response: %v", err)
	}
	if exportPayload.JobID == "" {
		t.Fatal("expected job id")
	}

	jobReq := httptest.NewRequest(http.MethodGet, "/api/jobs/"+exportPayload.JobID, nil)
	authorize(jobReq, token)
	jobRes := httptest.NewRecorder()
	app.ServeHTTP(jobRes, jobReq)

	if jobRes.Code != http.StatusOK {
		t.Fatalf("job status = %d body=%s", jobRes.Code, jobRes.Body.String())
	}
	if !bytes.Contains(jobRes.Body.Bytes(), []byte(`"status":"succeeded"`)) {
		t.Fatalf("expected succeeded job: %s", jobRes.Body.String())
	}
	if !bytes.Contains(jobRes.Body.Bytes(), []byte(`"downloadUrl"`)) {
		t.Fatalf("expected download url: %s", jobRes.Body.String())
	}
	if bytes.Contains(jobRes.Body.Bytes(), []byte(`"sizeBytes"`)) {
		t.Fatalf("job result must not expose undocumented sizeBytes: %s", jobRes.Body.String())
	}

	downloadReq := httptest.NewRequest(http.MethodGet, "/api/jobs/"+exportPayload.JobID+"/download", nil)
	authorize(downloadReq, token)
	downloadRes := httptest.NewRecorder()
	app.ServeHTTP(downloadRes, downloadReq)
	if downloadRes.Code != http.StatusOK {
		t.Fatalf("download status = %d body=%s", downloadRes.Code, downloadRes.Body.String())
	}
	if downloadRes.Header().Get("Content-Type") != "application/zip" {
		t.Fatalf("expected application/zip, got %s", downloadRes.Header().Get("Content-Type"))
	}
	if downloadRes.Body.Len() == 0 {
		t.Fatal("expected zip body")
	}
}

func TestExportCanSkipVersionSnapshot(t *testing.T) {
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
	projectID, token := createTestProject(t, server.router)

	exportReq := httptest.NewRequest(http.MethodPost, "/api/projects/"+projectID+"/export/c", bytes.NewBufferString(`{"createVersion":false}`))
	authorize(exportReq, token)
	exportRes := httptest.NewRecorder()
	server.router.ServeHTTP(exportRes, exportReq)

	if exportRes.Code != http.StatusAccepted {
		t.Fatalf("export status = %d body=%s", exportRes.Code, exportRes.Body.String())
	}
	if len(server.versions[projectID]) != 0 {
		t.Fatalf("expected no build snapshot when createVersion is false, got %d", len(server.versions[projectID]))
	}
}

func TestExportRejectsTrailingJSON(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	exportReq := httptest.NewRequest(http.MethodPost, "/api/projects/"+projectID+"/export/c", bytes.NewBufferString(`{"createVersion":false}{"createVersion":true}`))
	authorize(exportReq, token)
	exportRes := httptest.NewRecorder()
	app.ServeHTTP(exportRes, exportReq)

	if exportRes.Code != http.StatusBadRequest {
		t.Fatalf("export status = %d body=%s", exportRes.Code, exportRes.Body.String())
	}
	if !bytes.Contains(exportRes.Body.Bytes(), []byte(`"code":"INVALID_JSON"`)) {
		t.Fatalf("expected INVALID_JSON error: %s", exportRes.Body.String())
	}
}

func TestExportRejectsUnknownRequestFields(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	exportReq := httptest.NewRequest(http.MethodPost, "/api/projects/"+projectID+"/export/c", bytes.NewBufferString(`{"createVersion":false,"format":"zip"}`))
	authorize(exportReq, token)
	exportRes := httptest.NewRecorder()
	app.ServeHTTP(exportRes, exportReq)

	if exportRes.Code != http.StatusBadRequest {
		t.Fatalf("export status = %d body=%s", exportRes.Code, exportRes.Body.String())
	}
	if !bytes.Contains(exportRes.Body.Bytes(), []byte(`"code":"INVALID_JSON"`)) {
		t.Fatalf("expected INVALID_JSON error: %s", exportRes.Body.String())
	}
}

func TestExportMarksAssetLoadFailures(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	saveBody := bytes.NewBufferString(`{"doc":{"schemaVersion":1,"id":"` + projectID + `","name":"Broken Export UI","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[{"id":"image-1","type":"image","name":"Image_1","parentId":"root-screen-1","children":[],"layout":{"x":0,"y":0,"width":96,"height":96},"props":{"assetId":"missing-asset"},"style":{},"locked":false,"hidden":false}],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[{"id":"missing-asset","projectId":"` + projectID + `","name":"missing.png","kind":"image","mimeType":"image/png","width":32,"height":32,"sizeBytes":12,"objectKey":"projects/` + projectID + `/assets/missing.png","createdAt":"2026-05-08T00:00:00Z"}],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`)
	saveReq := httptest.NewRequest(http.MethodPut, "/api/projects/"+projectID+"/doc", saveBody)
	authorize(saveReq, token)
	saveRes := httptest.NewRecorder()
	app.ServeHTTP(saveRes, saveReq)
	if saveRes.Code != http.StatusOK {
		t.Fatalf("save status = %d body=%s", saveRes.Code, saveRes.Body.String())
	}

	exportReq := httptest.NewRequest(http.MethodPost, "/api/projects/"+projectID+"/export/c", nil)
	authorize(exportReq, token)
	exportRes := httptest.NewRecorder()
	app.ServeHTTP(exportRes, exportReq)
	if exportRes.Code != http.StatusAccepted {
		t.Fatalf("export status = %d body=%s", exportRes.Code, exportRes.Body.String())
	}
	var exportPayload struct {
		JobID string `json:"jobId"`
	}
	if err := json.Unmarshal(exportRes.Body.Bytes(), &exportPayload); err != nil {
		t.Fatalf("decode export response: %v", err)
	}

	jobReq := httptest.NewRequest(http.MethodGet, "/api/jobs/"+exportPayload.JobID, nil)
	authorize(jobReq, token)
	jobRes := httptest.NewRecorder()
	app.ServeHTTP(jobRes, jobReq)
	if jobRes.Code != http.StatusOK {
		t.Fatalf("job status = %d body=%s", jobRes.Code, jobRes.Body.String())
	}
	if !bytes.Contains(jobRes.Body.Bytes(), []byte(`"status":"failed"`)) || !bytes.Contains(jobRes.Body.Bytes(), []byte(`"code":"ASSET_LOAD_FAILED"`)) {
		t.Fatalf("expected asset load failure job: %s", jobRes.Body.String())
	}
}

func TestJobDownloadRequiresSucceededStatus(t *testing.T) {
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
	token := loginTestUser(t, server.router)
	server.jobs["job-running"] = jobRecord{
		ID:       "job-running",
		OwnerID:  DemoUserID,
		Kind:     "export_c",
		Status:   "running",
		Progress: 50,
		Logs:     []jobLog{},
		Archive:  []byte("zip bytes"),
	}

	downloadReq := httptest.NewRequest(http.MethodGet, "/api/jobs/job-running/download", nil)
	authorize(downloadReq, token)
	downloadRes := httptest.NewRecorder()
	server.router.ServeHTTP(downloadRes, downloadReq)

	if downloadRes.Code != http.StatusNotFound {
		t.Fatalf("download status = %d body=%s", downloadRes.Code, downloadRes.Body.String())
	}
	if !bytes.Contains(downloadRes.Body.Bytes(), []byte(`"code":"JOB_RESULT_NOT_FOUND"`)) {
		t.Fatalf("expected missing result error: %s", downloadRes.Body.String())
	}
}

func TestJobRoutesEnforceOwner(t *testing.T) {
	app := NewInMemoryServer()
	projectID, ownerToken := createTestProject(t, app)
	otherToken := loginTestUserAs(t, app, "other@hiveton.dev")

	exportReq := httptest.NewRequest(http.MethodPost, "/api/projects/"+projectID+"/export/c", bytes.NewBufferString(`{"createVersion":true}`))
	authorize(exportReq, ownerToken)
	exportRes := httptest.NewRecorder()
	app.ServeHTTP(exportRes, exportReq)
	if exportRes.Code != http.StatusAccepted {
		t.Fatalf("export status = %d body=%s", exportRes.Code, exportRes.Body.String())
	}
	var exportPayload struct {
		JobID string `json:"jobId"`
	}
	if err := json.Unmarshal(exportRes.Body.Bytes(), &exportPayload); err != nil {
		t.Fatalf("decode export response: %v", err)
	}

	jobReq := httptest.NewRequest(http.MethodGet, "/api/jobs/"+exportPayload.JobID, nil)
	authorize(jobReq, otherToken)
	jobRes := httptest.NewRecorder()
	app.ServeHTTP(jobRes, jobReq)
	if jobRes.Code != http.StatusNotFound {
		t.Fatalf("job as other user status = %d body=%s", jobRes.Code, jobRes.Body.String())
	}

	downloadReq := httptest.NewRequest(http.MethodGet, "/api/jobs/"+exportPayload.JobID+"/download", nil)
	authorize(downloadReq, otherToken)
	downloadRes := httptest.NewRecorder()
	app.ServeHTTP(downloadRes, downloadReq)
	if downloadRes.Code != http.StatusNotFound {
		t.Fatalf("download as other user status = %d body=%s", downloadRes.Code, downloadRes.Body.String())
	}
}

func TestAssetUploadListAndDelete(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", "icon_heart.png")
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	if _, err := part.Write([]byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D}); err != nil {
		t.Fatalf("write form file: %v", err)
	}
	if err := writer.WriteField("kind", "image"); err != nil {
		t.Fatalf("write field: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close multipart writer: %v", err)
	}

	uploadReq := httptest.NewRequest(http.MethodPost, "/api/projects/"+projectID+"/assets", &body)
	authorize(uploadReq, token)
	uploadReq.Header.Set("Content-Type", writer.FormDataContentType())
	uploadRes := httptest.NewRecorder()
	app.ServeHTTP(uploadRes, uploadReq)
	if uploadRes.Code != http.StatusCreated {
		t.Fatalf("upload status = %d body=%s", uploadRes.Code, uploadRes.Body.String())
	}
	if !bytes.Contains(uploadRes.Body.Bytes(), []byte(`"name":"icon_heart.png"`)) {
		t.Fatalf("expected uploaded asset name: %s", uploadRes.Body.String())
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/projects/"+projectID+"/assets", nil)
	authorize(listReq, token)
	listRes := httptest.NewRecorder()
	app.ServeHTTP(listRes, listReq)
	if listRes.Code != http.StatusOK {
		t.Fatalf("list status = %d body=%s", listRes.Code, listRes.Body.String())
	}
	if !bytes.Contains(listRes.Body.Bytes(), []byte(`icon_heart.png`)) {
		t.Fatalf("expected listed asset: %s", listRes.Body.String())
	}

	var uploadPayload struct {
		Asset struct {
			ID string `json:"id"`
		} `json:"asset"`
	}
	if err := json.Unmarshal(uploadRes.Body.Bytes(), &uploadPayload); err != nil {
		t.Fatalf("decode upload response: %v", err)
	}
	deleteReq := httptest.NewRequest(http.MethodDelete, "/api/projects/"+projectID+"/assets/"+uploadPayload.Asset.ID, nil)
	authorize(deleteReq, token)
	deleteRes := httptest.NewRecorder()
	app.ServeHTTP(deleteRes, deleteReq)
	if deleteRes.Code != http.StatusOK {
		t.Fatalf("delete status = %d body=%s", deleteRes.Code, deleteRes.Body.String())
	}
}

func TestAssetUploadReturnsImageDimensions(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", "pixel.png")
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	if _, err := part.Write(tinyPNG()); err != nil {
		t.Fatalf("write form file: %v", err)
	}
	if err := writer.WriteField("kind", "image"); err != nil {
		t.Fatalf("write kind field: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close multipart writer: %v", err)
	}

	uploadReq := httptest.NewRequest(http.MethodPost, "/api/projects/"+projectID+"/assets", &body)
	authorize(uploadReq, token)
	uploadReq.Header.Set("Content-Type", writer.FormDataContentType())
	uploadRes := httptest.NewRecorder()
	app.ServeHTTP(uploadRes, uploadReq)

	if uploadRes.Code != http.StatusCreated {
		t.Fatalf("upload status = %d body=%s", uploadRes.Code, uploadRes.Body.String())
	}
	if !bytes.Contains(uploadRes.Body.Bytes(), []byte(`"width":1`)) || !bytes.Contains(uploadRes.Body.Bytes(), []byte(`"height":1`)) {
		t.Fatalf("expected image dimensions in asset metadata: %s", uploadRes.Body.String())
	}
}

func TestAssetUploadRejectsUnknownMultipartFields(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", "pixel.png")
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	if _, err := part.Write(tinyPNG()); err != nil {
		t.Fatalf("write form file: %v", err)
	}
	if err := writer.WriteField("kind", "image"); err != nil {
		t.Fatalf("write kind field: %v", err)
	}
	if err := writer.WriteField("variant", "preview"); err != nil {
		t.Fatalf("write variant field: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close multipart writer: %v", err)
	}

	uploadReq := httptest.NewRequest(http.MethodPost, "/api/projects/"+projectID+"/assets", &body)
	authorize(uploadReq, token)
	uploadReq.Header.Set("Content-Type", writer.FormDataContentType())
	uploadRes := httptest.NewRecorder()
	app.ServeHTTP(uploadRes, uploadReq)

	if uploadRes.Code != http.StatusBadRequest {
		t.Fatalf("upload status = %d body=%s", uploadRes.Code, uploadRes.Body.String())
	}
	if !bytes.Contains(uploadRes.Body.Bytes(), []byte(`"code":"INVALID_MULTIPART"`)) {
		t.Fatalf("expected INVALID_MULTIPART error: %s", uploadRes.Body.String())
	}
}

func TestAssetUploadRejectsMissingKindField(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", "pixel.png")
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	if _, err := part.Write(tinyPNG()); err != nil {
		t.Fatalf("write form file: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close multipart writer: %v", err)
	}

	uploadReq := httptest.NewRequest(http.MethodPost, "/api/projects/"+projectID+"/assets", &body)
	authorize(uploadReq, token)
	uploadReq.Header.Set("Content-Type", writer.FormDataContentType())
	uploadRes := httptest.NewRecorder()
	app.ServeHTTP(uploadRes, uploadReq)

	if uploadRes.Code != http.StatusBadRequest {
		t.Fatalf("upload status = %d body=%s", uploadRes.Code, uploadRes.Body.String())
	}
	if !bytes.Contains(uploadRes.Body.Bytes(), []byte(`"code":"INVALID_MULTIPART"`)) {
		t.Fatalf("expected INVALID_MULTIPART error: %s", uploadRes.Body.String())
	}
}

func TestAssetUploadAcceptsJpeg(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", "photo.jpg")
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	if _, err := part.Write([]byte{
		0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 'J', 'F', 'I', 'F', 0x00, 0x01,
		0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xD9,
	}); err != nil {
		t.Fatalf("write form file: %v", err)
	}
	if err := writer.WriteField("kind", "image"); err != nil {
		t.Fatalf("write kind field: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close multipart writer: %v", err)
	}

	uploadReq := httptest.NewRequest(http.MethodPost, "/api/projects/"+projectID+"/assets", &body)
	authorize(uploadReq, token)
	uploadReq.Header.Set("Content-Type", writer.FormDataContentType())
	uploadRes := httptest.NewRecorder()
	app.ServeHTTP(uploadRes, uploadReq)

	if uploadRes.Code != http.StatusCreated {
		t.Fatalf("upload status = %d body=%s", uploadRes.Code, uploadRes.Body.String())
	}
	if !bytes.Contains(uploadRes.Body.Bytes(), []byte(`"mimeType":"image/jpeg"`)) {
		t.Fatalf("expected jpeg asset metadata: %s", uploadRes.Body.String())
	}
}

func TestAssetUploadAcceptsFontMetadata(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", "brand.ttf")
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	if _, err := part.Write([]byte("ttf font bytes")); err != nil {
		t.Fatalf("write form file: %v", err)
	}
	if err := writer.WriteField("kind", "font"); err != nil {
		t.Fatalf("write field: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close multipart writer: %v", err)
	}

	uploadReq := httptest.NewRequest(http.MethodPost, "/api/projects/"+projectID+"/assets", &body)
	authorize(uploadReq, token)
	uploadReq.Header.Set("Content-Type", writer.FormDataContentType())
	uploadRes := httptest.NewRecorder()
	app.ServeHTTP(uploadRes, uploadReq)

	if uploadRes.Code != http.StatusCreated {
		t.Fatalf("upload status = %d body=%s", uploadRes.Code, uploadRes.Body.String())
	}
	if !bytes.Contains(uploadRes.Body.Bytes(), []byte(`"kind":"font"`)) {
		t.Fatalf("expected font asset metadata: %s", uploadRes.Body.String())
	}
	if !bytes.Contains(uploadRes.Body.Bytes(), []byte(`"mimeType":"font/ttf"`)) {
		t.Fatalf("expected font mime metadata: %s", uploadRes.Body.String())
	}
	if bytes.Contains(uploadRes.Body.Bytes(), []byte(`"width"`)) || bytes.Contains(uploadRes.Body.Bytes(), []byte(`"height"`)) {
		t.Fatalf("font metadata should not include image dimensions: %s", uploadRes.Body.String())
	}
}

func TestAssetDeleteRejectsReferencedAsset(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", "icon_heart.png")
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	if _, err := part.Write([]byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D}); err != nil {
		t.Fatalf("write form file: %v", err)
	}
	if err := writer.WriteField("kind", "image"); err != nil {
		t.Fatalf("write kind field: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close multipart writer: %v", err)
	}

	uploadReq := httptest.NewRequest(http.MethodPost, "/api/projects/"+projectID+"/assets", &body)
	authorize(uploadReq, token)
	uploadReq.Header.Set("Content-Type", writer.FormDataContentType())
	uploadRes := httptest.NewRecorder()
	app.ServeHTTP(uploadRes, uploadReq)
	if uploadRes.Code != http.StatusCreated {
		t.Fatalf("upload status = %d body=%s", uploadRes.Code, uploadRes.Body.String())
	}
	var uploadPayload struct {
		Asset struct {
			ID        string `json:"id"`
			ProjectID string `json:"projectId"`
			Name      string `json:"name"`
			Kind      string `json:"kind"`
			MimeType  string `json:"mimeType"`
			SizeBytes int64  `json:"sizeBytes"`
			ObjectKey string `json:"objectKey"`
			CreatedAt string `json:"createdAt"`
		} `json:"asset"`
	}
	if err := json.Unmarshal(uploadRes.Body.Bytes(), &uploadPayload); err != nil {
		t.Fatalf("decode upload response: %v", err)
	}

	saveBody := bytes.NewBufferString(fmt.Sprintf(`{"doc":{"schemaVersion":1,"id":"%[1]s","name":"Asset In Use","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[{"id":"image-1","type":"image","name":"Image_1","parentId":"root-screen-1","children":[],"layout":{"x":0,"y":0,"width":96,"height":96},"props":{"assetId":"%[2]s"},"style":{},"locked":false,"hidden":false}],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[{"id":"%[2]s","projectId":"%[3]s","name":"%[4]s","kind":"%[5]s","mimeType":"%[6]s","sizeBytes":%[7]d,"objectKey":"%[8]s","createdAt":"%[9]s"}],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`,
		projectID,
		uploadPayload.Asset.ID,
		uploadPayload.Asset.ProjectID,
		uploadPayload.Asset.Name,
		uploadPayload.Asset.Kind,
		uploadPayload.Asset.MimeType,
		uploadPayload.Asset.SizeBytes,
		uploadPayload.Asset.ObjectKey,
		uploadPayload.Asset.CreatedAt,
	))
	saveReq := httptest.NewRequest(http.MethodPut, "/api/projects/"+projectID+"/doc", saveBody)
	authorize(saveReq, token)
	saveRes := httptest.NewRecorder()
	app.ServeHTTP(saveRes, saveReq)
	if saveRes.Code != http.StatusOK {
		t.Fatalf("save status = %d body=%s", saveRes.Code, saveRes.Body.String())
	}

	deleteReq := httptest.NewRequest(http.MethodDelete, "/api/projects/"+projectID+"/assets/"+uploadPayload.Asset.ID, nil)
	authorize(deleteReq, token)
	deleteRes := httptest.NewRecorder()
	app.ServeHTTP(deleteRes, deleteReq)
	if deleteRes.Code != http.StatusConflict {
		t.Fatalf("delete status = %d body=%s", deleteRes.Code, deleteRes.Body.String())
	}
	if !bytes.Contains(deleteRes.Body.Bytes(), []byte(`"code":"ASSET_IN_USE"`)) {
		t.Fatalf("expected ASSET_IN_USE: %s", deleteRes.Body.String())
	}
	if !bytes.Contains(deleteRes.Body.Bytes(), []byte(`"message":"asset is still referenced by ProjectDoc"`)) {
		t.Fatalf("expected generic asset reference message: %s", deleteRes.Body.String())
	}
}

func TestAssetDeleteRejectsFontAssetReferencedByWidgetStyle(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", "watch_digits.ttf")
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	if _, err := part.Write([]byte("ttf font bytes")); err != nil {
		t.Fatalf("write form file: %v", err)
	}
	if err := writer.WriteField("kind", "font"); err != nil {
		t.Fatalf("write kind field: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close multipart writer: %v", err)
	}

	uploadReq := httptest.NewRequest(http.MethodPost, "/api/projects/"+projectID+"/assets", &body)
	authorize(uploadReq, token)
	uploadReq.Header.Set("Content-Type", writer.FormDataContentType())
	uploadRes := httptest.NewRecorder()
	app.ServeHTTP(uploadRes, uploadReq)
	if uploadRes.Code != http.StatusCreated {
		t.Fatalf("upload status = %d body=%s", uploadRes.Code, uploadRes.Body.String())
	}
	var uploadPayload struct {
		Asset struct {
			ID        string `json:"id"`
			ProjectID string `json:"projectId"`
			Name      string `json:"name"`
			Kind      string `json:"kind"`
			MimeType  string `json:"mimeType"`
			SizeBytes int64  `json:"sizeBytes"`
			ObjectKey string `json:"objectKey"`
			CreatedAt string `json:"createdAt"`
		} `json:"asset"`
	}
	if err := json.Unmarshal(uploadRes.Body.Bytes(), &uploadPayload); err != nil {
		t.Fatalf("decode upload response: %v", err)
	}

	saveBody := bytes.NewBufferString(fmt.Sprintf(`{"doc":{"schemaVersion":1,"id":"%[1]s","name":"Font Asset In Use","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[{"id":"label-1","type":"label","name":"Label_1","parentId":"root-screen-1","children":[],"layout":{"x":0,"y":0,"width":120,"height":32},"props":{"text":"A"},"style":{"font":"%[2]s"},"locked":false,"hidden":false}],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[{"id":"%[2]s","projectId":"%[3]s","name":"%[4]s","kind":"%[5]s","mimeType":"%[6]s","sizeBytes":%[7]d,"objectKey":"%[8]s","createdAt":"%[9]s"}],"styles":[],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`,
		projectID,
		uploadPayload.Asset.ID,
		uploadPayload.Asset.ProjectID,
		uploadPayload.Asset.Name,
		uploadPayload.Asset.Kind,
		uploadPayload.Asset.MimeType,
		uploadPayload.Asset.SizeBytes,
		uploadPayload.Asset.ObjectKey,
		uploadPayload.Asset.CreatedAt,
	))
	saveReq := httptest.NewRequest(http.MethodPut, "/api/projects/"+projectID+"/doc", saveBody)
	authorize(saveReq, token)
	saveRes := httptest.NewRecorder()
	app.ServeHTTP(saveRes, saveReq)
	if saveRes.Code != http.StatusOK {
		t.Fatalf("save status = %d body=%s", saveRes.Code, saveRes.Body.String())
	}

	deleteReq := httptest.NewRequest(http.MethodDelete, "/api/projects/"+projectID+"/assets/"+uploadPayload.Asset.ID, nil)
	authorize(deleteReq, token)
	deleteRes := httptest.NewRecorder()
	app.ServeHTTP(deleteRes, deleteReq)
	if deleteRes.Code != http.StatusConflict {
		t.Fatalf("delete status = %d body=%s", deleteRes.Code, deleteRes.Body.String())
	}
	if !bytes.Contains(deleteRes.Body.Bytes(), []byte(`"code":"ASSET_IN_USE"`)) {
		t.Fatalf("expected ASSET_IN_USE: %s", deleteRes.Body.String())
	}
	if !bytes.Contains(deleteRes.Body.Bytes(), []byte(`"message":"asset is still referenced by ProjectDoc"`)) {
		t.Fatalf("expected generic asset reference message: %s", deleteRes.Body.String())
	}
}

func TestAssetDeleteRejectsFontAssetReferencedByReusableStyle(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", "watch_digits.ttf")
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	if _, err := part.Write([]byte("ttf font bytes")); err != nil {
		t.Fatalf("write form file: %v", err)
	}
	if err := writer.WriteField("kind", "font"); err != nil {
		t.Fatalf("write kind field: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close multipart writer: %v", err)
	}

	uploadReq := httptest.NewRequest(http.MethodPost, "/api/projects/"+projectID+"/assets", &body)
	authorize(uploadReq, token)
	uploadReq.Header.Set("Content-Type", writer.FormDataContentType())
	uploadRes := httptest.NewRecorder()
	app.ServeHTTP(uploadRes, uploadReq)
	if uploadRes.Code != http.StatusCreated {
		t.Fatalf("upload status = %d body=%s", uploadRes.Code, uploadRes.Body.String())
	}
	var uploadPayload struct {
		Asset struct {
			ID        string `json:"id"`
			ProjectID string `json:"projectId"`
			Name      string `json:"name"`
			Kind      string `json:"kind"`
			MimeType  string `json:"mimeType"`
			SizeBytes int64  `json:"sizeBytes"`
			ObjectKey string `json:"objectKey"`
			CreatedAt string `json:"createdAt"`
		} `json:"asset"`
	}
	if err := json.Unmarshal(uploadRes.Body.Bytes(), &uploadPayload); err != nil {
		t.Fatalf("decode upload response: %v", err)
	}

	saveBody := bytes.NewBufferString(fmt.Sprintf(`{"doc":{"schemaVersion":1,"id":"%[1]s","name":"Font Asset In Reusable Style","target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16},"theme":"dark","screens":[{"id":"screen-1","name":"Screen_1","root":{"id":"root-screen-1","type":"screen","name":"Screen_1","parentId":null,"children":[],"layout":{"x":0,"y":0,"width":480,"height":480},"props":{},"style":{},"locked":false,"hidden":false}}],"assets":[{"id":"%[2]s","projectId":"%[3]s","name":"%[4]s","kind":"%[5]s","mimeType":"%[6]s","sizeBytes":%[7]d,"objectKey":"%[8]s","createdAt":"%[9]s"}],"styles":[{"id":"style-brand","name":"Brand","style":{"font":"%[2]s"}}],"events":[],"updatedAt":"2026-05-08T00:00:00Z"}}`,
		projectID,
		uploadPayload.Asset.ID,
		uploadPayload.Asset.ProjectID,
		uploadPayload.Asset.Name,
		uploadPayload.Asset.Kind,
		uploadPayload.Asset.MimeType,
		uploadPayload.Asset.SizeBytes,
		uploadPayload.Asset.ObjectKey,
		uploadPayload.Asset.CreatedAt,
	))
	saveReq := httptest.NewRequest(http.MethodPut, "/api/projects/"+projectID+"/doc", saveBody)
	authorize(saveReq, token)
	saveRes := httptest.NewRecorder()
	app.ServeHTTP(saveRes, saveReq)
	if saveRes.Code != http.StatusOK {
		t.Fatalf("save status = %d body=%s", saveRes.Code, saveRes.Body.String())
	}

	deleteReq := httptest.NewRequest(http.MethodDelete, "/api/projects/"+projectID+"/assets/"+uploadPayload.Asset.ID, nil)
	authorize(deleteReq, token)
	deleteRes := httptest.NewRecorder()
	app.ServeHTTP(deleteRes, deleteReq)
	if deleteRes.Code != http.StatusConflict {
		t.Fatalf("delete status = %d body=%s", deleteRes.Code, deleteRes.Body.String())
	}
	if !bytes.Contains(deleteRes.Body.Bytes(), []byte(`"code":"ASSET_IN_USE"`)) {
		t.Fatalf("expected ASSET_IN_USE: %s", deleteRes.Body.String())
	}
}

func TestAssetListReturnsEmptyArrayWhenProjectHasNoAssets(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	listReq := httptest.NewRequest(http.MethodGet, "/api/projects/"+projectID+"/assets", nil)
	authorize(listReq, token)
	listRes := httptest.NewRecorder()
	app.ServeHTTP(listRes, listReq)

	if listRes.Code != http.StatusOK {
		t.Fatalf("list status = %d body=%s", listRes.Code, listRes.Body.String())
	}
	if !bytes.Contains(listRes.Body.Bytes(), []byte(`"assets":[]`)) {
		t.Fatalf("expected empty asset array: %s", listRes.Body.String())
	}
}

func TestAssetUploadRejectsUnsupportedMimeType(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", "notes.txt")
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	if _, err := part.Write([]byte("hello")); err != nil {
		t.Fatalf("write form file: %v", err)
	}
	if err := writer.WriteField("kind", "image"); err != nil {
		t.Fatalf("write kind field: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close multipart writer: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/projects/"+projectID+"/assets", &body)
	authorize(req, token)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	res := httptest.NewRecorder()
	app.ServeHTTP(res, req)

	if res.Code != http.StatusBadRequest {
		t.Fatalf("status = %d body=%s", res.Code, res.Body.String())
	}
	if !bytes.Contains(res.Body.Bytes(), []byte(`"code":"UNSUPPORTED_ASSET_TYPE"`)) {
		t.Fatalf("expected unsupported asset error: %s", res.Body.String())
	}
}

func TestAssetUploadRejectsFilesOverFiveMegabytes(t *testing.T) {
	app := NewInMemoryServer()
	projectID, token := createTestProject(t, app)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", "large.png")
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	payload := append([]byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}, bytes.Repeat([]byte{0x00}, 5<<20)...)
	if _, err := part.Write(payload); err != nil {
		t.Fatalf("write form file: %v", err)
	}
	if err := writer.WriteField("kind", "image"); err != nil {
		t.Fatalf("write kind field: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close multipart writer: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/projects/"+projectID+"/assets", &body)
	authorize(req, token)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	res := httptest.NewRecorder()
	app.ServeHTTP(res, req)

	if res.Code != http.StatusBadRequest {
		t.Fatalf("status = %d body=%s", res.Code, res.Body.String())
	}
	if !bytes.Contains(res.Body.Bytes(), []byte(`"code":"ASSET_TOO_LARGE"`)) {
		t.Fatalf("expected asset too large error: %s", res.Body.String())
	}
}

func createTestProject(t *testing.T, app http.Handler) (string, string) {
	t.Helper()
	token := loginTestUser(t, app)

	createBody := bytes.NewBufferString(`{
		"name":"My Watch UI",
		"target":{"lvglVersion":"8.3","deviceName":"ESP32-S3","width":480,"height":480,"dpi":240,"colorDepth":16}
	}`)
	createReq := httptest.NewRequest(http.MethodPost, "/api/projects", createBody)
	authorize(createReq, token)
	createRes := httptest.NewRecorder()
	app.ServeHTTP(createRes, createReq)
	if createRes.Code != http.StatusCreated {
		t.Fatalf("create project status = %d body=%s", createRes.Code, createRes.Body.String())
	}
	var createPayload struct {
		Project struct {
			ID string `json:"id"`
		} `json:"project"`
	}
	if err := json.Unmarshal(createRes.Body.Bytes(), &createPayload); err != nil {
		t.Fatalf("decode create response: %v", err)
	}
	return createPayload.Project.ID, token
}

func loginTestUser(t *testing.T, app http.Handler) string {
	t.Helper()
	return loginTestUserAs(t, app, "demo@hiveton.dev")
}

func loginTestUserAs(t *testing.T, app http.Handler, email string) string {
	t.Helper()

	loginReq := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewBufferString(`{
		"email":"`+email+`",
		"password":"password"
	}`))
	loginRes := httptest.NewRecorder()
	app.ServeHTTP(loginRes, loginReq)
	if loginRes.Code != http.StatusOK {
		t.Fatalf("login status = %d body=%s", loginRes.Code, loginRes.Body.String())
	}
	var payload struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(loginRes.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode login response: %v", err)
	}
	return payload.Token
}

func authorize(request *http.Request, token string) {
	request.Header.Set("Authorization", "Bearer "+token)
}
