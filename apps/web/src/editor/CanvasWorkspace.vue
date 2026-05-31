<template>
  <section class="center-region">
    <div class="canvas-toolbar">
      <strong data-testid="center-panel-title">{{ centerPanelTitle }}</strong>
      <span class="screen-tab" data-testid="active-screen-label">{{ activeScreenName }}</span>
      <button class="mini-action screen-tab-add" :aria-label="copy.canvas.addScreen" :title="copy.canvas.addScreen" data-testid="canvas-add-screen-button" type="button" @click="emit('add-screen')"><IconGlyph name="add" /></button>
      <span class="toolbar-spacer" />
      <button
        class="select-like"
        type="button"
        data-testid="canvas-target-settings-button"
        :aria-label="copy.canvas.openTargetSettings(project.target.width, project.target.height)"
        :title="copy.canvas.openTargetSettings(project.target.width, project.target.height)"
        @click="emit('show-settings')"
      >
        {{ project.target.width }} x {{ project.target.height }} ˅
      </button>
      <button class="icon-button" type="button" :aria-label="fitViewLabel" :title="fitViewLabel" data-testid="fit-view-button" @click="emit('fit-view')"><IconGlyph name="fit" /></button>
      <button class="icon-button" type="button" :aria-label="fullscreenCanvasLabel" :title="fullscreenCanvasLabel" data-testid="fullscreen-canvas-button" @click="emit('fullscreen-canvas')"><IconGlyph name="fullscreen" /></button>
      <select class="select-like" data-testid="zoom-select" :aria-label="copy.canvas.canvasZoom" :title="copy.canvas.canvasZoom" :value="zoomPercent" @change="updateZoom">
        <option v-for="level in zoomLevels" :key="level" :value="level">{{ level }}%</option>
      </select>
    </div>
    <div v-if="activeCenterPanel === 'code'" class="code-stage">
      <header class="code-stage-header">
        <div>
          <span class="panel-kicker">{{ copy.canvas.generatedSource }}</span>
          <strong>{{ codeFileName }}</strong>
        </div>
        <div class="code-stage-meta">
          <span data-testid="code-line-count">{{ copy.canvas.lineCount(codeLineCount) }}</span>
          <span>{{ project.target.lvglVersion }} / {{ copy.canvas.colorDepthOption(project.target.colorDepth) }}</span>
        </div>
        <div class="code-stage-actions">
          <button class="mini-action" type="button" data-testid="copy-code-button" :aria-label="copyCodeLabel" :title="copyCodeLabel" @click="emit('copy-generated-code')"><IconGlyph name="copy" /></button>
          <button class="select-like" type="button" data-testid="code-back-to-canvas-button" :aria-label="backToCanvasLabel" :title="backToCanvasLabel" @click="emit('show-canvas')">{{ backToCanvasButtonText }}</button>
        </div>
      </header>
      <p class="code-stage-status" data-testid="code-copy-status" role="status" aria-live="polite" aria-atomic="true">{{ codeCopyStatus }}</p>
      <pre data-testid="code-preview">{{ codePreview }}</pre>
    </div>
    <div v-else-if="activeCenterPanel === 'settings'" class="settings-stage" data-testid="settings-panel">
      <section class="settings-card">
        <div class="settings-card-header">
          <h2>{{ copy.canvas.projectSettings }}</h2>
          <button class="select-like" type="button" data-testid="settings-back-to-canvas-button" :aria-label="backToCanvasLabel" :title="backToCanvasLabel" @click="emit('show-canvas')">{{ backToCanvasButtonText }}</button>
        </div>
        <div class="settings-form">
          <label>{{ copy.canvas.projectName }}<input data-testid="settings-project-name-input" :aria-label="copy.canvas.projectNameA11y" :title="copy.canvas.projectNameA11y" :value="project.name" @input="emitText('rename-project', $event)" /></label>
          <label>
            {{ copy.canvas.device }}
            <input data-testid="settings-target-device-name-input" :aria-label="copy.inspector.a11y.targetDeviceName" :title="copy.inspector.a11y.targetDeviceName" :value="project.target.deviceName" :aria-invalid="inspectorErrors['target-device-name'] ? 'true' : undefined" :aria-describedby="inspectorErrors['target-device-name'] ? 'settings-target-device-name-error' : undefined" @input="emitText('update-target-device-name', $event)" />
            <p v-if="inspectorErrors['target-device-name']" id="settings-target-device-name-error" class="field-error" data-testid="settings-target-device-name-error" role="alert">{{ inspectorErrors['target-device-name'] }}</p>
          </label>
          <label>
            {{ copy.canvas.lvglVersion }}
            <select data-testid="settings-target-lvgl-version-select" :aria-label="copy.inspector.a11y.targetLvglVersion" :title="copy.inspector.a11y.targetLvglVersion" :value="project.target.lvglVersion" @change="emitText('update-target-lvgl-version', $event)">
              <option value="8.3">8.3</option>
            </select>
          </label>
          <div class="settings-form-row">
            <label>
              {{ copy.canvas.width }}
              <input data-testid="settings-target-width-input" type="number" :aria-label="copy.inspector.a11y.targetWidth" :title="copy.inspector.a11y.targetWidth" min="1" step="1" :value="project.target.width" :aria-invalid="inspectorErrors['target-width'] ? 'true' : undefined" :aria-describedby="inspectorErrors['target-width'] ? 'settings-target-width-error' : undefined" @input="emitTargetNumber('width', $event)" />
              <p v-if="inspectorErrors['target-width']" id="settings-target-width-error" class="field-error" data-testid="settings-target-width-error" role="alert">{{ inspectorErrors['target-width'] }}</p>
            </label>
            <label>
              {{ copy.canvas.height }}
              <input data-testid="settings-target-height-input" type="number" :aria-label="copy.inspector.a11y.targetHeight" :title="copy.inspector.a11y.targetHeight" min="1" step="1" :value="project.target.height" :aria-invalid="inspectorErrors['target-height'] ? 'true' : undefined" :aria-describedby="inspectorErrors['target-height'] ? 'settings-target-height-error' : undefined" @input="emitTargetNumber('height', $event)" />
              <p v-if="inspectorErrors['target-height']" id="settings-target-height-error" class="field-error" data-testid="settings-target-height-error" role="alert">{{ inspectorErrors['target-height'] }}</p>
            </label>
          </div>
          <div class="settings-form-row">
            <label>
              {{ copy.canvas.dpi }}
              <input data-testid="settings-target-dpi-input" type="number" :aria-label="copy.inspector.a11y.targetDpi" :title="copy.inspector.a11y.targetDpi" min="1" step="1" :value="project.target.dpi" :aria-invalid="inspectorErrors['target-dpi'] ? 'true' : undefined" :aria-describedby="inspectorErrors['target-dpi'] ? 'settings-target-dpi-error' : undefined" @input="emitTargetNumber('dpi', $event)" />
              <p v-if="inspectorErrors['target-dpi']" id="settings-target-dpi-error" class="field-error" data-testid="settings-target-dpi-error" role="alert">{{ inspectorErrors['target-dpi'] }}</p>
            </label>
            <label>
              {{ copy.canvas.colorDepth }}
              <select data-testid="settings-target-color-depth-select" :aria-label="copy.inspector.a11y.targetColorDepth" :title="copy.inspector.a11y.targetColorDepth" :value="project.target.colorDepth" @change="emitText('update-target-color-depth', $event)">
                <option value="16">{{ copy.canvas.colorDepthOption(16) }}</option>
                <option value="32">{{ copy.canvas.colorDepthOption(32) }}</option>
              </select>
            </label>
          </div>
          <label>
            {{ copy.canvas.theme }}
            <select data-testid="settings-theme-select" :aria-label="copy.toolbar.projectTheme" :title="copy.toolbar.projectTheme" :value="project.theme" @change="emitTheme">
              <option value="dark">{{ copy.canvas.dark }}</option>
              <option value="light">{{ copy.canvas.light }}</option>
            </select>
          </label>
          <section class="project-styles-section" data-testid="project-styles-section">
            <div class="settings-card-header compact">
              <h2>{{ copy.canvas.reusableStyles }}</h2>
              <button class="mini-action" type="button" data-testid="add-project-style-button" :aria-label="copy.canvas.addReusableStyle" :title="copy.canvas.addReusableStyle" @click="emit('add-project-style')"><IconGlyph name="add" /></button>
            </div>
            <p v-if="project.styles.length === 0" class="project-styles-empty" data-testid="project-styles-empty" role="status" aria-live="polite" aria-atomic="true">{{ copy.canvas.noReusableStyles }}</p>
            <div v-for="styleDef in project.styles" :key="styleDef.id" class="project-style-editor" data-testid="project-style-editor">
              <label>
                {{ copy.canvas.styleName }}
                <input data-testid="project-style-name-input" :aria-label="copy.canvas.reusableStyleName" :title="copy.canvas.reusableStyleName" :value="styleDef.name" @input="emitProjectStyleName(styleDef.id, $event)" />
              </label>
              <div class="settings-form-row">
                <label class="color-field">
                  {{ copy.canvas.background }}
                  <span class="color-control">
                    <span class="color-swatch" data-testid="project-style-bg-color-swatch" role="img" :aria-label="copy.inspector.colorPreview(copy.inspector.a11y.backgroundColor, styleDef.style.bgColor ?? 'transparent')" :title="copy.inspector.colorPreview(copy.inspector.a11y.backgroundColor, styleDef.style.bgColor ?? 'transparent')" :style="{ backgroundColor: styleDef.style.bgColor || 'transparent' }" />
                    <input data-testid="project-style-bg-color-input" :aria-label="copy.inspector.a11y.backgroundColor" :title="copy.inspector.a11y.backgroundColor" :value="styleDef.style.bgColor ?? ''" :aria-invalid="projectStyleColorError(styleDef.id, 'bgColor') ? 'true' : undefined" :aria-describedby="projectStyleColorError(styleDef.id, 'bgColor') ? `project-style-${styleDef.id}-bg-color-error` : undefined" @input="emitProjectStyleText(styleDef.id, 'bgColor', $event)" />
                  </span>
                  <p v-if="projectStyleColorError(styleDef.id, 'bgColor')" :id="`project-style-${styleDef.id}-bg-color-error`" class="field-error" data-testid="project-style-bg-color-error" role="alert">{{ projectStyleColorError(styleDef.id, 'bgColor') }}</p>
                </label>
                <label class="color-field">
                  {{ copy.canvas.textColor }}
                  <span class="color-control">
                    <span class="color-swatch" data-testid="project-style-text-color-swatch" role="img" :aria-label="copy.inspector.colorPreview(copy.inspector.a11y.textColor, styleDef.style.textColor ?? '#FFFFFF')" :title="copy.inspector.colorPreview(copy.inspector.a11y.textColor, styleDef.style.textColor ?? '#FFFFFF')" :style="{ backgroundColor: styleDef.style.textColor ?? '#FFFFFF' }" />
                    <input data-testid="project-style-text-color-input" :aria-label="copy.inspector.a11y.textColor" :title="copy.inspector.a11y.textColor" :value="styleDef.style.textColor ?? ''" :aria-invalid="projectStyleColorError(styleDef.id, 'textColor') ? 'true' : undefined" :aria-describedby="projectStyleColorError(styleDef.id, 'textColor') ? `project-style-${styleDef.id}-text-color-error` : undefined" @input="emitProjectStyleText(styleDef.id, 'textColor', $event)" />
                  </span>
                  <p v-if="projectStyleColorError(styleDef.id, 'textColor')" :id="`project-style-${styleDef.id}-text-color-error`" class="field-error" data-testid="project-style-text-color-error" role="alert">{{ projectStyleColorError(styleDef.id, 'textColor') }}</p>
                </label>
              </div>
              <div class="settings-form-row">
                <label class="color-field">
                  {{ copy.inspector.fields.border }}
                  <span class="color-control">
                    <span class="color-swatch" data-testid="project-style-border-color-swatch" role="img" :aria-label="copy.inspector.colorPreview(copy.inspector.a11y.borderColor, styleDef.style.borderColor ?? 'transparent')" :title="copy.inspector.colorPreview(copy.inspector.a11y.borderColor, styleDef.style.borderColor ?? 'transparent')" :style="{ backgroundColor: styleDef.style.borderColor || 'transparent' }" />
                    <input data-testid="project-style-border-color-input" :aria-label="copy.inspector.a11y.borderColor" :title="copy.inspector.a11y.borderColor" :value="styleDef.style.borderColor ?? ''" :aria-invalid="projectStyleColorError(styleDef.id, 'borderColor') ? 'true' : undefined" :aria-describedby="projectStyleColorError(styleDef.id, 'borderColor') ? `project-style-${styleDef.id}-border-color-error` : undefined" @input="emitProjectStyleText(styleDef.id, 'borderColor', $event)" />
                  </span>
                  <p v-if="projectStyleColorError(styleDef.id, 'borderColor')" :id="`project-style-${styleDef.id}-border-color-error`" class="field-error" data-testid="project-style-border-color-error" role="alert">{{ projectStyleColorError(styleDef.id, 'borderColor') }}</p>
                </label>
                <label>
                  {{ copy.inspector.fields.font }}
                  <select data-testid="project-style-font-select" :aria-label="copy.inspector.a11y.textFont" :title="copy.inspector.a11y.textFont" :value="styleDef.style.font ?? ''" @change="emitProjectStyleText(styleDef.id, 'font', $event)">
                    <option value="">{{ copy.inspector.fields.default }}</option>
                    <option value="lv_font_montserrat_14">lv_font_montserrat_14</option>
                    <option value="lv_font_montserrat_20">lv_font_montserrat_20</option>
                    <option value="lv_font_montserrat_32">lv_font_montserrat_32</option>
                    <option value="lv_font_montserrat_48">lv_font_montserrat_48</option>
                    <option v-for="asset in fontAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                  </select>
                </label>
              </div>
              <div class="settings-form-row">
                <label>{{ copy.canvas.radius }}<input data-testid="project-style-radius-input" type="number" :aria-label="copy.canvas.radius" :title="copy.canvas.radius" min="0" step="1" :value="styleDef.style.radius ?? 0" :aria-invalid="projectStyleError(styleDef.id, 'radius') ? 'true' : undefined" :aria-describedby="projectStyleError(styleDef.id, 'radius') ? `project-style-${styleDef.id}-radius-error` : undefined" @input="emitProjectStyleNumber(styleDef.id, 'radius', $event)" />
                  <p v-if="projectStyleError(styleDef.id, 'radius')" :id="`project-style-${styleDef.id}-radius-error`" class="field-error" data-testid="project-style-radius-error" role="alert">{{ projectStyleError(styleDef.id, 'radius') }}</p>
                </label>
                <label>{{ copy.canvas.opacity }}<input data-testid="project-style-opacity-input" type="number" :aria-label="copy.canvas.opacity" :title="copy.canvas.opacity" min="0" max="100" step="1" :value="styleDef.style.opacity ?? 100" :aria-invalid="projectStyleError(styleDef.id, 'opacity') ? 'true' : undefined" :aria-describedby="projectStyleError(styleDef.id, 'opacity') ? `project-style-${styleDef.id}-opacity-error` : undefined" @input="emitProjectStyleNumber(styleDef.id, 'opacity', $event)" />
                  <p v-if="projectStyleError(styleDef.id, 'opacity')" :id="`project-style-${styleDef.id}-opacity-error`" class="field-error" data-testid="project-style-opacity-error" role="alert">{{ projectStyleError(styleDef.id, 'opacity') }}</p>
                </label>
                <label>
                  {{ copy.inspector.fields.blendMode }}
                  <select data-testid="project-style-blend-mode-select" :aria-label="copy.inspector.a11y.blendMode" :title="copy.inspector.a11y.blendMode" :value="styleDef.style.blendMode ?? 'normal'" @change="emitProjectStyleText(styleDef.id, 'blendMode', $event)">
                    <option value="normal">{{ copy.inspector.options.blendMode.normal }}</option>
                    <option value="additive">{{ copy.inspector.options.blendMode.additive }}</option>
                    <option value="subtractive">{{ copy.inspector.options.blendMode.subtractive }}</option>
                    <option value="multiply">{{ copy.inspector.options.blendMode.multiply }}</option>
                    <option value="replace">{{ copy.inspector.options.blendMode.replace }}</option>
                  </select>
                </label>
              </div>
              <div class="settings-form-row">
                <label>
                  {{ copy.inspector.fields.align }}
                  <select data-testid="project-style-align-select" :aria-label="copy.inspector.a11y.textAlignment" :title="copy.inspector.a11y.textAlignment" :value="styleDef.style.align ?? 'center'" @change="emitProjectStyleText(styleDef.id, 'align', $event)">
                    <option value="left">{{ copy.inspector.options.textAlign.left }}</option>
                    <option value="center">{{ copy.inspector.options.textAlign.center }}</option>
                    <option value="right">{{ copy.inspector.options.textAlign.right }}</option>
                  </select>
                </label>
                <label>{{ copy.inspector.fields.letterSpace }}<input data-testid="project-style-letter-space-input" type="number" :aria-label="copy.inspector.a11y.letterSpacing" :title="copy.inspector.a11y.letterSpacing" min="0" step="1" :value="styleDef.style.letterSpace ?? 0" :aria-invalid="projectStyleError(styleDef.id, 'letterSpace') ? 'true' : undefined" :aria-describedby="projectStyleError(styleDef.id, 'letterSpace') ? `project-style-${styleDef.id}-letter-space-error` : undefined" @input="emitProjectStyleNumber(styleDef.id, 'letterSpace', $event)" />
                  <p v-if="projectStyleError(styleDef.id, 'letterSpace')" :id="`project-style-${styleDef.id}-letter-space-error`" class="field-error" data-testid="project-style-letter-space-error" role="alert">{{ projectStyleError(styleDef.id, 'letterSpace') }}</p>
                </label>
                <label>{{ copy.inspector.fields.lineSpace }}<input data-testid="project-style-line-space-input" type="number" :aria-label="copy.inspector.a11y.lineSpacing" :title="copy.inspector.a11y.lineSpacing" min="0" step="1" :value="styleDef.style.lineSpace ?? 0" :aria-invalid="projectStyleError(styleDef.id, 'lineSpace') ? 'true' : undefined" :aria-describedby="projectStyleError(styleDef.id, 'lineSpace') ? `project-style-${styleDef.id}-line-space-error` : undefined" @input="emitProjectStyleNumber(styleDef.id, 'lineSpace', $event)" />
                  <p v-if="projectStyleError(styleDef.id, 'lineSpace')" :id="`project-style-${styleDef.id}-line-space-error`" class="field-error" data-testid="project-style-line-space-error" role="alert">{{ projectStyleError(styleDef.id, 'lineSpace') }}</p>
                </label>
              </div>
              <div class="settings-form-row">
                <label>{{ copy.inspector.fields.paddingTop }}<input data-testid="project-style-padding-top-input" type="number" :aria-label="copy.inspector.a11y.paddingTop" :title="copy.inspector.a11y.paddingTop" min="0" step="1" :value="styleDef.style.padding?.top ?? 0" :aria-invalid="projectStylePaddingError(styleDef.id, 'top') ? 'true' : undefined" :aria-describedby="projectStylePaddingError(styleDef.id, 'top') ? `project-style-${styleDef.id}-padding-top-error` : undefined" @input="emitProjectStylePaddingSide(styleDef.id, 'top', $event)" />
                  <p v-if="projectStylePaddingError(styleDef.id, 'top')" :id="`project-style-${styleDef.id}-padding-top-error`" class="field-error" data-testid="project-style-padding-top-error" role="alert">{{ projectStylePaddingError(styleDef.id, 'top') }}</p>
                </label>
                <label>{{ copy.inspector.fields.paddingRight }}<input data-testid="project-style-padding-right-input" type="number" :aria-label="copy.inspector.a11y.paddingRight" :title="copy.inspector.a11y.paddingRight" min="0" step="1" :value="styleDef.style.padding?.right ?? 0" :aria-invalid="projectStylePaddingError(styleDef.id, 'right') ? 'true' : undefined" :aria-describedby="projectStylePaddingError(styleDef.id, 'right') ? `project-style-${styleDef.id}-padding-right-error` : undefined" @input="emitProjectStylePaddingSide(styleDef.id, 'right', $event)" />
                  <p v-if="projectStylePaddingError(styleDef.id, 'right')" :id="`project-style-${styleDef.id}-padding-right-error`" class="field-error" data-testid="project-style-padding-right-error" role="alert">{{ projectStylePaddingError(styleDef.id, 'right') }}</p>
                </label>
              </div>
              <div class="settings-form-row">
                <label>{{ copy.inspector.fields.paddingBottom }}<input data-testid="project-style-padding-bottom-input" type="number" :aria-label="copy.inspector.a11y.paddingBottom" :title="copy.inspector.a11y.paddingBottom" min="0" step="1" :value="styleDef.style.padding?.bottom ?? 0" :aria-invalid="projectStylePaddingError(styleDef.id, 'bottom') ? 'true' : undefined" :aria-describedby="projectStylePaddingError(styleDef.id, 'bottom') ? `project-style-${styleDef.id}-padding-bottom-error` : undefined" @input="emitProjectStylePaddingSide(styleDef.id, 'bottom', $event)" />
                  <p v-if="projectStylePaddingError(styleDef.id, 'bottom')" :id="`project-style-${styleDef.id}-padding-bottom-error`" class="field-error" data-testid="project-style-padding-bottom-error" role="alert">{{ projectStylePaddingError(styleDef.id, 'bottom') }}</p>
                </label>
                <label>{{ copy.inspector.fields.paddingLeft }}<input data-testid="project-style-padding-left-input" type="number" :aria-label="copy.inspector.a11y.paddingLeft" :title="copy.inspector.a11y.paddingLeft" min="0" step="1" :value="styleDef.style.padding?.left ?? 0" :aria-invalid="projectStylePaddingError(styleDef.id, 'left') ? 'true' : undefined" :aria-describedby="projectStylePaddingError(styleDef.id, 'left') ? `project-style-${styleDef.id}-padding-left-error` : undefined" @input="emitProjectStylePaddingSide(styleDef.id, 'left', $event)" />
                  <p v-if="projectStylePaddingError(styleDef.id, 'left')" :id="`project-style-${styleDef.id}-padding-left-error`" class="field-error" data-testid="project-style-padding-left-error" role="alert">{{ projectStylePaddingError(styleDef.id, 'left') }}</p>
                </label>
              </div>
              <div class="project-style-actions">
                <button class="select-like" type="button" data-testid="apply-project-style-button" :disabled="!selectedWidget || selectedWidget.locked" :aria-label="copy.canvas.applyReusableStyle(styleDef.name, selectedWidget?.name)" :title="copy.canvas.applyReusableStyle(styleDef.name, selectedWidget?.name)" @click="emit('apply-project-style', styleDef.id)">{{ copy.canvas.apply }}</button>
                <button class="mini-action" type="button" data-testid="delete-project-style-button" :aria-label="copy.canvas.deleteReusableStyle(styleDef.name)" :title="copy.canvas.deleteReusableStyle(styleDef.name)" @click="emit('delete-project-style', styleDef.id)"><IconGlyph name="trash" /></button>
              </div>
            </div>
          </section>
        </div>
        <div class="settings-summary">
          <span>{{ copy.canvas.target }}</span>
          <strong class="settings-summary-value" data-testid="settings-summary-target">{{ copy.canvas.targetSummary(project.target) }}</strong>
          <span>{{ copy.canvas.save }}</span>
          <strong class="settings-summary-value" data-testid="settings-summary-save">{{ saveStateLabel }}</strong>
        </div>
      </section>
    </div>
    <div v-else class="canvas-stage" data-testid="canvas-stage" @mousedown="emit('start-canvas-pan', $event)">
      <div class="canvas-pan" :style="canvasPanStyle" data-testid="canvas-pan">
        <div class="ruler ruler-top" :style="rulerTopStyle" data-testid="ruler-top">
          <span
            v-for="tick in rulerXTicks"
            :key="`x-${tick}`"
            class="ruler-tick"
            :style="{ left: `${tick}px` }"
          >
            {{ tick }}
          </span>
        </div>
        <div class="ruler ruler-left" :style="rulerLeftStyle" data-testid="ruler-left">
          <span
            v-for="tick in rulerYTicks"
            :key="`y-${tick}`"
            class="ruler-tick"
            :style="{ top: `${tick}px` }"
          >
            {{ tick }}
          </span>
        </div>
        <div
          ref="artboardRef"
          class="artboard"
          :class="{ 'show-grid': gridEnabled }"
          :style="artboardStyle"
          data-testid="artboard"
          @mousemove="emit('update-mouse-coordinates', $event)"
          @dragover.prevent
          @drop.prevent="emit('drop-widget', $event)"
        >
          <span
            v-for="guide in alignmentGuides.vertical"
            :key="`v-${guide}`"
            class="alignment-guide vertical"
            data-testid="alignment-guide-vertical"
            :style="{ left: `${guide}px` }"
          />
          <span
            v-for="guide in alignmentGuides.horizontal"
            :key="`h-${guide}`"
            class="alignment-guide horizontal"
            data-testid="alignment-guide-horizontal"
            :style="{ top: `${guide}px` }"
          />
          <div class="device-surface" :class="{ empty: renderedWidgets.length === 0 }" :style="deviceSurfaceStyle" data-testid="device-surface">
            <WidgetRenderer
              v-for="item in renderedWidgets"
              :key="item.widget.id"
              :image-preview-url="imagePreviewUrl"
              :item="item"
              :selected-widget-id="selectedWidget?.id ?? null"
              :to-test-id="toTestId"
              :widget-style="widgetStyle"
              :widget-text="widgetText"
              @select-widget="emit('select-widget', $event)"
              @start-move="(widget, event) => emit('start-move', widget, event)"
              @start-resize="(widget, event) => emit('start-resize', widget, event)"
            />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { AssetRef, ProjectDoc, WidgetNode } from "@hiveton-lvgl/schema";
