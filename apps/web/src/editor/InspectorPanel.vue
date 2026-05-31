<template>
  <aside class="inspector-panel panel">
    <div class="tabs" role="tablist" :aria-label="copy.inspector.tabSections">
      <button
        class="tab"
        :class="{ active: activeInspectorTab === 'style' }"
        ref="styleTabRef"
        data-testid="inspector-style-tab"
        type="button"
        role="tab"
        :aria-selected="activeInspectorTab === 'style' ? 'true' : 'false'"
        :tabindex="activeInspectorTab === 'style' ? 0 : -1"
        @click="emit('update:active-inspector-tab', 'style')"
        @keydown="handleInspectorTabKeydown($event, 'style')"
      >
        {{ copy.inspector.tabs.inspector }}
      </button>
      <button
        class="tab"
        :class="{ active: activeInspectorTab === 'events' }"
        ref="eventsTabRef"
        data-testid="inspector-events-tab"
        type="button"
        role="tab"
        :aria-selected="activeInspectorTab === 'events' ? 'true' : 'false'"
        :tabindex="activeInspectorTab === 'events' ? 0 : -1"
        @click="emit('update:active-inspector-tab', 'events')"
        @keydown="handleInspectorTabKeydown($event, 'events')"
      >
        {{ copy.inspector.tabs.events }}
      </button>
      <button
        class="tab"
        :class="{ active: activeInspectorTab === 'layout' }"
        ref="layoutTabRef"
        data-testid="inspector-layout-tab"
        type="button"
        role="tab"
        :aria-selected="activeInspectorTab === 'layout' ? 'true' : 'false'"
        :tabindex="activeInspectorTab === 'layout' ? 0 : -1"
        @click="emit('update:active-inspector-tab', 'layout')"
        @keydown="handleInspectorTabKeydown($event, 'layout')"
      >
        {{ copy.inspector.tabs.layout }}
      </button>
    </div>
    <section v-if="!selectedWidget" class="inspector-section inspector-empty" data-testid="inspector-empty-state" role="status" aria-live="polite" aria-atomic="true">
      <h2>{{ copy.inspector.emptyTitle }}</h2>
      <p>{{ copy.inspector.emptyBody }}</p>
    </section>
    <section v-else class="inspector-section">
      <h2>{{ copy.inspector.sections.selector }}</h2>
      <input
        data-testid="selector-input"
        :aria-label="copy.inspector.selectedWidgetName"
        :title="copy.inspector.selectedWidgetName"
        :disabled="selectedWidget?.locked"
        :value="selectedWidget?.name"
        @input="emitInput('rename-widget', $event)"
      />
    </section>
    <section v-if="activeInspectorTab === 'style' && canEditText" class="inspector-section">
      <h2>{{ copy.inspector.sections.text }}</h2>
      <label>
        {{ copy.inspector.fields.text }}
        <input
          data-testid="selected-text-input"
          :aria-label="copy.inspector.a11y.selectedWidgetText"
          :title="copy.inspector.a11y.selectedWidgetText"
          :disabled="selectedWidget?.locked"
          :value="selectedText"
          @input="emitInput('update-text', $event)"
        />
      </label>
      <label>
        {{ copy.inspector.fields.font }}
        <select data-testid="style-font-select" :aria-label="copy.inspector.a11y.textFont" :title="copy.inspector.a11y.textFont" :disabled="selectedWidget?.locked" :value="selectedWidget?.style.font ?? ''" :aria-invalid="selectedFontWarning ? 'true' : undefined" :aria-describedby="selectedFontWarning ? 'font-asset-warning' : undefined" @change="emitInput('update-style-font', $event)">
          <option value="">{{ copy.inspector.fields.default }}</option>
          <option value="lv_font_montserrat_14">lv_font_montserrat_14</option>
          <option value="lv_font_montserrat_20">lv_font_montserrat_20</option>
          <option value="lv_font_montserrat_32">lv_font_montserrat_32</option>
          <option value="lv_font_montserrat_48">lv_font_montserrat_48</option>
          <option v-for="asset in fontAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
        </select>
      </label>
      <p v-if="selectedFontIsUploadedAsset" class="field-note" data-testid="font-asset-export-note" role="note">{{ copy.inspector.fontAssetExportNote }}</p>
      <p v-if="selectedFontWarning" id="font-asset-warning" class="field-error" data-testid="font-asset-warning" role="alert">{{ selectedFontWarning }}</p>
      <label>
        {{ copy.inspector.fields.align }}
        <select data-testid="style-align-select" :aria-label="copy.inspector.a11y.textAlignment" :title="copy.inspector.a11y.textAlignment" :disabled="selectedWidget?.locked" :value="selectedWidget?.style.align ?? 'left'" @change="emitInput('update-style-align', $event)">
          <option value="left">{{ copy.inspector.options.textAlign.left }}</option>
          <option value="center">{{ copy.inspector.options.textAlign.center }}</option>
          <option value="right">{{ copy.inspector.options.textAlign.right }}</option>
        </select>
      </label>
    </section>
    <section v-if="activeInspectorTab === 'style' && hasRangeProps" class="inspector-section">
      <h2>{{ copy.inspector.sections.props }}</h2>
      <label>{{ copy.inspector.fields.min }}<input data-testid="prop-min-input" type="number" :aria-label="copy.inspector.a11y.minimumValue" :title="copy.inspector.a11y.minimumValue" step="1" :disabled="selectedWidget?.locked" :value="propNumber('min', 0)" :aria-invalid="inspectorErrors['prop-min'] ? 'true' : undefined" :aria-describedby="inspectorErrors['prop-min'] ? 'prop-min-error' : undefined" @input="emitFieldInput('update-prop-number', 'min', $event)" /></label>
      <p v-if="inspectorErrors['prop-min']" id="prop-min-error" class="field-error" data-testid="prop-min-error" role="alert">{{ inspectorErrors['prop-min'] }}</p>
      <label>{{ copy.inspector.fields.max }}<input data-testid="prop-max-input" type="number" :aria-label="copy.inspector.a11y.maximumValue" :title="copy.inspector.a11y.maximumValue" step="1" :disabled="selectedWidget?.locked" :value="propNumber('max', 100)" :aria-invalid="inspectorErrors['prop-max'] ? 'true' : undefined" :aria-describedby="inspectorErrors['prop-max'] ? 'prop-max-error' : undefined" @input="emitFieldInput('update-prop-number', 'max', $event)" /></label>
      <p v-if="inspectorErrors['prop-max']" id="prop-max-error" class="field-error" data-testid="prop-max-error" role="alert">{{ inspectorErrors['prop-max'] }}</p>
      <label>{{ copy.inspector.fields.value }}<input data-testid="prop-value-input" type="number" :aria-label="copy.inspector.a11y.value" :title="copy.inspector.a11y.value" step="1" :disabled="selectedWidget?.locked" :value="propNumber('value', 0)" :aria-invalid="inspectorErrors['prop-value'] ? 'true' : undefined" :aria-describedby="inspectorErrors['prop-value'] ? 'prop-value-error' : undefined" @input="emitFieldInput('update-prop-number', 'value', $event)" /></label>
      <p v-if="inspectorErrors['prop-value']" id="prop-value-error" class="field-error" data-testid="prop-value-error" role="alert">{{ inspectorErrors['prop-value'] }}</p>
    </section>
    <section v-if="activeInspectorTab === 'style' && selectedWidget?.type === 'chart'" class="inspector-section">
      <h2>{{ copy.inspector.sections.props }}</h2>
      <label>{{ copy.inspector.fields.min }}<input data-testid="prop-min-input" type="number" :aria-label="copy.inspector.a11y.minimumValue" :title="copy.inspector.a11y.minimumValue" step="1" :disabled="selectedWidget?.locked" :value="propNumber('min', 0)" :aria-invalid="inspectorErrors['prop-min'] ? 'true' : undefined" :aria-describedby="inspectorErrors['prop-min'] ? 'prop-min-error' : undefined" @input="emitFieldInput('update-prop-number', 'min', $event)" /></label>
      <p v-if="inspectorErrors['prop-min']" id="prop-min-error" class="field-error" data-testid="prop-min-error" role="alert">{{ inspectorErrors['prop-min'] }}</p>
      <label>{{ copy.inspector.fields.max }}<input data-testid="prop-max-input" type="number" :aria-label="copy.inspector.a11y.maximumValue" :title="copy.inspector.a11y.maximumValue" step="1" :disabled="selectedWidget?.locked" :value="propNumber('max', 100)" :aria-invalid="inspectorErrors['prop-max'] ? 'true' : undefined" :aria-describedby="inspectorErrors['prop-max'] ? 'prop-max-error' : undefined" @input="emitFieldInput('update-prop-number', 'max', $event)" /></label>
      <p v-if="inspectorErrors['prop-max']" id="prop-max-error" class="field-error" data-testid="prop-max-error" role="alert">{{ inspectorErrors['prop-max'] }}</p>
      <label>{{ copy.inspector.fields.pointCount }}<input data-testid="prop-point-count-input" type="number" :aria-label="copy.inspector.a11y.chartPointCount" :title="copy.inspector.a11y.chartPointCount" min="1" step="1" :disabled="selectedWidget?.locked" :value="propNumber('pointCount', 8)" :aria-invalid="inspectorErrors['prop-point-count'] ? 'true' : undefined" :aria-describedby="inspectorErrors['prop-point-count'] ? 'prop-point-count-error' : undefined" @input="emitFieldInput('update-prop-number', 'pointCount', $event)" /></label>
      <p v-if="inspectorErrors['prop-point-count']" id="prop-point-count-error" class="field-error" data-testid="prop-point-count-error" role="alert">{{ inspectorErrors['prop-point-count'] }}</p>
      <label>{{ copy.inspector.fields.values }}<textarea data-testid="prop-values-input" :aria-label="copy.inspector.a11y.chartValues" :title="copy.inspector.a11y.chartValues" :disabled="selectedWidget?.locked" :value="propValues()" :aria-invalid="inspectorErrors['prop-values'] ? 'true' : undefined" :aria-describedby="inspectorErrors['prop-values'] ? 'prop-values-error' : undefined" @input="emit('update-prop-values', inputValue($event))" /></label>
      <p v-if="inspectorErrors['prop-values']" id="prop-values-error" class="field-error" data-testid="prop-values-error" role="alert">{{ inspectorErrors['prop-values'] }}</p>
    </section>
    <section v-if="activeInspectorTab === 'style' && selectedWidget?.type === 'spinner'" class="inspector-section">
      <h2>{{ copy.inspector.sections.props }}</h2>
      <label>{{ copy.inspector.fields.spinTime }}<input data-testid="prop-spin-time-input" type="number" :aria-label="copy.inspector.a11y.spinTime" :title="copy.inspector.a11y.spinTime" min="1" step="1" :disabled="selectedWidget?.locked" :value="propNumber('spinTime', 1000)" :aria-invalid="inspectorErrors['prop-spin-time'] ? 'true' : undefined" :aria-describedby="inspectorErrors['prop-spin-time'] ? 'prop-spin-time-error' : undefined" @input="emitFieldInput('update-prop-number', 'spinTime', $event)" /></label>
      <p v-if="inspectorErrors['prop-spin-time']" id="prop-spin-time-error" class="field-error" data-testid="prop-spin-time-error" role="alert">{{ inspectorErrors['prop-spin-time'] }}</p>
      <label>{{ copy.inspector.fields.arcLength }}<input data-testid="prop-arc-length-input" type="number" :aria-label="copy.inspector.a11y.arcLength" :title="copy.inspector.a11y.arcLength" min="1" step="1" :disabled="selectedWidget?.locked" :value="propNumber('arcLength', 60)" :aria-invalid="inspectorErrors['prop-arc-length'] ? 'true' : undefined" :aria-describedby="inspectorErrors['prop-arc-length'] ? 'prop-arc-length-error' : undefined" @input="emitFieldInput('update-prop-number', 'arcLength', $event)" /></label>
      <p v-if="inspectorErrors['prop-arc-length']" id="prop-arc-length-error" class="field-error" data-testid="prop-arc-length-error" role="alert">{{ inspectorErrors['prop-arc-length'] }}</p>
    </section>
    <section v-if="activeInspectorTab === 'style' && selectedWidget?.type === 'switch'" class="inspector-section">
      <h2>{{ copy.inspector.sections.props }}</h2>
      <label><input data-testid="prop-checked-input" type="checkbox" :aria-label="copy.inspector.fields.checked" :title="copy.inspector.fields.checked" :disabled="selectedWidget?.locked" :checked="selectedWidget?.props.checked === true" @change="emit('update-prop-checked', ($event.target as HTMLInputElement).checked)" /> {{ copy.inspector.fields.checked }}</label>
    </section>
    <section v-if="activeInspectorTab === 'style' && selectedWidget?.type === 'checkbox'" class="inspector-section">
      <h2>{{ copy.inspector.sections.props }}</h2>
      <label>{{ copy.inspector.fields.text }}<input data-testid="prop-text-input" :aria-label="copy.inspector.a11y.checkboxText" :title="copy.inspector.a11y.checkboxText" :disabled="selectedWidget?.locked" :value="propString('text')" @input="emitFieldInput('update-prop-text', 'text', $event)" /></label>
      <label><input data-testid="prop-checked-input" type="checkbox" :aria-label="copy.inspector.fields.checked" :title="copy.inspector.fields.checked" :disabled="selectedWidget?.locked" :checked="selectedWidget?.props.checked === true" @change="emit('update-prop-checked', ($event.target as HTMLInputElement).checked)" /> {{ copy.inspector.fields.checked }}</label>
    </section>
    <section v-if="activeInspectorTab === 'style' && selectedWidget?.type === 'dropdown'" class="inspector-section">
      <h2>{{ copy.inspector.sections.props }}</h2>
      <label>{{ copy.inspector.fields.options }}<textarea data-testid="prop-options-input" :aria-label="copy.inspector.a11y.dropdownOptions" :title="copy.inspector.a11y.dropdownOptions" :disabled="selectedWidget?.locked" :value="propString('options')" @input="emitFieldInput('update-prop-text', 'options', $event)" /></label>
      <label>{{ copy.inspector.fields.selected }}<input data-testid="prop-selected-input" type="number" :aria-label="copy.inspector.a11y.selectedOptionIndex" :title="copy.inspector.a11y.selectedOptionIndex" min="0" step="1" :disabled="selectedWidget?.locked" :value="propNumber('selected', 0)" :aria-invalid="inspectorErrors['prop-selected'] ? 'true' : undefined" :aria-describedby="inspectorErrors['prop-selected'] ? 'prop-selected-error' : undefined" @input="emitFieldInput('update-prop-number', 'selected', $event)" /></label>
      <p v-if="inspectorErrors['prop-selected']" id="prop-selected-error" class="field-error" data-testid="prop-selected-error" role="alert">{{ inspectorErrors['prop-selected'] }}</p>
    </section>
    <section v-if="activeInspectorTab === 'style' && selectedWidget?.type === 'image'" class="inspector-section">
      <h2>{{ copy.inspector.sections.image }}</h2>
      <label>
        {{ copy.inspector.asset }}
        <select
          data-testid="image-asset-select"
          :aria-label="copy.inspector.a11y.imageAsset"
          :title="copy.inspector.a11y.imageAsset"
          :value="selectedWidget?.props.assetId ?? ''"
          :disabled="selectedWidget?.locked"
          @change="emitInput('bind-image-asset', $event)"
        >
          <option value="">{{ copy.inspector.fields.imageNone }}</option>
          <option v-for="asset in imageAssets" :key="asset.id" :value="asset.id">
            {{ asset.name }}
          </option>
        </select>
      </label>
      <p
        class="asset-binding-state"
        :class="{ warning: imageBindingState.tone === 'warning', success: imageBindingState.tone === 'success' }"
        data-testid="image-binding-state"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {{ imageBindingState.message }}
      </p>
    </section>
    <section v-if="activeInspectorTab === 'style' && selectedWidget" class="inspector-section">
      <h2>{{ copy.inspector.sections.appearance }}</h2>
      <label class="color-field">
        {{ copy.inspector.fields.textColor }}
        <span class="color-control">
          <span
            class="color-swatch"
            data-testid="style-text-color-swatch"
            role="img"
            :aria-label="colorPreviewLabel(copy.inspector.a11y.textColor, selectedWidget?.style.textColor, '#FFFFFF')"
            :title="colorPreviewLabel(copy.inspector.a11y.textColor, selectedWidget?.style.textColor, '#FFFFFF')"
            :style="{ backgroundColor: selectedWidget?.style.textColor ?? '#FFFFFF' }"
          />
          <input data-testid="style-text-color-input" :aria-label="copy.inspector.a11y.textColor" :title="copy.inspector.a11y.textColor" :disabled="selectedWidget?.locked" :value="selectedWidget?.style.textColor ?? '#FFFFFF'" :aria-invalid="inspectorErrors['style-text-color'] ? 'true' : undefined" :aria-describedby="inspectorErrors['style-text-color'] ? 'style-text-color-error' : undefined" @input="emitStyleText('textColor', $event)" />
        </span>
      </label>
      <p v-if="inspectorErrors['style-text-color']" id="style-text-color-error" class="field-error" data-testid="style-text-color-error" role="alert">{{ inspectorErrors['style-text-color'] }}</p>
      <label class="color-field">
        {{ copy.inspector.fields.background }}
        <span class="color-control">
          <span
            class="color-swatch"
            data-testid="style-bg-color-swatch"
            role="img"
            :aria-label="colorPreviewLabel(copy.inspector.a11y.backgroundColor, selectedWidget?.style.bgColor, 'transparent')"
            :title="colorPreviewLabel(copy.inspector.a11y.backgroundColor, selectedWidget?.style.bgColor, 'transparent')"
            :style="{ backgroundColor: selectedWidget?.style.bgColor || 'transparent' }"
          />
          <input data-testid="style-bg-color-input" :aria-label="copy.inspector.a11y.backgroundColor" :title="copy.inspector.a11y.backgroundColor" :disabled="selectedWidget?.locked" :value="selectedWidget?.style.bgColor ?? ''" :aria-invalid="inspectorErrors['style-bg-color'] ? 'true' : undefined" :aria-describedby="inspectorErrors['style-bg-color'] ? 'style-bg-color-error' : undefined" @input="emitStyleText('bgColor', $event)" />
        </span>
      </label>
      <p v-if="inspectorErrors['style-bg-color']" id="style-bg-color-error" class="field-error" data-testid="style-bg-color-error" role="alert">{{ inspectorErrors['style-bg-color'] }}</p>
      <label class="color-field">
        {{ copy.inspector.fields.border }}
        <span class="color-control">
          <span
            class="color-swatch"
            data-testid="style-border-color-swatch"
            role="img"
            :aria-label="colorPreviewLabel(copy.inspector.a11y.borderColor, selectedWidget?.style.borderColor, 'transparent')"
            :title="colorPreviewLabel(copy.inspector.a11y.borderColor, selectedWidget?.style.borderColor, 'transparent')"
            :style="{ backgroundColor: selectedWidget?.style.borderColor || 'transparent' }"
          />
          <input data-testid="style-border-color-input" :aria-label="copy.inspector.a11y.borderColor" :title="copy.inspector.a11y.borderColor" :disabled="selectedWidget?.locked" :value="selectedWidget?.style.borderColor ?? ''" :aria-invalid="inspectorErrors['style-border-color'] ? 'true' : undefined" :aria-describedby="inspectorErrors['style-border-color'] ? 'style-border-color-error' : undefined" @input="emitStyleText('borderColor', $event)" />
        </span>
      </label>
      <p v-if="inspectorErrors['style-border-color']" id="style-border-color-error" class="field-error" data-testid="style-border-color-error" role="alert">{{ inspectorErrors['style-border-color'] }}</p>
      <label>{{ copy.inspector.fields.opacity }}<input data-testid="style-opacity-input" type="number" :aria-label="copy.inspector.fields.opacity" :title="copy.inspector.fields.opacity" min="0" max="100" step="1" :disabled="selectedWidget?.locked" :value="selectedWidget?.style.opacity ?? 100" :aria-invalid="inspectorErrors.opacity ? 'true' : undefined" :aria-describedby="inspectorErrors.opacity ? 'style-opacity-error' : undefined" @input="emitStyleNumber('opacity', $event)" /></label>
      <p v-if="inspectorErrors.opacity" id="style-opacity-error" class="field-error" data-testid="style-opacity-error" role="alert">{{ inspectorErrors.opacity }}</p>
      <label>
        {{ copy.inspector.fields.blendMode }}
        <select data-testid="style-blend-mode-select" :aria-label="copy.inspector.a11y.blendMode" :title="copy.inspector.a11y.blendMode" :disabled="selectedWidget?.locked" :value="selectedWidget?.style.blendMode ?? 'normal'" @change="emitInput('update-style-blend-mode', $event)">
          <option value="normal">{{ copy.inspector.options.blendMode.normal }}</option>
          <option value="additive">{{ copy.inspector.options.blendMode.additive }}</option>
          <option value="subtractive">{{ copy.inspector.options.blendMode.subtractive }}</option>
          <option value="multiply">{{ copy.inspector.options.blendMode.multiply }}</option>
          <option value="replace">{{ copy.inspector.options.blendMode.replace }}</option>
        </select>
      </label>
      <label>{{ copy.inspector.fields.radius }}<input data-testid="style-radius-input" type="number" :aria-label="copy.inspector.fields.radius" :title="copy.inspector.fields.radius" min="0" step="1" :disabled="selectedWidget?.locked" :value="selectedWidget?.style.radius ?? 0" :aria-invalid="inspectorErrors.radius ? 'true' : undefined" :aria-describedby="inspectorErrors.radius ? 'style-radius-error' : undefined" @input="emitStyleNumber('radius', $event)" /></label>
      <p v-if="inspectorErrors.radius" id="style-radius-error" class="field-error" data-testid="style-radius-error" role="alert">{{ inspectorErrors.radius }}</p>
      <label>{{ copy.inspector.fields.paddingTop }}<input data-testid="style-padding-top-input" type="number" :aria-label="copy.inspector.a11y.paddingTop" :title="copy.inspector.a11y.paddingTop" min="0" step="1" :disabled="selectedWidget?.locked" :value="selectedWidget?.style.padding?.top ?? 0" :aria-invalid="inspectorErrors['padding-top'] ? 'true' : undefined" :aria-describedby="inspectorErrors['padding-top'] ? 'style-padding-top-error' : undefined" @input="emitPaddingSide('top', $event)" /></label>
      <p v-if="inspectorErrors['padding-top']" id="style-padding-top-error" class="field-error" data-testid="style-padding-top-error" role="alert">{{ inspectorErrors['padding-top'] }}</p>
      <label>{{ copy.inspector.fields.paddingRight }}<input data-testid="style-padding-right-input" type="number" :aria-label="copy.inspector.a11y.paddingRight" :title="copy.inspector.a11y.paddingRight" min="0" step="1" :disabled="selectedWidget?.locked" :value="selectedWidget?.style.padding?.right ?? 0" :aria-invalid="inspectorErrors['padding-right'] ? 'true' : undefined" :aria-describedby="inspectorErrors['padding-right'] ? 'style-padding-right-error' : undefined" @input="emitPaddingSide('right', $event)" /></label>
      <p v-if="inspectorErrors['padding-right']" id="style-padding-right-error" class="field-error" data-testid="style-padding-right-error" role="alert">{{ inspectorErrors['padding-right'] }}</p>
      <label>{{ copy.inspector.fields.paddingBottom }}<input data-testid="style-padding-bottom-input" type="number" :aria-label="copy.inspector.a11y.paddingBottom" :title="copy.inspector.a11y.paddingBottom" min="0" step="1" :disabled="selectedWidget?.locked" :value="selectedWidget?.style.padding?.bottom ?? 0" :aria-invalid="inspectorErrors['padding-bottom'] ? 'true' : undefined" :aria-describedby="inspectorErrors['padding-bottom'] ? 'style-padding-bottom-error' : undefined" @input="emitPaddingSide('bottom', $event)" /></label>
      <p v-if="inspectorErrors['padding-bottom']" id="style-padding-bottom-error" class="field-error" data-testid="style-padding-bottom-error" role="alert">{{ inspectorErrors['padding-bottom'] }}</p>
      <label>{{ copy.inspector.fields.paddingLeft }}<input data-testid="style-padding-left-input" type="number" :aria-label="copy.inspector.a11y.paddingLeft" :title="copy.inspector.a11y.paddingLeft" min="0" step="1" :disabled="selectedWidget?.locked" :value="selectedWidget?.style.padding?.left ?? 0" :aria-invalid="inspectorErrors['padding-left'] ? 'true' : undefined" :aria-describedby="inspectorErrors['padding-left'] ? 'style-padding-left-error' : undefined" @input="emitPaddingSide('left', $event)" /></label>
      <p v-if="inspectorErrors['padding-left']" id="style-padding-left-error" class="field-error" data-testid="style-padding-left-error" role="alert">{{ inspectorErrors['padding-left'] }}</p>
      <label v-if="canEditText">{{ copy.inspector.fields.letterSpace }}<input data-testid="style-letter-space-input" type="number" :aria-label="copy.inspector.a11y.letterSpacing" :title="copy.inspector.a11y.letterSpacing" min="0" step="1" :disabled="selectedWidget?.locked" :value="selectedWidget?.style.letterSpace ?? 0" :aria-invalid="inspectorErrors.letterSpace ? 'true' : undefined" :aria-describedby="inspectorErrors.letterSpace ? 'style-letter-space-error' : undefined" @input="emitStyleNumber('letterSpace', $event)" /></label>
      <p v-if="inspectorErrors.letterSpace" id="style-letter-space-error" class="field-error" data-testid="style-letter-space-error" role="alert">{{ inspectorErrors.letterSpace }}</p>
      <label v-if="canEditText">{{ copy.inspector.fields.lineSpace }}<input data-testid="style-line-space-input" type="number" :aria-label="copy.inspector.a11y.lineSpacing" :title="copy.inspector.a11y.lineSpacing" min="0" step="1" :disabled="selectedWidget?.locked" :value="selectedWidget?.style.lineSpace ?? 0" :aria-invalid="inspectorErrors.lineSpace ? 'true' : undefined" :aria-describedby="inspectorErrors.lineSpace ? 'style-line-space-error' : undefined" @input="emitStyleNumber('lineSpace', $event)" /></label>
      <p v-if="inspectorErrors.lineSpace" id="style-line-space-error" class="field-error" data-testid="style-line-space-error" role="alert">{{ inspectorErrors.lineSpace }}</p>
    </section>
    <section v-if="activeInspectorTab === 'layout' && selectedWidget" class="inspector-section">
      <h2>{{ copy.inspector.sections.target }}</h2>
      <div class="target-summary-card" data-testid="target-summary-card">
        <strong>{{ project.target.deviceName }}</strong>
        <span>{{ targetSummary }}</span>
      </div>
      <label>{{ copy.inspector.fields.device }}<input data-testid="target-device-name-input" :aria-label="copy.inspector.a11y.targetDeviceName" :title="copy.inspector.a11y.targetDeviceName" :value="project.target.deviceName" :aria-invalid="inspectorErrors['target-device-name'] ? 'true' : undefined" :aria-describedby="inspectorErrors['target-device-name'] ? 'target-device-name-error' : undefined" @input="emitInput('update-target-device-name', $event)" /></label>
      <p v-if="inspectorErrors['target-device-name']" id="target-device-name-error" class="field-error" data-testid="target-device-name-error" role="alert">{{ inspectorErrors['target-device-name'] }}</p>
      <label>
        LVGL
        <select data-testid="target-lvgl-version-select" :aria-label="copy.inspector.a11y.targetLvglVersion" :title="copy.inspector.a11y.targetLvglVersion" :value="project.target.lvglVersion" @change="emitInput('update-target-lvgl-version', $event)">
          <option value="8.3">8.3</option>
        </select>
      </label>
      <label>{{ copy.inspector.fields.width }}<input data-testid="target-width-input" type="number" :aria-label="copy.inspector.a11y.targetWidth" :title="copy.inspector.a11y.targetWidth" min="1" step="1" :value="project.target.width" :aria-invalid="inspectorErrors['target-width'] ? 'true' : undefined" :aria-describedby="inspectorErrors['target-width'] ? 'target-width-error' : undefined" @input="emitTargetNumber('width', $event)" /></label>
      <p v-if="inspectorErrors['target-width']" id="target-width-error" class="field-error" data-testid="target-width-error" role="alert">{{ inspectorErrors['target-width'] }}</p>
      <label>{{ copy.inspector.fields.height }}<input data-testid="target-height-input" type="number" :aria-label="copy.inspector.a11y.targetHeight" :title="copy.inspector.a11y.targetHeight" min="1" step="1" :value="project.target.height" :aria-invalid="inspectorErrors['target-height'] ? 'true' : undefined" :aria-describedby="inspectorErrors['target-height'] ? 'target-height-error' : undefined" @input="emitTargetNumber('height', $event)" /></label>
      <p v-if="inspectorErrors['target-height']" id="target-height-error" class="field-error" data-testid="target-height-error" role="alert">{{ inspectorErrors['target-height'] }}</p>
      <label>{{ copy.canvas.dpi }}<input data-testid="target-dpi-input" type="number" :aria-label="copy.inspector.a11y.targetDpi" :title="copy.inspector.a11y.targetDpi" min="1" step="1" :value="project.target.dpi" :aria-invalid="inspectorErrors['target-dpi'] ? 'true' : undefined" :aria-describedby="inspectorErrors['target-dpi'] ? 'target-dpi-error' : undefined" @input="emitTargetNumber('dpi', $event)" /></label>
      <p v-if="inspectorErrors['target-dpi']" id="target-dpi-error" class="field-error" data-testid="target-dpi-error" role="alert">{{ inspectorErrors['target-dpi'] }}</p>
      <label>
        {{ copy.inspector.fields.colorDepth }}
        <select data-testid="target-color-depth-select" :aria-label="copy.inspector.a11y.targetColorDepth" :title="copy.inspector.a11y.targetColorDepth" :value="project.target.colorDepth" @change="emitInput('update-target-color-depth', $event)">
          <option value="16">16</option>
          <option value="32">32</option>
        </select>
      </label>
    </section>
    <section v-if="activeInspectorTab === 'layout' && selectedWidget" class="inspector-section">
      <h2>{{ copy.inspector.sections.layout }}</h2>
      <label>X<input data-testid="layout-x-input" type="number" :aria-label="copy.inspector.a11y.layoutX" :title="copy.inspector.a11y.layoutX" step="1" :disabled="selectedWidget?.locked" :value="selectedWidget?.layout.x" :aria-invalid="inspectorErrors.x ? 'true' : undefined" :aria-describedby="inspectorErrors.x ? 'layout-x-error' : undefined" @input="emitLayoutNumber('x', $event)" /></label>
      <p v-if="inspectorErrors.x" id="layout-x-error" class="field-error" data-testid="layout-x-error" role="alert">{{ inspectorErrors.x }}</p>
      <label>Y<input data-testid="layout-y-input" type="number" :aria-label="copy.inspector.a11y.layoutY" :title="copy.inspector.a11y.layoutY" step="1" :disabled="selectedWidget?.locked" :value="selectedWidget?.layout.y" :aria-invalid="inspectorErrors.y ? 'true' : undefined" :aria-describedby="inspectorErrors.y ? 'layout-y-error' : undefined" @input="emitLayoutNumber('y', $event)" /></label>
      <p v-if="inspectorErrors.y" id="layout-y-error" class="field-error" data-testid="layout-y-error" role="alert">{{ inspectorErrors.y }}</p>
      <label>{{ copy.inspector.fields.width }}<input data-testid="layout-width-input" type="number" :aria-label="copy.inspector.a11y.layoutWidth" :title="copy.inspector.a11y.layoutWidth" min="1" step="1" :disabled="selectedWidget?.locked" :value="selectedWidget?.layout.width" :aria-invalid="inspectorErrors.width ? 'true' : undefined" :aria-describedby="inspectorErrors.width ? 'layout-width-error' : undefined" @input="emitLayoutNumber('width', $event)" /></label>
      <p v-if="inspectorErrors.width" id="layout-width-error" class="field-error" data-testid="layout-width-error" role="alert">{{ inspectorErrors.width }}</p>
      <label>{{ copy.inspector.fields.height }}<input data-testid="layout-height-input" type="number" :aria-label="copy.inspector.a11y.layoutHeight" :title="copy.inspector.a11y.layoutHeight" min="1" step="1" :disabled="selectedWidget?.locked" :value="selectedWidget?.layout.height" :aria-invalid="inspectorErrors.height ? 'true' : undefined" :aria-describedby="inspectorErrors.height ? 'layout-height-error' : undefined" @input="emitLayoutNumber('height', $event)" /></label>
      <p v-if="inspectorErrors.height" id="layout-height-error" class="field-error" data-testid="layout-height-error" role="alert">{{ inspectorErrors.height }}</p>
      <label>
        {{ copy.inspector.fields.align }}
        <select data-testid="layout-align-select" :aria-label="copy.inspector.a11y.layoutAlignment" :title="copy.inspector.a11y.layoutAlignment" :disabled="selectedWidget?.locked" :value="selectedWidget?.layout.align ?? 'top-left'" @change="emitInput('update-layout-align', $event)">
          <option value="top-left">{{ copy.inspector.options.layoutAlign["top-left"] }}</option>
          <option value="top-right">{{ copy.inspector.options.layoutAlign["top-right"] }}</option>
          <option value="center">{{ copy.inspector.options.layoutAlign.center }}</option>
          <option value="bottom-left">{{ copy.inspector.options.layoutAlign["bottom-left"] }}</option>
          <option value="bottom-right">{{ copy.inspector.options.layoutAlign["bottom-right"] }}</option>
        </select>
      </label>
      <label v-if="canEditFlex">
        {{ copy.inspector.fields.flexDirection }}
        <select data-testid="layout-flex-direction-select" :aria-label="copy.inspector.a11y.flexDirection" :title="copy.inspector.a11y.flexDirection" :disabled="selectedWidget?.locked" :value="selectedWidget?.layout.flex?.direction ?? 'row'" @change="emitInput('update-flex-direction', $event)">
          <option value="row">{{ copy.inspector.options.flexDirection.row }}</option>
          <option value="column">{{ copy.inspector.options.flexDirection.column }}</option>
        </select>
      </label>
      <label v-if="canEditFlex">{{ copy.inspector.fields.gap }}<input data-testid="layout-gap-input" type="number" :aria-label="copy.inspector.a11y.flexGap" :title="copy.inspector.a11y.flexGap" min="0" step="1" :disabled="selectedWidget?.locked" :value="selectedWidget?.layout.flex?.gap ?? 0" :aria-invalid="inspectorErrors.gap ? 'true' : undefined" :aria-describedby="inspectorErrors.gap ? 'layout-gap-error' : undefined" @input="emitInput('update-flex-gap', $event)" /></label>
      <p v-if="inspectorErrors.gap" id="layout-gap-error" class="field-error" data-testid="layout-gap-error" role="alert">{{ inspectorErrors.gap }}</p>
      <label v-if="canEditFlex"><input data-testid="layout-flex-wrap-input" type="checkbox" :aria-label="copy.inspector.a11y.flexWrap" :title="copy.inspector.a11y.flexWrap" :disabled="selectedWidget?.locked" :checked="selectedWidget?.layout.flex?.wrap === true" @change="emit('update-flex-wrap', ($event.target as HTMLInputElement).checked)" /> {{ copy.inspector.fields.wrap }}</label>
    </section>
    <section v-if="activeInspectorTab === 'events' && selectedWidget" class="inspector-section">
      <h2>{{ copy.inspector.sections.events }}</h2>
      <label>
        {{ copy.inspector.fields.event }}
        <select data-testid="event-type-select" :aria-label="copy.inspector.a11y.eventType" :title="copy.inspector.a11y.eventType" :disabled="eventFieldsDisabled" :value="eventType" @change="updateEventType">
          <option value="LV_EVENT_CLICKED">LV_EVENT_CLICKED</option>
          <option value="LV_EVENT_VALUE_CHANGED">LV_EVENT_VALUE_CHANGED</option>
          <option value="LV_EVENT_READY">LV_EVENT_READY</option>
          <option value="LV_EVENT_CANCEL">LV_EVENT_CANCEL</option>
        </select>
      </label>
      <label>
        {{ copy.inspector.fields.target }}
        <select data-testid="event-target-select" :aria-label="copy.inspector.a11y.eventTarget" :title="copy.inspector.a11y.eventTarget" :value="eventTargetWidgetId" @change="emitInput('update:event-target-widget-id', $event)">
          <option v-for="row in eventTargetRows" :key="row.widget.id" :value="row.widget.id">
            {{ row.widget.name }}
          </option>
        </select>
      </label>
      <label>
        {{ copy.inspector.fields.handler }}
        <input data-testid="event-handler-input" :aria-label="copy.inspector.a11y.eventHandler" :title="copy.inspector.a11y.eventHandler" :disabled="eventFieldsDisabled" :value="eventHandler" @input="emitInput('update:event-handler', $event)" @keydown.enter.prevent="submitEvent" />
      </label>
      <button class="select-like" type="button" data-testid="add-event-button" :disabled="addEventDisabled" :aria-label="addEventLabel" :title="addEventLabel" @click="submitEvent">{{ copy.inspector.addEvent }}</button>
      <p v-if="selectedEvents.length === 0" class="event-empty" data-testid="event-empty-state" role="status" aria-live="polite" aria-atomic="true">
        {{ copy.inspector.eventEmpty }}
      </p>
      <div v-else class="event-list-header" data-testid="event-list-header">
        <span>{{ copy.inspector.columns.target }}</span>
        <span>{{ copy.inspector.columns.event }}</span>
        <span>{{ copy.inspector.columns.handler }}</span>
        <span>{{ copy.inspector.columns.action }}</span>
      </div>
      <ul v-if="selectedEvents.length > 0" class="event-list" data-testid="event-list">
        <li v-for="event in selectedEvents" :key="event.id">
          <strong data-event-cell="target">{{ eventWidgetName(event.widgetId) }}</strong>
          <span data-event-cell="event">{{ event.event }}</span>
          <span data-event-cell="handler">{{ event.handlerName }}</span>
          <button
            class="mini-action"
            type="button"
            data-event-cell="action"
            :aria-label="eventRemoveLabel(event)"
            :title="eventRemoveLabel(event)"
            :data-testid="`remove-event-${event.id}`"
            :disabled="eventWidgetLocked(event.widgetId)"
            @click="emit('remove-event', event.id)"
          >
            <IconGlyph name="close" />
          </button>
        </li>
      </ul>
    </section>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { AssetRef, EventBinding, ProjectDoc, WidgetNode } from "@hiveton-lvgl/schema";
