#include <emscripten/emscripten.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "lvgl.h"

static lv_disp_draw_buf_t draw_buf;
static lv_disp_drv_t disp_drv;
static lv_color_t *framebuffer_a;
static lv_color_t *framebuffer_b;
static uint8_t *framebuffer_rgba;
static uint32_t display_width = 480;
static uint32_t display_height = 480;
static char last_screen_name[128] = "";
static char last_widget_names[2048] = "";
static char last_widget_parent_names[4096] = "";
static lv_style_t widget_styles[256];
static size_t widget_style_count = 0;

static void flush_cb(lv_disp_drv_t *drv, const lv_area_t *area, lv_color_t *color_p) {
    if (framebuffer_rgba && area && color_p) {
        int32_t area_width = area->x2 - area->x1 + 1;
        for (int32_t y = area->y1; y <= area->y2; y++) {
            if (y < 0 || y >= (int32_t)display_height) {
                continue;
            }
            for (int32_t x = area->x1; x <= area->x2; x++) {
                if (x < 0 || x >= (int32_t)display_width) {
                    continue;
                }
                size_t src_index = (size_t)(y - area->y1) * (size_t)area_width + (size_t)(x - area->x1);
                size_t dst_index = ((size_t)y * (size_t)display_width + (size_t)x) * 4U;
                lv_color_t color = color_p[src_index];
#if LV_COLOR_DEPTH == 32
                framebuffer_rgba[dst_index] = color.ch.red;
                framebuffer_rgba[dst_index + 1] = color.ch.green;
                framebuffer_rgba[dst_index + 2] = color.ch.blue;
#else
                uint32_t color32 = lv_color_to32(color);
                framebuffer_rgba[dst_index] = (uint8_t)((color32 >> 16) & 0xffU);
                framebuffer_rgba[dst_index + 1] = (uint8_t)((color32 >> 8) & 0xffU);
                framebuffer_rgba[dst_index + 2] = (uint8_t)(color32 & 0xffU);
#endif
                framebuffer_rgba[dst_index + 3] = 255U;
            }
        }
    }
    lv_disp_flush_ready(drv);
}

static void reset_framebuffer(uint32_t width, uint32_t height) {
    display_width = width == 0 ? 480 : width;
    display_height = height == 0 ? 480 : height;
    size_t pixel_count = (size_t)display_width * (size_t)display_height;
    framebuffer_a = realloc(framebuffer_a, pixel_count * sizeof(lv_color_t));
    framebuffer_b = realloc(framebuffer_b, pixel_count * sizeof(lv_color_t));
    framebuffer_rgba = realloc(framebuffer_rgba, pixel_count * 4U);
    if (framebuffer_rgba) {
        memset(framebuffer_rgba, 0, pixel_count * 4U);
    }
    lv_disp_draw_buf_init(&draw_buf, framebuffer_a, framebuffer_b, pixel_count);
    lv_disp_drv_init(&disp_drv);
    disp_drv.hor_res = (lv_coord_t)display_width;
    disp_drv.ver_res = (lv_coord_t)display_height;
    disp_drv.flush_cb = flush_cb;
    disp_drv.draw_buf = &draw_buf;
    lv_disp_drv_register(&disp_drv);
}

static int copy_json_string_value_at(const char *key_pos, char *dest, size_t dest_size) {
    if (!key_pos || !dest || dest_size == 0) {
        return 0;
    }
    const char *colon = strchr(key_pos, ':');
    if (!colon) {
        return 0;
    }
    const char *start = strchr(colon, '"');
    if (!start) {
        return 0;
    }
    start++;
    const char *end = strchr(start, '"');
    if (!end) {
        return 0;
    }
    size_t len = (size_t)(end - start);
    if (len >= dest_size) {
        len = dest_size - 1;
    }
    memcpy(dest, start, len);
    dest[len] = '\0';
    return 1;
}

