package server

import "net/http"

func health(writer http.ResponseWriter, _ *http.Request) {
	writeJSON(writer, http.StatusOK, map[string]any{
		"ok":      true,
		"service": "lvgl-online-editor-api",
	})
}
