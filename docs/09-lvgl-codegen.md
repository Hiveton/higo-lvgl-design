# LVGL C 代码生成

## 目标

定义第一版 LVGL C codegen 的输入、输出、命名规则、控件映射和验收标准。

## 适用范围

适用于 Go 后端 `internal/codegen`。Codegen 输入为 `ProjectDoc`，输出为可下载 zip 中的一组 C 源文件。

## 非目标

第一版不生成完整硬件工程、不调用厂商 SDK、不处理业务逻辑、不实现完整 LVGL 全量属性映射。

## 输入

Codegen 只接收 `ProjectDoc`：

```go
func GenerateC(doc ProjectDoc) (GeneratedProject, error)
```

建议输出结构：

```go
type GeneratedProject struct {
  Files []GeneratedFile
}

type GeneratedFile struct {
  Path    string
  Content []byte
}
```

## 输出 zip

```txt
ui.c
ui.h
assets.c
assets.h
README.md
```

### ui.h

- 声明 screen init 函数。
- 声明全局 widget 指针。
- 声明 event callback 函数。

### ui.c

- 定义 screen init 函数。
- 创建 widget tree。
- 设置位置、尺寸、样式、属性。
- 绑定 event callback。

### assets.c / assets.h

- 声明和定义 image/font 资源引用。
- 第一版 image 从对象存储读取原始上传字节，生成 `const uint8_t *_data[]` 和 `const lv_img_dsc_t`。
- `assets.h` 使用 `LV_IMG_DECLARE(ui_img_xxx)` 暴露符号，`ui.c` 通过 `lv_img_set_src(obj, &ui_img_xxx)` 引用。
- PNG/JPEG 资源会解码为 `LV_IMG_CF_TRUE_COLOR_ALPHA` 像素数据；若已有资源内容无法解码，codegen 会保留原始字节并使用 `LV_IMG_CF_RAW` 作为兜底。
- font asset 第一版只作为 ProjectDoc 元数据保留；当 `style.font` 引用 font asset id 时，`ui.c` 写入注释提醒将字体转换为 LVGL font symbol，不生成不存在的 `&font_id` 绑定。
- 当 `style.font` 引用不存在的自定义 font asset id 时，codegen 必须返回错误，不生成带悬空资源引用的导出包。

### README.md

- 说明生成来源、LVGL 版本、集成方式和资源注意事项。

## 命名规则

- 所有 C 标识符使用 `ui_` 前缀。
- 非字母数字字符替换为 `_`。
- 连续 `_` 合并为单个 `_`。
- 首字符不能是数字；若是数字，前面加 `_`。
- 名称冲突追加 `_2`、`_3`。
- 生成顺序必须稳定，便于 git diff。

示例：

```txt
Time Label -> ui_Time_Label
10% Value  -> ui_10_Value
Heart.Icon -> ui_Heart_Icon
```

## Screen 生成规则

每个 screen 生成一个 init 函数：

```c
void ui_Screen_1_screen_init(void) {
    ui_Screen_1 = lv_obj_create(NULL);
}
```

如果 screen root 有背景色：

```c
lv_obj_set_style_bg_color(ui_Screen_1, lv_color_hex(0x101010), LV_PART_MAIN | LV_STATE_DEFAULT);
```

## Widget 创建映射

```txt
screen    -> lv_obj_create(NULL)
container -> lv_obj_create(parent)
button    -> lv_btn_create(parent)
label     -> lv_label_create(parent)
image     -> lv_img_create(parent)
arc       -> lv_arc_create(parent)
bar       -> lv_bar_create(parent)
line      -> lv_line_create(parent)
switch    -> lv_switch_create(parent)
slider    -> lv_slider_create(parent)
checkbox  -> lv_checkbox_create(parent)
dropdown  -> lv_dropdown_create(parent)
spinner   -> lv_spinner_create(parent, spinTime, arcLength)
chart     -> lv_chart_create(parent)
```

Widget tree 使用 DFS 前序遍历。父对象必须先于子对象创建。

## Layout 生成规则

绝对定位：

```c
lv_obj_set_pos(ui_Time_Label, 150, 40);
lv_obj_set_size(ui_Time_Label, 180, 56);
```

hidden：

```c
lv_obj_add_flag(ui_Widget, LV_OBJ_FLAG_HIDDEN);
```