static int copy_json_string_value_after(const char *json, const char *key, char *dest, size_t dest_size) {
    if (!json || !key || !dest || dest_size == 0) {
        return 0;
    }
    char pattern[64];
    snprintf(pattern, sizeof(pattern), "\"%s\"", key);
    const char *key_pos = strstr(json, pattern);
    return copy_json_string_value_at(key_pos, dest, dest_size);
}

static int copy_json_int_value_after(const char *json, const char *key, int fallback) {
    if (!json || !key) {
        return fallback;
    }
    char pattern[64];
    snprintf(pattern, sizeof(pattern), "\"%s\"", key);
    const char *key_pos = strstr(json, pattern);
    if (!key_pos) {
        return fallback;
    }
    const char *colon = strchr(key_pos, ':');
    if (!colon) {
        return fallback;
    }
    return (int)strtol(colon + 1, NULL, 10);
}

static int copy_json_bool_value_after(const char *json, const char *key, int fallback) {
    if (!json || !key) {
        return fallback;
    }
    char pattern[64];
    snprintf(pattern, sizeof(pattern), "\"%s\"", key);
    const char *key_pos = strstr(json, pattern);
    if (!key_pos) {
        return fallback;
    }
    const char *colon = strchr(key_pos, ':');
    if (!colon) {
        return fallback;
    }
    const char *value = colon + 1;
    while (*value == ' ' || *value == '\n' || *value == '\r' || *value == '\t') {
        value++;
    }
    if (strncmp(value, "true", 4) == 0) {
        return 1;
    }
    if (strncmp(value, "false", 5) == 0) {
        return 0;
    }
    return fallback;
}

static const char *bounded_strstr(const char *start, const char *end, const char *needle) {
    if (!start || !end || !needle || start > end) {
        return NULL;
    }
    size_t needle_len = strlen(needle);
    if (needle_len == 0) {
        return start;
    }
    for (const char *cursor = start; cursor + needle_len <= end; cursor++) {
        if (memcmp(cursor, needle, needle_len) == 0) {
            return cursor;
        }
    }
    return NULL;
}

static const char *find_json_matching(const char *open) {
    if (!open || (*open != '{' && *open != '[')) {
        return NULL;
    }
    char open_ch = *open;
    char close_ch = open_ch == '{' ? '}' : ']';
    int depth = 0;
    int in_string = 0;
    int escaped = 0;
    for (const char *cursor = open; *cursor; cursor++) {
        char ch = *cursor;
        if (in_string) {
            if (escaped) {
                escaped = 0;
            } else if (ch == '\\') {
                escaped = 1;
            } else if (ch == '"') {
                in_string = 0;
            }
            continue;
        }
        if (ch == '"') {
            in_string = 1;
            continue;
        }
        if (ch == open_ch) {
            depth++;
        } else if (ch == close_ch) {
            depth--;
            if (depth == 0) {
                return cursor;
            }
        }
    }
    return NULL;
}

static const char *find_json_array_for_key(const char *start, const char *end, const char *key) {
    char pattern[64];
    snprintf(pattern, sizeof(pattern), "\"%s\"", key);
    const char *key_pos = bounded_strstr(start, end, pattern);
    if (!key_pos) {
        return NULL;
    }
    const char *colon = memchr(key_pos, ':', (size_t)(end - key_pos));
    if (!colon) {
        return NULL;
    }
    const char *array_start = memchr(colon, '[', (size_t)(end - colon));
    if (!array_start || array_start > end) {
        return NULL;
    }
    return array_start;
}

static int copy_json_int_array_after(const char *json, const char *key, int *dest, int max_count) {
    if (!json || !key || !dest || max_count <= 0) {
        return 0;
    }
    const char *array_start = find_json_array_for_key(json, json + strlen(json), key);
    if (!array_start) {
        return 0;
    }
    const char *array_end = find_json_matching(array_start);
    if (!array_end) {
        return 0;
    }
    int count = 0;
    const char *cursor = array_start + 1;
    while (cursor < array_end && count < max_count) {
        while (cursor < array_end && (*cursor == ' ' || *cursor == '\n' || *cursor == '\r' || *cursor == '\t' || *cursor == ',')) {
            cursor++;
        }
        if (cursor >= array_end) {
            break;
        }
        char *next = NULL;
        long value = strtol(cursor, &next, 10);
        if (next == cursor) {
            break;
        }
        dest[count++] = (int)value;
        cursor = next;
    }
    return count;
}