import { useCopy } from "../i18n/useCopy";
import IconGlyph from "./IconGlyph.vue";
import WidgetRenderer from "./WidgetRenderer.vue";

export type RenderedWidget = {
  widget: WidgetNode;
  x: number;
  y: number;
};

const props = defineProps<{
  activeCenterPanel: "canvas" | "code" | "settings";
  activeScreenName?: string;
  alignmentGuides: { vertical: number[]; horizontal: number[] };
  artboardStyle: Record<string, string>;
  canvasPanStyle: Record<string, string>;
  codePreview: string;
  codeCopyStatus: string;
  deviceSurfaceStyle: Record<string, string>;
  gridEnabled: boolean;
  fontAssets: AssetRef[];
  imagePreviewUrl: (widget: WidgetNode) => string | null;
  inspectorErrors: Record<string, string>;
  project: ProjectDoc;
  renderedWidgets: RenderedWidget[];
  rulerLeftStyle: Record<string, string>;
  rulerTopStyle: Record<string, string>;
  rulerXTicks: number[];
  rulerYTicks: number[];
  saveStateLabel: string;
  selectedWidget: WidgetNode | null;
  toTestId: (name: string) => string;
  widgetStyle: (item: RenderedWidget) => Record<string, string>;
  widgetText: (widget: WidgetNode) => string;
  zoomLevels: number[];
  zoomPercent: number;
}>();