import { useCopy } from "../i18n/useCopy";
import IconGlyph from "./IconGlyph.vue";
import type { LayerRow } from "./LayersPanel.vue";

export type InspectorTab = "style" | "events" | "layout";

const props = defineProps<{
  activeInspectorTab: InspectorTab;
  eventHandler: string;
  eventTargetWidgetId: string;
  eventType: EventBinding["event"];
  fontAssets: AssetRef[];
  imageAssets: AssetRef[];
  inspectorErrors: Record<string, string>;
  eventTargetRows: LayerRow[];
  layerRows: LayerRow[];
  project: ProjectDoc;
  selectedEvents: EventBinding[];
  selectedWidget: WidgetNode | null;
}>();

const emit = defineEmits<{
  "add-event": [];
  "bind-image-asset": [assetId: string];
  "remove-event": [eventId: string];
  "rename-widget": [name: string];
  "update:event-handler": [handler: string];
  "update:event-target-widget-id": [widgetId: string];
  "update:event-type": [eventType: EventBinding["event"]];
  "update:active-inspector-tab": [tab: InspectorTab];
  "update-flex-direction": [direction: string];
  "update-flex-gap": [gap: string];
  "update-flex-wrap": [wrap: boolean];
  "update-layout-align": [align: string];
  "update-layout-number": [field: "x" | "y" | "width" | "height", value: string];
  "update-padding-side": [side: "top" | "right" | "bottom" | "left", value: string];
  "update-prop-checked": [checked: boolean];
  "update-prop-number": [field: string, value: string];
  "update-prop-text": [field: string, value: string];
  "update-prop-values": [value: string];
  "update-style-align": [align: string];
  "update-style-blend-mode": [blendMode: string];
  "update-style-font": [font: string];
  "update-style-number": [field: "opacity" | "radius" | "letterSpace" | "lineSpace", value: string];
  "update-style-text": [field: "textColor" | "bgColor" | "borderColor", value: string];
  "update-target-color-depth": [value: string];
  "update-target-device-name": [value: string];
  "update-target-lvgl-version": [value: string];
  "update-target-number": [field: "width" | "height" | "dpi", value: string];
  "update-text": [text: string];
}>();