static int parse_hex_color(const char *value, lv_color_t *color) {
    if (!value || !color) {
        return 0;
    }
    const char *cursor = value[0] == '#' ? value + 1 : value;
    size_t len = strlen(cursor);
    unsigned int r = 0;
    unsigned int g = 0;
    unsigned int b = 0;
    if (len == 3) {
        unsigned int packed = 0;
        if (sscanf(cursor, "%3x", &packed) != 1) {
            return 0;
        }
        r = ((packed >> 8) & 0xFU) * 17U;
        g = ((packed >> 4) & 0xFU) * 17U;
        b = (packed & 0xFU) * 17U;
    } else if (len == 6) {
        unsigned int packed = 0;
        if (sscanf(cursor, "%6x", &packed) != 1) {
            return 0;
        }
        r = (packed >> 16) & 0xFFU;
        g = (packed >> 8) & 0xFFU;
        b = packed & 0xFFU;
    } else {
        return 0;
    }
    *color = lv_color_make((uint8_t)r, (uint8_t)g, (uint8_t)b);
    return 1;
}

static void reset_widget_styles(void) {
    for (size_t i = 0; i < widget_style_count; i++) {
        lv_style_reset(&widget_styles[i]);
    }
    widget_style_count = 0;
}

static void apply_widget_style(lv_obj_t *obj, const char *widget_json) {
    if (!obj || !widget_json || widget_style_count >= (sizeof(widget_styles) / sizeof(widget_styles[0]))) {
        return;
    }
    const char *style_json = strstr(widget_json, "\"style\"");
    if (!style_json) {
        return;
    }
    char value[64];
    lv_color_t color;
    lv_style_t *style = &widget_styles[widget_style_count++];
    lv_style_init(style);
    int has_style = 0;
    if (copy_json_string_value_after(style_json, "bgColor", value, sizeof(value)) && parse_hex_color(value, &color)) {
        lv_style_set_bg_opa(style, LV_OPA_COVER);
        lv_style_set_bg_color(style, color);
        has_style = 1;
    }
    if (copy_json_string_value_after(style_json, "textColor", value, sizeof(value)) && parse_hex_color(value, &color)) {
        lv_style_set_text_color(style, color);
        has_style = 1;
    }
    if (copy_json_string_value_after(style_json, "borderColor", value, sizeof(value)) && parse_hex_color(value, &color)) {
        lv_style_set_border_color(style, color);
        lv_style_set_border_width(style, 1);
        has_style = 1;
    }
    int radius = copy_json_int_value_after(style_json, "radius", -1);
    if (radius >= 0) {
        lv_style_set_radius(style, (lv_coord_t)radius);
        has_style = 1;
    }
    int opacity = copy_json_int_value_after(style_json, "opacity", -1);
    if (opacity >= 0 && opacity <= 100) {
        lv_style_set_opa(style, (lv_opa_t)((opacity * 255) / 100));
        has_style = 1;
    }
    if (copy_json_string_value_after(style_json, "font", value, sizeof(value))) {
        if (strcmp(value, "lv_font_montserrat_48") == 0) {
            lv_style_set_text_font(style, &lv_font_montserrat_48);
            has_style = 1;
        } else if (strcmp(value, "lv_font_montserrat_32") == 0) {
            lv_style_set_text_font(style, &lv_font_montserrat_32);
            has_style = 1;
        } else if (strcmp(value, "lv_font_montserrat_20") == 0) {
            lv_style_set_text_font(style, &lv_font_montserrat_20);
            has_style = 1;
        } else if (strcmp(value, "lv_font_montserrat_14") == 0) {
            lv_style_set_text_font(style, &lv_font_montserrat_14);
            has_style = 1;
        }
    }
    if (copy_json_string_value_after(style_json, "align", value, sizeof(value))) {
        if (strcmp(value, "center") == 0) {
            lv_style_set_text_align(style, LV_TEXT_ALIGN_CENTER);
            has_style = 1;
        } else if (strcmp(value, "right") == 0) {
            lv_style_set_text_align(style, LV_TEXT_ALIGN_RIGHT);
            has_style = 1;
        } else {
            lv_style_set_text_align(style, LV_TEXT_ALIGN_LEFT);
            has_style = 1;
        }
    }
    int letter_space = copy_json_int_value_after(style_json, "letterSpace", 0);
    if (letter_space != 0) {
        lv_style_set_text_letter_space(style, (lv_coord_t)letter_space);
        has_style = 1;
    }
    int line_space = copy_json_int_value_after(style_json, "lineSpace", 0);
    if (line_space != 0) {
        lv_style_set_text_line_space(style, (lv_coord_t)line_space);
        has_style = 1;
    }
    const char *padding = strstr(style_json, "\"padding\"");
    if (padding) {
        int pad_top = copy_json_int_value_after(padding, "top", 0);
        int pad_right = copy_json_int_value_after(padding, "right", 0);
        int pad_bottom = copy_json_int_value_after(padding, "bottom", 0);
        int pad_left = copy_json_int_value_after(padding, "left", 0);
        if (pad_top != 0) {
            lv_style_set_pad_top(style, (lv_coord_t)pad_top);
            has_style = 1;
        }
        if (pad_right != 0) {
            lv_style_set_pad_right(style, (lv_coord_t)pad_right);
            has_style = 1;
        }
        if (pad_bottom != 0) {
            lv_style_set_pad_bottom(style, (lv_coord_t)pad_bottom);
            has_style = 1;
        }
        if (pad_left != 0) {
            lv_style_set_pad_left(style, (lv_coord_t)pad_left);
            has_style = 1;
        }
    }
    if (has_style) {
        lv_obj_add_style(obj, style, 0);
        return;
    }
    widget_style_count--;
    lv_style_reset(style);
}