const emit = defineEmits<{
  "add-screen": [];
  "add-project-style": [];
  "artboard-mounted": [element: HTMLElement];
  "apply-project-style": [styleId: string];
  "copy-generated-code": [];
  "delete-project-style": [styleId: string];
  "drop-widget": [event: DragEvent];
  "fit-view": [];
  "fullscreen-canvas": [];
  "rename-project": [name: string];
  "select-widget": [widgetId: string];
  "show-settings": [];
  "show-canvas": [];
  "start-canvas-pan": [event: MouseEvent];
  "start-move": [widget: WidgetNode, event: MouseEvent];
  "start-resize": [widget: WidgetNode, event: MouseEvent];
  "update-mouse-coordinates": [event: MouseEvent];
  "update-target-color-depth": [value: string];
  "update-target-device-name": [value: string];
  "update-target-lvgl-version": [value: string];
  "update-target-number": [field: "width" | "height" | "dpi", value: string];
  "update-theme": [theme: ProjectDoc["theme"]];
  "update-project-style-name": [styleId: string, name: string];
  "update-project-style-number": [styleId: string, field: "opacity" | "radius" | "letterSpace" | "lineSpace", value: string];
  "update-project-style-padding-side": [styleId: string, side: "top" | "right" | "bottom" | "left", value: string];
  "update-project-style-text": [styleId: string, field: "bgColor" | "textColor" | "borderColor" | "font" | "align" | "blendMode", value: string];
  "update:zoom-percent": [zoom: number];
}>();