const selectedText = computed(() => String(props.selectedWidget?.props.text ?? ""));
const copy = useCopy();
const canEditText = computed(() =>
  props.selectedWidget?.type === "label"
  || props.selectedWidget?.type === "button"
  || props.selectedWidget?.type === "checkbox"
  || props.selectedWidget?.type === "dropdown"
);
const hasRangeProps = computed(() =>
  props.selectedWidget?.type === "slider" || props.selectedWidget?.type === "bar" || props.selectedWidget?.type === "arc"
);
const canEditFlex = computed(() => props.selectedWidget?.type === "container" || props.selectedWidget?.type === "screen");
const targetSummary = computed(() => copy.value.canvas.targetSummary(props.project.target));
const inspectorTabs: InspectorTab[] = ["style", "events", "layout"];
const styleTabRef = ref<HTMLButtonElement | null>(null);
const eventsTabRef = ref<HTMLButtonElement | null>(null);
const layoutTabRef = ref<HTMLButtonElement | null>(null);
const inspectorTabRefs = [styleTabRef, eventsTabRef, layoutTabRef];

function handleInspectorTabKeydown(event: KeyboardEvent, tab: InspectorTab): void {
  const currentIndex = inspectorTabs.indexOf(tab);
  const nextIndex = event.key === "Home"
    ? 0
    : event.key === "End"
      ? inspectorTabs.length - 1
      : event.key === "ArrowRight"
        ? (currentIndex + 1) % inspectorTabs.length
        : event.key === "ArrowLeft"
          ? (currentIndex - 1 + inspectorTabs.length) % inspectorTabs.length
          : -1;
  if (nextIndex < 0) {
    return;
  }
  event.preventDefault();
  emit("update:active-inspector-tab", inspectorTabs[nextIndex]);
  inspectorTabRefs[nextIndex].value?.focus();
}