static void apply_screen_style(const char *json) {
    const char *root = strstr(json, "\"root\"");
    const char *style_json = root ? strstr(root, "\"style\"") : NULL;
    char value[64];
    lv_color_t color;
    if (style_json && copy_json_string_value_after(style_json, "bgColor", value, sizeof(value)) && parse_hex_color(value, &color)) {
        lv_obj_set_style_bg_color(lv_scr_act(), color, 0);
        lv_obj_set_style_bg_opa(lv_scr_act(), LV_OPA_COVER, 0);
    }
}

static int copy_project_screen_name(const char *json, char *dest, size_t dest_size) {
    const char *screens = strstr(json, "\"screens\"");
    if (screens && copy_json_string_value_after(screens, "name", dest, dest_size)) {
        return 1;
    }
    return copy_json_string_value_after(json, "name", dest, dest_size);
}

static void append_widget_name(const char *name, size_t name_len) {
    size_t current_len = strlen(last_widget_names);
    if (current_len > 0 && current_len + 1 < sizeof(last_widget_names)) {
        last_widget_names[current_len] = ',';
        last_widget_names[current_len + 1] = '\0';
        current_len++;
    }
    size_t remaining = sizeof(last_widget_names) - current_len - 1;
    if (remaining == 0) {
        return;
    }
    size_t copy_len = name_len > remaining ? remaining : name_len;
    memcpy(last_widget_names + current_len, name, copy_len);
    last_widget_names[current_len + copy_len] = '\0';
}