const artboardRef = ref<HTMLElement | null>(null);
const copy = useCopy();
const codeLineCount = computed(() => props.codePreview.split("\n").filter(Boolean).length);
const canvasScreenName = computed(() => props.activeScreenName ?? copy.value.canvas.currentScreen);
const codeFileName = computed(() => `${props.activeScreenName ?? copy.value.canvas.screenFallback}.c`);
const copyCodeLabel = computed(() => copy.value.canvas.copyCode(codeFileName.value));
const fitViewLabel = computed(() => copy.value.canvas.fitView(canvasScreenName.value));
const fullscreenCanvasLabel = computed(() => copy.value.canvas.fullscreen(canvasScreenName.value));
const backToCanvasLabel = computed(() => copy.value.canvas.backToCanvas(canvasScreenName.value));
const backToCanvasButtonText = computed(() => copy.value.canvas.backToCanvasButton);
const centerPanelTitle = computed(() => {
  if (props.activeCenterPanel === "code") {
    return copy.value.canvas.code;
  }
  if (props.activeCenterPanel === "settings") {
    return copy.value.canvas.settings;
  }
  return copy.value.canvas.canvas;
});

onMounted(() => {
  if (artboardRef.value) {
    emit("artboard-mounted", artboardRef.value);
  }
});