const imageBindingState = computed(() => {
  const assetId = props.selectedWidget?.props.assetId;
  if (typeof assetId !== "string" || !assetId) {
    if (props.imageAssets.length === 0) {
      return { tone: "warning", message: copy.value.inspector.imageAssetNotImported };
    }
    return { tone: "warning", message: copy.value.inspector.imageAssetNone };
  }
  const asset = props.imageAssets.find((item) => item.id === assetId);
  if (!asset) {
    return { tone: "warning", message: copy.value.inspector.imageAssetMissing };
  }
  return { tone: "success", message: copy.value.inspector.boundToAsset(asset.name) };
});
const selectedFontIsUploadedAsset = computed(() => {
  const font = props.selectedWidget?.style.font;
  return typeof font === "string" && Boolean(font) && props.fontAssets.some((asset) => asset.id === font);
});
const selectedFontWarning = computed(() => {
  const font = props.selectedWidget?.style.font;
  if (typeof font !== "string" || !font || isBuiltInLvglFont(font) || props.fontAssets.some((asset) => asset.id === font)) {
    return "";
  }
  return copy.value.inspector.fontAssetWarning(font);
});
const eventTargetWidget = computed(() =>
  props.eventTargetRows.find((row) => row.widget.id === props.eventTargetWidgetId)?.widget ?? null
);
const eventFieldsDisabled = computed(() => eventTargetWidget.value?.locked === true);
const addEventDisabled = computed(() => eventFieldsDisabled.value || props.eventHandler.trim().length === 0);
const addEventLabel = computed(() => {
  const targetName = eventTargetWidget.value?.name ?? copy.value.inspector.selectedWidget;
  if (eventFieldsDisabled.value) {
    return copy.value.inspector.unlockToAddEvents(targetName);
  }
  const eventName = props.eventType;
  if (props.eventHandler.trim().length === 0) {
    return copy.value.inspector.enterHandler(eventName, targetName);
  }
  return copy.value.inspector.addEventToTarget(eventName, targetName);
});