static void append_widget_parent_name(const char *name, const char *parent_name) {
    size_t current_len = strlen(last_widget_parent_names);
    if (current_len > 0 && current_len + 1 < sizeof(last_widget_parent_names)) {
        last_widget_parent_names[current_len] = ',';
        last_widget_parent_names[current_len + 1] = '\0';
        current_len++;
    }
    size_t remaining = sizeof(last_widget_parent_names) - current_len - 1;
    if (remaining == 0) {
        return;
    }
    int written = snprintf(
        last_widget_parent_names + current_len,
        remaining + 1,
        "%s:%s",
        name ? name : "",
        parent_name ? parent_name : ""
    );
    if (written < 0 || (size_t)written > remaining) {
        last_widget_parent_names[sizeof(last_widget_parent_names) - 1] = '\0';
    }
}

static void set_widget_geometry(lv_obj_t *obj, const char *widget_json, int fallback_width, int fallback_height) {
    const char *layout = strstr(widget_json, "\"layout\"");
    int x = copy_json_int_value_after(layout, "x", 0);
    int y = copy_json_int_value_after(layout, "y", 0);
    int width = copy_json_int_value_after(layout, "width", fallback_width);
    int height = copy_json_int_value_after(layout, "height", fallback_height);
    lv_obj_set_pos(obj, (lv_coord_t)x, (lv_coord_t)y);
    lv_obj_set_size(obj, (lv_coord_t)width, (lv_coord_t)height);
}

static lv_align_t lvgl_align_from_value(const char *value) {
    if (strcmp(value, "top-right") == 0) {
        return LV_ALIGN_TOP_RIGHT;
    }
    if (strcmp(value, "center") == 0) {
        return LV_ALIGN_CENTER;
    }
    if (strcmp(value, "bottom-left") == 0) {
        return LV_ALIGN_BOTTOM_LEFT;
    }
    if (strcmp(value, "bottom-right") == 0) {
        return LV_ALIGN_BOTTOM_RIGHT;
    }
    return LV_ALIGN_TOP_LEFT;
}

static lv_flex_flow_t lvgl_flex_flow_from_layout(const char *flex_json) {
    char direction[24] = "row";
    int wrap = copy_json_bool_value_after(flex_json, "wrap", 0);
    copy_json_string_value_after(flex_json, "direction", direction, sizeof(direction));
    if (strcmp(direction, "column") == 0) {
        return wrap ? LV_FLEX_FLOW_COLUMN_WRAP : LV_FLEX_FLOW_COLUMN;
    }
    return wrap ? LV_FLEX_FLOW_ROW_WRAP : LV_FLEX_FLOW_ROW;
}