flex container：

```c
lv_obj_set_layout(ui_Container, LV_LAYOUT_FLEX);
lv_obj_set_flex_flow(ui_Container, LV_FLEX_FLOW_ROW);
lv_obj_set_style_pad_gap(ui_Container, 8, LV_PART_MAIN | LV_STATE_DEFAULT);
```

## Props 生成规则

Label：

```c
lv_label_set_text(ui_Time_Label, "10:09");
```

Button：

- button 本身生成 `lv_btn_create`。
- button 文本应由 button 的 child label 表达；若 `props.text` 存在，codegen 可生成内部 label。

Image：

```c
lv_img_set_src(ui_Heart_Icon, &ui_img_icon_heart_png);
```

Arc：

```c
lv_arc_set_value(ui_Steps_Arc, 72);
lv_arc_set_range(ui_Steps_Arc, 0, 100);
```

Bar：

```c
lv_bar_set_value(ui_Battery_Bar, 86, LV_ANIM_OFF);
```

Switch：

```c
lv_obj_add_state(ui_Switch_1, LV_STATE_CHECKED);
```

Slider：

```c
lv_slider_set_range(ui_Slider_1, 0, 100);
lv_slider_set_value(ui_Slider_1, 50, LV_ANIM_OFF);
```

Checkbox：

```c
lv_checkbox_set_text(ui_Checkbox_1, "Option");
```

Dropdown：

```c
lv_dropdown_set_options(ui_Dropdown_1, "Option 1\nOption 2\nOption 3");
```

## Style 生成规则

简单样式可直接设置在对象上：

```c
lv_obj_set_style_text_color(ui_Time_Label, lv_color_hex(0xFFFFFF), LV_PART_MAIN | LV_STATE_DEFAULT);
lv_obj_set_style_radius(ui_Start_Button, 22, LV_PART_MAIN | LV_STATE_DEFAULT);
lv_obj_set_style_pad_left(ui_Start_Button, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
```

复杂或复用样式生成 `lv_style_t`：

```c
static lv_style_t ui_style_primary_button;
lv_style_init(&ui_style_primary_button);
lv_style_set_bg_color(&ui_style_primary_button, lv_color_hex(0x2FBF71));
lv_obj_add_style(ui_Start_Button, &ui_style_primary_button, LV_PART_MAIN | LV_STATE_DEFAULT);
```

第一版允许先以内联 style 输出为主，但必须保留 `StyleDef` 转 `lv_style_t` 的实现路径。

## Events 生成规则

事件绑定：

```c
lv_obj_add_event_cb(ui_Start_Button, ui_Start_Button_on_clicked, LV_EVENT_CLICKED, NULL);
```

callback stub：

```c
void ui_Start_Button_on_clicked(lv_event_t * e) {
    /* User code can be added here. */
}
```

约束：

- callback 函数名必须稳定。
- 不生成业务逻辑。
- 不覆盖用户后续手写业务代码的策略在第一版导出 README 中说明。

## 示例片段

```c
lv_obj_t * ui_Time_Label = lv_label_create(ui_Screen_1);
lv_label_set_text(ui_Time_Label, "10:09");
lv_obj_set_pos(ui_Time_Label, 150, 40);
lv_obj_set_size(ui_Time_Label, 180, 56);
lv_obj_set_style_text_color(ui_Time_Label, lv_color_hex(0xFFFFFF), LV_PART_MAIN | LV_STATE_DEFAULT);
```

## 错误处理

Codegen 遇到以下情况应返回明确错误：

- `ProjectDoc.screens` 为空。
- screen root 缺失。
- unsupported widget type。
- event 绑定指向不存在 widget。
- image widget 引用不存在 asset。
- image/font asset 的 MIME 类型不在支持列表内。
- image asset 缺少导出所需的 `Data`，或无法解码且没有提供 `width`/`height`。

## 验收标准

- 同一个 `ProjectDoc` 多次生成输出字节一致。
- label 生成 `lv_label_create` 和 `lv_label_set_text`。
- button 生成 `lv_btn_create`。
- image 生成 `lv_img_set_src`。
- hidden widget 生成 `LV_OBJ_FLAG_HIDDEN`。
- event 生成 `lv_obj_add_event_cb` 和 callback stub。