function eventWidgetLocked(widgetId: string): boolean {
  return props.eventTargetRows.find((row) => row.widget.id === widgetId)?.widget.locked === true;
}

function eventWidgetName(widgetId: string): string {
  return props.eventTargetRows.find((row) => row.widget.id === widgetId)?.widget.name ?? widgetId;
}

function submitEvent(): void {
  if (!addEventDisabled.value) {
    emit("add-event");
  }
}

function propString(field: string): string {
  const value = props.selectedWidget?.props[field];
  return typeof value === "string" ? value : "";
}

function propNumber(field: string, fallback: number): number {
  const value = props.selectedWidget?.props[field];
  return typeof value === "number" ? value : fallback;
}

function propValues(): string {
  const value = props.selectedWidget?.props.values;
  return Array.isArray(value) ? value.join(", ") : "";
}

function colorPreviewLabel(label: string, value: string | undefined, fallback: string): string {
  return copy.value.inspector.colorPreview(label, value && value.length > 0 ? value : fallback);
}

function eventRemoveLabel(event: EventBinding): string {
  return copy.value.inspector.removeEvent(event.event, eventWidgetName(event.widgetId), event.handlerName);
}

function inputValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
}

type StringInputEvent =
  | "bind-image-asset"
  | "rename-widget"
  | "update:event-handler"
  | "update:event-target-widget-id"
  | "update-flex-direction"
  | "update-flex-gap"
  | "update-layout-align"
  | "update-style-align"
  | "update-style-blend-mode"
  | "update-style-font"
  | "update-target-color-depth"
  | "update-target-device-name"
  | "update-target-lvgl-version"
  | "update-text";