static void apply_widget_layout(lv_obj_t *obj, const char *widget_json) {
    if (!obj || !widget_json) {
        return;
    }
    const char *layout = strstr(widget_json, "\"layout\"");
    if (!layout) {
        return;
    }
    int x = copy_json_int_value_after(layout, "x", 0);
    int y = copy_json_int_value_after(layout, "y", 0);
    char align[32];
    if (copy_json_string_value_after(layout, "align", align, sizeof(align))) {
        lv_obj_align(obj, lvgl_align_from_value(align), (lv_coord_t)x, (lv_coord_t)y);
    }
    const char *flex = strstr(layout, "\"flex\"");
    if (flex) {
        int gap = copy_json_int_value_after(flex, "gap", 0);
        lv_obj_set_layout(obj, LV_LAYOUT_FLEX);
        lv_obj_set_flex_flow(obj, lvgl_flex_flow_from_layout(flex));
        if (gap != 0) {
            lv_obj_set_style_pad_row(obj, (lv_coord_t)gap, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_column(obj, (lv_coord_t)gap, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
    }
}

static void set_hidden_flag(lv_obj_t *obj, const char *widget_json) {
    if (copy_json_bool_value_after(widget_json, "hidden", 0)) {
        lv_obj_add_flag(obj, LV_OBJ_FLAG_HIDDEN);
    }
}

static void copy_widget_text(const char *widget_json, const char *fallback, char *dest, size_t dest_size) {
    const char *props = strstr(widget_json, "\"props\"");
    if (props && copy_json_string_value_after(props, "text", dest, dest_size)) {
        return;
    }
    if (fallback) {
        snprintf(dest, dest_size, "%s", fallback);
        return;
    }
    if (dest_size > 0) {
        dest[0] = '\0';
    }
}

static void apply_range_value(lv_obj_t *obj, const char *widget_json, const char *setter_kind) {
    const char *props = strstr(widget_json, "\"props\"");
    int min = copy_json_int_value_after(props, "min", 0);
    int max = copy_json_int_value_after(props, "max", 100);
    int value = copy_json_int_value_after(props, "value", min);
    if (strcmp(setter_kind, "arc") == 0) {
        lv_arc_set_range(obj, min, max);
        lv_arc_set_value(obj, value);
    } else if (strcmp(setter_kind, "bar") == 0) {
        lv_bar_set_range(obj, min, max);
        lv_bar_set_value(obj, value, LV_ANIM_OFF);
    } else if (strcmp(setter_kind, "slider") == 0) {
        lv_slider_set_range(obj, min, max);
        lv_slider_set_value(obj, value, LV_ANIM_OFF);
    }
}

static int clamp_int(int value, int min, int max) {
    if (value < min) {
        return min;
    }
    if (value > max) {
        return max;
    }
    return value;
}

static void apply_chart_values(lv_obj_t *chart, const char *widget_json) {
    const char *props = strstr(widget_json, "\"props\"");
    int min = copy_json_int_value_after(props, "min", 0);
    int max = copy_json_int_value_after(props, "max", 100);
    int point_count = copy_json_int_value_after(props, "pointCount", 8);
    if (point_count <= 0) {
        point_count = 8;
    }
    if (max < min) {
        int next_min = max;
        max = min;
        min = next_min;
    }
    lv_chart_set_type(chart, LV_CHART_TYPE_LINE);
    lv_chart_set_range(chart, LV_CHART_AXIS_PRIMARY_Y, (lv_coord_t)min, (lv_coord_t)max);
    lv_chart_set_point_count(chart, (uint16_t)point_count);
    lv_chart_series_t *series = lv_chart_add_series(chart, lv_palette_main(LV_PALETTE_BLUE), LV_CHART_AXIS_PRIMARY_Y);
    int values[64];
    int value_count = copy_json_int_array_after(props, "values", values, point_count < 64 ? point_count : 64);
    if (value_count > 0) {
        for (int index = 0; index < value_count; index++) {
            lv_chart_set_next_value(chart, series, (lv_coord_t)clamp_int(values[index], min, max));
        }
    } else {
        int span = max - min;
        for (int index = 0; index < point_count && index < 64; index++) {
            int value = min + ((index * 37 + 20) % (span + 1));
            lv_chart_set_next_value(chart, series, (lv_coord_t)value);
        }
    }
    lv_chart_refresh(chart);
}

static lv_obj_t *create_widget_from_json(lv_obj_t *parent, const char *type, const char *name, const char *widget_json) {
    if (!parent) {
        parent = lv_scr_act();
    }
    char text[256];
    if (strcmp(type, "container") == 0) {
        return lv_obj_create(parent);
    }
    if (strcmp(type, "button") == 0) {
        lv_obj_t *button = lv_btn_create(parent);
        copy_widget_text(widget_json, name, text, sizeof(text));
        lv_obj_t *label = lv_label_create(button);
        lv_label_set_text(label, text);
        lv_obj_center(label);
        return button;
    }
    if (strcmp(type, "label") == 0) {
        lv_obj_t *label = lv_label_create(parent);
        copy_widget_text(widget_json, name, text, sizeof(text));
        lv_label_set_text(label, text);
        return label;
    }
    if (strcmp(type, "image") == 0) {
        lv_obj_t *image = lv_img_create(parent);
        copy_widget_text(widget_json, name, text, sizeof(text));
        lv_obj_t *caption = lv_label_create(image);
        lv_label_set_text(caption, text);
        lv_obj_center(caption);
        return image;
    }
    if (strcmp(type, "arc") == 0) {
        lv_obj_t *arc = lv_arc_create(parent);
        apply_range_value(arc, widget_json, "arc");
        return arc;
    }
    if (strcmp(type, "bar") == 0) {
        lv_obj_t *bar = lv_bar_create(parent);
        apply_range_value(bar, widget_json, "bar");
        return bar;
    }
    if (strcmp(type, "line") == 0) {
        static lv_point_t line_points[2];
        const char *layout = strstr(widget_json, "\"layout\"");
        line_points[0].x = 0;
        line_points[0].y = 0;
        line_points[1].x = (lv_coord_t)copy_json_int_value_after(layout, "width", 80);
        line_points[1].y = (lv_coord_t)copy_json_int_value_after(layout, "height", 40);
        lv_obj_t *line = lv_line_create(parent);
        lv_line_set_points(line, line_points, 2);
        return line;
    }
    if (strcmp(type, "switch") == 0) {
        lv_obj_t *sw = lv_switch_create(parent);
        const char *props = strstr(widget_json, "\"props\"");
        if (copy_json_bool_value_after(props, "checked", 0)) {
            lv_obj_add_state(sw, LV_STATE_CHECKED);
        }
        return sw;
    }
    if (strcmp(type, "slider") == 0) {
        lv_obj_t *slider = lv_slider_create(parent);
        apply_range_value(slider, widget_json, "slider");
        return slider;
    }
    if (strcmp(type, "checkbox") == 0) {
        lv_obj_t *checkbox = lv_checkbox_create(parent);
        copy_widget_text(widget_json, name, text, sizeof(text));
        lv_checkbox_set_text(checkbox, text);
        const char *props = strstr(widget_json, "\"props\"");
        if (copy_json_bool_value_after(props, "checked", 0)) {
            lv_obj_add_state(checkbox, LV_STATE_CHECKED);
        }
        return checkbox;
    }
    if (strcmp(type, "dropdown") == 0) {
        lv_obj_t *dropdown = lv_dropdown_create(parent);
        const char *props = strstr(widget_json, "\"props\"");
        if (props && copy_json_string_value_after(props, "options", text, sizeof(text))) {
            lv_dropdown_set_options(dropdown, text);
        }
        int selected = copy_json_int_value_after(props, "selected", 0);
        if (selected >= 0) {
            lv_dropdown_set_selected(dropdown, (uint16_t)selected);
        }
        return dropdown;
    }
    if (strcmp(type, "spinner") == 0) {
        const char *props = strstr(widget_json, "\"props\"");
        int spin_time = copy_json_int_value_after(props, "spinTime", 1000);
        int arc_length = copy_json_int_value_after(props, "arcLength", 60);
        return lv_spinner_create(parent, (uint32_t)spin_time, (uint32_t)arc_length);
    }
    if (strcmp(type, "chart") == 0) {
        lv_obj_t *chart = lv_chart_create(parent);
        apply_chart_values(chart, widget_json);
        return chart;
    }
    return lv_obj_create(parent);
}

static int render_widget_children(const char *children_start, const char *children_end, lv_obj_t *parent, const char *parent_name, int parent_hidden) {
    int rendered_count = 0;
    const char *cursor = children_start + 1;
    while (cursor && cursor < children_end) {
        const char *object_start = memchr(cursor, '{', (size_t)(children_end - cursor));
        if (!object_start || object_start >= children_end) {
            break;
        }
        const char *object_end = find_json_matching(object_start);
        if (!object_end || object_end > children_end) {
            break;
        }
        const char *type_pos = bounded_strstr(object_start, object_end, "\"type\"");
        char type[32];
        char name[128];
        if (!copy_json_string_value_at(type_pos, type, sizeof(type))) {
            break;
        }
        if (strcmp(type, "screen") == 0) {
            cursor = object_end + 1;
            continue;
        }
        if (!copy_json_string_value_after(type_pos, "name", name, sizeof(name))) {
            snprintf(name, sizeof(name), "%s_%d", type, rendered_count + 1);
        }
        lv_obj_t *obj = create_widget_from_json(parent, type, name, type_pos);
        set_widget_geometry(obj, type_pos, 80, 40);
        apply_widget_layout(obj, type_pos);
        apply_widget_style(obj, type_pos);
        set_hidden_flag(obj, type_pos);
        int hidden = parent_hidden || copy_json_bool_value_after(type_pos, "hidden", 0);
        if (!hidden) {
            append_widget_name(name, strlen(name));
            append_widget_parent_name(name, parent_name);
        }
        const char *nested_children = find_json_array_for_key(object_start, object_end, "children");
        if (nested_children) {
            const char *nested_end = find_json_matching(nested_children);
            if (nested_end && nested_end <= object_end) {
                rendered_count += render_widget_children(nested_children, nested_end, obj, name, hidden);
            }
        }
        rendered_count++;
        cursor = object_end + 1;
    }
    return rendered_count;
}

static int render_project_widgets(const char *json) {
    const char *root = strstr(json, "\"root\"");
    const char *assets = strstr(json, "\"assets\"");
    const char *search_end = assets ? assets : json + strlen(json);
    const char *children = root ? find_json_array_for_key(root, search_end, "children") : NULL;
    if (!children) {
        children = find_json_array_for_key(json, search_end, "children");
    }
    if (!children) {
        return 0;
    }
    const char *children_end = find_json_matching(children);
    if (!children_end || children_end > search_end) {
        return 0;
    }
    apply_widget_layout(lv_scr_act(), root);
    return render_widget_children(children, children_end, lv_scr_act(), last_screen_name, 0);
}

EMSCRIPTEN_KEEPALIVE
int lvgl_editor_init(uint32_t width, uint32_t height) {
    lv_init();
    reset_framebuffer(width, height);
    return 0;
}

EMSCRIPTEN_KEEPALIVE
void lvgl_editor_resize(uint32_t width, uint32_t height) {
    reset_framebuffer(width, height);
}

EMSCRIPTEN_KEEPALIVE
int lvgl_editor_render_project_json(const char *project_json) {
    if (!project_json) {
        return -1;
    }
    copy_project_screen_name(project_json, last_screen_name, sizeof(last_screen_name));
    last_widget_names[0] = '\0';
    last_widget_parent_names[0] = '\0';
    lv_obj_clean(lv_scr_act());
    reset_widget_styles();
    apply_screen_style(project_json);
    int rendered_count = render_project_widgets(project_json);
    if (rendered_count == 0) {
        lv_obj_t *label = lv_label_create(lv_scr_act());
        lv_label_set_text(label, last_screen_name[0] ? last_screen_name : "LVGL Online Editor");
        lv_obj_center(label);
    }
    lv_timer_handler();
    lv_refr_now(NULL);
    return 0;
}

EMSCRIPTEN_KEEPALIVE
const char *lvgl_editor_last_screen_name(void) {
    return last_screen_name;
}

EMSCRIPTEN_KEEPALIVE
const char *lvgl_editor_last_widget_names(void) {
    return last_widget_names;
}

EMSCRIPTEN_KEEPALIVE
const char *lvgl_editor_last_widget_parent_names(void) {
    return last_widget_parent_names;
}

EMSCRIPTEN_KEEPALIVE
uint8_t *lvgl_editor_framebuffer_rgba(void) {
    return framebuffer_rgba;
}

EMSCRIPTEN_KEEPALIVE
uint32_t lvgl_editor_framebuffer_width(void) {
    return display_width;
}

EMSCRIPTEN_KEEPALIVE
uint32_t lvgl_editor_framebuffer_height(void) {
    return display_height;
}

EMSCRIPTEN_KEEPALIVE
void lvgl_editor_destroy(void) {
    free(framebuffer_a);
    free(framebuffer_b);
    free(framebuffer_rgba);
    framebuffer_a = NULL;
    framebuffer_b = NULL;
    framebuffer_rgba = NULL;
    last_screen_name[0] = '\0';
    last_widget_names[0] = '\0';
    last_widget_parent_names[0] = '\0';
}