function updateZoom(event: Event): void {
  emit("update:zoom-percent", Number((event.target as HTMLSelectElement).value));
}

function emitText(
  eventName: "rename-project" | "update-target-device-name" | "update-target-lvgl-version" | "update-target-color-depth",
  event: Event
): void {
  const value = (event.target as HTMLInputElement | HTMLSelectElement).value;
  if (eventName === "rename-project") {
    emit("rename-project", value);
    return;
  }
  if (eventName === "update-target-device-name") {
    emit("update-target-device-name", value);
    return;
  }
  if (eventName === "update-target-lvgl-version") {
    emit("update-target-lvgl-version", value);
    return;
  }
  emit("update-target-color-depth", value);
}

function emitTargetNumber(field: "width" | "height" | "dpi", event: Event): void {
  emit("update-target-number", field, (event.target as HTMLInputElement).value);
}

function emitTheme(event: Event): void {
  const theme = (event.target as HTMLSelectElement).value;
  if (theme === "dark" || theme === "light") {
    emit("update-theme", theme);
  }
}

function emitProjectStyleName(styleId: string, event: Event): void {
  emit("update-project-style-name", styleId, (event.target as HTMLInputElement).value);
}

function emitProjectStyleText(styleId: string, field: "bgColor" | "textColor" | "borderColor" | "font" | "align" | "blendMode", event: Event): void {
  emit("update-project-style-text", styleId, field, (event.target as HTMLInputElement | HTMLSelectElement).value);
}

