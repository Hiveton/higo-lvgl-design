cmake_minimum_required(VERSION 3.20)
project(lvgl_editor_runtime C)

if(NOT DEFINED LVGL_DIR)
  message(FATAL_ERROR "LVGL_DIR is required. Run npm run wasm:build or pass -DLVGL_DIR=/path/to/lvgl")
endif()

set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)
set(CMAKE_EXECUTABLE_SUFFIX ".js")

file(GLOB_RECURSE LVGL_SOURCES
  "${LVGL_DIR}/src/*.c"
)

add_executable(lvgl-editor-runtime
  runtime.c
  ${LVGL_SOURCES}
)

target_include_directories(lvgl-editor-runtime PRIVATE
  "${CMAKE_CURRENT_SOURCE_DIR}"
  "${LVGL_DIR}"
  "${LVGL_DIR}/src"
)

target_compile_definitions(lvgl-editor-runtime PRIVATE
  LV_CONF_INCLUDE_SIMPLE
)

target_link_options(lvgl-editor-runtime PRIVATE
  "-sMODULARIZE=1"
  "-sEXPORT_ES6=1"
  "-sENVIRONMENT=web,node"
  "-sALLOW_MEMORY_GROWTH=1"
  "-sEXPORTED_RUNTIME_METHODS=['cwrap','UTF8ToString','stringToUTF8','lengthBytesUTF8','HEAPU8']"
  "-sEXPORTED_FUNCTIONS=['_malloc','_free','_lvgl_editor_init','_lvgl_editor_resize','_lvgl_editor_render_project_json','_lvgl_editor_last_screen_name','_lvgl_editor_last_widget_names','_lvgl_editor_last_widget_parent_names','_lvgl_editor_framebuffer_rgba','_lvgl_editor_framebuffer_width','_lvgl_editor_framebuffer_height','_lvgl_editor_destroy']"
)