function emitInput(eventName: StringInputEvent, event: Event): void {
  const value = inputValue(event);
  switch (eventName) {
    case "bind-image-asset":
      emit("bind-image-asset", value);
      break;
    case "rename-widget":
      emit("rename-widget", value);
      break;
    case "update:event-handler":
      emit("update:event-handler", value);
      break;
    case "update:event-target-widget-id":
      emit("update:event-target-widget-id", value);
      break;
    case "update-flex-direction":
      emit("update-flex-direction", value);
      break;
    case "update-flex-gap":
      emit("update-flex-gap", value);
      break;
    case "update-layout-align":
      emit("update-layout-align", value);
      break;
    case "update-style-align":
      emit("update-style-align", value);
      break;
    case "update-style-blend-mode":
      emit("update-style-blend-mode", value);
      break;
    case "update-style-font":
      emit("update-style-font", value);
      break;
    case "update-target-color-depth":
      emit("update-target-color-depth", value);
      break;
    case "update-target-device-name":
      emit("update-target-device-name", value);
      break;
    case "update-target-lvgl-version":
      emit("update-target-lvgl-version", value);
      break;
    case "update-text":
      emit("update-text", value);
      break;
  }
}

function emitFieldInput(eventName: "update-prop-number" | "update-prop-text", field: string, event: Event): void {
  if (eventName === "update-prop-number") {
    emit("update-prop-number", field, inputValue(event));
    return;
  }
  emit("update-prop-text", field, inputValue(event));
}

function emitStyleText(field: "textColor" | "bgColor" | "borderColor", event: Event): void {
  emit("update-style-text", field, inputValue(event));
}

function emitStyleNumber(field: "opacity" | "radius" | "letterSpace" | "lineSpace", event: Event): void {
  emit("update-style-number", field, inputValue(event));
}

function emitPaddingSide(side: "top" | "right" | "bottom" | "left", event: Event): void {
  emit("update-padding-side", side, inputValue(event));
}

function emitLayoutNumber(field: "x" | "y" | "width" | "height", event: Event): void {
  emit("update-layout-number", field, inputValue(event));
}

function emitTargetNumber(field: "width" | "height" | "dpi", event: Event): void {
  emit("update-target-number", field, inputValue(event));
}

function isBuiltInLvglFont(font: string): boolean {
  return /^lv_font_montserrat_\d+$/.test(font);
}

function updateEventType(event: Event): void {
  const value = inputValue(event);
  if (value === "LV_EVENT_CLICKED" || value === "LV_EVENT_VALUE_CHANGED" || value === "LV_EVENT_READY" || value === "LV_EVENT_CANCEL") {
    emit("update:event-type", value);
  }
}
</script>