function emitProjectStyleNumber(styleId: string, field: "opacity" | "radius" | "letterSpace" | "lineSpace", event: Event): void {
  emit("update-project-style-number", styleId, field, (event.target as HTMLInputElement).value);
}

function emitProjectStylePaddingSide(styleId: string, side: "top" | "right" | "bottom" | "left", event: Event): void {
  emit("update-project-style-padding-side", styleId, side, (event.target as HTMLInputElement).value);
}

function projectStyleColorError(styleId: string, field: "bgColor" | "textColor" | "borderColor"): string | undefined {
  return props.inspectorErrors[`project-style-${styleId}-${colorFieldErrorSuffix(field)}`];
}

function projectStyleError(styleId: string, field: "opacity" | "radius" | "letterSpace" | "lineSpace"): string | undefined {
  return props.inspectorErrors[`project-style-${styleId}-${colorFieldErrorSuffix(field)}`];
}

function projectStylePaddingError(styleId: string, side: "top" | "right" | "bottom" | "left"): string | undefined {
  return props.inspectorErrors[`project-style-${styleId}-padding-${side}`];
}

function colorFieldErrorSuffix(field: "bgColor" | "textColor" | "borderColor" | "opacity" | "radius" | "letterSpace" | "lineSpace"): string {
  return field.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);
}
</script>
